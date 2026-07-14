/**
 * ExplainabilityEngine.js — Ledger explicativ pentru punctajul de sănătate
 */
function generateExplainabilityLedger(summary) {
    if (!summary) return [];
    const ledger = [];

    // 1. Analiza Temperaturilor (Coolant / Ulei)
    const t = summary.temperature?.coolant || {};
    if (t.timeOver100 > 0) {
        const pts = Math.min(30, Math.round((t.timeOver100 / 60) * 6));
        ledger.push({ sistem: "MOTOR", puncte: -pts, motiv: `Temperatura antigel >100°C timp de ${Math.round(t.timeOver100)}s` });
    } else if (t.timeOver95 > 0) {
        const pts = Math.min(15, Math.round((t.timeOver95 / 60) * 2.5));
        ledger.push({ sistem: "MOTOR", puncte: -pts, motiv: `Temperatura antigel >95°C timp de ${Math.round(t.timeOver95)}s` });
    }

    // 2. Analiza Ralantiului (Idle)
    const totalSec = summary.duration?.totalSeconds || 1;
    const idleSec = summary.duration?.idleSeconds || 0;
    const idlePct = (idleSec / totalSec) * 100;
    if (idlePct > 25 && totalSec > 300) {
        const pts = Math.min(15, Math.round((idlePct - 20) * 0.5));
        ledger.push({ sistem: "COMBUSTIBIL", puncte: -pts, motiv: `Timp excesiv la ralanti (${Math.round(idlePct)}% din cursă)` });
    }

    // 3. Analiza Turațiilor Excesive[cite: 12]
    const highRpmPct = summary.rpmZones?.over3500Pct || 0;
    if (highRpmPct > 10) {
        const pts = Math.min(20, Math.round((highRpmPct - 10) * 0.8));
        ledger.push({ sistem: "MOTOR", puncte: -pts, motiv: `Turații >3500 RPM (${Math.round(highRpmPct)}% din timp)` });
    }

    // 4. Analiza Comportamentului Agresiv (Frânări / Accelerații)[cite: 12]
    const ev = summary.events || {};
    const harshTotal = (ev.hardBrakes || 0) + (ev.hardAccelerations || 0);
    if (harshTotal > 0) {
        const pts = Math.min(25, harshTotal * 3);
        ledger.push({ sistem: "SIGURANTA", puncte: -pts, motiv: `${harshTotal} evenimente de frânare/accelerare bruscă` });
    }

    // 5. Bonus pentru condus economic[cite: 12]
    const ecoPct = summary.drivingStyle?.economicPct || 0;
    if (ecoPct > 50 && harshTotal === 0) {
        ledger.push({ sistem: "STIL_CONDUS", puncte: +5, motiv: `Condus fluent și economic (${Math.round(ecoPct)}% din timp)` });
    }

    return ledger;
}

module.exports = { generateExplainabilityLedger };