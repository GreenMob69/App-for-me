/**
 * generic_diesel — KnowledgePack fallback pentru orice motor diesel ICE
 * Folosit când nu există un pack mai specific pentru vehiculul curent.
 */
module.exports = {
    id: 'GENERIC_DIESEL',
    version: '1.0.0',
    description: 'Pack generic pentru motoare diesel ICE',

    applies_to: {
        fuel_types: ['diesel'],
        makes: null,        // orice marcă
        year_range: null,   // orice an
    },

    // Valori de referință pentru baseline (folosite când vehiculul e nou)
    baseline_overrides: {
        voltage: 14.1,
        coolant: 88.0,
        boost:   1.2,
    },

    // Praguri ajustate față de defaults-urile generice ThresholdCalculator
    threshold_overrides: {},

    // Ajustări ponderi Health Score (0 = fără ajustare)
    scoring_weight_overrides: {},

    // Intervale service ajustate față de defaults-urile MaintenanceCalculator
    service_interval_overrides: {},

    // Modele predictive suplimentare specifice acestui pack
    // Aceeași interfață ca PREDICTION_MODELS din FaultPredictionEngine:
    // { id, component, category, requiredCapability?, evaluate(ctx), getRecommendation(severity) }
    known_failure_patterns: [],

    // Reguli de diagnostic suplimentare
    // Aceeași interfață ca regulile din diagnostics/ (id, system, symptom, condition, hypotheses)
    additional_rules: [],
};
