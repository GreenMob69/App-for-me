/**
 * DtcRules.js — Corelarea Codurilor de Eroare (DTC) cu Punctaj Maxim (95-100%)[cite: 15]
 */
module.exports = [
    {
        id: 'DTC_P0101_MAF_CORRELATION',
        system: 'DTC / AER',
        symptom: 'Cod eroare P0101 prezent + debit de aer MAF scăzut[cite: 15]',
        condition: (ctx) => {
            const hasP0101 = ctx.dtc.some(d => d.cod === 'P0101');
            const maf = ctx.live.maf || ctx.summary.pid?.maf?.average || 100;
            return hasP0101 && maf < 25;
        },
        hypotheses: [
            { cause: 'Senzor MAF defect (necesită înlocuire sau curățare cu spray dedicat)[cite: 15]', points: 100 }
        ]
    },
    {
        id: 'DTC_P0234_OVERBOOST',
        system: 'DTC / TURBO',
        symptom: 'Cod eroare P0234 (Overboost Condition) înregistrat în ECU[cite: 15]',
        condition: (ctx) => ctx.dtc.some(d => d.cod === 'P0234' || d.cod === '16618'),
        hypotheses: [
            { cause: 'Actuator turbosuflantă / Geometrie variabilă (VNT) blocată mecanic[cite: 15]', points: 95 },
            { cause: 'Electrovalvă N75 defectă pe retur presiune[cite: 15]', points: 70 }
        ]
    }
];