/**
 * ReasoningEngine.js — motor de reasoning cauzal determinist
 * -----------------------------------------------------------------------
 * Răspunde la întrebări diagnostice fără ML și fără LLM:
 *
 *   1. Care este cauza cea mai probabilă?
 *   2. Ce defect explică cele mai multe simptome active?
 *   3. Ce este consecință și ce este cauză (root vs effect)?
 *   4. Care sunt efectele în lanț ale unui defect?
 *
 * Intrare: lista nodurilor active (din predicții + reguli + senzori)
 * Ieșire:  { rootCauses, bestExplainer, classification, chains, confidence }
 *
 * Nu conține logică de ML, LLM sau fuzzy. Totul este determin și
 * bazat pe graful cauzal definit în graph/edges.json.
 * -----------------------------------------------------------------------
 */

const { graph, CAUSAL_RELATIONS } = require('./CausalGraph');

// ── Praguri pentru derivarea sensor-states din summary ─────────────────────
const SENSOR_STATE_RULES = [
    {
        id: 'BOOST_LOW',
        derive: (s, cap) => cap?.hasTurbo && s?.pid?.boost?.average !== undefined && s.pid.boost.average < 0.8
    },
    {
        id: 'MAF_LOW',
        derive: (s) => s?.pid?.maf?.average !== undefined && s.pid.maf.average < 18 && (s?.pid?.rpm?.average || 0) > 1800
    },
    {
        id: 'VOLTAGE_LOW',
        derive: (s) => s?.pid?.voltage?.min !== undefined && s.pid.voltage.min < 12.0
    },
    {
        id: 'COOLANT_TEMP_HIGH',
        derive: (s) => s?.pid?.coolant?.max !== undefined && s.pid.coolant.max > 98
    },
    {
        id: 'FUEL_RATE_HIGH',
        derive: (s) => s?.fuel?.averageInstant !== undefined && s.fuel.averageInstant > 8.5
    },
    {
        id: 'DPF_SOOT_HIGH',
        derive: (s, cap) => cap?.hasDPF && s?.pid?.dpfSoot?.average !== undefined && s.pid.dpfSoot.average > 40
    },
    {
        id: 'RPM_UNSTABLE',
        derive: (s) => {
            const min = s?.pid?.rpm?.min;
            const max = s?.pid?.rpm?.max;
            const spd = s?.pid?.speed?.average;
            return min !== undefined && max !== undefined && (max - min) > 200 && (spd || 0) < 5;
        }
    },
    {
        id: 'OIL_TEMP_HIGH',
        derive: (s) => s?.pid?.oilTemp?.max !== undefined && s.pid.oilTemp.max > 115
    }
];

// ── 1. Derivare noduri active din contextul pipeline ───────────────────────

/**
 * Construiește lista de node IDs active din rezultatele pipeline.
 * Surse: predicții (severity MEDIUM/HIGH), reguli (probability > 35),
 *        sensor states derivate din summary.
 *
 * @param {Object} ctx — DiagnosticContext parțial: {predictions, diagnostics, summary, capabilities}
 * @returns {string[]}
 */
function resolveActiveNodes(ctx) {
    const active = new Set();

    // Din FaultPredictionEngine
    for (const p of (ctx.predictions || [])) {
        if (p.failureId && (p.severity === 'MEDIUM' || p.severity === 'HIGH')) {
            active.add(p.failureId);
        }
    }

    // Din RuleEngine
    for (const r of (ctx.diagnostics || [])) {
        if (r.failureId && r.probability > 35) {
            active.add(r.failureId);
        }
    }

    // Sensor states derivate din summary
    const summary = ctx.summary;
    const cap     = ctx.capabilities;
    if (summary) {
        for (const rule of SENSOR_STATE_RULES) {
            try {
                if (rule.derive(summary, cap)) active.add(rule.id);
            } catch (_) {}
        }
    }

    // Filtrare: păstrăm doar nodurile prezente în graf
    return Array.from(active).filter(id => graph.hasNode(id));
}

// ── 2. Căutare cauze rădăcină ──────────────────────────────────────────────

/**
 * Dintre nodurile active, un nod este "cauză rădăcină" dacă nu are
 * nicio cauză ACTIVĂ care să-l explice (nu are incoming CAUSAL edges
 * de la alte noduri active).
 *
 * Scorul unui root cause = câte alte noduri active explică (forward BFS).
 */
function findRootCauses(activeIds) {
    const activeSet = new Set(activeIds);
    const results   = [];

    for (const id of activeIds) {
        const incoming = graph.getIncoming(id, CAUSAL_RELATIONS);
        const hasActiveCause = incoming.some(e => activeSet.has(e.from));
        if (hasActiveCause) continue;

        const forwardReach = graph.bfsForward(id);
        const explainedNodes = Array.from(forwardReach.keys())
            .filter(n => n !== id && activeSet.has(n));

        // Scor ponderat: noduri mai aproape = contribuie mai mult
        const weightedScore = Array.from(forwardReach.entries())
            .filter(([n]) => n !== id && activeSet.has(n))
            .reduce((sum, [, depth]) => sum + 1 / (depth + 1), 0);

        results.push({
            id,
            label:          graph.getNode(id)?.label || id,
            type:           graph.getNode(id)?.type  || 'UNKNOWN',
            explainedCount: explainedNodes.length,
            explainedNodes,
            score:          Math.round(weightedScore * 100) / 100
        });
    }

    return results.sort((a, b) => b.score - a.score || b.explainedCount - a.explainedCount);
}

// ── 3. Cel mai bun explicator ──────────────────────────────────────────────

/**
 * Dintre nodurile de tip FAILURE active, care explică cel mai mare
 * număr de alte noduri active (direct sau tranzitiv)?
 */
function findBestExplainer(activeIds) {
    const activeSet = new Set(activeIds);
    let best = null;

    for (const id of activeIds) {
        const node = graph.getNode(id);
        if (!node || node.type !== 'FAILURE') continue;

        const forwardReach = graph.bfsForward(id);
        const score = Array.from(forwardReach.entries())
            .filter(([n]) => n !== id && activeSet.has(n))
            .reduce((sum, [, depth]) => sum + 1 / (depth + 1), 0);

        if (!best || score > best.score) {
            best = {
                id,
                label:          node.label,
                type:           node.type,
                score:          Math.round(score * 100) / 100,
                explainedNodes: Array.from(forwardReach.keys()).filter(n => n !== id && activeSet.has(n))
            };
        }
    }

    return best;
}

// ── 4. Clasificare noduri active: cauze vs efecte ──────────────────────────

/**
 * Clasifică fiecare nod activ:
 *   - cause      : nod activ fără cauze active (root)
 *   - effect     : nod activ fără efecte active (leaf)
 *   - intermediate: are atât cauze cât și efecte active
 *   - isolated   : niciun vecin activ (tratat ca potențială cauză)
 */
function classifyNodes(activeIds) {
    const activeSet   = new Set(activeIds);
    const causes      = [];
    const effects     = [];
    const intermediate = [];

    for (const id of activeIds) {
        const node = graph.getNode(id);
        const label = node?.label || id;
        const type  = node?.type  || 'UNKNOWN';

        const hasActiveCause  = graph.getIncoming(id, CAUSAL_RELATIONS).some(e => activeSet.has(e.from));
        const hasActiveEffect = graph.getOutgoing(id, CAUSAL_RELATIONS).some(e => activeSet.has(e.to));

        if (!hasActiveCause && hasActiveEffect)      causes.push({ id, label, type });
        else if (hasActiveCause && !hasActiveEffect) effects.push({ id, label, type });
        else if (hasActiveCause && hasActiveEffect)  intermediate.push({ id, label, type });
        else                                          causes.push({ id, label, type }); // isolated → root
    }

    return { causes, effects, intermediate };
}

// ── 5. Urmărire lanțuri de efecte ──────────────────────────────────────────

/**
 * Urmărește lanțul primar de efecte dintr-un nod root cause,
 * formatat ca listă plată [{id, label, type, depth, relation, weight}].
 *
 * Folosit pentru a răspunde: "Care sunt efectele în lanț?"
 */
function traceChain(startId, direction = 'forward', maxDepth = 10) {
    return graph.tracePrimaryChain(startId, direction, maxDepth);
}

// ── 6. Analiză completă ────────────────────────────────────────────────────

/**
 * Analiză completă a unui set de noduri active.
 * Răspunde la toate întrebările diagnostice.
 *
 * @param {string[]} activeNodeIds
 * @returns {ReasoningResult}
 */
function analyze(activeNodeIds) {
    if (!activeNodeIds || activeNodeIds.length === 0) {
        return {
            activeNodes:    [],
            rootCauses:     [],
            bestExplainer:  null,
            classification: { causes: [], effects: [], intermediate: [] },
            chains:         [],
            subgraph:       { nodes: [], edges: [] },
            confidence:     0,
            summary:        'Insuficiente date pentru reasoning cauzal.'
        };
    }

    const rootCauses     = findRootCauses(activeNodeIds);
    const bestExplainer  = findBestExplainer(activeNodeIds);
    const classification = classifyNodes(activeNodeIds);
    const sub            = graph.subgraph(activeNodeIds);

    // Construiește câte un lanț pentru fiecare cauză rădăcină (max 3)
    const chains = rootCauses.slice(0, 3).map(rc => ({
        rootCause:      rc.id,
        rootCauseLabel: rc.label,
        chain:          traceChain(rc.id, 'forward', 8)
    }));

    // Scor de încredere: mai multe noduri active + cauze identificate = mai sigur
    const confidence = Math.min(95, Math.round(
        (rootCauses.length > 0    ? 30 : 0) +
        (bestExplainer            ? 20 : 0) +
        Math.min(activeNodeIds.length * 5, 30) +
        (chains.some(c => c.chain.length > 3) ? 15 : 0)
    ));

    // Rezumat text determinist
    const summaryText = _buildSummary(rootCauses, bestExplainer, activeNodeIds.length);

    return {
        activeNodes:    activeNodeIds,
        rootCauses:     rootCauses.map(({ id, label, type, explainedCount, explainedNodes, score }) =>
            ({ id, label, type, explainedCount, explainedNodes, score })
        ),
        bestExplainer,
        classification,
        chains,
        subgraph:    { nodes: sub.nodes, edges: sub.edges },
        confidence,
        summary:     summaryText
    };
}

/**
 * Convenience: derivează nodurile active din ctx, apoi rulează analyze().
 * Apelat din analyzers/index.js.
 */
function analyzeFromContext(ctx) {
    const activeNodes = resolveActiveNodes(ctx);
    return analyze(activeNodes);
}

// ── Helper privat: text de rezumat ─────────────────────────────────────────

function _buildSummary(rootCauses, bestExplainer, totalActive) {
    if (totalActive === 0) return 'Nicio anomalie activă detectată.';
    if (rootCauses.length === 0) return `${totalActive} anomalii detectate — cauza rădăcină nu a putut fi izolată.`;

    const top = rootCauses[0];
    let text  = `Cauza rădăcină probabilă: "${top.label}"`;
    if (top.explainedCount > 0) {
        text += ` (explică ${top.explainedCount} alte anomalii active)`;
    }
    if (bestExplainer && bestExplainer.id !== top.id) {
        text += `. Cel mai bun explicator FAILURE: "${bestExplainer.label}"`;
    }
    if (rootCauses.length > 1) {
        text += `. Alte cauze posibile: ${rootCauses.slice(1, 3).map(r => `"${r.label}"`).join(', ')}.`;
    }
    return text;
}

module.exports = {
    resolveActiveNodes,
    findRootCauses,
    findBestExplainer,
    classifyNodes,
    traceChain,
    analyze,
    analyzeFromContext
};
