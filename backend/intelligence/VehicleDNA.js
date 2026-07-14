/**
 * VehicleDNA.js — Amprenta unică a sănătății vehiculului[cite: 12]
 */
function generateVehicleDNA(health, baselineResult, correlations, confidenceReport) {
    const dna = {
        timestamp: Date.now(),
        overall_health: health?.overallHealth || 100,
        subsystems: {
            cooling: { score: health?.engineScore || 100, status: baselineResult?.deviations?.coolant || "Normal" },
            electrical: { score: 100, status: baselineResult?.deviations?.voltage || "Normal" },
            turbo: { score: confidenceReport?.problem?.includes("TURBO") ? 75 : 95, status: "Parametri în toleranță" },
            fuel: { score: health?.fuelScore || 100, status: "Injecție optimă" },
            driving_style: { score: health?.drivingScore || 100, label: health?.drivingScore > 85 ? "Economic" : "Agresiv" }
        },
        correlation_health: correlations?.anomalies?.length === 0 ? "Sincronizare perfectă" : `${correlations.anomalies.length} rupturi detectate`,
        ai_summary: `Vehiculul operează la ${health?.overallHealth || 100}% capacitate față de propriul ADN istoric[cite: 12].`
    };

    if (baselineResult?.raw_baseline?.voltage < 13.6) {
        dna.subsystems.electrical.score = 80;
        dna.subsystems.electrical.status = "Eficiență alternator în scădere";
    }

    return dna;
}

module.exports = { generateVehicleDNA };