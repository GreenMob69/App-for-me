/**
 * BehaviorRules.js — Consum, Stil de Condus & KPI (Metrici Agregate)[cite: 15]
 */
module.exports = [
    {
        id: 'BEHAVIOR_HIGH_IDLE_CONSUMPTION',
        system: 'CONSUM / KPI',
        symptom: 'Consum general crescut din cauza timpului excesiv petrecut la ralanti[cite: 15]',
        condition: (ctx) => {
            const idleSec = ctx.summary.duration?.idleSeconds || 0;
            const totalSec = ctx.summary.duration?.totalSeconds || 1;
            const idleRatio = (idleSec / totalSec) * 100;
            return idleRatio > 35 && totalSec > 600; // peste 35% din timp stând pe loc
        },
        hypotheses: [
            { cause: 'Gestație prelungită la ralanti (necesită oprirea motorului în staționări lungi)[cite: 15]', points: 80 }
        ]
    },
    {
        id: 'BEHAVIOR_AGGRESSIVE_WEAR',
        system: 'STIL CONDUS',
        symptom: 'Număr ridicat de frânări bruște, kickdown-uri și depășiri de viteză[cite: 15]',
        condition: (ctx) => {
            const ev = ctx.summary.events || {};
            return (ev.hardBrakes + ev.kickdowns + ev.overspeeds) > 10;
        },
        hypotheses: [
            { cause: 'Stil de condus agresiv — risc ridicat de uzură prematură a frânelor, suspensiei și ambreiajului[cite: 15]', points: 85 },
            { cause: 'Solicitare termică și mecanică severă asupra turbosuflantei și anvelopelor[cite: 15]', points: 70 }
        ]
    },
    {
        id: 'KPI_EXTREME_STRESS',
        system: 'KPI / MOTOR',
        symptom: 'Sarcină maximă continuă susținută perioade îndelungate (Longest Full Load > 60s)[cite: 15]',
        condition: (ctx) => {
            const fullLoadStreak = ctx.summary.kpis?.longestFullLoadSeconds || 0;
            return fullLoadStreak > 60;
        },
        hypotheses: [
            { cause: 'Vehicul exploatat la limită (tracțiune grea, rampă abruptă sau condus sportiv extrem)[cite: 15]', points: 75 },
            { cause: 'Risc de supraîncălzire locală în chiulasă și degradare accelerată a uleiului[cite: 15]', points: 65 }
        ]
    }
];