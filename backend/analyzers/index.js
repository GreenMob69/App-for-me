/**
 * index.js — punctul unic de import pentru backend.js
 * -----------------------------------------------------------------------
 *   const {
 *     createAnalysis,
 *     updateAnalyzer,
 *     finalizeTripAnalysis
 *   } = require('./backend/analyzers');
 * -----------------------------------------------------------------------
 */

const { createAnalysis, updateAnalyzer } = require('./TripAnalyzer');
const { calculateHealthScore } = require('./HealthEngine');
const { buildTripSummary, buildAIReport } = require('./TripSummary');
// 1. IMPORTĂM NOUL DIAGNOSTIC ENGINE:
const { evaluateDiagnostics } = require('../diagnostics/RuleEngine');
// Se apelează O SINGURĂ DATĂ, la OPRIRE — Nivel 3 + 4 + 5 din planul tău,
// într-un singur apel.
// IMPORTĂM INTELLIGENCE SUITE[cite: 12]
const { buildConfidenceReport } = require('../intelligence/ConfidenceEngine');
const { generateExplainabilityLedger } = require('../intelligence/ExplainabilityEngine');
const { analyzeTripCorrelations } = require('../intelligence/CorrelationEngine');
const { updateAndCompareBaseline } = require('../intelligence/BaselineEngine');
const { generateVehicleDNA } = require('../intelligence/VehicleDNA');


async function finalizeTripAnalysis(trip) {
    const summary = buildTripSummary(trip);
    if (!summary) return null;
    const health = calculateHealthScore(summary);
    // 2. EXECUTĂM MOTORUL DE REGULI BAZAT PE PROBABILITĂȚI:
    const diagnostics = evaluateDiagnostics(summary, null, dtcList);

    // EXECUȚIA MODULELOR DE INTELIGENȚĂ[cite: 12]
    const confidence = buildConfidenceReport(rawDiagnostics);
    const explainability = generateExplainabilityLedger(summary);
    const correlations = analyzeTripCorrelations(rawTelemetryPackets);
    const baseline = await updateAndCompareBaseline(db, vin, summary);
    const dna = generateVehicleDNA(health, baseline, correlations, confidence);

    const ai = buildAIReport(summary, health);
    ai.intelligence = {
        confidence_report: confidence,
        explainability_ledger: explainability,
        correlations: correlations,
        baseline_comparison: baseline?.deviations || {},
        vehicle_dna: dna
    };

    return { summary, health, diagnostics: rawDiagnostics, ai, dna };
}

module.exports = {
    createAnalysis,
    updateAnalyzer,
    calculateHealthScore,
    buildTripSummary,
    buildAIReport,
    finalizeTripAnalysis
};
