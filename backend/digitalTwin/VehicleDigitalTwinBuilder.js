/**
 * VehicleDigitalTwinBuilder.js — asamblează twin-ul din ctx + date istorice
 * -----------------------------------------------------------------------
 * Nu mută logică din motoarele existente.
 * Citește exclusiv din DiagnosticContext și din obiectul history pre-fetched.
 * -----------------------------------------------------------------------
 */

const { createDigitalTwin } = require('./VehicleDigitalTwin');

class VehicleDigitalTwinBuilder {

    /**
     * Construiește Digital Twin-ul complet.
     *
     * @param {DiagnosticContext} ctx    — contextul pipeline-ului (populated)
     * @param {Object}            history — date istorice pre-fetched din DB:
     *   { recentTrips[], maintenance[], milestones[], timeline[], documents[] }
     * @returns {VehicleDigitalTwin}
     */
    static build(ctx, history = {}) {
        return createDigitalTwin({
            identity:    VehicleDigitalTwinBuilder._buildIdentity(ctx.vehicleRow),
            profile:     VehicleDigitalTwinBuilder._buildProfile(ctx),
            state:       VehicleDigitalTwinBuilder._buildState(ctx),
            diagnostics: VehicleDigitalTwinBuilder._buildDiagnostics(ctx),
            history:     VehicleDigitalTwinBuilder._buildHistory(history),
            meta:        VehicleDigitalTwinBuilder._buildMeta(ctx)
        });
    }

    // ── Builders privați ──────────────────────────────────────────────────

    static _buildIdentity(row) {
        if (!row) return {};
        const currentYear = new Date().getFullYear();
        const ageYears = row.year ? currentYear - parseInt(row.year, 10) : null;

        // Suportă ambele scheme DB: vehicule (telemetrie) + vehicles (vehicle-profile)
        return {
            vin:                row.vin              || null,
            make:               row.make             || null,
            model:              row.model            || null,
            variant:            row.variant          || null,
            year:               row.year             || null,
            fuelType:           row.fuel_type        || row.tip_combustibil || null,
            transmissionType:   row.transmission     || null,
            engineCode:         row.engine_code      || null,
            displacementCc:     row.displacement_cc  || null,
            powerKw:            row.power_kw         || null,
            powerHp:            row.power_hp         || null,
            torqueNm:           row.torque_nm        || null,
            cylinders:          row.cylinders        || null,
            color:              row.color            || null,
            plateNumber:        row.plate_number     || null,
            emissionStandard:   row.emission_standard|| null,
            co2GKm:             row.co2_gkm          || null,
            purchaseDate:       row.purchase_date    || null,
            purchaseMileageKm:  row.purchase_mileage_km || null,
            currentMileageKm:   row.current_km || row.odometer_km || null,
            ageYears,
            vehicleStatus:      row.vehicle_status   || 'ACTIVE',
            oilSpec:            row.oil_spec         || null,
            timingBeltIntervalKm: row.timing_belt_interval_km || null
        };
    }

    static _buildProfile(ctx) {
        const pack = ctx.knowledgePack;
        return {
            capabilities:         ctx.capabilities || null,
            powertrain:           ctx.powertrain   || null,
            knowledgePackId:      pack?.id          || pack?.manifest?.id      || null,
            knowledgePackVersion: pack?.version    || pack?.manifest?.version  || null
        };
    }

    static _buildState(ctx) {
        const summary  = ctx.summary;
        const health   = ctx.health;

        // Rezumat compact al ultimei curse — nu duplicăm summary-ul complet
        const lastTrip = summary ? {
            durationSeconds:   summary.duration?.totalSeconds    || null,
            distanceKm:        summary.distanceKm                || null,
            avgSpeedKmh:       summary.pid?.speed?.average       || null,
            maxSpeedKmh:       summary.pid?.speed?.max           || null,
            fuelConsumedL:     summary.fuel?.totalConsumed       || null,
            avgConsumption100km: summary.fuel?.avg100km          || null,
            ecoScore:          health?.drivingScore              || null,
            safetyScore:       health?.safetyScore               || null,
            alertCount:        summary.alertCount                || 0,
            rpmZones:          summary.rpmZones                  || null
        } : null;

        return {
            health:       health        || null,
            lastTrip,
            baseline:     ctx.baseline     || null,
            dna:          ctx.dna          || null,
            trends:       ctx.trends       || null,
            correlations: ctx.correlations || null
        };
    }

    static _buildDiagnostics(ctx) {
        return {
            predictions:     ctx.predictions     || [],
            reasoning:       ctx.reasoning       || null,
            recommendations: ctx.recommendations || []
        };
    }

    static _buildHistory(history) {
        return {
            recentTrips: history.recentTrips || [],
            maintenance:  history.maintenance  || [],
            milestones:   history.milestones   || [],
            timeline:     history.timeline     || [],
            documents:    history.documents    || []
        };
    }

    static _buildMeta(ctx) {
        return {
            builtAt:             Date.now(),
            pipelineSteps:       ctx.stepsExecuted || [],
            dataCompleteness:    VehicleDigitalTwinBuilder._computeDataCompleteness(ctx),
            activeKnowledgePack: ctx.knowledgePack?.id
                              || ctx.knowledgePack?.manifest?.id
                              || null
        };
    }

    /**
     * Scor 0-100: câte din câmpurile cheie ale pipeline-ului sunt populate.
     * Reflectă cât de "completă" este reprezentarea vehiculului.
     */
    static _computeDataCompleteness(ctx) {
        const checks = [
            !!ctx.vehicleRow,
            !!ctx.capabilities,
            !!ctx.powertrain,
            !!ctx.knowledgePack,
            !!ctx.summary,
            !!ctx.health,
            !!ctx.baseline,
            !!ctx.dna,
            !!ctx.trends,
            !!ctx.correlations,
            Array.isArray(ctx.predictions)     && ctx.predictions.length     > 0,
            !!ctx.reasoning?.activeNodes?.length,
            Array.isArray(ctx.recommendations) && ctx.recommendations.length > 0
        ];
        return Math.round((checks.filter(Boolean).length / checks.length) * 100);
    }
}

module.exports = { VehicleDigitalTwinBuilder };
