/**
 * FuelRules.js — Sistemul de Combustibil (Injecție Diesel VP37 / Common Rail)
 */
module.exports = [
    {
        id: 'FUEL_HIGH_CONS_LOW_LOAD',
        system: 'COMBUSTIBIL',
        symptom: 'Consum instant ridicat în regim de sarcină scăzută',
        condition: (ctx) => {
            const load = ctx.live.load || ctx.summary.pid?.load?.average || 0;
            const cons = ctx.live.consum_lh || ctx.summary.fuel?.averageInstant || 0;
            const speed = ctx.live.speed || ctx.summary.pid?.speed?.average || 0;
            return speed > 30 && load < 35 && cons > 7.5; // >7.5 L/h la sarcină mică
        },
        hypotheses: [
            { cause: 'Injectoare uzate / care picură (pulverizare defectuoasă)', points: 55 },
            { cause: 'Presiune de injecție incorectă (Regulator presiune)', points: 40 },
            { cause: 'Filtru de combustibil parțial înfundat', points: 25 }
        ]
    },
    {
        id: 'FUEL_LOW_RAIL_PRESSURE',
        system: 'COMBUSTIBIL',
        symptom: 'Presiune în rampă (Rail Pressure) sub valoarea comandată',
        condition: (ctx) => {
            const railActual = ctx.live.rail_press || 0;
            const railCmd = ctx.live.cmd_press || 0;
            return railCmd > 10000 && railActual < (railCmd * 0.85); // deviație > 15%
        },
        hypotheses: [
            { cause: 'Pompa de înaltă presiune uzată mecanic', points: 60 },
            { cause: 'Regulator de presiune pe rampă (DRV) defect / lent', points: 50 },
            { cause: 'Filtru de combustibil îmbâcsit / restricție pe alimentare', points: 40 }
        ]
    },
    {
        id: 'FUEL_HIGH_TRIMS',
        system: 'COMBUSTIBIL / ADMISIE',
        symptom: 'Corecții mari pe injecție (Fuel Trims > 15%)',
        condition: (ctx) => {
            const lft = Math.abs(ctx.live.lft_b1 || 0);
            const sft = Math.abs(ctx.live.sft_b1 || 0);
            return lft > 15 || sft > 15;
        },
        hypotheses: [
            { cause: 'Priză falsă de aer necontorizată de MAF (Vacuum leak)', points: 50 },
            { cause: 'Injectoare decalibrate sau înfundate', points: 45 },
            { cause: 'Senzor MAF subraportează debitul de aer', points: 35 }
        ]
    }
];