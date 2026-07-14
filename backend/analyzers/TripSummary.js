/**
 * TripSummary.js
 * -----------------------------------------------------------------------
 * Transformă acumulatorii bruți din trip.analysis într-un rezumat "gata
 * de afișat" — buildTripSummary() — și în obiectul pregătit pentru AI
 * (cerința 10) — buildAIReport(). Se apelează O SINGURĂ DATĂ, la finalul
 * cursei (OPRIRE), NU la fiecare pachet.
 * -----------------------------------------------------------------------
 */

function average(stat) {
    return stat.samples > 0 ? stat.sum / stat.samples : null;
}

function round(v, decimals = 1) {
    if (v === null || v === undefined) return null;
    const f = Math.pow(10, decimals);
    return Math.round(v * f) / f;
}

function pct(part, whole) {
    return whole > 0 ? round((part / whole) * 100, 1) : 0;
}

function buildTripSummary(trip) {
    const a = trip.analysis;
    if (!a) return null;

    const totalTime = a.meta.totalTime || 0;
    const movingTime = Math.max(totalTime - a.idle.time, 0);

    const pid = {};
    for (const key of Object.keys(a.pid)) {
        const s = a.pid[key];
        pid[key] = {
            current: s.current,
            min: s.samples > 0 ? round(s.min, 2) : null,
            max: s.samples > 0 ? round(s.max, 2) : null,
            average: round(average(s), 2)
        };
    }

    return {
        duration: {
            totalSeconds: Math.round(totalTime),
            idleSeconds: Math.round(a.idle.time),
            movingSeconds: Math.round(movingTime)
        },
        distanceKm: round(a.distanceKm, 2),
        pid,

        rpmZones: {
            under1500Pct: pct(a.rpmZones.under1500, totalTime),
            z1500to2500Pct: pct(a.rpmZones.z1500to2500, totalTime),
            z2500to3500Pct: pct(a.rpmZones.z2500to3500, totalTime),
            over3500Pct: pct(a.rpmZones.over3500, totalTime),
            over3000Seconds: Math.round(a.timeOverThresholds.rpmOver3000 || 0),
            // Vedere pe 3 categorii, ca în exemplul tău (Optimal/High/Idle) — suma = 100%.
            // "idle" aici = timp SUB 1500 RPM (include relanti + mers lin la turație mică).
            // Pentru relanti "adevărat" (viteză ~0), vezi duration.idleSeconds mai sus.
            idlePct: pct(a.rpmZones.under1500, totalTime),
            optimalPct: pct(a.rpmZones.z1500to2500 + a.rpmZones.z2500to3500, totalTime),
            highPct: pct(a.rpmZones.over3500, totalTime)
        },

        // Notă: Economic/Smooth/Aggressive NU sunt neapărat mutual exclusive
        // (exact ca în exemplul tău unde 78%+82%+11% nu dă 100%) — un moment
        // de condus poate fi simultan "smooth" și "economic".
        drivingStyle: {
            smoothPct: pct(a.drivingStyle.smoothTime, movingTime),
            economicPct: pct(a.drivingStyle.economicTime, movingTime),
            aggressivePct: pct(a.drivingStyle.aggressiveTime, movingTime),
            constantSpeedPct: pct(a.drivingStyle.constantSpeedTime, movingTime),
            highRPMPct: pct(a.drivingStyle.highRPMTime, movingTime),
            highLoadPct: pct(a.drivingStyle.highLoadTime, movingTime)
        },

        turbo: {
            averageBar: pid.boost ? pid.boost.average : null,
            timeOver1BarSeconds: Math.round(a.timeOverThresholds.boostOver1Bar || 0),
            timeOver1_5BarSeconds: Math.round(a.timeOverThresholds.boostOver1_5Bar || 0)
        },

        temperature: {
            coolant: {
                timeOver90: Math.round(a.timeOverThresholds.coolantOver90 || 0),
                timeOver95: Math.round(a.timeOverThresholds.coolantOver95 || 0),
                timeOver100: Math.round(a.timeOverThresholds.coolantOver100 || 0)
            }
        },

        fuel: {
            maxInstant: pid.fuelRate ? pid.fuelRate.max : null,
            averageInstant: pid.fuelRate ? pid.fuelRate.average : null,
            idleLiters: round(a.fuel.idleConsumption, 3),
            movingLiters: round(a.fuel.movingConsumption, 3)
        },

        events: { ...a.events },

        kpis: {
            longestIdleSeconds: Math.round(a.idle.longestStreak),
            longestFullLoadSeconds: Math.round(a.fullLoad.longestStreak),
            highestTorque: pid.torque ? pid.torque.max : null,
            highestMAF: pid.maf ? pid.maf.max : null,
            highestLoad: pid.load ? pid.load.max : null
        }
    };
}

function buildAIReport(summary, health) {
    // Cerința 10 — structura exactă pe care ai cerut-o, pregătită pentru
    // GPT, dar NEfolosită încă ("nu îl folosim încă, dar peste câteva
    // etape îl trimitem direct la AI").
    return {
        engine: {
            rpm: summary.pid.rpm,
            load: summary.pid.load,
            torque: summary.pid.torque,
            score: health.engineScore
        },
        cooling: {
            coolant: summary.pid.coolant,
            oil: summary.pid.oil,
            timeOverThresholds: summary.temperature.coolant
        },
        turbo: {
            boost: summary.pid.boost,
            average: summary.turbo.averageBar,
            timeOver1Bar: summary.turbo.timeOver1BarSeconds,
            timeOver1_5Bar: summary.turbo.timeOver1_5BarSeconds
        },
        fuel: {
            ...summary.fuel,
            score: health.fuelScore
        },
        battery: {
            voltage: summary.pid.voltage
        },
        driving: {
            style: summary.drivingStyle,
            rpmZones: summary.rpmZones,
            events: summary.events,
            kpis: summary.kpis,
            score: health.drivingScore
        },
        overallHealth: health.overallHealth,
        safetyScore: health.safetyScore
    };
}

module.exports = { buildTripSummary, buildAIReport };
