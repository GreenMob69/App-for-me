/**
 * ReliabilityEngine.js — Evaluare fiabilitate per diagnoză
 * -----------------------------------------------------------------------
 * Nu toate diagnozele sunt la fel de sigure. Acest modul calculează cât
 * de fiabilă este fiecare diagnoză pe baza:
 *   - Disponibilitatea PID-urilor relevante (lipsesc → ↓)
 *   - Calitatea senzorilor (zgomot → ↓)
 *   - Prezența DTC-urilor asociate (confirmă → ↑)
 *   - Numărul de reguli care confirmă aceeași problemă (convergență → ↑)
 *   - Consistența cu baseline-ul (deviație confirmată → ↑)
 *   - Numărul de simptome detectate (mai multe → ↑)
 *
 * Returnează: [{ diagnosis, reliability, explanation }]
 * -----------------------------------------------------------------------
 */

const PID_RELEVANCE = {
    'TURBO': ['boost', 'maf', 'map', 'rpm'],
    'MOTOR': ['rpm', 'load', 'coolant', 'maf', 'oil'],
    'MOTOR / TRANSMISIE': ['rpm', 'speed', 'load', 'torque'],
    'COMBUSTIBIL': ['fuelRate', 'load', 'maf', 'rpm'],
    'COMBUSTIBIL / ADMISIE': ['maf', 'load', 'rpm', 'boost'],
    'BATERIE & ELECTRIC': ['voltage', 'rpm'],
    'BATERIE': ['voltage'],
    'DPF (DIESEL)': ['dpfSoot', 'coolant', 'rpm'],
    'LAMBDA / STOICHIOMETRIE': ['maf', 'load', 'rpm'],
    'TRANSMISIE': ['rpm', 'speed', 'torque', 'load']
};

const DTC_SYSTEM_MAP = {
    'TURBO': ['P0234', 'P0299', 'P0236', '16683', '16618'],
    'MOTOR': ['P0101', 'P0102', 'P0103', 'P0300', 'P0171', 'P0172'],
    'COMBUSTIBIL': ['P0087', 'P0088', 'P0190', 'P0191', 'P0263'],
    'BATERIE & ELECTRIC': ['P0562', 'P0563', 'P0620', 'P0621'],
    'DPF (DIESEL)': ['P2002', 'P2463', 'P244A', 'P2458'],
    'LAMBDA / STOICHIOMETRIE': ['P0130', 'P0131', 'P0132', 'P0133']
};

function calculateReliability(diagnostic, context) {
    const { sensorQuality, dtcList, baselineResult, allDiagnostics } = context;
    let reliability = 50;
    const explanations = [];

    // 1. Evaluare disponibilitate PID-uri relevante
    const relevantPids = PID_RELEVANCE[diagnostic.system] || [];
    if (relevantPids.length > 0 && sensorQuality && sensorQuality.length > 0) {
        let availableCount = 0;
        let totalQuality = 0;

        for (const pid of relevantPids) {
            const sq = sensorQuality.find(s => s.key === pid);
            if (sq && sq.status !== 'NO_DATA') {
                availableCount++;
                totalQuality += sq.quality;
            }
        }

        const coveragePct = (availableCount / relevantPids.length) * 100;
        if (coveragePct >= 80) {
            reliability += 10;
            explanations.push(`PID-uri relevante disponibile: ${availableCount}/${relevantPids.length}`);
        } else if (coveragePct < 50) {
            reliability -= 20;
            explanations.push(`PID-uri insuficiente: doar ${availableCount}/${relevantPids.length} disponibile`);
        } else {
            reliability -= 5;
            explanations.push(`PID-uri parțial disponibile: ${availableCount}/${relevantPids.length}`);
        }

        // Calitate medie senzori
        if (availableCount > 0) {
            const avgQuality = totalQuality / availableCount;
            if (avgQuality >= 85) {
                reliability += 10;
                explanations.push(`Calitate senzori: ${Math.round(avgQuality)}% (excelentă)`);
            } else if (avgQuality < 50) {
                reliability -= 15;
                explanations.push(`Calitate senzori degradată: ${Math.round(avgQuality)}% — diagnoză nesigură`);
            }
        }
    }

    // 2. Prezența DTC-urilor asociate
    if (dtcList && dtcList.length > 0) {
        const systemDtcs = DTC_SYSTEM_MAP[diagnostic.system] || [];
        const matchingDtc = dtcList.filter(d => systemDtcs.includes(d.cod || d));
        if (matchingDtc.length > 0) {
            reliability += 20;
            explanations.push(`DTC confirmat: ${matchingDtc.map(d => d.cod || d).join(', ')}`);
        }
    }

    // 3. Convergența regulilor (mai multe simptome = mai sigur)
    const symptomCount = diagnostic.detectedSymptoms ? diagnostic.detectedSymptoms.length : 0;
    if (symptomCount >= 3) {
        reliability += 15;
        explanations.push(`${symptomCount} simptome convergente — încredere ridicată`);
    } else if (symptomCount === 2) {
        reliability += 8;
        explanations.push(`${symptomCount} simptome detectate`);
    } else if (symptomCount === 1) {
        reliability -= 5;
        explanations.push('Diagnoză bazată pe un singur simptom');
    }

    // 4. Probabilitatea inițială a diagnosticului
    if (diagnostic.probability >= 70) {
        reliability += 10;
        explanations.push(`Probabilitate ridicată: ${diagnostic.probability}%`);
    } else if (diagnostic.probability < 30) {
        reliability -= 10;
        explanations.push(`Probabilitate scăzută: ${diagnostic.probability}% — posibil fals pozitiv`);
    }

    // 5. Confirmarea din baseline (deviație detectată)
    if (baselineResult && baselineResult.deviations) {
        const devs = Object.values(baselineResult.deviations);
        const hasSignificantDeviation = devs.some(d => {
            const val = parseFloat(d);
            return !isNaN(val) && Math.abs(val) > 5;
        });
        if (hasSignificantDeviation) {
            reliability += 8;
            explanations.push('Baseline confirmă deviație semnificativă');
        }
    }

    // 6. Consistență cu alte diagnostice (aceeași problemă din sisteme diferite)
    if (allDiagnostics && allDiagnostics.length > 1) {
        const sameCause = allDiagnostics.filter(d => d.cause === diagnostic.cause && d !== diagnostic);
        if (sameCause.length > 0) {
            reliability += 5;
            explanations.push('Confirmat de reguli din sisteme multiple');
        }
    }

    reliability = Math.max(0, Math.min(100, Math.round(reliability)));

    return {
        diagnosis: diagnostic.cause,
        system: diagnostic.system,
        probability: diagnostic.probability,
        reliability,
        grade: reliability >= 80 ? 'HIGH' : reliability >= 55 ? 'MEDIUM' : 'LOW',
        explanation: explanations
    };
}

function buildReliabilityReport(diagnostics, sensorQuality, dtcList, baselineResult) {
    if (!diagnostics || diagnostics.length === 0) {
        return [];
    }

    const context = {
        sensorQuality: sensorQuality || [],
        dtcList: dtcList || [],
        baselineResult: baselineResult || null,
        allDiagnostics: diagnostics
    };

    return diagnostics.map(d => calculateReliability(d, context));
}

module.exports = { buildReliabilityReport };
