/**
 * generic_petrol — KnowledgePack fallback pentru orice motor benzinǎ ICE
 */
module.exports = {
    id: 'GENERIC_PETROL',
    version: '1.0.0',
    description: 'Pack generic pentru motoare benzinǎ ICE',

    applies_to: {
        fuel_types: ['petrol', 'gasoline', 'benzina'],
        makes: null,
        year_range: null,
    },

    baseline_overrides: {
        voltage: 14.2,
        coolant: 90.0,
    },

    threshold_overrides: {},
    scoring_weight_overrides: {},
    service_interval_overrides: {},
    known_failure_patterns: [],
    additional_rules: [],
};
