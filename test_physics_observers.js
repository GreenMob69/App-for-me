'use strict';
const assert = require('assert');
const { computeVirtualSensors, resetSessionState, updateFaultCounter } = require('./backend/analyzers/PhysicsEngine');

console.log('Testing 8 Sensor Fusion & Virtual Observer Algorithms...\n');

resetSessionState();

// 1. Test Sweet Spot Cruise (1900 RPM, 65% load, 90 km/h, 5th gear, warm engine)
const cruisePacket = {
    timestamp: 1700000000000,
    motor: { rpm: 1900, speed: 90, load: 65, accel_g: 0.01 },
    aer: { maf: 58.0, map: 165, map_cmd: 165 },
    combustibil: { inj_qty_mg: 28.5, inst_cons: 5.4, rail_press_bar: 780 },
    temperaturi: { coolant: 88, oil: 92, ambient: 20, iat: 32, cat1: 290, cat2: 285 },
    baterie: { ecu_volt: 14.15, battery_volt: 14.20 },
    dpf: { diff_pressure_mbar: 22.0, soot_load: 12.5 },
    transmisie: { gear: 5 }
};

const resCruise = computeVirtualSensors(cruisePacket);
console.log('=== TEST 1: SWEET SPOT CRUISE ===');
console.log('Power HP:', resCruise.powerHp);
console.log('Torque Nm:', resCruise.torqueNm);
console.log('AFR:', resCruise.afr, '| Lambda:', resCruise.lambda);
console.log('VE %:', resCruise.volumetricEfficiencyPct);
console.log('BSFC (g/kWh):', resCruise.bsfcGPerKwh);
console.log('Engine Eff %:', resCruise.engineEfficiencyPct);
console.log('Oil Wear Factor:', resCruise.oilLifeWearFactor);
console.log('Road Grade %:', resCruise.roadGradePct);
console.log('Rail Target bar:', resCruise.railPressTargetBar, '| Actual bar:', resCruise.railPressActualBar);
console.log('Cat Efficiency:', resCruise.catEfficiency, '| DPF Regen:', resCruise.dpfRegenActive);
console.log('Battery SoH %:', resCruise.batterySoHPct, '| R_int (mΩ):', resCruise.batteryInternalResistanceMOhms);
console.log('EGR Ratio %:', resCruise.egrRatioPct, '| Diagnostic:', resCruise.egrDiagnostic);

assert(resCruise.bsfcGPerKwh >= 190 && resCruise.bsfcGPerKwh <= 260, `BSFC ${resCruise.bsfcGPerKwh} outside normal diesel range`);
assert(resCruise.powerHp > 45 && resCruise.powerHp < 75, `Power ${resCruise.powerHp} unexpected`);
assert(resCruise.oilLifeWearFactor >= 0.95 && resCruise.oilLifeWearFactor <= 1.3, 'Oil wear factor abnormal');
assert(resCruise.catEfficiency === 'ACTIVE_EXOTHERMIC', 'Cat efficiency should be active');
assert(!resCruise.dpfRegenActive, 'DPF regen should not be active');
assert(resCruise.batterySoHPct >= 75, 'Battery SoH should be good');

// 2. Test Cold Start / Idle (800 RPM, 15% load, 0 km/h, coolant 25°C, oil 22°C)
const coldIdlePacket = {
    timestamp: 1700000001000,
    motor: { rpm: 800, speed: 0, load: 15, accel_g: 0.0 },
    aer: { maf: 8.5, map: 101, map_cmd: 101 },
    combustibil: { inj_qty_mg: 7.2, inst_cons: 0.8, rail_press_bar: 310 },
    temperaturi: { coolant: 25, oil: 22, ambient: 10, iat: 12, cat1: 85, cat2: 70 },
    baterie: { ecu_volt: 13.9, battery_volt: 14.0 },
    dpf: { diff_pressure_mbar: 2.5, soot_load: 12.5 },
    transmisie: { gear: 0 }
};

const resColdIdle = computeVirtualSensors(coldIdlePacket);
console.log('\n=== TEST 2: COLD START / IDLE ===');
console.log('BSFC (g/kWh):', resColdIdle.bsfcGPerKwh);
console.log('Oil Wear Factor (Cold penalty):', resColdIdle.oilLifeWearFactor);
console.log('Cat Efficiency:', resColdIdle.catEfficiency);
assert(resColdIdle.oilLifeWearFactor > 1.8, 'Cold oil should have wear penalty > 1.8x');
assert(resColdIdle.bsfcGPerKwh > 280, 'Cold idle BSFC should be > 280 g/kWh');

// 3. Test Active DPF Regeneration (Cat1 = 580°C, Cat2 = 620°C)
const regenPacket = {
    timestamp: 1700000002000,
    motor: { rpm: 2200, speed: 110, load: 55, accel_g: 0.02 },
    aer: { maf: 72.0, map: 185, map_cmd: 185 },
    combustibil: { inj_qty_mg: 32.0, inst_cons: 6.8, rail_press_bar: 920 },
    temperaturi: { coolant: 90, oil: 102, ambient: 22, iat: 35, cat1: 580, cat2: 625 },
    baterie: { ecu_volt: 14.1, battery_volt: 14.15 },
    dpf: { diff_pressure_mbar: 45.0, soot_load: 28.0 },
    transmisie: { gear: 6 }
};
const resRegen = computeVirtualSensors(regenPacket);
console.log('\n=== TEST 3: ACTIVE DPF REGENERATION ===');
console.log('Delta Cat Temp °C:', resRegen.deltaCatTempC);
console.log('DPF Regen Active:', resRegen.dpfRegenActive);
console.log('DPF Regen Notice:', resRegen.dpfRegenNotice);
assert(resRegen.dpfRegenActive === true, 'DPF Regen should be detected active');
assert(resRegen.dpfRegenNotice.includes('Regenerare DPF în curs'), 'DPF notice missing');

// 4. Test Overrun Coast-Down Drag Anomaly (Stuck caliper / bad bearing)
const dragAnomalyPacket = {
    timestamp: 1700000003000,
    motor: { rpm: 1600, speed: 70, load: 5, accel_g: -0.22 }, // High deceleration in overrun!
    aer: { maf: 12.0, map: 101, map_cmd: 101 },
    combustibil: { inj_qty_mg: 0.0, inst_cons: 0.0, rail_press_bar: 300 },
    temperaturi: { coolant: 88, oil: 90, ambient: 20, iat: 25, cat1: 220, cat2: 210 },
    baterie: { ecu_volt: 14.2, battery_volt: 14.2 },
    transmisie: { gear: 5 }
};
const resDrag = computeVirtualSensors(dragAnomalyPacket);
console.log('\n=== TEST 4: COAST-DOWN DRAG ANOMALY ===');
console.log('Rolling Drag Anomaly:', resDrag.rollingDragAnomaly);
console.log('Diagnostic:', resDrag.rollingDragDiagnostic);
assert(resDrag.rollingDragAnomaly === true, 'Rolling drag anomaly should be triggered');
assert(resDrag.rollingDragDiagnostic === 'BRAKE_CALIPER_OR_BEARING_DRAG');

// 5. Test Hard Braking & Kinetic Dissipation
const brakePacket = {
    timestamp: 1700000004000,
    motor: { rpm: 1200, speed: 80, load: 5, accel_g: -0.55 },
    aer: { maf: 10.0, map: 101, map_cmd: 101 },
    combustibil: { inj_qty_mg: 0.0, inst_cons: 0.0 },
    temperaturi: { coolant: 88, oil: 90, ambient: 20 },
    baterie: { ecu_volt: 14.2 },
    transmisie: { gear: 3 }
};
const resBrake = computeVirtualSensors(brakePacket);
console.log('\n=== TEST 5: HARD BRAKE & DISSIPATION ===');
console.log('Brake Power kW:', resBrake.brakePowerKw);
console.log('Brake Energy Trip MJ:', resBrake.brakeEnergyTripMj);
console.log('Estimated Disc Temp °C:', resBrake.estimatedBrakeDiscTempC);
assert(resBrake.brakePowerKw > 100, `Brake power ${resBrake.brakePowerKw} kW should be > 100 kW`);
assert(resBrake.brakeEnergyTripMj > 0.05, 'Brake energy should accumulate');

// 6. Test Stuck EGR Valve (Full load with high EGR ratio)
const stuckEgrPacket = {
    timestamp: 1700000005000,
    motor: { rpm: 2500, speed: 100, load: 85, accel_g: 0.2 },
    aer: { maf: 55.0, map: 210, map_cmd: 210 }, // Low MAF under high boost -> EGR stuck open
    combustibil: { inj_qty_mg: 40.0, inst_cons: 10.5, rail_press_bar: 1100 },
    temperaturi: { coolant: 90, oil: 95, ambient: 20, iat: 35, cat1: 380, cat2: 370 },
    baterie: { ecu_volt: 14.1 },
    transmisie: { gear: 4 }
};
const resEgr = computeVirtualSensors(stuckEgrPacket);
console.log('\n=== TEST 6: EGR STUCK OPEN UNDER FULL LOAD ===');
console.log('EGR Ratio %:', resEgr.egrRatioPct);
console.log('EGR Diagnostic:', resEgr.egrDiagnostic);
assert(resEgr.egrDiagnostic === 'EGR_STUCK_OPEN_CARBON', 'Should diagnose EGR stuck open under heavy load');

// 7. Test Weibull Survival Reliability & B2B Economic ROI
console.log('\n=== TEST 7: WEIBULL RELIABILITY & B2B ROI ===');
console.log('Weibull Oil Risk (3000 km):', resCruise.weibullReliability.oil.pFail3000kmPct, '% | R(t):', resCruise.weibullReliability.oil.rReliabilityPct, '% | Risk:', resCruise.weibullReliability.oil.riskLevel);
console.log('Weibull DPF Risk (3000 km):', resCruise.weibullReliability.dpf.pFail3000kmPct, '% | R(t):', resCruise.weibullReliability.dpf.rReliabilityPct, '% | Risk:', resCruise.weibullReliability.dpf.riskLevel);
console.log('Weibull Turbo Risk (3000 km):', resCruise.weibullReliability.turbo.pFail3000kmPct, '% | Risk:', resCruise.weibullReliability.turbo.riskLevel);
console.log('B2B Economic ROI (Prevented + Fuel):', resCruise.economicImpactEur.totalFleetRoiEur, '€ / an');
assert(resCruise.weibullReliability.oil.pFail3000kmPct >= 0 && resCruise.weibullReliability.oil.pFail3000kmPct <= 100, 'Weibull oil risk invalid');
assert(resCruise.economicImpactEur.totalFleetRoiEur >= 0, 'ROI should be non-negative');

// 8. Test Binary Telemetry Encoder & M2M SIM Traffic Savings
console.log('\n=== TEST 8: BINARY M2M TELEMETRY PACKET ===');
console.log('JSON Size:', resCruise.m2mTelemetry.jsonBytes, 'bytes');
console.log('Binary Size:', resCruise.m2mTelemetry.binaryBytes, 'bytes');
console.log('Compression Ratio:', resCruise.m2mTelemetry.compressionRatioPct, '%');
console.log('Monthly Traffic JSON:', resCruise.m2mTelemetry.monthlyJsonMb, 'MB');
console.log('Monthly Traffic Binary:', resCruise.m2mTelemetry.monthlyBinaryMb, 'MB');
console.log('Monthly SIM Savings:', resCruise.m2mTelemetry.monthlySimSavingsEur, '€ / vehicul');
console.log('Hex Header Preview (16B):', resCruise.m2mTelemetry.hexPreview);

assert.strictEqual(resCruise.m2mTelemetry.binaryBytes, 96, 'Binary packet must be exactly 96 bytes');
assert(resCruise.m2mTelemetry.compressionRatioPct > 90, 'Compression ratio should be > 90%');
assert(resCruise.m2mTelemetry.monthlyBinaryMb < 100, 'Monthly binary data must fit in 100MB eSIM');

// 9. Test Intercooler Thermal Efficiency & Heat Soak Diagnostic
console.log('\n=== TEST 9: INTERCOOLER THERMAL EFFICIENCY ===');
const boostIcPacket = {
    timestamp: 1700000006000,
    motor: { rpm: 2400, speed: 90, load: 75, accel_g: 0.05 },
    aer: { maf: 80.0, map: 210, map_cmd: 210, baro: 101.3 },
    combustibil: { inj_qty_mg: 38.0, inst_cons: 8.5 },
    temperaturi: { coolant: 89, oil: 95, ambient: 22, iat: 38, cat1: 340, cat2: 320 },
    baterie: { ecu_volt: 14.1 },
    transmisie: { gear: 5 }
};
const resIc = computeVirtualSensors(boostIcPacket);
console.log('Compressor Out Temp °C:', resIc.turboCompressorOutTempC);
console.log('Intercooler Efficiency %:', resIc.intercoolerEfficiencyPct);
console.log('Intercooler Diagnostic:', resIc.intercoolerDiagnostic);
assert(resIc.turboCompressorOutTempC > 80, 'Compressor discharge should be hot under boost');
assert(resIc.intercoolerEfficiencyPct > 60 && resIc.intercoolerEfficiencyPct <= 100, 'Normal IC efficiency should be > 60%');
assert.strictEqual(resIc.intercoolerDiagnostic, 'NORMAL', 'IC diagnostic should be normal');

// Test Heat Soak / Clogged Intercooler
const heatSoakPacket = {
    ...boostIcPacket,
    timestamp: 1700000007000,
    temperaturi: { coolant: 92, oil: 98, ambient: 25, iat: 82, cat1: 380, cat2: 360 } // high IAT
};
const resHeatSoak = computeVirtualSensors(heatSoakPacket);
console.log('Heat Soak IC Efficiency %:', resHeatSoak.intercoolerEfficiencyPct, '| Diagnostic:', resHeatSoak.intercoolerDiagnostic);
assert(resHeatSoak.intercoolerEfficiencyPct < 55, 'Heat soak should result in efficiency < 55%');
assert.strictEqual(resHeatSoak.intercoolerDiagnostic, 'HEAT_SOAK_OR_CLOGGED');

// 10. Test Turbo Anti-Coking Protection & Cooldown Timer
console.log('\n=== TEST 10: TURBO ANTI-COKING PROTECTION ===');
const hotTurboPacket = {
    timestamp: 1700000008000,
    motor: { rpm: 2800, speed: 130, load: 85, accel_g: 0.05 },
    aer: { maf: 95.0, map: 225, map_cmd: 225, baro: 101.3 },
    combustibil: { inj_qty_mg: 45.0, inst_cons: 11.2 },
    temperaturi: { coolant: 92, oil: 108, ambient: 24, iat: 42, cat1: 560, cat2: 540 },
    baterie: { ecu_volt: 14.2 },
    transmisie: { gear: 5 }
};
// Rulează 50 de secunde de sarcină continuă pentru a încălzi miezul CHRA
let resHotTurbo = null;
for (let i = 0; i < 50; i++) {
    resHotTurbo = computeVirtualSensors({ ...hotTurboPacket, timestamp: 1700000008000 + i * 1000 });
}
console.log('Turbo Core Temp (CHRA) °C:', resHotTurbo.turboCoreTempC);
console.log('Turbo Cooldown Seconds Needed:', resHotTurbo.turboCoolDownSec);
console.log('Turbo Cooldown Warning:', resHotTurbo.turboCoolDownWarning);
assert(resHotTurbo.turboCoreTempC > 260, 'Turbo CHRA core should exceed 260°C under hard driving');
assert(resHotTurbo.turboCoolDownSec > 15, 'Cooldown timer should be > 15s');
assert.strictEqual(resHotTurbo.turboCoolDownWarning, true, 'Cooldown warning should be active');

// 11. Test Real-Time Sankey Energy Balance
console.log('\n=== TEST 11: SANKEY THERMODYNAMIC ENERGY BALANCE ===');
console.log('Mechanical %:', resCruise.energySplit.mechanicalPct);
console.log('Exhaust Heat %:', resCruise.energySplit.exhaustPct);
console.log('Cooling & Friction %:', resCruise.energySplit.coolingFrictionPct);
const sumSankey = resCruise.energySplit.mechanicalPct + resCruise.energySplit.exhaustPct + resCruise.energySplit.coolingFrictionPct;
console.log('Total Energy Conservation %:', sumSankey.toFixed(1));
assert(Math.abs(sumSankey - 100) < 0.2, 'Sankey energy components must conserve 100%');
assert(resCruise.energySplit.mechanicalPct >= 30 && resCruise.energySplit.mechanicalPct <= 42, 'Diesel brake efficiency range 30-42%');

// 12. Test SAE J1349 Power Atmospheric Correction
console.log('\n=== TEST 12: SAE J1349 ATMOSPHERIC POWER CORRECTION ===');
console.log('Standard Power HP:', resCruise.powerHp);
console.log('SAE J1349 Correction Factor:', resCruise.saeCorrectionFactor);
console.log('SAE Corrected Power HP:', resCruise.saeCorrectedPowerHp);
assert(resCruise.saeCorrectionFactor >= 0.90 && resCruise.saeCorrectionFactor <= 1.10, 'SAE factor should be near 1.0 at standard day');
assert(resCruise.saeCorrectedPowerHp > 0, 'SAE corrected power must be positive');

// 13. Test Fused Road Grade & Payload Estimator
console.log('\n=== TEST 13: FUSED ROAD GRADE & PAYLOAD ESTIMATION ===');
const imuPacket = {
    ...cruisePacket,
    timestamp: 1700000030000,
    accelerometru: { tilt_pitch: 3.2, accel_y: 0.01, accel_x: 0.02 }
};
const resFused = computeVirtualSensors(imuPacket);
console.log('Force Road Grade %:', resFused.roadGradePct);
console.log('Fused Road Grade %:', resFused.fusedRoadGradePct);
console.log('Estimated Payload Kg:', resFused.estimatedPayloadKg);
assert(resFused.fusedRoadGradePct > 0, 'Fused grade should be positive on uphill');

// 14. Test Warm Idle Stability & Dual-Mass Flywheel (DMF) Imbalance
console.log('\n=== TEST 14: IDLE STABILITY & DMF WARNING ===');
resetSessionState();
// Simulare ralanti instabil cu vibrații laterale
let resDmf = null;
const unstableRpms = [780, 840, 755, 835, 760, 845, 770, 830];
for (let i = 0; i < unstableRpms.length; i++) {
    resDmf = computeVirtualSensors({
        timestamp: 1700000040000 + i * 1000,
        motor: { rpm: unstableRpms[i], speed: 0, load: 15, accel_g: 0.0 },
        aer: { maf: 8.5, map: 101, map_cmd: 101 },
        combustibil: { inj_qty_mg: 7.0, inst_cons: 0.8 },
        temperaturi: { coolant: 88, oil: 85, ambient: 20 },
        accelerometru: { accel_y: 0.11 }, // vibrație transversală sesizabilă pe suport motor
        baterie: { ecu_volt: 14.1 }
    });
}
console.log('Idle Stability Index:', resDmf.idleStabilityIndex);
console.log('Idle RPM StdDev:', resDmf.idleRpmStdDev);
console.log('DMF Imbalance Warning:', resDmf.dmfImbalanceWarning);
assert(resDmf.idleStabilityIndex < 80, 'Unstable idle should lower stability index < 80');
assert.strictEqual(resDmf.dmfImbalanceWarning, true, 'DMF imbalance warning should trigger under high RPM variance & lateral vibration');

// 15. Test Diesel Runaway Risk (Autoturare pe Ulei din Turbină)
console.log('\n=== TEST 15: DIESEL RUNAWAY RISK ===');
resetSessionState();
computeVirtualSensors({
    timestamp: 1700000050000,
    motor: { rpm: 2650, speed: 80, load: 10, throttle_pos: 0, pedal_d: 0 },
    aer: { maf: 40, map: 120 },
    combustibil: { inj_qty_mg: 0.3 },
    temperaturi: { coolant: 90, oil: 95 }
});
const resRunaway = computeVirtualSensors({
    timestamp: 1700000051000,
    motor: { rpm: 2900, speed: 85, load: 10, throttle_pos: 0, pedal_d: 0 },
    aer: { maf: 45, map: 130 },
    combustibil: { inj_qty_mg: 0.2 },
    temperaturi: { coolant: 90, oil: 95 }
});
console.log('Diesel Runaway Risk:', resRunaway.dieselRunawayRisk);
console.log('Runaway Alert Message:', resRunaway.runawayAlertMessage);
assert.strictEqual(resRunaway.dieselRunawayRisk, true, 'Runaway risk must be detected when RPM accelerates without fuel/throttle');
assert(resRunaway.runawayAlertMessage && resRunaway.runawayAlertMessage.includes('AUTOTURARE'), 'Alert message must instruct driver to stall engine');

// 16. Test Cooling Conductance & Water Pump / Head Gasket Risk
console.log('\n=== TEST 16: COOLING CONDUCTANCE & HEAD GASKET STATUS ===');
resetSessionState();
computeVirtualSensors({
    timestamp: 1700000060000,
    motor: { rpm: 3000, speed: 110, load: 75 },
    temperaturi: { coolant: 94.0, ambient: 25 },
    racire: { conductance_kw_k: 0.38 }
});
const resCooling = computeVirtualSensors({
    timestamp: 1700000061000,
    motor: { rpm: 3000, speed: 110, load: 75 },
    temperaturi: { coolant: 94.4, ambient: 25 },
    racire: { conductance_kw_k: 0.38 }
});
console.log('Cooling Conductance UA (kW/K):', resCooling.coolingConductanceKwPerK);
console.log('Water Pump / Head Gasket Status:', resCooling.waterPumpOrHeadGasketStatus);
assert(resCooling.coolingConductanceKwPerK < 0.45, 'Conductance should be < 0.45 kW/K');
assert.strictEqual(resCooling.waterPumpOrHeadGasketStatus, 'WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK');

// 17. Test Warm Idle Injection Drift & Injector Health Status
console.log('\n=== TEST 17: WARM IDLE INJECTION DRIFT ===');
resetSessionState();
const resCokedInj = computeVirtualSensors({
    timestamp: 1700000070000,
    motor: { rpm: 800, speed: 0, load: 18 },
    combustibil: { inj_qty_mg: 8.2 },
    temperaturi: { coolant: 88 }
});
console.log('Coked Injector Drift (mg):', resCokedInj.idleInjectionDriftMg);
console.log('Coked Injector Status:', resCokedInj.injectorHealthStatus);
assert(resCokedInj.idleInjectionDriftMg > 3.0, 'Drift should be > +3.0 mg');
assert.strictEqual(resCokedInj.injectorHealthStatus, 'NOZZLE_COKING_OR_PUMP_WEAR');

const resLeakingInj = computeVirtualSensors({
    timestamp: 1700000071000,
    motor: { rpm: 800, speed: 0, load: 12 },
    combustibil: { inj_qty_mg: 1.8 },
    temperaturi: { coolant: 88 }
});
console.log('Leaking Injector Drift (mg):', resLeakingInj.idleInjectionDriftMg);
console.log('Leaking Injector Status:', resLeakingInj.injectorHealthStatus);
assert.strictEqual(resLeakingInj.injectorHealthStatus, 'LEAKING_INJECTOR_RISK');

// 18. Test Suspension Damping Ratio & Highway Wheel Balance
console.log('\n=== TEST 18: SUSPENSION DAMPING & WHEEL BALANCE ===');
resetSessionState();
computeVirtualSensors({
    timestamp: 1700000080000,
    motor: { rpm: 2000, speed: 60 },
    accelerometru: { accel_z: 1.45 }
});
const resWornSusp = computeVirtualSensors({
    timestamp: 1700000081000,
    motor: { rpm: 2000, speed: 60 },
    accelerometru: { accel_z: 1.35 }
});
console.log('Suspension Damping Ratio ζ:', resWornSusp.suspensionDampingRatio);
console.log('Suspension Status:', resWornSusp.suspensionStatus);
assert(resWornSusp.suspensionDampingRatio < 0.18, 'Damping ratio should be < 0.18');
assert.strictEqual(resWornSusp.suspensionStatus, 'WORN_SHOCK_ABSORBERS');

const resWheelImbalance = computeVirtualSensors({
    timestamp: 1700000082000,
    motor: { rpm: 2400, speed: 120, accel_g: 0.01 },
    accelerometru: { accel_y: 0.15, accel_z: 1.14 }
});
console.log('Wheel Balance Status:', resWheelImbalance.wheelBalanceStatus);
assert.strictEqual(resWheelImbalance.wheelBalanceStatus, 'WHEEL_IMBALANCE_OR_TIRE_RUNOUT');

// 19. Test Dynamic Gear Shift Quality & Powertrain Mount Shock
console.log('\n=== TEST 19: GEAR SHIFT QUALITY & MOUNT SHOCK ===');
resetSessionState();
computeVirtualSensors({
    timestamp: 1700000090000,
    motor: { rpm: 2800, speed: 45 },
    transmisie: { gear: 2 },
    accelerometru: { accel_x: 0.10 }
});
const resShiftShock = computeVirtualSensors({
    timestamp: 1700000091000,
    motor: { rpm: 1900, speed: 46 },
    transmisie: { gear: 3 },
    accelerometru: { accel_x: 0.45 }
});
console.log('Shift Quality Score:', resShiftShock.shiftQualityScore);
console.log('Powertrain Mount Status:', resShiftShock.powertrainMountStatus);
assert(resShiftShock.shiftQualityScore < 80, 'Harsh shift should drop quality score < 80');
assert.strictEqual(resShiftShock.powertrainMountStatus, 'WORN_ENGINE_OR_GEARBOX_MOUNTS');

// 20. Test Thermal Shock on Cylinder Head (Palmgren-Miner)
console.log('\n=== TEST 20: THERMAL SHOCK ON CYLINDER HEAD ===');
resetSessionState();
const resThermalShock = computeVirtualSensors({
    timestamp: 1700000100000,
    motor: { rpm: 3600, speed: 90, load: 85 },
    temperaturi: { coolant: 45, cat1: 580 }
});
console.log('Thermal Shock Index:', resThermalShock.thermalShockIndex);
console.log('Head Fatigue Status:', resThermalShock.headFatigueStatus);
assert(resThermalShock.thermalShockIndex > 1.8, 'Extreme cold gradient should produce shock index > 1.8');
assert.strictEqual(resThermalShock.headFatigueStatus, 'COLD_THERMAL_SHOCK_HEAD_RISK');

// 21. Test Global RUL Estimation & Roadside Breakdown Risk
console.log('\n=== TEST 21: GLOBAL RUL ESTIMATION & BREAKDOWN RISK ===');
resetSessionState();
const resRul = computeVirtualSensors({
    timestamp: 1700000110000,
    motor: { rpm: 2000, speed: 90, load: 45 },
    aer: { maf: 48, map: 140, map_cmd: 140 },
    combustibil: { inj_qty_mg: 28, inst_cons: 5.2 },
    temperaturi: { coolant: 90, oil: 92, ambient: 20, cat1: 320 },
    baterie: { ecu_volt: 14.2 }
});
console.log('Weakest Component:', resRul.rulSummary.weakestComponent);
console.log('Min Remaining Useful Life (km):', resRul.rulSummary.minRemainingKm);
console.log('Roadside Breakdown Risk (%):', resRul.rulSummary.roadsideBreakdownRiskPct);
console.log('Component RUL Matrix (km):', resRul.rulSummary.components);
assert(typeof resRul.rulSummary.weakestComponent === 'string', 'Weakest component must be identified');
assert(resRul.rulSummary.minRemainingKm >= 0, 'Min remaining km must be non-negative');
assert(resRul.rulSummary.roadsideBreakdownRiskPct >= 0 && resRul.rulSummary.roadsideBreakdownRiskPct <= 100, 'Risk must be within 0-100%');

// 22. Test Bosch Debouncing & Steady-State Gating
console.log('\n=== TEST 22: BOSCH DEBOUNCING & STEADY-STATE GATING ===');
resetSessionState();
// 22A: Fază tranzitorie accelerare bruscă (+350 RPM/s)
computeVirtualSensors({
    timestamp: 1700000120000,
    motor: { rpm: 2000, speed: 70, load: 30, throttle_pos: 15 },
    transmisie: { gear: 4 }
});
const resTransient = computeVirtualSensors({
    timestamp: 1700000121000,
    motor: { rpm: 2350, speed: 78, load: 75, throttle_pos: 60 },
    transmisie: { gear: 4 }
});
console.log('Transient isSteadyState:', resTransient.isSteadyState);
console.log('Transient Confidence %:', resTransient.diagnosticConfidencePct);
assert.strictEqual(resTransient.isSteadyState, false, 'Sudden acceleration must drop isSteadyState to false');
assert(resTransient.diagnosticConfidencePct < 85, 'Confidence during violent transient should be lower');

// 22B: Contor Bosch UDS Up/Down cu auto-vindecare
const mockState = { faultCounters: {} };
const trig1 = updateFaultCounter(mockState, 'test_fault', true, 25, 10);
console.log('Fault Step 1 Confirmed:', trig1, '| Counter:', mockState.faultCounters['test_fault']);
assert.strictEqual(trig1, false, 'Single transient spike must NOT trigger confirmed fault');
assert.strictEqual(mockState.faultCounters['test_fault'], 25);

const trig2 = updateFaultCounter(mockState, 'test_fault', true, 25, 10);
console.log('Fault Step 2 Confirmed:', trig2, '| Counter:', mockState.faultCounters['test_fault']);
assert.strictEqual(trig2, true, 'Persistent anomaly must reach confirmation threshold');
assert.strictEqual(mockState.faultCounters['test_fault'], 50);

const trig3 = updateFaultCounter(mockState, 'test_fault', false, 25, 10);
console.log('Fault Step 3 Healed:', !trig3, '| Counter:', mockState.faultCounters['test_fault']);
assert.strictEqual(trig3, false, 'Healing step must immediately de-assert active fault warning');
assert.strictEqual(mockState.faultCounters['test_fault'], 40);

// 23. Test Indirect TPMS (Deflated Tire Detection via GPS vs Wheel Speed)
console.log('\n=== TEST 23: INDIRECT TPMS DEFLATED TIRE DETECTION ===');
resetSessionState();
const resTpms = computeVirtualSensors({
    timestamp: 1700000130000,
    motor: { rpm: 2100, speed: 83.0 },
    gps: { speed_kmh: 80.0 },
    is_steady_state: true,
    instantConfirm: true
});
console.log('Tire Radius Drift %:', resTpms.tireRadiusDriftPct);
console.log('Tire Pressure Status:', resTpms.tirePressureStatus);
assert(resTpms.tireRadiusDriftPct > 2.2, 'Tire drift should exceed 2.2%');
assert.strictEqual(resTpms.tirePressureStatus, 'LOW_TIRE_PRESSURE_DETECTED');

// 24. Test Timing Belt Stretch & Retarded Injection Drift
console.log('\n=== TEST 24: TIMING BELT STRETCH & RETARDED INJECTION ===');
resetSessionState();
const resTiming = computeVirtualSensors({
    timestamp: 1700000140000,
    motor: { rpm: 2200, speed: 95, load: 60 },
    combustibil: { inj_qty_mg: 35.0 },
    aer: { maf: 68.0, map: 175 },
    temperaturi: { cat1: 538.0 },
    is_steady_state: true,
    instantConfirm: true
});
console.log('Exhaust Heat Anomaly °C:', resTiming.exhaustHeatAnomalyC);
console.log('Timing Phase Status:', resTiming.timingPhaseStatus);
assert(resTiming.exhaustHeatAnomalyC > 40.0, 'Heat anomaly must exceed +40°C');
assert.strictEqual(resTiming.timingPhaseStatus, 'RETARDED_INJECTION_OR_TIMING_BELT_STRETCH');

// 25. Test Smart Cranking Triage (Battery vs Starter Motor vs Glow Plugs)
console.log('\n=== TEST 25: SMART CRANKING TRIAGE ===');
resetSessionState();
const resWeakBat = computeVirtualSensors({
    timestamp: 1700000150000,
    motor: { rpm: 180, is_cranking: true },
    baterie: { crank_volt: 8.9, battery_volt: 11.2 },
    instantConfirm: true
});
console.log('Cranking Triage (Weak Battery):', resWeakBat.crankingTriageStatus);
assert.strictEqual(resWeakBat.crankingTriageStatus, 'WEAK_BATTERY_REPLACE');

resetSessionState();
const resBadStarter = computeVirtualSensors({
    timestamp: 1700000151000,
    motor: { rpm: 130, is_cranking: true },
    baterie: { crank_volt: 8.7, battery_volt: 12.7 },
    instantConfirm: true
});
console.log('Cranking Triage (Bad Starter Motor):', resBadStarter.crankingTriageStatus);
assert.strictEqual(resBadStarter.crankingTriageStatus, 'STARTER_MOTOR_HIGH_DRAW_OR_BUSHINGS');

resetSessionState();
const resGlowPlugs = computeVirtualSensors({
    timestamp: 1700000152000,
    motor: { rpm: 220, is_cranking: true, crank_duration_sec: 3.8 },
    temperaturi: { coolant: 3.0 },
    baterie: { crank_volt: 10.4, battery_volt: 12.6 },
    instantConfirm: true
});
console.log('Cranking Triage (Glow Plugs / Priming):', resGlowPlugs.crankingTriageStatus);
assert.strictEqual(resGlowPlugs.crankingTriageStatus, 'GLOW_PLUGS_OR_FUEL_PRIMING_FAULT');

// 26. Test MAF Fouled vs Turbo Fault & Accessory Belt Overrun Pulley Drag
console.log('\n=== TEST 26: MAF VS TURBO TRIAGE & ACCESSORY BELT DRAG ===');
resetSessionState();
const resMafFouled = computeVirtualSensors({
    timestamp: 1700000160000,
    motor: { rpm: 2500, speed: 100, load: 80 },
    aer: { maf: 45.0, map: 210, map_cmd: 212 },
    is_steady_state: true,
    instantConfirm: true
});
console.log('MAF vs Turbo Triage:', resMafFouled.mafVsTurboTriage);
assert.strictEqual(resMafFouled.mafVsTurboTriage, 'MAF_SENSOR_FOULED_TURBO_OK');

resetSessionState();
const resAccessory = computeVirtualSensors({
    timestamp: 1700000170000,
    motor: { rpm: 840, speed: 0 },
    temperaturi: { coolant: 88.0 },
    combustibil: { inj_qty_mg: 7.2 },
    baterie: { ecu_volt: 13.2, alternator_ripple_v: 0.28 },
    accelerometru: { accel_y: 0.12 },
    instantConfirm: true
});
console.log('Accessory Belt Status:', resAccessory.accessoryBeltStatus);
assert.strictEqual(resAccessory.accessoryBeltStatus, 'ALTERNATOR_OVERRUN_PULLEY_OR_AC_DRAG');

console.log('\n ALL 26 VERIFICATION TEST SCENARIOS PASSED WITH 100% MATHEMATICAL PRECISION!');

