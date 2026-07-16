'use strict';
/**
 * DocumentsModule — CRUD complet pentru documente vehicul
 * ITP, RCA, CASCO, Rovinietă, Revizie GPL, Inspecții custom
 *
 * Status calculat dinamic (fără coloana în DB):
 *   EXPIRED  — expiry_date < now
 *   EXPIRING — expiry_date < now + reminder_days * 86400
 *   ACTIVE   — altfel
 */

const { vehicleEventBus } = require('./EventBus');

const DOCUMENTS_SCHEMA = `
    CREATE TABLE IF NOT EXISTS vehicle_documents (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id  INTEGER NOT NULL,

        title       TEXT NOT NULL,
        type        TEXT NOT NULL,

        issue_date    INTEGER,
        expiry_date   INTEGER,
        reminder_days INTEGER DEFAULT 30,

        issuer         TEXT,
        notes          TEXT,
        attachment_url TEXT,

        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now')),

        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
    )
`;

const DOCUMENTS_INDEX = `CREATE INDEX IF NOT EXISTS idx_documents_vehicle
    ON vehicle_documents(vehicle_id, expiry_date ASC)`;

// ── Status computation ────────────────────────────────────────────────────────

function computeDocumentStatus(doc, nowSec) {
    if (!doc.expiry_date) return 'ACTIVE';
    const now = nowSec || Math.floor(Date.now() / 1000);
    if (doc.expiry_date < now) return 'EXPIRED';
    const remindAt = doc.expiry_date - (doc.reminder_days || 30) * 86400;
    if (now >= remindAt) return 'EXPIRING';
    return 'ACTIVE';
}

function hydrateStatus(rows) {
    const now = Math.floor(Date.now() / 1000);
    return rows.map(d => ({ ...d, status: computeDocumentStatus(d, now) }));
}

const STATUS_SORT = { EXPIRED: 0, EXPIRING: 1, ACTIVE: 2 };

function sortDocs(docs) {
    return [...docs].sort((a, b) =>
        (STATUS_SORT[a.status] ?? 3) - (STATUS_SORT[b.status] ?? 3)
    );
}

// ── Schema init ───────────────────────────────────────────────────────────────

function initDocumentsSchema(db) {
    db.run(DOCUMENTS_SCHEMA);
    db.run(DOCUMENTS_INDEX);
}

// ── Routes ────────────────────────────────────────────────────────────────────

function registerDocumentRoutes(app, db) {

    // GET all documents for vehicle (sorted EXPIRED → EXPIRING → ACTIVE)
    app.get('/api/vehicles/:id/documents', (req, res) => {
        db.all(
            `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC NULLS LAST`,
            [req.params.id],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(sortDocs(hydrateStatus(rows || [])));
            }
        );
    });

    // POST create document
    app.post('/api/vehicles/:id/documents', (req, res) => {
        const vehicleId = req.params.id;
        const { title, type, issue_date, expiry_date, reminder_days, issuer, notes, attachment_url } = req.body;
        if (!title) return res.status(400).json({ error: 'title este obligatoriu' });
        if (!type)  return res.status(400).json({ error: 'type este obligatoriu' });

        const now = Math.floor(Date.now() / 1000);

        db.run(`
            INSERT INTO vehicle_documents
                (vehicle_id, title, type, issue_date, expiry_date, reminder_days, issuer, notes, attachment_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            vehicleId, title, type,
            issue_date   || null,
            expiry_date  || null,
            reminder_days != null ? reminder_days : 30,
            issuer       || null,
            notes        || null,
            attachment_url || null,
            now, now,
        ], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const docId = this.lastID;
            const status = computeDocumentStatus({ expiry_date, reminder_days: reminder_days || 30 });

            vehicleEventBus.emit('DOCUMENT_ADDED', {
                vehicle_id:     parseInt(vehicleId),
                source:         'USER',
                doc_title:      title,
                doc_type:       type,
                reference_type: 'DOCUMENT',
                reference_id:   docId,
            });

            console.log(`[DOCUMENTS] Added: ${title} (${type}) — vehicul ${vehicleId}`);
            res.status(201).json({ id: docId, status });
        });
    });

    // PUT update document
    app.put('/api/documents/:id', (req, res) => {
        const { title, type, issue_date, expiry_date, reminder_days, issuer, notes, attachment_url } = req.body;
        const now = Math.floor(Date.now() / 1000);

        db.get(`SELECT * FROM vehicle_documents WHERE id = ?`, [req.params.id], (err, original) => {
            if (err)      return res.status(500).json({ error: err.message });
            if (!original) return res.status(404).json({ error: 'Document negăsit' });

            const sets = ['updated_at = ?'];
            const vals = [now];

            if (title          !== undefined) { sets.push('title = ?');          vals.push(title); }
            if (type           !== undefined) { sets.push('type = ?');           vals.push(type); }
            if (issue_date     !== undefined) { sets.push('issue_date = ?');     vals.push(issue_date); }
            if (expiry_date    !== undefined) { sets.push('expiry_date = ?');    vals.push(expiry_date); }
            if (reminder_days  !== undefined) { sets.push('reminder_days = ?');  vals.push(reminder_days); }
            if (issuer         !== undefined) { sets.push('issuer = ?');         vals.push(issuer); }
            if (notes          !== undefined) { sets.push('notes = ?');          vals.push(notes); }
            if (attachment_url !== undefined) { sets.push('attachment_url = ?'); vals.push(attachment_url); }

            vals.push(req.params.id);

            db.run(`UPDATE vehicle_documents SET ${sets.join(', ')} WHERE id = ?`, vals, function(err2) {
                if (err2)         return res.status(500).json({ error: err2.message });
                if (!this.changes) return res.status(404).json({ error: 'Document negăsit' });

                const isRenewal = expiry_date != null &&
                    original.expiry_date != null &&
                    expiry_date > original.expiry_date;
                const eventType = isRenewal ? 'DOCUMENT_RENEWED' : 'DOCUMENT_UPDATED';

                vehicleEventBus.emit(eventType, {
                    vehicle_id:     original.vehicle_id,
                    source:         'USER',
                    doc_title:      title || original.title,
                    doc_type:       type  || original.type,
                    reference_type: 'DOCUMENT',
                    reference_id:   parseInt(req.params.id),
                });

                res.json({ success: true, renewed: isRenewal });
            });
        });
    });

    // DELETE document
    app.delete('/api/documents/:id', (req, res) => {
        db.run(`DELETE FROM vehicle_documents WHERE id = ?`, [req.params.id], function(err) {
            if (err)          return res.status(500).json({ error: err.message });
            if (!this.changes) return res.status(404).json({ error: 'Document negăsit' });
            res.json({ success: true });
        });
    });

    console.log('[DOCUMENTS] Routes registered (CRUD + status computation)');
}

module.exports = {
    initDocumentsSchema,
    registerDocumentRoutes,
    computeDocumentStatus,
    hydrateStatus,
    sortDocs,
};
