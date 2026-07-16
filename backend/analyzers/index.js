/**
 * index.js — punctul unic de import pentru backend.js
 * -----------------------------------------------------------------------
 * Orchestrează pipeline-ul complet de analiză la finalul unei curse:
 *
 *   1. DataIntegrityEngine  — validare integritate date brute
 *   2. SensorQualityEngine  — evaluare calitate per senzor
 *   3. TripSummary          — construire rezumat statistic
 *   4. HealthEngine         — scoruri sănătate (Engine/Fuel/Driving/Safety)
 *   5. RuleEngine           — diagnostic pe bază de probabilități
 *   6. ConfidenceEngine     — scor încredere global
 *   7. ReliabilityEngine    — fiabilitate per diagnoză
 *   8. RuleConflictResolver — rezolvare conflicte între reguli
 *   9. ExplainabilityEngine — ledger deduceri Health Score
 *  10. DetailedExplainability — explicație per regulă/diagnostic
 *  11. CorrelationEngine    — corelații inter-senzor
 *  12. BaselineEngine       — baseline adaptiv + deviații
 *  13. FaultPredictionEngine— predicție defecțiuni viitoare
 *  14. VehicleDNA           — amprentă vehicul
 *  15. buildAIReport        — obiect final ai.intelligence
 *
 * Exportă:
 *   - createAnalysis()           — la PORNIRE
 *   - updateAnalyzer(trip, pkt)  — la fiecare pachet MERS
 *   - finalizeTripAnalysis(trip, opts) — la OPRIRE (construiește totul)
 * -----------------------------------------------------------------------
 */

const { createDiagnosticContext, PIPELINE_STEPS } = require('../pipeline/DiagnosticContext');
const { deriveCapabilities, defaultCapabilities } = require('../capabilities/VehicleCapabilities');
const { resolve: resolveKnowledgePack } = require('../knowledge/KnowledgePackRegistry');
const { deriveProfile } = require('../powertrain/PowertrainProfileRegistry');

const { createAnalysis, updateAnalyzer } = require('./TripAnalyzer');
const { calculateHealthScore } = require('./HealthEngine');
const { buildTripSummary, buildAIReport } = require('./TripSummary');
// Notă: calculateHealthScore, buildTripSummary, buildAIReport sunt folosite intern;
// nu sunt re-exportate deoarece niciun consumator extern nu le importă din acest barrel.

const { evaluateDiagnostics } = require('../diagnostics/RuleEngine');

const { buildConfidenceReport } = require('../intelligence/ConfidenceEngine');
const { generateExplainabilityLedger } = require('../intelligence/ExplainabilityEngine');
const { analyzeTripCorrelations } = require('../intelligence/CorrelationEngine');
const { updateAndCompareBaseline } = require('../intelligence/BaselineEngine');
const { generateVehicleDNA } = require('../intelligence/VehicleDNA');

const { validateTripData } = require('../intelligence/DataIntegrityEngine');
const { analyzeSensorQuality } = require('../intelligence/SensorQualityEngine');
const { buildReliabilityReport } = require('../intelligence/ReliabilityEngine');
const { generatePredictions } = require('../intelligence/FaultPredictionEngine');
const { resolveConflicts } = require('../intelligence/RuleConflictResolver');
const { generateDetailedExplainability } = require('../intelligence/DetailedExplainability');
const { analyzeFromContext: runReasoningGraph } = require('../reasoning');
const { generateRecommendations } = require('../recommendations');
const { VehicleDigitalTwinBuilder, DigitalTwinSnapshot } = require('../digitalTwin');

/**
 * finalizeTripAnalysis — pipeline complet de analiză la sfârșitul cursei
 *
 * @param {Object} trip - obiectul călătoriei active (conține .analysis, .id_calatorie)
 * @param {Object} opts - opțiuni necesare:
 *   @param {Object} opts.db - instanța SQLite
 *   @param {string} opts.vin - VIN-ul vehiculului
 *   @param {Array}  opts.dtcList - lista de DTC-uri active
 *   @param {Array}  opts.rawPackets - pachetele brute de telemetrie (pentru correlații și calitate)
 *   @param {Object} opts.trends - rezultatul TrendEngine (opțional, dacă este disponibil)
 */
async function finalizeTripAnalysis(trip, opts = {}) {
    // ctx este singura sursă de date prin tot pipeline-ul.
    // Nicio variabilă locală nu dublează câmpurile din ctx.
    const ctx = createDiagnosticContext(trip, opts);

    // ── Date vehicul, capabilities și knowledge pack ───────────────────
    // Se execută înainte de pasul 1 pentru că orice etapă din pipeline
    // poate citi aceste câmpuri.
    if (ctx.db && ctx.vin) {
        ctx.vehicleRow = await new Promise((resolve) => {
            ctx.db.get(
                'SELECT * FROM vehicles WHERE vin = ?',
                [ctx.vin],
                (err, row) => resolve(err ? null : row)
            );
        });
    }
    ctx.capabilities  = deriveCapabilities(ctx.vehicleRow) || defaultCapabilities();
    ctx.knowledgePack = resolveKnowledgePack(ctx.vehicleRow, ctx.capabilities);
    ctx.powertrain    = deriveProfile(ctx.vehicleRow, ctx.capabilities);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 1: Validare integritate date
    // ═══════════════════════════════════════════════════════════════════
    ctx.dataIntegrity = validateTripData(ctx.rawPackets);
    ctx.stepsExecuted.push(PIPELINE_STEPS.DATA_INTEGRITY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 2: Calitate senzori
    // ═══════════════════════════════════════════════════════════════════
    ctx.sensorQuality = analyzeSensorQuality(ctx.rawPackets);
    ctx.stepsExecuted.push(PIPELINE_STEPS.SENSOR_QUALITY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 3: Construire Trip Summary
    // ═══════════════════════════════════════════════════════════════════
    ctx.summary = buildTripSummary(ctx.trip);
    if (!ctx.summary) return null;
    ctx.stepsExecuted.push(PIPELINE_STEPS.TRIP_SUMMARY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 4: Calculare Health Score
    // ═══════════════════════════════════════════════════════════════════
    ctx.health = calculateHealthScore(ctx.summary, ctx);
    ctx.stepsExecuted.push(PIPELINE_STEPS.HEALTH_ENGINE);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 5: Diagnostic pe bază de reguli
    // ═══════════════════════════════════════════════════════════════════
    ctx.diagnostics = evaluateDiagnostics(ctx.summary, null, ctx.dtcList, ctx.capabilities, ctx.knowledgePack);
    ctx.stepsExecuted.push(PIPELINE_STEPS.RULE_ENGINE);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 6: Scor de încredere global
    // ═══════════════════════════════════════════════════════════════════
    ctx.confidence = buildConfidenceReport(ctx.diagnostics);
    ctx.stepsExecuted.push(PIPELINE_STEPS.CONFIDENCE);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 7: Fiabilitate per diagnoză
    // ═══════════════════════════════════════════════════════════════════
    ctx.reliability = buildReliabilityReport(ctx.diagnostics, ctx.sensorQuality, ctx.dtcList, null);
    ctx.stepsExecuted.push(PIPELINE_STEPS.RELIABILITY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 8: Rezolvare conflicte
    // ═══════════════════════════════════════════════════════════════════
    ctx.conflictResolution = resolveConflicts(ctx.diagnostics, {
        reliability: ctx.reliability,
        trends: ctx.trends,
        baseline: null
    });
    ctx.stepsExecuted.push(PIPELINE_STEPS.CONFLICT_RESOLVER);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 9: Ledger explicativ (Health Score deductions)
    // ═══════════════════════════════════════════════════════════════════
    ctx.explainability = generateExplainabilityLedger(ctx.summary);
    ctx.stepsExecuted.push(PIPELINE_STEPS.EXPLAINABILITY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 10: Corelații inter-senzor
    // ═══════════════════════════════════════════════════════════════════
    ctx.correlations = analyzeTripCorrelations(ctx.rawPackets);
    ctx.stepsExecuted.push(PIPELINE_STEPS.CORRELATIONS);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 11: Baseline adaptiv (necesită DB — async)
    // ═══════════════════════════════════════════════════════════════════
    if (ctx.db && ctx.vin) {
        ctx.baseline = await updateAndCompareBaseline(ctx.db, ctx.vin, ctx.summary);
    }
    ctx.stepsExecuted.push(PIPELINE_STEPS.BASELINE);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 12: Actualizare reliability cu baseline
    // ═══════════════════════════════════════════════════════════════════
    ctx.reliabilityFinal = ctx.baseline
        ? buildReliabilityReport(ctx.diagnostics, ctx.sensorQuality, ctx.dtcList, ctx.baseline)
        : ctx.reliability;
    ctx.stepsExecuted.push(PIPELINE_STEPS.RELIABILITY_FINAL);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 13: Explicație detaliată per regulă/diagnostic
    // ═══════════════════════════════════════════════════════════════════
    ctx.detailedExplainability = generateDetailedExplainability(ctx.diagnostics, {
        summary:      ctx.summary,
        baseline:     ctx.baseline,
        trends:       ctx.trends,
        correlations: ctx.correlations,
        confidence:   ctx.confidence
    });
    ctx.stepsExecuted.push(PIPELINE_STEPS.DETAILED_EXPLAINABILITY);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 14: Predicții defecțiuni viitoare
    // ═══════════════════════════════════════════════════════════════════
    ctx.predictions = generatePredictions({
        summary:       ctx.summary,
        baseline:      ctx.baseline,
        trends:        ctx.trends,
        correlations:  ctx.correlations,
        confidence:    ctx.confidence,
        dna:           null,
        capabilities:  ctx.capabilities,
        knowledgePack: ctx.knowledgePack
    });
    ctx.stepsExecuted.push(PIPELINE_STEPS.FAULT_PREDICTIONS);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 15: Vehicle DNA
    // ═══════════════════════════════════════════════════════════════════
    ctx.dna = generateVehicleDNA(ctx.health, ctx.baseline, ctx.correlations, ctx.confidence);
    ctx.stepsExecuted.push(PIPELINE_STEPS.VEHICLE_DNA);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 16: Diagnostic Reasoning Graph
    // ═══════════════════════════════════════════════════════════════════
    ctx.reasoning = runReasoningGraph({
        predictions:  ctx.predictions,
        diagnostics:  ctx.diagnostics,
        summary:      ctx.summary,
        capabilities: ctx.capabilities
    });
    ctx.stepsExecuted.push(PIPELINE_STEPS.REASONING);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 17: Recommendation Engine
    // ═══════════════════════════════════════════════════════════════════
    ctx.recommendations = generateRecommendations({
        reasoning:     ctx.reasoning,
        predictions:   ctx.predictions,
        diagnostics:   ctx.diagnostics,
        vehicleRow:    ctx.vehicleRow,
        capabilities:  ctx.capabilities,
        knowledgePack: ctx.knowledgePack,
        powertrain:    ctx.powertrain
    });
    ctx.stepsExecuted.push(PIPELINE_STEPS.RECOMMENDATIONS);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 18: Vehicle Digital Twin
    // ═══════════════════════════════════════════════════════════════════
    {
        // Fetch lightweight history data din DB (graceful fallback la [])
        const twinHistory = { recentTrips: [], maintenance: [], milestones: [], timeline: [], documents: [] };
        if (ctx.db && ctx.vin) {
            const [recentTrips, maintenance, milestones] = await Promise.all([
                new Promise(resolve => ctx.db.all(
                    `SELECT c.id_calatorie, c.timestamp_start, c.timestamp_end,
                            c.km_parcursi, c.consum_mediu_100km, c.scor_eco,
                            ts.health_score, ts.viteza_medie, ts.nr_alerte
                     FROM calatorii c
                     LEFT JOIN trip_summary ts ON c.id_calatorie = ts.id_calatorie
                     WHERE c.vin = ? ORDER BY c.timestamp_start DESC LIMIT 10`,
                    [ctx.vin], (err, rows) => resolve(err ? [] : rows || [])
                )),
                new Promise(resolve => ctx.db.all(
                    `SELECT mi.* FROM maintenance_items mi
                     INNER JOIN vehicles v ON mi.vehicle_id = v.id
                     WHERE v.vin = ? ORDER BY COALESCE(mi.remaining_km, 999999) ASC`,
                    [ctx.vin], (err, rows) => resolve(err ? [] : rows || [])
                )),
                new Promise(resolve => ctx.db.all(
                    `SELECT m.* FROM milestones m
                     INNER JOIN vehicles v ON m.vehicle_id = v.id
                     WHERE v.vin = ? ORDER BY m.achieved_at DESC LIMIT 10`,
                    [ctx.vin], (err, rows) => resolve(err ? [] : rows || [])
                ))
            ]);
            twinHistory.recentTrips = recentTrips;
            twinHistory.maintenance  = maintenance;
            twinHistory.milestones   = milestones;
        }

        ctx.digitalTwin = VehicleDigitalTwinBuilder.build(ctx, twinHistory);

        // Salvare snapshot non-blocking (fără await — nu blocăm pipeline-ul)
        if (ctx.db && ctx.vin) {
            DigitalTwinSnapshot.save(ctx.db, ctx.vin, ctx.digitalTwin).catch(() => {});
        }
    }
    ctx.stepsExecuted.push(PIPELINE_STEPS.DIGITAL_TWIN);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 19: Construire obiect AI final
    // ═══════════════════════════════════════════════════════════════════
    ctx.ai = buildAIReport(ctx.summary, ctx.health);
    ctx.ai.intelligence = {
        dataIntegrity: {
            valid:         ctx.dataIntegrity.valid,
            stats:         ctx.dataIntegrity.stats,
            errorCount:    ctx.dataIntegrity.errors.length,
            warningCount:  ctx.dataIntegrity.warnings.length
        },
        sensorQuality:         ctx.sensorQuality,
        confidence_report:     ctx.confidence,
        reliability:           ctx.reliabilityFinal,
        conflictResolution: {
            resolved:      ctx.conflictResolution.resolved,
            ambiguous:     ctx.conflictResolution.ambiguous,
            conflictCount: ctx.conflictResolution.conflicts.length
        },
        explainability_ledger: ctx.explainability,
        detailedExplainability:ctx.detailedExplainability,
        correlations:          ctx.correlations,
        baseline_comparison:   ctx.baseline?.deviations || {},
        predictions:           ctx.predictions,
        vehicle_dna:           ctx.dna,
        reasoning:             ctx.reasoning,
        recommendations:       ctx.recommendations,
        digital_twin:          ctx.digitalTwin
    };
    ctx.stepsExecuted.push(PIPELINE_STEPS.AI_REPORT);

    // Returnează aceeași formă ca înainte (additive, backward compat)
    return {
        summary:         ctx.summary,
        health:          ctx.health,
        diagnostics:     ctx.diagnostics,
        ai:              ctx.ai,
        dna:             ctx.dna,
        powertrain:      ctx.powertrain,
        reasoning:       ctx.reasoning,
        recommendations: ctx.recommendations,
        digitalTwin:     ctx.digitalTwin
    };
}

module.exports = {
    createAnalysis,
    updateAnalyzer,
    finalizeTripAnalysis
};
