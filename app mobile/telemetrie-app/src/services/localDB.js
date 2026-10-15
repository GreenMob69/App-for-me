'use strict';
import * as SQLite from 'expo-sqlite';

let _dbPromise = null;

function openDB() {
    if (!_dbPromise) {
        _dbPromise = SQLite.openDatabaseAsync('telemetrie_local.db').then(async (db) => {
            await db.execAsync('PRAGMA journal_mode = WAL;');
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS trips (
                    id_calatorie    INTEGER PRIMARY KEY,
                    vin             TEXT    NOT NULL,
                    timestamp_start INTEGER DEFAULT 0,
                    raw_json        TEXT    NOT NULL,
                    search_text     TEXT    DEFAULT '',
                    synced_at       INTEGER DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_trips_vin_ts
                    ON trips (vin, timestamp_start DESC);
            `);
            // Migration: adaugă coloana în tabele create înainte de această versiune
            try { await db.execAsync('ALTER TABLE trips ADD COLUMN search_text TEXT DEFAULT ""'); } catch {}
            return db;
        });
    }
    return _dbPromise;
}

/**
 * Salvează sau actualizează un lot de curse în SQLite local.
 * Cursele existente (același id_calatorie) sunt suprascrise cu datele noi.
 */
export async function upsertTrips(vin, trips) {
    if (!trips?.length) return;
    const db = await openDB();
    await db.withTransactionAsync(async () => {
        for (const t of trips) {
            const hasDTC    = (t.nr_dtc    || 0) > 0;
            const hasCool   = parseFloat(t.coolant_max || 0) > 100;
            const hasAlerts = (t.nr_alerte || 0) > 0;
            const eco       = t.scor_eco || 100;
            const cons      = parseFloat(t.consum_mediu_100km || 0);
            const badges    = [];
            if (hasDTC || hasCool)                  badges.push('erori dtc');
            else if (hasAlerts)                     badges.push('alerte');
            else if (cons > 9)                      badges.push('consum ridicat');
            else                                    badges.push('normal');
            if (eco >= 90 && !hasDTC && !hasAlerts) badges.push('eco');
            const searchText = [
                String(Math.round(parseFloat(t.km_parcursi || 0))),
                cons > 0 ? String(cons.toFixed(1)) : '',
                t.trip_tag || '',
                ...badges,
            ].join(' ').toLowerCase();

            await db.runAsync(
                `INSERT OR REPLACE INTO trips
                 (id_calatorie, vin, timestamp_start, raw_json, search_text, synced_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [t.id_calatorie, vin, t.timestamp_start || 0, JSON.stringify(t), searchText, Date.now()]
            );
        }
    });
}

/**
 * Interoghează cursele locale cu filtru temporal și paginare.
 * Returnează { rows: Trip[], total: number }.
 */
export async function queryTrips(vin, { filter = 'ALL', limit = 25, offset = 0, search = null } = {}) {
    const db = await openDB();

    const now = new Date();
    let where = 'vin = ?';
    const baseArgs = [vin];

    if (filter === 'TODAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        where += ' AND timestamp_start >= ?';
        baseArgs.push(start);
    } else if (filter === 'WEEK') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 7 * 86400000;
        where += ' AND timestamp_start >= ?';
        baseArgs.push(start);
    } else if (filter === 'MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        where += ' AND timestamp_start >= ?';
        baseArgs.push(start);
    } else if (filter === 'BUSINESS') {
        where += " AND search_text LIKE '%business%'";
    } else if (filter === 'PERSONAL') {
        where += " AND search_text LIKE '%personal%'";
    } else if (filter === 'ALERTS') {
        where += " AND (search_text LIKE '%alerte%' OR search_text LIKE '%erori dtc%')";
    }

    if (search) {
        where += ' AND search_text LIKE ?';
        baseArgs.push(`%${search.toLowerCase()}%`);
    }

    const countRow = await db.getFirstAsync(
        `SELECT COUNT(*) AS total FROM trips WHERE ${where}`,
        baseArgs
    );
    const total = countRow?.total ?? 0;

    const rows = await db.getAllAsync(
        `SELECT raw_json FROM trips WHERE ${where} ORDER BY timestamp_start DESC LIMIT ? OFFSET ?`,
        [...baseArgs, limit, offset]
    );

    return {
        rows: rows
            .map(r => { try { return JSON.parse(r.raw_json); } catch { return null; } })
            .filter(Boolean),
        total,
    };
}

/**
 * Numărul total de curse salvate local pentru un VIN.
 */
export async function localTripCount(vin) {
    const db = await openDB();
    const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM trips WHERE vin = ?', [vin]);
    return row?.n ?? 0;
}
