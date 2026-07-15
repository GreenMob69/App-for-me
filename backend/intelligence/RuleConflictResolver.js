/**
 * RuleConflictResolver.js — Rezolvare conflicte între reguli de diagnoză
 * -----------------------------------------------------------------------
 * Când două sau mai multe reguli generează concluzii diferite pentru
 * aceleași simptome (ex: MAP↑ + MAF↓ → Turbo SAU Vacuum SAU Senzor),
 * acest modul compară:
 *   - confidence (scor de încredere)
 *   - severity (cât de gravă este problema)
 *   - reliability (fiabilitatea datelor)
 *   - trend (confirmată de tendințe cross-trip?)
 *   - baseline (deviație față de normal?)
 *   - history (apariții anterioare)
 *
 * Dacă nu există câștigător clar → returnează AMBIGUOUS cu explicație.
 *
 * Returnează: { resolved: [...], ambiguous: [...], conflicts: [...] }
 * -----------------------------------------------------------------------
 */

const SEVERITY_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function detectConflicts(diagnostics) {
    if (!diagnostics || diagnostics.length < 2) return [];

    const conflicts = [];
    const systemGroups = {};

    for (const d of diagnostics) {
        const key = d.system || 'UNKNOWN';
        if (!systemGroups[key]) systemGroups[key] = [];
        systemGroups[key].push(d);
    }

    for (const [system, group] of Object.entries(systemGroups)) {
        if (group.length < 2) continue;

        const symptomOverlap = {};
        for (const d of group) {
            const symptoms = d.detectedSymptoms || [];
            for (const s of symptoms) {
                if (!symptomOverlap[s]) symptomOverlap[s] = [];
                symptomOverlap[s].push(d);
            }
        }

        for (const [symptom, diagnosticsForSymptom] of Object.entries(symptomOverlap)) {
            if (diagnosticsForSymptom.length >= 2) {
                const probDiff = Math.abs(diagnosticsForSymptom[0].probability - diagnosticsForSymptom[1].probability);
                if (probDiff < 25) {
                    conflicts.push({
                        system,
                        symptom,
                        candidates: diagnosticsForSymptom.map(d => ({
                            cause: d.cause,
                            probability: d.probability,
                            points: d.points
                        }))
                    });
                }
            }
        }
    }

    return conflicts;
}

function scoreCandidate(candidate, context) {
    const { reliability, trends, baseline } = context;
    let score = 0;
    const reasons = [];

    // 1. Probabilitate inițială (0-40 puncte)
    score += (candidate.probability / 100) * 40;
    reasons.push(`Probabilitate: ${candidate.probability}% → +${Math.round((candidate.probability / 100) * 40)} pts`);

    // 2. Reliability (dacă există)
    if (reliability && reliability.length > 0) {
        const rel = reliability.find(r => r.diagnosis === candidate.cause);
        if (rel) {
            const relBonus = (rel.reliability / 100) * 20;
            score += relBonus;
            reasons.push(`Fiabilitate: ${rel.reliability}% → +${Math.round(relBonus)} pts`);
        }
    }

    // 3. Trend confirmation
    if (trends) {
        const trendKeys = Object.keys(trends);
        let trendConfirmed = false;
        for (const key of trendKeys) {
            const t = trends[key];
            if (t && t.trend && t.trend !== 'STABLE') {
                if (candidate.cause.toLowerCase().includes(key) ||
                    candidate.cause.toLowerCase().includes('uzat') ||
                    candidate.cause.toLowerCase().includes('degradat')) {
                    trendConfirmed = true;
                }
            }
        }
        if (trendConfirmed) {
            score += 15;
            reasons.push('Trend confirmat → +15 pts');
        }
    }

    // 4. Baseline deviation
    if (baseline && baseline.deviations) {
        const devs = Object.values(baseline.deviations);
        const hasDeviation = devs.some(d => {
            const val = parseFloat(d);
            return !isNaN(val) && Math.abs(val) > 3;
        });
        if (hasDeviation) {
            score += 10;
            reasons.push('Deviație baseline → +10 pts');
        }
    }

    // 5. Număr de simptome
    const symptomCount = candidate.detectedSymptoms ? candidate.detectedSymptoms.length : 0;
    score += symptomCount * 5;
    if (symptomCount > 0) {
        reasons.push(`${symptomCount} simptome → +${symptomCount * 5} pts`);
    }

    return { ...candidate, resolvedScore: Math.round(score), reasons };
}

function resolveConflicts(diagnostics, context) {
    const { reliability, trends, baseline } = context || {};

    if (!diagnostics || diagnostics.length === 0) {
        return { resolved: [], ambiguous: [], conflicts: [] };
    }

    const conflicts = detectConflicts(diagnostics);

    if (conflicts.length === 0) {
        return {
            resolved: diagnostics.map(d => ({
                cause: d.cause,
                system: d.system,
                probability: d.probability,
                status: 'UNCONTESTED',
                resolvedScore: d.probability
            })),
            ambiguous: [],
            conflicts: []
        };
    }

    const resolved = [];
    const ambiguous = [];
    const processedCauses = new Set();

    for (const conflict of conflicts) {
        const scored = conflict.candidates.map(c => {
            const fullDiagnostic = diagnostics.find(d => d.cause === c.cause) || c;
            return scoreCandidate(fullDiagnostic, { reliability, trends, baseline });
        });

        scored.sort((a, b) => b.resolvedScore - a.resolvedScore);

        const winner = scored[0];
        const runnerUp = scored[1];
        const margin = winner.resolvedScore - runnerUp.resolvedScore;

        if (margin >= 10) {
            resolved.push({
                cause: winner.cause,
                system: conflict.system,
                probability: winner.probability,
                resolvedScore: winner.resolvedScore,
                status: 'RESOLVED',
                margin,
                defeatedAlternatives: scored.slice(1).map(s => ({
                    cause: s.cause,
                    score: s.resolvedScore
                })),
                reasons: winner.reasons
            });
            processedCauses.add(winner.cause);
            scored.slice(1).forEach(s => processedCauses.add(s.cause));
        } else {
            ambiguous.push({
                system: conflict.system,
                symptom: conflict.symptom,
                status: 'AMBIGUOUS',
                margin,
                explanation: `Diferența între candidați este doar ${margin} puncte — insuficientă pentru o concluzie fermă`,
                candidates: scored.map(s => ({
                    cause: s.cause,
                    score: s.resolvedScore,
                    probability: s.probability,
                    reasons: s.reasons
                })),
                recommendation: 'Necesare date suplimentare sau DTC-uri pentru confirmare'
            });
            scored.forEach(s => processedCauses.add(s.cause));
        }
    }

    for (const d of diagnostics) {
        if (!processedCauses.has(d.cause)) {
            resolved.push({
                cause: d.cause,
                system: d.system,
                probability: d.probability,
                resolvedScore: d.probability,
                status: 'UNCONTESTED'
            });
        }
    }

    return { resolved, ambiguous, conflicts };
}

module.exports = { resolveConflicts, detectConflicts };
