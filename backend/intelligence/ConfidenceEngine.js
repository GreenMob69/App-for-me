/**
 * ConfidenceEngine.js — Calculează scorul de încredere pentru diagnostice
 */
function buildConfidenceReport(rawDiagnostics) {
    if (!rawDiagnostics || rawDiagnostics.length === 0) {
        return {
            problem: "Nicio anomalie majoră detectată",
            confidence: 100,
            possibleCauses: []
        };
    }

    // Grupăm ipotezele pe sisteme pentru a identifica problema principală
    const topDiagnostic = rawDiagnostics[0];
    const systemCauses = rawDiagnostics.filter(d => d.system === topDiagnostic.system);

    // Calculăm încrederea globală ca medie ponderată a top 3 simptome
    const avgScore = systemCauses.slice(0, 3).reduce((acc, curr) => acc + curr.probability, 0) / Math.min(systemCauses.length, 3);
    const confidence = Math.min(99, Math.round(avgScore));

    const possibleCauses = systemCauses.map(item => ({
        name: item.cause,
        score: item.probability
    }));

    return {
        problem: `Anomalie detectată în sistemul ${topDiagnostic.system}: ${topDiagnostic.detectedSymptoms[0] || 'Comportament neconform'}`,
        confidence: confidence,
        possibleCauses: possibleCauses
    };
}

module.exports = { buildConfidenceReport };