/**
 * LambdaRules.js — Monitorizare O2 & Stoechiometrie[cite: 15]
 */
module.exports = [
    {
        id: 'LAMBDA_LEAN_POSITIVE_TRIM',
        system: 'LAMBDA / OXIGEN',
        symptom: 'Amestec sărac (Lean) însoțit de corecții de injecție puternic pozitive[cite: 15]',
        condition: (ctx) => {
            const wb = ctx.live.wb_b1s1 || 1.0;
            const sft = ctx.live.sft_b1 || 0;
            return wb > 1.05 && sft > 10;
        },
        hypotheses: [
            { cause: 'Priză falsă de aer (Vacuum leak în galeria de admisie)[cite: 15]', points: 65 },
            { cause: 'Debitmetru de aer (MAF) subraportează debitul real[cite: 15]', points: 45 },
            { cause: 'Presiune scăzută pe linia de alimentare cu combustibil[cite: 15]', points: 35 }
        ]
    },
    {
        id: 'LAMBDA_RICH_MIXTURE',
        system: 'LAMBDA / OXIGEN',
        symptom: 'Amestec bogat (Rich) persistent (< 0.92 λ)[cite: 15]',
        condition: (ctx) => {
            const wb = ctx.live.wb_b1s1 || 1.0;
            return wb < 0.92;
        },
        hypotheses: [
            { cause: 'Injectoare care picură / blocate pe deschis[cite: 15]', points: 60 },
            { cause: 'Senzor MAF supra-raportează debitul de aer[cite: 15]', points: 40 },
            { cause: 'Filtru de aer sever colmatat (lipsă aer în amestec)[cite: 15]', points: 30 }
        ]
    }
];