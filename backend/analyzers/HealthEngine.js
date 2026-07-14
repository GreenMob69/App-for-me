/**
 * HealthEngine.js
 * -----------------------------------------------------------------------
 * Nivelul 4 (Vehicle Health) din planul tău + cerința 7 (AI Score):
 * Engine Score, Fuel Score, Driving Score, Safety Score, Overall Health.
 *
 * IMPORTANT: ponderile de mai jos sunt un PUNCT DE PORNIRE, gândit ca
 * euristică rezonabilă — nu o formulă validată pe date reale de motor.
 * Le poți (și probabil ar trebui să le) ajustezi pe măsură ce vezi curse
 * reale — și e un subiect foarte bun de discutat/argumentat în lucrarea
 * de licență ("cum am ales ponderile, ce aș rafina").
 * -----------------------------------------------------------------------
 */

function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
}

function engineScore(summary) {
    let score = 100;
    const t = summary.temperature.coolant;
    score -= Math.min(30, (t.timeOver100 / 60) * 6);   // -6 pct/minut peste 100°C
    score -= Math.min(15, (t.timeOver95 / 60) * 2.5);
    score -= Math.min(10, (t.timeOver90 / 60) * 1);
    const highRpmExcess = Math.max(0, summary.rpmZones.over3500Pct - 15);
    score -= Math.min(20, highRpmExcess * 0.6);
    return clamp(score);
}

function fuelScore(summary) {
    let score = 100;
    score -= Math.min(30, summary.drivingStyle.aggressivePct * 0.5);
    const idleRatioPct = summary.duration.totalSeconds > 0
        ? (summary.duration.idleSeconds / summary.duration.totalSeconds) * 100
        : 0;
    score -= Math.min(20, Math.max(0, idleRatioPct - 10) * 0.6);
    return clamp(score);
}

function drivingScore(summary) {
    let score = 100;
    score -= summary.drivingStyle.aggressivePct * 0.6;
    const distance = Math.max(summary.distanceKm, 1); // evită împărțire nerealistă pe trasee foarte scurte
    const harshEvents = summary.events.hardBrakes + summary.events.hardAccelerations + summary.events.rapidDecelerations;
    score -= Math.min(35, (harshEvents / distance) * 100 * 1.5);
    score -= summary.events.kickdowns * 1;
    return clamp(score);
}

function safetyScore(summary) {
    let score = 100;
    score -= summary.events.overspeeds * 4;
    score -= summary.events.hardBrakes * 2;
    score -= summary.events.rapidDecelerations * 1.5;
    score -= Math.min(15, (summary.temperature.coolant.timeOver100 / 60) * 3); // supraîncălzirea e și problemă de siguranță
    return clamp(score);
}

function calculateHealthScore(summary) {
    const engine = engineScore(summary);
    const fuel = fuelScore(summary);
    const driving = drivingScore(summary);
    const safety = safetyScore(summary);

    const overall = clamp(engine * 0.35 + safety * 0.25 + driving * 0.2 + fuel * 0.2);

    return { engineScore: engine, fuelScore: fuel, drivingScore: driving, safetyScore: safety, overallHealth: overall };
}

module.exports = { calculateHealthScore };
