'use strict';

/**
 * BaselineEngine.js — Învățare adaptivă & Matrice 2D RPM x Load Bucketing
 * -----------------------------------------------------------------------
 * Modelează profilul istoric al motorului:
 *   - Medii mobile globale (coolant, voltaj, maf, boost)
 *   - Matrice 2D (3x3 RPM x Load) inspirată din hărțile ECU Bosch EDC15
 * -----------------------------------------------------------------------
 */

function initVehicleProfileTable(db) {
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_profile (
        vin TEXT PRIMARY KEY, model TEXT,
        baseline_rpm REAL DEFAULT 0, baseline_maf REAL DEFAULT 0,
        baseline_boost REAL DEFAULT 0, baseline_voltage REAL DEFAULT 14.1,
        baseline_coolant REAL DEFAULT 88.0, total_learned_trips INTEGER DEFAULT 0
    )`);
    db.run(`ALTER TABLE vehicle_profile ADD COLUMN baseline_matrix_2d TEXT`, () => {});
}

// ── Determinare celulă 2D (0..2 RPM, 0..2 Load) ──────────────────────────────
function getCellKey(rpm, load) {
    let rIdx = 0; // Low
    if (rpm >= 2500) rIdx = 2; // High
    else if (rpm >= 1500) rIdx = 1; // Mid

    let lIdx = 0; // Low
    if (load >= 70) lIdx = 2; // High
    else if (load >= 30) lIdx = 1; // Mid

    return `r${rIdx}_l${lIdx}`;
}

const REGIME_NAMES = {
    'r0_l0': 'Ralanti / Decelerare (<1500 RPM, <30% sarcină)',
    'r0_l1': 'Trafic lejer urban (<1500 RPM, 30-70% sarcină)',
    'r0_l2': 'Sarcină joasă forțată (<1500 RPM, >70% sarcină)',
    'r1_l0': 'Cruising economic (1500-2500 RPM, <30% sarcină)',
    'r1_l1': 'Rulare drum întins (1500-2500 RPM, 30-70% sarcină)',
    'r1_l2': 'Accelerație în cuplu maxim (1500-2500 RPM, >70% sarcină)',
    'r2_l0': 'Frână de motor la turație (>2500 RPM, <30% sarcină)',
    'r2_l1': 'Depășire extraurbană (>2500 RPM, 30-70% sarcină)',
    'r2_l2': 'Sarcină maximă WOT (>2500 RPM, >70% sarcină)'
};

/**
 * computeTripMatrix — Calculează agregările pe cele 9 celule pentru cursa curentă
 */
function computeTripMatrix(packets = []) {
    const matrix = {};
    for (let r = 0; r < 3; r++) {
        for (let l = 0; l < 3; l++) {
            matrix[`r${r}_l${l}`] = {
                samples: 0,
                sumMaf: 0,
                sumMap: 0,
                sumVe: 0,
                sumPower: 0
            };
        }
    }

    packets.forEach(p => {
        const rpm = p.motor?.rpm || 0;
        const load = p.motor?.load || 0;
        if (rpm < 500) return; // ignorăm motor oprit

        const key = getCellKey(rpm, load);
        const cell = matrix[key];
        cell.samples++;
        cell.sumMaf += (p.aer?.maf || p.virtual?.filteredMaf || 0);
        cell.sumMap += (p.aer?.map || 101);
        cell.sumVe  += (p.virtual?.volumetricEfficiencyPct || 0);
        cell.sumPower += (p.virtual?.powerHp || 0);
    });

    const result = {};
    Object.keys(matrix).forEach(k => {
        const c = matrix[k];
        if (c.samples > 0) {
            result[k] = {
                samples: c.samples,
                avgMaf: Number((c.sumMaf / c.samples).toFixed(1)),
                avgMap: Number((c.sumMap / c.samples).toFixed(1)),
                avgVe:  Number((c.sumVe  / c.samples).toFixed(1)),
                avgPower: Number((c.sumPower / c.samples).toFixed(1)),
                regimeName: REGIME_NAMES[k]
            };
        }
    });

    return result;
}

function updateAndCompareBaseline(db, vin, summary, rawPackets = []) {
    return new Promise((resolve) => {
        if (!summary || !summary.pid) return resolve(null);

        const curRpm     = summary.pid.rpm?.average || 0;
        const curMaf     = summary.pid.maf?.average || 0;
        const curBoost   = summary.pid.boost?.average || 0;
        const curVolt    = summary.pid.voltage?.average || 14.1;
        const curCoolant = summary.pid.coolant?.average || 88.0;

        const currentTripMatrix = computeTripMatrix(rawPackets);

        db.get(`SELECT * FROM vehicle_profile WHERE vin = ?`, [vin], (err, row) => {
            if (!row || row.total_learned_trips === 0) {
                const initialMatrixJson = JSON.stringify(currentTripMatrix);
                db.run(`INSERT OR REPLACE INTO vehicle_profile VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [vin, "Audi A6 C4 · 2.5 TDI", curRpm, curMaf, curBoost, curVolt, curCoolant, initialMatrixJson]);
                return resolve({
                    status: "BASELINE_INITIALIZED",
                    learned_trips: 1,
                    diffs: {},
                    matrix2D: currentTripMatrix
                });
            }

            const n = row.total_learned_trips;
            const newRpm     = ((row.baseline_rpm * n) + curRpm) / (n + 1);
            const newMaf     = ((row.baseline_maf * n) + curMaf) / (n + 1);
            const newBoost   = ((row.baseline_boost * n) + curBoost) / (n + 1);
            const newVolt    = ((row.baseline_voltage * n) + curVolt) / (n + 1);
            const newCoolant = ((row.baseline_coolant * n) + curCoolant) / (n + 1);

            // Îmbinare matrice 2D adaptivă
            let storedMatrix = {};
            try { storedMatrix = JSON.parse(row.baseline_matrix_2d || '{}'); } catch {}

            const updatedMatrix = { ...storedMatrix };
            const matrixDeviations = {};

            Object.keys(currentTripMatrix).forEach(key => {
                const curCell = currentTripMatrix[key];
                const histCell = storedMatrix[key];
                if (!histCell) {
                    updatedMatrix[key] = curCell;
                } else {
                    const totalSamples = histCell.samples + curCell.samples;
                    updatedMatrix[key] = {
                        samples: totalSamples,
                        avgMaf: Number(((histCell.avgMaf * histCell.samples + curCell.avgMaf * curCell.samples) / totalSamples).toFixed(1)),
                        avgMap: Number(((histCell.avgMap * histCell.samples + curCell.avgMap * curCell.samples) / totalSamples).toFixed(1)),
                        avgVe:  Number(((histCell.avgVe  * histCell.samples + curCell.avgVe  * curCell.samples) / totalSamples).toFixed(1)),
                        avgPower: Number(((histCell.avgPower * histCell.samples + curCell.avgPower * curCell.samples) / totalSamples).toFixed(1)),
                        regimeName: REGIME_NAMES[key]
                    };

                    // Verificăm dacă în celula de sarcină plină (r1_l2 sau r2_l2) eficiența volumetrică a scăzut
                    if (key === 'r1_l2' || key === 'r2_l2') {
                        const veDiff = Number((curCell.avgVe - histCell.avgVe).toFixed(1));
                        if (veDiff <= -8.0) {
                            matrixDeviations[key] = {
                                regime: REGIME_NAMES[key],
                                warning: `Scădere VE% (${veDiff}%) în sarcină mare`,
                                currentVe: curCell.avgVe,
                                baselineVe: histCell.avgVe
                            };
                        }
                    }
                }
            });

            db.run(`UPDATE vehicle_profile SET 
                baseline_rpm=?, baseline_maf=?, baseline_boost=?, baseline_voltage=?, baseline_coolant=?, total_learned_trips=?, baseline_matrix_2d=? 
                WHERE vin=?`,
                [newRpm, newMaf, newBoost, newVolt, newCoolant, n + 1, JSON.stringify(updatedMatrix), vin]);

            const diffCoolant = Number((curCoolant - row.baseline_coolant).toFixed(1));
            const diffVolt    = Number((curVolt - row.baseline_voltage).toFixed(2));
            const diffMaf     = Number((curMaf - row.baseline_maf).toFixed(1));

            resolve({
                learned_trips: n + 1,
                deviations: {
                    coolant: diffCoolant >= 0 ? `+${diffCoolant}°C vs normal` : `${diffCoolant}°C vs normal`,
                    voltage: diffVolt >= 0 ? `+${diffVolt}V vs normal` : `${diffVolt}V vs normal`,
                    maf: diffMaf >= 0 ? `+${diffMaf} g/s vs normal` : `${diffMaf} g/s vs normal`
                },
                raw_baseline: {
                    coolant: Number(row.baseline_coolant.toFixed(1)),
                    voltage: Number(row.baseline_voltage.toFixed(2))
                },
                matrix2D: updatedMatrix,
                matrixDeviations
            });
        });
    });
}

module.exports = {
    initVehicleProfileTable,
    updateAndCompareBaseline,
    computeTripMatrix,
    REGIME_NAMES
};