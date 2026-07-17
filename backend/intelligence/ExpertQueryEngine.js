'use strict';
/**
 * ExpertQueryEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor determinist de Q&A pentru AI Expert.
 * Clasifică intenția întrebării și extrage răspunsul din contextul
 * Digital Twin (DigitalTwinSerializer.toAIExpert() view).
 *
 * NU conține logică de analiză — toate răspunsurile sunt bazate
 * exclusiv pe date pre-compute de HealthEngine, FaultPredictionEngine,
 * ReasoningEngine, RecommendationEngine, BaselineEngine și VehicleDNA
 * care rulează la finalul fiecărei curse.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Text normalization ────────────────────────────────────────────────────────

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchesAny(q, keywords) {
    return keywords.some(kw => q.includes(normalize(kw)));
}

// ── Intent definitions (priority order matters) ───────────────────────────────

const INTENTS = [
    {
        id: 'LONG_TRIP',
        kw: ['drum lung', 'autostrada', 'pot merge', 'pot pleca', 'pot face un drum',
             'excursie', 'calatorie', 'deplasare lunga', 'pot conduce', 'ma tin masina',
             'merg cu masina', 'drum departe'],
    },
    {
        id: 'PREDICTIONS',
        kw: ['ce se poate strica', 'ce se va strica', 'probleme viitoare', 'risc defect',
             'predictii', 'probabilitate defect', 'ce riscuri', 'ce se defecteaza',
             'ce urmeaza sa cada', 'pericolele'],
    },
    {
        id: 'RECOMMENDATIONS',
        kw: ['ce trebuie facut', 'ce fac', 'ce reparez', 'recomandari', 'ce sa fac',
             'actiuni urgente', 'prioritati', 'ce ma sfatuiesti', 'cum procedez',
             'ce-mi recomanzi', 'ce-mi recomanzi', 'pasii urmatori'],
    },
    {
        id: 'TURBO',
        kw: ['turbo', 'suflanta', 'boost', 'supralimentare', 'turbocompresor',
             'turbina', 'presiune boost'],
    },
    {
        id: 'DPF',
        kw: ['dpf', 'filtru particule', 'regenerare dpf', 'fum negru', 'filtru de particule',
             'colmatat', 'particule diesel', 'soot'],
    },
    {
        id: 'EGR',
        kw: ['egr', 'recirculare gaze', 'carbon egr', 'valva egr', 'depuneri carbon'],
    },
    {
        id: 'ELECTRIC',
        kw: ['alternator', 'baterie', 'sistem electric', 'tensiune', 'voltaj', 'volt',
             'incarcare baterie', 'acumulator', 'amperaj'],
    },
    {
        id: 'COOLING',
        kw: ['racire', 'temperatura motor', 'radiator', 'coolant', 'antigel',
             'supraincalzire', 'termostat', 'temperatura racire', 'incalzire motor'],
    },
    {
        id: 'FUEL',
        kw: ['consum', 'combustibil', 'carburant', 'motorina', 'benzina',
             'litri la suta', 'l/100', 'injectoare', 'injectie', 'pompa benzina',
             'alimentare', 'maf', 'flux aer'],
    },
    {
        id: 'ENGINE',
        kw: ['motor', 'engine', 'rpm', 'putere motor', 'cilindri', 'ardere',
             'compresie', 'lanturi distributie', 'supape', 'chiuloasa'],
    },
    {
        id: 'DRIVING_STYLE',
        kw: ['stil condus', 'eco score', 'conduc bine', 'acceleratii bruste',
             'franari bruste', 'economie combustibil', 'condus agresiv', 'condus economic',
             'cat de bine conduc', 'scor eco'],
    },
    {
        id: 'MAINTENANCE',
        kw: ['revizie', 'ulei motor', 'schimb ulei', 'mentenanta', 'service',
             'intretinere', 'filtru ulei', 'filtru aer', 'curea distributie',
             'curea serp', 'lichid frana', 'placute frana', 'urmatoarea revizie'],
    },
    {
        id: 'COST',
        kw: ['cat costa', 'pret reparatie', 'reparatie cat', 'buget reparatii',
             'cheltuieli', 'cost estimat', 'cat platesc', 'oferta service'],
    },
    {
        id: 'BASELINE',
        kw: ['ce s-a schimbat', 's-a schimbat ceva', 'deviat', 'neobisnuit',
             'anomalie', 'fata de inainte', 'fata de normal', 'abatere',
             'tendinta', 'trend', 'evolutie parametri'],
    },
    {
        id: 'KNOWLEDGE',
        kw: ['ce stii despre masina', 'profil vehicul', 'ce date ai', 'capabilitati',
             'knowledge pack', 'ce sisteme monitorizezi', 'despre masina mea'],
    },
    {
        id: 'OVERALL_STATUS',
        kw: ['stare generala', 'cum e masina', 'sanatate', 'health score', 'scor sanatate',
             'ce probleme are', 'diagnostic general', 'e ok masina', 'situatia masinii',
             'rezumat', 'overview', 'cum stau', 'totul e bine'],
    },
    {
        id: 'DOCUMENTS',
        kw: ['itp', 'rca', 'casco', 'rovinieta', 'asigurare', 'document', 'acte',
             'cand expira', 'ce acte', 'documente masina', 'taxa drum', 'vigneta',
             'carte identitate vehicul', 'acte la zi', 'revizie gpl', 'inspectie',
             'ce documente', 'documente lipsa', 'acte expirate', 'reinnoire'],
    },
];

function classifyIntent(normalizedQuestion) {
    for (const intent of INTENTS) {
        if (matchesAny(normalizedQuestion, intent.kw)) {
            return intent.id;
        }
    }
    return 'FALLBACK';
}

// ── Formatters ────────────────────────────────────────────────────────────────

function scoreLabel(score) {
    if (score == null)  return 'nedeterminat';
    if (score >= 90)    return `excelent (${score}/100)`;
    if (score >= 75)    return `bun (${score}/100)`;
    if (score >= 60)    return `acceptabil (${score}/100)`;
    if (score >= 40)    return `precar (${score}/100)`;
    return `critic (${score}/100)`;
}

function alertLevelRo(level) {
    return {
        NORMAL:        'Normal',
        CAUTION:       'Prudență',
        AVOID_HIGHWAY: 'Evită autostrada',
        WORKSHOP:      'Prezintă la service',
        DO_NOT_DRIVE:  'NU conduce',
    }[level] || level || 'Normal';
}

function urgencyRo(u) {
    return { IMMEDIATE: 'URGENT', SOON: 'În curând', PLANNED: 'Planificat', MONITOR: 'Monitorizare' }[u] || u;
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleOverallStatus(q, ctx) {
    const h     = ctx.health;
    const recs  = ctx.topRecommendations || [];
    const alert = ctx.alertLevel;

    if (!h) {
        return reply(
            'Nu am date suficiente. Finalizează o cursă pentru a genera o analiză completă.',
            'LOW', 'OVERALL_STATUS', [],
            ['Pot face un drum lung?', 'Ce știi despre mașina mea?']
        );
    }

    const score = h.overallHealth;
    let answer  = `Starea generală: ${scoreLabel(score)}. `;

    // Subsystem issues
    const subs = h.subsystems;
    if (subs) {
        const weak = [];
        const map = { motor: 'Motor', electric: 'Electric', turbo: 'Turbo',
                      combustibil: 'Combustibil', stil_condus: 'Stil condus' };
        Object.entries(map).forEach(([key, label]) => {
            if ((subs[key]?.score ?? 100) < 75) weak.push(`${label} (${subs[key].score}/100)`);
        });
        if (weak.length > 0) answer += `Sisteme cu probleme: ${weak.join(', ')}. `;
    }

    // Reasoning summary
    const rsm = ctx.reasoning?.summary;
    if (rsm && !rsm.includes('Insuficiente date') && !rsm.includes('Nicio cauza')) {
        answer += `${rsm}. `;
    }

    // Alert level
    if (alert && alert !== 'NORMAL') {
        answer += `Nivel alertă: ${alertLevelRo(alert)}.`;
    } else if (score >= 75) {
        answer += 'Vehiculul funcționează în parametri normali.';
    }

    const related = ['Pot face un drum lung?', 'Ce se poate strica?'];
    if (recs.length)                    related.push('Ce trebuie reparat?');
    if (ctx.maintenanceOverdue?.length) related.push('Ce mentenanță am restantă?');

    return reply(answer.trim(), score != null ? 'HIGH' : 'MEDIUM', 'OVERALL_STATUS',
        ['HealthEngine', 'ReasoningEngine'], related.slice(0, 3));
}

function handleLongTrip(q, ctx) {
    const recs       = ctx.topRecommendations || [];
    const score      = ctx.health?.overallHealth;
    const overdue    = ctx.maintenanceOverdue?.length || 0;
    const highPreds  = (ctx.predictions || []).filter(p => p.severity === 'HIGH');
    const cannotDrive    = recs.some(r => r.driveAllowed === false);
    const avoidHighway   = recs.some(r => r.driveRecommendation === 'AVOID_HIGHWAY');
    const workshopFirst  = recs.some(r => r.driveRecommendation === 'WORKSHOP');

    let answer = '';

    if (cannotDrive) {
        const blocker = recs.find(r => r.driveAllowed === false);
        answer = `Nu recomand un drum lung. "${blocker?.title || 'Problemă critică'}" necesită rezolvare urgentă. ${blocker?.recommendedAction || ''}`;
    } else if (score == null) {
        answer = 'Insuficiente date pentru evaluare. Efectuează câteva curse pentru o analiză completă.';
    } else if (score < 50) {
        answer = `Vehiculul nu este pregătit pentru un drum lung (scor ${score}/100). Prezintă la service mai întâi.`;
    } else if (avoidHighway) {
        const rec = recs.find(r => r.driveRecommendation === 'AVOID_HIGHWAY');
        answer = `Evită autostrada. Cauza: ${rec?.title || 'problemă detectată'}. ${rec?.recommendedAction || 'Prezintă vehiculul la service.'}`;
    } else if (workshopFirst) {
        answer = `Poți merge, dar programează o vizită la service în scurt timp. ${recs[0]?.recommendedAction || ''}`;
    } else if (score >= 75) {
        answer = `Da, vehiculul este în formă pentru un drum lung (scor ${score}/100).`;
        if (overdue > 0) answer += ` Notă: ${overdue} element(e) de mentenanță restante — de rezolvat la întoarcere.`;
        if (highPreds.length > 0) answer += ` Monitorizează: ${highPreds.map(p => p.component).join(', ')}.`;
    } else {
        answer = `Cu prudență (scor ${score}/100). Verifică vehiculul înainte de o deplasare lungă.`;
        if (recs[0]?.recommendedAction) answer += ` ${recs[0].recommendedAction}`;
    }

    return reply(answer.trim(), score != null ? 'HIGH' : 'LOW', 'LONG_TRIP',
        ['HealthEngine', 'RecommendationEngine'],
        ['Care e cea mai urgentă problemă?', 'Cum e starea motorului?', 'Ce mentenanță am restantă?']);
}

function handlePredictions(q, ctx) {
    const preds = ctx.predictions || [];

    if (preds.length === 0) {
        return reply(
            'Niciun risc de defectare detectat. Vehiculul pare stabil pe baza datelor analizate.',
            'HIGH', 'PREDICTIONS', ['FaultPredictionEngine'],
            ['Cum e starea generală?', 'Ce mentenanță am restantă?']
        );
    }

    const byLevel = { HIGH: [], MEDIUM: [], LOW: [] };
    preds.forEach(p => (byLevel[p.severity] || byLevel.LOW).push(p));

    const parts = [];
    if (byLevel.HIGH.length)
        parts.push(`Risc ridicat: ${byLevel.HIGH.map(p => `${p.component} (${p.probability}%)`).join(', ')}.`);
    if (byLevel.MEDIUM.length)
        parts.push(`Risc mediu: ${byLevel.MEDIUM.map(p => `${p.component} (${p.probability}%)`).join(', ')}.`);

    const rsm = ctx.reasoning?.summary;
    if (rsm && !rsm.includes('Insuficiente') && !rsm.includes('Nicio cauza')) {
        parts.push(rsm);
    }

    return reply(parts.join(' '), 'HIGH', 'PREDICTIONS',
        ['FaultPredictionEngine', 'ReasoningEngine'],
        ['Cât costă reparația?', 'Ce trebuie reparat mai întâi?', 'Pot face un drum lung?']);
}

function handleRecommendations(q, ctx) {
    const recs   = ctx.topRecommendations || [];
    const overdue = ctx.maintenanceOverdue || [];

    if (recs.length === 0 && overdue.length === 0) {
        return reply(
            'Nicio acțiune urgentă. Menține revizia periodică.',
            'HIGH', 'RECOMMENDATIONS', ['RecommendationEngine'],
            ['Cum e starea generală?', 'Ce mentenanță am restantă?']
        );
    }

    const parts = recs.map((r, i) => {
        let line = `${i + 1}. [${urgencyRo(r.urgency)}] ${r.title}: ${r.recommendedAction}`;
        if (r.estimatedRepairCost) {
            const c = r.estimatedRepairCost;
            line += ` (est. ${c.min}–${c.max} ${c.currency || 'RON'})`;
        }
        return line;
    });

    if (overdue.length > 0) {
        parts.push(`Mentenanță restantă: ${overdue.map(m => m.item_name).join(', ')}.`);
    }

    return reply(parts.join('\n'), 'HIGH', 'RECOMMENDATIONS',
        ['RecommendationEngine', 'MaintenanceCalculator'],
        ['Cât costă reparația?', 'Pot face un drum lung?']);
}

function handleEngine(q, ctx) {
    const h        = ctx.health;
    const motorSub = h?.subsystems?.motor;
    const score    = h?.engineScore;
    const devs     = ctx.baselineDeviations || {};
    const preds    = (ctx.predictions || []).filter(p =>
        ['INJECTOR_WEAR', 'VACUUM_LEAK', 'FUEL_PUMP_DEGRADATION', 'MAF_DEGRADATION'].includes(p.failureId));

    let answer = `Motor: ${scoreLabel(score)}. `;
    if (motorSub?.status) answer += `${motorSub.status}. `;

    const devKeys = ['maf', 'map', 'lambda', 'coolant'].filter(k => devs[k] != null && Math.abs(devs[k]) > 5);
    if (devKeys.length > 0) {
        answer += `Abateri față de baseline: ${devKeys.map(k =>
            `${k.toUpperCase()} ${devs[k] > 0 ? '+' : ''}${devs[k].toFixed(1)}%`).join(', ')}. `;
    }

    answer += preds.length > 0
        ? `Riscuri detectate: ${preds.map(p => `${p.component} (${p.probability}%)`).join(', ')}.`
        : 'Niciun risc la motorizare detectat.';

    return reply(answer.trim(), score != null ? 'HIGH' : 'MEDIUM', 'ENGINE',
        ['HealthEngine', 'FaultPredictionEngine'],
        ['Cum e consumul?', 'Ce s-a schimbat față de înainte?', 'Pot face un drum lung?']);
}

function handleTurbo(q, ctx) {
    const caps     = ctx.capabilities;
    const turboSub = ctx.health?.subsystems?.turbo;
    const turboPred = (ctx.predictions || []).find(p => p.failureId === 'TURBO_WEAR');
    const devs     = ctx.baselineDeviations || {};

    if (caps && !caps.hasTurbo) {
        return reply('Vehiculul nu are turbosuflantă (motor aspirat natural).', 'HIGH', 'TURBO',
            ['VehicleCapabilities'], ['Cum e motorul?', 'Cum e consumul?']);
    }

    let answer = turboSub
        ? `Turbosuflantă: ${turboSub.status || ''} — scor ${turboSub.score}/100. `
        : 'Turbosuflantă: ';

    if (devs.boost != null && Math.abs(devs.boost) > 3) {
        answer += `Presiune boost față de baseline: ${devs.boost > 0 ? '+' : ''}${devs.boost.toFixed(1)}%. `;
    }

    if (turboPred) {
        answer += `Risc uzură turbină: ${turboPred.probability}% probabilitate (${turboPred.severity}). `;
        const rec = (ctx.topRecommendations || []).find(r => r.failureId === 'TURBO_WEAR');
        if (rec?.recommendedAction) answer += rec.recommendedAction;
    } else {
        answer += 'Niciun risc de uzură turbosuflantă detectat.';
    }

    return reply(answer.trim(), (turboSub || turboPred) ? 'HIGH' : 'MEDIUM', 'TURBO',
        ['HealthEngine', 'FaultPredictionEngine'],
        ['Pot face un drum lung?', 'Cum e motorul?', 'Ce trebuie reparat?']);
}

function handleFuel(q, ctx) {
    const fuelSub  = ctx.health?.subsystems?.combustibil;
    const fuelScore = ctx.health?.fuelScore;
    const devs     = ctx.baselineDeviations || {};
    const preds    = (ctx.predictions || []).filter(p =>
        ['INJECTOR_WEAR', 'FUEL_PUMP_DEGRADATION', 'MAF_DEGRADATION'].includes(p.failureId));

    let answer = `Sistem combustibil: ${scoreLabel(fuelScore)}. `;
    if (fuelSub?.status) answer += `${fuelSub.status}. `;

    if (devs.cost != null && Math.abs(devs.cost) > 5) {
        answer += `Cost per cursă față de baseline: ${devs.cost > 0 ? '+' : ''}${devs.cost.toFixed(1)}%. `;
    }

    answer += preds.length > 0
        ? `Riscuri: ${preds.map(p => `${p.component} (${p.probability}%)`).join(', ')}.`
        : 'Injecție și alimentare în parametri normali.';

    return reply(answer.trim(), fuelScore != null ? 'HIGH' : 'MEDIUM', 'FUEL',
        ['HealthEngine', 'FaultPredictionEngine'],
        ['Cum e motorul?', 'Ce s-a schimbat față de înainte?', 'Cum e stilul meu de condus?']);
}

function handleElectric(q, ctx) {
    const elSub  = ctx.health?.subsystems?.electric;
    const devs   = ctx.baselineDeviations || {};
    const altPred = (ctx.predictions || []).find(p => p.failureId === 'ALTERNATOR_FAILURE');
    const batPred = (ctx.predictions || []).find(p => p.failureId === 'BATTERY_DEGRADATION');

    let answer = elSub
        ? `Sistem electric: ${elSub.status || ''} — scor ${elSub.score}/100. `
        : 'Sistem electric: ';

    if (devs.voltaj != null && Math.abs(devs.voltaj) > 3) {
        answer += `Tensiune alternator față de baseline: ${devs.voltaj > 0 ? '+' : ''}${devs.voltaj.toFixed(1)}%. `;
    }

    if (altPred) {
        answer += `Risc alternator: ${altPred.probability}% (${altPred.severity}). `;
        const rec = (ctx.topRecommendations || []).find(r => r.failureId === 'ALTERNATOR_FAILURE');
        if (rec?.recommendedAction) answer += rec.recommendedAction;
    } else if (batPred) {
        answer += `Risc degradare baterie: ${batPred.probability}% (${batPred.severity}).`;
    } else {
        answer += 'Alternator și baterie în parametri normali.';
    }

    return reply(answer.trim(), (elSub || altPred || batPred) ? 'HIGH' : 'MEDIUM', 'ELECTRIC',
        ['HealthEngine', 'FaultPredictionEngine'],
        ['Cum e starea generală?', 'Pot face un drum lung?']);
}

function handleCooling(q, ctx) {
    const racireSub   = ctx.health?.subsystems?.racire;
    const motorSub    = ctx.health?.subsystems?.motor;
    const activeSub   = racireSub || null;
    const coolingPred = (ctx.predictions || []).find(p => p.failureId === 'COOLING_SYSTEM_FAILURE');
    const devs        = ctx.baselineDeviations || {};

    let answer = activeSub
        ? `Sistem răcire: ${activeSub.status || ''} — scor ${activeSub.score}/100. `
        : 'Sistem răcire: ';

    if (devs.coolant != null && Math.abs(devs.coolant) > 3) {
        answer += `Temperatură coolant față de baseline: ${devs.coolant > 0 ? '+' : ''}${devs.coolant.toFixed(1)}%. `;
    }

    if (!activeSub && motorSub && (motorSub.score ?? 100) < 75) {
        answer += `Motorul prezintă potențiale probleme termice (scor motor ${motorSub.score}/100). `;
    }

    if (coolingPred) {
        answer += `Risc răcire: ${coolingPred.probability}% (${coolingPred.severity}). `;
        const rec = (ctx.topRecommendations || []).find(r => r.failureId === 'COOLING_SYSTEM_FAILURE');
        if (rec?.recommendedAction) answer += rec.recommendedAction;
    } else {
        answer += 'Niciun risc de supraîncălzire detectat.';
    }

    return reply(answer.trim(), (activeSub || coolingPred) ? 'HIGH' : 'MEDIUM', 'COOLING',
        ['HealthEngine', 'FaultPredictionEngine'],
        ['Cum e motorul?', 'Pot face un drum lung?']);
}

function handleDPF(q, ctx) {
    const caps   = ctx.capabilities;
    const dpfPred = (ctx.predictions || []).find(p => p.failureId === 'DPF_CLOGGING');
    const traits = ctx.dna?.traits || [];

    if (caps && !caps.hasDPF) {
        return reply('Vehiculul nu este echipat cu filtru de particule DPF.',
            'HIGH', 'DPF', ['VehicleCapabilities'],
            ['Cum e motorul?', 'Cum e consumul?']);
    }

    let answer = 'Filtru particule DPF: ';
    if (dpfPred) {
        answer += `risc colmatare ${dpfPred.probability}% (${dpfPred.severity}). `;
        const rec = (ctx.topRecommendations || []).find(r => r.failureId === 'DPF_CLOGGING');
        if (rec?.recommendedAction) answer += `${rec.recommendedAction}. `;
        answer += 'Curse mai lungi favorizează regenerarea pasivă.';
    } else {
        const dpfTrait = traits.find(t => (t?.toLowerCase() || '').includes('dpf') || (t?.toLowerCase() || '').includes('regenerar'));
        answer += dpfTrait ? `${dpfTrait}.` : 'Funcționează normal, niciun risc de colmatare detectat.';
    }

    return reply(answer.trim(), dpfPred ? 'HIGH' : 'MEDIUM', 'DPF',
        ['FaultPredictionEngine', 'VehicleDNA'],
        ['Cum e consumul?', 'Ce trebuie reparat?', 'Pot face un drum lung?']);
}

function handleEGR(q, ctx) {
    const caps   = ctx.capabilities;
    const egrPred = (ctx.predictions || []).find(p => p.failureId === 'EGR_CARBON');

    if (caps && caps.hasEGR === false) {
        return reply('Vehiculul nu este echipat cu supapă EGR sau aceasta nu este monitorizată.',
            'MEDIUM', 'EGR', ['VehicleCapabilities'],
            ['Cum e motorul?', 'Cum e consumul?']);
    }

    let answer = 'Sistem EGR: ';
    if (egrPred) {
        answer += `risc depuneri carbon ${egrPred.probability}% (${egrPred.severity}). `;
        const rec = (ctx.topRecommendations || []).find(r => r.failureId === 'EGR_CARBON');
        if (rec?.recommendedAction) answer += rec.recommendedAction;
    } else {
        answer += 'Niciun risc de colmatare EGR detectat.';
    }

    return reply(answer.trim(), egrPred ? 'HIGH' : 'MEDIUM', 'EGR',
        ['FaultPredictionEngine'],
        ['Cum e motorul?', 'Cum e consumul?', 'Ce trebuie reparat?']);
}

function handleDrivingStyle(q, ctx) {
    const h          = ctx.health;
    const drivingScore = h?.drivingScore;
    const safetyScore  = h?.safetyScore;
    const drivingSub   = h?.subsystems?.stil_condus;
    const traits = ctx.dna?.traits || [];

    if (drivingScore == null) {
        return reply('Insuficiente date pentru evaluarea stilului de condus. Mai înregistrează curse.',
            'LOW', 'DRIVING_STYLE', ['HealthEngine'],
            ['Cum e starea generală?', 'Cum e consumul?']);
    }

    const label = drivingScore >= 85 ? 'economic' : drivingScore >= 70 ? 'moderat' : 'agresiv';
    let answer = `Stil de condus: ${label} — scor ${drivingScore}/100. `;
    if (safetyScore != null) answer += `Siguranță: ${safetyScore}/100. `;
    if (drivingSub?.status) answer += `${drivingSub.status}. `;

    const relevantTraits = traits.filter(t =>
        ['agresiv', 'economic', 'consistent', 'scurte', 'lungi', 'urban', 'autostrada']
            .some(kw => (t?.toLowerCase() || '').includes(kw))
    );
    if (relevantTraits.length > 0) answer += `Profil: ${relevantTraits.join(', ')}.`;

    return reply(answer.trim(), 'HIGH', 'DRIVING_STYLE',
        ['HealthEngine', 'VehicleDNA'],
        ['Cum e consumul?', 'Cum e starea generală?']);
}

function handleMaintenance(q, ctx) {
    const overdue = ctx.maintenanceOverdue || [];
    const plannedRecs = (ctx.topRecommendations || [])
        .filter(r => r.urgency === 'SOON' || r.urgency === 'PLANNED');

    if (overdue.length === 0 && plannedRecs.length === 0) {
        return reply('Mentenanța este la zi. Niciun element restant detectat.',
            'HIGH', 'MAINTENANCE', ['MaintenanceCalculator'],
            ['Cum e starea generală?', 'Pot face un drum lung?']);
    }

    const parts = [];
    if (overdue.length > 0) {
        parts.push(`Restante (${overdue.length}):\n${overdue.map(m => {
            let s = `• ${m.item_name}`;
            if (m.wear_percent != null) s += ` — uzură ${Math.round(m.wear_percent)}%`;
            if (m.remaining_km != null) s += `, rămași ${m.remaining_km.toLocaleString('ro-RO')} km`;
            return s;
        }).join('\n')}`);
    }
    if (plannedRecs.length > 0) {
        parts.push(`Planificate: ${plannedRecs.map(r => r.title).join(', ')}.`);
    }

    return reply(parts.join('\n'), 'HIGH', 'MAINTENANCE',
        ['MaintenanceCalculator', 'RecommendationEngine'],
        ['Cât costă reparația?', 'Ce trebuie reparat mai întâi?']);
}

function handleBaseline(q, ctx) {
    const devs = ctx.baselineDeviations || {};

    if (Object.keys(devs).length === 0) {
        return reply('Insuficiente date istorice. Înregistrează mai multe curse pentru a detecta abateri.',
            'LOW', 'BASELINE', ['BaselineEngine'],
            ['Cum e starea generală?']);
    }

    const significant = Object.entries(devs)
        .filter(([, v]) => v != null && Math.abs(v) > 5)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (significant.length === 0) {
        return reply('Toți parametrii monitorizați sunt în limite normale față de historicul vehiculului.',
            'HIGH', 'BASELINE', ['BaselineEngine'],
            ['Cum e starea generală?', 'Ce se poate strica?']);
    }

    const NAMES = {
        coolant: 'Temperatură coolant', voltaj: 'Tensiune alternator',
        maf: 'Debit aer (MAF)', cost: 'Cost/consum per cursă',
        health_score: 'Scor sănătate', boost: 'Presiune boost', map: 'Presiune MAP'
    };

    const lines = significant.slice(0, 4).map(([k, v]) => {
        const name = NAMES[k] || k.toUpperCase();
        const dir  = v > 0 ? 'a crescut' : 'a scăzut';
        return `• ${name} ${dir} cu ${Math.abs(v).toFixed(1)}% față de baseline`;
    });

    return reply(`Abateri față de normalul vehiculului:\n${lines.join('\n')}.`,
        'HIGH', 'BASELINE', ['BaselineEngine'],
        ['Ce se poate strica?', 'Cum e motorul?', 'Ce trebuie reparat?']);
}

function handleCost(q, ctx) {
    const recs = (ctx.topRecommendations || []).filter(r => r.estimatedRepairCost);

    if (recs.length === 0) {
        return reply('Nicio estimare de cost disponibilă în prezent.',
            'MEDIUM', 'COST', ['FailureLibrary'],
            ['Ce trebuie reparat?', 'Cum e starea generală?']);
    }

    const lines = recs.map(r => {
        const c = r.estimatedRepairCost;
        return `• ${r.title}: ${c.min}–${c.max} ${c.currency || 'RON'}`;
    });

    const totalMin = recs.reduce((s, r) => s + (r.estimatedRepairCost?.min || 0), 0);
    const note = totalMin > 0 ? `\nTotal minim estimat: ~${totalMin.toLocaleString('ro-RO')} RON.` : '';

    return reply(`Estimări costuri reparații:\n${lines.join('\n')}${note}`,
        'MEDIUM', 'COST', ['FailureLibrary', 'RecommendationEngine'],
        ['Ce trebuie reparat mai întâi?', 'Pot face un drum lung?']);
}

function handleKnowledge(q, ctx) {
    const id       = ctx.identity  || {};
    const caps     = ctx.capabilities || {};
    const complete = ctx.dataCompleteness;

    const capList = Object.entries(caps)
        .filter(([, v]) => v === true)
        .map(([k]) => k.replace(/^has/, '').replace(/([A-Z])/g, ' $1').trim());

    let answer = '';
    if (id.make && id.model) answer += `Vehicul: ${id.make} ${id.model} ${id.year || ''} · ${id.engineCode || id.fuelType || ''}. `;
    answer += `Completitudine date: ${complete ?? '?'}%. `;
    if (capList.length > 0) answer += `Sisteme monitorizate: ${capList.join(', ')}.`;
    if (id.timingBeltIntervalKm) answer += ` Interval curea distribuție: ${Number(id.timingBeltIntervalKm).toLocaleString('ro-RO')} km.`;

    return reply(answer.trim(), 'HIGH', 'KNOWLEDGE',
        ['VehicleCapabilities', 'KnowledgePackRegistry'],
        ['Cum e starea generală?', 'Ce se poate strica?']);
}

function handleDocuments(q, ctx) {
    const docs = ctx.documents || [];

    if (docs.length === 0) {
        return reply(
            'Nu am înregistrate documente pentru vehicul. Adaugă ITP, RCA, CASCO și Rovinietă în secțiunea Documente.',
            'MEDIUM', 'DOCUMENTS', [],
            ['Cum e starea generală?', 'Ce mentenanță am restantă?']
        );
    }

    const expired  = docs.filter(d => d.status === 'EXPIRED');
    const expiring = docs.filter(d => d.status === 'EXPIRING');
    const active   = docs.filter(d => d.status === 'ACTIVE');

    const parts = [];

    if (expired.length > 0) {
        parts.push(`Expirate (${expired.length}): ${expired.map(d => d.title).join(', ')}.`);
    }
    if (expiring.length > 0) {
        const details = expiring.map(d => {
            if (!d.expiry_date) return d.title;
            const msLeft = d.expiry_date * 1000 - Date.now();
            const daysLeft = Math.ceil(msLeft / 86400000);
            return `${d.title} — ${daysLeft > 0 ? `${daysLeft} zile` : 'astăzi'}`;
        });
        parts.push(`Expiră curând: ${details.join(', ')}.`);
    }
    if (active.length > 0) {
        parts.push(`La zi: ${active.map(d => d.title).join(', ')}.`);
    }

    const REQUIRED = ['ITP', 'RCA', 'ROVINIETA', 'CASCO'];
    const docTypes = docs.map(d => (d.type || '').toUpperCase());
    const missing  = REQUIRED.filter(r => !docTypes.some(t => t.includes(r)));
    if (missing.length > 0) {
        parts.push(`Posibil lipsă: ${missing.join(', ')} — adaugă în secțiunea Documente.`);
    }

    const confidence = expired.length > 0 || expiring.length > 0 ? 'HIGH' : 'MEDIUM';
    const related = ['Ce mentenanță am restantă?', 'Cum e starea generală?'];

    return reply(parts.join(' '), confidence, 'DOCUMENTS', [], related);
}

function handleFallback(q, ctx) {
    const topics = [
        '• Stare generală  (ex: "Cum e mașina?")',
        '• Drum lung       (ex: "Pot merge pe autostradă?")',
        '• Predicții       (ex: "Ce se poate strica?")',
        '• Motor / Turbo   (ex: "Cum e motorul?", "Cum e turbo?")',
        '• Consum          (ex: "Cum e consumul?")',
        '• Mentenanță      (ex: "Ce revizie am restantă?")',
        '• Documente       (ex: "Când expiră ITP?", "Ce documente lipsesc?")',
        '• Costuri         (ex: "Cât costă reparația?")',
        '• Abateri         (ex: "Ce s-a schimbat față de înainte?")',
    ];

    return reply(
        `Pot răspunde la întrebări despre vehiculul tău:\n${topics.join('\n')}`,
        'LOW', 'FALLBACK', [],
        ['Cum e starea generală?', 'Pot face un drum lung?', 'Ce se poate strica?']
    );
}

// ── Reply builder ─────────────────────────────────────────────────────────────

function reply(answer, confidence, intent, sources, relatedQuestions) {
    return { answer, confidence, intent, sources: sources || [], relatedQuestions: relatedQuestions || [] };
}

// ── Suggested questions (context-sensitive) ───────────────────────────────────

function buildSuggestedQuestions(ctx) {
    if (!ctx) return ['Cum e starea generală?', 'Pot face un drum lung?', 'Ce știi despre mașina mea?'];

    const q      = [];
    const preds  = ctx.predictions || [];
    const recs   = ctx.topRecommendations || [];
    const caps   = ctx.capabilities || {};
    const overdue = ctx.maintenanceOverdue || [];

    // Always present
    q.push('Cum e starea generală?');
    q.push('Pot face un drum lung?');

    // Context-driven
    if (preds.some(p => p.severity === 'HIGH'))
        q.push('Ce se poate strica?');

    if (recs.length > 0)
        q.push('Ce trebuie reparat?');

    if (overdue.length > 0)
        q.push('Ce mentenanță am restantă?');

    if (caps.hasTurbo && preds.find(p => p.failureId === 'TURBO_WEAR'))
        q.push('Cum e turbosuflanta?');

    if (preds.find(p => ['ALTERNATOR_FAILURE', 'BATTERY_DEGRADATION'].includes(p.failureId)))
        q.push('Cum e sistemul electric?');

    if (caps.hasDPF && preds.find(p => p.failureId === 'DPF_CLOGGING'))
        q.push('Cum e filtrul DPF?');

    if ((ctx.documents || []).some(d => d.status === 'EXPIRED' || d.status === 'EXPIRING'))
        q.push('Ce documente am expirate?');

    q.push('Ce s-a schimbat față de înainte?');
    q.push('Cât costă reparațiile?');

    return [...new Set(q)].slice(0, 6);
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

const HANDLERS = {
    OVERALL_STATUS:  handleOverallStatus,
    LONG_TRIP:       handleLongTrip,
    PREDICTIONS:     handlePredictions,
    RECOMMENDATIONS: handleRecommendations,
    ENGINE:          handleEngine,
    TURBO:           handleTurbo,
    FUEL:            handleFuel,
    ELECTRIC:        handleElectric,
    COOLING:         handleCooling,
    DPF:             handleDPF,
    EGR:             handleEGR,
    DRIVING_STYLE:   handleDrivingStyle,
    MAINTENANCE:     handleMaintenance,
    BASELINE:        handleBaseline,
    TREND:           handleBaseline,
    COST:            handleCost,
    KNOWLEDGE:       handleKnowledge,
    DOCUMENTS:       handleDocuments,
    FALLBACK:        handleFallback,
};

function answer(question, ctx) {
    if (!question?.trim()) return handleFallback('', ctx);
    const nq     = normalize(question);
    const intent = classifyIntent(nq);
    const handler = HANDLERS[intent] || handleFallback;
    return { ...handler(nq, ctx), rawQuestion: question };
}

// ══════════════════════════════════════════════════════════════════════════════
// MULTI-TURN CONVERSATION — follow-up detection & resolution
// Rulează ÎNAINTE de classifyIntent. Nu duplică logica motoarelor existente.
// Datele vin exclusiv din DigitalTwinSerializer.toAIExpert().
// ══════════════════════════════════════════════════════════════════════════════

const FOLLOWUP_PATTERNS = [
    { id: 'WHY',
      kw: ['de ce', 'din ce cauza', 'ce a cauzat', 'ce il cauzeaza', 'de ce se intampla',
           'ce a produs', 'motivul', 'cauza', 'de ce apare'] },
    { id: 'COST',
      kw: ['cat costa', 'pretul', 'cat e', 'cat platesc', 'cat ar costa',
           'costul', 'suma', 'cat e reparatia', 'bugetul', 'cat face'] },
    { id: 'IGNORE_RISK',
      kw: ['si daca mai merg', 'daca ignor', 'daca nu repar', 'pot astepta',
           'ce se intampla daca', 'e grav daca', 'consecinte', 'si daca las asa',
           'ce risc am', 'daca aman'] },
    { id: 'WHEN',
      kw: ['cand ar trebui', 'cand schimb', 'cand trebuie', 'cat mai tine',
           'cat mai dureaza', 'cand se strica', 'cum stiu cand', 'intervalul'] },
    { id: 'URGENCY',
      kw: ['e urgent', 'cat de urgent', 'trebuie reparat acum', 'e grav', 'cat de grav',
           'trebuie sa merg imediat', 'prioritate', 'cat de important'] },
    { id: 'HOW_FIX',
      kw: ['cum se repara', 'cum il repar', 'ce pasi', 'diy', 'il repar singur',
           'cum procedez', 'cum rezolv', 'solutia'] },
    { id: 'WORKSHOP',
      kw: ['unde il repar', 'la ce service', 'ce tip de service', 'specialist',
           'dealer', 'unde ma duc', 'unde sa merg', 'ce service'] },
    { id: 'MORE',
      kw: ['mai spune', 'mai mult', 'mai multe detalii', 'si altceva',
           'continua', 'altceva de stiut', 'alte informatii', 'mai mult despre'] },
];

// Grupuri de componente — detectează dacă o întrebare introduce un NOU subiect
const COMP_GROUPS = [
    ['turbo', 'suflanta', 'boost'],
    ['alternator', 'baterie', 'electric', 'tensiune'],
    ['racire', 'coolant', 'termostat', 'radiator'],
    ['dpf', 'filtru particule'],
    ['egr', 'supapa egr', 'recirculare gaze'],
    ['injectoare', 'injectie', 'maf', 'pompa combustibil'],
    ['motor', 'compresie', 'cilindri'],
];
const COMP_GROUP_INTENT = ['TURBO', 'ELECTRIC', 'COOLING', 'DPF', 'EGR', 'FUEL', 'ENGINE'];

function mentionsNewComponent(q, lastTopic) {
    if (!lastTopic?.intent) return false;
    const lastIdx = COMP_GROUP_INTENT.indexOf(lastTopic.intent);
    for (let i = 0; i < COMP_GROUPS.length; i++) {
        if (i === lastIdx) continue;
        if (COMP_GROUPS[i].some(kw => q.includes(normalize(kw)))) return true;
    }
    return false;
}

function detectFollowUp(nq, lastTopic) {
    if (!lastTopic) return null;
    if (mentionsNewComponent(nq, lastTopic)) return null;

    for (const pattern of FOLLOWUP_PATTERNS) {
        if (matchesAny(nq, pattern.kw)) return pattern.id;
    }

    // Întrebări ≤4 cuvinte + pronume referențiale → follow-up generic
    const words = nq.split(' ').filter(Boolean);
    if (words.length <= 4 && matchesAny(nq, ['asta', 'acesta', 'el', 'ea', 'aia'])) {
        return 'MORE';
    }
    return null;
}

// ── Extrage subiectul activ dintr-un răspuns AI (pentru follow-up-uri viitoare) ──

function extractTopic(intent, ctx) {
    const preds = ctx.predictions        || [];
    const recs  = ctx.topRecommendations || [];
    const maint = ctx.maintenanceOverdue || [];

    const INTENT_FAILUREID = {
        TURBO:   'TURBO_WEAR',
        COOLING: 'COOLING_SYSTEM_FAILURE',
        DPF:     'DPF_CLOGGING',
        EGR:     'EGR_CARBON',
    };
    const INTENT_COMPONENT = {
        TURBO:         'turbosuflantă',
        ELECTRIC:      'sistem electric',
        COOLING:       'sistem răcire',
        DPF:           'filtru DPF',
        EGR:           'supapă EGR',
        FUEL:          'sistem combustibil',
        ENGINE:        'motor',
        DRIVING_STYLE: 'stil de condus',
    };

    if (INTENT_COMPONENT[intent]) {
        const failureId = INTENT_FAILUREID[intent] || null;
        const pred = failureId
            ? preds.find(p => p.failureId === failureId)
            : preds.find(p => {
                if (intent === 'ELECTRIC') return ['ALTERNATOR_FAILURE', 'BATTERY_DEGRADATION'].includes(p.failureId);
                if (intent === 'FUEL')     return ['INJECTOR_WEAR', 'MAF_DEGRADATION', 'FUEL_PUMP_DEGRADATION'].includes(p.failureId);
                return false;
              });
        const rec = pred
            ? recs.find(r => r.failureId === pred.failureId)
            : (failureId ? recs.find(r => r.failureId === failureId) : null);
        return {
            component:           INTENT_COMPONENT[intent],
            failureId:           pred?.failureId              || failureId,
            intent,
            severity:            pred?.severity               || null,
            driveRecommendation: pred?.driveRecommendation    || rec?.driveRecommendation || null,
            urgency:             rec?.urgency                 || null,
            costEstimate:        rec?.estimatedRepairCost     || null,
            diyPossible:         rec?.diyPossible             ?? null,
            workshopType:        rec?.recommendedWorkshopType || null,
        };
    }

    if (intent === 'RECOMMENDATIONS' && recs.length > 0) {
        const r = recs[0];
        return {
            component: r.title, failureId: r.failureId, intent,
            severity: r.severity, driveRecommendation: r.driveRecommendation,
            urgency: r.urgency, costEstimate: r.estimatedRepairCost,
            diyPossible: r.diyPossible ?? null, workshopType: r.recommendedWorkshopType || null,
        };
    }

    if (intent === 'PREDICTIONS' && preds.length > 0) {
        const p = preds.find(p2 => p2.severity === 'HIGH') || preds[0];
        const r = recs.find(r2 => r2.failureId === p.failureId);
        return {
            component: p.component, failureId: p.failureId, intent,
            severity: p.severity,
            driveRecommendation: p.driveRecommendation || r?.driveRecommendation || null,
            urgency: r?.urgency || (p.severity === 'HIGH' ? 'SOON' : 'PLANNED'),
            costEstimate: r?.estimatedRepairCost   || null,
            diyPossible:  r?.diyPossible           ?? null,
            workshopType: r?.recommendedWorkshopType || null,
        };
    }

    if (intent === 'MAINTENANCE' && maint.length > 0) {
        return {
            component:       maint[0].item_name,
            failureId:       null,
            intent,
            maintenanceItem: maint[0].item_name,
            wearPercent:     maint[0].wear_percent,
            remainingKm:     maint[0].remaining_km,
            urgency:         'IMMEDIATE',
        };
    }

    if ((intent === 'OVERALL_STATUS' || intent === 'LONG_TRIP') && recs.length > 0) {
        const r = recs[0];
        return {
            component: r.title, failureId: r.failureId, intent,
            severity: r.severity, driveRecommendation: r.driveRecommendation,
            urgency: r.urgency, costEstimate: r.estimatedRepairCost,
        };
    }

    return null;
}

// ── Obține ultimul subiect activ din istoricul conversației ──────────────────

function getLastTopic(history) {
    if (!Array.isArray(history) || history.length === 0) return null;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === 'ai' && history[i].topicRef) return history[i].topicRef;
    }
    return null;
}

// ── Utilitare pentru follow-up replies ───────────────────────────────────────

function _noTopic(relQ) {
    return reply(
        'Nu am context suficient. Poți reformula sau pune o altă întrebare?',
        'LOW', 'FOLLOW_UP_NO_CONTEXT', [],
        relQ || ['Cum e starea generală?', 'Ce se poate strica?']
    );
}

// ── Rezolvatori per tip follow-up ────────────────────────────────────────────

function _resolveWhy(lastTopic, ctx) {
    const rec = lastTopic.failureId
        ? (ctx.topRecommendations || []).find(r => r.failureId === lastTopic.failureId)
        : null;
    if (rec?.explanation) {
        return reply(
            `De ce ${lastTopic.component}:\n${rec.explanation}`,
            'HIGH', 'FOLLOW_UP_WHY', ['RecommendationEngine'],
            ['Cât costă reparația?', 'E urgent?', 'Și dacă mai merg?']
        );
    }
    const rsm   = ctx.reasoning?.summary;
    const roots = (ctx.reasoning?.rootCauses || []).map(r => r.label || r.id).slice(0, 2).join(', ');
    if (rsm) {
        return reply(
            `${rsm}.${roots ? ` Cauze identificate: ${roots}.` : ''}`,
            'MEDIUM', 'FOLLOW_UP_WHY', ['ReasoningEngine'],
            ['Cât costă reparația?', 'E urgent?']
        );
    }
    return _noTopic(['Cât costă reparația?', 'Ce trebuie reparat?']);
}

function _resolveCost(lastTopic, ctx) {
    const rec  = lastTopic.failureId
        ? (ctx.topRecommendations || []).find(r => r.failureId === lastTopic.failureId)
        : null;
    const cost = rec?.estimatedRepairCost || lastTopic.costEstimate;
    if (cost?.min != null) {
        const comp = lastTopic.component ? `"${lastTopic.component}"` : 'această reparație';
        const diy  = rec?.diyPossible === true  ? ' Reparație DIY posibilă.' :
                     rec?.diyPossible === false  ? ' Recomand service autorizat.' : '';
        const time = rec?.estimatedRepairTime
            ? ` Timp estimat: ${rec.estimatedRepairTime.min}–${rec.estimatedRepairTime.max}h.`
            : '';
        return reply(
            `Cost estimat pentru ${comp}: ${cost.min}–${cost.max} ${cost.currency || 'RON'}.${diy}${time}`,
            'MEDIUM', 'FOLLOW_UP_COST', ['FailureLibrary'],
            ['Unde să merg la service?', 'E urgent?', 'Pot face un drum lung?']
        );
    }
    return reply(
        `Nu am estimare de cost pentru "${lastTopic.component || 'problema curentă'}".`,
        'LOW', 'FOLLOW_UP_COST', [],
        ['Ce trebuie reparat?', 'Care e cea mai urgentă problemă?']
    );
}

function _resolveIgnoreRisk(lastTopic, ctx) {
    const comp  = lastTopic.component || 'această problemă';
    const drRec = lastTopic.driveRecommendation;
    const sev   = lastTopic.severity;

    let text;
    if (drRec === 'DO_NOT_DRIVE') {
        text = `Dacă ignori și continui să conduci, riști avarie majoră. "${comp}" poate cauza pană completă sau situație periculoasă.`;
    } else if (drRec === 'WORKSHOP' || sev === 'HIGH' || sev === 'CRITICAL') {
        text = `Dacă amâni, problema se agravează. "${comp}" necesită service în scurt timp — costurile cresc cu fiecare km.`;
    } else if (drRec === 'AVOID_HIGHWAY') {
        text = `Poți conduce pe distanțe scurte, dar autostrăzile accelerează deteriorarea. "${comp}" trebuie verificat.`;
    } else {
        text = `Monitorizează situația. Ignorarea prelungită a "${comp}" poate escalada de la MEDIUM la HIGH.`;
    }

    return reply(
        text,
        drRec === 'DO_NOT_DRIVE' || sev === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        'FOLLOW_UP_IGNORE_RISK', ['FaultPredictionEngine'],
        ['Cât costă reparația?', 'E urgent?', 'Unde să merg la service?']
    );
}

function _resolveWhen(lastTopic, ctx) {
    const comp = lastTopic.component || 'componentă';

    if (lastTopic.maintenanceItem) {
        const km = lastTopic.remainingKm;
        if (km != null && km <= 0) {
            return reply(
                `"${comp}" este RESTANTĂ — a depășit intervalul recomandat. Schimbă cât mai curând.`,
                'HIGH', 'FOLLOW_UP_WHEN', ['MaintenanceCalculator'],
                ['Cât costă?', 'Unde să merg la service?']
            );
        }
        if (km != null && km > 0) {
            return reply(
                `"${comp}" mai are ~${km.toLocaleString('ro-RO')} km până la intervalul de schimb.`,
                'HIGH', 'FOLLOW_UP_WHEN', ['MaintenanceCalculator'],
                ['Cât costă?', 'Pot face un drum lung?']
            );
        }
    }

    const TIMELINE = {
        IMMEDIATE: 'Imediat — nu amâna mai mult de câteva zile.',
        SOON:      'Curând — recomand service în 2–4 săptămâni.',
        PLANNED:   'Planificat — la revizia următoare sau în 1–3 luni.',
        MONITOR:   'Monitorizare — urmărește la cursele viitoare.',
    };
    const timeline = TIMELINE[lastTopic.urgency] ||
        (lastTopic.severity === 'HIGH'   ? 'Urgent, în câteva săptămâni.' :
         lastTopic.severity === 'MEDIUM' ? 'În 1–3 luni, la revizia planificată.' :
         'Nu este urgent, monitorizează.');

    return reply(
        `Interval recomandat pentru "${comp}": ${timeline}`,
        lastTopic.urgency === 'IMMEDIATE' ? 'HIGH' : 'MEDIUM',
        'FOLLOW_UP_WHEN', ['RecommendationEngine'],
        ['Cât costă?', 'E urgent?']
    );
}

function _resolveUrgency(lastTopic, ctx) {
    const comp = lastTopic.component || 'această problemă';
    const URGENCY_TXT = {
        IMMEDIATE: `DA, urgent. "${comp}" necesită atenție imediată.`,
        SOON:      `Destul de urgent. "${comp}" trebuie rezolvat în 2–4 săptămâni.`,
        PLANNED:   `Nu e urgent imediat. "${comp}" poate fi planificat la revizia următoare.`,
        MONITOR:   `Monitorizare — "${comp}" nu e urgent acum, urmărește evoluția.`,
    };
    const text = URGENCY_TXT[lastTopic.urgency] ||
        (lastTopic.driveRecommendation === 'DO_NOT_DRIVE'
            ? `URGENT — nu conduce. "${comp}" necesită reparație imediată.`
            : lastTopic.severity === 'HIGH'
                ? `Urgent. "${comp}" cu severitate HIGH trebuie verificat curând.`
                : `Urgență scăzută pentru "${comp}". Monitorizează.`);

    return reply(
        text,
        lastTopic.urgency === 'IMMEDIATE' || lastTopic.driveRecommendation === 'DO_NOT_DRIVE' ? 'HIGH' : 'MEDIUM',
        'FOLLOW_UP_URGENCY', ['RecommendationEngine'],
        ['Cât costă?', 'Și dacă mai merg?', 'Unde să merg la service?']
    );
}

function _resolveHowFix(lastTopic, ctx) {
    const comp = lastTopic.component || 'această problemă';
    const rec  = lastTopic.failureId
        ? (ctx.topRecommendations || []).find(r => r.failureId === lastTopic.failureId)
        : (ctx.topRecommendations || [])[0];
    const parts = [];
    if (rec?.recommendedAction)       parts.push(`Acțiune: ${rec.recommendedAction}`);
    if (rec?.diyPossible === true)     parts.push('DIY posibil cu experiență mecanică.');
    if (rec?.diyPossible === false)    parts.push('Nu DIY — recomand service specializat.');
    if (rec?.recommendedWorkshopType) {
        const wt = { GENERAL: 'service general', SPECIALIST: 'specialist', DEALER: 'dealer autorizat' };
        parts.push(`Service recomandat: ${wt[rec.recommendedWorkshopType] || rec.recommendedWorkshopType}.`);
    }
    if (rec?.estimatedRepairTime) {
        parts.push(`Timp estimat: ${rec.estimatedRepairTime.min}–${rec.estimatedRepairTime.max}h.`);
    }
    if (parts.length === 0) {
        return reply(
            `Nu am pași de reparație detaliați pentru "${comp}". Consultă un service autorizat.`,
            'LOW', 'FOLLOW_UP_HOW_FIX', [],
            ['Cât costă?', 'Unde să merg la service?']
        );
    }
    return reply(
        `Cum rezolvi "${comp}":\n${parts.join('\n')}`,
        'MEDIUM', 'FOLLOW_UP_HOW_FIX', ['RecommendationEngine', 'FailureLibrary'],
        ['Cât costă?', 'E urgent?', 'Unde să merg la service?']
    );
}

function _resolveWorkshop(lastTopic, ctx) {
    const comp  = lastTopic.component || 'această problemă';
    const wType = lastTopic.workshopType;
    const TEXTS = {
        GENERAL:    `Pentru "${comp}": orice service auto de încredere.`,
        SPECIALIST: `Pentru "${comp}": service specializat în sisteme avansate.`,
        DEALER:     `Pentru "${comp}": dealer autorizat sau service specializat VAG.`,
    };
    return reply(
        TEXTS[wType] || `Du vehiculul la un service de încredere pentru "${comp}".`,
        'MEDIUM', 'FOLLOW_UP_WORKSHOP', ['FailureLibrary'],
        ['Cât costă?', 'E urgent?']
    );
}

function _resolveMore(lastTopic, ctx) {
    if (!lastTopic) return _noTopic();
    const handler = HANDLERS[lastTopic.intent];
    if (!handler) return _noTopic();
    const base  = handler('', ctx);
    const extra = [];
    if (lastTopic.failureId) {
        const pred = (ctx.predictions || []).find(p => p.failureId === lastTopic.failureId);
        if (pred?.probability != null) extra.push(`Probabilitate defect: ${pred.probability}%.`);
        if (pred?.driveRecommendation) extra.push(`Recomandare condus: ${pred.driveRecommendation}.`);
    }
    return reply(
        extra.length ? `${base.answer}\n\n${extra.join(' ')}` : base.answer,
        base.confidence, 'FOLLOW_UP_MORE', base.sources,
        ['De ce?', 'Cât costă?', 'E urgent?']
    );
}

const FOLLOWUP_RESOLVERS = {
    WHY:         _resolveWhy,
    COST:        _resolveCost,
    IGNORE_RISK: _resolveIgnoreRisk,
    WHEN:        _resolveWhen,
    URGENCY:     _resolveUrgency,
    HOW_FIX:     _resolveHowFix,
    WORKSHOP:    _resolveWorkshop,
    MORE:        _resolveMore,
};

// ── Intrare principală cu context conversațional ─────────────────────────────

function answerWithContext(question, ctx, history) {
    if (!question?.trim()) return handleFallback('', ctx);

    const nq           = normalize(question);
    const lastTopic    = getLastTopic(history);
    const followUpType = detectFollowUp(nq, lastTopic);

    if (followUpType && FOLLOWUP_RESOLVERS[followUpType]) {
        const result         = FOLLOWUP_RESOLVERS[followUpType](lastTopic, ctx);
        result.topicRef      = lastTopic;
        result.rawQuestion   = question;
        result.isFollowUp    = true;
        result.resolvedTopic = lastTopic?.component || null;
        return result;
    }

    // Cale normală — clasificare intenție + extragere subiect activ
    const intent  = classifyIntent(nq);
    const handler = HANDLERS[intent] || handleFallback;
    const result  = handler(nq, ctx);
    result.topicRef    = extractTopic(result.intent, ctx);
    result.rawQuestion = question;
    result.isFollowUp  = false;
    return result;
}

module.exports = { answer, answerWithContext, buildSuggestedQuestions };
