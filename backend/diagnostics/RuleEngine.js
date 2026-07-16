/**
 * RuleEngine.js — Motorul Industrial de Diagnoză pe bază de Probabilități
 */
const DiagnosticStrategyRegistry = require('./DiagnosticStrategyRegistry');
const FailureLibrary = require('../failures/FailureLibrary');
const engineRules = require('./EngineRules');
const turboRules = require('./TurboRules');
const fuelRules = require('./FuelRules');
const coolingRules = require('./CoolingRules');
const electricalRules = require('./ElectricalRules');
const dpfRules = require('./DpfRules');
const lambdaRules = require('./LambdaRules');
const transmissionRules = require('./TransmissionRules');
const dtcRules = require('./DtcRules');
const behaviorRules = require('./BehaviorRules');

// Funcție de siguranță: dacă un fișier nu e salvat ca array, returnăm [] în loc să crăpăm serverul
const safeArray = (mod) => (Array.isArray(mod) ? mod : []);

// Toate regulile reunite, grupate pe sistem pentru filtrare după capabilities
const ALL_RULES = [
    ...safeArray(engineRules),
    ...safeArray(turboRules),
    ...safeArray(fuelRules),
    ...safeArray(coolingRules),
    ...safeArray(electricalRules),
    ...safeArray(dpfRules),
    ...safeArray(lambdaRules),
    ...safeArray(transmissionRules),
    ...safeArray(dtcRules),
    ...safeArray(behaviorRules)
];

// Mapare sistem → capability necesară.
// Dacă capabilities lipsesc sau capability e true, regulile sistemului rulează.
const SYSTEM_CAPABILITY_MAP = {
    'TURBO':       'hasTurbo',
    'DPF':         'hasDPF',
    'DPF (DIESEL)':'hasDPF',
    'LAMBDA':      'hasLambdaOxygen',
};

/**
 * @param {Object} summary
 * @param {Object|null} liveData
 * @param {Array}  dtcList
 * @param {Object|null} capabilities  - VehicleCapabilities; null = rulează totul (backward compat)
 * @param {Object|null} knowledgePack - KnowledgePack activ; adaugă additional_rules la evaluare
 */
function evaluateDiagnostics(summary, liveData = null, dtcList = [], capabilities = null, knowledgePack = null) {
    const context = {
        summary: summary || {},
        live: liveData || {},
        dtc: dtcList || []
    };

    // Regulile de evaluat = regulile standard + cele din pack (dacă există)
    const packRules = safeArray(knowledgePack?.additional_rules);
    const activeRules = packRules.length > 0 ? [...ALL_RULES, ...packRules] : ALL_RULES;

    const hypothesisScores = {};

    activeRules.forEach(rule => {
        // Dacă regula aparține unui sistem cu capability necesară și vehiculul nu
        // are acea capability, regula este ignorată. Dacă capabilities nu este
        // furnizat (null), toate regulile rulează — backward compat.
        if (capabilities && rule.system) {
            const requiredCap = SYSTEM_CAPABILITY_MAP[rule.system];
            if (requiredCap && !capabilities[requiredCap]) return;
        }
        try {
            if (rule.condition && rule.condition(context)) {
                rule.hypotheses.forEach(h => {
                    if (!hypothesisScores[h.cause]) {
                        hypothesisScores[h.cause] = {
                            cause: h.cause,
                            system: rule.system,
                            points: 0,
                            maxPossiblePoints: 100,
                            symptoms: []
                        };
                    }
                    hypothesisScores[h.cause].points += h.points;
                    hypothesisScores[h.cause].symptoms.push(rule.symptom);
                });
            }
        } catch (err) {
            console.error(`[RULE ENGINE EROARE] Regula "${rule.id || 'necunoscută'}" a eșuat:`, err.message);
        }
    });

    const results = Object.values(hypothesisScores).map(item => {
        const probability = Math.min(100, Math.round((item.points / item.maxPossiblePoints) * 100));
        const strategy = DiagnosticStrategyRegistry.resolveForSystem(item.system, capabilities) || null;
        const failureCandidates = FailureLibrary.resolveForSystem(item.system, capabilities);
        const failureId = failureCandidates.length > 0 ? failureCandidates[0].id : null;
        const failureDef = failureId ? FailureLibrary.getById(failureId) : null;
        return {
            cause: item.cause,
            system: item.system,
            probability: probability,
            points: item.points,
            detectedSymptoms: [...new Set(item.symptoms)],
            strategy,
            failureId,
            // driveRecommendation în JSON este { LOW, MEDIUM, HIGH } — rezolvăm cu severitate medie ca default
            driveRecommendation: failureDef?.driveRecommendation?.MEDIUM || null
        };
    });

    return results
        .filter(r => r.probability >= 20)
        .sort((a, b) => b.probability - a.probability);
}

module.exports = { evaluateDiagnostics };