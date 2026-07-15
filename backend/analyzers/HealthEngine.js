/**
 * HealthEngine.js — Universal Health Engine
 * -----------------------------------------------------------------------
 * Calculează sănătatea vehiculului pe două căi:
 *
 *   CALEA UNIVERSALĂ (ctx.powertrain disponibil):
 *     - Subsistemele active sunt citite din PowertrainProfile
 *     - Fiecare subsistem este scorat independent prin SubsystemScorer
 *     - Scorul global = media ponderată a subsistemelor active
 *     - Subsistemele absente (capability lipsă) nu participă la scor
 *     - Date parțiale (PID lipsă) → scor neutru ponderat, nu ignorat
 *
 *   CALEA LEGACY (nicio modificare, backward compat absolut):
 *     - Formule originale ICE: engineScore, fuelScore, drivingScore, safetyScore
 *     - Activă când ctx este null sau ctx.powertrain este null
 *
 * Câmpuri returnate mereu (backward compat):
 *   engineScore, fuelScore, drivingScore, safetyScore, overallHealth
 *
 * Câmpuri noi (calea universală):
 *   subsystems      — array cu scoruri per subsistem
 *   powertrain      — { id, label }
 *   scoringMethod   — 'universal' | 'legacy'
 *
 * Integrare în DiagnosticContext:
 *   ctx.health = calculateHealthScore(ctx.summary, ctx)
 *   Dacă ctx.baseline = null (Step 4), scorers îl gestionează graceful.
 * -----------------------------------------------------------------------
 */

const { scoreAllSubsystems } = require('./SubsystemScorer');
const { computeActiveSubsystems } = require('../powertrain/PowertrainProfileRegistry');

function clamp(v, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Math.round(v)));
}

// ── Dimensiuni cross-cutting ──────────────────────────────────────────────
// Nu sunt subsisteme fizice — evaluează comportamentul indiferent de propulsie.
// Nu se modifică la trecerea pe calea universală.

function drivingScore(summary) {
    let score = 100;
    score -= (summary?.drivingStyle?.aggressivePct || 0) * 0.6;
    const distance = Math.max(summary?.distanceKm || 1, 1);
    const harshEvents = (summary?.events?.hardBrakes        || 0)
                      + (summary?.events?.hardAccelerations || 0)
                      + (summary?.events?.rapidDecelerations || 0);
    score -= Math.min(35, (harshEvents / distance) * 100 * 1.5);
    score -= (summary?.events?.kickdowns || 0) * 1;
    return clamp(score);
}

function safetyScore(summary) {
    let score = 100;
    score -= (summary?.events?.overspeeds           || 0) * 4;
    score -= (summary?.events?.hardBrakes           || 0) * 2;
    score -= (summary?.events?.rapidDecelerations   || 0) * 1.5;
    score -= Math.min(15, ((summary?.temperature?.coolant?.timeOver100 || 0) / 60) * 3);
    return clamp(score);
}

// ── Calea LEGACY ──────────────────────────────────────────────────────────
// Identică cu versiunea anterioară a HealthEngine — nicio modificare.

function _legacyEngineScore(summary) {
    let score = 100;
    const t = summary?.temperature?.coolant;
    if (t) {
        score -= Math.min(30, ((t.timeOver100 || 0) / 60) * 6);
        score -= Math.min(15, ((t.timeOver95  || 0) / 60) * 2.5);
        score -= Math.min(10, ((t.timeOver90  || 0) / 60) * 1);
    }
    const highRpmExcess = Math.max(0, (summary?.rpmZones?.over3500Pct || 0) - 15);
    score -= Math.min(20, highRpmExcess * 0.6);
    return clamp(score);
}

function _legacyFuelScore(summary) {
    let score = 100;
    score -= Math.min(30, (summary?.drivingStyle?.aggressivePct || 0) * 0.5);
    const totalSec = summary?.duration?.totalSeconds || 0;
    const idleSec  = summary?.duration?.idleSeconds  || 0;
    const idleRatio = totalSec > 0 ? (idleSec / totalSec) * 100 : 0;
    score -= Math.min(20, Math.max(0, idleRatio - 10) * 0.6);
    return clamp(score);
}

function _calculateLegacy(summary) {
    const engine  = _legacyEngineScore(summary);
    const fuel    = _legacyFuelScore(summary);
    const driving = drivingScore(summary);
    const safety  = safetyScore(summary);
    const overall = clamp(engine * 0.35 + safety * 0.25 + driving * 0.2 + fuel * 0.2);

    return {
        // Backward compat
        engineScore:   engine,
        fuelScore:     fuel,
        drivingScore:  driving,
        safetyScore:   safety,
        overallHealth: overall,
        // Câmpuri universale — null în legacy
        subsystems:    null,
        powertrain:    null,
        scoringMethod: 'legacy',
    };
}

// ── Calea UNIVERSALĂ ──────────────────────────────────────────────────────

function _calculateUniversal(summary, ctx) {
    const { powertrain, capabilities, baseline, trends, sensorQuality, knowledgePack } = ctx;

    // Subsistemele active după capabilities (ponderi redistribuite automat)
    const activeSubsystems = computeActiveSubsystems(powertrain, capabilities);

    const inputs = {
        summary,
        thresholds:        knowledgePack?.threshold_overrides  || {},
        baselineOverrides: knowledgePack?.baseline_overrides   || {},
        baseline,    // null la Step 4 — scorers îl gestionează graceful
        trends,
        sensorQuality,
    };

    const subsystems = scoreAllSubsystems(activeSubsystems, inputs);

    // Scor global = suma(score_i × effectiveWeight_i)
    // effectiveWeight-urile sunt normalizate la 1.0 de computeActiveSubsystems
    const overallHealth = clamp(
        subsystems.reduce((acc, s) => acc + s.score * s.effectiveWeight, 0)
    );

    // Cross-cutting — neschimbate față de calea legacy
    const driving = drivingScore(summary);
    const safety  = safetyScore(summary);

    // Backward compat: engineScore și fuelScore din subsisteme fizice
    const engineSub = subsystems.find(s => s.id === 'ENGINE' || s.id === 'ICE_ENGINE');
    const fuelSub   = subsystems.find(s => s.id === 'FUEL');

    return {
        // Mereu prezente (backward compat)
        engineScore:   engineSub ? engineSub.score : overallHealth,
        fuelScore:     fuelSub   ? fuelSub.score   : overallHealth,
        drivingScore:  driving,
        safetyScore:   safety,
        overallHealth,

        // Câmpuri universale (noi)
        subsystems,
        powertrain: { id: powertrain.id, label: powertrain.label },
        scoringMethod: 'universal',
    };
}

// ── API public ─────────────────────────────────────────────────────────────

/**
 * Calculează Health Score.
 *
 * @param {Object}      summary        - TripSummary (obligatoriu)
 * @param {Object|null} ctx            - DiagnosticContext; dacă are ctx.powertrain → universal
 * @returns {HealthResult}
 */
function calculateHealthScore(summary, ctx = null) {
    if (ctx?.powertrain) return _calculateUniversal(summary, ctx);
    return _calculateLegacy(summary);
}

module.exports = { calculateHealthScore };
