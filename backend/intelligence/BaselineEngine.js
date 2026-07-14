/**
 * BaselineEngine.js — Învățare adaptivă pe profilul vehiculului[cite: 12]
 */
function initVehicleProfileTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_profile (
        vin TEXT PRIMARY KEY, model TEXT,
        baseline_rpm REAL DEFAULT 0, baseline_maf REAL DEFAULT 0,
        baseline_boost REAL DEFAULT 0, baseline_voltage REAL DEFAULT 14.1,
        baseline_coolant REAL DEFAULT 88.0, total_learned_trips INTEGER DEFAULT 0
    )`);
}

function updateAndCompareBaseline(db, vin, summary) {
    return new Promise((resolve) => {
        if (!summary || !summary.pid) return resolve(null);

        const curRpm = summary.pid.rpm?.average || 0;
        const curMaf = summary.pid.maf?.average || 0;
        const curBoost = summary.pid.boost?.average || 0;
        const curVolt = summary.pid.voltage?.average || 14.1;
        const curCoolant = summary.pid.coolant?.average || 88.0;

        db.get(`SELECT * FROM vehicle_profile WHERE vin = ?`, [vin], (err, row) => {
            if (!row || row.total_learned_trips === 0) {
                db.run(`INSERT OR REPLACE INTO vehicle_profile VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                    [vin, "Audi A6 C4", curRpm, curMaf, curBoost, curVolt, curCoolant]);
                return resolve({ status: "BASELINE_INITIALIZED", diffs: {} });
            }

            const n = row.total_learned_trips;
            // Calculăm noua medie mobilă (Moving Average)
            const newRpm = ((row.baseline_rpm * n) + curRpm) / (n + 1);
            const newMaf = ((row.baseline_maf * n) + curMaf) / (n + 1);
            const newBoost = ((row.baseline_boost * n) + curBoost) / (n + 1);
            const newVolt = ((row.baseline_voltage * n) + curVolt) / (n + 1);
            const newCoolant = ((row.baseline_coolant * n) + curCoolant) / (n + 1);

            db.run(`UPDATE vehicle_profile SET baseline_rpm=?, baseline_maf=?, baseline_boost=?, baseline_voltage=?, baseline_coolant=?, total_learned_trips=? WHERE vin=?`,
                [newRpm, newMaf, newBoost, newVolt, newCoolant, n + 1, vin]);

            // Generăm deviațiile față de normalul învățat[cite: 12]
            const diffCoolant = Number((curCoolant - row.baseline_coolant).toFixed(1));
            const diffVolt = Number((curVolt - row.baseline_voltage).toFixed(2));
            const diffMaf = Number((curMaf - row.baseline_maf).toFixed(1));

            resolve({
                learned_trips: n + 1,
                deviations: {
                    coolant: diffCoolant >= 0 ? `+${diffCoolant}°C vs normal` : `${diffCoolant}°C vs normal`,
                    voltage: diffVolt >= 0 ? `+${diffVolt}V vs normal` : `${diffVolt}V vs normal`,
                    maf: diffMaf >= 0 ? `+${diffMaf} g/s vs normal` : `${diffMaf} g/s vs normal`
                },
                raw_baseline: { coolant: Number(row.baseline_coolant.toFixed(1)), voltage: Number(row.baseline_voltage.toFixed(2)) }
            });
        });
    });
}

module.exports = { initVehicleProfileTable, updateAndCompareBaseline };