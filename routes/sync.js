'use strict';
/**
 * POST /api/sync/obd
 *
 * Primeşte date OBD stocate local pe cardul SD al ESP32
 * şi le inserează în baza de date ca o cursă completă.
 *
 * Body JSON:
 * {
 *   vin:         string,
 *   trip_start:  number,   // ms timestamp
 *   trip_end:    number,   // ms timestamp
 *   rows: [{
 *     ts:        number,   // ms
 *     rpm:       number,
 *     viteza:    number,   // km/h
 *     temp_apa:  number,   // °C
 *     voltaj:    number,   // V
 *     sarcina:   number,   // %  (opţional)
 *     maf:       number,   // g/s (opţional)
 *     boost:     number,   // bar (opţional)
 *     consum_lh: number,   // L/h (opţional)
 *   }]
 * }
 */

const express = require('express');
const DEVICE_SYNC_TOKEN = process.env.DEVICE_SYNC_TOKEN || 'telemetrie_esp32_sync_secret_2026';

module.exports = function syncRoutes(db) {
    const router = express.Router();

    router.post('/sync/obd', (req, res) => {
        const clientToken = req.headers['x-device-token'] || req.query.token;
        if (DEVICE_SYNC_TOKEN && clientToken !== DEVICE_SYNC_TOKEN) {
            return res.status(401).json({ error: 'Neautorizat: token dispozitiv invalid sau lipsă (header x-device-token)' });
        }

        const { vin, trip_start, trip_end, rows } = req.body;

        if (!vin || !trip_start || !Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'vin, trip_start şi rows sunt obligatorii' });
        }

        // Calculează statistici din flux
        let kmParcursi    = 0;
        let consumTotal   = 0;
        let prevTs        = null;
        let vitezaMax     = 0;
        let vitezaSum     = 0;
        let rpmSum        = 0;
        let tempMax       = 0;
        let voltajMin     = 99;
        let voltajMax     = 0;

        for (const r of rows) {
            if (prevTs !== null) {
                const dtH = (r.ts - prevTs) / 3_600_000; // ore
                kmParcursi  += (r.viteza  || 0) * dtH;
                consumTotal += (r.consum_lh || 0) * dtH;
            }
            prevTs = r.ts;

            if ((r.viteza  || 0) > vitezaMax) vitezaMax  = r.viteza;
            if ((r.temp_apa || 0) > tempMax)   tempMax   = r.temp_apa;
            if ((r.voltaj  || 99) < voltajMin) voltajMin = r.voltaj;
            if ((r.voltaj  || 0)  > voltajMax) voltajMax = r.voltaj;

            vitezaSum += (r.viteza || 0);
            rpmSum    += (r.rpm    || 0);
        }

        const vitezaMedie   = vitezaSum / rows.length;
        const rpmMediu      = Math.round(rpmSum / rows.length);
        const consumMediu   = kmParcursi > 0.1 ? (consumTotal / kmParcursi) * 100 : 0;

        // Scor eco simplu: penalizează consum ridicat şi RPM înalt
        const scorEco = Math.max(0, Math.min(100,
            100 - Math.max(0, consumMediu - 6) * 4
                - Math.max(0, (rpmMediu - 2000) / 100)
        ));

        db.serialize(() => {
            // 1. Inserează cursa
            db.run(
                `INSERT INTO calatorii
                 (vin, timestamp_start, timestamp_end, km_parcursi,
                  consum_total_l, consum_mediu_100km, scor_eco)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    vin,
                    trip_start,
                    trip_end || (trip_start + rows.length * 1000),
                    parseFloat(kmParcursi.toFixed(3)),
                    parseFloat(consumTotal.toFixed(3)),
                    parseFloat(consumMediu.toFixed(2)),
                    Math.round(scorEco),
                ],
                function (err) {
                    if (err) {
                        console.error('[SYNC] Eroare inserare cursă:', err.message);
                        return res.status(500).json({ error: 'Eroare inserare cursă' });
                    }

                    const idCalatorie = this.lastID;

                    // 2. Inserează rânduri flux (batch)
                    const stmt = db.prepare(
                        `INSERT INTO telemetrie_flux
                         (id_calatorie, timestamp, rpm, viteza_kmh, sarcina_pct,
                          maf_gs, voltaj_v, temp_apa_c, consum_lh, boost_bar, matrice_completa_json)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    );

                    for (const r of rows) {
                        stmt.run([
                            idCalatorie,
                            r.ts,
                            r.rpm       || null,
                            r.viteza    || null,
                            r.sarcina   || null,
                            r.maf       || null,
                            r.voltaj    || null,
                            r.temp_apa  || null,
                            r.consum_lh || null,
                            r.boost     || null,
                            JSON.stringify(r),
                        ]);
                    }

                    stmt.finalize((err2) => {
                        if (err2) {
                            console.error('[SYNC] Eroare inserare flux:', err2.message);
                            return res.status(500).json({ error: 'Eroare inserare flux' });
                        }

                        // 3. Inserează trip_summary
                        const durata = Math.round(
                            ((trip_end || trip_start + rows.length * 1000) - trip_start) / 1000
                        );

                        db.run(
                            `INSERT OR REPLACE INTO trip_summary
                             (id_calatorie, durata_secunde, viteza_max, viteza_medie,
                              rpm_mediu, coolant_max, voltaj_min, voltaj_max,
                              cost_combustibil, emisii_co2, health_score)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                idCalatorie,
                                durata,
                                parseFloat(vitezaMax.toFixed(1)),
                                parseFloat(vitezaMedie.toFixed(1)),
                                rpmMediu,
                                parseFloat(tempMax.toFixed(1)),
                                parseFloat(voltajMin === 99 ? 0 : voltajMin),
                                parseFloat(voltajMax.toFixed(2)),
                                parseFloat((consumTotal * 7.2).toFixed(2)), // ~7.2 RON/L
                                parseFloat((consumTotal * 2.64).toFixed(2)), // ~2.64 kg CO2/L diesel
                                Math.round(scorEco),
                            ],
                            (err3) => {
                                if (err3) console.warn('[SYNC] Warning summary:', err3.message);

                                console.log(`[SYNC] Cursă sincronizată: ${idCalatorie} (${rows.length} rânduri, ${kmParcursi.toFixed(1)} km)`);
                                res.json({
                                    ok: true,
                                    id_calatorie: idCalatorie,
                                    rows_inserted: rows.length,
                                    km: parseFloat(kmParcursi.toFixed(1)),
                                });
                            }
                        );
                    });
                }
            );
        });
    });

    // GET /api/sync/status?vin=xxx — câte curse are VIN-ul în DB
    // Util pentru ESP32 să verifice dacă serverul e disponibil + sincronizat
    router.get('/sync/status', (req, res) => {
        const { vin } = req.query;
        if (!vin) return res.json({ ok: true, trips: 0 });

        db.get(
            'SELECT COUNT(*) AS cnt FROM calatorii WHERE vin = ?',
            [vin],
            (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ ok: true, trips: row?.cnt || 0 });
            }
        );
    });

    return router;
};
