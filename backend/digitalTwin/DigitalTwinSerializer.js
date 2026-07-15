/**
 * DigitalTwinSerializer.js — view-uri specializate ale Digital Twin
 * -----------------------------------------------------------------------
 * Fiecare serializer returnează exclusiv câmpurile relevante pentru
 * consumatorul respectiv. Scopul: consumatorii nu accesează raw twin-ul
 * direct — folosesc view-ul pregătit pentru ei.
 *
 * Consumatori:
 *   toFrontend()      — UI mobile/web: tot twin-ul + câmpuri calculate
 *   toAIExpert()      — LLM context: compact, fără date brute
 *   toPDF()           — PDF generator: identitate + diagnostic complet + istoric
 *   toNotifications() — Notification Engine: doar alertele urgente
 *   toJSON()          — serializare completă pentru persistare snapshot
 * -----------------------------------------------------------------------
 */

class DigitalTwinSerializer {

    /**
     * View pentru frontend (UI mobil/web).
     * Returnează tot twin-ul + câmpuri calculate de conveniență.
     */
    static toFrontend(twin) {
        if (!twin) return null;

        const recs = twin.diagnostics?.recommendations || [];
        const preds = twin.diagnostics?.predictions    || [];

        return {
            ...twin,
            computed: {
                hasActiveAlerts:     recs.some(r => !r.driveAllowed),
                countImmediate:      recs.filter(r => r.urgency === 'IMMEDIATE').length,
                countSoon:           recs.filter(r => r.urgency === 'SOON').length,
                countPlanned:        recs.filter(r => r.urgency === 'PLANNED').length,
                overallHealth:       twin.state?.health?.overallHealth     || null,
                engineScore:         twin.state?.health?.engineScore       || null,
                fuelScore:           twin.state?.health?.fuelScore         || null,
                scoringMethod:       twin.state?.health?.scoringMethod     || null,
                topRecommendation:   recs[0]  || null,
                highSeverityCount:   preds.filter(p => p.severity === 'HIGH').length,
                maintenanceOverdue:  (twin.history?.maintenance || [])
                    .filter(m => (m.wear_percent ?? 0) >= 100 || (m.remaining_km ?? 1) <= 0).length
            }
        };
    }

    /**
     * View pentru AI Expert (context LLM compact).
     * Exclude date brute și câmpuri redundante — optimizat pentru token count.
     */
    static toAIExpert(twin) {
        if (!twin) return null;

        const health = twin.state?.health;
        const preds  = twin.diagnostics?.predictions     || [];
        const recs   = twin.diagnostics?.recommendations || [];

        return {
            identity: {
                make:            twin.identity.make,
                model:           twin.identity.model,
                year:            twin.identity.year,
                fuelType:        twin.identity.fuelType,
                engineCode:      twin.identity.engineCode,
                displacementCc:  twin.identity.displacementCc,
                currentMileageKm:twin.identity.currentMileageKm,
                ageYears:        twin.identity.ageYears,
                emissionStandard:twin.identity.emissionStandard,
                timingBeltIntervalKm: twin.identity.timingBeltIntervalKm
            },
            capabilities: twin.profile?.capabilities || null,
            health: health ? {
                overallHealth: health.overallHealth,
                engineScore:   health.engineScore,
                fuelScore:     health.fuelScore,
                drivingScore:  health.drivingScore,
                safetyScore:   health.safetyScore,
                subsystems:    health.subsystems    || null,
                scoringMethod: health.scoringMethod
            } : null,
            baselineDeviations: twin.state?.baseline?.deviations || {},
            dna: twin.state?.dna ? {
                fingerprint: twin.state.dna.fingerprint   || null,
                traits:      twin.state.dna.traits        || [],
                subsystems:  twin.state.dna.subsystems    || null
            } : null,
            predictions: preds.slice(0, 5).map(p => ({
                component:   p.component,
                severity:    p.severity,
                probability: p.probability,
                failureId:   p.failureId,
                driveRecommendation: p.driveRecommendation
            })),
            reasoning: twin.diagnostics?.reasoning ? {
                rootCauses: twin.diagnostics.reasoning.rootCauses,
                summary:    twin.diagnostics.reasoning.summary,
                confidence: twin.diagnostics.reasoning.confidence
            } : null,
            topRecommendations: recs.slice(0, 3).map(r => ({
                rank:             r.rank,
                title:            r.title,
                urgency:          r.urgency,
                severity:         r.severity,
                recommendedAction:r.recommendedAction,
                diyPossible:      r.diyPossible,
                driveAllowed:     r.driveAllowed,
                estimatedRepairCost: r.estimatedRepairCost,
                isRootCause:      r.isRootCause,
                explanation:      r.explanation
            })),
            maintenanceOverdue: (twin.history?.maintenance || [])
                .filter(m => (m.wear_percent ?? 0) >= 100 || (m.remaining_km ?? 1) <= 0)
                .map(m => ({ item_name: m.item_name, remaining_km: m.remaining_km, wear_percent: m.wear_percent })),
            recentMilestones: (twin.history?.milestones || []).slice(0, 3),
            alertLevel: twin.alertLevel,
            dataCompleteness: twin.meta?.dataCompleteness
        };
    }

    /**
     * View pentru PDF generator.
     * Include identitate completă + toate diagnosticele + istoric.
     */
    static toPDF(twin) {
        if (!twin) return null;

        return {
            identity:        twin.identity,
            profile: {
                capabilities:    twin.profile?.capabilities,
                powertrainLabel: twin.profile?.powertrain?.label || null,
                knowledgePackId: twin.profile?.knowledgePackId
            },
            health:          twin.state?.health        || null,
            lastTrip:        twin.state?.lastTrip      || null,
            baseline:        twin.state?.baseline      || null,
            dna:             twin.state?.dna           || null,
            predictions:     twin.diagnostics?.predictions     || [],
            reasoning:       twin.diagnostics?.reasoning       || null,
            recommendations: twin.diagnostics?.recommendations || [],
            maintenance:     twin.history?.maintenance || [],
            milestones:      twin.history?.milestones  || [],
            recentTrips:     twin.history?.recentTrips || [],
            alertLevel:      twin.alertLevel,
            meta:            twin.meta
        };
    }

    /**
     * View pentru Notification Engine.
     * Returnează exclusiv alertele care necesită notificare imediată.
     */
    static toNotifications(twin) {
        if (!twin) return { alerts: [], alertLevel: 'NORMAL', totalAlerts: 0 };

        const recs = twin.diagnostics?.recommendations || [];
        const urgent = recs.filter(r => r.urgency === 'IMMEDIATE' || r.urgency === 'SOON');

        const maintenanceOverdue = (twin.history?.maintenance || [])
            .filter(m => (m.wear_percent ?? 0) >= 100 || (m.remaining_km ?? 1) <= 0);

        const driveAllowed = !recs.some(r => !r.driveAllowed);

        return {
            vin:         twin.identity?.vin       || null,
            make:        twin.identity?.make      || null,
            model:       twin.identity?.model     || null,
            alertLevel:  twin.alertLevel,
            driveAllowed,
            urgentRepairs: urgent.map(r => ({
                rank:                r.rank,
                failureId:           r.failureId,
                title:               r.title,
                urgency:             r.urgency,
                severity:            r.severity,
                driveRecommendation: r.driveRecommendation,
                recommendedAction:   r.recommendedAction,
                estimatedRepairCost: r.estimatedRepairCost,
                recommendedWorkshopType: r.recommendedWorkshopType
            })),
            maintenanceOverdue: maintenanceOverdue.map(m => ({
                item_name:   m.item_name,
                wear_percent:m.wear_percent,
                remaining_km:m.remaining_km,
                next_due_km: m.next_due_km
            })),
            healthScore:  twin.state?.health?.overallHealth || null,
            totalAlerts:  urgent.length + maintenanceOverdue.length
        };
    }

    /**
     * Serializare completă pentru persistare snapshot.
     * Produce un POJO safe pentru JSON.stringify.
     */
    static toJSON(twin) {
        return JSON.parse(JSON.stringify(twin));
    }
}

module.exports = { DigitalTwinSerializer };
