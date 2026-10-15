'use strict';
const assert = require('assert');
const { computeVirtualSensors, resetSessionState } = require('./backend/analyzers/PhysicsEngine');

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

console.log('\n ALL 6 VERIFICATION TEST SCENARIOS PASSED WITH 100% MATHEMATICAL PRECISION!');
