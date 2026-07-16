/**
 * VehicleTimeline — Persistența evenimentelor în DB
 *
 * Tot ce se întâmplă cu vehiculul ajunge aici:
 * - Service-uri (OIL_CHANGED, BATTERY_REPLACED, etc.)
 * - OBD events (TRIP_COMPLETED, HEALTH_CHANGED, AI_PREDICTION)
 * - Documente (ITP_COMPLETED, RCA_EXPIRED)
 * - Maintenance (MAINTENANCE_DUE_SOON, MAINTENANCE_OVERDUE)
 * - Manual (ODOMETER_UPDATED, NOTE_ADDED)
 *
 * Ascultă EventBus cu wildcard ('*') și persistă TOTUL.
 */

const { vehicleEventBus } = require('./EventBus');

const TIMELINE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS vehicle_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,

        event_type TEXT NOT NULL,
        category TEXT NOT NULL,

        title TEXT NOT NULL,
        description TEXT,

        icon TEXT,
        severity TEXT DEFAULT 'INFO',

        -- Context
        mileage_km INTEGER,
        source TEXT NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,

        -- Metadata
        event_date INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')),

        payload_json TEXT,

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    )
`;

const TIMELINE_INDEX = `CREATE INDEX IF NOT EXISTS idx_timeline_vehicle_date
    ON vehicle_timeline(vehicle_id, event_date DESC)`;

const TIMELINE_INDEX_TYPE = `CREATE INDEX IF NOT EXISTS idx_timeline_type
    ON vehicle_timeline(vehicle_id, event_type, event_date DESC)`;

const TIMELINE_INDEX_CATEGORY = `CREATE INDEX IF NOT EXISTS idx_timeline_category
    ON vehicle_timeline(vehicle_id, category, event_date DESC)`;

// Mapare event_type -> metadata vizuala
const EVENT_META = {
    VEHICLE_CREATED:        { category: 'SYSTEM',      icon: '◆', severity: 'INFO', titleFn: (e) => `Vehicul inregistrat: ${e.make || ''} ${e.model || ''}` },
    VEHICLE_UPDATED:        { category: 'SYSTEM',      icon: '✎', severity: 'INFO', titleFn: (e) => 'Profil vehicul actualizat' },

    SERVICE_ADDED:          { category: 'SERVICE',     icon: '⚙', severity: 'INFO', titleFn: (e) => e.title || `Service: ${e.service_type}` },
    OIL_CHANGED:            { category: 'SERVICE',     icon: '●', severity: 'INFO', titleFn: () => 'Schimb ulei motor' },
    FILTER_REPLACED:        { category: 'SERVICE',     icon: '◇', severity: 'INFO', titleFn: (e) => `Filtru inlocuit: ${e.filter_name || e.service_type}` },
    BATTERY_REPLACED:       { category: 'SERVICE',     icon: '⚡', severity: 'INFO', titleFn: () => 'Baterie inlocuita' },
    TIMING_BELT_REPLACED:   { category: 'SERVICE',     icon: '⊛', severity: 'INFO', titleFn: () => 'Curea distributie inlocuita' },
    BRAKE_SERVICE:          { category: 'SERVICE',     icon: '◎', severity: 'INFO', titleFn: (e) => e.title || 'Service frane' },
    MAINTENANCE_COMPLETED:  { category: 'SERVICE',     icon: '✓', severity: 'INFO', titleFn: (e) => e.title || 'Mentenanta finalizata' },

    ODOMETER_UPDATED:       { category: 'MILEAGE',    icon: '↗', severity: 'INFO', titleFn: (e) => `Kilometraj actualizat: ${e.odometer_km} km` },
    TRIP_COMPLETED:         { category: 'TRIP',        icon: '→', severity: 'INFO', titleFn: (e) => `Cursa finalizata: ${e.distance_km || 0} km` },
    LONG_TRIP:              { category: 'TRIP',        icon: '⇒', severity: 'INFO', titleFn: (e) => `Drum lung: ${e.distance_km} km` },

    HEALTH_IMPROVED:        { category: 'HEALTH',      icon: '↑', severity: 'INFO', titleFn: (e) => `Health Score crescut: ${e.new_score}%` },
    HEALTH_DECREASED:       { category: 'HEALTH',      icon: '↓', severity: 'WARNING', titleFn: (e) => `Health Score scazut: ${e.new_score}%` },
    HEALTH_CRITICAL:        { category: 'HEALTH',      icon: '!', severity: 'CRITICAL', titleFn: (e) => `Health Score critic: ${e.new_score}%` },

    AI_PREDICTION:          { category: 'AI',          icon: '◈', severity: 'WARNING', titleFn: (e) => e.title || `AI: ${e.prediction}` },
    AI_PREDICTION_RESOLVED: { category: 'AI',          icon: '✓', severity: 'INFO', titleFn: (e) => e.title || 'Predictie AI rezolvata' },
    DTC_DETECTED:           { category: 'AI',          icon: '⚠', severity: 'WARNING', titleFn: (e) => `Cod eroare: ${e.dtc_code}` },
    DTC_CLEARED:            { category: 'AI',          icon: '✓', severity: 'INFO', titleFn: (e) => `Eroare stearsa: ${e.dtc_code || 'toate'}` },

    MAINTENANCE_DUE_SOON:   { category: 'MAINTENANCE', icon: '◌', severity: 'WARNING', titleFn: (e) => `Se apropie: ${e.item_name}` },
    MAINTENANCE_OVERDUE:    { category: 'MAINTENANCE', icon: '!', severity: 'CRITICAL', titleFn: (e) => `Depasit: ${e.item_name}` },

    DOCUMENT_ADDED:         { category: 'DOCUMENT',    icon: '◫', severity: 'INFO',     titleFn: (e) => `Document adaugat: ${e.doc_title}` },
    DOCUMENT_UPDATED:       { category: 'DOCUMENT',    icon: '✎', severity: 'INFO',     titleFn: (e) => `Document actualizat: ${e.doc_title}` },
    DOCUMENT_EXPIRING:      { category: 'DOCUMENT',    icon: '◫', severity: 'WARNING',  titleFn: (e) => `Expira curand: ${e.doc_title}` },
    DOCUMENT_EXPIRED:       { category: 'DOCUMENT',    icon: '!', severity: 'CRITICAL', titleFn: (e) => `Expirat: ${e.doc_title}` },
    DOCUMENT_RENEWED:       { category: 'DOCUMENT',    icon: '✓', severity: 'INFO',     titleFn: (e) => `Reinnoit: ${e.doc_title}` },

    NOTE_ADDED:             { category: 'USER',        icon: '✎', severity: 'INFO', titleFn: (e) => e.title || 'Nota adaugata' },

    MILESTONE_ACHIEVED:     { category: 'MILESTONE',   icon: '★', severity: 'INFO', titleFn: (e) => e.title || 'Milestone atins' },
    AI_PREDICTION_CONFIRMED:{ category: 'AI',          icon: '◈', severity: 'INFO', titleFn: (e) => e.title || 'Predictie AI confirmata' },
};

let _db = null;

function initTimelineSchema(db) {
    _db = db;
    db.run(TIMELINE_SCHEMA);
    db.run(TIMELINE_INDEX);
    db.run(TIMELINE_INDEX_TYPE);
    db.run(TIMELINE_INDEX_CATEGORY);
}

function initTimelineListener() {
    vehicleEventBus.on('*', (event) => {
        if (!_db) return;
        if (!event.vehicle_id) return;

        const meta = EVENT_META[event.type] || {
            category: 'OTHER',
            icon: '•',
            severity: 'INFO',
            titleFn: () => event.type
        };

        const title = meta.titleFn(event);
        const description = event.description || null;
        const payload = { ...event };
        delete payload.type;
        delete payload.timestamp;
        delete payload.vehicle_id;

        _db.run(`
            INSERT INTO vehicle_timeline
                (vehicle_id, event_type, category, title, description, icon, severity,
                 mileage_km, source, reference_type, reference_id, event_date, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            event.vehicle_id,
            event.type,
            meta.category,
            title,
            description,
            meta.icon,
            meta.severity,
            event.mileage_km || null,
            event.source || 'SYSTEM',
            event.reference_type || null,
            event.reference_id || null,
            event.timestamp,
            JSON.stringify(payload),
        ]);
    });
}

function registerTimelineRoutes(app, db) {

    // GET timeline complet (paginat)
    app.get('/api/vehicles/:id/timeline', (req, res) => {
        const vehicleId = req.params.id;
        const { category, limit, offset, from, to } = req.query;

        let query = `SELECT * FROM vehicle_timeline WHERE vehicle_id = ?`;
        const params = [vehicleId];

        if (category) {
            query += ` AND category = ?`;
            params.push(category.toUpperCase());
        }
        if (from) {
            query += ` AND event_date >= ?`;
            params.push(parseInt(from));
        }
        if (to) {
            query += ` AND event_date <= ?`;
            params.push(parseInt(to));
        }

        query += ` ORDER BY event_date DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit) || 50);
        params.push(parseInt(offset) || 0);

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const events = (rows || []).map(row => ({
                ...row,
                payload: row.payload_json ? JSON.parse(row.payload_json) : null,
                payload_json: undefined,
            }));

            res.json(events);
        });
    });

    // GET timeline summary (counts per category)
    app.get('/api/vehicles/:id/timeline/summary', (req, res) => {
        const vehicleId = req.params.id;

        db.all(`
            SELECT category, COUNT(*) as count,
                   MAX(event_date) as last_event_date
            FROM vehicle_timeline
            WHERE vehicle_id = ?
            GROUP BY category
            ORDER BY last_event_date DESC
        `, [vehicleId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
    });

    // GET recent events (last 30 days, for STARE screen)
    app.get('/api/vehicles/:id/timeline/recent', (req, res) => {
        const vehicleId = req.params.id;
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

        db.all(`
            SELECT * FROM vehicle_timeline
            WHERE vehicle_id = ? AND event_date >= ?
            ORDER BY event_date DESC
            LIMIT 20
        `, [vehicleId, thirtyDaysAgo], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const events = (rows || []).map(row => ({
                ...row,
                payload: row.payload_json ? JSON.parse(row.payload_json) : null,
                payload_json: undefined,
            }));

            res.json(events);
        });
    });
}

module.exports = {
    initTimelineSchema,
    initTimelineListener,
    registerTimelineRoutes,
    EVENT_META,
};
