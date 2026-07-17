'use strict';

const express = require('express');

module.exports = function(db) {
    const router = express.Router();

    router.get('/rapoarte/lunar/:year/:month', (req, res) => {
        const year  = parseInt(req.params.year);
        const month = parseInt(req.params.month);

        const startOfMonth = new Date(year, month - 1, 1).getTime();
        const endOfMonth   = new Date(year, month, 0, 23, 59, 59, 999).getTime();

        db.all(`
            SELECT c.*, ts.health_score, ts.hard_brakes, ts.hard_accelerations, ts.nr_alerte,
                   ts.nr_dtc, ts.cost_combustibil, ts.emisii_co2, ts.durata_secunde, ts.trip_tag
            FROM calatorii c
            LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
            WHERE c.timestamp_end IS NOT NULL
              AND c.timestamp_start >= ? AND c.timestamp_start <= ?
            ORDER BY c.timestamp_start ASC
        `, [startOfMonth, endOfMonth], (err, rows) => {
            if (err) return res.status(500).json({ eroare: err.message });

            const trips      = rows || [];
            const totalKm    = trips.reduce((s, t) => s + (t.km_parcursi    || 0), 0);
            const totalLitri = trips.reduce((s, t) => s + (t.consum_total_l || 0), 0);
            const totalCost  = trips.reduce((s, t) => s + (t.cost_combustibil || 0), 0);
            const totalCO2   = trips.reduce((s, t) => s + (t.emisii_co2 || 0), 0);
            const totalDurata = trips.reduce((s, t) => s + (t.durata_secunde || 0), 0);
            const avgEco = trips.length > 0
                ? Math.round(trips.reduce((s, t) => s + (t.scor_eco || 100), 0) / trips.length)
                : 0;
            const tripsWithHealth = trips.filter(t => t.health_score);
            const avgHealth = tripsWithHealth.length > 0
                ? Math.round(tripsWithHealth.reduce((s, t) => s + t.health_score, 0) / tripsWithHealth.length)
                : null;

            const byTag = {};
            trips.forEach(t => {
                const tag = t.trip_tag || 'PERSONAL';
                if (!byTag[tag]) byTag[tag] = { trips: 0, km: 0, litri: 0, cost: 0 };
                byTag[tag].trips++;
                byTag[tag].km    += (t.km_parcursi    || 0);
                byTag[tag].litri += (t.consum_total_l || 0);
                byTag[tag].cost  += (t.cost_combustibil || 0);
            });

            res.json({
                year,
                month,
                totalTrips:      trips.length,
                totalKm:         Number(totalKm.toFixed(2)),
                totalLitri:      Number(totalLitri.toFixed(2)),
                consumMediu100:  totalKm > 0 ? Number((totalLitri / totalKm * 100).toFixed(1)) : 0,
                totalCost:       Number(totalCost.toFixed(2)),
                totalCO2:        Number(totalCO2.toFixed(2)),
                totalDurataMin:  Math.round(totalDurata / 60),
                avgEcoScore:     avgEco,
                avgHealthScore:  avgHealth,
                byTag,
                trips: trips.map(t => ({
                    id:     t.id_calatorie,
                    date:   t.timestamp_start,
                    km:     t.km_parcursi,
                    litri:  t.consum_total_l,
                    eco:    t.scor_eco,
                    health: t.health_score,
                    tag:    t.trip_tag || 'PERSONAL',
                })),
            });
        });
    });

    router.get('/export', (req, res) => {
        const vin = req.query.vin || '';
        if (!vin) return res.status(400).json({ eroare: 'vin necesar' });
        db.all(
            `SELECT c.id_calatorie, c.vin, c.timestamp_start, c.timestamp_end,
                    c.km_parcursi, c.consum_total_l, c.consum_mediu_100km, c.scor_eco,
                    ts.durata_secunde, ts.viteza_max, ts.viteza_medie, ts.rpm_max, ts.rpm_mediu,
                    ts.coolant_max, ts.boost_max, ts.hard_brakes, ts.hard_accelerations,
                    ts.nr_alerte, ts.nr_dtc, ts.cost_combustibil, ts.emisii_co2,
                    ts.health_score, ts.trip_tag
             FROM calatorii c
             LEFT JOIN trip_summary ts ON ts.id_calatorie = c.id_calatorie
             WHERE c.vin = ?
             ORDER BY c.id_calatorie DESC`,
            [vin],
            (err, rows) => {
                if (err) return res.status(500).json({ eroare: err.message });
                res.setHeader('Content-Disposition', `attachment; filename="export-${vin}.json"`);
                res.setHeader('Content-Type', 'application/json');
                res.json({
                    exportat_la:  new Date().toISOString(),
                    vin,
                    total_curse:  rows.length,
                    curse:        rows || [],
                });
            }
        );
    });

    return router;
};
