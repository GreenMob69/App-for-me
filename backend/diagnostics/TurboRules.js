/**
 * TurboRules.js — Reguli pentru Sistemul Turbo
 */
module.exports = [
    {
        id: 'TURBO_LOW_BOOST_HIGH_RPM',
        system: 'TURBO',
        symptom: 'Presiune Boost scăzută la turații mari',
        condition: (ctx) => {
            const rpm = ctx.live.rpm || ctx.summary.pid?.rpm?.max || 0;
            const boost = ctx.live.boost_actual || ctx.summary.turbo?.averageBar || 0;
            return rpm > 3000 && boost < 0.6;
        },
        hypotheses: [
            { cause: 'Pierdere pe linia de Vacuum / Furtun spart', points: 40 },
            { cause: 'Electrovalvă N75 defectă / blocată', points: 35 },
            { cause: 'Geometrie variabilă (VNT) blocată', points: 30 },
            { cause: 'Turbosuflantă uzată mecanic', points: 25 }
        ]
    },
    {
        id: 'TURBO_DTC_P0299',
        system: 'TURBO',
        symptom: 'Cod eroare P0299 (Underboost) prezent',
        condition: (ctx) => ctx.dtc.some(d => d.cod === 'P0299' || d.cod === '16683'),
        hypotheses: [
            { cause: 'Pierdere pe linia de Vacuum / Furtun spart', points: 50 },
            { cause: 'Turbosuflantă uzată mecanic', points: 45 },
            { cause: 'Electrovalvă N75 defectă / blocată', points: 40 }
        ]
    },
    {
        id: 'TURBO_MAP_HIGH_MAF_LOW',
        system: 'TURBO',
        symptom: 'Discrepanță: Presiune MAP mare dar debit MAF mic',
        condition: (ctx) => {
            const map = ctx.live.map || ctx.summary.pid?.map?.average || 0;
            const maf = ctx.live.maf || ctx.summary.pid?.maf?.average || 0;
            return map > 180 && maf < 20;
        },
        hypotheses: [
            { cause: 'Senzor MAP decalibrat / defect', points: 60 },
            { cause: 'Senzor MAF murdar sau defect', points: 40 }
        ]
    }
];