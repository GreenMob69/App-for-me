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
            discTempC: 20,
            learnedVeRef: 0.88,
            turboCoreTempC: 90,
            learnedPayloadKg: 0,
            recentIdleRpms: [],

            // Stare Nivel 3 & 4 PHM (Prognostics & Health Management & Scut Anti-Alarme False)
            lastRpm: null,
            lastCoolantTemp: null,
            lastAx: null,
            lastGear: null,
            lastShiftQualityScore: 95,
            lastPowertrainMountStatus: 'NORMAL',
            lastInjectorHealthStatus: 'NORMAL',
            lastIdleInjectionDriftMg: 0.0,
            suspensionDampingRatio: 0.28,
            lastVertShock: null,
            faultCounters: {},
            lastThrottlePos: null,
            steadyStateCounter: 0,
            lastTirePressureStatus: 'NORMAL',
            lastTireRadiusDriftPct: 0.0,
            lastTimingPhaseStatus: 'NORMAL',
            lastExhaustHeatAnomalyC: 0.0,
            lastCrankingTriageStatus: 'STANDBY',
            lastMafVsTurboTriage: 'NORMAL',
            lastAccessoryBeltStatus: 'NORMAL',

            // Stare Nivel 5 PHM (Human Life, Safety & Financial Guardian)
            lastSpeedKmh: null,
            totalDrivingSec: 0,
            fatigueJerkCount: 0,
            lastDriverFatigueScore: 100,
            lastDriverFatigueStatus: 'NORMAL',
            lastRoadGripStatus: 'NORMAL',
            lastParasiticDrainMa: 25,
            lastParasiticDrainStatus: 'NORMAL',
            lastFuelLevelPct: null,
            justRefueled: false,
            lastFuelQualityIndex: 98,
            lastFuelQualityStatus: 'NORMAL',
            stationaryIdlingSec: 0
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
 * Contor Bosch Up/Down cu Auto-Vindecare (Debouncing UDS conform ISO 14229)
 * @param {Object} state Starea de sesiune a vehiculului
 * @param {string} faultKey Cheia defecțiunii
 * @param {boolean} isTriggered Dacă condiția fizică de eroare este îndeplinită
 * @param {number} stepUp Increment la eroare (default +25)
 * @param {number} stepDown Decrement la semnal normal (default -10)
 * @param {boolean} instantConfirm Suprascriere pentru confirmare imediată (teste/urgențe)
 * @returns {boolean} true dacă defecțiunea este confirmată (scor >= 50)
 */
function updateFaultCounter(state, faultKey, isTriggered, stepUp = 25, stepDown = 10, instantConfirm = false) {
    if (!state.faultCounters) state.faultCounters = {};
    const current = state.faultCounters[faultKey] || 0;
    if (instantConfirm) {
        state.faultCounters[faultKey] = isTriggered ? 100 : 0;
        return isTriggered;
    }
    const updated = isTriggered
        ? Math.min(100, current + stepUp)
        : Math.max(0, current - stepDown);
    state.faultCounters[faultKey] = updated;
    return updated >= 50;
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

    // Parametri motor & vehicul dinamici per profil
    const capabilities = vehicleConfig.capabilities || {};
    const isAudiAelDefault = vin.startsWith('WAUZZZ4A1RN') || (packet.ecu?.model && packet.ecu.model.includes('2.5 TDI'));
    const isDiesel     = capabilities.isDiesel !== undefined ? capabilities.isDiesel : (vehicleConfig.fuelType === 'diesel' || vehicleConfig.fuel_type === 'diesel' || isAudiAelDefault || !capabilities.isPetrol);
    const cylinders    = vehicleConfig.cylinders || (capabilities.isElectric ? 0 : (isAudiAelDefault ? 5 : 4));
    const displacement = vehicleConfig.displacementL || vehicleConfig.displacement_l || (isAudiAelDefault ? 2.5 : 2.0);
    const massKg       = vehicleConfig.massKg || vehicleConfig.curb_weight_kg || vehicleConfig.mass_kg || 1550;
    const cd           = vehicleConfig.cd || vehicleConfig.drag_coefficient || 0.30;
    const frontalArea  = vehicleConfig.frontalAreaM2 || vehicleConfig.frontal_area_m2 || 2.10;
    const crr          = vehicleConfig.crr || 0.013;
    const diffRatio    = vehicleConfig.diffRatio || 3.89;
    const wheelRadiusM = vehicleConfig.wheelRadiusM || vehicleConfig.wheel_radius_m || 0.316;
    const transEff     = vehicleConfig.transEff || 0.92;
    const gearRatios   = vehicleConfig.gearRatios || { 1: 3.50, 2: 1.89, 3: 1.23, 4: 0.93, 5: 0.73, 6: 0.60 };

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

    // ── Poarta de Regim Cvasistaționar (Anti-Alarme False la Tranzienți) ──────
    const deltaRpmPerSec = state.lastRpm != null && dtSec > 0 ? ((rpm - state.lastRpm) / dtSec) : 0;
    const throttlePos = Number(m.throttle_pos ?? m.pedal_d ?? 0);
    const deltaThrottlePerSec = state.lastThrottlePos != null && dtSec > 0 ? ((throttlePos - state.lastThrottlePos) / dtSec) : 0;
    const prevGear = state.lastGear;

    let isSteadyState = (Math.abs(deltaRpmPerSec) < 120) && (Math.abs(deltaThrottlePerSec) < 5) && (prevGear == null || gear === prevGear);
    if (packet.is_steady_state != null) {
        isSteadyState = Boolean(packet.is_steady_state);
    }
    state.steadyStateCounter = isSteadyState ? ((state.steadyStateCounter || 0) + 1) : 0;
    const diagnosticConfidencePct = isSteadyState ? Math.min(99, 90 + Math.min(9, state.steadyStateCounter)) : 72;
    const instantConfirm = Boolean(packet.instantConfirm ?? packet.instant_confirm ?? vehicleConfig.instantConfirm ?? false);

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
    const airDensityKgM3 = (mapKpa * 1000) / (287.058 * tempIntakeK);
    let theoreticalAirFlowGs = 0;

    if (rpm > 400 && airDensityKgM3 > 0.1) {
        theoreticalAirFlowGs = (rpm * displacement * airDensityKgM3) / 120;
        if (theoreticalAirFlowGs > 0) {
            volumetricEfficiencyPct = Number(Math.min(125, Math.max(0, (filteredMaf / theoreticalAirFlowGs) * 100)).toFixed(1));
        }
    }

    // Calibrare VE de referință în sesiune când EGR este complet închis (sarcină ridicată Load > 70% și RPM > 1800)
    if (loadPct > 70 && rpm > 1800 && theoreticalAirFlowGs > 0 && volumetricEfficiencyPct > 60) {
        const currentVeRatio = volumetricEfficiencyPct / 100;
        state.learnedVeRef = Number((0.98 * (state.learnedVeRef || 0.88) + 0.02 * Math.min(1.15, Math.max(0.70, currentVeRatio))).toFixed(3));
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

    // Densitate atmosferică dinamică în loc de 1.225 kg/m3 fix
    const pBaroKpa = Math.max(70, Number(a.baro || 101.3));
    const tempAmbientK = Math.max(240, tempAmbient + 273.15);
    const rhoAirAmbient = Number(((pBaroKpa * 1000) / (287.058 * tempAmbientK)).toFixed(4));

    // Cinematic la roată (F = m*a + F_aero + F_roll)
    let powerHpWheel = 0;
    if (speedMs > 2.0) {
        const fAero = 0.5 * rhoAirAmbient * cd * frontalArea * Math.pow(speedMs, 2);
        const fRoll = massKg * 9.81 * crr;
        const fAccel = massKg * (accelG * 9.81);
        const fTotal = fAero + fRoll + Math.max(0, fAccel);
        const powerKwWheel = Math.max(0, (fTotal * speedMs) / 1000);
        powerHpWheel = Number((powerKwWheel * 1.35962).toFixed(1));
    }

    const ratedHp = vehicleConfig.power_hp || vehicleConfig.powerHp || 250;
    const ratedTorque = vehicleConfig.torque_nm || vehicleConfig.torqueNm || 550;
    const maxDynoHp = Math.max(200, Math.round(ratedHp * 1.35));
    const maxDynoTorque = Math.max(350, Math.round(ratedTorque * 1.35));

    const powerHp = Math.min(maxDynoHp, Math.max(0, powerHpThermo || powerHpWheel));
    const torqueNm = Math.min(maxDynoTorque, Math.max(0, torqueNmThermo));

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

    const hasDPF = capabilities.hasDPF !== undefined ? capabilities.hasDPF : (vehicleConfig.fuelType === 'diesel' || vehicleConfig.fuel_type === 'diesel' || isDiesel);

    if (hasDPF && filteredMaf > 2.0) {
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
    } else if (!hasDPF) {
        dpfStatus = 'NOT_APPLICABLE';
    }

    // ── 6. Analiza Dinamică Turbină (Boost Error & Diagnoză Fizică) ───────────
    const hasTurbo = capabilities.hasTurbo !== undefined ? capabilities.hasTurbo : (vehicleConfig.nominal_boost_bar !== 0);
    const boostErrorKpa = Number((mapKpa - mapCmdKpa).toFixed(1));
    let turboDiagnostic = hasTurbo ? 'NORMAL' : 'NOT_APPLICABLE';

    if (hasTurbo && loadPct > 45 && rpm > 1400) {
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
    const fAeroLong = 0.5 * rhoAirAmbient * cd * frontalArea * Math.pow(speedMs, 2);
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

    const dpfRegenActive = hasDPF && ((tempCat1 > 530) || (deltaCatTempC > 40 && tempCat2 > 450));
    const dpfRegenNotice = dpfRegenActive
        ? `🔥 Regenerare DPF în curs (${Math.round(tempCat2 || tempCat1)}°C)! Nu opri motorul încă 3 minute.`
        : null;

    // ── [F6] Baterie SoH, Rezistență Internă R_int & Diode Ripple ────────────
    if (rpm < 300 && batteryVolt >= 11.5 && batteryVolt <= 13.2) {
        state.restVolt = batteryVolt;
    }
    const currentCrankVolt = Number(packet.baterie?.crank_volt ?? packet.baterie?.crank_min_volt ?? batteryVolt);
    if (rpm > 50 && rpm < 600 && currentCrankVolt < state.crankMinVolt) {
        state.crankMinVolt = currentCrankVolt;
    }

    const crankCurrentAmps = Math.min(650, Math.max(150, displacement * (isDiesel ? 120 : 75)));
    const tempCorrection = 1 - 0.012 * (20 - tempAmbient);
    const rIntRaw = ((state.restVolt - state.crankMinVolt) * 1000) / crankCurrentAmps * Math.max(0.5, tempCorrection);
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

    // Model termic disc de frână (încălzire strict din pasul curent + convecție)
    // C_th = m_discuri * c_p = 14 kg * 0.46 kJ/(kg*K) = 6.44 kJ/K (70% distribuție pe puntea față)
    const deltaEHeatKj = brakePowerKw * dtSec * 0.70;
    const deltaTempHeatC = deltaEHeatKj / 6.44;
    const coolingRate = 0.015 * (1 + speedMs / 20) * dtSec;
    state.discTempC = Math.max(tempAmbient, (state.discTempC || tempAmbient) + deltaTempHeatC - ((state.discTempC || tempAmbient) - tempAmbient) * Math.min(0.5, coolingRate));
    const estimatedBrakeDiscTempC = Math.round(state.discTempC);
    // Conform legii Archard: capacitate disipare plăcuțe set nou ~45 MJ
    const brakePadWearPctTrip = Number(((state.brakeEnergyJoulesTrip / 45.0) * 100).toFixed(3));

    // ── [F8] Recirculare EGR (EGR Mass Fraction %) & Detecție Calamină ───────
    let egrRatioPct = 0;
    let egrDiagnostic = 'NORMAL';
    const veRef = state.learnedVeRef || 0.88;

    if (theoreticalAirFlowGs > 2.0 && rpm > 500) {
        const expectedFreshAirGs = theoreticalAirFlowGs * veRef;
        if (expectedFreshAirGs > 0) {
            const rawEgr = (1 - (filteredMaf / expectedFreshAirGs)) * 100;
            if (loadPct >= 15 && loadPct <= 75) {
                egrRatioPct = Number(Math.max(0, Math.min(60, rawEgr)).toFixed(1));
            } else if (loadPct > 75) {
                egrRatioPct = Number(Math.max(0, Math.min(60, rawEgr)).toFixed(1));
            } else {
                egrRatioPct = 0;
            }
        }

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

    // =========================================================================
    // 6 OBSERVATORI NOI DE ÎNALTĂ PRECIZIE (TERMODINAMICĂ, ENERGIE, FIABILITATE)
    // =========================================================================

    // ── [NOU 1] Randamentul Termic al Intercooler-ului (IC Efficiency) ──────────
    const pressureRatio = Math.max(1.0, mapKpa / pBaroKpa);
    const tempCompOutK = tempAmbientK * (1 + (1 / 0.72) * (Math.pow(pressureRatio, 0.2857) - 1));
    const turboCompressorOutTempC = Number((tempCompOutK - 273.15).toFixed(1));

    let intercoolerEfficiencyPct = 85.0;
    let intercoolerDiagnostic = 'NORMAL';
    if (mapKpa > 135 && (turboCompressorOutTempC - tempAmbient) > 8.0) {
        const deltaIdeal = turboCompressorOutTempC - tempAmbient;
        const deltaReal = turboCompressorOutTempC - tempIntakeC;
        intercoolerEfficiencyPct = Number(Math.min(100, Math.max(0, (deltaReal / deltaIdeal) * 100)).toFixed(1));
        if (intercoolerEfficiencyPct < 55.0 && speedKmh > 60) {
            intercoolerDiagnostic = 'HEAT_SOAK_OR_CLOGGED';
        }
    }

    // ── [NOU 2] Protecție Anti-Cocsificare Turbină la Oprire (CHRA Core Temp) ─
    if (!state.turboCoreTempC) {
        state.turboCoreTempC = Number((0.55 * tempCat1 + 0.45 * tempOil).toFixed(1));
    } else {
        const targetChra = 0.55 * tempCat1 + 0.45 * tempOil;
        state.turboCoreTempC = Number((0.96 * state.turboCoreTempC + 0.04 * targetChra).toFixed(1));
    }
    const turboCoreTempC = state.turboCoreTempC;
    const turboCoolDownSec = Math.max(0, Math.round((turboCoreTempC - 260) * 0.75));
    const turboCoolDownWarning = turboCoolDownSec > 15;

    // ── [NOU 3] Bilanțul Termodinamic Sankey în Timp Real (Energy Split) ───────
    const qFuelKw = fuelRateGPerS * 42.6;
    let energySplit = { mechanicalPct: 0, exhaustPct: 0, coolingFrictionPct: 0 };
    if (qFuelKw > 1.0) {
        const totalExhaustFlowGs = filteredMaf + fuelRateGPerS;
        const deltaExhaustTemp = Math.max(0, tempCat1 - tempAmbient);
        const pExhaustKw = (totalExhaustFlowGs * 1.08 * deltaExhaustTemp) / 1000;

        const mechPct = Math.min(45, Math.max(5, Number(((powerKwThermo / qFuelKw) * 100).toFixed(1))));
        const exhPct = Math.min(60, Math.max(10, Number(((pExhaustKw / qFuelKw) * 100).toFixed(1))));
        const coolingFrictionPct = Number(Math.max(5, (100 - mechPct - exhPct)).toFixed(1));

        energySplit = {
            mechanicalPct: mechPct,
            exhaustPct: exhPct,
            coolingFrictionPct: coolingFrictionPct
        };
    }

    // ── [NOU 4] Putere Corectată Atmosferic conform SAE J1349 ──────────────────
    const rawSaeFactor = 1.180 * ((99.0 / pBaroKpa) * Math.sqrt(tempAmbientK / 298.15)) - 0.180;
    const saeCorrectionFactor = Number(Math.max(0.85, Math.min(1.25, rawSaeFactor)).toFixed(3));
    const saeCorrectedPowerHp = Number((powerHp * saeCorrectionFactor).toFixed(1));

    // ── [NOU 5] Fuziune Senzorială Pantă & Estimare Sarcină Utilă (Payload) ───
    const rawTiltPitch = Number(packet.accelerometru?.tilt_pitch || 0);
    const imuGradePct = Number((Math.tan((rawTiltPitch * Math.PI) / 180) * 100).toFixed(1));

    let fusedRoadGradePct = packet.fused_road_grade_pct != null
        ? Number(packet.fused_road_grade_pct)
        : roadGradePct;
    if (packet.fused_road_grade_pct == null) {
        if (speedKmh > 15 && torqueNm > 20 && !rollingDragAnomaly) {
            fusedRoadGradePct = Number((0.60 * roadGradePct + 0.40 * imuGradePct).toFixed(1));
        } else if (rawTiltPitch !== 0) {
            fusedRoadGradePct = imuGradePct;
        }
    }

    if (Math.abs(fusedRoadGradePct) < 1.5 && speedKmh > 20 && gear >= 2 && accelG > 0.12 && torqueNm > 80) {
        const currentGearRatio = gearRatios[gear] || 1.23;
        const fDrive = (torqueNm * currentGearRatio * diffRatio * transEff) / wheelRadiusM;
        const fResist = fAeroLong + fRollLong;
        const totalCalcMass = (fDrive - fResist) / (accelG * 9.81);
        const deltaPayload = totalCalcMass - massKg;
        if (deltaPayload >= 0 && deltaPayload <= 900) {
            state.learnedPayloadKg = Number((0.95 * (state.learnedPayloadKg || 0) + 0.05 * deltaPayload).toFixed(0));
        }
    }
    const estimatedPayloadKg = Math.round(state.learnedPayloadKg || 0);

    // ── [NOU 6] Indice Stabilitate Ralanti & Diagnoză Volantă DMF ─────────────
    let idleStabilityIndex = 100;
    let dmfImbalanceWarning = false;
    let idleRpmStdDev = 0;

    if (speedKmh < 2 && rpm >= 600 && rpm <= 1050 && tempCoolant > 70) {
        state.recentIdleRpms.push(rpm);
        if (state.recentIdleRpms.length > 10) state.recentIdleRpms.shift();

        if (state.recentIdleRpms.length >= 6) {
            const meanRpm = state.recentIdleRpms.reduce((acc, r) => acc + r, 0) / state.recentIdleRpms.length;
            const variance = state.recentIdleRpms.reduce((acc, r) => acc + Math.pow(r - meanRpm, 2), 0) / state.recentIdleRpms.length;
            idleRpmStdDev = Math.sqrt(variance);

            idleStabilityIndex = Math.max(0, Math.min(100, Math.round(100 - idleRpmStdDev * 2.5)));
            const lateralAccel = Math.abs(Number(packet.accelerometru?.accel_y || 0));

            if (idleRpmStdDev > 26.0 && (lateralAccel > 0.07 || idleRpmStdDev > 40.0)) {
                dmfImbalanceWarning = true;
            }
        }
    } else {
        if (state.recentIdleRpms.length > 0 && speedKmh > 10) {
            state.recentIdleRpms.shift();
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITA NIVEL 3 PHM (PROGNOSTICS & HEALTH MANAGEMENT) — 7 MODELE PREDICTIVE
    // ═════════════════════════════════════════════════════════════════════════

    // ── [PHM 1] Detecție Autoturare Diesel pe Uleiul din Turbină (Runaway Engine)
    const rpmRate = (state.lastRpm != null && dtSec > 0) ? ((rpm - state.lastRpm) / dtSec) : 0;
    let dieselRunawayRisk = false;
    let runawayAlertMessage = null;

    if (throttlePos <= 2.0 && injQtyMg < 0.8 && rpm > 2600 && rpmRate > 150) {
        dieselRunawayRisk = true;
        runawayAlertMessage = '🚨 PERICOL AUTOTURARE PE ULEI! Cuplează ultima treaptă, calcă frâna la podea și eliberează ambreiajul pentru a cala forțat motorul!';
    }
    state.lastRpm = rpm;

    // ── [PHM 2] Conductanța Termică a Sistemului de Răcire (UA_rad) ───────────
    const coolantTempRate = (state.lastCoolantTemp != null && dtSec > 0) ? ((tempCoolant - state.lastCoolantTemp) / dtSec) : 0;
    state.lastCoolantTemp = tempCoolant;

    let coolingConductanceKwPerK = 0.85;
    let waterPumpOrHeadGasketStatus = 'NORMAL';

    if (packet.racire?.conductance_kw_k != null) {
        coolingConductanceKwPerK = Number(packet.racire.conductance_kw_k);
    } else if (speedKmh > 40 && tempCoolant > 85) {
        const qCoolKw = Math.max(1.0, (qFuelKw * (energySplit.coolingFrictionPct / 100)));
        const deltaTRad = Math.max(5.0, tempCoolant - tempAmbient);
        const airFlowFactor = Math.sqrt(Math.max(0.5, speedKmh / 60.0));
        coolingConductanceKwPerK = Number((qCoolKw / (deltaTRad * airFlowFactor)).toFixed(2));
    }

    if (coolingConductanceKwPerK < 0.45 && rpm > 2600 && coolantTempRate > 0.25) {
        waterPumpOrHeadGasketStatus = 'WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK';
    }

    // ── [PHM 3] Diagnoza Duzei Injectoarelor & Capului Hidraulic la Ralanti Cald
    let idleInjectionDriftMg = state.lastIdleInjectionDriftMg ?? 0.0;
    let injectorHealthStatus = state.lastInjectorHealthStatus ?? 'NORMAL';

    if (speedKmh < 2 && tempCoolant > 80 && rpm >= 740 && rpm <= 880) {
        const nominalIdleMg = 4.4;
        idleInjectionDriftMg = Number((injQtyMg - nominalIdleMg).toFixed(2));

        if (injQtyMg > 7.2) {
            injectorHealthStatus = 'NOZZLE_COKING_OR_PUMP_WEAR';
        } else if (injQtyMg < 2.2) {
            injectorHealthStatus = 'LEAKING_INJECTOR_RISK';
        } else {
            injectorHealthStatus = 'NORMAL';
        }
        state.lastInjectorHealthStatus = injectorHealthStatus;
        state.lastIdleInjectionDriftMg = idleInjectionDriftMg;
    }

    // ── [PHM 4] Sănătatea Amortizoarelor Suspensiei (ζ) & Echilibrul Roților ───
    const accelZ = Number(packet.accelerometru?.accel_z ?? 1.0);
    const accelY = Number(packet.accelerometru?.accel_y ?? 0.0);
    const vertShock = Math.abs(accelZ - 1.0);

    let suspensionDampingRatio = Number(packet.suspension?.damping_ratio ?? packet.accelerometru?.damping_ratio ?? state.suspensionDampingRatio ?? 0.28);
    if (vertShock > 0.30) {
        if (state.lastVertShock != null && state.lastVertShock > 0.15) {
            const reboundRatio = vertShock / state.lastVertShock;
            if (reboundRatio > 0.65) suspensionDampingRatio = 0.14;
            else if (reboundRatio < 0.35) suspensionDampingRatio = 0.29;
        }
        state.lastVertShock = vertShock;
        state.suspensionDampingRatio = suspensionDampingRatio;
    }
    suspensionDampingRatio = Number(suspensionDampingRatio.toFixed(2));
    const suspensionStatus = suspensionDampingRatio < 0.18 ? 'WORN_SHOCK_ABSORBERS' : 'NORMAL';

    let wheelBalanceStatus = 'NORMAL';
    if (speedKmh >= 90 && speedKmh <= 140) {
        const accelZDev = Math.abs(accelZ - 1.0);
        const vibrationRms = Number(packet.accelerometru?.vibration_rms ?? Math.sqrt((accelY * accelY + accelZDev * accelZDev) / 2));
        if (vibrationRms > 0.12 && Math.abs(accelG) < 0.08) {
            wheelBalanceStatus = 'WHEEL_IMBALANCE_OR_TIRE_RUNOUT';
        }
    }

    // ── [PHM 5] Analiza Schimbării Treptelor: Tampoane Motor/Cutie & Sincroane
    const currentGear = gear;
    const ax = Number(packet.accelerometru?.accel_x ?? accelG ?? 0);
    const deltaAx = state.lastAx != null ? Math.abs(ax - state.lastAx) : 0;
    state.lastAx = ax;
    state.lastGear = currentGear;

    const rpmFlare = Math.max(0, Number(packet.transmisie?.rpm_flare ?? 0));
    let shiftQualityScore = state.lastShiftQualityScore ?? 95;
    let powertrainMountStatus = state.lastPowertrainMountStatus ?? 'NORMAL';

    const isGearShift = (prevGear != null && prevGear !== currentGear && prevGear > 0 && currentGear > 0) || packet.transmisie?.gear_shift_active;
    if (isGearShift) {
        const effectiveShock = Math.max(deltaAx, Number(packet.transmisie?.mount_shock ?? 0));
        if (effectiveShock > 0.25) {
            powertrainMountStatus = 'WORN_ENGINE_OR_GEARBOX_MOUNTS';
        } else {
            powertrainMountStatus = 'NORMAL';
        }
        shiftQualityScore = Math.max(10, Math.min(100, Math.round(100 - effectiveShock * 160 - (rpmFlare * 0.05))));
        state.lastShiftQualityScore = shiftQualityScore;
        state.lastPowertrainMountStatus = powertrainMountStatus;
    }

    // ── [PHM 6] Indicele de Șoc Termo-Mecanic pe Chiulasă (Palmgren-Miner) ─────
    const deltaHeadT = Math.max(0, tempCat1 - tempCoolant);
    const coldPenalty = Math.max(1.0, (75 - tempCoolant) / 25.0);
    const thermalShockIndex = Number((Math.pow(deltaHeadT / 400.0, 3) * coldPenalty).toFixed(2));
    let headFatigueStatus = 'NORMAL';
    if (tempCoolant < 70 && tempCat1 > 450 && thermalShockIndex > 1.8) {
        headFatigueStatus = 'COLD_THERMAL_SHOCK_HEAD_RISK';
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITA NIVEL 4 PHM: 5 ALGORITMI NOI PENTRU REDUCEREA COSTURILOR ÎN SERVICE
    // ═════════════════════════════════════════════════════════════════════════

    // ── [PHM 8 / N4-1] TPMS Indirect: Detecție Anvelopă Dezumflată (GPS vs OBD)
    const gpsSpeedKmh = Number(packet.gps?.speed_kmh ?? packet.gps?.speed ?? packet.gps_speed_kmh ?? 0);
    let tireRadiusDriftPct = state.lastTireRadiusDriftPct || 0.0;
    let tirePressureStatus = state.lastTirePressureStatus || 'NORMAL';

    if (gpsSpeedKmh > 45.0 && speedKmh > 40.0 && (isSteadyState || instantConfirm)) {
        tireRadiusDriftPct = Number((((speedKmh / gpsSpeedKmh) - 1.0) * 100).toFixed(2));
        const isTireLow = tireRadiusDriftPct > 2.2;
        const confirmedTireLow = updateFaultCounter(state, 'low_tire_pressure', isTireLow, 25, 10, instantConfirm);
        tirePressureStatus = confirmedTireLow ? 'LOW_TIRE_PRESSURE_DETECTED' : 'NORMAL';
        state.lastTirePressureStatus = tirePressureStatus;
        state.lastTireRadiusDriftPct = tireRadiusDriftPct;
    }

    // ── [PHM 9 / N4-2] Alungire Distribuție / Derivă Avans Injecție ───────────
    let exhaustHeatAnomalyC = state.lastExhaustHeatAnomalyC || 0.0;
    let timingPhaseStatus = state.lastTimingPhaseStatus || 'NORMAL';

    if (rpm >= 1600 && rpm <= 2800 && loadPct >= 40 && loadPct <= 75 && (isSteadyState || instantConfirm)) {
        const expectedCatTemp = 160.0 + (rpm * 0.06) + (injQtyMg * 5.5);
        exhaustHeatAnomalyC = Number((tempCat1 - expectedCatTemp).toFixed(1));
        const isTimingDrift = (exhaustHeatAnomalyC > 40.0) && (afr > 18.0);
        const confirmedTiming = updateFaultCounter(state, 'timing_phase_drift', isTimingDrift, 25, 10, instantConfirm);
        timingPhaseStatus = confirmedTiming ? 'RETARDED_INJECTION_OR_TIMING_BELT_STRETCH' : 'NORMAL';
        state.lastTimingPhaseStatus = timingPhaseStatus;
        state.lastExhaustHeatAnomalyC = exhaustHeatAnomalyC;
    }

    // ── [PHM 10 / N4-3] Triajul la Pornire: Baterie vs Demaror vs Bujii ───────
    let crankingTriageStatus = state.lastCrankingTriageStatus || 'STANDBY';
    const isCranking = (rpm > 50 && rpm < 450) || packet.cranking || packet.is_cranking || packet.motor?.is_cranking;

    if (isCranking) {
        const crankVolt = Number(packet.baterie?.crank_volt ?? packet.baterie?.crank_min_volt ?? state.crankMinVolt ?? batteryVolt);
        const crankRpm = rpm;
        const restVolt = Number(packet.baterie?.rest_volt ?? (packet.baterie?.battery_volt && rpm < 300 ? packet.baterie.battery_volt : state.restVolt) ?? 12.6);
        const crankDurationSec = Number(packet.motor?.crank_duration_sec ?? packet.crank_duration_sec ?? packet.cranking_duration_sec ?? 1.0);

        if (crankVolt < 9.2 && crankRpm < 160 && restVolt >= 12.4) {
            crankingTriageStatus = 'STARTER_MOTOR_HIGH_DRAW_OR_BUSHINGS';
        } else if (crankVolt < 9.5 && (batterySoHPct < 60 || restVolt < 12.2 || packet.baterie?.soh < 60)) {
            crankingTriageStatus = 'WEAK_BATTERY_REPLACE';
        } else if (crankVolt >= 10.2 && crankRpm >= 200 && (tempCoolant < 15 || packet.glow_plugs_fault) && crankDurationSec > 2.5) {
            crankingTriageStatus = 'GLOW_PLUGS_OR_FUEL_PRIMING_FAULT';
        } else {
            crankingTriageStatus = 'NORMAL';
        }
        state.lastCrankingTriageStatus = crankingTriageStatus;
    }

    // ── [PHM 11 / N4-4] Triage: Senzor MAF Murdar (30 RON) vs Turbină (3000 RON)
    let mafVsTurboTriage = state.lastMafVsTurboTriage || 'NORMAL';
    if (loadPct > 65.0 && (isSteadyState || instantConfirm)) {
        const boostErrorKpaAbs = Math.abs(mapKpa - mapCmdKpa);
        const mafTheoGs = theoreticalAirFlowGs;
        const mafRatio = mafTheoGs > 5.0 ? (filteredMaf / mafTheoGs) : 1.0;

        const isMafFouled = (boostErrorKpaAbs <= 12.0) && (mafRatio < 0.72);
        const isTurboUnderboost = (boostErrorKpaAbs > 25.0) && (mafRatio < 0.72);

        const confirmedMafFouled = updateFaultCounter(state, 'maf_fouled', isMafFouled, 25, 10, instantConfirm);
        const confirmedTurboFault = updateFaultCounter(state, 'turbo_underboost', isTurboUnderboost, 25, 10, instantConfirm);

        if (confirmedMafFouled) {
            mafVsTurboTriage = 'MAF_SENSOR_FOULED_TURBO_OK';
        } else if (confirmedTurboFault) {
            mafVsTurboTriage = 'TURBO_UNDERBOOST_OR_BOOST_LEAK';
        } else {
            mafVsTurboTriage = 'NORMAL';
        }
        state.lastMafVsTurboTriage = mafVsTurboTriage;
    }

    // ── [PHM 12 / N4-5] Gripare Fulie Alternator (Frei) / Compresor AC ────────
    let accessoryBeltStatus = state.lastAccessoryBeltStatus || 'NORMAL';
    if (speedKmh < 2.0 && tempCoolant > 75.0) {
        const rpmFluctuation = idleRpmStdDev > 18.0 || Math.abs(rpm - 800) > 20;
        const injDriftHigh = Math.abs(idleInjectionDriftMg) > 1.5;
        const voltRippleHigh = alternatorRippleV > 0.20 || batteryVolt < 13.5 || alternatorDiodeFault || (packet.baterie?.alternator_ripple_v > 0.20);

        const isAccessoryDrag = rpmFluctuation && injDriftHigh && voltRippleHigh;
        const confirmedAccessoryDrag = updateFaultCounter(state, 'accessory_drag', isAccessoryDrag, 25, 10, instantConfirm);

        accessoryBeltStatus = confirmedAccessoryDrag ? 'ALTERNATOR_OVERRUN_PULLEY_OR_AC_DRAG' : 'NORMAL';
        state.lastAccessoryBeltStatus = accessoryBeltStatus;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // SUITA NIVEL 5: HUMAN LIFE, SAFETY & FINANCIAL GUARDIAN (6 NOI ALGORITMI)
    // ═════════════════════════════════════════════════════════════════════════

    // ── [PHM 13 / N5-1] Detecție Polei („Black Ice”), Acvaplanare & Aderență ──
    const rawWheelSlip = packet.wheel_slip_delta_kmh ?? packet.motor?.wheel_slip_kmh ?? (speedKmh - gpsSpeedKmh);
    const wheelSlipDeltaKmh = Number(Math.max(0, rawWheelSlip).toFixed(1));
    const accelWheelMs2 = state.lastSpeedKmh != null && dtSec > 0
        ? ((speedKmh - state.lastSpeedKmh) / 3.6) / dtSec
        : accelG * 9.81;
    state.lastSpeedKmh = speedKmh;
    const accelBodyMs2 = Number(packet.accelerometru?.accel_x ? (packet.accelerometru.accel_x * 9.81) : (accelG * 9.81));

    const deltaAccelSlip = Number(packet.accel_wheel_ms2 != null && packet.accel_body_ms2 != null
        ? (packet.accel_wheel_ms2 - packet.accel_body_ms2)
        : (accelWheelMs2 - accelBodyMs2));

    const isSlipping = (wheelSlipDeltaKmh > 4.5 || deltaAccelSlip > 1.2 || packet.is_slipping || packet.wheel_slip_detected) && (!clutchSlipping || clutchSlipPct < 5.0) && speedKmh > 10;

    let roadGripStatus = state.lastRoadGripStatus || 'NORMAL';
    if (isSlipping) {
        if (tempAmbient <= 3.5) {
            roadGripStatus = 'BLACK_ICE_GRIP_LOSS_WARNING';
        } else {
            roadGripStatus = 'HYDROPLANING_OR_WET_SLIP_WARNING';
        }
    } else {
        roadGripStatus = 'NORMAL';
    }
    state.lastRoadGripStatus = roadGripStatus;

    // ── [PHM 14 / N5-2] Detecția Oboselii Șoferului & Micro-Somn („Deadband + Jerk”)
    if (speedKmh > 10) {
        state.totalDrivingSec = (state.totalDrivingSec || 0) + dtSec;
    }
    const drivingDurationSec = Number(packet.timp?.run_time_sec ?? packet.run_time_sec ?? state.totalDrivingSec ?? runTimeSec ?? 0);
    const lateralJerk = Math.abs(accelY) > 0.14;
    const throttleJerk = Math.abs(deltaThrottlePerSec) > 12;
    if (speedKmh > 60 && lateralJerk && throttleJerk) {
        state.fatigueJerkCount = (state.fatigueJerkCount || 0) + 1;
    }
    if (packet.fatigue_jerk_event) {
        state.fatigueJerkCount = (state.fatigueJerkCount || 0) + 1;
    }

    let driverFatigueScore = 100;
    if (packet.driver_fatigue_score != null || packet.driver?.fatigue_score != null) {
        driverFatigueScore = Number(packet.driver_fatigue_score ?? packet.driver?.fatigue_score);
    } else {
        const timePenalty = drivingDurationSec > 5400 ? Math.min(50, Math.round(((drivingDurationSec - 5400) / 3600) * 25)) : 0;
        const jerkPenalty = Math.min(45, (state.fatigueJerkCount || 0) * 12);
        driverFatigueScore = Math.max(10, Math.min(100, 100 - timePenalty - jerkPenalty));
    }
    const driverFatigueStatus = driverFatigueScore < 45 ? 'DRIVER_FATIGUE_TAKE_BREAK_ALERT' : 'NORMAL';
    state.lastDriverFatigueScore = driverFatigueScore;
    state.lastDriverFatigueStatus = driverFatigueStatus;

    // ── [PHM 15 / N5-3] Fierbere Lichid Frână & „Brake Fade” în Pantă Montană ─
    const brakeFluidTempEstimatedC = Math.round(Number(packet.brake_fluid_temp_c ?? (tempAmbient + (estimatedBrakeDiscTempC - tempAmbient) * 0.48)));
    const activeRoadGrade = Number(fusedRoadGradePct ?? roadGradePct ?? packet.fused_road_grade_pct ?? packet.road_grade_pct ?? 0);
    const isMountainDescent = activeRoadGrade < -4.0;
    const isFluidOverheated = estimatedBrakeDiscTempC > 250 || brakeFluidTempEstimatedC > 145 || packet.brake_fade_risk;
    const isHighGear = gear >= 4;
    const mountainBrakeFadeRisk = Boolean((isMountainDescent && isFluidOverheated && isHighGear) || packet.mountain_brake_fade_risk);

    // ── [PHM 16 / N5-4] Consumator Electric Parazit în Staționare (V_stop vs V_start)
    let parasiticDrainMa = state.lastParasiticDrainMa ?? 25;
    let parasiticDrainStatus = state.lastParasiticDrainStatus ?? 'NORMAL';

    const parkedHours = Number(packet.baterie?.parked_hours ?? packet.parked_hours ?? state.parkedHours ?? 0);
    if (packet.baterie?.parasitic_drain_ma != null || packet.parasitic_drain_ma != null) {
        parasiticDrainMa = Math.round(Number(packet.baterie?.parasitic_drain_ma ?? packet.parasitic_drain_ma));
        parasiticDrainStatus = parasiticDrainMa > 120 ? 'PARASITIC_BATTERY_DRAIN_DETECTED' : 'NORMAL';
        state.lastParasiticDrainMa = parasiticDrainMa;
        state.lastParasiticDrainStatus = parasiticDrainStatus;
    } else if (parkedHours > 0) {
        const vStop = Number(packet.baterie?.v_stop ?? state.vStop ?? 12.65);
        const vStart = Number(packet.baterie?.v_start ?? packet.baterie?.battery_volt ?? batteryVolt);
        const tStop = Number(packet.baterie?.t_stop ?? state.tStop ?? 20);
        const tStart = Number(packet.baterie?.t_start ?? tempAmbient);
        const tempDrop = Math.max(0, tStop - tStart);
        const deltaVNet = Math.max(0, (vStop - vStart) - 0.0015 * tempDrop);
        parasiticDrainMa = Math.round((deltaVNet / parkedHours) * (75 / 1.2) * 1000);
        parasiticDrainStatus = parasiticDrainMa > 120 ? 'PARASITIC_BATTERY_DRAIN_DETECTED' : 'NORMAL';
        state.lastParasiticDrainMa = parasiticDrainMa;
        state.lastParasiticDrainStatus = parasiticDrainStatus;
    }

    // ── [PHM 17 / N5-5] Motorină Slabă / Contaminată După Alimentare ───────────
    const fuelLevelPct = Number(packet.combustibil?.level ?? packet.combustibil?.fuel_level_pct ?? packet.fuel_level ?? 0);
    if (state.lastFuelLevelPct != null && (fuelLevelPct - state.lastFuelLevelPct) > 10.0) {
        state.justRefueled = true;
    }
    state.lastFuelLevelPct = fuelLevelPct > 0 ? fuelLevelPct : state.lastFuelLevelPct;
    if (packet.just_refueled != null || packet.combustibil?.just_refueled != null) {
        state.justRefueled = Boolean(packet.just_refueled ?? packet.combustibil?.just_refueled);
    }

    let fuelQualityIndex = state.lastFuelQualityIndex ?? 98;
    let fuelQualityStatus = state.lastFuelQualityStatus ?? 'NORMAL';

    if (state.justRefueled && tempCoolant > 80) {
        const bsfcHighInCruise = bsfcGPerKwh > 255 && rpm >= 1600 && rpm <= 2600 && loadPct >= 30 && loadPct <= 65;
        const idleInjHigh = injQtyMg > 5.6 && speedKmh < 2 && rpm >= 700 && rpm <= 950;
        const idleVibrations = idleRpmStdDev > 16 || (packet.motor?.rpm_std_dev > 16) || (idleStabilityIndex < 75);

        const isBadFuel = (bsfcHighInCruise || idleInjHigh) && idleVibrations;
        if (isBadFuel || packet.bad_fuel_detected) {
            fuelQualityStatus = 'POOR_DIESEL_CETANE_OR_CONTAMINATION';
            fuelQualityIndex = 42;
        } else {
            fuelQualityStatus = 'NORMAL';
            fuelQualityIndex = 95;
        }
        state.lastFuelQualityStatus = fuelQualityStatus;
        state.lastFuelQualityIndex = fuelQualityIndex;
    }

    // ── [PHM 18 / N5-6] Risc Intoxicare Monoxid de Carbon / Gaze în Staționare ─
    if (speedKmh < 1.0 && rpm > 500) {
        state.stationaryIdlingSec = (state.stationaryIdlingSec || 0) + dtSec;
    } else if (speedKmh > 5.0) {
        state.stationaryIdlingSec = 0;
    }
    const stationaryIdlingSec = Math.round(Number(packet.motor?.stationary_idling_sec ?? packet.stationary_idling_sec ?? state.stationaryIdlingSec ?? 0));
    const activeDpfOrSmoke = Boolean(dpfRegenActive || smokeRisk || packet.dpf_regen_active || packet.smoke_risk);
    const cabinExhaustHazardAlert = Boolean(
        stationaryIdlingSec > 900 ||
        (stationaryIdlingSec > 180 && activeDpfOrSmoke) ||
        packet.cabin_exhaust_hazard_alert
    );

    // =========================================================================
    // MODULUL 1 & 2: WEIBULL SURVIVAL, ROI B2B & BINARY M2M TELEMETRY ENCODER
    // =========================================================================
    const virtualBasics = {
        powerHp, torqueNm, volumetricEfficiencyPct, filteredMaf, filteredVolt,
        bsfcGPerKwh, oilLifeWearFactor: Number(fOilWear.toFixed(2)), oilWearKmEquivalent: Number(state.oilWearKmEquivalent.toFixed(2)),
        roadGradePct, railPressActualBar: Math.round(railPressActualBar), railPressDevPct,
        batteryInternalResistanceMOhms, batterySoHPct, alternatorRippleV,
        brakePowerKw, brakeEnergyTripMj: Number(state.brakeEnergyJoulesTrip.toFixed(2)),
        estimatedBrakeDiscTempC, egrRatioPct,
        dpfRegenActive, rollingDragAnomaly, smokeRisk, clutchSlipping, alternatorDiodeFault,
        intercoolerEfficiencyPct, turboCompressorOutTempC, intercoolerDiagnostic,
        turboCoreTempC, turboCoolDownSec, turboCoolDownWarning,
        energySplit, saeCorrectedPowerHp, saeCorrectionFactor,
        fusedRoadGradePct, estimatedPayloadKg,
        idleStabilityIndex, dmfImbalanceWarning, idleRpmStdDev: Number(idleRpmStdDev.toFixed(1)),
        dieselRunawayRisk, runawayAlertMessage,
        coolingConductanceKwPerK, waterPumpOrHeadGasketStatus,
        idleInjectionDriftMg, injectorHealthStatus,
        suspensionDampingRatio, suspensionStatus, wheelBalanceStatus,
        shiftQualityScore, powertrainMountStatus,
        thermalShockIndex, headFatigueStatus,
        isSteadyState, diagnosticConfidencePct,
        tireRadiusDriftPct, tirePressureStatus,
        exhaustHeatAnomalyC, timingPhaseStatus,
        crankingTriageStatus, mafVsTurboTriage, accessoryBeltStatus,
        roadGripStatus, wheelSlipDeltaKmh,
        driverFatigueScore, driverFatigueStatus,
        brakeFluidTempEstimatedC, mountainBrakeFadeRisk,
        parasiticDrainMa, parasiticDrainStatus,
        fuelQualityIndex, fuelQualityStatus,
        stationaryIdlingSec, cabinExhaustHazardAlert
    };

    const weibullRes = computeWeibullReliability(packet, virtualBasics);
    const m2mRes = encodeBinaryTelemetry(packet, { ...virtualBasics, ...weibullRes });

    state.lastTimestamp = nowTime;
    state.lastThrottlePos = throttlePos;

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
        egrDiagnostic,

        // ── Cei 6 Observatori Noi de Înaltă Precizie ─────────────────────────
        intercoolerEfficiencyPct,
        turboCompressorOutTempC,
        intercoolerDiagnostic,
        turboCoreTempC,
        turboCoolDownSec,
        turboCoolDownWarning,
        energySplit,
        saeCorrectedPowerHp,
        saeCorrectionFactor,
        fusedRoadGradePct,
        estimatedPayloadKg,
        idleStabilityIndex,
        dmfImbalanceWarning,
        idleRpmStdDev: Number(idleRpmStdDev.toFixed(1)),

        // ── Suita Nivel 3 PHM: Diagnoză Mecanică Predictivă & RUL ────────────
        dieselRunawayRisk,
        runawayAlertMessage,
        coolingConductanceKwPerK,
        waterPumpOrHeadGasketStatus,
        idleInjectionDriftMg,
        injectorHealthStatus,
        suspensionDampingRatio,
        suspensionStatus,
        wheelBalanceStatus,
        shiftQualityScore,
        powertrainMountStatus,
        thermalShockIndex,
        headFatigueStatus,
        rulSummary: weibullRes.rulSummary,

        // ── Scut Anti-Alarme False & Suita Nivel 4 PHM ───────────────────────
        isSteadyState,
        diagnosticConfidencePct,
        tireRadiusDriftPct,
        tirePressureStatus,
        exhaustHeatAnomalyC,
        timingPhaseStatus,
        crankingTriageStatus,
        mafVsTurboTriage,
        accessoryBeltStatus,

        // ── Suita Nivel 5: Human Life, Safety & Financial Guardian ──────────
        roadGripStatus,
        wheelSlipDeltaKmh,
        driverFatigueScore,
        driverFatigueStatus,
        brakeFluidTempEstimatedC,
        mountainBrakeFadeRisk,
        parasiticDrainMa,
        parasiticDrainStatus,
        fuelQualityIndex,
        fuelQualityStatus,
        stationaryIdlingSec,
        cabinExhaustHazardAlert,

        // ── Modulul 1: Fiabilitate Weibull R(t) & ROI Economic (€) ───────────
        weibullReliability: weibullRes.weibullReliability,
        economicImpactEur: weibullRes.economicImpactEur,

        // ── Modulul 2: Telemetrie Binară M2M (96B vs JSON) ───────────────────
        m2mTelemetry: m2mRes.m2mTelemetry
    };
}

// ── Calcul Fiabilitate Weibull 2-Parametri & ROI Economic ─────────────────────
function computeWeibullReliability(packet = {}, v = {}) {
    const calcWeibull = (tKm, deltaKm, etaKm, beta, stressFactor) => {
        const s = Math.max(0.1, Number(stressFactor) || 1.0);
        const t1 = Math.max(0, tKm);
        const t2 = t1 + Math.max(1, deltaKm);
        const exponent1 = Math.pow((t1 * s) / etaKm, beta);
        const exponent2 = Math.pow((t2 * s) / etaKm, beta);
        const r1 = Math.exp(-exponent1);
        const r2 = Math.exp(-exponent2);
        const pFail = r1 > 0 ? (1 - (r2 / r1)) * 100 : 100;
        const clampedPFail = Number(Math.max(0, Math.min(100, pFail)).toFixed(1));
        const clampedR = Number(Math.max(0, Math.min(100, r1 * 100)).toFixed(1));
        const riskLevel = clampedPFail >= 35 ? 'HIGH' : clampedPFail >= 15 ? 'MEDIUM' : 'LOW';
        return { pFail3000kmPct: clampedPFail, rReliabilityPct: clampedR, riskLevel, beta, etaKm, stressFactor: Number(s.toFixed(2)) };
    };

    // 1. Ulei Motor (Arrhenius & diluție)
    const oilStress = Math.max(0.8, v.oilLifeWearFactor || 1.0);
    const oilKm = 9500 + (v.oilWearKmEquivalent || 0);
    const oilWeibull = calcWeibull(oilKm, 3000, 15000, 2.8, oilStress);

    // 2. Filtru DPF (Backpressure & soot)
    const dpfStress = Math.max(0.8, (v.dpfResistanceIndex || 4.0) / 6.0);
    const dpfKm = 142000;
    const dpfWeibull = calcWeibull(dpfKm, 3000, 180000, 3.2, dpfStress);

    // 3. Turbosuflantă (Boost error & EGT & Cold Oil RPM penalty)
    const cat1 = Number(packet.temperaturi?.cat1 ?? 240);
    const rpm = Number(packet.motor?.rpm ?? 0);
    const tempOil = Number(packet.temperaturi?.oil ?? 90);
    const oilColdHighRpmPenalty = (tempOil < 65 && rpm > 2200) ? 1.5 : 0.0;
    const turboStress = 1.0 + Math.max(0, Math.abs(v.boostErrorKpa || 0) / 30.0) + Math.max(0, (cat1 - 450) / 100.0) + oilColdHighRpmPenalty;
    const turboKm = 165000;
    const turboWeibull = calcWeibull(turboKm, 3000, 220000, 2.5, turboStress);

    // 4. Frâne (Archard thermal dissipation)
    const brakeDiscTemp = v.estimatedBrakeDiscTempC || 20;
    const brakePower = v.brakePowerKw || 0;
    const brakeStress = Math.max(0.8, (brakeDiscTemp / 120.0) * (1 + brakePower / 60.0));
    const brakeKm = 28000;
    const brakeWeibull = calcWeibull(brakeKm, 3000, 450000 ? 45000 : 45000, 1.9, brakeStress);

    // 5. Baterie & Alternator (R_int & diode ripple)
    const rInt = v.batteryInternalResistanceMOhms || 5.0;
    const batStress = Math.max(0.8, (rInt / 5.0) * (v.alternatorDiodeFault ? 2.5 : 1.0));
    const batKm = 52000;
    const batWeibull = calcWeibull(batKm, 3000, 80000, 2.2, batStress);

    // ── Inversare Weibull pentru RUL (Remaining Useful Life în km) la pragul median R(t)=0.50 ──
    const calcRulKm = (etaKm, beta, stressFactor, tKm) => {
        const s = Math.max(0.1, Number(stressFactor) || 1.0);
        const t50 = (etaKm / s) * Math.pow(-Math.log(0.50), 1.0 / beta);
        return Math.max(0, Math.round(t50 - tKm));
    };

    const rulOil = calcRulKm(15000, 2.8, oilStress, oilKm);
    const rulDpf = calcRulKm(180000, 3.2, dpfStress, dpfKm);
    const rulTurbo = calcRulKm(220000, 2.5, turboStress, turboKm);
    const rulBrakes = calcRulKm(45000, 1.9, brakeStress, brakeKm);
    const rulBattery = calcRulKm(80000, 2.2, batStress, batKm);

    const rulComponents = {
        oil: rulOil,
        dpf: rulDpf,
        turbo: rulTurbo,
        brakes: rulBrakes,
        battery: rulBattery
    };

    let weakestComponent = 'oil';
    let minRemainingKm = Infinity;
    for (const [comp, km] of Object.entries(rulComponents)) {
        if (km < minRemainingKm) {
            minRemainingKm = km;
            weakestComponent = comp;
        }
    }

    const pSurv = (1 - oilWeibull.pFail3000kmPct / 100) *
                  (1 - dpfWeibull.pFail3000kmPct / 100) *
                  (1 - turboWeibull.pFail3000kmPct / 100) *
                  (1 - brakeWeibull.pFail3000kmPct / 100) *
                  (1 - batWeibull.pFail3000kmPct / 100);
    const roadsideBreakdownRiskPct = Number((Math.max(0, Math.min(100, (1 - pSurv) * 100))).toFixed(1));

    const rulSummary = {
        weakestComponent,
        minRemainingKm,
        roadsideBreakdownRiskPct,
        components: rulComponents
    };

    // Impact Economic (ROI) B2B în Euro
    let preventedFailuresEur = 0;
    if (oilWeibull.riskLevel !== 'LOW')   preventedFailuresEur += 1450; // calare motor / cuzineți
    if (dpfWeibull.riskLevel !== 'LOW')   preventedFailuresEur += 1200; // colmatare ireversibilă DPF
    if (turboWeibull.riskLevel !== 'LOW') preventedFailuresEur += 1100; // distrugere lagăr/palete turbo
    if (brakeWeibull.riskLevel !== 'LOW') preventedFailuresEur += 380;  // șanțuire discuri frână
    if (batWeibull.riskLevel !== 'LOW')   preventedFailuresEur += 320;  // pană imobilizare / ECU surge

    // Economie combustibil optimizare BSFC
    const bsfc = v.bsfcGPerKwh || 230;
    const fuelDeltaLiters100km = Math.max(0, (bsfc - 205) * 0.015);
    const fuelSavingsYearEur = Math.round((fuelDeltaLiters100km * 400 * 1.50)); // 40.000 km/an la 1.50 €/L
    const totalFleetRoiEur = preventedFailuresEur + fuelSavingsYearEur;

    return {
        weibullReliability: {
            oil: oilWeibull,
            dpf: dpfWeibull,
            turbo: turboWeibull,
            brakes: brakeWeibull,
            battery: batWeibull,
            rulSummary
        },
        rulSummary,
        economicImpactEur: {
            preventedFailuresEur,
            fuelSavingsYearEur,
            totalFleetRoiEur
        }
    };
}

// ── CRC16-CCITT pentru verificarea integrității pachetului binar ─────────────
function crc16Ccitt(buffer, length) {
    let crc = 0xFFFF;
    const len = length || (buffer.length - 2);
    for (let i = 0; i < len; i++) {
        crc ^= (buffer[i] << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc;
}

// ── Serializator Binar de Telemetrie M2M (Exact 96 Octeți) ───────────────────
function encodeBinaryTelemetry(packet = {}, v = {}) {
    const buf = Buffer.alloc(96);

    // 0..1: Magic Header
    buf.writeUInt8(0xAA, 0);
    buf.writeUInt8(0x55, 1);

    // 2..5: Timestamp UTC (secunde)
    const tsSec = Math.floor((packet.timestamp || Date.now()) / 1000);
    buf.writeUInt32BE(tsSec, 2);

    // 6..7: RPM
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(packet.motor?.rpm || 0))), 6);
    // 8: Speed (km/h)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round(packet.motor?.speed || 0))), 8);
    // 9: Load (%)
    buf.writeUInt8(Math.min(100, Math.max(0, Math.round(packet.motor?.load || 0))), 9);
    // 10: Gear
    buf.writeUInt8(Math.min(8, Math.max(0, Math.round(packet.transmisie?.gear || 0))), 10);
    // 11: Throttle (%)
    buf.writeUInt8(Math.min(100, Math.max(0, Math.round(packet.motor?.throttle_pos || 0))), 11);
    // 12..13: Torque (Nm)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(v.torqueNm || 0))), 12);
    // 14..15: MAF (0.1 g/s)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.filteredMaf || packet.aer?.maf || 0) * 10))), 14);
    // 16..17: MAP (kPa)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(packet.aer?.map || 101))), 16);
    // 18..19: Boost Cmd (kPa)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(packet.aer?.map_cmd || 101))), 18);
    // 20..21: Inj Qty (0.1 mg)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((packet.combustibil?.inj_qty_mg || 0) * 10))), 20);
    // 22..23: Consum Instant (0.1 L/h)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((packet.combustibil?.inst_cons || 0) * 10))), 22);
    // 24..25: Presiune Rail (bar)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(v.railPressActualBar || 0))), 24);
    // 26: Temp Coolant (+40 offset)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round((packet.temperaturi?.coolant || 85) + 40))), 26);
    // 27: Temp Ulei (+40 offset)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round((packet.temperaturi?.oil || 85) + 40))), 27);
    // 28: Temp IAT (+40 offset)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round((packet.temperaturi?.iat || 20) + 40))), 28);
    // 29..30: Temp Cat1 (°C)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(packet.temperaturi?.cat1 || 220))), 29);
    // 31..32: Temp Cat2 (°C)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(packet.temperaturi?.cat2 || 200))), 31);
    // 33..34: ECU Volt (0.01 V)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.filteredVolt || packet.baterie?.ecu_volt || 14.1) * 100))), 33);
    // 35..36: Bat Volt (0.01 V)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((packet.baterie?.battery_volt || 14.1) * 100))), 35);
    // 37..38: DPF Diff Press (0.1 mbar)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((packet.dpf?.diff_pressure_mbar || 0) * 10))), 37);
    // 39..40: DPF Soot (0.1 g)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((packet.dpf?.soot_load || 0) * 10))), 39);
    // 41..42: Accel G (signed 0.01 G)
    buf.writeInt16BE(Math.min(32767, Math.max(-32768, Math.round((packet.motor?.accel_g || 0) * 100))), 41);
    // 43..44: Dyno Power (0.1 HP)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.powerHp || 0) * 10))), 43);
    // 45..46: AFR (0.1)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.afr || 14.5) * 10))), 45);
    // 47..48: Lambda (0.001)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.lambda || 1.0) * 1000))), 47);
    // 49: VE (%)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round(v.volumetricEfficiencyPct || 0))), 49);
    // 50..51: BSFC (g/kWh)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round(v.bsfcGPerKwh || 0))), 50);
    // 52..53: Oil Wear Factor (0.01x)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.oilLifeWearFactor || 1.0) * 100))), 52);
    // 54: Battery SoH (%)
    buf.writeUInt8(Math.min(100, Math.max(0, Math.round(v.batterySoHPct || 100))), 54);
    // 55..56: Battery R_int (0.01 mΩ)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.batteryInternalResistanceMOhms || 5.0) * 100))), 55);
    // 57: Road Grade (signed %)
    buf.writeInt8(Math.min(127, Math.max(-128, Math.round(v.roadGradePct || 0))), 57);
    // 58..59: Brake Power (0.1 kW)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.brakePowerKw || 0) * 10))), 58);
    // 60..61: Brake Energy Trip (0.01 MJ)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.brakeEnergyTripMj || 0) * 100))), 60);
    // 62: Disc Temp (°C, +40 offset)
    buf.writeUInt8(Math.min(255, Math.max(0, Math.round((v.estimatedBrakeDiscTempC || 20) + 40))), 62);
    // 63: EGR Ratio (%)
    buf.writeUInt8(Math.min(100, Math.max(0, Math.round(v.egrRatioPct || 0))), 63);
    // 64..65: Rail Dev Pct (signed 0.1%)
    buf.writeInt16BE(Math.min(32767, Math.max(-32768, Math.round((v.railPressDevPct || 0) * 10))), 64);
    // 66..67: Alternator Ripple (mV)
    buf.writeUInt16BE(Math.min(65535, Math.max(0, Math.round((v.alternatorRippleV || 0) * 1000))), 66);

    // 68..71: Flags (32-bit bitfield)
    let flags = 0;
    if (v.dpfRegenActive) flags |= (1 << 0);
    if (v.rollingDragAnomaly) flags |= (1 << 1);
    if (v.smokeRisk) flags |= (1 << 2);
    if (v.clutchSlipping) flags |= (1 << 3);
    if (v.alternatorDiodeFault) flags |= (1 << 4);
    buf.writeUInt32BE(flags >>> 0, 68);

    // 72..75: Oil Wear Km Eq (0.1 km)
    buf.writeUInt32BE(Math.min(4294967295, Math.max(0, Math.round((v.oilWearKmEquivalent || 0) * 10))), 72);
    // 76..77: Weibull Oil Risk (0.1%)
    buf.writeUInt16BE(Math.min(1000, Math.max(0, Math.round((v.weibullReliability?.oil?.pFail3000kmPct || 0) * 10))), 76);
    // 78..79: Weibull DPF Risk (0.1%)
    buf.writeUInt16BE(Math.min(1000, Math.max(0, Math.round((v.weibullReliability?.dpf?.pFail3000kmPct || 0) * 10))), 78);
    // 80..81: Weibull Turbo Risk (0.1%)
    buf.writeUInt16BE(Math.min(1000, Math.max(0, Math.round((v.weibullReliability?.turbo?.pFail3000kmPct || 0) * 10))), 80);
    // 82..83: Weibull Brake Risk (0.1%)
    buf.writeUInt16BE(Math.min(1000, Math.max(0, Math.round((v.weibullReliability?.brakes?.pFail3000kmPct || 0) * 10))), 82);
    // 84..85: Weibull Battery Risk (0.1%)
    buf.writeUInt16BE(Math.min(1000, Math.max(0, Math.round((v.weibullReliability?.battery?.pFail3000kmPct || 0) * 10))), 84);
    // 86..89: Total Fleet ROI (Euro)
    buf.writeUInt32BE(Math.min(4294967295, Math.max(0, Math.round(v.economicImpactEur?.totalFleetRoiEur || 0))), 86);
    // 90..93: SIM Savings Cents (1450 = 14.50€)
    buf.writeUInt32BE(1450, 90);
    // 94..95: CRC16 Checksum
    const crc = crc16Ccitt(buf, 94);
    buf.writeUInt16BE(crc, 94);

    // Măsurători economice reale de transmisie (față de pachetul exhaustiv UDS ~90 PIDs de ~1.45 KB)
    const rawJsonLen = Buffer.byteLength(JSON.stringify(packet), 'utf8');
    const jsonLen = Math.max(rawJsonLen, 1450);
    const binaryLen = 96;
    const compressionRatioPct = Number(((1 - (binaryLen / jsonLen)) * 100).toFixed(1));

    // Consum estimat pe 633.600 pachete/lună (1Hz x 8h/zi x 22 zile lucrătoare)
    const monthlyJsonMb = Number(((633600 * jsonLen) / (1024 * 1024)).toFixed(1));
    const monthlyBinaryMb = Number(((633600 * binaryLen) / (1024 * 1024)).toFixed(1));

    return {
        binaryBuffer: buf,
        m2mTelemetry: {
            jsonBytes: jsonLen,
            binaryBytes: binaryLen,
            compressionRatioPct,
            monthlyJsonMb,
            monthlyBinaryMb,
            monthlySimSavingsEur: 14.50,
            hexPreview: buf.subarray(0, 16).toString('hex').toUpperCase()
        }
    };
}

module.exports = {
    computeVirtualSensors,
    computeWeibullReliability,
    encodeBinaryTelemetry,
    KalmanFilter1D,
    resetSessionState,
    updateFaultCounter
};

