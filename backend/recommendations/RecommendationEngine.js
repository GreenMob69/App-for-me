/**
 * RecommendationEngine.js — transformă diagnosticele în acțiuni concrete
 * -----------------------------------------------------------------------
 * Consumă:
 *   - Failure Library  — metadata per defect (cost, timp, dificultate)
 *   - Reasoning Graph  — cauzalitate (root cause vs efect)
 *   - FaultPredictions — severitate confirmată din date senzori
 *   - RuleEngine       — probabilitate per ipoteză diagnostică
 *   - vehicleRow       — km, vârstă, make/model (context vehicul)
 *   - capabilities     — flags hasTurbo/hasDPF/etc.
 *   - knowledgePack    — thresholds și intervale specifice
 *   - powertrain       — profil propulsie (subsisteme, scoring)
 *
 * Returnează o listă ordonată de recomandări, fiecare conținând:
 *   rank, failureId, title, priority, urgency, driveAllowed,
 *   driveRecommendation, estimatedRepairCost, estimatedRepairTime,
 *   inspectionInterval, recommendedAction, recommendedWorkshopType,
 *   diyPossible, explanation, confidence, isRootCause, explainedCount,
 *   investigationSteps, relatedFailures, sources, severity
 * -----------------------------------------------------------------------
 */

const FailureLibrary = require('../failures/FailureLibrary');

// ── Constante de mapare ────────────────────────────────────────────────────

const URGENCY_FROM_DRIVE = {
    'DO_NOT_DRIVE':  'IMMEDIATE',
    'WORKSHOP':      'SOON',
    'AVOID_HIGHWAY': 'PLANNED',
    'CAUTION':       'PLANNED',
    'NORMAL':        'MONITOR'
};

const DRIVE_ALLOWED = {
    'DO_NOT_DRIVE':  false,
    'WORKSHOP':      false,
    'AVOID_HIGHWAY': true,
    'CAUTION':       true,
    'NORMAL':        true
};

const REPAIR_TIME = {
    'LOW':       { min: 0.5, max: 2,   unit: 'hours', notes: 'Reparație simplă, posibil acasă cu unelte de bază' },
    'MEDIUM':    { min: 2,   max: 6,   unit: 'hours', notes: 'Necesită atelier echipat și expertiză' },
    'HIGH':      { min: 4,   max: 12,  unit: 'hours', notes: 'Intervenție complexă, posibil ridicare grup motor' },
    'VERY_HIGH': { min: 8,   max: 24,  unit: 'hours', notes: 'Intervenție majoră — planificare în avans cu atelierul' }
};

const WORKSHOP_FROM_DIFFICULTY = {
    'LOW':       'GENERAL',
    'MEDIUM':    'GENERAL',
    'HIGH':      'SPECIALIST',
    'VERY_HIGH': 'DEALER'
};

const URGENCY_ORDER  = { IMMEDIATE: 0, SOON: 1, PLANNED: 2, MONITOR: 3 };
const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Sisteme care necesită atelier specializat chiar la dificultate MEDIUM
const SPECIALIST_SYSTEMS = new Set(['TURBO', 'DPF', 'DPF (DIESEL)', 'EGR', 'DISTRIBUTIE']);

// Sisteme care exclud DIY chiar la dificultate LOW sau MEDIUM
const NO_DIY_SYSTEMS = new Set(['TURBO', 'DPF', 'DPF (DIESEL)', 'EGR', 'DISTRIBUTIE', 'ENGINE', 'EMISII']);

// ── Funcții helper ─────────────────────────────────────────────────────────

function _getDriveRecommendation(failureDef, severity) {
    const map = failureDef?.driveRecommendation;
    if (!map) return 'CAUTION';
    return map[severity] || map['MEDIUM'] || 'CAUTION';
}

function _isDiyPossible(failureDef) {
    const difficulty = failureDef?.estimatedRepairDifficulty;
    if (!difficulty || difficulty === 'HIGH' || difficulty === 'VERY_HIGH') return false;
    if (difficulty === 'LOW') {
        // LOW este DIY dacă nu implică sisteme complexe de siguranță
        return !(failureDef.affectedSystems || []).some(s => NO_DIY_SYSTEMS.has(s));
    }
    // MEDIUM: exclus dacă sisteme complexe sunt implicate
    return false;
}

function _getWorkshopType(failureDef) {
    const difficulty = failureDef?.estimatedRepairDifficulty || 'MEDIUM';
    const base = WORKSHOP_FROM_DIFFICULTY[difficulty] || 'GENERAL';
    if (base === 'GENERAL') {
        const needsSpecialist = (failureDef?.affectedSystems || []).some(s => SPECIALIST_SYSTEMS.has(s));
        if (needsSpecialist) return 'SPECIALIST';
    }
    return base;
}

function _buildExplanation(failureDef, severity, isRootCause, explainedCount, factors) {
    const criticalWhenIgnored = failureDef.severity?.whenIgnored === 'CRITICAL';
    let text = `${failureDef.title}`;

    if (criticalWhenIgnored) {
        text += ' — problemă critică de siguranță dacă ignorată';
    } else {
        text += ` — severitate ${severity.toLowerCase()}`;
    }
    text += '.';

    if (isRootCause && explainedCount > 0) {
        text += ` Cauza rădăcină: explică ${explainedCount} alte anomalii detectate simultan.`;
    } else if (!isRootCause) {
        text += ' Consecință a unei alte probleme active — rezolvați mai întâi cauza primară.';
    }

    if (factors && factors.length > 0) {
        const top = factors[0];
        text += ` Parametru cheie: ${top.param} = ${top.value} (${top.impact}).`;
    }

    const driveRec = _getDriveRecommendation(failureDef, severity);
    if (driveRec === 'DO_NOT_DRIVE') {
        text += ' Nu conduceți vehiculul — risc de avarie majoră a motorului.';
    } else if (driveRec === 'WORKSHOP') {
        text += ' Programați atelier în cel mai scurt timp posibil.';
    } else if (driveRec === 'AVOID_HIGHWAY') {
        text += ' Evitați autostrada și viteze mari până la remediere.';
    }

    return text;
}

// ── Constructor per recomandare ────────────────────────────────────────────

function _buildRecommendation(failureId, sourcesSet, reasoning, predictions, diagnostics) {
    const failureDef = FailureLibrary.getById(failureId);
    if (!failureDef) return null;

    // Severitate: cel mai grav rezultat din toate sursele
    let severity   = failureDef.severity?.default || 'MEDIUM';
    let confidence = 40;
    let factors    = [];

    const matchPred = (predictions || []).find(p => p.failureId === failureId);
    const matchDiag = (diagnostics  || []).find(d => d.failureId === failureId);

    if (matchPred) {
        if (SEVERITY_ORDER[matchPred.severity] < SEVERITY_ORDER[severity]) {
            severity = matchPred.severity;
        }
        confidence = Math.max(confidence, matchPred.confidence || 50);
        factors    = matchPred.factors || [];
    }
    if (matchDiag) {
        const diagSev = matchDiag.probability > 70 ? 'HIGH' : matchDiag.probability > 40 ? 'MEDIUM' : 'LOW';
        if (SEVERITY_ORDER[diagSev] < SEVERITY_ORDER[severity]) severity = diagSev;
        confidence = Math.max(confidence, matchDiag.probability || 40);
    }

    // Poziție în graful cauzal
    const rootEntry    = (reasoning?.rootCauses || []).find(r => r.id === failureId);
    const isRootCause  = !!rootEntry || (reasoning?.classification?.causes || []).some(c => c.id === failureId);
    const explainedCount = rootEntry?.explainedCount || 0;

    // Boost confidence din surse multiple și confirmare reasoning
    const sourceCount = sourcesSet.size;
    confidence = Math.min(95, confidence + (sourceCount - 1) * 8 + (isRootCause ? 10 : 0));

    const driveRecommendation = _getDriveRecommendation(failureDef, severity);
    const urgency = URGENCY_FROM_DRIVE[driveRecommendation] || 'PLANNED';

    // Defectele care sunt efecte ale altor cauze active: scadem urgența o treaptă
    // (nu are sens să repari efectul înainte de cauza rădăcină)
    const isEffect = !isRootCause && (reasoning?.classification?.effects || []).some(e => e.id === failureId);

    // Defectele legate de lanțul cauzal al root cause-ului
    const relatedFailures = (rootEntry?.explainedNodes || [])
        .filter(id => id !== failureId && FailureLibrary.getById(id) !== null);

    return {
        failureId,
        title:               failureDef.title,
        category:            failureDef.category,
        rank:                null,        // setată după sortare
        urgency:             isEffect && urgency !== 'IMMEDIATE' ? _downgradeUrgency(urgency) : urgency,
        severity,
        driveAllowed:        DRIVE_ALLOWED[driveRecommendation] ?? true,
        driveRecommendation,
        estimatedRepairCost: failureDef.estimatedRepairCostRange  || null,
        estimatedRepairTime: REPAIR_TIME[failureDef.estimatedRepairDifficulty] || REPAIR_TIME['MEDIUM'],
        inspectionInterval:  failureDef.inspectionInterval        || null,
        recommendedAction:   failureDef.recommendedActions?.[severity]
                          || failureDef.recommendedActions?.['MEDIUM'] || '',
        recommendedWorkshopType: _getWorkshopType(failureDef),
        diyPossible:         _isDiyPossible(failureDef),
        explanation:         _buildExplanation(failureDef, severity, isRootCause, explainedCount, factors),
        confidence:          Math.round(confidence),
        isRootCause,
        isEffect,
        explainedCount,
        investigationSteps:  failureDef.investigationSteps || [],
        relatedFailures,
        sources:             Array.from(sourcesSet)
    };
}

function _downgradeUrgency(urgency) {
    const order = ['IMMEDIATE', 'SOON', 'PLANNED', 'MONITOR'];
    const idx = order.indexOf(urgency);
    return idx < order.length - 1 ? order[idx + 1] : urgency;
}

// ── API public ─────────────────────────────────────────────────────────────

/**
 * Generează lista ordonată de recomandări.
 *
 * @param {Object} opts
 *   @param {Object|null} opts.reasoning     — output ReasoningEngine
 *   @param {Array}       opts.predictions   — output FaultPredictionEngine
 *   @param {Array}       opts.diagnostics   — output RuleEngine
 *   @param {Object|null} opts.vehicleRow    — rândul din DB vehicles
 *   @param {Object|null} opts.capabilities  — VehicleCapabilities
 *   @param {Object|null} opts.knowledgePack — KnowledgePack activ
 *   @param {Object|null} opts.powertrain    — PowertrainProfile
 * @returns {Array} recomandări sortate, rank 1 = cea mai urgentă
 */
function generateRecommendations({
    reasoning,
    predictions,
    diagnostics,
    vehicleRow,
    capabilities,
    knowledgePack,
    powertrain
} = {}) {

    // ── Colectare failureId-uri unice din toate sursele ────────────────
    const seen = new Map(); // failureId → Set<source>

    function _add(id, source) {
        if (!id) return;
        if (!seen.has(id)) seen.set(id, new Set());
        seen.get(id).add(source);
    }

    // Reasoning: cauze rădăcină
    for (const rc of (reasoning?.rootCauses || [])) {
        _add(rc.id, 'REASONING_ROOT');
    }
    // Reasoning: efecte directe care sunt FAILURE nodes
    for (const ef of (reasoning?.classification?.effects || [])) {
        if (FailureLibrary.getById(ef.id)) _add(ef.id, 'REASONING_EFFECT');
    }
    // Reasoning: intermediate
    for (const nd of (reasoning?.classification?.intermediate || [])) {
        if (FailureLibrary.getById(nd.id)) _add(nd.id, 'REASONING_INTERMEDIATE');
    }

    // FaultPredictionEngine (severity MEDIUM sau HIGH, sau LOW cu prob > 40)
    for (const p of (predictions || [])) {
        if (!p.failureId) continue;
        if (p.severity === 'HIGH' || p.severity === 'MEDIUM') _add(p.failureId, 'PREDICTION');
        else if (p.severity === 'LOW' && (p.probability || 0) >= 40) _add(p.failureId, 'PREDICTION_LOW');
    }

    // RuleEngine (probability > 30 și failureId prezent)
    for (const d of (diagnostics || [])) {
        if (d.failureId && d.probability > 30) _add(d.failureId, 'RULE');
    }

    if (seen.size === 0) return [];

    // ── Construire recomandări ─────────────────────────────────────────
    const recs = [];
    for (const [failureId, sourcesSet] of seen) {
        const rec = _buildRecommendation(failureId, sourcesSet, reasoning, predictions, diagnostics);
        if (rec) recs.push(rec);
    }

    // ── Sortare după ordine optimă de intervenție ──────────────────────
    // 1. Urgency (IMMEDIATE > SOON > PLANNED > MONITOR)
    // 2. Root causes înainte de efecte (la aceeași urgency)
    // 3. Numărul de alte noduri explicate (impact mai mare = mai întâi)
    // 4. Severity
    // 5. Cost estimat (mai accesibil = mai întâi — preferă fix-ul mai ieftin când totul e egal)
    recs.sort((a, b) => {
        const u = (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9);
        if (u !== 0) return u;

        const rc = (a.isRootCause ? 0 : 1) - (b.isRootCause ? 0 : 1);
        if (rc !== 0) return rc;

        const ex = (b.explainedCount || 0) - (a.explainedCount || 0);
        if (ex !== 0) return ex;

        const s = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (s !== 0) return s;

        return (a.estimatedRepairCost?.min ?? 9999) - (b.estimatedRepairCost?.min ?? 9999);
    });

    recs.forEach((rec, i) => { rec.rank = i + 1; });
    return recs;
}

module.exports = { generateRecommendations };
