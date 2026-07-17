'use strict';

const express = require('express');
const { DigitalTwinSnapshot, DigitalTwinSerializer } = require('../backend/digitalTwin');
const { answerWithContext, buildSuggestedQuestions } = require('../backend/intelligence/ExpertQueryEngine');
const { enhanceWithGemini } = require('../backend/intelligence/GeminiService');
const { THRESHOLDS } = require('../backend/analyzers/config');

module.exports = function(db) {
    const router = express.Router();

    // GET /api/vehicul/:vin/twin — context AI Expert
    router.get('/vehicul/:vin/twin', async (req, res) => {
        try {
            const { vin } = req.params;
            let snapshot = await DigitalTwinSnapshot.load(db, vin);

            if (!snapshot) {
                const row = await new Promise(resolve =>
                    db.get(
                        `SELECT ts.*, c.km_parcursi, c.consum_total_l, c.consum_mediu_100km,
                                c.scor_eco, c.timestamp_start, c.timestamp_end
                         FROM trip_summary ts
                         JOIN calatorii c ON c.id_calatorie = ts.id_calatorie
                         WHERE c.vin = ? AND ts.raport_ai_json IS NOT NULL
                         ORDER BY ts.id_summary DESC LIMIT 1`,
                        [vin], (err, r) => resolve(r || null)
                    )
                );

                if (!row) {
                    return res.json({
                        status: 'NO_DATA',
                        context: null,
                        suggestedQuestions: ['Cum e starea generală?', 'Pot face un drum lung?', 'Ce știi despre mașina mea?'],
                        message: 'Niciun Digital Twin disponibil. Finalizează o cursă pentru a genera analiza.',
                    });
                }

                let ai = null;
                try { ai = JSON.parse(row.raport_ai_json); } catch(e) {}

                const intel   = ai?.intelligence || {};
                const litri   = (row.cost_combustibil || 0) / THRESHOLDS.DIESEL_PRICE_PER_LITER;
                const vehicle = await new Promise(resolve =>
                    db.get('SELECT * FROM vehicule WHERE vin = ?', [vin], (err, r) => resolve(r || {}))
                );

                const fallbackContext = {
                    identity: {
                        make: 'Audi', model: vehicle.model || 'A6 C4 2.5 TDI', year: 1995,
                        fuelType: vehicle.tip_combustibil || 'diesel', engineCode: 'AEL',
                        displacementCc: 2500, currentMileageKm: null, ageYears: null,
                        emissionStandard: 'Euro 2',
                    },
                    capabilities: null,
                    health: {
                        overallHealth: row.health_score    || null,
                        engineScore:   ai?.engine?.score   || null,
                        fuelScore:     ai?.fuel?.score     || null,
                        drivingScore:  ai?.driving?.score  || null,
                        safetyScore:   ai?.safetyScore     || null,
                        subsystems:    intel.vehicle_dna?.subsystems || null,
                        scoringMethod: 'trip_summary_fallback',
                    },
                    predictions:     (intel.predictions || []).filter(p => p.severity === 'HIGH' || p.severity === 'MEDIUM'),
                    recommendations: (intel.recommendations || []).slice(0, 5),
                    baselines: null, correlated: null,
                    reliability: intel.reliability || null,
                    sessionMetrics: {
                        distanceKm:     row.km_parcursi        || 0,
                        durationMin:    Math.round((row.durata_secunde || 0) / 60),
                        fuelLiters:     litri,
                        consumption100: row.consum_mediu_100km || 0,
                        ecoScore:       row.scor_eco           || 100,
                        hardBrakes:     row.hard_brakes        || 0,
                        hardAccels:     row.hard_accelerations || 0,
                        coolantMax:     row.coolant_max        || null,
                        voltageMin:     row.voltaj_min         || null,
                        boostMax:       row.boost_max          || null,
                        dpfSootMax:     row.dpf_soot_max       || null,
                    },
                    historical:    { recentTrips: [], maintenance: [], milestones: [] },
                    trendAnalysis: null,
                    reasoning:     intel.detailedExplainability || null,
                    dna:           intel.vehicle_dna            || null,
                };

                return res.json({
                    status: 'OK',
                    context: fallbackContext,
                    suggestedQuestions: buildSuggestedQuestions(fallbackContext),
                    twinMeta: {
                        savedAt: row.timestamp_start, healthScore: row.health_score,
                        alertLevel: 'NORMAL', dataCompleteness: 60, isFallback: true,
                    },
                });
            }

            const context = DigitalTwinSerializer.toAIExpert(snapshot.twin);
            res.json({
                status: 'OK',
                context,
                suggestedQuestions: buildSuggestedQuestions(context),
                twinMeta: {
                    savedAt:          snapshot.savedAt,
                    healthScore:      snapshot.healthScore,
                    alertLevel:       snapshot.alertLevel,
                    dataCompleteness: snapshot.dataCompleteness,
                },
            });
        } catch (err) {
            console.error('[/api/vehicul/twin]', err.message);
            res.status(500).json({ status: 'ERROR', message: err.message });
        }
    });

    // POST /api/ai/expert/query
    router.post('/ai/expert/query', async (req, res) => {
        try {
            const { vin, question, history } = req.body || {};
            if (!vin || !question?.trim()) {
                return res.status(400).json({ error: '"vin" și "question" sunt obligatorii.' });
            }
            const snapshot = await DigitalTwinSnapshot.load(db, vin);
            if (!snapshot) {
                return res.json({
                    answer: 'Nu am date despre vehiculul tău. Finalizează câteva curse pentru a genera o analiză.',
                    confidence: 'LOW', intent: 'NO_DATA', sources: [],
                    relatedQuestions: [], isFollowUp: false, topicRef: null,
                });
            }
            const context = DigitalTwinSerializer.toAIExpert(snapshot.twin);
            const { hydrateStatus, sortDocs } = require('../backend/vehicle-profile/DocumentsModule');
            const documents = await new Promise(resolve => {
                db.get(`SELECT id FROM vehicles WHERE vin = ?`, [vin], (err, row) => {
                    if (err || !row) return resolve([]);
                    db.all(
                        `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                        [row.id], (e2, rows) => resolve(sortDocs(hydrateStatus(rows || [])))
                    );
                });
            });
            context.documents = documents;
            const result = answerWithContext(question, context, history || []);

            const aiAnswer = await enhanceWithGemini(question, context, result.answer, result.intent, history || []);
            if (aiAnswer) {
                result.answer     = aiAnswer;
                result.aiEnhanced = true;
            } else {
                result.aiEnhanced = false;
            }

            res.json({ ...result, twinSavedAt: snapshot.savedAt });
        } catch (err) {
            console.error('[/api/ai/expert/query]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/vehicles/:id/summary
    router.get('/vehicles/:id/summary', async (req, res) => {
        try {
            const vehicleId = req.params.id;
            const vehicle = await new Promise((resolve, reject) => {
                db.get('SELECT vin FROM vehicles WHERE id = ?', [vehicleId], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (!vehicle) return res.status(404).json({ error: 'Vehicul negăsit.' });

            const { vin } = vehicle;
            const snapshot = await DigitalTwinSnapshot.load(db, vin);
            if (!snapshot) return res.status(404).json({ error: 'Nu există date. Finalizează o cursă mai întâi.' });

            const pdfData = DigitalTwinSerializer.toPDF(snapshot.twin);

            const timeline = await new Promise((resolve) => {
                db.all(
                    `SELECT category, title, description, icon, event_date, mileage_km
                     FROM vehicle_timeline WHERE vehicle_id = ? ORDER BY event_date DESC LIMIT 40`,
                    [vehicleId], (err, rows) => resolve(err ? [] : (rows || []))
                );
            });

            const stats = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) AS total_calatorii,
                            COALESCE(SUM(km_parcursi), 0) AS total_km,
                            COALESCE(SUM(combustibil_consumat_l), 0) AS total_combustibil
                     FROM calatorii WHERE vin = ?`,
                    [vin], (err, row) => resolve(err ? {} : (row || {}))
                );
            });

            const { hydrateStatus, sortDocs } = require('../backend/vehicle-profile/DocumentsModule');
            const documents = await new Promise((resolve) => {
                db.all(
                    `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                    [vehicleId], (err, rows) => resolve(sortDocs(hydrateStatus(rows || [])))
                );
            });

            res.json({ ...pdfData, timeline, stats, documents, lastSyncAt: snapshot.savedAt });
        } catch (err) {
            console.error('[/api/vehicles/:id/summary]', err.message);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/vehicles/:id/report/pdf
    router.get('/vehicles/:id/report/pdf', async (req, res) => {
        try {
            const vehicleId = req.params.id;
            const vehicle = await new Promise((resolve, reject) => {
                db.get('SELECT vin, make, model, year, fuel_type FROM vehicles WHERE id = ?', [vehicleId], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (!vehicle) return res.status(404).json({ error: 'Vehicul negăsit.' });

            const { vin } = vehicle;
            const snapshot = await DigitalTwinSnapshot.load(db, vin);
            if (!snapshot) {
                return res.status(404).json({
                    error: 'Nu există date suficiente. Finalizează cel puțin o cursă pentru a genera raportul.',
                });
            }

            const pdfData = DigitalTwinSerializer.toPDF(snapshot.twin);

            const timeline = await new Promise((resolve) => {
                db.all(
                    `SELECT category, title, description, icon, event_date, mileage_km
                     FROM vehicle_timeline WHERE vehicle_id = ? ORDER BY event_date DESC LIMIT 40`,
                    [vehicleId], (err, rows) => resolve(err ? [] : (rows || []))
                );
            });

            const services = await new Promise((resolve) => {
                db.all(
                    `SELECT title, performed_at, mileage_km, cost_total, workshop_name
                     FROM service_sessions WHERE vehicle_id = ? ORDER BY performed_at DESC LIMIT 10`,
                    [vehicleId], (err, rows) => resolve(err ? [] : (rows || []))
                );
            });

            const { hydrateStatus: _hydrate, sortDocs: _sort } = require('../backend/vehicle-profile/DocumentsModule');
            const documents = await new Promise((resolve) => {
                db.all(
                    `SELECT * FROM vehicle_documents WHERE vehicle_id = ? ORDER BY expiry_date ASC`,
                    [vehicleId], (err, rows) => resolve(_sort(_hydrate(rows || [])))
                );
            });

            const stats = await new Promise((resolve) => {
                db.get(
                    `SELECT COUNT(*) AS total_calatorii,
                            COALESCE(SUM(km_parcursi), 0) AS total_km,
                            COALESCE(SUM(combustibil_consumat_l), 0) AS total_combustibil
                     FROM calatorii WHERE vin = ?`,
                    [vin], (err, row) => resolve(err ? {} : (row || {}))
                );
            });

            const costs = await new Promise((resolve) => {
                db.get(
                    `SELECT COALESCE(SUM(cost_total), 0) AS service FROM service_sessions WHERE vin = ?`,
                    [vin], (err, row) => resolve(err ? {} : (row || {}))
                );
            });

            const { PDFReportGenerator } = require('../backend/pdf/PDFReportGenerator');
            const fileName = `raport_${vin}_${Date.now()}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            const generator = new PDFReportGenerator(pdfData, { timeline, services, stats, costs, documents });
            generator.generate(res);
        } catch (err) {
            console.error('[/api/vehicles/:id/report/pdf]', err.message);
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    });

    return router;
};
