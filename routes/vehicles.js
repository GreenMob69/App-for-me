'use strict';

const express = require('express');
const { THRESHOLDS } = require('../backend/analyzers/config');
const { analyzeTrends } = require('../backend/analyzers/TrendEngine');
const { requireAuth } = require('../middleware/auth');
const dtcService = require('../services/dtcService');

module.exports = function(db, io) {
    const router = express.Router();

    router.get('/ping', (req, res) => res.json({ ok: true }));

    router.get('/vehicul/:vin/statistici', (req, res) => {
        db.get(
            `SELECT COUNT(*) AS total_calatorii, SUM(km_parcursi) AS total_km,
                    SUM(consum_total_l) AS total_combustibil, AVG(scor_eco) AS scor_mediu
             FROM calatorii WHERE vin = ? AND timestamp_end IS NOT NULL`,
            [req.params.vin],
            (err, stats) => res.json(stats || {})
        );
    });

    router.get('/vehicul/:vin/diagnoza', (req, res) => {
        const vin = req.params.vin;
        db.get(
            `SELECT v.model, tf.voltaj_v
             FROM telemetrie_flux tf
             JOIN calatorii c ON c.id_calatorie = tf.id_calatorie
             LEFT JOIN vehicule v ON v.vin = c.vin
             WHERE c.vin = ?
             ORDER BY tf.id_flux DESC LIMIT 1`,
            [vin],
            (err, row) => {
                const v = row?.voltaj_v ?? 14.1;
                const coduriCuDescrierii = dtcService.eroriActiveDTC.map(e => ({
                    ...e,
                    descriere: e.descriere || dtcService.DTC_DESCRIPTIONS[e.cod] || 'Cod OBD-II detectat',
                }));
                res.json({
                    vin,
                    model: row?.model || 'Vehicul',
                    sistem_electric: {
                        voltaj_curent:    v,
                        stare_alternator: v < 13.6 ? 'UZAT_DEGRADAT' : 'OPTIM',
                        baterie_soh_pct:  v >= 13.8 ? 98 : 80,
                    },
                    coduri_dtc:  coduriCuDescrierii,
                    total_erori: coduriCuDescrierii.length,
                });
            }
        );
    });

    router.post('/vehicul/:vin/stergere-erori', (req, res) => {
        dtcService.eroriActiveDTC.splice(0);
        io.emit('alerta_live', { tip: 'DTC_CLEARED', descriere: 'Erorile au fost șterse prin OBD-II!' });
        res.json({ status: 'SUCCES', mesaj: 'Erorile au fost șterse.' });
    });

    router.get('/vehicul/:vin/health', async (req, res) => {
        const vin = req.params.vin || 'WAUZZZ4A1RN000000';
        try {
            const lastTrips = await new Promise((resolve) => {
                db.all(
                    `SELECT ts.*, c.vin, c.timestamp_start, c.km_parcursi, c.consum_total_l, c.scor_eco
                     FROM trip_summary ts
                     JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                     WHERE c.vin = ?
                     ORDER BY ts.id_summary DESC LIMIT 10`,
                    [vin], (err, rows) => resolve(rows || [])
                );
            });

            if (lastTrips.length === 0) {
                return res.json({
                    status: 'NO_DATA', overallHealth: null, scores: null,
                    subsystems: null, predictions: [], timeline: [],
                    lastTrip: null, lastUpdated: null, dataQuality: 'NONE',
                });
            }

            const latest = lastTrips[0];
            let ai = null;
            if (latest.raport_ai_json) {
                try { ai = JSON.parse(latest.raport_ai_json); } catch(e) {}
            }

            const intelligence = ai?.intelligence || {};
            const overallHealth = latest.health_score || 100;
            const scores = {
                engine:  ai?.engine?.score  || 100,
                fuel:    ai?.fuel?.score    || 100,
                driving: ai?.driving?.score || 100,
                safety:  ai?.safetyScore    || 100,
            };

            const dna = intelligence.vehicle_dna || {};
            const predictions   = intelligence.predictions || [];
            const subsystemsRaw = dna.subsystems || {};

            const computeTrend = (recentScores, olderScores) => {
                if (recentScores.length < 2 || olderScores.length < 2) return 'STABLE';
                const avgRecent = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;
                const avgOlder  = olderScores.reduce((s, v) => s + v, 0) / olderScores.length;
                const diff = avgRecent - avgOlder;
                if (diff > 3) return 'IMPROVING';
                if (diff < -3) return 'DECREASING';
                return 'STABLE';
            };

            const overallTrend = computeTrend(
                lastTrips.slice(0, 3).map(t => t.health_score),
                lastTrips.slice(3, 7).map(t => t.health_score)
            );

            const getPred = (category) =>
                predictions.find(p => p.category === category && (p.severity === 'HIGH' || p.severity === 'MEDIUM'));

            const subsystems = {
                motor: {
                    score:      subsystemsRaw.cooling?.score  || scores.engine,
                    status:     subsystemsRaw.cooling?.status || 'Normal',
                    trend:      overallTrend,
                    prediction: getPred('TERMIC') || getPred('ADMISIE') || null,
                },
                electric: {
                    score:      subsystemsRaw.electrical?.score  || 100,
                    status:     subsystemsRaw.electrical?.status || 'Normal',
                    trend:      (latest.voltaj_min < 13.4) ? 'DECREASING' : 'STABLE',
                    prediction: getPred('ELECTRIC') || null,
                },
                turbo: {
                    score:      subsystemsRaw.turbo?.score  || 95,
                    status:     subsystemsRaw.turbo?.status || 'Parametri în toleranță',
                    trend:      'STABLE',
                    prediction: getPred('TURBO') || null,
                },
                combustibil: {
                    score:      subsystemsRaw.fuel?.score  || scores.fuel,
                    status:     subsystemsRaw.fuel?.status || 'Injecție optimă',
                    trend:      'STABLE',
                    prediction: getPred('COMBUSTIBIL') || getPred('EMISII') || null,
                },
                stil_condus: {
                    score:      subsystemsRaw.driving_style?.score || scores.driving,
                    status:     scores.driving > 85 ? 'Economic' : scores.driving > 65 ? 'Moderat' : 'Agresiv',
                    trend:      'STABLE',
                    prediction: null,
                },
            };

            const timeline = lastTrips.map(t => ({
                tripId:   t.id_calatorie,
                health:   t.health_score,
                date:     new Date(t.created_at * 1000).toISOString().split('T')[0],
                km:       t.km_parcursi || 0,
                duration: t.durata_secunde || 0,
            })).reverse();

            const lastTrip = {
                id:               latest.id_calatorie,
                date:             new Date(latest.created_at * 1000).toISOString(),
                distanceKm:       Number((latest.km_parcursi || 0).toFixed(1)),
                durationMin:      Math.round((latest.durata_secunde || 0) / 60),
                consumptionPer100: latest.km_parcursi > 0.1
                    ? Number(((latest.cost_combustibil / THRESHOLDS.DIESEL_PRICE_PER_LITER) / latest.km_parcursi * 100).toFixed(1))
                    : 0,
                ecoScore:    latest.scor_eco     || 100,
                healthScore: latest.health_score,
            };

            const sensorQuality = intelligence.sensorQuality || [];
            const avgQuality = sensorQuality.length > 0
                ? sensorQuality.reduce((s, sq) => s + sq.quality, 0) / sensorQuality.length
                : 100;
            const dataQuality = avgQuality >= 85 ? 'HIGH' : avgQuality >= 60 ? 'MEDIUM' : 'LOW';

            res.json({
                status: 'OK', overallHealth, overallTrend, scores, subsystems,
                predictions: predictions.filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 3),
                timeline, lastTrip,
                lastUpdated: new Date(latest.created_at * 1000).toISOString(),
                dataQuality,
            });
        } catch (error) {
            console.error('[HEALTH ENDPOINT EROARE]', error.message);
            res.status(500).json({ eroare: 'Nu s-a putut calcula starea de sănătate.', detalii: error.message });
        }
    });

    router.get('/vehicul/:vin/health/:system', async (req, res) => {
        const vin    = req.params.vin || 'WAUZZZ4A1RN000000';
        const system = req.params.system;
        try {
            const latest = await new Promise((resolve) => {
                db.get(
                    `SELECT ts.* FROM trip_summary ts
                     JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                     WHERE c.vin = ?
                     ORDER BY ts.id_summary DESC LIMIT 1`,
                    [vin], (err, row) => resolve(row || null)
                );
            });

            if (!latest || !latest.raport_ai_json) {
                return res.status(404).json({ eroare: 'Nu există date pentru acest vehicul.' });
            }

            let ai;
            try { ai = JSON.parse(latest.raport_ai_json); } catch(e) {
                return res.status(500).json({ eroare: 'Datele AI sunt corupte.' });
            }

            const intelligence = ai.intelligence || {};
            const categoryMap  = {
                motor:       ['TERMIC', 'ADMISIE', 'MOTOR'],
                electric:    ['ELECTRIC'],
                turbo:       ['TURBO'],
                combustibil: ['COMBUSTIBIL', 'EMISII'],
                stil_condus: [],
            };
            const systemMap = {
                motor:       ['MOTOR', 'MOTOR / TRANSMISIE'],
                electric:    ['BATERIE & ELECTRIC', 'BATERIE'],
                turbo:       ['TURBO'],
                combustibil: ['COMBUSTIBIL', 'COMBUSTIBIL / ADMISIE'],
                stil_condus: ['COMPORTAMENT'],
            };

            const predictions  = (intelligence.predictions || []).filter(p => (categoryMap[system] || []).includes(p.category));
            const diagnostics  = (intelligence.detailedExplainability || []).filter(d => (systemMap[system] || []).includes(d.system));
            const reliability  = (intelligence.reliability || []).filter(r => (systemMap[system] || []).includes(r.system));

            const evolution = await new Promise((resolve) => {
                db.all(
                    `SELECT ts.health_score, ts.voltaj_min, ts.voltaj_max, ts.coolant_max, ts.boost_mediu,
                            ts.maf_mediu, ts.durata_secunde, ts.created_at, c.km_parcursi
                     FROM trip_summary ts
                     JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                     WHERE c.vin = ?
                     ORDER BY ts.id_summary DESC LIMIT 10`,
                    [vin], (err, rows) => resolve((rows || []).reverse())
                );
            });

            const baseline     = intelligence.baseline_comparison || {};
            const correlations = intelligence.correlations || null;
            const conflicts    = intelligence.conflictResolution || {};

            res.json({
                system, diagnostics, reliability, predictions, evolution,
                baseline, correlations,
                conflicts:     conflicts.ambiguous || [],
                sensorQuality: (intelligence.sensorQuality || []).slice(0, 5),
            });
        } catch (error) {
            console.error('[HEALTH DETAIL EROARE]', error.message);
            res.status(500).json({ eroare: 'Nu s-a putut încărca detaliul.', detalii: error.message });
        }
    });

    router.get('/vehicul/:vin/tendinte', async (req, res) => {
        const vin   = req.params.vin || 'WAUZZZ4A1RN000000';
        const limit = parseInt(req.query.limit) || 20;
        try {
            const raportTendinte = await analyzeTrends(db, vin, limit);
            res.json(raportTendinte);
        } catch (error) {
            console.error('[TREND ENGINE EROARE]', error.message);
            res.status(500).json({ eroare: 'Nu s-a putut calcula raportul de tendințe.', detalii: error.message });
        }
    });

    router.get('/vehicul/:vin/trend-eco', (req, res) => {
        const vin   = req.params.vin;
        const weeks = Math.min(parseInt(req.query.weeks || '8', 10), 26);
        const cutoff = Date.now() - weeks * 7 * 24 * 3600 * 1000;
        db.all(`
            SELECT
                CAST((c.timestamp_start - ?) / (7 * 24 * 3600 * 1000) AS INTEGER) AS week_index,
                ROUND(AVG(c.scor_eco), 1)          AS avg_eco,
                ROUND(AVG(c.consum_mediu_100km),1)  AS avg_consum,
                COUNT(*)                            AS nr_curse
            FROM calatorii c
            WHERE c.vin = ?
              AND c.timestamp_start >= ?
              AND c.timestamp_end IS NOT NULL
            GROUP BY week_index
            ORDER BY week_index ASC
        `, [cutoff, vin, cutoff], (err, rows) => {
            if (err) return res.status(500).json({ eroare: err.message });
            const result = Array.from({ length: weeks }, (_, i) => {
                const found = (rows || []).find(r => r.week_index === i);
                return found || { week_index: i, avg_eco: null, avg_consum: null, nr_curse: 0 };
            });
            res.json({ weeks: result, total_saptamani: weeks });
        });
    });

    router.post('/vehicul/:vin/realimentare', (req, res) => {
        const vin = req.params.vin;
        const { litri, pret_pe_litru, odometru_km, notite } = req.body;
        if (!litri || litri <= 0) return res.status(400).json({ eroare: 'litri trebuie să fie > 0' });
        db.run(
            `INSERT INTO realimentari (vin, timestamp, litri, pret_pe_litru, odometru_km, notite)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [vin, Date.now(), parseFloat(litri), parseFloat(pret_pe_litru || 0), parseFloat(odometru_km || 0), notite || ''],
            function(err) {
                if (err) return res.status(500).json({ eroare: err.message });
                res.json({ ok: true, id: this.lastID });
            }
        );
    });

    router.get('/vehicul/:vin/realimentari', (req, res) => {
        const vin   = req.params.vin;
        const limit = parseInt(req.query.limit || '10', 10);
        db.all(
            `SELECT * FROM realimentari WHERE vin = ? ORDER BY timestamp DESC LIMIT ?`,
            [vin, limit],
            (err, rows) => {
                if (err) return res.status(500).json({ eroare: err.message });
                const enriched = (rows || []).map((r, i, arr) => {
                    const prev = arr[i + 1];
                    let consum_real = null;
                    if (prev && r.odometru_km > 0 && prev.odometru_km > 0) {
                        const km = r.odometru_km - prev.odometru_km;
                        if (km > 0) consum_real = ((r.litri / km) * 100).toFixed(2);
                    }
                    return { ...r, consum_real_100km: consum_real };
                });
                res.json(enriched);
            }
        );
    });

    router.delete('/vehicul/:vin/realimentare/:id', requireAuth, (req, res) => {
        db.run(
            `DELETE FROM realimentari WHERE id = ? AND vin = ?`,
            [req.params.id, req.params.vin],
            function(err) {
                if (err) return res.status(500).json({ eroare: err.message });
                res.json({ ok: true, deleted: this.changes });
            }
        );
    });

    router.post('/vehicul/:vin/predictii/valideaza', (req, res) => {
        const { prediction_hash, titlu, status } = req.body;
        if (!prediction_hash) return res.status(400).json({ eroare: 'prediction_hash necesar' });
        const now = Date.now();
        db.run(
            `INSERT INTO predictii_validare (vin, prediction_hash, titlu, status, timestamp_creat, timestamp_rezolvat)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(vin, prediction_hash) DO UPDATE SET status=excluded.status, timestamp_rezolvat=excluded.timestamp_rezolvat`,
            [req.params.vin, prediction_hash, titlu || '', status || 'REZOLVATA', now, now],
            (err) => err ? res.status(500).json({ eroare: err.message }) : res.json({ ok: true })
        );
    });

    router.get('/vehicul/:vin/predictii/acuratete', (req, res) => {
        db.all(
            `SELECT status, COUNT(*) AS nr FROM predictii_validare WHERE vin = ? GROUP BY status`,
            [req.params.vin],
            (err, rows) => {
                if (err) return res.status(500).json({ eroare: err.message });
                const stats = { ACTIVA: 0, REZOLVATA: 0, FALSA: 0 };
                (rows || []).forEach(r => { stats[r.status] = r.nr; });
                const total = stats.REZOLVATA + stats.FALSA;
                res.json({
                    ...stats,
                    acuratete_pct:   total > 0 ? Math.round((stats.REZOLVATA / total) * 100) : null,
                    total_validate:  total,
                });
            }
        );
    });

    router.get('/vehicul/:vin/predictii/active', (req, res) => {
        db.all(
            `SELECT prediction_hash FROM predictii_validare WHERE vin = ? AND status != 'ACTIVA'`,
            [req.params.vin],
            (err, rows) => res.json((rows || []).map(r => r.prediction_hash))
        );
    });

    router.patch('/vehicul/:vin/profil', (req, res) => {
        const { vin } = req.params;
        const { capacitate_rezervor_l, odometru_calibrat_km } = req.body;
        const updates = [];
        const params  = [];
        if (capacitate_rezervor_l != null && !isNaN(capacitate_rezervor_l)) {
            updates.push('capacitate_rezervor_l = ?');
            params.push(Number(capacitate_rezervor_l));
        }
        if (odometru_calibrat_km != null && !isNaN(odometru_calibrat_km)) {
            updates.push('odometru_calibrat_km = ?');
            params.push(Number(odometru_calibrat_km));
        }
        if (updates.length === 0) return res.status(400).json({ eroare: 'Niciun câmp de actualizat.' });
        params.push(vin);
        db.run(`UPDATE vehicule SET ${updates.join(', ')} WHERE vin = ?`, params, function(err) {
            if (err) return res.status(500).json({ eroare: err.message });
            res.json({ ok: true, changes: this.changes });
        });
    });

    router.get('/vehicule/list', (req, res) => {
        db.all(`
            SELECT
                v.vin,
                COALESCE(vp.make || ' ' || vp.model, v.model) AS model,
                COALESCE(vp.fuel_type, v.tip_combustibil)     AS tip_combustibil,
                COALESCE(vp.fuel_tank_liters, v.capacitate_rezervor_l) AS capacitate_rezervor_l,
                v.odometru_calibrat_km,
                vp.year,
                vp.variant,
                vp.power_hp,
                vp.engine_code,
                vp.id AS vehicle_profile_id
            FROM vehicule v
            LEFT JOIN vehicles vp ON UPPER(vp.vin) = UPPER(v.vin)
            ORDER BY v.rowid ASC
        `, [], (err, rows) => {
            if (err) return res.status(500).json({ eroare: err.message });
            res.json(rows || []);
        });
    });

    return router;
};
