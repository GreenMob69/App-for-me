/**
 * VehicleDigitalTwin.js — forma canonică a reprezentării digitale a vehiculului
 * -----------------------------------------------------------------------
 * Define structura exactă a twin-ului. Nu conține logică de calcul.
 *
 * Fiecare câmp are o valoare default safe (null sau []) astfel încât
 * consumatorii (AI Expert, PDF, Frontend, Notifications) nu trebuie să
 * gestioneze câmpuri lipsă — toată normalizarea se face o singură dată aici.
 * -----------------------------------------------------------------------
 */

const TWIN_VERSION = '1.0.0';

/**
 * Creează un VehicleDigitalTwin normalizat.
 * Toate câmpurile sunt garantat prezente — consumatorii pot accesa
 * fără optional chaining.
 *
 * @param {Object} parts
 * @returns {VehicleDigitalTwin}
 */
function createDigitalTwin({ identity, profile, state, diagnostics, history, meta } = {}) {
    return {
        // ── Identitate vehicul ─────────────────────────────────────────
        identity:    _identity(identity),

        // ── Configurație statică ───────────────────────────────────────
        profile:     _profile(profile),

        // ── Starea curentă (date live / ultimă cursă) ──────────────────
        state:       _state(state),

        // ── Diagnostice (predicții + reasoning + recomandări) ─────────
        diagnostics: _diagnostics(diagnostics),

        // ── Istoric (curse recente, mentenanță, milestone-uri) ─────────
        history:     _history(history),

        // ── Nivel alertă top-level (conveniență pentru UI / notificări) ─
        alertLevel:  _alertLevel(diagnostics),

        // ── Metadata construcție ──────────────────────────────────────
        meta:        _meta(meta)
    };
}

// ── Normalizatori per secțiune ─────────────────────────────────────────────

function _identity(id = {}) {
    return {
        vin:                id.vin              || null,
        make:               id.make             || null,
        model:              id.model            || null,
        variant:            id.variant          || null,
        year:               id.year             || null,
        fuelType:           id.fuelType         || null,
        transmissionType:   id.transmissionType || null,
        engineCode:         id.engineCode       || null,
        displacementCc:     id.displacementCc   || null,
        powerKw:            id.powerKw          || null,
        powerHp:            id.powerHp          || null,
        torqueNm:           id.torqueNm         || null,
        cylinders:          id.cylinders        || null,
        color:              id.color            || null,
        plateNumber:        id.plateNumber      || null,
        emissionStandard:   id.emissionStandard || null,
        co2GKm:             id.co2GKm           || null,
        purchaseDate:       id.purchaseDate     || null,
        purchaseMileageKm:  id.purchaseMileageKm || null,
        currentMileageKm:   id.currentMileageKm  || null,
        ageYears:           id.ageYears          || null,
        vehicleStatus:      id.vehicleStatus     || 'ACTIVE',
        oilSpec:            id.oilSpec           || null,
        timingBeltIntervalKm: id.timingBeltIntervalKm || null
    };
}

function _profile(p = {}) {
    return {
        capabilities:         p.capabilities         || null,
        powertrain:           p.powertrain            || null,
        knowledgePackId:      p.knowledgePackId       || null,
        knowledgePackVersion: p.knowledgePackVersion  || null
    };
}

function _state(s = {}) {
    return {
        health:       s.health       || null,
        lastTrip:     s.lastTrip     || null,
        baseline:     s.baseline     || null,
        dna:          s.dna          || null,
        trends:       s.trends       || null,
        correlations: s.correlations || null
    };
}

function _diagnostics(d = {}) {
    return {
        predictions:     Array.isArray(d.predictions)     ? d.predictions     : [],
        reasoning:       d.reasoning       || null,
        recommendations: Array.isArray(d.recommendations) ? d.recommendations : []
    };
}

function _history(h = {}) {
    return {
        recentTrips: Array.isArray(h.recentTrips) ? h.recentTrips : [],
        maintenance:  Array.isArray(h.maintenance)  ? h.maintenance  : [],
        milestones:   Array.isArray(h.milestones)   ? h.milestones   : [],
        timeline:     Array.isArray(h.timeline)     ? h.timeline     : [],
        documents:    Array.isArray(h.documents)    ? h.documents    : []
    };
}

function _alertLevel(d = {}) {
    const topRec = (d?.recommendations || [])[0];
    if (!topRec) return 'NORMAL';
    return topRec.driveRecommendation || 'NORMAL';
}

function _meta(m = {}) {
    return {
        version:             TWIN_VERSION,
        builtAt:             m.builtAt          || null,
        pipelineSteps:       m.pipelineSteps    || [],
        dataCompleteness:    m.dataCompleteness || 0,
        activeKnowledgePack: m.activeKnowledgePack || null
    };
}

module.exports = { createDigitalTwin, TWIN_VERSION };
