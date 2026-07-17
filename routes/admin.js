'use strict';

const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    // POST /admin/reset-db — șterge toate datele de telemetrie
    // Profilul vehiculului (vehicule) și structura DB rămân intacte.
    router.post('/reset-db', (req, res) => {
        const tables = [
            'digital_twin_snapshots', 'trip_summary', 'dtc_events',
            'telemetrie_flux', 'calatorii',
        ];
        db.serialize(() => {
            const errors = [];
            const run = (i) => {
                if (i >= tables.length) {
                    if (errors.length) return res.status(500).json({ eroare: errors.join(', ') });
                    return res.json({ ok: true, mesaj: `${tables.length} tabele resetate.` });
                }
                db.run(`DELETE FROM ${tables[i]}`, (err) => {
                    if (err) errors.push(tables[i]);
                    run(i + 1);
                });
            };
            run(0);
        });
    });

    return router;
};
