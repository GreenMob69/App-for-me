/**
 * EngineRules.js — Reguli pentru Motor & Admisie
 */
module.exports = [
    {
        id: 'ENG_HIGH_RPM_LOW_SPEED',
        system: 'MOTOR / TRANSMISIE',
        symptom: 'Turație mare (RPM > 3000) la viteză mică (< 25 km/h)',
        condition: (ctx) => {
            const rpm = ctx.live.rpm || ctx.summary.pid?.rpm?.max || 0;
            const speed = ctx.live.speed || ctx.summary.pid?.speed?.average || 0;
            return rpm > 3000 && speed > 2 && speed < 25;
        },
        hypotheses: [
            { cause: 'Ambreiaj uzat (patinează în sarcină)', points: 60 },
            { cause: 'Treaptă de viteză incorect selectată', points: 30 }
        ]
    },
    {
        id: 'ENG_HIGH_LOAD_LOW_MAF',
        system: 'MOTOR',
        symptom: 'Sarcină motor mare cu debit de aer (MAF) scăzut',
        condition: (ctx) => {
            const load = ctx.live.load || ctx.summary.pid?.load?.max || 0;
            const maf = ctx.live.maf || ctx.summary.pid?.maf?.average || 0;
            return load > 75 && maf < 25;
        },
        hypotheses: [
            { cause: 'Filtru de aer extrem de înfundat / murdar', points: 50 },
            { cause: 'Senzor MAF defect sau murdar', points: 45 },
            { cause: 'Admisie de aer obturată mecanic', points: 30 }
        ]
    },
    {
        id: 'ENG_IDLE_RPM_FLUCTUATION',
        system: 'MOTOR',
        symptom: 'Oscilații de turație la ralanti',
        condition: (ctx) => {
            const minRpm = ctx.summary.pid?.rpm?.min || 0;
            const maxRpm = ctx.summary.pid?.rpm?.max || 0;
            const avgSpeed = ctx.summary.pid?.speed?.average || 0;
            return avgSpeed < 5 && (maxRpm - minRpm) > 120 && minRpm < 800 && minRpm > 0;
        },
        hypotheses: [
            { cause: 'Supapă EGR blocată pe deschis / murdară', points: 45 },
            { cause: 'Injectoare cu debit neuniform / uzate', points: 40 },
            { cause: 'Priză falsă de aer pe galerie (Vacuum leak)', points: 35 },
            { cause: 'Senzor MAF instabil', points: 20 }
        ]
    }
];