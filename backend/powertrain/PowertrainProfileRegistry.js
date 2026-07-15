/**
 * PowertrainProfileRegistry.js — descriptorul complet al tipului de propulsie
 * -----------------------------------------------------------------------
 * PowertrainProfile NU este doar un input pentru HealthEngine.
 * Este descriptorul central al vehiculului care definește:
 *
 *   subsystems       → care sisteme există + ponderile de scoring
 *   scoringStrategy  → formula de calcul scor sănătate
 *   defaultCaps      → capabilități implicite când vehicleRow e incomplet
 *   pipelineOrder    → ordinea etapelor de analiză (baza pentru Adaptive Pipeline)
 *   uiComponents     → ce componente UI sunt relevante
 *   pdfSections      → ce secțiuni apar în raportul PDF
 *   aiExpert         → context și focus pentru AI Expert
 *   maintenance      → intervale implicite de mentenanță
 *   futureIntegrations → hook-uri rezervate — garantează că structura nu va
 *                        necesita refactorizare la implementarea lor
 *
 * Fluxul arhitectural:
 *
 *   Vehicle
 *   ↓  VehicleRow (DB)
 *   ↓  VehicleCapabilities.deriveCapabilities()
 *   ↓  KnowledgePackRegistry.resolve()
 *   ↓  PowertrainProfileRegistry.deriveProfile()   ← acest modul
 *   ↓  DiagnosticContext.powertrain
 *   ↓  Adaptive Pipeline (consumă profile.pipelineOrder, profile.subsystems)
 *
 * API public:
 *   deriveProfile(vehicleRow, capabilities)           → PowertrainProfile
 *   computeActiveSubsystems(profile, capabilities)    → subsisteme filtrate + ponderi redistribuite
 * -----------------------------------------------------------------------
 */

// ── Profiluri ─────────────────────────────────────────────────────────────

// Ordinea standard a pipeline-ului — identică pentru toate propulsiile acum;
// în viitor fiecare profil poate reordona sau exclude etape.
const DEFAULT_PIPELINE_ORDER = [
    'DATA_INTEGRITY', 'SENSOR_QUALITY', 'TRIP_SUMMARY', 'HEALTH_ENGINE',
    'RULE_ENGINE', 'CONFIDENCE', 'RELIABILITY', 'CONFLICT_RESOLVER',
    'EXPLAINABILITY', 'CORRELATIONS', 'BASELINE', 'RELIABILITY_FINAL',
    'DETAILED_EXPLAINABILITY', 'FAULT_PREDICTIONS', 'VEHICLE_DNA', 'AI_REPORT',
];

// ════════════════════════════════════════════════════════════════════
// ICE_DIESEL — Motor termic Diesel (VAG TDI, BMW d, Mercedes CDI etc.)
// ════════════════════════════════════════════════════════════════════
const ICE_DIESEL = {
    id: 'ICE_DIESEL',
    label: 'Motor termic Diesel',

    // ── Subsisteme + ponderi de scoring ──────────────────────────────
    // requiredCapability: subsistemul este ignorat și ponderea redistribuită
    // dacă vehiculul nu are capabilitatea respectivă.
    subsystems: [
        { id: 'ENGINE',       label: 'Motor',            weight: 0.22, icon: 'engine' },
        { id: 'FUEL',         label: 'Combustibil',      weight: 0.18, icon: 'fuel' },
        { id: 'TURBO',        label: 'Turbosuflantă',    weight: 0.15, icon: 'turbo',    requiredCapability: 'hasTurbo' },
        { id: 'COOLING',      label: 'Sistem răcire',    weight: 0.13, icon: 'cooling' },
        { id: 'ELECTRICAL',   label: 'Electric',         weight: 0.10, icon: 'battery' },
        { id: 'EMISSIONS',    label: 'Emisii / EGR',     weight: 0.10, icon: 'emissions', requiredCapability: 'hasEGR' },
        { id: 'DPF',          label: 'Filtru particule', weight: 0.07, icon: 'dpf',       requiredCapability: 'hasDPF' },
        { id: 'TRANSMISSION', label: 'Transmisie',       weight: 0.05, icon: 'transmission' },
    ],

    // Strategia de calcul scor global: media ponderată a scorurilor per subsistem.
    // 'min_bottleneck': scorul cel mai mic devine cel global (strictă).
    // 'composite': media + penalizare pentru cel mai slab subsistem.
    scoringStrategy: 'weighted_average',

    // Capabilități implicite când vehicleRow nu are year/engine_code complet
    defaultCapabilities: {
        hasTurbo: true,
        hasDPF: false,
        hasEGR: true,
        hasLambdaOxygen: false,
        hasABS: true,
        hasDualMassFlyweel: true,
        hasGlowPlugs: true,
    },

    pipelineOrder: DEFAULT_PIPELINE_ORDER,

    // ── Componente UI recomandate ─────────────────────────────────────
    uiComponents: {
        gauges:  ['rpm', 'boost', 'coolant', 'voltage', 'maf'],
        cards:   ['TurboCard', 'DpfCard', 'FuelCard', 'EgrCard', 'CoolingCard'],
        badges:  ['EcoScore', 'HealthScore', 'DrivingStyle'],
        alerts:  ['OverheatAlert', 'LowBoostAlert', 'DpfAlert', 'VoltageAlert'],
    },

    // ── Secțiuni PDF ─────────────────────────────────────────────────
    pdfSections: [
        'executive_summary',
        'health_score',
        'fuel_analysis',
        'turbo_analysis',
        'emissions',
        'fault_predictions',
        'maintenance_schedule',
    ],

    // ── Context AI Expert ─────────────────────────────────────────────
    aiExpert: {
        focusAreas: ['turbo', 'dpf', 'egr', 'fuel_efficiency', 'thermal', 'injectors'],
        tonePreset: 'technical',
        narrativeHints: [
            'Turbosuflanta este indicatorul principal al stării motorului diesel.',
            'EGR și DPF degradează prin utilizare urbană intensă și curse scurte.',
            'Corelația boost-MAF este fundamentală în diagnosticul turbo.',
        ],
        // Câmpul din DiagnosticContext folosit de AI Expert pentru context propulsie
        contextField: 'powertrain',
    },

    // ── Mentenanță implicită (override per KnowledgePack sau vehicleRow) ──
    maintenanceDefaults: {
        oil_change_km:       15000,
        oil_change_months:   12,
        timing_belt_km:      120000,
        fuel_filter_km:      60000,
        air_filter_km:       30000,
        glow_plugs_km:       80000,
        coolant_flush_km:    80000,
    },

    // ── Hook-uri pentru integrare viitoare ────────────────────────────
    // Câmpurile sunt prezente și documentate acum, dar disabled.
    // La implementare se schimbă enabled: true și se completează path/template.
    // Nicio altă modificare a structurii PowertrainProfile nu va fi necesară.
    futureIntegrations: {

        // Graf de diagnostic — noduri = semnale, muchii = "dacă OK, verifică urmă"
        // Permite AI Expert să urmeze un arbore de inferență, nu o listă fixă.
        // Ex: boost↓ → vacuum OK → MAP OK → MAF↓ → concluzie: admisie
        diagnosticGraph: {
            id: 'DIESEL_DIAGNOSTIC_GRAPH',
            entrySignal: 'boost_bar',
            graphPath: null,    // va fi setat la implementare (ex: 'graphs/diesel.json')
            enabled: false,
        },

        // Failure Library — per-defect, separată de KnowledgePack
        // Ex: Failures/Diesel/VacuumLeak.json, N75.json, Wastegate.json
        // KnowledgePack va referi failure prin failureId; Library va conține
        // simptome, senzori afectați, probabilitate, instrucțiuni verificare/reparare.
        failureLibrary: {
            basePath: 'Failures/Diesel/',
            enabled: false,
        },

        // Reasoning Tree — explicabilitate structurată a concluziei AI
        // Structura: Evidence → Hypotheses → Rejected → Remaining → Conclusion
        // Consumers: AI Expert (narativă), UI (vizualizare inferență), PDF (secțiune)
        reasoningTree: {
            template: 'DIESEL_BAYESIAN',
            evidenceFields: ['boost', 'maf', 'coolant', 'rpm', 'load', 'voltage'],
            enabled: false,
        },

        // symptoms.json în KnowledgePack — mapare simptom-vizibil → cauze posibile
        // Ex: "High Fuel Consumption" → [MAF, Injectors, Thermostat, DrivingStyle]
        // KnowledgePackLoader va încărca symptoms.json dacă există în director.
        knowledgePackExtensions: ['symptoms'],
    },
};

// ════════════════════════════════════════════════════════════════════
// ICE_PETROL — Motor termic Benzină
// ════════════════════════════════════════════════════════════════════
const ICE_PETROL = {
    id: 'ICE_PETROL',
    label: 'Motor termic Benzină',

    subsystems: [
        { id: 'ENGINE',       label: 'Motor',           weight: 0.25, icon: 'engine' },
        { id: 'FUEL',         label: 'Combustibil',     weight: 0.20, icon: 'fuel' },
        { id: 'COOLING',      label: 'Sistem răcire',   weight: 0.15, icon: 'cooling' },
        { id: 'ELECTRICAL',   label: 'Electric',        weight: 0.12, icon: 'battery' },
        { id: 'LAMBDA',       label: 'Sondă lambda',    weight: 0.13, icon: 'lambda', requiredCapability: 'hasLambdaOxygen' },
        { id: 'TURBO',        label: 'Turbosuflantă',   weight: 0.10, icon: 'turbo',  requiredCapability: 'hasTurbo' },
        { id: 'TRANSMISSION', label: 'Transmisie',      weight: 0.05, icon: 'transmission' },
    ],

    scoringStrategy: 'weighted_average',

    defaultCapabilities: {
        hasTurbo: false,
        hasDPF: false,
        hasEGR: true,
        hasLambdaOxygen: true,
        hasABS: true,
        hasDualMassFlyweel: false,
        hasGlowPlugs: false,
    },

    pipelineOrder: DEFAULT_PIPELINE_ORDER,

    uiComponents: {
        gauges:  ['rpm', 'coolant', 'voltage', 'lambda', 'maf'],
        cards:   ['LambdaCard', 'FuelCard', 'IgnitionCard', 'CoolingCard'],
        badges:  ['EcoScore', 'HealthScore', 'DrivingStyle'],
        alerts:  ['OverheatAlert', 'RichMixtureAlert', 'VoltageAlert'],
    },

    pdfSections: [
        'executive_summary', 'health_score', 'fuel_analysis',
        'lambda_analysis', 'fault_predictions', 'maintenance_schedule',
    ],

    aiExpert: {
        focusAreas: ['lambda', 'ignition', 'fuel_efficiency', 'thermal', 'idle_quality'],
        tonePreset: 'technical',
        narrativeHints: [
            'Sonda lambda este indicatorul principal al calității arderilor pe benzinǎ.',
            'Instabilitatea la ralanti sugerează probleme de injecție sau distribuție.',
        ],
        contextField: 'powertrain',
    },

    maintenanceDefaults: {
        oil_change_km:       10000,
        oil_change_months:   12,
        spark_plugs_km:      60000,
        timing_belt_km:      100000,
        air_filter_km:       30000,
        coolant_flush_km:    80000,
    },

    futureIntegrations: {
        diagnosticGraph: {
            id: 'PETROL_DIAGNOSTIC_GRAPH',
            entrySignal: 'lambda',
            graphPath: null,
            enabled: false,
        },
        failureLibrary: {
            basePath: 'Failures/Petrol/',
            enabled: false,
        },
        reasoningTree: {
            template: 'PETROL_BAYESIAN',
            evidenceFields: ['lambda', 'maf', 'coolant', 'rpm', 'load'],
            enabled: false,
        },
        knowledgePackExtensions: ['symptoms'],
    },
};

// ════════════════════════════════════════════════════════════════════
// BEV — Vehicul complet electric (fără motor termic)
// ════════════════════════════════════════════════════════════════════
const BEV = {
    id: 'BEV',
    label: 'Vehicul Electric (BEV)',

    subsystems: [
        { id: 'BATTERY_PACK',  label: 'Pachet baterie',  weight: 0.35, icon: 'battery' },
        { id: 'ELECTRIC_MOTOR',label: 'Motor electric',  weight: 0.25, icon: 'motor' },
        { id: 'THERMAL_MGMT',  label: 'Termomanagement', weight: 0.18, icon: 'cooling' },
        { id: 'REGENERATION',  label: 'Recuperare energie', weight: 0.12, icon: 'regen' },
        { id: 'CHARGING',      label: 'Sistem încărcare', weight: 0.10, icon: 'charging' },
    ],

    scoringStrategy: 'weighted_average',

    defaultCapabilities: {
        hasTurbo: false,
        hasDPF: false,
        hasEGR: false,
        hasLambdaOxygen: false,
        hasBatteryPack: true,
        hasRegenBraking: true,
        hasDCCharging: true,
    },

    pipelineOrder: DEFAULT_PIPELINE_ORDER,

    uiComponents: {
        gauges:  ['soc_pct', 'battery_temp', 'motor_temp', 'regen_pct'],
        cards:   ['BatteryHealthCard', 'RangeCard', 'ChargingCard', 'ThermalCard'],
        badges:  ['RangeScore', 'EcoScore', 'HealthScore'],
        alerts:  ['LowBatteryAlert', 'BatteryThermalAlert', 'ChargingFaultAlert'],
    },

    pdfSections: [
        'executive_summary', 'battery_health', 'range_analysis',
        'charging_analysis', 'thermal_management', 'fault_predictions',
    ],

    aiExpert: {
        focusAreas: ['battery_degradation', 'thermal_management', 'regen_efficiency', 'charging'],
        tonePreset: 'technical',
        narrativeHints: [
            'Sănătatea pachetului de baterie determină autonomia reală.',
            'Termomanagementul este critic pentru durata de viată a bateriei.',
        ],
        contextField: 'powertrain',
    },

    maintenanceDefaults: {
        battery_check_km:    50000,
        brake_fluid_months:  24,
        cabin_filter_km:     20000,
        coolant_flush_km:    80000,
    },

    futureIntegrations: {
        diagnosticGraph: {
            id: 'BEV_DIAGNOSTIC_GRAPH',
            entrySignal: 'soc_pct',
            graphPath: null,
            enabled: false,
        },
        failureLibrary: {
            basePath: 'Failures/BEV/',
            enabled: false,
        },
        reasoningTree: {
            template: 'BEV_BAYESIAN',
            evidenceFields: ['soc', 'battery_temp', 'cell_voltage', 'regen_pct'],
            enabled: false,
        },
        knowledgePackExtensions: ['symptoms'],
    },
};

// ════════════════════════════════════════════════════════════════════
// HEV — Hibrid (motor termic + electric, fără priză)
// ════════════════════════════════════════════════════════════════════
const HEV = {
    id: 'HEV',
    label: 'Hibrid (HEV)',

    subsystems: [
        { id: 'ICE_ENGINE',     label: 'Motor termic',    weight: 0.22, icon: 'engine' },
        { id: 'ELECTRIC_MOTOR', label: 'Motor electric',  weight: 0.20, icon: 'motor' },
        { id: 'HYBRID_BATTERY', label: 'Baterie hibrid',  weight: 0.20, icon: 'battery' },
        { id: 'THERMAL_MGMT',   label: 'Termomanagement', weight: 0.15, icon: 'cooling' },
        { id: 'REGENERATION',   label: 'Recuperare energie', weight: 0.13, icon: 'regen' },
        { id: 'TRANSMISSION',   label: 'Transmisie',      weight: 0.10, icon: 'transmission' },
    ],

    scoringStrategy: 'weighted_average',

    defaultCapabilities: {
        hasTurbo: false,
        hasDPF: false,
        hasEGR: true,
        hasLambdaOxygen: true,
        hasBatteryPack: true,
        hasRegenBraking: true,
        hasDCCharging: false,
    },

    pipelineOrder: DEFAULT_PIPELINE_ORDER,

    uiComponents: {
        gauges:  ['rpm', 'soc_pct', 'coolant', 'power_flow'],
        cards:   ['HybridBatteryCard', 'RegenCard', 'PowerFlowCard', 'FuelCard'],
        badges:  ['EcoScore', 'HealthScore', 'HybridEfficiency'],
        alerts:  ['HybridBatteryAlert', 'OverheatAlert', 'RegenFaultAlert'],
    },

    pdfSections: [
        'executive_summary', 'hybrid_system', 'battery_health',
        'fuel_analysis', 'regen_analysis', 'fault_predictions', 'maintenance_schedule',
    ],

    aiExpert: {
        focusAreas: ['hybrid_battery', 'regen_efficiency', 'fuel_consumption', 'thermal'],
        tonePreset: 'technical',
        narrativeHints: [
            'Eficiența regenerativă indică starea sistemului hibrid.',
            'Tranzițiile ICE-EV la viteze mici trebuie să fie fluide.',
        ],
        contextField: 'powertrain',
    },

    maintenanceDefaults: {
        oil_change_km:       10000,
        hybrid_battery_check_km: 60000,
        brake_fluid_months:  24,
        coolant_flush_km:    80000,
    },

    futureIntegrations: {
        diagnosticGraph: {
            id: 'HEV_DIAGNOSTIC_GRAPH',
            entrySignal: 'power_flow',
            graphPath: null,
            enabled: false,
        },
        failureLibrary: {
            basePath: 'Failures/HEV/',
            enabled: false,
        },
        reasoningTree: {
            template: 'HEV_BAYESIAN',
            evidenceFields: ['soc', 'coolant', 'regen_pct', 'rpm'],
            enabled: false,
        },
        knowledgePackExtensions: ['symptoms'],
    },
};

// ════════════════════════════════════════════════════════════════════
// PHEV — Plug-in Hybrid (hibrid cu priză, baterie mai mare)
// ════════════════════════════════════════════════════════════════════
const PHEV = {
    id: 'PHEV',
    label: 'Plug-in Hibrid (PHEV)',

    subsystems: [
        { id: 'ICE_ENGINE',     label: 'Motor termic',    weight: 0.20, icon: 'engine' },
        { id: 'ELECTRIC_MOTOR', label: 'Motor electric',  weight: 0.20, icon: 'motor' },
        { id: 'HYBRID_BATTERY', label: 'Baterie PHEV',    weight: 0.22, icon: 'battery' },
        { id: 'THERMAL_MGMT',   label: 'Termomanagement', weight: 0.13, icon: 'cooling' },
        { id: 'REGENERATION',   label: 'Recuperare energie', weight: 0.10, icon: 'regen' },
        { id: 'CHARGING',       label: 'Sistem încărcare', weight: 0.10, icon: 'charging' },
        { id: 'TRANSMISSION',   label: 'Transmisie',      weight: 0.05, icon: 'transmission' },
    ],

    scoringStrategy: 'weighted_average',

    defaultCapabilities: {
        hasTurbo: false,
        hasDPF: false,
        hasEGR: true,
        hasLambdaOxygen: true,
        hasBatteryPack: true,
        hasRegenBraking: true,
        hasDCCharging: true,
    },

    pipelineOrder: DEFAULT_PIPELINE_ORDER,

    uiComponents: {
        gauges:  ['rpm', 'soc_pct', 'coolant', 'power_flow', 'charge_rate'],
        cards:   ['HybridBatteryCard', 'ChargingCard', 'RegenCard', 'FuelCard', 'RangeCard'],
        badges:  ['EcoScore', 'HealthScore', 'HybridEfficiency', 'EVRangeScore'],
        alerts:  ['HybridBatteryAlert', 'OverheatAlert', 'ChargingFaultAlert'],
    },

    pdfSections: [
        'executive_summary', 'hybrid_system', 'battery_health',
        'charging_analysis', 'fuel_analysis', 'ev_range_analysis',
        'fault_predictions', 'maintenance_schedule',
    ],

    aiExpert: {
        focusAreas: ['battery_health', 'ev_range', 'charging_efficiency', 'regen', 'thermal'],
        tonePreset: 'technical',
        narrativeHints: [
            'Autonomia electrică depinde direct de starea bateriei PHEV.',
            'Monitorizarea ciclurilor de încărcare estimează degradarea bateriei.',
        ],
        contextField: 'powertrain',
    },

    maintenanceDefaults: {
        oil_change_km:       15000,
        hybrid_battery_check_km: 60000,
        brake_fluid_months:  24,
        cabin_filter_km:     20000,
        coolant_flush_km:    80000,
    },

    futureIntegrations: {
        diagnosticGraph: {
            id: 'PHEV_DIAGNOSTIC_GRAPH',
            entrySignal: 'soc_pct',
            graphPath: null,
            enabled: false,
        },
        failureLibrary: {
            basePath: 'Failures/PHEV/',
            enabled: false,
        },
        reasoningTree: {
            template: 'PHEV_BAYESIAN',
            evidenceFields: ['soc', 'coolant', 'charge_rate', 'regen_pct', 'rpm'],
            enabled: false,
        },
        knowledgePackExtensions: ['symptoms'],
    },
};

// ── Registry intern ────────────────────────────────────────────────────────

const PROFILES = { ICE_DIESEL, ICE_PETROL, BEV, HEV, PHEV };

// ── API public ─────────────────────────────────────────────────────────────

/**
 * Selectează profilul de propulsie potrivit pentru vehiculul dat.
 * Logica de detecție: powertrain_type (explicit) > fuel_type > fallback ICE_PETROL.
 *
 * @param {Object|null} vehicleRow   - rândul din tabela vehicles
 * @param {Object|null} capabilities - VehicleCapabilities derivate
 * @returns {PowertrainProfile}
 */
function deriveProfile(vehicleRow, capabilities) {
    const fuelRaw   = (vehicleRow?.fuel_type      || '').toLowerCase().trim();
    const ptRaw     = (vehicleRow?.powertrain_type || '').toLowerCase().trim();

    // Detecție BEV
    if (['bev', 'electric', 'ev'].includes(ptRaw) || ['electric', 'bev', 'ev'].includes(fuelRaw)) {
        return PROFILES.BEV;
    }

    // Detecție PHEV
    if (['phev', 'plug-in hybrid', 'plugin hybrid', 'plug_in_hybrid'].includes(ptRaw)) {
        return PROFILES.PHEV;
    }

    // Detecție HEV
    if (['hev', 'hybrid', 'full hybrid', 'mild hybrid', 'full_hybrid', 'mild_hybrid'].includes(ptRaw) ||
        ['hybrid'].includes(fuelRaw)) {
        return PROFILES.HEV;
    }

    // ICE diesel
    if (['diesel', 'biodiesel', 'lpg+diesel'].includes(fuelRaw)) {
        return PROFILES.ICE_DIESEL;
    }

    // Default: ICE benzinǎ (benzina, petrol, gasoline, lpg, cng etc.)
    return PROFILES.ICE_PETROL;
}

/**
 * Returnează subsistemele active pentru vehiculul dat, cu ponderi redistribuite.
 * Subsistemele cu requiredCapability absentă sunt excluse, iar ponderile lor
 * sunt redistribuite proporțional la celelalte subsisteme.
 *
 * Consumatori viitori: HealthEngine (scoring adaptiv), PDF generator, UI renderer.
 *
 * @param {PowertrainProfile} profile
 * @param {Object|null} capabilities - VehicleCapabilities; null = inclusiv totul
 * @returns {{ id, label, weight, effectiveWeight, icon }[]}
 */
function computeActiveSubsystems(profile, capabilities) {
    const active = profile.subsystems.filter(s => {
        if (!s.requiredCapability) return true;
        return capabilities ? Boolean(capabilities[s.requiredCapability]) : true;
    });

    const totalWeight = active.reduce((sum, s) => sum + s.weight, 0);

    return active.map(s => ({
        id:              s.id,
        label:           s.label,
        icon:            s.icon || null,
        weight:          s.weight,
        effectiveWeight: totalWeight > 0
            ? parseFloat((s.weight / totalWeight).toFixed(4))
            : 0,
    }));
}

module.exports = { deriveProfile, computeActiveSubsystems, PROFILES };
