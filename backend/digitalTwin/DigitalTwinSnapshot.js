/**
 * DigitalTwinSnapshot.js — persistență și comparație snapshot-uri
 * -----------------------------------------------------------------------
 * Permite salvarea stării curente a twin-ului și detectarea schimbărilor
 * față de starea anterioară (cursă precedentă).
 *
 * Tabelul `digital_twin_snapshots` este creat automat la prima utilizare.
 * Sunt păstrate maxim 10 snapshot-uri per vehicul.
 * -----------------------------------------------------------------------
 */

const { DigitalTwinSerializer } = require('./DigitalTwinSerializer');

const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        vin                  TEXT    NOT NULL,
        snapshot_json        TEXT    NOT NULL,
        health_score         INTEGER,
        alert_level          TEXT,
        recommendations_count INTEGER,
        data_completeness    INTEGER,
        created_at           INTEGER NOT NULL
    )
`;

const INSERT_SNAPSHOT = `
    INSERT INTO digital_twin_snapshots
        (vin, snapshot_json, health_score, alert_level, recommendations_count, data_completeness, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const LOAD_LAST = `
    SELECT * FROM digital_twin_snapshots
    WHERE vin = ? ORDER BY created_at DESC LIMIT 1
`;

const LOAD_PREV = `
    SELECT * FROM digital_twin_snapshots
    WHERE vin = ? ORDER BY created_at DESC LIMIT 1 OFFSET 1
`;

const CLEANUP = `
    DELETE FROM digital_twin_snapshots
    WHERE vin = ? AND id NOT IN (
        SELECT id FROM digital_twin_snapshots WHERE vin = ? ORDER BY created_at DESC LIMIT 10
    )
`;

// Drive recommendation severity order (pentru diff alertLevel)
const DRIVE_SEVERITY = { NORMAL: 0, CAUTION: 1, AVOID_HIGHWAY: 2, WORKSHOP: 3, DO_NOT_DRIVE: 4 };

class DigitalTwinSnapshot {

    // ── Tabel ─────────────────────────────────────────────────────────────

    static _ensureTable(db) {
        return new Promise((resolve, reject) => {
            db.run(CREATE_TABLE, err => err ? reject(err) : resolve());
        });
    }

    // ── Salvare ───────────────────────────────────────────────────────────

    /**
     * Salvează snapshot-ul curent în DB. Non-blocking — erorile sunt logate, nu aruncate.
     * @returns {Promise<{saved: boolean, healthScore, alertLevel} | null>}
     */
    static async save(db, vin, twin) {
        if (!db || !vin || !twin) return null;
        try {
            await DigitalTwinSnapshot._ensureTable(db);
            const json       = JSON.stringify(DigitalTwinSerializer.toJSON(twin));
            const health     = twin.state?.health?.overallHealth              ?? null;
            const alert      = twin.alertLevel                                 || 'NORMAL';
            const recCount   = (twin.diagnostics?.recommendations || []).length;
            const completeness = twin.meta?.dataCompleteness                  ?? 0;
            const now        = Date.now();

            await new Promise((resolve, reject) => {
                db.run(INSERT_SNAPSHOT, [vin, json, health, alert, recCount, completeness, now],
                    err => err ? reject(err) : resolve());
            });

            // Cleanup asincron — nu blocăm pipeline-ul
            db.run(CLEANUP, [vin, vin], () => {});

            return { saved: true, healthScore: health, alertLevel: alert };
        } catch (e) {
            console.warn('[DigitalTwinSnapshot] save failed:', e.message);
            return null;
        }
    }

    // ── Încărcare ─────────────────────────────────────────────────────────

    /**
     * Încarcă cel mai recent snapshot salvat pentru un vehicul.
     */
    static async load(db, vin) {
        if (!db || !vin) return null;
        try {
            await DigitalTwinSnapshot._ensureTable(db);
            const row = await new Promise((resolve, reject) => {
                db.get(LOAD_LAST, [vin], (err, r) => err ? reject(err) : resolve(r));
            });
            if (!row) return null;
            return {
                twin:              JSON.parse(row.snapshot_json),
                healthScore:       row.health_score,
                alertLevel:        row.alert_level,
                dataCompleteness:  row.data_completeness,
                savedAt:           row.created_at
            };
        } catch (e) {
            console.warn('[DigitalTwinSnapshot] load failed:', e.message);
            return null;
        }
    }

    /**
     * Încarcă snapshot-ul de DINAINTEA celui mai recent (penultimul).
     * Folosit pentru comparație twin curent vs precedent.
     */
    static async loadPrevious(db, vin) {
        if (!db || !vin) return null;
        try {
            await DigitalTwinSnapshot._ensureTable(db);
            const row = await new Promise((resolve, reject) => {
                db.get(LOAD_PREV, [vin], (err, r) => err ? reject(err) : resolve(r));
            });
            if (!row) return null;
            return { twin: JSON.parse(row.snapshot_json), savedAt: row.created_at };
        } catch (e) {
            console.warn('[DigitalTwinSnapshot] loadPrevious failed:', e.message);
            return null;
        }
    }

    // ── Diff ──────────────────────────────────────────────────────────────

    /**
     * Calculează schimbările semnificative dintre două twin-uri.
     * Folosit de Notification Engine: "ce s-a schimbat față de cursă anterioară?"
     *
     * @param {VehicleDigitalTwin} prevTwin
     * @param {VehicleDigitalTwin} currTwin
     * @returns {{ changed: boolean, changes: Change[], escalated: boolean }}
     */
    static diff(prevTwin, currTwin) {
        if (!prevTwin || !currTwin) return { changed: false, changes: [], escalated: false };

        const changes = [];

        // 1. Schimbare health score (prag: ±3 puncte)
        const prevH = prevTwin.state?.health?.overallHealth;
        const currH = currTwin.state?.health?.overallHealth;
        if (prevH != null && currH != null && Math.abs(currH - prevH) >= 3) {
            changes.push({
                field:     'health.overallHealth',
                previous:  prevH,
                current:   currH,
                delta:     currH - prevH,
                direction: currH > prevH ? 'IMPROVED' : 'DEGRADED'
            });
        }

        // 2. Schimbare nivel alertă
        const prevA = prevTwin.alertLevel;
        const currA = currTwin.alertLevel;
        if (prevA !== currA) {
            changes.push({
                field:     'alertLevel',
                previous:  prevA,
                current:   currA,
                escalated: (DRIVE_SEVERITY[currA] ?? 0) > (DRIVE_SEVERITY[prevA] ?? 0)
            });
        }

        // 3. Recomandări noi față de snapshot anterior
        const prevIds = new Set((prevTwin.diagnostics?.recommendations || []).map(r => r.failureId));
        const newRecs = (currTwin.diagnostics?.recommendations || [])
            .filter(r => r.failureId && !prevIds.has(r.failureId));
        if (newRecs.length > 0) {
            changes.push({
                field:    'diagnostics.recommendations',
                newItems: newRecs.map(r => ({
                    failureId: r.failureId,
                    title:     r.title,
                    urgency:   r.urgency,
                    severity:  r.severity
                }))
            });
        }

        // 4. Recomandări rezolvate (dispărute față de anterior)
        const currIds = new Set((currTwin.diagnostics?.recommendations || []).map(r => r.failureId));
        const resolvedRecs = (prevTwin.diagnostics?.recommendations || [])
            .filter(r => r.failureId && !currIds.has(r.failureId));
        if (resolvedRecs.length > 0) {
            changes.push({
                field:         'diagnostics.recommendations',
                resolvedItems: resolvedRecs.map(r => ({ failureId: r.failureId, title: r.title }))
            });
        }

        // 5. Schimbare data completeness semnificativă (±10%)
        const prevC = prevTwin.meta?.dataCompleteness;
        const currC = currTwin.meta?.dataCompleteness;
        if (prevC != null && currC != null && Math.abs(currC - prevC) >= 10) {
            changes.push({ field: 'meta.dataCompleteness', previous: prevC, current: currC });
        }

        const escalated = changes.some(c => c.escalated === true || c.direction === 'DEGRADED');

        return { changed: changes.length > 0, changes, escalated };
    }
}

module.exports = { DigitalTwinSnapshot };
