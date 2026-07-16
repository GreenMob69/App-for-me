/**
 * config.js
 * -----------------------------------------------------------------------
 * Toate constantele "reglabile" ale Trip Analyzer stau AICI, într-un singur
 * loc. Vrei să schimbi un prag (ex: de la ce turație consideri "mare")?
 * NU cauți prin tot codul — vii aici.
 *
 * IMPORTANT — FIELD_MAP:
 * Pachetul tău MQTT e organizat pe categorii (`pachet.motor.rpm`,
 * `pachet.temperaturi.coolant`, `pachet.aer.boost_actual`, etc. — exact
 * ca în backend.js-ul tău actual). FIELD_MAP spune analizorului sub ce
 * "cale" găsește fiecare valoare. Dacă redenumești un câmp sau adaugi
 * un PID nou din cele ~90 pe care le ai deja în simulator, îl adaugi
 * AICI — restul codului (TripAnalyzer, HealthEngine, index.js) nu se
 * atinge deloc. Exact avantajul pe care îl voiai.
 * -----------------------------------------------------------------------
 */

const FIELD_MAP = {
    speed:   'motor.speed',
    rpm:     'motor.rpm',
    load:    'motor.load',
    accelG:  'motor.accel_g',
    torque:  'motor.torque_actual',

    coolant: 'temperaturi.coolant',
    oil:     'temperaturi.oil',

    maf:     'aer.maf',
    map:     'aer.map',
    boost:   'aer.boost_actual',

    voltage: 'baterie.ecu_volt',

    fuelRate: 'combustibil.inst_cons',

    dpfSoot: 'dpf.soot_load'

    // Exemplu — la fel cum spuneai în plan: peste o săptămână adaugi
    // Fuel Rail / Lambda / EGR / Oil Pressure fără să atingi backend-ul.
    // lambda:      'lambda.senzor1',
    // egr:         'vvt.egr_pozitie',
    // oilPressure: 'presiuni.ulei_bar',
};

// Lista de PID-uri urmărite generic (current / min / max / medie).
// Se generează automat din FIELD_MAP — un PID nou = o linie mai sus.
const PID_CONFIG = Object.keys(FIELD_MAP).map((key) => ({
    key,
    field: FIELD_MAP[key]
}));

// "Timp petrecut peste un prag" — generic, se pot adăuga oricâte praguri.
// Acoperă cerința 3 (turbo), cerința 4 (temperaturi) și întrebarea
// originală "cât timp a mers peste 3000 RPM?".
const THRESHOLD_CONFIG = [
    { key: 'rpmOver3000',     pid: 'rpm',     min: 3000 },
    { key: 'coolantOver90',   pid: 'coolant', min: 90 },
    { key: 'coolantOver95',   pid: 'coolant', min: 95 },
    { key: 'coolantOver100',  pid: 'coolant', min: 100 },
    { key: 'boostOver1Bar',   pid: 'boost',   min: 1 },
    { key: 'boostOver1_5Bar', pid: 'boost',   min: 1.5 }
];

const THRESHOLDS = {
    // -- ralanti — identic cu pragul folosit deja în backend.js (m.speed < 3) --
    IDLE_SPEED_KMH: 3,

    // -- zonele de RPM (cerința 2) --
    RPM_ZONE_1: 1500,
    RPM_ZONE_2: 2500,
    RPM_ZONE_3: 3500,
    HIGH_RPM_THRESHOLD: 3500,

    // -- load / accelerație --
    HIGH_LOAD_PCT: 80,
    ECONOMIC_LOAD_PCT: 40,

    // -- praguri de accelerație G — IDENTICE cu cele din backend.js-ul
    //    tău actual, ca să nu-ți schimb comportamentul deja calibrat.
    //    accel_g vine direct din pachet (motor.accel_g), deci evenimentele
    //    sunt mult mai precise decât dacă le-am deriva din viteză.
    HARD_ACCEL_G: 0.35,
    HARD_BRAKE_G: -0.40,
    RAPID_DECEL_G: -0.25,   // decelerare vizibilă, dar sub pragul de "frânare bruscă"
    SMOOTH_ACCEL_G: 0.10,   // sub asta = condus "lin"

    // -- kickdown / accelerator la podea --
    // Pachetul tău nu are un câmp separat de poziție-pedală (throttle/TPS),
    // așa că folosim `motor.load` ca proxy (sarcina motorului). Dacă la un
    // moment dat adaugi un PID de throttle real, schimbă doar aici.
    KICKDOWN_LOAD_PCT: 90,
    KICKDOWN_FROM_BELOW_PCT: 50,
    FULL_LOAD_PCT: 90,

    // -- viteză excesivă --
    OVERSPEED_KMH: 130,

    // -- limitare goluri de timp (reconectare MQTT, pauză simulator etc.) --
    MAX_DT_SECONDS: 10,

    // -- cost & emisii per tip combustibil (RON/litru și kg CO₂/litru) --
    DIESEL_PRICE_PER_LITER:   7.50,
    BENZINA_PRICE_PER_LITER:  7.20,
    GPL_PRICE_PER_LITER:      3.80,
    HYBRID_PRICE_PER_LITER:   7.20,   // benzină hibrid

    DIESEL_CO2_KG_PER_LITER:  2.68,   // factor standard motorină
    BENZINA_CO2_KG_PER_LITER: 2.31,   // factor standard benzină
    GPL_CO2_KG_PER_LITER:     1.65,   // factor standard GPL
    HYBRID_CO2_KG_PER_LITER:  2.31
};

module.exports = { FIELD_MAP, PID_CONFIG, THRESHOLD_CONFIG, THRESHOLDS };
