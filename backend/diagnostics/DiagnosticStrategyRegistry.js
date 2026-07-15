/**
 * DiagnosticStrategyRegistry.js — cum investigăm o problemă
 * -----------------------------------------------------------------------
 * Separare de responsabilitate clară față de KnowledgePack:
 *
 *   KnowledgePack   → "Ce știm despre acest vehicul?"
 *                      (probleme cunoscute, praguri, intervale service)
 *
 *   DiagnosticStrategy → "Cum investigăm această problemă?"
 *                      (pași ordonați, evaluare semnale, cauze posibile)
 *
 * Fiecare strategie poate fi consumată de două module:
 *
 *   FaultPredictionEngine — apelează strategy.evaluate(ctx) pentru
 *     pattern-urile din KnowledgePack care nu au funcție proprie de evaluare
 *     (pack-urile sunt JSON pur; logica de evaluare stă DOAR aici).
 *
 *   RuleEngine — apelează resolveForSystem(system) pentru a atașa
 *     pașii de investigație la fiecare diagnostic confirmat prin reguli.
 *
 *   AI Expert (viitor) — poate folosi investigationSteps pentru a genera
 *     o narativă structurată de diagnoză în limbaj natural.
 *
 * -----------------------------------------------------------------------
 * Interfața unei DiagnosticStrategy:
 *
 *   id: string                    — identificator unic
 *   forSystems: string[]          — sistemele RuleEngine pe care le acoperă
 *   patternIds?: string[]         — pattern IDs din KnowledgePack care folosesc
 *                                   această strategie pentru evaluare
 *   requiredCapability?: string   — skip dacă vehiculul nu are capability-ul
 *
 *   evaluate?(ctx): { score, factors, severity }
 *     — evaluare probabilistică (folosită de FaultPredictionEngine pentru
 *       pattern-urile din pack; PREDICTION_MODELS standard nu o folosesc)
 *
 *   getRecommendation?(severity): string
 *     — recomandare specifică acestei strategii
 *
 *   investigationSteps: InvestigationStep[]
 *     — pași ordonați de diagnostic pentru UI/AI Expert
 *
 *   rootCauses: string[]
 *     — cauze posibile confirmate pentru această problemă
 * -----------------------------------------------------------------------
 */

// ── Strategii ────────────────────────────────────────────────────────────

const STRATEGIES = [

    // ════════════════════════════════════════════════════════════════════
    // TURBO — Investigare presiune turbosuflantă
    // ════════════════════════════════════════════════════════════════════
    {
        id: 'TURBO_PRESSURE_INVESTIGATION',
        forSystems: ['TURBO'],
        patternIds: ['VAG_TDI_BOOST_HOSE'],
        requiredCapability: 'hasTurbo',
        failureId: 'TURBO_WEAR',

        evaluate(ctx) {
            const factors = [];
            let score = 0;

            const boostAvg = ctx.summary?.pid?.boost?.average;
            const boostMax = ctx.summary?.pid?.boost?.max;
            const boostBaseline = ctx.baseline?.raw_baseline?.boost;

            if (boostAvg !== undefined && boostAvg < 0.8) {
                score += 30;
                factors.push({ param: 'Boost mediu', value: `${boostAvg.toFixed(2)} bar`, impact: 'Presiune turbo sub pragul minim normal' });
            }
            if (boostBaseline && boostAvg && (boostBaseline - boostAvg) / boostBaseline > 0.15) {
                score += 25;
                factors.push({ param: 'Boost vs Baseline', value: `-${Math.round((boostBaseline - boostAvg) / boostBaseline * 100)}%`, impact: 'Presiune semnificativ sub normalul vehiculului' });
            }
            if (ctx.trends?.boost?.trend === 'DECREASING') {
                score += 20;
                factors.push({ param: 'Trend boost', value: 'Descrescător', impact: 'Presiune turbo în scădere continuă' });
            }

            return {
                score,
                factors,
                severity: score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW'
            };
        },

        getRecommendation(severity) {
            if (severity === 'HIGH') return 'Verificare urgentă furtunuri boost, actuator wastegate și stare turbosuflantă';
            if (severity === 'MEDIUM') return 'Inspecție vizuală furtunuri boost; testare presiune la sarcină maximă';
            return 'Parametri boost în limite — monitorizare la următoarele curse';
        },

        investigationSteps: [
            { step: 1, signal: 'boost_bar',    check: 'avg < 1.0',       message: 'Verificare presiune boost la regim de cruise' },
            { step: 2, signal: 'map_kpa',       check: 'pattern_drop',    message: 'Verificare MAP pentru pierdere vacuum' },
            { step: 3, component: 'HOSES',      action: 'visual_inspect', message: 'Inspecție vizuală furtunuri inter-cooler și boost' },
            { step: 4, component: 'N75_SOLENOID', action: 'test',         message: 'Test solenoid N75 (VAG) cu multimetru' },
            { step: 5, component: 'WASTEGATE',  action: 'actuator_test',  message: 'Test actuator wastegate — presiune vs deplasare' },
            { step: 6, component: 'TURBINE',    action: 'play_check',     message: 'Verificare joc axial arbore turbosuflantă' },
        ],

        rootCauses: [
            'Scurgere furtun inter-cooler sau boost',
            'Solenoid N75 defect sau înfundat',
            'Actuator wastegate uzat sau blocat',
            'Uzură turbinǎ (joc axial excesiv)',
            'Filtru aer înfundat (rezistență admisie)',
        ]
    },

    // ════════════════════════════════════════════════════════════════════
    // EGR + Carbon — Investigare depuneri carbon admisie
    // ════════════════════════════════════════════════════════════════════
    {
        id: 'EGR_CARBON_INVESTIGATION',
        forSystems: ['EGR', 'EMISII'],
        patternIds: ['VAG_TDI_EGR_CARBON_BUILDUP'],
        requiredCapability: 'hasEGR',
        failureId: 'EGR_CARBON',

        evaluate(ctx) {
            const factors = [];
            let score = 0;

            const mafAvg     = ctx.summary?.pid?.maf?.average;
            const baselineMaf = ctx.baseline?.raw_baseline?.maf;

            if (mafAvg && baselineMaf && baselineMaf > 0) {
                const drop = (baselineMaf - mafAvg) / baselineMaf;
                if (drop > 0.15) {
                    score += 30;
                    factors.push({ param: 'MAF vs Baseline', value: `-${Math.round(drop * 100)}%`, impact: 'Debit aer semnificativ sub normal — posibile depuneri carbon' });
                } else if (drop > 0.08) {
                    score += 15;
                    factors.push({ param: 'MAF vs Baseline', value: `-${Math.round(drop * 100)}%`, impact: 'Debit aer ușor sub normal' });
                }
            }
            if (ctx.trends?.maf?.trend === 'DECREASING') {
                score += 20;
                factors.push({ param: 'MAF Trend', value: 'Descrescător', impact: 'Debit aer în scădere continuă — pattern carbon EGR' });
            }

            return {
                score,
                factors,
                severity: score > 45 ? 'HIGH' : score > 20 ? 'MEDIUM' : 'LOW'
            };
        },

        getRecommendation(severity) {
            if (severity === 'HIGH') return 'Curățare urgentă galerie admisie și supapă EGR — depuneri semnificative confirmate prin debit aer';
            if (severity === 'MEDIUM') return 'Programare curățare admisie la revizie; monitorizare MAF la următoarele curse';
            return 'Admisie în parametri — monitorizare de rutină';
        },

        investigationSteps: [
            { step: 1, signal: 'maf_g_s',       check: 'vs_baseline',     message: 'Comparare MAF cu baseline — scădere > 15% indică obstrucție' },
            { step: 2, signal: 'maf_g_s',        check: 'trend',           message: 'Verificare trend MAF pe ultimele 10 curse' },
            { step: 3, component: 'EGR_VALVE',   action: 'inspect_clean',  message: 'Inspecție și curățare supapă EGR' },
            { step: 4, component: 'EGR_COOLER',  action: 'inspect',        message: 'Inspecție răcitor EGR — depuneri sau scurgeri' },
            { step: 5, component: 'INTAKE_MANIFOLD', action: 'clean',      message: 'Curățare galerie admisie cu produs specializat' },
            { step: 6, component: 'SWIRL_FLAPS', action: 'check_if_exists', message: 'Verificare flaps admisie (VAG TDI V6/V8)' },
        ],

        rootCauses: [
            'Depuneri carbon pe supapa EGR (lipesc în poziție deschisă/închisă)',
            'Galerie admisie obstruată cu funingine',
            'Răcitor EGR înfundat — reduce eficiența recirculării',
            'Clapete admisie (swirl flaps) blocate — specific TDI V6',
        ]
    },

    // ════════════════════════════════════════════════════════════════════
    // ELECTRIC — Investigare alternator / circuit electric
    // ════════════════════════════════════════════════════════════════════
    {
        id: 'ALTERNATOR_INVESTIGATION',
        forSystems: ['ELECTRIC', 'ELECTRICAL'],
        failureId: 'ALTERNATOR_FAILURE',

        investigationSteps: [
            { step: 1, signal: 'battery_voltage', check: 'at_idle > 13.8',   message: 'Tensiune la relanti — sub 13.8V indică problemă alternator' },
            { step: 2, signal: 'battery_voltage', check: 'under_load > 13.5', message: 'Tensiune sub sarcină — pornire AC, faruri, ventilator' },
            { step: 3, signal: 'battery_voltage', check: 'ripple',            message: 'Oscilații tensiune — diode alternator defecte produc ripple AC' },
            { step: 4, component: 'ALTERNATOR',   action: 'output_test',      message: 'Test curent ieșire alternator cu clampmetru' },
            { step: 5, component: 'BATTERY',      action: 'load_test',        message: 'Test baterie cu tester de sarcină — separă problema' },
            { step: 6, component: 'BELT',         action: 'tension_check',    message: 'Verificare curea și tensioner alternator' },
        ],

        rootCauses: [
            'Alternator cu diode sau regulator defect',
            'Curea transmisie alternator uzată sau slăbită',
            'Baterie cu rezistență internă mare (uzură)',
            'Conexiuni de masă oxidate (cădere tensiune)',
        ]
    },

    // ════════════════════════════════════════════════════════════════════
    // DPF — Investigare filtru particule
    // ════════════════════════════════════════════════════════════════════
    {
        id: 'DPF_REGENERATION_INVESTIGATION',
        forSystems: ['DPF', 'DPF (DIESEL)'],
        requiredCapability: 'hasDPF',
        failureId: 'DPF_CLOGGING',

        investigationSteps: [
            { step: 1, signal: 'dpf_soot_pct',    check: '> 50%',            message: 'Citire nivel funingine DPF prin OBD (Mode 01 PID 4F sau proprietar)' },
            { step: 2, signal: 'exhaust_temp',    check: 'regen_temp_range',  message: 'Verificare temperaturi gazele de ardere în ciclu de regenerare' },
            { step: 3, check: 'trip_pattern',     detail: 'short_trips',      message: 'Evaluare pattern curse — curse scurte < 10 km împiedică regenerarea' },
            { step: 4, component: 'DPF',          action: 'forced_regen',     message: 'Regenerare forțată prin diagnoză sau cursă autostradă 30 min+' },
            { step: 5, component: 'DPF',          action: 'pressure_diff',    message: 'Verificare presiune diferențială față/spate DPF' },
            { step: 6, component: 'DPF',          action: 'ash_content',      message: 'Dacă regenerarea nu reușește: verificare conținut cenușă (nu se arde)' },
        ],

        rootCauses: [
            'Curse exclusiv urbane — DPF nu atinge temperatura de regenerare (550°C)',
            'Conținut mare de cenușă (necomburentă) — necesită curățare profesională',
            'Senzor presiune diferențială defect — regenerare nu pornește',
            'Injecție post-combustie defectă — regenerarea activă nu funcționează',
        ]
    },

    // ════════════════════════════════════════════════════════════════════
    // COOLING — Investigare sistem răcire
    // ════════════════════════════════════════════════════════════════════
    {
        id: 'COOLING_SYSTEM_INVESTIGATION',
        forSystems: ['COOLING', 'RACIRE'],
        failureId: 'COOLING_SYSTEM_FAILURE',

        investigationSteps: [
            { step: 1, signal: 'coolant_temp',    check: 'over_100',         message: 'Monitorizare temperatură motor — pragul de alertă este 100°C' },
            { step: 2, signal: 'oil_temp',        check: 'correlation',      message: 'Comparare temperatură ulei cu temperatura lichid răcire' },
            { step: 3, component: 'THERMOSTAT',   action: 'function_check',  message: 'Verificare termostat — rămâne blocat în poziție închisă' },
            { step: 4, component: 'WATER_PUMP',   action: 'flow_check',      message: 'Verificare pompă apă — rulmenți, palete, etanșare' },
            { step: 5, component: 'FAN',          action: 'activation_test', message: 'Test electroventilator — activare la temperatura corectă' },
            { step: 6, component: 'RADIATOR',     action: 'inspect_flush',   message: 'Inspecție și spălare radiator — colmatare reduce eficiența' },
        ],

        rootCauses: [
            'Termostat defect (blocat în poziție închisă)',
            'Pompă apă uzată sau cu scurgere',
            'Electroventilator nefuncțional sau cu senzor defect',
            'Radiator colmatat — reduce schimbul termic',
            'Scurgere lichid răcire — nivel scăzut',
        ]
    },
];

// ── Registry intern ────────────────────────────────────────────────────────

const _byId = new Map(STRATEGIES.map(s => [s.id, s]));

const _bySystem = new Map();
for (const s of STRATEGIES) {
    for (const sys of (s.forSystems || [])) {
        if (!_bySystem.has(sys)) _bySystem.set(sys, []);
        _bySystem.get(sys).push(s);
    }
}

// ── API public ─────────────────────────────────────────────────────────────

/**
 * Returnează o strategie după ID (folosit de FaultPredictionEngine
 * pentru a evalua pattern-urile din KnowledgePack).
 *
 * @param {string} id
 * @returns {DiagnosticStrategy|null}
 */
function getById(id) {
    return _byId.get(id) || null;
}

/**
 * Returnează prima strategie pentru un sistem RuleEngine (folosit de
 * RuleEngine pentru a atașa ghidul de investigație la un diagnostic).
 *
 * @param {string} system     - system tag-ul din RuleEngine ('TURBO', 'DPF', etc.)
 * @param {Object|null} capabilities - filtrează după requiredCapability dacă furnizat
 * @returns {DiagnosticStrategy|null}
 */
function resolveForSystem(system, capabilities) {
    const candidates = _bySystem.get(system) || [];
    for (const s of candidates) {
        if (s.requiredCapability && capabilities && !capabilities[s.requiredCapability]) {
            continue;
        }
        return s;
    }
    return null;
}

module.exports = { getById, resolveForSystem, STRATEGIES };
