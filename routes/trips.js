'use strict';

const express = require('express');
const { THRESHOLDS } = require('../backend/analyzers/config');
const { requireAuth } = require('../middleware/auth');

module.exports = function(db, io) {
    const router = express.Router();

    router.get('/calatorii', (req, res) => {
        db.all(`SELECT * FROM calatorii ORDER BY id_calatorie DESC`, [], (err, rows) => res.json(rows || []));
    });

    // IMPORTANT: literal routes BEFORE parameterized :id
    router.get('/calatorii/filtrate', (req, res) => {
        const { startDate, endDate, hasAlerts, hasDTC, tempOver, tag } = req.query;

        let query = `
            SELECT c.*, ts.health_score, ts.hard_brakes, ts.hard_accelerations, ts.nr_alerte, ts.nr_dtc,
                   ts.coolant_max, ts.trip_tag, ts.viteza_max, ts.viteza_medie
            FROM calatorii c
            LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
            WHERE c.timestamp_end IS NOT NULL
        `;
        const params = [];

        if (startDate) {
            query += ` AND c.timestamp_start >= ?`;
            params.push(new Date(startDate + 'T00:00:00').getTime());
        }
        if (endDate) {
            const endTs = new Date(endDate + 'T00:00:00');
            endTs.setHours(23, 59, 59, 999);
            query += ` AND c.timestamp_start <= ?`;
            params.push(endTs.getTime());
        }
        if (hasAlerts === 'true') {
            query += ` AND (ts.hard_brakes > 0 OR ts.hard_accelerations > 0 OR ts.nr_alerte > 0)`;
        }
        if (hasDTC === 'true') {
            query += ` AND ts.nr_dtc > 0`;
        }
        if (tempOver) {
            query += ` AND ts.coolant_max > ?`;
            params.push(parseFloat(tempOver));
        }
        if (tag && tag !== 'ALL') {
            query += ` AND ts.trip_tag = ?`;
            params.push(tag);
        }

        query += ` ORDER BY c.id_calatorie DESC`;

        const limit  = parseInt(req.query.limit  || '50', 10);
        const offset = parseInt(req.query.offset || '0',  10);

        db.get(`SELECT COUNT(*) AS total FROM (${query})`, params, (err, countRow) => {
            const total = countRow?.total || 0;
            query += ` LIMIT ? OFFSET ?`;
            db.all(query, [...params, limit, offset], (err, rows) => {
                if (err) return res.status(500).json({ eroare: err.message });
                res.json({ rows: rows || [], total, limit, offset });
            });
        });
    });

    router.get('/calatorii/comparatie', (req, res) => {
        const vin = req.query.vin || '';
        const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
        db.get(`
            SELECT
                AVG(c.consum_mediu_100km)  AS avg_consum,
                AVG(c.scor_eco)            AS avg_eco,
                AVG(ts.viteza_medie)       AS avg_viteza,
                AVG(ts.cost_combustibil)   AS avg_cost,
                AVG(ts.emisii_co2)         AS avg_co2,
                AVG(ts.rpm_mediu)          AS avg_rpm,
                COUNT(*)                   AS nr_curse
            FROM calatorii c
            LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
            WHERE c.vin = ?
              AND c.timestamp_start >= ?
              AND c.timestamp_end IS NOT NULL
        `, [vin, thirtyDaysAgo], (err, row) => {
            if (err) return res.status(500).json({ eroare: err.message });
            res.json(row || {});
        });
    });

    router.get('/calatorii/:id', (req, res) => {
        const id = req.params.id;
        db.get(`SELECT * FROM calatorii WHERE id_calatorie = ?`, [id], (err, trip) => {
            if (!trip) return res.status(404).json({ eroare: 'Călătoria nu a fost găsită' });
            db.all(`SELECT * FROM evenimente_alerte WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err, alerte) => {
                db.all(`SELECT timestamp, matrice_completa_json FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err, grafic) => {
                    const date_complete = (grafic || []).map(row => {
                        try { return JSON.parse(row.matrice_completa_json); } catch(e) { return null; }
                    }).filter(i => i !== null);
                    res.json({ rezumat: trip, alerte: alerte || [], date_grafic: date_complete });
                });
            });
        });
    });

    router.get('/calatorii/:id/analiza', (req, res) => {
        db.get(`SELECT * FROM trip_summary WHERE id_calatorie = ?`, [req.params.id], (err, row) => {
            if (!row) return res.status(404).json({ eroare: 'Nu există încă o analiză pentru această călătorie.' });
            const { raport_ai_json, ...rest } = row;
            res.json({ ...rest, ai: raport_ai_json ? JSON.parse(raport_ai_json) : null });
        });
    });

    router.get('/calatorii/:id/report', (req, res) => {
        const id = req.params.id;
        db.get(`SELECT ts.*, c.km_parcursi, c.consum_total_l, c.scor_eco, c.timestamp_start, c.timestamp_end
                FROM trip_summary ts
                JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                WHERE ts.id_calatorie = ?`, [id], (err, row) => {
            if (!row) return res.status(404).json({ eroare: 'Raportul nu există pentru această cursă.' });

            let ai = null;
            if (row.raport_ai_json) {
                try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}
            }

            const intelligence = ai?.intelligence || {};
            const litriTotali = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;

            const report = {
                tripId: row.id_calatorie,
                healthScore: row.health_score,
                scores: {
                    engine:  ai?.engine?.score  || 100,
                    fuel:    ai?.fuel?.score    || 100,
                    driving: ai?.driving?.score || 100,
                    safety:  ai?.safetyScore    || 100,
                },
                stats: {
                    distanceKm:       Number((row.km_parcursi || 0).toFixed(2)),
                    durationMin:      Math.round((row.durata_secunde || 0) / 60),
                    fuelLiters:       Number(litriTotali.toFixed(2)),
                    consumptionPer100: row.km_parcursi > 0.1 ? Number((litriTotali / row.km_parcursi * 100).toFixed(1)) : 0,
                    costRON:          Number((row.cost_combustibil || 0).toFixed(2)),
                    co2Kg:            Number((row.emisii_co2 || 0).toFixed(2)),
                    ecoScore:         row.scor_eco || 100,
                },
                driving: {
                    smoothPct:         ai?.driving?.style?.smoothPct    || 0,
                    economicPct:       ai?.driving?.style?.economicPct  || 0,
                    aggressivePct:     ai?.driving?.style?.aggressivePct || 0,
                    hardBrakes:        row.hard_brakes        || 0,
                    hardAccelerations: row.hard_accelerations || 0,
                    overspeeds:        ai?.driving?.events?.overspeeds  || 0,
                },
                insights: [],
                predictions: (intelligence.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 2),
                timestamp: row.timestamp_start,
            };

            if (row.health_score >= 90) report.insights.push({ type: 'POSITIVE', icon: '✓', text: 'Cursă excelentă — sisteme în parametri optimi' });
            if (report.driving.aggressivePct > 25) {
                report.insights.push({ type: 'WARNING', icon: '⚡', text: `Condus agresiv ${Math.round(report.driving.aggressivePct)}% din cursă` });
            } else if (report.driving.economicPct > 60) {
                report.insights.push({ type: 'POSITIVE', icon: '✓', text: `Condus economic ${Math.round(report.driving.economicPct)}% din cursă` });
            }
            if (row.hard_brakes + row.hard_accelerations > 3) {
                report.insights.push({ type: 'WARNING', icon: '⚠', text: `${row.hard_brakes + row.hard_accelerations} evenimente bruște detectate` });
            }
            if (row.coolant_max > 100) report.insights.push({ type: 'NEGATIVE', icon: '!', text: `Supraîncălzire: ${row.coolant_max}°C` });
            if (row.voltaj_min < 13.2)  report.insights.push({ type: 'WARNING',  icon: '⚡', text: `Tensiune minimă ${row.voltaj_min}V` });

            res.json(report);
        });
    });

    router.put('/calatorii/:id/tag', (req, res) => {
        const id = req.params.id;
        const { tag } = req.body;
        const validTags = ['BUSINESS', 'PERSONAL', 'TESTARE'];
        if (!validTags.includes(tag)) {
            return res.status(400).json({ eroare: `Tag invalid. Valori acceptate: ${validTags.join(', ')}` });
        }
        db.run(`UPDATE trip_summary SET trip_tag = ? WHERE id_calatorie = ?`, [tag, id], function(err) {
            if (err) return res.status(500).json({ eroare: err.message });
            if (this.changes === 0) return res.status(404).json({ eroare: 'Cursă negăsită' });
            res.json({ success: true, id_calatorie: id, tag });
        });
    });

    router.get('/calatorii/:id/report/pdf', (req, res) => {
        const id = req.params.id;
        db.get(`SELECT c.id_calatorie, c.vin, c.km_parcursi, c.consum_total_l, c.consum_mediu_100km,
                       c.scor_eco, c.timestamp_start, c.timestamp_end,
                       ts.health_score, ts.durata_secunde, ts.viteza_max, ts.rpm_max,
                       ts.coolant_max, ts.boost_max, ts.voltaj_min, ts.voltaj_max,
                       ts.hard_brakes, ts.hard_accelerations, ts.cost_combustibil,
                       ts.emisii_co2, ts.raport_ai_json,
                       COALESCE(v.model, 'Vehicul') AS model_vehicul
                FROM calatorii c
                LEFT JOIN trip_summary ts ON c.id_calatorie = ts.id_calatorie
                LEFT JOIN vehicule v ON c.vin = v.vin
                WHERE c.id_calatorie = ?`, [id], (err, row) => {
            if (err || !row) return res.status(404).json({ eroare: 'Cursa nu există.' });

            let ai = null;
            if (row.raport_ai_json) {
                try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}
            }

            const intelligence = ai?.intelligence || {};
            const litriTotali  = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;
            const durationMin  = Math.round((row.durata_secunde || 0) / 60);
            const startDate    = row.timestamp_start ? new Date(row.timestamp_start).toLocaleString('ro-RO') : '—';
            const predictions  = (intelligence.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM').slice(0, 3);

            try {
                const PDFDocument = require('pdfkit');
                const chunks = [];
                const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

                doc.on('data',  chunk => chunks.push(chunk));
                doc.on('error', err => {
                    console.error('[PDF] generation error:', err.message);
                    if (!res.headersSent) res.status(500).json({ eroare: 'Eroare internă la generarea PDF.' });
                });
                doc.on('end', () => {
                    const buf = Buffer.concat(chunks);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="cursa_${id}.pdf"`);
                    res.setHeader('Content-Length', buf.length);
                    res.send(buf);
                });

                doc.rect(50, 50, 495, 44).fill('#1A1A2E');
                doc.fillColor('#FFFFFF').fontSize(16).text(`Raport Cursă #${id}`, 60, 62, { lineBreak: false });
                doc.fillColor('#AAAAAA').fontSize(9).text(startDate, { align: 'right' });
                doc.moveDown(2);

                doc.fillColor('#1A1A2E').fontSize(12).text('STATISTICI', { underline: true });
                doc.moveDown(0.4).fillColor('#333333').fontSize(10);
                doc.text(`Distanta:          ${(row.km_parcursi || 0).toFixed(2)} km`);
                doc.text(`Durata:            ${durationMin} minute`);
                doc.text(`Combustibil:       ${litriTotali.toFixed(2)} L`);
                const cons100 = row.consum_mediu_100km > 0 ? row.consum_mediu_100km.toFixed(1)
                    : (row.km_parcursi > 0.1 ? (litriTotali / row.km_parcursi * 100).toFixed(1) : '-');
                doc.text(`Consum mediu:      ${cons100} L/100km`);
                doc.text(`Cost estimat:      ${(row.cost_combustibil || 0).toFixed(2)} RON`);
                doc.text(`Emisii CO2:        ${(row.emisii_co2 || 0).toFixed(2)} kg`);
                doc.text(`Eco Score:         ${row.scor_eco || 100}/100`);
                if (row.health_score) doc.text(`Health Score:      ${row.health_score}%`);
                doc.moveDown(1);

                doc.fillColor('#1A1A2E').fontSize(12).text('STIL DE CONDUS', { underline: true });
                doc.moveDown(0.4).fillColor('#333333').fontSize(10);
                const ds = ai?.driving?.style || {};
                doc.text(`Condus lin:        ${Math.round(ds.smoothPct || 0)}%`);
                doc.text(`Condus economic:   ${Math.round(ds.economicPct || 0)}%`);
                doc.text(`Condus agresiv:    ${Math.round(ds.aggressivePct || 0)}%`);
                doc.text(`Franari bruste:    ${row.hard_brakes || 0}`);
                doc.text(`Accelerari bruste: ${row.hard_accelerations || 0}`);
                doc.moveDown(1);

                if (predictions.length > 0) {
                    doc.fillColor('#1A1A2E').fontSize(12).text('PREDICTII AI', { underline: true });
                    doc.moveDown(0.4).fillColor('#333333').fontSize(10);
                    predictions.forEach(p => {
                        doc.text(`[${p.severity}] ${p.title || ''}: ${p.description || ''}`);
                    });
                    doc.moveDown(1);
                }

                doc.fillColor('#1A1A2E').fontSize(12).text('VALORI DE VARF', { underline: true });
                doc.moveDown(0.4).fillColor('#333333').fontSize(10);
                if (row.viteza_max)    doc.text(`Viteza max:        ${row.viteza_max} km/h`);
                if (row.rpm_max)       doc.text(`RPM max:           ${row.rpm_max}`);
                if (row.coolant_max)   doc.text(`Temp. racire max:  ${row.coolant_max} C`);
                if (row.boost_max > 0) doc.text(`Boost max:         ${row.boost_max.toFixed(2)} bar`);
                if (row.voltaj_min)    doc.text(`Tensiune min/max:  ${row.voltaj_min} / ${row.voltaj_max || '-'} V`);
                doc.moveDown(2);

                doc.fillColor('#AAAAAA').fontSize(8)
                    .text(`Generat de OBD-II Monitor  |  VIN: ${row.vin || '-'}  |  ${row.model_vehicul || '-'}`, { align: 'center' });

                doc.end();
            } catch (pdfErr) {
                console.error('[PDF] unexpected error:', pdfErr.message);
                if (!res.headersSent) res.status(500).json({ eroare: 'Eroare la generarea PDF: ' + pdfErr.message });
            }
        });
    });

    router.get('/calatorii/:id/export/csv', (req, res) => {
        const id = req.params.id;
        db.get(`SELECT c.id_calatorie, c.vin, c.km_parcursi, c.scor_eco, c.timestamp_start, c.timestamp_end
                FROM calatorii c WHERE c.id_calatorie = ?`, [id], (err, trip) => {
            if (err || !trip) return res.status(404).json({ eroare: 'Cursa nu există.' });

            db.all(`SELECT * FROM telemetrie_flux WHERE id_calatorie = ? ORDER BY timestamp ASC`, [id], (err2, rows) => {
                if (err2) return res.status(500).json({ eroare: err2.message });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ eroare: 'Nu există date telemetrie pentru această cursă.' });
                }

                function flatObj(obj, prefix = '') {
                    if (!obj || typeof obj !== 'object') return {};
                    return Object.entries(obj).reduce((acc, [k, v]) => {
                        const key = prefix ? `${prefix}.${k}` : k;
                        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
                            Object.assign(acc, flatObj(v, key));
                        } else {
                            acc[key] = v;
                        }
                        return acc;
                    }, {});
                }

                const FIXED_COLS = ['timestamp', 'rpm', 'viteza_kmh', 'sarcina_pct', 'maf_gs', 'map_kpa',
                    'voltaj_v', 'temp_apa_c', 'temp_ulei_c', 'accel_g', 'consum_lh', 'boost_bar',
                    'dpf_soot', 'gear', 'torque_nm'];

                const jsonKeySet = new Set();
                const parsedRows = rows.map(row => {
                    let flat = {};
                    if (row.matrice_completa_json) {
                        try { flat = flatObj(JSON.parse(row.matrice_completa_json)); } catch(e) {}
                    }
                    Object.keys(flat).forEach(k => jsonKeySet.add(k));
                    return { ...row, _json: flat };
                });

                const JSON_COLS = [...jsonKeySet].sort();
                const ALL_COLS  = [...FIXED_COLS, ...JSON_COLS];

                const esc = v => {
                    if (v === null || v === undefined) return '';
                    const s = String(v);
                    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                        return `"${s.replace(/"/g, '""')}"`;
                    }
                    return s;
                };

                const header  = ALL_COLS.join(',');
                const csvRows = parsedRows.map(row =>
                    ALL_COLS.map(col => FIXED_COLS.includes(col) ? esc(row[col]) : esc(row._json[col])).join(',')
                );

                const metaComment = [
                    `# Cursă #${id} · VIN: ${trip.vin}`,
                    `# Start: ${trip.timestamp_start ? new Date(trip.timestamp_start).toISOString() : '-'}`,
                    `# Stop:  ${trip.timestamp_end   ? new Date(trip.timestamp_end).toISOString()   : '-'}`,
                    `# Distanță: ${(trip.km_parcursi || 0).toFixed(2)} km · Eco Score: ${trip.scor_eco || '-'}`,
                    `# Randuri: ${rows.length} · Coloane: ${ALL_COLS.length}`,
                    '',
                ].join('\n');

                const csv = metaComment + header + '\n' + csvRows.join('\n');
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="telemetrie_cursa_${id}.csv"`);
                res.send('﻿' + csv);
            });
        });
    });

    return router;
};
