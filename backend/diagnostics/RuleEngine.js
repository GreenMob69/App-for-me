/**
 * RuleEngine.js — Motorul Industrial de Diagnoză pe bază de Probabilități
 */
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

// Reamintim toate regulile într-un singur arbore analitic protejat
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

function evaluateDiagnostics(summary, liveData = null, dtcList = []) {
    const context = {
        summary: summary || {},
        live: liveData || {},
        dtc: dtcList || []
    };

    const hypothesisScores = {};

    ALL_RULES.forEach(rule => {
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
        return {
            cause: item.cause,
            system: item.system,
            probability: probability,
            points: item.points,
            detectedSymptoms: [...new Set(item.symptoms)]
        };
    });

    return results
        .filter(r => r.probability >= 20)
        .sort((a, b) => b.probability - a.probability);
}

module.exports = { evaluateDiagnostics };