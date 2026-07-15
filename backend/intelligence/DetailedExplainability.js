/**
 * DetailedExplainability.js — Explicație detaliată per diagnostic/regulă
 * -----------------------------------------------------------------------
 * Fiecare concluzie primește justificarea exactă:
 *   - Ce parametri au contribuit
 *   - Cu cât abate fiecare parametru (%)
 *   - Trend confirmat / neconfirmat
 *   - Baseline deviation
 *   - Confidence final
 *
 * NU înlocuiește ExplainabilityEngine.js (ledger-ul pentru Health Score) —
 * este un modul COMPLEMENTAR care explică diagnosticele RuleEngine.
 *
 * Returnează: [{ diagnosis, system, factors: [...], trendStatus, baselineStatus,
 *               confidence, verdict }]
 * -----------------------------------------------------------------------
 */

const kb = require('../knowledge/KnowledgeBase');

function computeDeviation(actual, reference, direction) {
    if (!reference || reference === 0) return null;
    const pct = ((actual - reference) / Math.abs(reference)) * 100;
    return {
        actual,
        reference,
        deviationPct: Math.round(pct * 10) / 10,
        direction: pct > 0 ? 'UP' : 'DOWN',
        significant: Math.abs(pct) > 10
    };
}

function explainDiagnostic(diagnostic, context) {
    const { summary, baseline, trends, correlations, confidence } = context;
    const factors = [];

    const rule = kb.getRuleById(diagnostic.ruleId || diagnostic.id);

    // Extragem factorii contribuitori din datele disponibile
    const system = diagnostic.system || '';
    const symptoms = diagnostic.detectedSymptoms || [];

    // Factori pe baza PID-urilor din summary
    if (summary && summary.pid) {
        if (system.includes('TURBO') || symptoms.some(s => s.toLowerCase().includes('boost'))) {
            const boost = summary.pid.boost;
            if (boost && boost.average !== null) {
                factors.push({
                    parameter: 'Boost Pressure',
                    value: `${boost.average} bar`,
                    deviation: computeDeviation(boost.average, baseline?.raw_baseline?.boost || 1.0),
                    impact: boost.average < 0.6 ? 'Presiune insuficientă' : 'Normal'
                });
            }
            const maf = summary.pid.maf;
            if (maf && maf.average !== null) {
                factors.push({
                    parameter: 'MAF (Debit aer)',
                    value: `${maf.average} g/s`,
                    deviation: computeDeviation(maf.average, baseline?.raw_baseline?.maf || 30),
                    impact: maf.average < 20 ? 'Debit insuficient' : 'Normal'
                });
            }
        }

        if (system.includes('MOTOR') || system.includes('COMBUSTIBIL')) {
            const load = summary.pid.load;
            if (load && load.average !== null) {
                factors.push({
                    parameter: 'Engine Load',
                    value: `${load.average}%`,
                    deviation: computeDeviation(load.average, 35),
                    impact: load.average > 70 ? 'Sarcină excesivă' : 'Normal'
                });
            }
            const rpm = summary.pid.rpm;
            if (rpm && rpm.average !== null) {
                factors.push({
                    parameter: 'RPM',
                    value: `${rpm.average}`,
                    deviation: computeDeviation(rpm.average, baseline?.raw_baseline?.rpm || 1500),
                    impact: rpm.average > 3000 ? 'Turație ridicată' : 'Normal'
                });
            }
        }

        if (system.includes('ELECTRIC') || system.includes('BATERIE')) {
            const volt = summary.pid.voltage;
            if (volt) {
                factors.push({
                    parameter: 'Voltage',
                    value: `${volt.min}-${volt.max}V (avg: ${volt.average}V)`,
                    deviation: computeDeviation(volt.average, baseline?.raw_baseline?.voltage || 14.1),
                    impact: volt.min < 13.4 ? 'Tensiune sub optim' : 'Normal'
                });
            }
        }

        if (system.includes('DPF')) {
            const dpf = summary.pid.dpfSoot;
            if (dpf && dpf.max !== null) {
                factors.push({
                    parameter: 'DPF Soot Load',
                    value: `${dpf.max}%`,
                    deviation: null,
                    impact: dpf.max > 35 ? 'Încărcare ridicată' : 'Normal'
                });
            }
        }

        const coolant = summary.pid.coolant;
        if (coolant && coolant.average !== null && (system.includes('MOTOR') || system.includes('TERMIC'))) {
            factors.push({
                parameter: 'Coolant Temp',
                value: `${coolant.average}°C (max: ${coolant.max}°C)`,
                deviation: computeDeviation(coolant.average, baseline?.raw_baseline?.coolant || 88),
                impact: coolant.max > 100 ? 'Supraîncălzire' : 'Normal'
            });
        }
    }

    // Trend status
    let trendStatus = 'NOT_AVAILABLE';
    if (trends) {
        const relevantTrends = Object.entries(trends).filter(([k, v]) => v && v.trend && v.trend !== 'STABLE');
        if (relevantTrends.length > 0) {
            trendStatus = 'CONFIRMED';
        } else {
            trendStatus = 'STABLE';
        }
    }

    // Baseline status
    let baselineStatus = 'NOT_AVAILABLE';
    if (baseline && baseline.deviations) {
        const devValues = Object.values(baseline.deviations).map(d => parseFloat(d));
        const hasDeviation = devValues.some(v => !isNaN(v) && Math.abs(v) > 3);
        baselineStatus = hasDeviation ? 'DEVIATION_DETECTED' : 'WITHIN_NORMAL';
    }

    // Correlation contribution
    let correlationNote = null;
    if (correlations && correlations.anomalies && correlations.anomalies.length > 0) {
        correlationNote = correlations.anomalies.map(a => a.mesaj).join('; ');
    }

    // Verdict final
    const significantFactors = factors.filter(f => f.deviation && f.deviation.significant);
    let verdict;
    if (significantFactors.length >= 2 && trendStatus === 'CONFIRMED') {
        verdict = 'HIGHLY_PROBABLE';
    } else if (significantFactors.length >= 1 || trendStatus === 'CONFIRMED') {
        verdict = 'PROBABLE';
    } else if (factors.length > 0) {
        verdict = 'POSSIBLE';
    } else {
        verdict = 'INSUFFICIENT_DATA';
    }

    return {
        diagnosis: diagnostic.cause,
        system: diagnostic.system,
        probability: diagnostic.probability,
        factors,
        trendStatus,
        baselineStatus,
        correlationNote,
        confidence: confidence?.confidence || diagnostic.probability,
        verdict,
        rule: rule ? {
            id: rule.id,
            description: rule.description,
            recommendations: rule.recommendations,
            references: rule.references
        } : null
    };
}

function generateDetailedExplainability(diagnostics, context) {
    if (!diagnostics || diagnostics.length === 0) return [];

    return diagnostics.map(d => explainDiagnostic(d, context));
}

module.exports = { generateDetailedExplainability };
