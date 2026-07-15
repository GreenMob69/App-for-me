/**
 * DiagnosticContext.js — envelope unic pentru pipeline-ul de analiză
 * -----------------------------------------------------------------------
 * Un DiagnosticContext conține tot ce intră și tot ce iese dintr-un
 * pipeline de analiză. Se creează o singură dată per cursă (la OPRIRE)
 * și se populează pe măsură ce fiecare etapă din pipeline se execută.
 *
 * Beneficii:
 *   - Adăugarea unui nou câmp în pipeline = o singură modificare aici
 *   - Fiecare etapă are acces la orice rezultat anterior fără parametri
 *     suplimentari în semnătura funcției
 *   - Istoricul execuției (stepsExecuted, stepsSkipped) este vizibil
 *
 * NU conține logică. Este exclusiv structură și factory.
 * -----------------------------------------------------------------------
 */

/**
 * Identificatori unici pentru fiecare etapă din pipeline.
 * Folosite în stepsExecuted / stepsSkipped pentru audit.
 */
const PIPELINE_STEPS = {
    DATA_INTEGRITY:          'DATA_INTEGRITY',
    SENSOR_QUALITY:          'SENSOR_QUALITY',
    TRIP_SUMMARY:            'TRIP_SUMMARY',
    HEALTH_ENGINE:           'HEALTH_ENGINE',
    RULE_ENGINE:             'RULE_ENGINE',
    CONFIDENCE:              'CONFIDENCE',
    RELIABILITY:             'RELIABILITY',
    CONFLICT_RESOLVER:       'CONFLICT_RESOLVER',
    EXPLAINABILITY:          'EXPLAINABILITY',
    CORRELATIONS:            'CORRELATIONS',
    BASELINE:                'BASELINE',
    RELIABILITY_FINAL:       'RELIABILITY_FINAL',
    DETAILED_EXPLAINABILITY: 'DETAILED_EXPLAINABILITY',
    FAULT_PREDICTIONS:       'FAULT_PREDICTIONS',
    VEHICLE_DNA:             'VEHICLE_DNA',
    REASONING:               'REASONING',
    RECOMMENDATIONS:         'RECOMMENDATIONS',
    DIGITAL_TWIN:            'DIGITAL_TWIN',
    AI_REPORT:               'AI_REPORT',
};

/**
 * Creează un DiagnosticContext nou pentru o cursă.
 *
 * @param {Object} trip - obiectul călătoriei active (din calatoriiActive[vin])
 * @param {Object} opts - opțiunile primite de finalizeTripAnalysis:
 *   @param {Object} opts.db        - instanța SQLite
 *   @param {string} opts.vin       - VIN-ul vehiculului
 *   @param {Array}  opts.dtcList   - lista DTC-uri active
 *   @param {Array}  opts.rawPackets- pachete brute telemetrie
 *   @param {Object} opts.trends    - rezultat TrendEngine (opțional)
 *
 * @returns {DiagnosticContext}
 */
function createDiagnosticContext(trip, opts = {}) {
    return {
        // ── Input imutabil ─────────────────────────────────────────────
        trip,
        db:         opts.db         || null,
        vin:        opts.vin        || null,
        dtcList:    opts.dtcList    || [],
        rawPackets: opts.rawPackets || [],
        trends:     opts.trends     || null,

        // ── Date vehicul (populate înainte de Pasul 1) ────────────────
        vehicleRow:    null,   // rândul brut din tabela vehicles
        capabilities:  null,   // flags derivate din vehicleRow
        knowledgePack: null,   // pack-ul de cunoaștere selectat
        powertrain:    null,   // PowertrainProfile — descriptor complet al propulsiei

        // ── Rezultate pipeline (null până etapa se execută) ────────────
        dataIntegrity:          null,
        sensorQuality:          null,
        summary:                null,
        health:                 null,
        diagnostics:            null,
        confidence:             null,
        reliability:            null,
        conflictResolution:     null,
        explainability:         null,
        correlations:           null,
        baseline:               null,
        reliabilityFinal:       null,
        detailedExplainability: null,
        predictions:            null,
        dna:                    null,
        reasoning:              null,
        recommendations:        null,
        digitalTwin:            null,
        ai:                     null,

        // ── Metadata execuție ──────────────────────────────────────────
        stepsExecuted: [],
        stepsSkipped:  [],
        startedAt:     Date.now(),
    };
}

module.exports = { createDiagnosticContext, PIPELINE_STEPS };
