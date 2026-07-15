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

const { createAnalysis, updateAnalyzer } = require('./TripAnalyzer');
const { calculateHealthScore } = require('./HealthEngine');
const { buildTripSummary, buildAIReport } = require('./TripSummary');

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
    const { db, vin, dtcList = [], rawPackets = [], trends = null } = opts;

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 1: Validare integritate date
    // ═══════════════════════════════════════════════════════════════════
    const dataIntegrity = validateTripData(rawPackets);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 2: Calitate senzori
    // ═══════════════════════════════════════════════════════════════════
    const sensorQuality = analyzeSensorQuality(rawPackets);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 3: Construire Trip Summary
    // ═══════════════════════════════════════════════════════════════════
    const summary = buildTripSummary(trip);
    if (!summary) return null;

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 4: Calculare Health Score
    // ═══════════════════════════════════════════════════════════════════
    const health = calculateHealthScore(summary);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 5: Diagnostic pe bază de reguli
    // ═══════════════════════════════════════════════════════════════════
    const diagnostics = evaluateDiagnostics(summary, null, dtcList);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 6: Scor de încredere global
    // ═══════════════════════════════════════════════════════════════════
    const confidence = buildConfidenceReport(diagnostics);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 7: Fiabilitate per diagnoză
    // ═══════════════════════════════════════════════════════════════════
    const reliability = buildReliabilityReport(diagnostics, sensorQuality, dtcList, null);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 8: Rezolvare conflicte
    // ═══════════════════════════════════════════════════════════════════
    const conflictResolution = resolveConflicts(diagnostics, { reliability, trends, baseline: null });

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 9: Ledger explicativ (Health Score deductions)
    // ═══════════════════════════════════════════════════════════════════
    const explainability = generateExplainabilityLedger(summary);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 10: Corelații inter-senzor
    // ═══════════════════════════════════════════════════════════════════
    const correlations = analyzeTripCorrelations(rawPackets);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 11: Baseline adaptiv (necesită DB — async)
    // ═══════════════════════════════════════════════════════════════════
    let baseline = null;
    if (db && vin) {
        baseline = await updateAndCompareBaseline(db, vin, summary);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 12: Actualizare reliability cu baseline
    // ═══════════════════════════════════════════════════════════════════
    const reliabilityFinal = baseline
        ? buildReliabilityReport(diagnostics, sensorQuality, dtcList, baseline)
        : reliability;

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 13: Explicație detaliată per regulă/diagnostic
    // ═══════════════════════════════════════════════════════════════════
    const detailedExplainability = generateDetailedExplainability(diagnostics, {
        summary, baseline, trends, correlations, confidence
    });

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 14: Predicții defecțiuni viitoare
    // ═══════════════════════════════════════════════════════════════════
    const predictions = generatePredictions({
        summary, baseline, trends, correlations, confidence, dna: null
    });

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 15: Vehicle DNA
    // ═══════════════════════════════════════════════════════════════════
    const dna = generateVehicleDNA(health, baseline, correlations, confidence);

    // ═══════════════════════════════════════════════════════════════════
    // PASUL 16: Construire obiect AI final
    // ═══════════════════════════════════════════════════════════════════
    const ai = buildAIReport(summary, health);
    ai.intelligence = {
        dataIntegrity: {
            valid: dataIntegrity.valid,
            stats: dataIntegrity.stats,
            errorCount: dataIntegrity.errors.length,
            warningCount: dataIntegrity.warnings.length
        },
        sensorQuality,
        confidence_report: confidence,
        reliability: reliabilityFinal,
        conflictResolution: {
            resolved: conflictResolution.resolved,
            ambiguous: conflictResolution.ambiguous,
            conflictCount: conflictResolution.conflicts.length
        },
        explainability_ledger: explainability,
        detailedExplainability,
        correlations,
        baseline_comparison: baseline?.deviations || {},
        predictions,
        vehicle_dna: dna
    };

    return { summary, health, diagnostics, ai, dna };
}

module.exports = {
    createAnalysis,
    updateAnalyzer,
    calculateHealthScore,
    buildTripSummary,
    buildAIReport,
    finalizeTripAnalysis
};
