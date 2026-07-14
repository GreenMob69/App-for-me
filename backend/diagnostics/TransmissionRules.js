/**
 * TransmissionRules.js — Transmisie & Ambreiaj[cite: 15]
 */
module.exports = [
    {
        id: 'TRANS_CLUTCH_SLIP',
        system: 'TRANSMISIE',
        symptom: 'Turație motor ridicată în treaptă mare, fără creșterea vitezei vehiculului[cite: 15]',
        condition: (ctx) => {
            const rpm = ctx.live.rpm || 0;
            const gear = ctx.live.gear || 1;
            const slip = ctx.live.slip || 0;
            return gear >= 4 && rpm > 2800 && (slip > 150 || ctx.live.speed < 60);
        },
        hypotheses: [
            { cause: 'Ambreiaj uzat mecanic (patinează sub sarcină în trepte superioare)[cite: 15]', points: 75 },
            { cause: 'Alunecare excesivă în convertizorul de cuplu (la cutii automate)[cite: 15]', points: 55 }
        ]
    },
    {
        id: 'TRANS_FREQUENT_SHIFTING',
        system: 'TRANSMISIE / STIL CONDUS',
        symptom: 'Schimbări extrem de frecvente de treaptă într-un interval scurt[cite: 15]',
        condition: (ctx) => {
            // Evaluat din metadatele de analize pe stil de condus
            return ctx.summary.drivingStyle?.aggressivePct > 40;
        },
        hypotheses: [
            { cause: 'Stil de condus agresiv sau neadaptat traficului[cite: 15]', points: 60 },
            { cause: 'TCU (calculator cutie) necalibrat sau ezitant[cite: 15]', points: 30 }
        ]
    }
];