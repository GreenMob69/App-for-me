/**
 * CorrelationEngine.js — Detectează rupturi de corelație între senzori[cite: 12]
 */
function calculatePearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 10) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += x[i]; sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
    }

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    if (denominator === 0) return 0;
    return Number((numerator / denominator).toFixed(2));
}

function analyzeTripCorrelations(telemetryPackets) {
    if (!telemetryPackets || telemetryPackets.length < 20) return null;

    const coolant = [], oil = [], rpm = [], fuelRate = [], boost = [], maf = [];

    telemetryPackets.forEach(p => {
        if (p.temperaturi?.coolant && p.temperaturi?.oil) {
            coolant.push(Number(p.temperaturi.coolant));
            oil.push(Number(p.temperaturi.oil));
        }
        if (p.motor?.rpm && p.combustibil?.inst_cons) {
            rpm.push(Number(p.motor.rpm));
            fuelRate.push(Number(p.combustibil.inst_cons));
        }
        if (p.aer?.boost_actual !== undefined && p.aer?.maf !== undefined) {
            boost.push(Number(p.aer.boost_actual));
            maf.push(Number(p.aer.maf));
        }
    });

    const rCoolantOil = calculatePearson(coolant, oil); // Normal: ~0.92[cite: 12]
    const rRpmFuel = calculatePearson(rpm, fuelRate);   // Normal: ~0.98[cite: 12]
    const rBoostMaf = calculatePearson(boost, maf);     // Normal: ~0.95[cite: 12]

    const anomalies = [];
    if (rBoostMaf < 0.60 && boost.length > 20) {
        anomalies.push({
            pereche: "Boost vs. MAF",
            coeficient: rBoostMaf,
            mesaj: "Abatere gravă: Presiunea turbo crește, dar debitmetrul nu înregistrează aer suplimentar. Posibilă priză falsă sau MAF blocat[cite: 12]."
        });
    }
    if (rCoolantOil < 0.50 && coolant.length > 20) {
        anomalies.push({
            pereche: "Coolant vs. Oil",
            coeficient: rCoolantOil,
            mesaj: "Abatere termică: Uleiul și lichidul de răcire nu se încălzesc sincron. Posibil termoflot colmatat sau termostat ezitant[cite: 12]."
        });
    }

    return {
        coefficients: { coolant_oil: rCoolantOil, rpm_fuel: rRpmFuel, boost_maf: rBoostMaf },
        anomalies: anomalies
    };
}

module.exports = { analyzeTripCorrelations };