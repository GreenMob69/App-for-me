/**
 * TrendEngine.js — Modulul de Mentenanță Predictivă (Analiză Transversală)
 * Monitorizează degradarea în timp a motorului Audi A6 C4 2.5 TDI AEL pe ultimele N curse.
 */

function calculateDelta(oldAvg, newAvg) {
    if (!oldAvg || oldAvg === 0) return 0;
    return ((newAvg - oldAvg) / oldAvg) * 100;
}

function analyzeTrends(db, vin, limit = 20) {
    return new Promise((resolve, reject) => {
        // Interogăm ultimele N curse finalizate din trip_summary pentru vehiculul curent
        const sql = `
            SELECT ts.*, c.timestamp_start 
            FROM trip_summary ts
            JOIN calatorii c ON ts.id_calatorie = c.id_calatorie
            WHERE c.vin = ? AND c.timestamp_end IS NOT NULL
            ORDER BY c.id_calatorie DESC
            LIMIT ?
        `;

        db.all(sql, [vin, limit], (err, rows) => {
            if (err) return reject(err);
            if (!rows || rows.length < 4) {
                return resolve({
                    status: "INSUFFICIENT_DATA",
                    mesaj: `Trend Engine necesită cel puțin 4 curse finalizate (curente: ${rows ? rows.length : 0}).`,
                    tendinte: null
                });
            }

            // Împărțim fereastra de curse în două jumătăți: Istoric (vechi) vs. Recent (noi)
            // rows[0] este cea mai recentă cursă
            const mid = Math.floor(rows.length / 2);
            const recentTrips = rows.slice(0, mid);
            const olderTrips = rows.slice(mid);

            const calcAverage = (arr, field) => arr.reduce((acc, curr) => acc + (curr[field] || 0), 0) / arr.length;

            // 1. Analiza Sistemului Electric (Alternator & Baterie)
            const oldVolt = calcAverage(olderTrips, 'voltaj_max');
            const newVolt = calcAverage(recentTrips, 'voltaj_max');
            const voltDelta = calculateDelta(oldVolt, newVolt);

            // 2. Analiza Admisiei (Senzor MAF & Eficiență Aer)
            const oldMaf = calcAverage(olderTrips, 'maf_mediu');
            const newMaf = calcAverage(recentTrips, 'maf_mediu');
            const mafDelta = calculateDelta(oldMaf, newMaf);

            // 3. Analiza Sistemului de Răcire (Regim Termic Coolant)
            const oldCoolant = calcAverage(olderTrips, 'coolant_medie');
            const newCoolant = calcAverage(recentTrips, 'coolant_medie');
            const coolantDelta = calculateDelta(oldCoolant, newCoolant);

            // 4. Analiza Eficienței de Consum
            const oldCost = calcAverage(olderTrips, 'cost_combustibil');
            const newCost = calcAverage(recentTrips, 'cost_combustibil');
            const costDelta = calculateDelta(oldCost, newCost);

            // 5. Analiza Sănătății Generale (Health Score Trend)
            const oldHealth = calcAverage(olderTrips, 'health_score');
            const newHealth = calcAverage(recentTrips, 'health_score');
            const healthDelta = calculateDelta(oldHealth, newHealth);

            // Motor de deducție predictivă (Alerte timpurii)
            const avertizariPredictive = [];

            if (newVolt < 13.8 && voltDelta < -1.5) {
                avertizariPredictive.push({
                    sistem: "ELECTRIC",
                    stare: "DEGRADARE_ALTERNATOR",
                    detaliu: `Tensiunea maximă a scăzut progresiv cu ${Math.abs(voltDelta).toFixed(1)}% în ultimele curse (Medie recentă: ${newVolt.toFixed(2)}V). Verifică puntea de diode sau cărbunii.`
                });
            }

            if (mafDelta < -8.0 && newMaf < 22) {
                avertizariPredictive.push({
                    sistem: "ADMISIE_AER",
                    stare: "RESTRICTIE_FLUX_AER",
                    detaliu: `Debitul mediu de aer (MAF) este în scădere continuă (${mafDelta.toFixed(1)}%). Indiciu ridicat pentru filtru de aer îmbâcsit sau senzor MAF contaminat.`
                });
            }

            if (coolantDelta > 5.0 && newCoolant > 92) {
                avertizariPredictive.push({
                    sistem: "RACIRE",
                    stare: "TERMIC_CRESCUT",
                    detaliu: `Temperatura medie a motorului a crescut cu ${coolantDelta.toFixed(1)}°C față de cursele anterioare. Posibilă colmatare a radiatorului sau termostat ezitant.`
                });
            }

            if (costDelta > 10.0) {
                avertizariPredictive.push({
                    sistem: "ECONOMIE",
                    stare: "CONSUM_IN_CRESTERE",
                    detaliu: `Costul și consumul pe cursă au crescut cu ${costDelta.toFixed(1)}% în regim similar de deplasare.`
                });
            }

            resolve({
                status: "SUCCESS",
                curse_analizate: rows.length,
                ferestre_comparate: {
                    curse_recente: recentTrips.length,
                    curse_istorice: olderTrips.length
                },
                metrici: {
                    voltaj: { vechi: oldVolt.toFixed(2), curent: newVolt.toFixed(2), variatie_pct: voltDelta.toFixed(2) },
                    maf: { vechi: oldMaf.toFixed(2), curent: newMaf.toFixed(2), variatie_pct: mafDelta.toFixed(2) },
                    coolant: { vechi: oldCoolant.toFixed(1), curent: newCoolant.toFixed(1), variatie_pct: coolantDelta.toFixed(2) },
                    cost: { vechi: oldCost.toFixed(2), curent: newCost.toFixed(2), variatie_pct: costDelta.toFixed(2) },
                    health_score: { vechi: oldHealth.toFixed(1), curent: newHealth.toFixed(1), variatie_pct: healthDelta.toFixed(2) }
                },
                alerte_predictive: avertizariPredictive
            });
        });
    });
}

module.exports = { analyzeTrends };