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

    // Politică automată de retenție: Șterge telemetrie_flux brută mai veche de 14 zile
    // (Păstrează permanent sinteza din trip_summary, calatorii, alerte și predicții AI, economisind spațiul pe disc)
    const runCleanup = (daysToKeep = 14) => {
        cleanOldTelemetryFlux(db, daysToKeep);
    };
    runCleanup(14);
    setInterval(() => runCleanup(14), 24 * 60 * 60 * 1000);
}

function cleanOldTelemetryFlux(db, daysToKeep = 14) {
    return new Promise((resolve, reject) => {
        const cutoff = Date.now() - daysToKeep * 24 * 3600 * 1000;
        db.run(`DELETE FROM telemetrie_flux WHERE timestamp < ?`, [cutoff], function(err) {
            if (err) {
                console.error('[CLEANUP EROARE]', err.message);
                return reject(err);
            }
            if (this.changes > 0) {
                console.log(`[CLEANUP] Retenție ${daysToKeep} zile: ${this.changes} rânduri brute șterse din telemetrie_flux.`);
            }
            resolve(this.changes);
        });
    });
}

module.exports = { startWatchdog, cleanOldTelemetryFlux };
