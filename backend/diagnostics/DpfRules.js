/**
 * DpfRules.js — Sistemul de Emisii Diesel (DPF & Evacuare)[cite: 15]
 */
module.exports = [
    {
        id: 'DPF_HIGH_SOOT_LOW_TEMP',
        system: 'DPF (DIESEL)',
        symptom: 'Încărcare mare de funingine (Soot) fără inițiere regenerare (EGT < 250°C)[cite: 15]',
        condition: (ctx) => {
            const soot = ctx.live.dpf_soot || 0;
            const egt = ctx.live.egt1 || 200;
            return soot > 35 && egt < 250;
        },
        hypotheses: [
            { cause: 'DPF sever înfundat — condițiile de regim de drum nu permit regenerarea[cite: 15]', points: 60 },
            { cause: 'Termostat defect (motorul nu atinge temperatura de regim pt regenerare)[cite: 15]', points: 50 },
            { cause: 'Senzor presiune diferențială DPF decalibrat[cite: 15]', points: 35 }
        ]
    },
    {
        id: 'DPF_ACTIVE_REGEN',
        system: 'DPF (DIESEL)',
        symptom: 'Încărcare mare de funingine și temperaturi de evacuare extreme (EGT > 550°C)[cite: 15]',
        condition: (ctx) => {
            const egt = ctx.live.egt1 || ctx.live.egt2 || 200;
            return egt > 550;
        },
        hypotheses: [
            { cause: 'Regenerare activă DPF în curs de desfășurare (Regim normal de curățare)[cite: 15]', points: 90 }
        ]
    }
];