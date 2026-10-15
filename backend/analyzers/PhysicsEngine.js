'use strict';

/**
 * PhysicsEngine.js — ECU-Grade Automotive Physics & Virtual Sensors
 * -----------------------------------------------------------------------
 * Calcule matematice avansate aplicate în timp real pe telemetria 1Hz:
 *   1. Air-Fuel Ratio (AFR) & Virtual Lambda (λ) — Detecție fum negru / scurgeri
 *   2. Volumetric Efficiency (ηv %) — Sănătatea mecanică a respirației motorului
 *   3. Virtual Dyno (Cai Putere CP & Cuplu Nm) — Termodinamic vs Cinematic la roată
 *   4. Clutch Slip % — Patinarea ambreiajului în treptele 3-6 sub sarcină
 *   5. DPF Resistance Index (R_dpf) — Legea Darcy-Forchheimer normalizată cu debitul
 *   6. Dynamic Turbo Diagnostics — Separație VNT/N75 spike vs Furtun Intercooler spart
 *   7. Cooling Thermodynamics — Eficiență termostat & Răcitor ulei (Termoflot)
 *   8. Electrical Wiring Drop (ΔV) — Cablaj/Releu 109 vs Alternator
 *   9. Filtru Kalman 1D — Netezire zgomot electric pe MAF și Tensiune
 * -----------------------------------------------------------------------
 */

// ── 1D Kalman Filter Implementation ──────────────────────────────────────────
class KalmanFilter1D {
    constructor(processNoise = 0.02, measurementNoise = 0.8, estimatedError = 1.0, initialValue = 0) {
        this.q = processNoise;       // zgomot de proces (Q)
        this.r = measurementNoise;   // zgomot de măsurare (R)
        this.p = estimatedError;     // eroarea estimării (P)
        this.x = initialValue;       // valoarea estimată (X)
        this.initialized = false;
    }

    update(measurement) {
        if (measurement == null || isNaN(measurement)) return this.x;
        if (!this.initialized) {
            this.x = measurement;
            this.initialized = true;
            return this.x;
        }
        // Prediction update
        this.p = this.p + this.q;
        // Measurement update
        const k = this.p / (this.p + this.r); // Kalman gain
        this.x = this.x + k * (measurement - this.x);
        this.p = (1 - k) * this.p;
        return this.x;
    }
}

// ── Cache filtre Kalman și rapoarte de transmisie per călătorie/VIN ──────────
const sessionState = new Map();

function getSessionState(sessionKey) {
    if (!sessionState.has(sessionKey)) {
        sessionState.set(sessionKey, {
            mafFilter: new KalmanFilter1D(0.05, 1.2, 2.0, 10.0),
            voltFilter: new KalmanFilter1D(0.01, 0.2, 0.5, 14.0),
            learnedGearRatios: {
                1: 85.0, 2: 47.5, 3: 31.0, 4: 22.8, 5: 18.2, 6: 15.1
            },
            fuelBurnedLiters: 0,
            lastTimestamp: null,
            boostLagHistory: []
        });
    }
    return sessionState.get(sessionKey);
}

/**
 * computeVirtualSensors — Rulează la fiecare pachet de 1Hz
 * @param {Object} packet Pachetul brut din simulator / MQTT
 * @param {Object} vehicleConfig Specificații vehicul (default Audi A6 C4 2.5 TDI AEL)
 */
function computeVirtualSensors(packet, vehicleConfig = {}) {
    if (!packet || typeof packet !== 'object') return null;

    const vin = packet.ecu?.vin || 'WAUZZZ4A1RN000000';
    const state = getSessionState(vin);

    // Parametri motor & vehicul
    const cylinders   = vehicleConfig.cylinders || 5;       // Audi AEL R5
    const displacement = vehicleConfig.displacement_l || 2.461; // 2461 cmc
    const massKg      = vehicleConfig.mass_kg || 1550;      // Masă proprie
    const cd          = 0.30;                               // Coeficient aerodinamic Audi 100/A6 C4
    const frontalArea = 2.10;                               // Suprafață frontală m²
    const crr         = 0.015;                              // Rezistență la rulare pneuri

    // Extragere senzori pachet
    const m = packet.motor        || {};
    const a = packet.aer          || {};
    const c = packet.combustibil  || {};
    const t = packet.temperaturi  || {};
    const b = packet.baterie      || {};
    const d = packet.dpf          || {};
    const tr = packet.transmisie  || {};

    const rpm       = Math.max(0, Number(m.rpm || 0));
    const speedKmh  = Math.max(0, Number(m.speed || 0));
    const speedMs   = speedKmh / 3.6;
    const accelG    = Number(m.accel_g || 0);
    const loadPct   = Math.max(0, Math.min(100, Number(m.load || 0)));
    const rawMaf    = Math.max(0, Number(a.maf || 0));
    const mapKpa    = Math.max(50, Number(a.map || 101));
    const mapCmdKpa = Math.max(50, Number(a.map_cmd || mapKpa));
    const injQtyMg  = Math.max(0, Number(c.inj_qty_mg || (c.inst_cons ? (c.inst_cons * 1000) / (rpm * cylinders * 0.03 || 1) : 0)));
    const gear      = Number(tr.gear || 0);

    const tempCoolant = Number(t.coolant || 85);
    const tempOil     = Number(t.oil || tempCoolant);
    const tempAmbient = Number(t.ambient || 20);
    const tempCat1    = Number(t.cat1 || 220);

    const batteryVolt = Number(b.battery_volt || b.ecu_volt || 14.1);
    const ecuVolt     = Number(b.ecu_volt || batteryVolt);
    const diffPressMbar = Math.max(0, Number(d.diff_pressure_mbar || 0));

    // ── 0. Filtrare Kalman ───────────────────────────────────────────────────
    const filteredMaf  = Number(state.mafFilter.update(rawMaf).toFixed(2));
    const filteredVolt = Number(state.voltFilter.update(batteryVolt).toFixed(2));

    // ── 1. Raport Aer-Combustibil (AFR) & Lambda Virtual ──────────────────────
    let afr = 45.0;
    let lambda = 3.10;
    let smokeRisk = false;
    let mafMgPerStroke = 0;

    if (rpm > 400 && cylinders > 0) {
        mafMgPerStroke = (filteredMaf * 120000) / (rpm * cylinders);
        if (injQtyMg > 0.5) {
            afr = Number((mafMgPerStroke / injQtyMg).toFixed(2));
            lambda = Number((afr / 14.5).toFixed(3));
            // Limita de fum la diesel: sub 16.5:1 în sarcină arde incomplet
            smokeRisk = loadPct > 50 && afr < 16.5;
        }
    }

    // ── 2. Eficiența Volumetrică (ηv %) ──────────────────────────────────────
    // Manifold Volumetric Efficiency raportat la densitatea reală din galeria de admisie:
    // ρ = MAP / (R * T_intake), unde R_aer = 287.05 J/(kg·K).
    // Preluăm IAT (Intake Air Temperature) după intercooler dacă există; fallback ambient + 10°C.
    let volumetricEfficiencyPct = 0;
    const tempIntakeC = Number(t.iat ?? t.intake ?? (tempAmbient + 10));
    const tempIntakeK = Math.max(250, tempIntakeC + 273.15);
    const airDensityKgM3 = (mapKpa * 1000) / (287.05 * tempIntakeK);

    if (rpm > 400 && airDensityKgM3 > 0.1) {
        const theoreticalAirFlowGs = (rpm * displacement * airDensityKgM3) / 120;
        if (theoreticalAirFlowGs > 0) {
            volumetricEfficiencyPct = Number(Math.min(125, Math.max(0, (filteredMaf / theoreticalAirFlowGs) * 100)).toFixed(1));
        }
    }

    // ── 3. Virtual Dyno (Cai Putere CP & Cuplu Nm la Volantă / BHP) ──────────
    // A. Termodinamic la volantă (Brake Horsepower - BHP):
    // Randament indicat în cilindru: η_i ≈ 0.42.
    // Randament mecanic (pierderi frecare segmenți, cuzineți, pompă injecție Bosch): η_m ≈ 0.87.
    // Randament efectiv la volantă (Brake Thermal Efficiency): η_eff = η_i * η_m ≈ 0.365.
    // Putere calorică motorină: 42.6 MJ/kg.
    const ETA_BRAKE_EFFECTIVE = 0.365;
    let powerHpThermo = 0;
    let torqueNmThermo = 0;
    if (rpm > 400 && injQtyMg > 0) {
        const fuelRateGPerS = (injQtyMg * cylinders * (rpm / 120)) / 1000;
        const powerKwThermo = fuelRateGPerS * 42.6 * ETA_BRAKE_EFFECTIVE;
        powerHpThermo = Number((powerKwThermo * 1.35962).toFixed(1));
        torqueNmThermo = Number(((powerKwThermo * 9549) / rpm).toFixed(1));
    }

    // B. Cinematic la roată (F = m*a + F_aero + F_roll)
    let powerHpWheel = 0;
    if (speedMs > 2.0) {
        const fAero = 0.5 * 1.225 * cd * frontalArea * Math.pow(speedMs, 2);
        const fRoll = massKg * 9.81 * crr;
        const fAccel = massKg * (accelG * 9.81);
        const fTotal = fAero + fRoll + Math.max(0, fAccel);
        const powerKwWheel = Math.max(0, (fTotal * speedMs) / 1000);
        powerHpWheel = Number((powerKwWheel * 1.35962).toFixed(1));
    }

    // Putere afișată pe bord: ponderată sau termodinamică directă
    const powerHp = Math.min(145, Math.max(0, powerHpThermo || powerHpWheel));
    const torqueNm = Math.min(320, Math.max(0, torqueNmThermo));

    // ── 4. Patinarea Ambreiajului (Clutch Slip %) ─────────────────────────────
    let clutchSlipPct = 0;
    let clutchSlipping = false;

    if (gear >= 1 && gear <= 6 && speedKmh > 12 && rpm > 800) {
        const observedRatio = rpm / speedKmh;
        // Auto-calibrare în regim de sarcină joasă
        if (loadPct < 35) {
            state.learnedGearRatios[gear] = Number((0.95 * state.learnedGearRatios[gear] + 0.05 * observedRatio).toFixed(1));
        }

        const baselineRatio = state.learnedGearRatios[gear] || (gear === 3 ? 31.0 : gear === 4 ? 22.8 : 18.2);
        const expectedRpm = speedKmh * baselineRatio;

        if (loadPct > 70 && gear >= 3 && expectedRpm > 1000) {
            const rawSlip = ((rpm - expectedRpm) / expectedRpm) * 100;
            if (rawSlip > 0) {
                clutchSlipPct = Number(Math.min(100, rawSlip).toFixed(1));
                clutchSlipping = clutchSlipPct > 6.0;
            }
        }
    }

    // ── 5. Indicele de Permeabilitate DPF (R_dpf) ─────────────────────────────
    // Legea Darcy-Forchheimer normalizată cu debitul real volumetric al gazelor:
    // Q_vol (m³/h) = MAF (kg/h) / ρ_exh (kg/m³)
    // ρ_exh (kg/m³) = P_exh / (R * T_exh_K) ≈ 352.9 / (T_cat1 + 273.15)
    // R_dpf = (ΔP_mbar / Q_vol_m3h) * 100  [mbar per 100 m³/h debit volumetric]
    let dpfResistanceIndex = 0;
    let dpfStatus = 'CLEAN';

    if (filteredMaf > 2.0) {
        const tCatK = Math.max(273.15, tempCat1 + 273.15);
        const rhoExhaust = 352.9 / tCatK; // ~0.615 kg/m³ la 300°C
        const mafKgH = filteredMaf * 3.6; // kg/h
        const qVolM3H = rhoExhaust > 0.05 ? (mafKgH / rhoExhaust) : 100; // m³/h

        if (qVolM3H > 20 && diffPressMbar >= 0) {
            dpfResistanceIndex = Number(((diffPressMbar / qVolM3H) * 100).toFixed(2));
            if (dpfResistanceIndex < 5.0)       dpfStatus = 'CLEAN';             // R_raw < 0.05
            else if (dpfResistanceIndex < 10.0) dpfStatus = 'NORMAL';            // R_raw < 0.10
            else if (dpfResistanceIndex < 18.0) dpfStatus = 'WARNING_SOOT';       // R_raw < 0.18
            else                                dpfStatus = 'CRITICAL_CLOGGED';  // R_raw >= 0.18
        }
    }

    // ── 6. Analiza Dinamică Turbină (Boost Error & Diagnoză Fizică) ───────────
    const boostErrorKpa = Number((mapKpa - mapCmdKpa).toFixed(1));
    let turboDiagnostic = 'NORMAL';

    if (loadPct > 45 && rpm > 1400) {
        if (boostErrorKpa > 22.0) {
            turboDiagnostic = 'VNT_N75_SPIKE'; // Geometrie variabilă blocată pe închis sau N75 inert
        } else if (boostErrorKpa < -25.0) {
            // Dacă presiunea este mică, dar debitul de aer (VE%) este mare -> furtun spart (suflă afară după MAF)
            if (volumetricEfficiencyPct > 80.0) {
                turboDiagnostic = 'INTERCOOLER_BOOST_LEAK';
            } else {
                turboDiagnostic = 'TURBO_UNDERBOOST_WEAR'; // Turbină uzată, lipsă vacuum
            }
        }
    }

    // ── 7. Termodinamica Răcirii & Delta Ulei-Apă ─────────────────────────────
    const deltaOilWaterC = Number((tempOil - tempCoolant).toFixed(1));
    let oilCoolerStatus = 'NORMAL';

    const runTimeSec = Number(packet.timp?.run_time_sec || 0);
    if (runTimeSec > 600 && speedKmh > 50) {
        if (deltaOilWaterC > 22.0) {
            oilCoolerStatus = 'RESTRICTED_HEAT_EXCHANGE'; // Termoflot colmatat sau ulei degradat
        }
    }

    // Integrare combustibil pentru eficiență termostat
    const nowTime = packet.timestamp || Date.now();
    if (state.lastTimestamp) {
        const dtHours = Math.max(0, (nowTime - state.lastTimestamp) / 3600000);
        state.fuelBurnedLiters += (c.inst_cons || 0) * dtHours;
    }
    state.lastTimestamp = nowTime;

    let thermostatDiagnostic = 'NORMAL';
    if (state.fuelBurnedLiters > 0.5 && tempCoolant < 70 && speedKmh > 70) {
        thermostatDiagnostic = 'THERMOSTAT_STUCK_OPEN';
    }

    // ── 8. Diagnoza Cablaj Electric vs. Alternator ────────────────────────────
    const voltageDropV = Number(Math.abs(batteryVolt - ecuVolt).toFixed(2));
    let electricalDiagnostic = 'NORMAL';

    if (voltageDropV > 0.75) {
        electricalDiagnostic = 'GROUND_WIRING_DROP'; // Rezistență parazită, contacte Releu 109 arse
    } else if (filteredVolt < 12.8 && rpm > 1500) {
        electricalDiagnostic = 'ALTERNATOR_REGULATOR_FAULT';
    } else if (filteredVolt < 13.0 && rpm < 900 && batteryVolt > 13.9) {
        electricalDiagnostic = 'PULLEY_BELT_SLIP';
    }

    return {
        // Valori numerice pentru UI și grafice
        afr,
        lambda,
        smokeRisk,
        volumetricEfficiencyPct,
        powerHp,
        torqueNm,
        powerHpWheel,
        clutchSlipPct,
        clutchSlipping,
        dpfResistanceIndex,
        dpfStatus,
        boostErrorKpa,
        turboDiagnostic,
        deltaOilWaterC,
        oilCoolerStatus,
        thermostatDiagnostic,
        voltageDropV,
        electricalDiagnostic,
        filteredMaf,
        filteredVolt,
        mafMgPerStroke: Number(mafMgPerStroke.toFixed(1))
    };
}

module.exports = {
    computeVirtualSensors,
    KalmanFilter1D
};
