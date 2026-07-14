/**
 * demo.js — test rapid, fără MQTT/DB reale.
 * Rulează cu: node backend/analyzers/demo.js
 */

const { createAnalysis, updateAnalyzer, finalizeTripAnalysis } = require('./index');

const trip = { analysis: createAnalysis() };

let t = Date.now();
function tick(p) {
    t += 1000;
    updateAnalyzer(trip, {
        timestamp: t,
        motor: { speed: p.speed, rpm: p.rpm, load: p.load, accel_g: p.accelG, torque_actual: p.torque },
        temperaturi: { coolant: p.coolant, oil: p.oil },
        aer: { maf: p.maf, map: p.map || 101, boost_actual: p.boost },
        baterie: { ecu_volt: p.voltage },
        combustibil: { inst_cons: p.fuelRate },
        dpf: { soot_load: p.dpf || 0.1 }
    });
}

// relanti, 11s
for (let i = 0; i < 10; i++) tick({ speed: 0, rpm: 850, load: 15, accelG: 0.01, torque: 20, coolant: 70, oil: 65, maf: 3, boost: 0, voltage: 13.8, fuelRate: 0.8 });
tick({ speed: 0, rpm: 900, load: 30, accelG: 0.02, torque: 40, coolant: 71, oil: 66, maf: 4, boost: 0, voltage: 13.8, fuelRate: 0.9 });

// kickdown + accelerare bruscă
tick({ speed: 25, rpm: 3800, load: 92, accelG: 0.42, torque: 320, coolant: 72, oil: 68, maf: 45, boost: 1.2, voltage: 13.5, fuelRate: 6.5 });

// mers constant, economic, 60s
for (let i = 0; i < 60; i++) tick({ speed: 90, rpm: 2100, load: 35, accelG: 0.02, torque: 180, coolant: 91, oil: 95, maf: 18, boost: 0.4, voltage: 14.1, fuelRate: 4.2 });

// frânare bruscă
tick({ speed: 60, rpm: 1800, load: 20, accelG: -0.45, torque: 90, coolant: 92, oil: 96, maf: 10, boost: 0.1, voltage: 14.0, fuelRate: 2.0 });

// coolant peste 95°C, 30s
for (let i = 0; i < 30; i++) tick({ speed: 100, rpm: 2600, load: 50, accelG: 0.03, torque: 210, coolant: 96 + (i % 5) / 10, oil: 98, maf: 22, boost: 0.6, voltage: 14.0, fuelRate: 5.0 });

const rezultat = finalizeTripAnalysis(trip);
console.log(JSON.stringify(rezultat, null, 2));
