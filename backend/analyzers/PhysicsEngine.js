'use strict';

/**
 * PhysicsEngine.js — ECU-Grade Automotive Physics & Virtual Sensors
 * -----------------------------------------------------------------------
 * Calcule matematice profunde aplicate în timp real pe telemetria 1Hz:
 *   1. Air-Fuel Ratio (AFR) & Virtual Lambda (λ) — Detecție fum negru
 *   2. Eficiența Volumetrică (ηv %) — Respirația motorului cu densitate IAT
 *   3. Virtual Dyno (BHP la volantă & Cuplu Nm) — Calibrare η_eff = 0.365
 *   4. Patinarea Ambreiajului (Clutch Slip %) — Auto-învățare rapoarte
 *   5. Permeabilitate DPF (R_dpf) — Darcy-Forchheimer cu debit volumetric
 *   6. Analiză Dinamică Turbină — Separație VNT/N75 vs Furtun Intercooler
 *   7. Termodinamica Răcirii — Delta Ulei-Apă & Termostat
 *   8. Cablaj Electric — Cădere tensiune Releu 109 vs Alternator
 *   9. Filtru Kalman 1D — Netezire MAF și Tensiune
 *
 * --- 8 Algoritmi Avansați de Fuziune a Senzorilor & Observatori Virtuali ---
 *   [F1] BSFC (Brake Specific Fuel Consumption) în g/kWh cu randament dinamic
 *   [F2] Arrhenius Oil Life Index (Oxidare termică, diluție la rece, forfecare)
 *   [F3] Pantă Drum (Road Grade θ %) & Detecție Caliper Blocat (Coast-Down Drag)
 *   [F4] Diagnoză Common Rail / Pompă HP (Abatere bar & Ripple regulator DRV)
 *   [F5] Exotermia Gazelor Evacuare (ΔT_cat) & Detecție Regenerare Activă DPF
 *   [F6] Sănătatea Bateriei (SoH %), Rezistență la Pornire (R_int mΩ) & Diodă Alternator
 *   [F7] Disipare Energie Cinetice Frâne (E_brake MJ) & Model Archard Uzură Plăcuțe
 *   [F8] Recirculare EGR (Mass Fraction %) & Detecție Supapă Blocată / Calamină
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

// ── Cache de stare per vehicul/VIN (pentru integratori temporali și observatori) ──
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
            boostLagHistory: [],

            // Stare observatori avansați
            oilWearKmEquivalent: 0,
            tripRealKm: 0,
            restVolt: 12.6,
            crankMinVolt: 11.0,
            voltDeltas: [],
            recentRailPressures: [],
            brakeEnergyJoulesTrip: 0, // stocat în MJ
            discTempC: 20
        });
    }
    return sessionState.get(sessionKey);
}

function resetSessionState(sessionKey) {
    if (sessionKey) {
        sessionState.delete(sessionKey);
    } else {
        sessionState.clear();
    }
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
    const cylinders    = vehicleConfig.cylinders || 5;          // Audi AEL R5
    const displacement = vehicleConfig.displacement_l || 2.461;    // 2461 cmc
    const massKg       = vehicleConfig.mass_kg || 1550;         // Masă proprie
    const cd           = 0.30;                                  // Coeficient aerodinamic Audi 100/A6 C4
    const frontalArea  = 2.10;                                  // Suprafață frontală m²
    const crr          = 0.015;                                 // Rezistență la rulare pneuri
    const diffRatio    = 3.89;                                  // Raport grup conic final
    const wheelRadiusM = 0.316;                                 // Rază dinamică roată (195/65 R15 sau 205/55 R16)
    const transEff     = 0.92;                                  // Randament mecanic cutie + diferențial
    const gearRatios   = { 1: 3.50, 2: 1.89, 3: 1.23, 4: 0.93, 5: 0.73, 6: 0.60 };

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
    const tempCat1    = Number(t.cat1 ?? t.cat_b1s1 ?? 220);
    const tempCat2    = Number(t.cat2 ?? t.cat_b1s2 ?? (tempCat1 - 25));

    const batteryVolt = Number(b.battery_volt ?? b.bat_volt ?? b.ecu_volt ?? 14.1);
    const ecuVolt     = Number(b.ecu_volt ?? batteryVolt);
    const diffPressMbar = Math.max(0, Number(d.diff_pressure_mbar ?? d.diff_press ?? 0));

    // Presiune Common Rail / Pompă HP: suport bar direct sau kPa (dacă > 2500, e kPa -> /100 = bar)
    const rawRailPress = Number(c.rail_press_bar ?? c.rail_press ?? 0);
    const railPressActualBar = rawRailPress > 2500 ? (rawRailPress / 100) : rawRailPress;

    // Delta timp integratori (secunde)
    const nowTime = packet.timestamp || Date.now();
    let dtSec = 1.0;
    if (state.lastTimestamp) {
        dtSec = Math.max(0.1, Math.min(10.0, (nowTime - state.lastTimestamp) / 1000));
    }
    const dtHours = dtSec / 3600;

    // ── 0. Filtrare Kalman 1D ────────────────────────────────────────────────
    const filteredMaf  = Number(state.mafFilter.update(rawMaf).toFixed(2));
    const filteredVolt = Number(state.voltFilter.update(batteryVolt).toFixed(2));

    // ── 1. Raport Aer-Combustibil (AFR) & Lambda Virtual ─────────────────────
    let afr = 45.0;
    let lambda = 3.10;
    let smokeRisk = false;
    let mafMgPerStroke = 0;

    if (rpm > 400 && cylinders > 0) {
        mafMgPerStroke = (filteredMaf * 120000) / (rpm * cylinders);
        if (injQtyMg > 0.5) {
            afr = Number((mafMgPerStroke / injQtyMg).toFixed(2));
            lambda = Number((afr / 14.5).toFixed(3));
            smokeRisk = loadPct > 50 && afr < 16.5;
        }
    }

    // ── 2. Eficiența Volumetrică (ηv %) ──────────────────────────────────────
    let volumetricEfficiencyPct = 0;
    const tempIntakeC = Number(t.iat ?? t.intake ?? (tempAmbient + 10));
    const tempIntakeK = Math.max(250, tempIntakeC + 273.15);
    const airDensityKgM3 = (mapKpa * 1000) / (287.05 * tempIntakeK);
    let theoreticalAirFlowGs = 0;

    if (rpm > 400 && airDensityKgM3 > 0.1) {
        theoreticalAirFlowGs = (rpm * displacement * airDensityKgM3) / 120;
        if (theoreticalAirFlowGs > 0) {
            volumetricEfficiencyPct = Number(Math.min(125, Math.max(0, (filteredMaf / theoreticalAirFlowGs) * 100)).toFixed(1));
        }
    }

    // ── 3. Virtual Dyno (Cai Putere CP & Cuplu Nm la Volantă / BHP) ──────────
    // Randament efectiv de bază: η_eff = 0.365.
    // Corecții dinamice pentru ardere incompletă la fum, frecare la rece și pompaj:
    let lambdaFactor = 1.0;
    if (lambda < 1.25) {
        lambdaFactor = Math.max(0.75, 1.0 - (1.25 - lambda) * 0.8);
    } else if (lambda > 3.0) {
        lambdaFactor = Math.max(0.70, 1.0 - (lambda - 3.0) * 0.1);
    }

    const coldFrictionFactor = tempOil < 75 ? Math.max(0.70, 0.70 + 0.30 * (tempOil / 75)) : 1.0;
    const pumpingLossFactor  = rpm > 3000 ? Math.max(0.85, 1.0 - ((rpm - 3000) / 2000) * 0.15) : 1.0;
    const etaBrakeDynamic    = 0.365 * lambdaFactor * coldFrictionFactor * pumpingLossFactor;

    let powerHpThermo = 0;
    let torqueNmThermo = 0;
    let powerKwThermo = 0;
    let fuelRateGPerS = 0;
    let fuelMassFlowGPerH = 0;

    if (rpm > 400 && injQtyMg > 0) {
        fuelRateGPerS = (injQtyMg * cylinders * (rpm / 120)) / 1000;
        fuelMassFlowGPerH = fuelRateGPerS * 3600;
        powerKwThermo = fuelRateGPerS * 42.6 * etaBrakeDynamic;
        powerHpThermo = Number((powerKwThermo * 1.35962).toFixed(1));
        torqueNmThermo = Number(((powerKwThermo * 9549) / rpm).toFixed(1));
    }

    // Cinematic la roată (F = m*a + F_aero + F_roll)
    let powerHpWheel = 0;
    if (speedMs > 2.0) {
        const fAero = 0.5 * 1.225 * cd * frontalArea * Math.pow(speedMs, 2);
        const fRoll = massKg * 9.81 * crr;
        const fAccel = massKg * (accelG * 9.81);
        const fTotal = fAero + fRoll + Math.max(0, fAccel);
        const powerKwWheel = Math.max(0, (fTotal * speedMs) / 1000);
        powerHpWheel = Number((powerKwWheel * 1.35962).toFixed(1));
    }

    const powerHp = Math.min(150, Math.max(0, powerHpThermo || powerHpWheel));
    const torqueNm = Math.min(350, Math.max(0, torqueNmThermo));

    // ── 4. Patinarea Ambreiajului (Clutch Slip %) ─────────────────────────────
    let clutchSlipPct = 0;
    let clutchSlipping = false;

    if (gear >= 1 && gear <= 6 && speedKmh > 12 && rpm > 800) {
        const observedRatio = rpm / speedKmh;
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
    let dpfResistanceIndex = 0;
    let dpfStatus = 'CLEAN';

    if (filteredMaf > 2.0) {
        const tCatK = Math.max(273.15, tempCat1 + 273.15);
        const rhoExhaust = 352.9 / tCatK;
        const mafKgH = filteredMaf * 3.6;
        const qVolM3H = rhoExhaust > 0.05 ? (mafKgH / rhoExhaust) : 100;

        if (qVolM3H > 20 && diffPressMbar >= 0) {
            dpfResistanceIndex = Number(((diffPressMbar / qVolM3H) * 100).toFixed(2));
            if (dpfResistanceIndex < 5.0)       dpfStatus = 'CLEAN';
            else if (dpfResistanceIndex < 10.0) dpfStatus = 'NORMAL';
            else if (dpfResistanceIndex < 18.0) dpfStatus = 'WARNING_SOOT';
            else                                dpfStatus = 'CRITICAL_CLOGGED';
        }
    }

    // ── 6. Analiza Dinamică Turbină (Boost Error & Diagnoză Fizică) ───────────
    const boostErrorKpa = Number((mapKpa - mapCmdKpa).toFixed(1));
    let turboDiagnostic = 'NORMAL';

    if (loadPct > 45 && rpm > 1400) {
        if (boostErrorKpa > 22.0) {
            turboDiagnostic = 'VNT_N75_SPIKE';
        } else if (boostErrorKpa < -25.0) {
            if (volumetricEfficiencyPct > 80.0) {
                turboDiagnostic = 'INTERCOOLER_BOOST_LEAK';
            } else {
                turboDiagnostic = 'TURBO_UNDERBOOST_WEAR';
            }
        }
    }

    // ── 7. Termodinamica Răcirii & Delta Ulei-Apă ─────────────────────────────
    const deltaOilWaterC = Number((tempOil - tempCoolant).toFixed(1));
    let oilCoolerStatus = 'NORMAL';

    const runTimeSec = Number(packet.timp?.run_time_sec || 0);
    if (runTimeSec > 600 && speedKmh > 50) {
        if (deltaOilWaterC > 22.0) {
            oilCoolerStatus = 'RESTRICTED_HEAT_EXCHANGE';
        }
    }

    // Integrare consum combustibil
    state.fuelBurnedLiters += (c.inst_cons || 0) * dtHours;

    let thermostatDiagnostic = 'NORMAL';
    if (state.fuelBurnedLiters > 0.5 && tempCoolant < 70 && speedKmh > 70) {
        thermostatDiagnostic = 'THERMOSTAT_STUCK_OPEN';
    }

    // ── 8. Diagnoza Cablaj Electric vs. Alternator ────────────────────────────
    const voltageDropV = Number(Math.abs(batteryVolt - ecuVolt).toFixed(2));
    let electricalDiagnostic = 'NORMAL';

    if (voltageDropV > 0.75) {
        electricalDiagnostic = 'GROUND_WIRING_DROP';
    } else if (filteredVolt < 12.8 && rpm > 1500) {
        electricalDiagnostic = 'ALTERNATOR_REGULATOR_FAULT';
    } else if (filteredVolt < 13.0 && rpm < 900 && batteryVolt > 13.9) {
        electricalDiagnostic = 'PULLEY_BELT_SLIP';
    }

    // =========================================================================
    // 8 ALGORITMI AVANSAȚI DE FUZIUNE A SENZORILOR & VIRTUAL OBSERVERS
    // =========================================================================

    // ── [F1] Consumul Specific Efectiv (BSFC) în g/kWh ──────────────────────
    let bsfcGPerKwh = 0;
    if (powerKwThermo > 0.5 && fuelMassFlowGPerH > 0) {
        bsfcGPerKwh = Number((fuelMassFlowGPerH / powerKwThermo).toFixed(1));
    }
    const engineEfficiencyPct = Number((etaBrakeDynamic * 100).toFixed(1));

    // ── [F2] Modelul Arrhenius de Degradare Ulei (Oil Life Index) ────────────
    const kOxidation = Math.pow(2, Math.max(0, tempOil - 95) / 10);
    const kDilution  = 1 + 1.5 * Math.max(0, (65 - tempCoolant) / 65);
    const kShear     = rpm > 2000 ? Math.min(2.5, Math.pow(rpm / 2000, 1.4)) : 1.0;
    const fOilWear   = kOxidation * kDilution * kShear;

    const deltaKmReal = speedKmh * dtHours;
    const deltaKmOilWear = deltaKmReal * fOilWear;
    state.tripRealKm = (state.tripRealKm || 0) + deltaKmReal;
    state.oilWearKmEquivalent = (state.oilWearKmEquivalent || 0) + deltaKmOilWear;

    const oilStressMultiplier = state.tripRealKm > 0.05
        ? Number((state.oilWearKmEquivalent / state.tripRealKm).toFixed(2))
        : Number(fOilWear.toFixed(2));

    // ── [F3] Pantă Drum (Road Grade θ %) & Detecție Caliper / Drag ───────────
    const fAeroLong = 0.5 * 1.225 * cd * frontalArea * Math.pow(speedMs, 2);
    const fRollLong = massKg * 9.81 * crr;
    const fAccelLong = massKg * (accelG * 9.81);
    const fFlatLong = fAccelLong + fRollLong + fAeroLong;

    let rollingDragAnomaly = false;
    let rollingDragDiagnostic = 'NORMAL';

    // Overrun Fuel Cut-Off (frână de motor liberă)
    if (injQtyMg < 0.5 && speedKmh > 35) {
        // În decelerare liberă pe trepte înalte, decelerația normală e -0.05G .. -0.12G
        if (accelG < -0.18) {
            rollingDragAnomaly = true;
            rollingDragDiagnostic = 'BRAKE_CALIPER_OR_BEARING_DRAG';
        }
    }

    let roadGradePct = 0;
    if (gear >= 1 && speedKmh > 15 && torqueNm > 15 && !rollingDragAnomaly) {
        const currentGearRatio = gearRatios[gear] || 1.0;
        const fDrive = (torqueNm * currentGearRatio * diffRatio * transEff) / wheelRadiusM;
        const deltaF = fDrive - fFlatLong;
        const rawGrade = (deltaF / (massKg * 9.81)) * 100;
        roadGradePct = Number(Math.max(-25, Math.min(25, rawGrade)).toFixed(1));
    }

    // ── [F4] Diagnoza Pompei de Înaltă Presiune (Common Rail) & DRV ──────────
    // Model liniar bi-variat de presiune țintă:
    // P_target = 280 + (RPM / 4000) * 380 + (injQtyMg / 50) * 740 bar
    const railPressTargetBar = Math.round(280 + (rpm / 4000) * 380 + (injQtyMg / 50) * 740);
    let railPressDevPct = 0;
    if (railPressTargetBar > 100 && railPressActualBar > 0) {
        railPressDevPct = Number((((railPressActualBar - railPressTargetBar) / railPressTargetBar) * 100).toFixed(1));
    }

    state.recentRailPressures.push(railPressActualBar);
    if (state.recentRailPressures.length > 5) state.recentRailPressures.shift();

    let railPressureStatus = 'NORMAL';
    if (rpm > 500 && rpm < 950 && speedKmh < 3 && state.recentRailPressures.length >= 4) {
        const maxP = Math.max(...state.recentRailPressures);
        const minP = Math.min(...state.recentRailPressures);
        if ((maxP - minP) > 35) {
            railPressureStatus = 'DRV_IMV_VALVE_UNSTABLE';
        }
    } else if (loadPct > 70 && rpm > 1800 && railPressActualBar > 0 && railPressActualBar < (railPressTargetBar * 0.85)) {
        railPressureStatus = 'FUEL_FILTER_OR_HP_PUMP_RESTRICTION';
    }

    // ── [F5] Exotermia Catalizator / DPF (ΔT_cat) & Regenerare DPF ───────────
    const deltaCatTempC = Number((tempCat2 - tempCat1).toFixed(1));
    let catEfficiency = 'WARMUP';
    if (tempCat1 > 220) {
        if (tempCat2 < (tempCat1 - 50)) {
            catEfficiency = 'BELOW_THRESHOLD';
        } else {
            catEfficiency = 'ACTIVE_EXOTHERMIC';
        }
    }

    const dpfRegenActive = (tempCat1 > 530) || (deltaCatTempC > 40 && tempCat2 > 450);
    const dpfRegenNotice = dpfRegenActive
        ? `🔥 Regenerare DPF în curs (${Math.round(tempCat2 || tempCat1)}°C)! Nu opri motorul încă 3 minute.`
        : null;

    // ── [F6] Baterie SoH, Rezistență Internă R_int & Diode Ripple ────────────
    if (rpm < 300 && batteryVolt >= 11.5 && batteryVolt <= 13.2) {
        state.restVolt = batteryVolt;
    }
    if (rpm > 50 && rpm < 600 && batteryVolt < state.crankMinVolt) {
        state.crankMinVolt = batteryVolt;
    }

    const tempCorrection = 1 - 0.012 * (20 - tempAmbient);
    const rIntRaw = ((state.restVolt - state.crankMinVolt) * 1000) / 300 * Math.max(0.5, tempCorrection);
    const batteryInternalResistanceMOhms = Number(Math.max(3.0, Math.min(25.0, rIntRaw)).toFixed(2));
    const batterySoHPct = Math.max(20, Math.min(100, Math.round(100 - (batteryInternalResistanceMOhms - 4.0) * 7.5)));

    // Alternator Diode Ripple Proxy (RMS pe ecartul Kalman)
    const voltDelta = ecuVolt - filteredVolt;
    state.voltDeltas.push(voltDelta * voltDelta);
    if (state.voltDeltas.length > 10) state.voltDeltas.shift();

    const meanVoltSq = state.voltDeltas.reduce((acc, v) => acc + v, 0) / state.voltDeltas.length;
    const alternatorRippleV = Number(Math.sqrt(meanVoltSq).toFixed(3));
    const alternatorDiodeFault = (alternatorRippleV > 0.35 && rpm > 1000);

    // ── [F7] Disiparea Energiei Cinetice pe Frâne (E_brake MJ) & Archard ──────
    let brakePowerKw = 0;
    if (accelG < -0.12 && speedMs > 1.0) {
        const aNetBrake = Math.abs(accelG) - 0.06; // scădem frâna de motor
        brakePowerKw = Number(((massKg * aNetBrake * 9.81 * speedMs) / 1000).toFixed(1));
    }
    const deltaEBrakeMj = (brakePowerKw * dtSec) / 1000;
    state.brakeEnergyJoulesTrip = (state.brakeEnergyJoulesTrip || 0) + deltaEBrakeMj;

    // Model termic disc de frână (convecție + căldură generată)
    const coolingRate = 0.015 * (1 + speedMs / 20);
    state.discTempC = Math.max(tempAmbient, (state.discTempC || tempAmbient) + (deltaEBrakeMj * 18) - ((state.discTempC || tempAmbient) - tempAmbient) * coolingRate);
    const estimatedBrakeDiscTempC = Math.round(state.discTempC);
    // Conform legii Archard: capacitate disipare plăcuțe set nou ~45 MJ
    const brakePadWearPctTrip = Number(((state.brakeEnergyJoulesTrip / 45.0) * 100).toFixed(3));

    // ── [F8] Recirculare EGR (EGR Mass Fraction %) & Detecție Calamină ───────
    let egrRatioPct = 0;
    let egrDiagnostic = 'NORMAL';

    if (theoreticalAirFlowGs > 2.0 && rpm > 500) {
        const expectedFreshAirGs = theoreticalAirFlowGs * 0.88; // randament volumetric nominal la admisie fără EGR
        const rawEgr = (1 - (filteredMaf / expectedFreshAirGs)) * 100;
        egrRatioPct = Number(Math.max(0, Math.min(60, rawEgr)).toFixed(1));

        if (rpm >= 1400 && rpm <= 2200 && loadPct >= 20 && loadPct <= 50) {
            if (egrRatioPct < 3.0) {
                egrDiagnostic = 'EGR_STUCK_CLOSED_OR_BLANKED';
            }
        } else if (loadPct > 75) {
            if (egrRatioPct > 15.0) {
                egrDiagnostic = 'EGR_STUCK_OPEN_CARBON';
            }
        }
    }

    state.lastTimestamp = nowTime;

    return {
        // Valori de bază
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
        mafMgPerStroke: Number(mafMgPerStroke.toFixed(1)),

        // Cei 8 Observatori Avansați (Sensor Fusion)
        // 1. BSFC
        bsfcGPerKwh,
        fuelMassFlowGPerH: Math.round(fuelMassFlowGPerH),
        engineEfficiencyPct,

        // 2. Arrhenius Oil Life
        oilLifeWearFactor: Number(fOilWear.toFixed(2)),
        oilWearKmEquivalent: Number(state.oilWearKmEquivalent.toFixed(2)),
        oilStressMultiplier,

        // 3. Pantă drum & Coast-Down Drag
        roadGradePct,
        rollingDragAnomaly,
        rollingDragDiagnostic,

        // 4. Common Rail HP Pump & DRV
        railPressTargetBar,
        railPressActualBar: Math.round(railPressActualBar),
        railPressDevPct,
        railPressureStatus,

        // 5. Exotermie & DPF Regen
        deltaCatTempC,
        catEfficiency,
        dpfRegenActive,
        dpfRegenNotice,

        // 6. Sănătate Baterie & Ripple Alternator
        batteryInternalResistanceMOhms,
        batterySoHPct,
        alternatorRippleV,
        alternatorDiodeFault,

        // 7. Frâne Archard
        brakePowerKw,
        brakeEnergyTripMj: Number(state.brakeEnergyJoulesTrip.toFixed(2)),
        estimatedBrakeDiscTempC,
        brakePadWearPctTrip,

        // 8. EGR Mass Fraction
        egrRatioPct,
        egrDiagnostic
    };
}

module.exports = {
    computeVirtualSensors,
    KalmanFilter1D,
    resetSessionState
};
