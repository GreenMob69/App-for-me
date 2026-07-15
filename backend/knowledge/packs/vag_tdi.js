/**
 * vag_tdi — KnowledgePack pentru motoare VAG TDI (Audi, VW, Seat, Skoda)
 *
 * Acoperire: motoare diesel VAG din 1990 până în 2015, toate variantele
 * (pompă distribuție, pompă-duze, common rail).
 *
 * Sursă cunoaștere: documentație tehnică VAG, forumuri specializate,
 * statistici defecțiuni raportate pe motoare TDI.
 */
module.exports = {
    id: 'VAG_TDI',
    version: '1.0.0',
    description: 'Pack specific pentru motoare VAG TDI diesel',

    applies_to: {
        fuel_types: ['diesel'],
        makes: ['Audi', 'Volkswagen', 'Volkswagen Commercial', 'SEAT', 'Skoda'],
        year_range: [1990, 2020],
    },

    // Baseline-uri specifice pentru TDI — mai precise decât generic_diesel
    baseline_overrides: {
        voltage: 14.1,
        coolant: 88.0,
        boost:   1.35,   // boost tipic TDI la regim moderat
    },

    // Praguri specifice TDI
    threshold_overrides: {
        // TDI-urile suportă bine temperaturi de răcire până la 100°C
        // (termostat VAG setabil la 87-105°C funcție de sarcină)
        coolant_warning: 102,
    },

    scoring_weight_overrides: {},

    // Intervalele de service recomandate pentru TDI
    service_interval_overrides: {
        oil_change_km:    15000,
        oil_change_months: 12,
        timing_belt_km:   120000,
        fuel_filter_km:   60000,
    },

    // Modele predictive specifice VAG TDI
    // Vor fi evaluate de FaultPredictionEngine după modelele standard.
    // Interfață identică cu PREDICTION_MODELS: { id, component, category, evaluate(ctx), getRecommendation(severity) }
    known_failure_patterns: [
        {
            id: 'VAG_TDI_EGR_CARBON_BUILDUP',
            component: 'Depuneri carbon EGR / admisie',
            category: 'EMISII',
            requiredCapability: 'hasEGR',
            evaluate: (ctx) => {
                const factors = [];
                let score = 0;

                // Simptom principal: MAF scăzut față de baseline (admisie obstruată)
                const mafAvg = ctx.summary?.pid?.maf?.average;
                const baselineMaf = ctx.baseline?.raw_baseline?.maf;
                if (mafAvg && baselineMaf && baselineMaf > 0) {
                    const mafDrop = (baselineMaf - mafAvg) / baselineMaf;
                    if (mafDrop > 0.15) {
                        score += 30;
                        factors.push({ param: 'MAF vs Baseline', value: `-${Math.round(mafDrop * 100)}%`, impact: 'Debit aer semnificativ sub normal — posibile depuneri carbon' });
                    } else if (mafDrop > 0.08) {
                        score += 15;
                        factors.push({ param: 'MAF vs Baseline', value: `-${Math.round(mafDrop * 100)}%`, impact: 'Debit aer ușor sub normal' });
                    }
                }

                // Confirmat de tendință în scădere pe mai multe curse
                if (ctx.trends?.maf?.trend === 'DECREASING') {
                    score += 20;
                    factors.push({ param: 'MAF Trend', value: 'Descrescător', impact: 'Debit aer în scădere continuă — pattern carbon EGR' });
                }

                return {
                    score,
                    factors,
                    severity: score > 45 ? 'HIGH' : score > 20 ? 'MEDIUM' : 'LOW'
                };
            },
            getRecommendation: (severity) => {
                if (severity === 'HIGH') return 'Curățare urgentă galerie admisie și supapă EGR — depuneri semnificative de carbon confirmate';
                if (severity === 'MEDIUM') return 'Programare curățare admisie la revizie; monitorizare MAF la următoarele curse';
                return 'Admisie în parametri — monitorizare de rutină';
            }
        }
    ],

    additional_rules: [],
};
