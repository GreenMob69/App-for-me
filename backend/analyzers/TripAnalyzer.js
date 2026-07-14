/**
 * TripAnalyzer.js
 * -----------------------------------------------------------------------
 * Nivelul 3 (Trip Analyzer) din planul tău, cu toate cele 10 cerințe:
 *   1. Stil de condus (smooth / constant / highRPM / highLoad / economic / agresiv)
 *   2. Zone de funcționare a motorului (sub 1500 / 1500-2500 / 2500-3500 / peste 3500)
 *   3. Turbo (medie + timp peste 1 bar / 1.5 bar)
 *   4. Temperaturi (timp peste 90 / 95 / 100 °C)
 *   5. Voltaj (min / max / medie — via sistemul generic de PID-uri)
 *   6. Consum (max instant / mediu instant / relanti / în mișcare)
 *   8. Detectarea comportamentelor (kickdown, accelerare/frânare bruscă, overspeed)
 *   9. KPI-uri (longest idle, longest full-load, highest torque/MAF/load)
 *
 * Scorurile (cerința 7) sunt în HealthEngine.js, iar rezumatul + obiectul
 * pentru AI (cerința 10) sunt în TripSummary.js — TripAnalyzer.js se ocupă
 * DOAR de acumularea brută, per pachet, cât mai ieftin posibil.
 *
 * Folosire din backend.js:
 *
 *   const { createAnalysis, updateAnalyzer } = require('./backend/analyzers');
 *
 *   calatoriiActive[vin].analysis = createAnalysis();   // la PORNIRE
 *   updateAnalyzer(calatoriiActive[vin], pachet);        // la fiecare pachet MERS
 * -----------------------------------------------------------------------
 */

const { PID_CONFIG, THRESHOLD_CONFIG, THRESHOLDS } = require('./config');

// Citește o valoare imbricată dintr-un obiect după o cale de tip 'motor.rpm'.
function getPath(obj, path) {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
}

// -------------------------------------------------------------------------
// 1. Structura goală a analizei — se creează o dată, la PORNIRE.
// -------------------------------------------------------------------------
function createAnalysis() {
    const pid = {};
    for (const cfg of PID_CONFIG) {
        pid[cfg.key] = { current: null, min: Infinity, max: -Infinity, sum: 0, samples: 0 };
    }

    const timeOverThresholds = {};
    for (const t of THRESHOLD_CONFIG) timeOverThresholds[t.key] = 0;

    return {
        meta: {
            samples: 0,
            totalTime: 0,        // secunde reale, calculate din pachet.timestamp (nu doar nr. de pachete)
            lastPacketTime: null,
            lastLoad: null,
            _eventState: {}      // stare internă pt. detectarea evenimentelor (nu intră în rapoarte)
        },

        pid,                     // { rpm:{current,min,max,sum,samples}, coolant:{...}, ... }
        timeOverThresholds,      // { coolantOver95: secunde, boostOver1Bar: secunde, ... }

        rpmZones: { under1500: 0, z1500to2500: 0, z2500to3500: 0, over3500: 0 },

        idle: { time: 0, currentStreak: 0, longestStreak: 0 },
        fullLoad: { time: 0, currentStreak: 0, longestStreak: 0 },

        drivingStyle: {
            smoothTime: 0,
            constantSpeedTime: 0,
            highRPMTime: 0,
            highLoadTime: 0,
            aggressiveTime: 0,
            economicTime: 0
        },

        fuel: { idleConsumption: 0, movingConsumption: 0, idleTime: 0, movingTime: 0 },

        events: { hardBrakes: 0, hardAccelerations: 0, rapidDecelerations: 0, kickdowns: 0, overspeeds: 0 },

        distanceKm: 0
    };
}

// -------------------------------------------------------------------------
// 2. Funcția principală — se apelează pentru FIECARE pachet MERS.
//    Cost: o singură buclă peste PID_CONFIG (~13 chei) + câteva comparații.
//    Nimic nu costă performanță, exact cum voiai.
// -------------------------------------------------------------------------
function updateAnalyzer(trip, pachet) {
    if (!trip.analysis) trip.analysis = createAnalysis();
    const a = trip.analysis;

    const now = pachet.timestamp || Date.now(); // pachet.timestamp e deja în ms, ca în codul tău
    let dt = a.meta.lastPacketTime ? (now - a.meta.lastPacketTime) / 1000 : 0;
    if (dt < 0) dt = 0;
    if (dt > THRESHOLDS.MAX_DT_SECONDS) dt = THRESHOLDS.MAX_DT_SECONDS;

    a.meta.samples++;
    a.meta.totalTime += dt;
    a.meta.lastPacketTime = now;

    updateGenericPidStats(a, pachet);

    const speed = a.pid.speed.current;
    const isIdle = speed !== null && speed < THRESHOLDS.IDLE_SPEED_KMH;

    updateIdle(a, isIdle, dt);
    updateDistance(a, speed, dt);
    updateRpmZones(a, dt);
    updateThresholdTimers(a, dt);
    updateFullLoadStreak(a, dt);
    updateFuel(a, dt, isIdle);
    updateDrivingStyleAndEvents(a, dt, isIdle);
    updateKickdown(a);
    updateOverspeed(a, speed);

    return a;
}

// -------------------------------------------------------------------------
// 3. Sistemul generic de PID-uri — cerința "orice PID poate avea
//    valoare / minim / maxim / medie", fără cod dedicat per PID.
// -------------------------------------------------------------------------
function updateGenericPidStats(a, pachet) {
    for (const cfg of PID_CONFIG) {
        const raw = getPath(pachet, cfg.field);
        if (raw === undefined || raw === null) continue;
        const value = Number(raw);
        if (Number.isNaN(value)) continue;

        const stat = a.pid[cfg.key];
        stat.current = value;
        if (value < stat.min) stat.min = value;
        if (value > stat.max) stat.max = value;
        stat.sum += value;
        stat.samples++;
    }
}

// -------------------------------------------------------------------------
// 4. Ralanti (folosit și la KPI "longest idle")
// -------------------------------------------------------------------------
function updateIdle(a, isIdle, dt) {
    if (isIdle) {
        a.idle.time += dt;
        a.idle.currentStreak += dt;
        if (a.idle.currentStreak > a.idle.longestStreak) a.idle.longestStreak = a.idle.currentStreak;
    } else {
        a.idle.currentStreak = 0;
    }
}

function updateDistance(a, speed, dt) {
    if (speed === null || dt <= 0) return;
    a.distanceKm += (speed * dt) / 3600;
}

// -------------------------------------------------------------------------
// 5. Zona de funcționare a motorului (cerința 2)
// -------------------------------------------------------------------------
function updateRpmZones(a, dt) {
    const rpm = a.pid.rpm.current;
    if (rpm === null || dt <= 0) return;
    if (rpm < THRESHOLDS.RPM_ZONE_1) a.rpmZones.under1500 += dt;
    else if (rpm < THRESHOLDS.RPM_ZONE_2) a.rpmZones.z1500to2500 += dt;
    else if (rpm < THRESHOLDS.RPM_ZONE_3) a.rpmZones.z2500to3500 += dt;
    else a.rpmZones.over3500 += dt;
}

// -------------------------------------------------------------------------
// 6. Timp peste prag — generic (THRESHOLD_CONFIG), acoperă turbo (cerința 3)
//    și temperaturi (cerința 4). Prag nou = o linie în config.js.
// -------------------------------------------------------------------------
function updateThresholdTimers(a, dt) {
    if (dt <= 0) return;
    for (const t of THRESHOLD_CONFIG) {
        const stat = a.pid[t.pid];
        if (!stat || stat.current === null) continue;
        const over = t.min !== undefined ? stat.current >= t.min : stat.current <= t.max;
        if (over) a.timeOverThresholds[t.key] += dt;
    }
}

// -------------------------------------------------------------------------
// 7. Sarcină maximă susținută (KPI "longest full throttle", via load ca proxy)
// -------------------------------------------------------------------------
function updateFullLoadStreak(a, dt) {
    const load = a.pid.load.current;
    if (load === null) return;
    if (load >= THRESHOLDS.FULL_LOAD_PCT) {
        a.fullLoad.time += dt;
        a.fullLoad.currentStreak += dt;
        if (a.fullLoad.currentStreak > a.fullLoad.longestStreak) a.fullLoad.longestStreak = a.fullLoad.currentStreak;
    } else {
        a.fullLoad.currentStreak = 0;
    }
}

// -------------------------------------------------------------------------
// 8. Consum (cerința 6) — separat pe relanti vs. în mișcare.
//    combustibil.inst_cons e în L/h (la fel ca în coloana consum_lh din DB).
// -------------------------------------------------------------------------
function updateFuel(a, dt, isIdle) {
    const rate = a.pid.fuelRate.current;
    if (rate === null || dt <= 0) return;
    const liters = (rate * dt) / 3600;
    if (isIdle) {
        a.fuel.idleConsumption += liters;
        a.fuel.idleTime += dt;
    } else {
        a.fuel.movingConsumption += liters;
        a.fuel.movingTime += dt;
    }
}

// -------------------------------------------------------------------------
// 9. Stil de condus + evenimente (cerințele 1 și 8)
//    Folosim accel_g direct din pachet — e mai precis decât o deltă de
//    viteză și e EXACT sursa pe care o foloseai deja pentru hardBrakes/
//    hardAccelerations, doar că acum evenimentele sunt "debounced": un
//    eveniment de frânare susținut 3 pachete la rând se numără O DATĂ,
//    nu de 3 ori (îmbunătățire față de codul actual).
// -------------------------------------------------------------------------
function updateDrivingStyleAndEvents(a, dt, isIdle) {
    const accelG = a.pid.accelG.current;
    const rpm = a.pid.rpm.current;
    const load = a.pid.load.current;

    // evenimentele se verifică mereu, chiar și la relanti
    detectEvent(a, 'hardAccelerations', accelG !== null && accelG >= THRESHOLDS.HARD_ACCEL_G);
    detectEvent(a, 'hardBrakes', accelG !== null && accelG <= THRESHOLDS.HARD_BRAKE_G);
    detectEvent(a, 'rapidDecelerations', accelG !== null && accelG <= THRESHOLDS.RAPID_DECEL_G && accelG > THRESHOLDS.HARD_BRAKE_G);

    if (isIdle || dt <= 0 || accelG === null) return;

    const magnitude = Math.abs(accelG);

    if (magnitude < THRESHOLDS.SMOOTH_ACCEL_G) a.drivingStyle.smoothTime += dt;
    if (magnitude < THRESHOLDS.SMOOTH_ACCEL_G * 0.6) a.drivingStyle.constantSpeedTime += dt;
    if (rpm !== null && rpm >= THRESHOLDS.HIGH_RPM_THRESHOLD) a.drivingStyle.highRPMTime += dt;
    if (load !== null && load >= THRESHOLDS.HIGH_LOAD_PCT) a.drivingStyle.highLoadTime += dt;

    const isAggressiveInstant =
        accelG >= THRESHOLDS.HARD_ACCEL_G ||
        accelG <= THRESHOLDS.HARD_BRAKE_G ||
        (rpm !== null && rpm >= THRESHOLDS.HIGH_RPM_THRESHOLD && load !== null && load >= THRESHOLDS.HIGH_LOAD_PCT);

    if (isAggressiveInstant) {
        a.drivingStyle.aggressiveTime += dt;
    } else if (load !== null && load < THRESHOLDS.ECONOMIC_LOAD_PCT && magnitude < THRESHOLDS.SMOOTH_ACCEL_G) {
        a.drivingStyle.economicTime += dt;
    }
}

// Numără un eveniment o singură dată per "front crescător" (debounce),
// nu la fiecare pachet cât timp condiția rămâne adevărată.
function detectEvent(a, key, isActiveNow) {
    const wasActive = !!a.meta._eventState[key];
    if (isActiveNow && !wasActive) a.events[key]++;
    a.meta._eventState[key] = isActiveNow;
}

// -------------------------------------------------------------------------
// 10. Kickdown și viteză excesivă (cerința 8)
// -------------------------------------------------------------------------
function updateKickdown(a) {
    const load = a.pid.load.current;
    if (load === null) return;
    const cameFromLow = a.meta.lastLoad !== null && a.meta.lastLoad < THRESHOLDS.KICKDOWN_FROM_BELOW_PCT;
    detectEvent(a, 'kickdowns', load >= THRESHOLDS.KICKDOWN_LOAD_PCT && cameFromLow);
    a.meta.lastLoad = load;
}

function updateOverspeed(a, speed) {
    if (speed === null) return;
    detectEvent(a, 'overspeeds', speed >= THRESHOLDS.OVERSPEED_KMH);
}

module.exports = { createAnalysis, updateAnalyzer };
