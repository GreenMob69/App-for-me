'use strict';

const calatoriiActive = require('./activeTrips');

function startWatchdog(db) {
    // Auto-închide cursele blocate (>2h fără OPRIRE)
    setInterval(() => {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000;
        db.all(
            `SELECT id_calatorie, vin, timestamp_start FROM calatorii WHERE timestamp_end IS NULL AND timestamp_start < ?`,
            [cutoff],
            (err, rows) => {
                if (err || !rows?.length) return;
                rows.forEach(row => {
                    const now    = Date.now();
                    const durSec = Math.round((now - row.timestamp_start) / 1000);
                    console.warn(`[WATCHDOG] Cursă #${row.id_calatorie} (${row.vin}) stale >2h — auto-închidere.`);
                    db.run(`UPDATE calatorii SET timestamp_end=? WHERE id_calatorie=?`, [now, row.id_calatorie]);
                    db.run(
                        `INSERT OR IGNORE INTO trip_summary (id_calatorie, durata_secunde, trip_tag) VALUES (?, ?, 'AUTO_CLOSED')`,
                        [row.id_calatorie, durSec]
                    );
                    if (calatoriiActive[row.vin]?.id_calatorie === row.id_calatorie) {
                        delete calatoriiActive[row.vin];
                    }
                });
            }
        );
    }, 5 * 60 * 1000);

    // Șterge telemetrie_flux mai veche de 90 zile
    const runCleanup = () => {
        const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
        db.run(`DELETE FROM telemetrie_flux WHERE timestamp < ?`, [cutoff], function(err) {
            if (!err && this.changes > 0)
                console.log(`[CLEANUP] ${this.changes} rânduri vechi șterse din telemetrie_flux (>90 zile).`);
        });
    };
    runCleanup();
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
}

module.exports = { startWatchdog };
