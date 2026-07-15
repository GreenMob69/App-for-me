/**
 * FaultPredictionEngine.js — Predicție defecțiuni viitoare
 * -----------------------------------------------------------------------
 * NU detectează defectele existente — estimează PROBABILITATEA apariției
 * unei defecțiuni în viitor pe baza tendințelor, baseline-ului și regulilor.
 *
 * Componente analizate:
 *   - Alternator degradation
 *   - Battery aging
 *   - Turbo wear
 *   - Injector wear
 *   - Cooling system deterioration
 *   - Air intake restriction
 *   - Fuel system degradation
 *   - DPF clogging
 *   - EGR deterioration
 *
 * Folosește exclusiv: TrendEngine, BaselineEngine, RuleEngine, ConfidenceEngine, VehicleDNA
 *
 * Returnează: [{ component, probability, confidence, severity, estimatedRemainingKm,
 *               estimatedRemainingDays, recommendation, factors }]
 * -----------------------------------------------------------------------
 */

const DiagnosticStrategyRegistry = require('../diagnostics/DiagnosticStrategyRegistry');
const FailureLibrary = require('../failures/FailureLibrary');

const PREDICTION_MODELS = [
    {
        id: 'ALTERNATOR_DEGRADATION',
        component: 'Alternator',
        category: 'ELECTRIC',
        failureId: 'ALTERNATOR_FAILURE',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const voltMin = ctx.summary?.pid?.voltage?.min;
            const voltAvg = ctx.summary?.pid?.voltage?.average;
            const baselineVolt = ctx.baseline?.raw_baseline?.voltage;

            if (voltMin && voltMin < 13.4) {
                score += 25;
                factors.push({ param: 'Voltage Min', value: `${voltMin}V`, impact: 'Tensiune sub pragul optim' });
            }
            if (voltAvg && voltAvg < 13.8) {
                score += 20;
                factors.push({ param: 'Voltage Avg', value: `${voltAvg}V`, impact: 'Media tensiunii în scădere' });
            }
            if (baselineVolt && voltAvg && (baselineVolt - voltAvg) > 0.3) {
                score += 20;
                factors.push({ param: 'Baseline Deviation', value: `-${(baselineVolt - voltAvg).toFixed(2)}V`, impact: 'Deviație față de normalul învățat' });
            }
            if (ctx.trends?.voltage?.trend === 'DECREASING') {
                score += 25;
                factors.push({ param: 'Trend', value: 'Descrescător', impact: 'Tendință confirmată pe mai multe curse' });
            }
            if (ctx.dna?.subsystems?.electrical?.score < 85) {
                score += 10;
                factors.push({ param: 'DNA Score', value: `${ctx.dna.subsystems.electrical.score}%`, impact: 'Scor subsistem electric redus' });
            }

            return { score, factors, severity: score > 60 ? 'HIGH' : score > 35 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Verificare urgentă alternator — testare cu sarcină și măsurare curent de repaus';
            if (severity === 'MEDIUM') return 'Monitorizare tensiune la următoarele 3-5 curse; dacă continuă scăderea, verificare alternator';
            return 'Parametri normali — verificare de rutină la revizie';
        }
    },
    {
        id: 'BATTERY_AGING',
        component: 'Baterie',
        category: 'ELECTRIC',
        failureId: 'BATTERY_DEGRADATION',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const voltMin = ctx.summary?.pid?.voltage?.min;
            const voltMax = ctx.summary?.pid?.voltage?.max;
            const voltRange = (voltMax || 0) - (voltMin || 0);

            if (voltMin && voltMin < 11.8) {
                score += 35;
                factors.push({ param: 'Voltage Min', value: `${voltMin}V`, impact: 'Tensiune critică — baterie slăbită' });
            }
            if (voltRange > 2.0) {
                score += 20;
                factors.push({ param: 'Voltage Range', value: `${voltRange.toFixed(1)}V`, impact: 'Oscilații mari de tensiune — rezistență internă crescută' });
            }
            if (ctx.trends?.voltage?.minTrend === 'DECREASING') {
                score += 25;
                factors.push({ param: 'Min Voltage Trend', value: 'Descrescător', impact: 'Minimul de tensiune scade progresiv' });
            }
            if (voltMin && voltMin < 12.4 && voltMax && voltMax > 14.2) {
                score += 15;
                factors.push({ param: 'Charge Acceptance', value: 'Redusă', impact: 'Baterie cu sulfatare — acceptă greu încărcare' });
            }

            return { score, factors, severity: score > 55 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Testare baterie (CCA + SOH) — probabilitate ridicată de înlocuire necesară';
            if (severity === 'MEDIUM') return 'Monitorizare pornire la rece; consideră testare baterie dacă pornirea devine lentă';
            return 'Baterie în parametri — revizie standard';
        }
    },
    {
        id: 'TURBO_WEAR',
        component: 'Turbosuflantă',
        category: 'TURBO',
        requiredCapability: 'hasTurbo',
        failureId: 'TURBO_WEAR',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const boostAvg = ctx.summary?.pid?.boost?.average;
            const boostMax = ctx.summary?.pid?.boost?.max;
            const baselineBoost = ctx.baseline?.raw_baseline?.boost;

            if (boostAvg && boostAvg < 0.5 && ctx.summary?.pid?.rpm?.average > 2000) {
                score += 30;
                factors.push({ param: 'Boost Avg', value: `${boostAvg} bar`, impact: 'Presiune sub așteptări la turație de lucru' });
            }
            if (baselineBoost && boostAvg && (baselineBoost - boostAvg) > 0.2) {
                score += 25;
                factors.push({ param: 'Baseline Deviation', value: `-${(baselineBoost - boostAvg).toFixed(2)} bar`, impact: 'Deviație negativă față de normalul turbo' });
            }
            if (ctx.correlations?.coefficients?.boost_maf < 0.7) {
                score += 20;
                factors.push({ param: 'Boost-MAF Correlation', value: `r=${ctx.correlations.coefficients.boost_maf}`, impact: 'Corelație slabă boost/MAF — pierderi de presiune' });
            }
            if (ctx.trends?.boost?.trend === 'DECREASING') {
                score += 20;
                factors.push({ param: 'Trend', value: 'Descrescător', impact: 'Presiune turbo în scădere progresivă' });
            }

            return { score, factors, severity: score > 55 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Inspecție turbo urgentă — verificare joc axial, wastegate, furtunuri vacuum, actuator N75';
            if (severity === 'MEDIUM') return 'Monitorizare presiune boost pe următoarele curse; verificare furtunuri și actuator';
            return 'Turbo în parametri normali — atenție la calitatea uleiului';
        }
    },
    {
        id: 'INJECTOR_WEAR',
        component: 'Injectoare',
        category: 'COMBUSTIBIL',
        failureId: 'INJECTOR_WEAR',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const fuelAvg = ctx.summary?.fuel?.averageInstant;
            const loadAvg = ctx.summary?.pid?.load?.average;

            if (fuelAvg && loadAvg && fuelAvg > 6 && loadAvg < 40) {
                score += 25;
                factors.push({ param: 'Fuel/Load Ratio', value: `${fuelAvg} L/h @ ${loadAvg}% load`, impact: 'Consum ridicat la sarcină mică — posibil injectoare ce picură' });
            }
            if (ctx.trends?.fuel?.trend === 'INCREASING') {
                score += 25;
                factors.push({ param: 'Fuel Trend', value: 'Crescător', impact: 'Consum în creștere progresivă — degradare injecție' });
            }
            if (ctx.summary?.pid?.rpm?.min > 0 && ctx.summary?.pid?.rpm?.max > 0) {
                const rpmRange = ctx.summary.pid.rpm.max - ctx.summary.pid.rpm.min;
                if (ctx.summary.pid.speed?.average < 5 && rpmRange > 150) {
                    score += 20;
                    factors.push({ param: 'Idle Stability', value: `±${rpmRange} RPM`, impact: 'Instabilitate ralanti — debit neuniform injectoare' });
                }
            }
            if (ctx.confidence?.problem?.includes('COMBUSTIBIL')) {
                score += 15;
                factors.push({ param: 'Diagnostic Confidence', value: 'Confirmat', impact: 'Motorul de diagnoză a detectat anomalii în sistem combustibil' });
            }

            return { score, factors, severity: score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Test debit injectoare pe bancă sau test de echilibrare cilindri; verificare pulverizare';
            if (severity === 'MEDIUM') return 'Aditivare combustibil cu agent de curățare; monitorizare consum pe 5 curse';
            return 'Injectoare funcționale — schimbare filtre la interval';
        }
    },
    {
        id: 'COOLING_DETERIORATION',
        component: 'Sistem răcire',
        category: 'TERMIC',
        failureId: 'COOLING_SYSTEM_FAILURE',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const coolantMax = ctx.summary?.pid?.coolant?.max;
            const coolantAvg = ctx.summary?.pid?.coolant?.average;
            const timeOver95 = ctx.summary?.temperature?.coolant?.timeOver95 || 0;

            if (coolantMax && coolantMax > 100) {
                score += 30;
                factors.push({ param: 'Coolant Max', value: `${coolantMax}°C`, impact: 'Supraîncălzire detectată' });
            }
            if (timeOver95 > 60) {
                score += 20;
                factors.push({ param: 'Time > 95°C', value: `${timeOver95}s`, impact: 'Timp excesiv în zona de risc termic' });
            }
            if (ctx.correlations?.coefficients?.coolant_oil < 0.6) {
                score += 20;
                factors.push({ param: 'Coolant-Oil Correlation', value: `r=${ctx.correlations.coefficients.coolant_oil}`, impact: 'Desincronizare termică — posibil termostat sau circuit obstruat' });
            }
            if (ctx.trends?.coolant?.trend === 'INCREASING') {
                score += 20;
                factors.push({ param: 'Trend', value: 'Crescător', impact: 'Temperatură medie în creștere progresivă' });
            }
            if (ctx.baseline?.deviations?.coolant) {
                const dev = parseFloat(ctx.baseline.deviations.coolant);
                if (!isNaN(dev) && dev > 3) {
                    score += 10;
                    factors.push({ param: 'Baseline', value: ctx.baseline.deviations.coolant, impact: 'Deviație pozitivă față de normal' });
                }
            }

            return { score, factors, severity: score > 55 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Verificare urgentă: nivel lichid răcire, termostat, pompa de apă, ventilator, radiator';
            if (severity === 'MEDIUM') return 'Verificare nivel lichid, inspecție vizuală radiator și furtunuri; atenție la temperatură în trafic';
            return 'Sistem răcire funcțional — înlocuire lichid conform intervalului';
        }
    },
    {
        id: 'AIR_INTAKE_RESTRICTION',
        component: 'Admisie aer',
        category: 'ADMISIE',
        failureId: 'MAF_DEGRADATION',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const mafAvg = ctx.summary?.pid?.maf?.average;
            const loadAvg = ctx.summary?.pid?.load?.average;
            const rpmAvg = ctx.summary?.pid?.rpm?.average;

            if (mafAvg && rpmAvg && rpmAvg > 2000 && mafAvg < 20) {
                score += 30;
                factors.push({ param: 'MAF/RPM', value: `${mafAvg} g/s @ ${rpmAvg} RPM`, impact: 'Debit aer insuficient la turație de lucru' });
            }
            if (loadAvg && mafAvg && loadAvg > 60 && mafAvg < 25) {
                score += 20;
                factors.push({ param: 'Load/MAF', value: `${loadAvg}% load, ${mafAvg} g/s`, impact: 'Motor solicitat dar aer limitat' });
            }
            if (ctx.trends?.maf?.trend === 'DECREASING') {
                score += 25;
                factors.push({ param: 'MAF Trend', value: 'Descrescător', impact: 'Debit aer în scădere progresivă' });
            }
            if (ctx.baseline?.deviations?.maf) {
                const dev = parseFloat(ctx.baseline.deviations.maf);
                if (!isNaN(dev) && dev < -3) {
                    score += 15;
                    factors.push({ param: 'Baseline MAF', value: ctx.baseline.deviations.maf, impact: 'Sub normalul învățat' });
                }
            }

            return { score, factors, severity: score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Înlocuire filtru aer; curățare/verificare senzor MAF; inspecție carcasă filtru și furtunuri';
            if (severity === 'MEDIUM') return 'Verificare stare filtru aer; curățare MAF cu spray dedicat';
            return 'Admisie funcțională — înlocuire filtru la interval';
        }
    },
    {
        id: 'FUEL_SYSTEM_DEGRADATION',
        component: 'Sistem alimentare',
        category: 'COMBUSTIBIL',
        failureId: 'FUEL_PUMP_DEGRADATION',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const fuelAvg = ctx.summary?.fuel?.averageInstant;
            const fuelMax = ctx.summary?.fuel?.maxInstant;

            if (fuelMax && fuelMax > 25) {
                score += 15;
                factors.push({ param: 'Fuel Peak', value: `${fuelMax} L/h`, impact: 'Vârfuri de consum excesive' });
            }
            if (ctx.trends?.fuel?.trend === 'INCREASING') {
                score += 25;
                factors.push({ param: 'Fuel Trend', value: 'Crescător', impact: 'Consum mediu în creștere pe mai multe curse' });
            }
            if (ctx.confidence?.problem?.includes('COMBUSTIBIL')) {
                score += 20;
                factors.push({ param: 'Diagnostic', value: 'Anomalie combustibil', impact: 'Motorul de diagnoză confirmă probleme sistem alimentare' });
            }
            if (fuelAvg && fuelAvg > 8 && ctx.summary?.pid?.speed?.average > 50) {
                score += 15;
                factors.push({ param: 'Efficiency', value: `${fuelAvg} L/h @ ${ctx.summary.pid.speed.average} km/h`, impact: 'Eficiență sub așteptări' });
            }

            return { score, factors, severity: score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Verificare presiune rampă, filtru combustibil, pompa de alimentare; posibil necesară diagnoză avansată';
            if (severity === 'MEDIUM') return 'Înlocuire filtru combustibil; monitorizare consum pe următoarele curse';
            return 'Sistem alimentare funcțional — revizie standard';
        }
    },
    {
        id: 'DPF_CLOGGING',
        component: 'Filtru particule (DPF)',
        category: 'EMISII',
        requiredCapability: 'hasDPF',
        failureId: 'DPF_CLOGGING',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const dpfSoot = ctx.summary?.pid?.dpfSoot?.average;
            const dpfMax = ctx.summary?.pid?.dpfSoot?.max;
            const idlePct = ctx.summary?.rpmZones?.idlePct || 0;

            if (dpfMax && dpfMax > 50) {
                score += 30;
                factors.push({ param: 'DPF Soot Max', value: `${dpfMax}%`, impact: 'Încărcare mare de funingine' });
            } else if (dpfMax && dpfMax > 30) {
                score += 15;
                factors.push({ param: 'DPF Soot', value: `${dpfMax}%`, impact: 'Încărcare moderată' });
            }
            if (idlePct > 40) {
                score += 15;
                factors.push({ param: 'Idle %', value: `${idlePct}%`, impact: 'Timp excesiv la ralanti — împiedică regenerarea' });
            }
            if (ctx.trends?.dpfSoot?.trend === 'INCREASING') {
                score += 25;
                factors.push({ param: 'Soot Trend', value: 'Crescător', impact: 'Încărcare DPF în creștere — regenerări insuficiente' });
            }
            if (ctx.summary?.distanceKm < 10 && ctx.summary?.duration?.totalSeconds > 600) {
                score += 10;
                factors.push({ param: 'Short Trip', value: `${ctx.summary.distanceKm?.toFixed(1)} km`, impact: 'Curse scurte — DPF nu atinge temperatura de regenerare' });
            }

            return { score, factors, severity: score > 55 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Necesară regenerare forțată sau cursă lungă pe autostradă (30+ min, > 2500 RPM); dacă nu reușește, curățare profesională';
            if (severity === 'MEDIUM') return 'Efectuare cursă de regenerare (20+ min pe drum deschis); evitare curse exclusiv urbane';
            return 'DPF funcțional — menținere regim mixt de conducere';
        }
    },
    {
        id: 'EGR_DETERIORATION',
        component: 'Supapă EGR',
        category: 'EMISII',
        requiredCapability: 'hasEGR',
        failureId: 'EGR_CARBON',
        evaluate: (ctx) => {
            const factors = [];
            let score = 0;

            const rpmMin = ctx.summary?.pid?.rpm?.min;
            const rpmMax = ctx.summary?.pid?.rpm?.max;
            const loadAvg = ctx.summary?.pid?.load?.average;
            const idlePct = ctx.summary?.rpmZones?.idlePct || 0;

            if (rpmMin && rpmMax && rpmMin > 0 && (rpmMax - rpmMin) > 200 && ctx.summary?.pid?.speed?.average < 5) {
                score += 20;
                factors.push({ param: 'Idle RPM Variation', value: `${rpmMin}-${rpmMax}`, impact: 'Instabilitate ralanti — posibil EGR blocat deschis' });
            }
            if (loadAvg && loadAvg > 45 && ctx.summary?.pid?.speed?.average < 60) {
                score += 15;
                factors.push({ param: 'Load/Speed', value: `${loadAvg}% @ ${ctx.summary.pid.speed.average} km/h`, impact: 'Sarcină excesivă la viteză mică — EGR recirculează prea mult' });
            }
            if (idlePct > 35) {
                score += 10;
                factors.push({ param: 'Idle %', value: `${idlePct}%`, impact: 'Mult ralanti — acumulare depuneri carbon pe EGR' });
            }
            if (ctx.trends?.load?.trend === 'INCREASING' && ctx.trends?.fuel?.trend === 'INCREASING') {
                score += 20;
                factors.push({ param: 'Load+Fuel Trend', value: 'Ambele crescătoare', impact: 'Motor solicitat progresiv mai mult — posibil restricție EGR' });
            }
            if (ctx.confidence?.problem?.includes('EGR') || ctx.confidence?.problem?.includes('MOTOR')) {
                score += 15;
                factors.push({ param: 'Diagnostic', value: 'Confirmat', impact: 'Motorul de diagnoză a semnalat anomalii EGR/Motor' });
            }

            return { score, factors, severity: score > 50 ? 'HIGH' : score > 25 ? 'MEDIUM' : 'LOW' };
        },
        getRecommendation: (severity) => {
            if (severity === 'HIGH') return 'Curățare sau înlocuire supapă EGR; verificare conducte recirculare; posibil necesară decarburizare';
            if (severity === 'MEDIUM') return 'Curse periodice la turații mai mari (autostradă); monitorizare stabilitate ralanti';
            return 'EGR funcțional — menținere regim mixt pentru auto-curățare';
        }
    }
];

function estimateRemainingDistance(severity, score) {
    if (severity === 'HIGH') return Math.max(500, Math.round((100 - score) * 50));
    if (severity === 'MEDIUM') return Math.max(2000, Math.round((100 - score) * 150));
    return Math.max(10000, Math.round((100 - score) * 300));
}

function estimateRemainingDays(severity, score) {
    if (severity === 'HIGH') return Math.max(7, Math.round((100 - score) * 1.5));
    if (severity === 'MEDIUM') return Math.max(30, Math.round((100 - score) * 3));
    return Math.max(90, Math.round((100 - score) * 5));
}

function generatePredictions(context) {
    const { summary, baseline, trends, correlations, confidence, dna, capabilities, knowledgePack } = context;

    if (!summary) return [];

    // Modelele standard + modelele suplimentare din KnowledgePack (dacă există)
    const packPatterns = Array.isArray(knowledgePack?.known_failure_patterns)
        ? knowledgePack.known_failure_patterns
        : [];
    const activeModels = packPatterns.length > 0
        ? [...PREDICTION_MODELS, ...packPatterns]
        : PREDICTION_MODELS;

    const predictions = [];

    for (const model of activeModels) {
        // Dacă modelul necesită o capability specifică și vehiculul nu o are,
        // sărim modelul complet. Dacă capabilities lipsesc (null), rulăm totul
        // pentru backward compat.
        if (model.requiredCapability && capabilities && !capabilities[model.requiredCapability]) {
            continue;
        }

        // Pattern-urile din KnowledgePack (JSON pur) nu au evaluate().
        // Delegăm evaluarea la DiagnosticStrategyRegistry prin strategyId.
        let result;
        let recommendation;

        if (typeof model.evaluate === 'function') {
            result = model.evaluate(context);
            recommendation = typeof model.getRecommendation === 'function'
                ? model.getRecommendation(result.severity)
                : model.component;
        } else if (model.strategyId) {
            const strategy = DiagnosticStrategyRegistry.getById(model.strategyId);
            if (!strategy || typeof strategy.evaluate !== 'function') continue;
            result = strategy.evaluate(context);
            recommendation = typeof strategy.getRecommendation === 'function'
                ? strategy.getRecommendation(result.severity)
                : model.component;
        } else {
            continue;
        }

        if (result.score < 10) continue;

        const probability = Math.min(95, Math.round(result.score));
        const confidenceScore = Math.min(95, Math.round(
            50 + (result.factors.length * 10) + (trends ? 5 : 0) + (baseline ? 5 : 0)
        ));

        const failureId = model.failureId || null;
        const failureDef = failureId ? FailureLibrary.getById(failureId) : null;

        predictions.push({
            component: model.component,
            category: model.category,
            probability,
            confidence: confidenceScore,
            severity: result.severity,
            estimatedRemainingKm: estimateRemainingDistance(result.severity, result.score),
            estimatedRemainingDays: estimateRemainingDays(result.severity, result.score),
            recommendation,
            factors: result.factors,
            failureId,
            driveRecommendation: failureDef?.driveRecommendation?.[result.severity] || null,
            estimatedRepairCostRange: failureDef?.estimatedRepairCostRange || null
        });
    }

    return predictions
        .filter(p => p.probability >= 15)
        .sort((a, b) => b.probability - a.probability);
}

module.exports = { generatePredictions };
