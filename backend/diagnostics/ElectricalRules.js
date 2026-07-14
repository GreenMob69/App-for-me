/**
 * ElectricalRules.js — Sistemul Electric (Terminal 30/15, Alternator, Baterie)[cite: 15]
 */
module.exports = [
    {
        id: 'ELEC_LOW_VOLTAGE_RUNNING',
        system: 'BATERIE & ELECTRIC',
        symptom: 'Tensiune scăzută în rețea (< 13.4V) la turație de lucru (RPM > 2000)[cite: 15]',
        condition: (ctx) => {
            const volt = ctx.live.ecu_volt || ctx.summary.pid?.voltage?.min || 14.1;
            const rpm = ctx.live.rpm || ctx.summary.pid?.rpm?.average || 0;
            return rpm > 2000 && volt < 13.4;
        },
        hypotheses: [
            { cause: 'Alternator uzat (punte diode sau cărbuni degradați)[cite: 15]', points: 70 },
            { cause: 'Curea de accesorii (transmisie) slabă sau care patinează[cite: 15]', points: 45 },
            { cause: 'Conexiuni de masă oxidate (cădere de tensiune pe cabluri)[cite: 15]', points: 30 }
        ]
    },
    {
        id: 'ELEC_OVERVOLTAGE',
        system: 'BATERIE & ELECTRIC',
        symptom: 'Supra-tensiune periculoasă în rețeaua ECU (> 14.8V)[cite: 15]',
        condition: (ctx) => {
            const volt = ctx.live.ecu_volt || ctx.summary.pid?.voltage?.max || 14.1;
            return volt > 14.8;
        },
        hypotheses: [
            { cause: 'Regulator de tensiune al alternatorului defect[cite: 15]', points: 85 },
            { cause: 'Baterie cu sulfatare severă (rezistență internă uriașă)[cite: 15]', points: 30 }
        ]
    },
    {
        id: 'ELEC_CONTINUOUS_DROP',
        system: 'BATERIE',
        symptom: 'Scădere continuă de tensiune în timpul sesiunii[cite: 15]',
        condition: (ctx) => {
            const minV = ctx.summary.pid?.voltage?.min || 14;
            const maxV = ctx.summary.pid?.voltage?.max || 14;
            return (maxV - minV) > 1.5 && minV < 12.2;
        },
        hypotheses: [
            { cause: 'Baterie auto ajunsă la sfârșitul duratei de viață (SOH scăzut)[cite: 15]', points: 60 },
            { cause: 'Consumator parazit major sau alternator nefuncțional[cite: 15]', points: 50 }
        ]
    }
];