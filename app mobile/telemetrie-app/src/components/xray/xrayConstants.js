'use strict';

/**
 * xrayConstants.js — Definiții universale de date, arhetipuri și senzori OBD-II
 */

export const TOPOLOGIES = {
    TRANSVERSAL_FWD: {
        id: 'TRANSVERSAL_FWD',
        label: '🔄 Transversal FWD',
        shortLabel: 'Transversal',
        arch: 'Platforme Globale MQB / PQ / CMF',
        examples: 'VW Golf, Skoda Octavia, Focus, Logan, Duster, Megane, Corolla',
        desc: 'Motor transversal de-a latul punții față, cutie transaxle laterală, planetare față asimetrice.',
        cylinders: 4,
    },
    LONGITUDINAL_AWD_FWD: {
        id: 'LONGITUDINAL_AWD_FWD',
        label: '📐 Longitudinal FWD/AWD',
        shortLabel: 'Longitudinal AWD',
        arch: 'Audi MLP / MLB / Quattro & Subaru',
        examples: 'Audi A4, A6, A8, Passat B5, Subaru Outback',
        desc: 'Motor longitudinal în consolă frontală, cutie mediană lungă cu diferențial central Torsen/Crown.',
        cylinders: 5,
    },
    LONGITUDINAL_RWD: {
        id: 'LONGITUDINAL_RWD',
        label: '⚡ RWD Clasic / Spate',
        shortLabel: 'Longitudinal RWD',
        arch: 'BMW CLAR / Mercedes MRA / Alpha RWD',
        examples: 'BMW Seria 3/5, Mercedes C/E-Class, Lexus IS, Mustang',
        desc: 'Motor longitudinal retras spre habitaclu (mase 50:50), cardan median, diferențial punte spate.',
        cylinders: 6,
    },
    SKATEBOARD_BEV: {
        id: 'SKATEBOARD_BEV',
        label: '🔋 EV Skateboard Plat',
        shortLabel: 'EV Skateboard',
        arch: 'Tesla Skate / MEB / PPE / E-GMP',
        examples: 'Tesla Model 3/Y, Porsche Taycan, VW ID.4, Ioniq 5',
        desc: 'Pachet baterie Li-Ion plat în podea, motoare electrice compacte pe punți, fără eșapament.',
        cylinders: 0,
    },
};

export function detectVehicleTopology(vehicle) {
    const text = `${vehicle?.make || ''} ${vehicle?.model || ''} ${vehicle?.variant || ''} ${vehicle?.label || ''} ${typeof vehicle === 'string' ? vehicle : ''}`.toUpperCase();
    if (text.includes('TESLA') || text.includes('EV') || text.includes('ELECTRIC') || text.includes('TAYCAN') || text.includes('ID.3') || text.includes('ID.4') || text.includes('IONIQ')) {
        return 'SKATEBOARD_BEV';
    }
    if (text.includes('BMW') || text.includes('MERCEDES') || text.includes('MIATA') || text.includes('RWD') || text.includes('SERIA 3') || text.includes('SERIA 5') || text.includes('C-CLASS') || text.includes('E-CLASS')) {
        return 'LONGITUDINAL_RWD';
    }
    if (
        text.includes('GOLF') || text.includes('PASSAT B6') || text.includes('PASSAT B7') || text.includes('PASSAT B8') ||
        text.includes('OCTAVIA') || text.includes('LEON') || text.includes('LOGAN') || text.includes('DUSTER') ||
        text.includes('SANDERO') || text.includes('MEGANE') || text.includes('CLIO') || text.includes('FOCUS') ||
        text.includes('FIESTA') || text.includes('COROLLA') || text.includes('CIVIC') || text.includes('TRANSVERSAL')
    ) {
        return 'TRANSVERSAL_FWD';
    }
    return 'LONGITUDINAL_AWD_FWD';
}

// ─────────────────────────────────────────────────────────────────────────────
// ZONE ANATOMICE MACRO (Profunzime & Ierarhie Logică)
// ─────────────────────────────────────────────────────────────────────────────

export const ZONES = [
    {
        id: 'OVERVIEW',
        label: 'VEDERE GENERALĂ',
        icon: '🚗',
        desc: 'Privire de ansamblu asupra stării celor 3 compartimente cheie ale mașinii.',
    },
    {
        id: 'ENGINE_BAY',
        label: 'SUB CAPOTĂ',
        icon: '🔧',
        desc: 'Compartiment motor, admisie aer, alimentare și răcire.',
    },
    {
        id: 'UNDERBODY',
        label: 'ȘASIU & TREN RULARE',
        icon: '⚙️',
        desc: 'Transmisie, ambreiaj, cardan și traseu eșapament / filtru DPF.',
    },
    {
        id: 'WHEELS_BRAKES',
        label: 'FRÂNE & DINAMICĂ',
        icon: '🛑',
        desc: 'Discuri de frână ventilate, etriere și baie de ulei inferioară.',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORII PENTRU FIECARE ZONĂ (Fără aglomerație de senzori)
// ─────────────────────────────────────────────────────────────────────────────

export const ZONE_SUBCATEGORIES = {
    ENGINE_BAY: [
        { id: 'AIR_BOOST',    label: '🌬️ Circuit Aer & Boost', desc: 'Debitmetru, tubulatură intercooler și turbină' },
        { id: 'FUEL_ING',     label: '⛽ Injecție & EGR',        desc: 'Rampă combustibil, injectoare și recirculare gaze' },
        { id: 'COOLING_ELEC', label: '💧 Răcire & 12V',          desc: 'Termostat, antigel, alternator și baterie' },
    ],
    UNDERBODY: [
        { id: 'DRIVETRAIN', label: '🏎️ Transmisie & Cuplu', desc: 'Cutie viteze, ambreiaj și diferențial' },
        { id: 'EXHAUST',    label: '💨 Evacuare & DPF',       desc: 'Catalizator, filtru particule și contrapresiune' },
    ],
    WHEELS_BRAKES: [
        { id: 'BRAKES_FRONT', label: '🛞 Punte Față', desc: 'Discuri ventilate și etriere față' },
        { id: 'BRAKES_REAR',  label: '🛞 Punte Spate', desc: 'Discuri și mecanism frână parcare' },
        { id: 'OIL_SUMP',     label: '🛢️ Baie Ulei',  desc: 'Stres termic ulei conform Arrhenius' },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SENZORI STRUCTURAȚI PE SUB-CATEGORII
// ─────────────────────────────────────────────────────────────────────────────

export const SENSORS_BY_CATEGORY = {
    // ── SUB CAPOTĂ ──
    AIR_BOOST: [
        {
            id: 'maf',
            name: 'Debitmetru MAF & Cutie Filtru Aer',
            code: 'G70 / MAF',
            subsystem: 'turbo',
            nominal: '11.0 – 16.0 g/s la relanti · max 140 g/s',
            nominalMin: 10.0,
            nominalMax: 130.0,
            unit: 'g/s',
            location: 'Integrat în tubulatura de admisie din plastic, imediat după filtrul de aer.',
            coords: { x: 55, y: 130 },
            getReading: (live) => {
                const val = live?.aer?.maf_gs || live?.maf || 14.2;
                return { val: `${Number(val).toFixed(1)} g/s`, rawNum: Number(val), status: 'optimal', note: 'Debit aer stabil' };
            },
            diag: 'Debit volumetric corelat cu turația. Fir cald curat, fără depuneri din carter.',
            aiPrompt: 'Analizează semnalul senzorului MAF (debit aer în g/s) și confirmă dacă există pierderi de vacuum.',
        },
        {
            id: 'map_ic',
            name: 'Traseu Intercooler & Senzor MAP',
            code: 'G71 / MAP',
            subsystem: 'turbo',
            nominal: '98 – 102 kPa atmosferic · 215 kPa la boost',
            nominalMin: 95,
            nominalMax: 240,
            unit: 'kPa',
            location: 'Pe tubulatura presurizată din aluminiu/silicon de după radiatorul intercooler.',
            coords: { x: 170, y: 70 },
            getReading: (live) => {
                const val = live?.aer?.map_kpa || live?.map || 115;
                return { val: `${Number(val).toFixed(0)} kPa`, rawNum: Number(val), status: 'optimal', note: 'Presiune absolută' };
            },
            diag: 'Etanșeitate circuit presiune 100%. Nu există pierderi prin coliere sau fisuri intercooler.',
            aiPrompt: 'Evaluează integritatea traseului intercooler și verifică dacă senzorul MAP raportează pierderi de presiune (boost leak).',
        },
        {
            id: 'turbo_vnt',
            name: 'Turbosuflantă VNT & Actuator N75',
            code: 'VNT / N75',
            subsystem: 'turbo',
            nominal: '0.0 bar relanti · 1.15 – 1.35 bar boost max',
            nominalMin: 0.0,
            nominalMax: 1.5,
            unit: 'bar',
            location: 'Montată lateral pe galeria de evacuare; actuator vacuum sau servomotor electronic.',
            coords: { x: 80, y: 225 },
            getReading: (live) => {
                const val = live?.turbo?.boost_bar || live?.aer?.boost_bar || live?.boost || 1.15;
                return { val: `${Number(val).toFixed(2)} bar`, rawNum: Number(val), status: 'optimal', note: 'Presiune turbo' };
            },
            diag: 'Geometrie variabilă fluidă, fără blocaje de funingine. Reglajul N75 răspunde instant.',
            aiPrompt: 'Verifică dacă presiunea de boost urmărește cerința ECU și dacă există fluctuații de overboost.',
        },
    ],
    FUEL_ING: [
        {
            id: 'injection',
            name: 'Rampă Injecție / Pompă & Injectoare',
            code: 'INJ / FUEL',
            subsystem: 'motor',
            nominal: '3.5 – 6.0 mg/str la relanti · 280–350 bar / 1600 bar',
            nominalMin: 3.0,
            nominalMax: 60.0,
            unit: 'mg/str',
            location: 'Rampă comună montată pe chiuloasă cu conducte metalice spre fiecare injector.',
            coords: { x: 170, y: 155 },
            getReading: (live) => {
                const val = live?.combustibil?.inj_qty_mg || live?.motor?.inj_qty || 4.2;
                return { val: `${Number(val).toFixed(1)} mg/str`, rawNum: Number(val), status: 'optimal', note: 'Debit compensat' };
            },
            diag: 'Corecții debit pe cilindri perfect echilibrate (±0.25 mg/str). Presiune combustibil stabilă.',
            aiPrompt: 'Analizează cantitatea injectată de combustibil, deviațiile pe cilindri și presiunea sistemului de injecție.',
        },
        {
            id: 'egr',
            name: 'Supapă Recirculare Gaze EGR & Admisie',
            code: 'EGR / N18',
            subsystem: 'motor',
            nominal: '0% în sarcină maximă · 20–55% la croazieră',
            nominalMin: 0,
            nominalMax: 65,
            unit: '%',
            location: 'Fixată pe galeria de admisie, conectată la țeava de recirculare gaze arse.',
            coords: { x: 235, y: 155 },
            getReading: (live) => {
                const val = live?.aer?.egr_pct ?? 15;
                return { val: `${Number(val).toFixed(0)}%`, rawNum: Number(val), status: 'optimal', note: 'Ciclare clapetă' };
            },
            diag: 'Clapetă curată. Ciclarea pneumatică/electrică este precisă și fără întârzieri.',
            aiPrompt: 'Care este starea supapei EGR și a galeriei de admisie? Există risc de îmbâcsire cu calamină?',
        },
    ],
    COOLING_ELEC: [
        {
            id: 'cooling',
            name: 'Termostat, Pompă Apă & Senzor ECT (G62)',
            code: 'G62 / ECT',
            subsystem: 'racire',
            nominal: '87 – 92°C temperatură de regim optim',
            nominalMin: 80,
            nominalMax: 105,
            unit: '°C',
            location: 'Flanșă termostat pe blocul motor spre furtunul superior al radiatorului frontal.',
            coords: { x: 170, y: 265 },
            getReading: (live) => {
                const val = live?.temperaturi?.temp_apa_c || live?.coolant || 90;
                return { val: `${Number(val).toFixed(0)}°C`, rawNum: Number(val), status: 'optimal', note: 'Antigel motor' };
            },
            diag: 'Termostatul deschide la 87°C. Schimbul termic prin radiator este uniform.',
            aiPrompt: 'Evaluează regimul termic al motorului, stabilitatea temperaturii lichidului de răcire și eficiența radiatorului.',
        },
        {
            id: 'battery_alt',
            name: 'Alternator & Baterie 12V / Management Energie',
            code: '12V / ALT',
            subsystem: 'electric',
            nominal: '13.8 – 14.5 V cu motorul pornit (12.6V repaus)',
            nominalMin: 12.0,
            nominalMax: 14.8,
            unit: 'V',
            location: 'Alternator antrenat de cureaua de accesorii; bornă management baterie cu senzor IBS.',
            coords: { x: 265, y: 245 },
            getReading: (live) => {
                const val = live?.baterie?.ecu_volt || live?.voltage || 14.1;
                return { val: `${Number(val).toFixed(1)} V`, rawNum: Number(val), status: 'optimal', note: 'Tensiune încărcare' };
            },
            diag: 'Punte redresoare stabilă (ripple < 0.15V). Starea de sănătate (SoH) estimată la 94%.',
            aiPrompt: 'Analizează tensiunea de încărcare a alternatorului și starea bateriei de pornire.',
        },
    ],

    // ── ȘASIU & TREN RULARE ──
    DRIVETRAIN: [
        {
            id: 'clutch_gearbox',
            name: 'Ambreiaj, Volant & Cutie de Viteze',
            code: 'CUTIE / AMBREIAJ',
            subsystem: 'transmisie',
            nominal: 'Patinare ambreiaj: 0% în sarcină',
            nominalMin: 0,
            nominalMax: 8,
            unit: '%',
            location: 'Tunelul median al caroseriei, între blocul motor și axul cardanic/planetare.',
            coords: { x: 175, y: 175 },
            getReading: (live) => {
                const slip = live?.transmisie?.clutch_slip ?? 0;
                return { val: `${Number(slip).toFixed(0)}% slip`, rawNum: Number(slip), status: 'optimal', note: 'Cuplaj mecanic' };
            },
            diag: 'Aderență perfectă a discului de ambreiaj sub cuplu maxim. Sincronizare lină a treptelor.',
            aiPrompt: 'Analizează starea ambreiajului și cutiei de viteze. Există semne de patinare sau joc în volant?',
        },
    ],
    EXHAUST: [
        {
            id: 'dpf_exhaust',
            name: 'Linie Evacuare, Catalizator & Filtru DPF',
            code: 'DPF / EVACUARE',
            subsystem: 'dpf',
            nominal: 'Presiune diferențială < 3.5 kPa · Masă < 60g',
            nominalMin: 0,
            nominalMax: 50,
            unit: 'g',
            location: 'Traseul de evacuare sub podea, protejat de ecrane termice din aluminiu.',
            coords: { x: 235, y: 186 },
            getReading: (live) => {
                const val = live?.dpf?.soot_load || 0.0;
                return { val: `${Number(val).toFixed(1)} g`, rawNum: Number(val), status: 'optimal', note: 'Încărcare funingine' };
            },
            diag: 'Contrapresiune în limite optime. Permeabilitatea miezului ceramic permite evacuarea liberă a gazelor.',
            aiPrompt: 'Care este starea filtrului de particule/catalizatorului și când este estimată următoarea regenerare?',
        },
    ],

    // ── FRÂNE & DINAMICĂ ──
    BRAKES_FRONT: [
        {
            id: 'brakes_front',
            name: 'Frâne Punte Față & Discuri Ventilate',
            code: 'FRÂNE FAȚĂ',
            subsystem: 'transmisie',
            nominal: 'Disipare normală călătorie: < 15 MJ (Archard)',
            nominalMin: 0,
            nominalMax: 20,
            unit: 'MJ',
            location: 'Punte față: etriere cu plăcuțe de fricțiune pe discuri ventilate.',
            coords: { x: 84, y: 180 },
            getReading: (live) => {
                const val = live?.virtual?.brakeEnergyTripMj || 0.0;
                return { val: `${Number(val).toFixed(1)} MJ`, rawNum: Number(val), status: 'optimal', note: 'Energie Archard' };
            },
            diag: 'Rezistență parazită la rulare nulă. Etrierele culisează liber, fără risc de supraîncălzire.',
            aiPrompt: 'Verifică modelul Archard de disipare pe frânele din față și confirmă dacă există rezistență la rulare (drag).',
        },
    ],
    BRAKES_REAR: [
        {
            id: 'brakes_rear',
            name: 'Frâne Punte Spate & Etrier Frână Mână',
            code: 'FRÂNE SPATE',
            subsystem: 'transmisie',
            nominal: 'Repartiție forță frânare spate: 25–35%',
            nominalMin: 20,
            nominalMax: 40,
            unit: '%',
            location: 'Punte spate: discuri pline și etriere cu acționare a frânei de parcare.',
            coords: { x: 318, y: 180 },
            getReading: () => {
                return { val: 'Nominal', rawNum: 95, status: 'optimal', note: 'Uzură redusă (~15%)' };
            },
            diag: 'Ghidajele etrierelor culisează liber. Discurile prezintă uzură uniformă fără șanțuri.',
            aiPrompt: 'Verifică eficiența frânelor de pe puntea spate și starea mecanismului de frână de parcare.',
        },
    ],
    OIL_SUMP: [
        {
            id: 'oil_sump',
            name: 'Baie Ulei Motor & Senzor Nivel/Temp',
            code: 'BAIE ULEI',
            subsystem: 'racire',
            nominal: 'Factor degradare Arrhenius: 1.0x (la 90°C)',
            nominalMin: 0.8,
            nominalMax: 2.5,
            unit: 'x',
            location: 'Punctul inferior al blocului motor, protejat de scutul de protecție.',
            coords: { x: 130, y: 186 },
            getReading: (live) => {
                const val = live?.virtual?.oilLifeWearFactor || 1.0;
                return { val: `${Number(val).toFixed(2)}x`, rawNum: Number(val), status: 'optimal', note: 'Degradare Arrhenius' };
            },
            diag: 'Vâscozitate optimă a peliculei de ungere. Fără supraîncălzire sau diluare cu combustibil.',
            aiPrompt: 'Evaluează starea uleiului de motor conform legii de degradare termică Arrhenius.',
        },
    ],
};
