/**
 * statusMapper.js
 *
 * Transforms raw backend responses (health + trends) into a UI-ready model.
 * Delegates all message generation to MessageEngine.
 * Contains only structural logic: what to show, in what order, with what data.
 *
 * UI model shape:
 * {
 *   state: 'success' | 'empty',
 *   evaluation: string,
 *   message: string,
 *   subtitle: string,
 *   observations: ObservationModel[],
 *   comparison: { trend, summary, detail } | null,
 *   upcoming: TimelineItem[] | null,
 *   lastEvent: { type, title, description, meta } | null,
 *   longTripReady: { answer, detail } | null,
 *   lastUpdated: string | null,
 *   dataQuality: 'HIGH' | 'MEDIUM' | 'LOW' | null,
 * }
 */

import {
    computeEvaluation,
    buildHeaderMessage,
    buildPredictionMessage,
    buildPredictionEvidence,
    buildPredictionExplanation,
    buildUrgencyMessage,
    buildTrendAlertMessage,
    buildComparisonMessages,
    buildUpcomingTimeline,
    buildLongTripMessage,
    buildLatestEvent,
    mapConfidenceLevel,
    mapSeverityToCardSeverity,
} from '../engine/MessageEngine';
import { t } from '../i18n';

const CATEGORY_TO_SYSTEM = {
    TERMIC: 'motor',
    ADMISIE: 'motor',
    MOTOR: 'motor',
    ELECTRIC: 'electric',
    TURBO: 'turbo',
    COMBUSTIBIL: 'combustibil',
    EMISII: 'combustibil',
};

function mapPredictionToObservation(prediction) {
    return {
        title: buildPredictionMessage(prediction),
        evidence: buildPredictionEvidence(prediction),
        explanation: buildPredictionExplanation(prediction),
        action: prediction.recommendation || null,
        urgency: buildUrgencyMessage(prediction.severity, prediction.estimatedRemainingDays),
        confidence: mapConfidenceLevel(prediction.confidence),
        severity: mapSeverityToCardSeverity(prediction.severity),
        estimateKm: prediction.estimatedRemainingKm || null,
        estimateDays: prediction.estimatedRemainingDays || null,
        hasDetail: true,
        systemKey: CATEGORY_TO_SYSTEM[prediction.category] || null,
    };
}

function mapTrendAlertToObservation(alert) {
    const msg = buildTrendAlertMessage(alert);
    return {
        title: msg.title,
        evidence: null,
        explanation: msg.explanation,
        action: msg.action,
        urgency: msg.urgency,
        confidence: 'MEDIUM',
        severity: 'warning',
        estimateKm: null,
        estimateDays: null,
        hasDetail: false,
    };
}

export function mapStatusData(health, trends) {
    if (!health || health.status === 'NO_DATA') {
        return {
            state: 'empty',
            evaluation: 'GOOD',
            message: t('status.empty.message'),
            subtitle: t('status.empty.subtitle'),
            observations: [],
            comparison: null,
            lastEvent: null,
            longTripReady: null,
            lastUpdated: null,
            dataQuality: null,
        };
    }

    const score = health.overallHealth || 100;
    const predictions = health.predictions || [];
    const evaluation = computeEvaluation(score);
    const { message, subtitle } = buildHeaderMessage(evaluation, predictions);

    // Observations from predictions (max 3, sorted by probability)
    const observations = predictions
        .filter(p => p.probability >= 25)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3)
        .map(mapPredictionToObservation);

    // Supplement with trend alerts not already covered
    if (trends && trends.status === 'SUCCESS' && trends.alerte_predictive) {
        const coveredSystems = predictions.map(p => p.category);
        const freshAlerts = trends.alerte_predictive.filter(
            a => !coveredSystems.includes(a.sistem)
        );
        freshAlerts.slice(0, 2).forEach(alert => {
            observations.push(mapTrendAlertToObservation(alert));
        });
    }

    // Comparison — structured object { trend, summary, detail } or null
    const comparison = (trends && trends.status === 'SUCCESS' && trends.metrici)
        ? buildComparisonMessages(trends.metrici)
        : null;

    // Upcoming maintenance timeline — prioritized list or null
    const upcoming = buildUpcomingTimeline(predictions);

    // Latest event (enriched last trip for "Ultimul eveniment important")
    const lastEvent = buildLatestEvent(health.lastTrip);

    // Long trip readiness
    const longTripReady = buildLongTripMessage(score, predictions);

    return {
        state: 'success',
        evaluation,
        message,
        subtitle,
        observations,
        comparison,
        upcoming,
        lastEvent,
        longTripReady,
        lastUpdated: health.lastUpdated || null,
        dataQuality: health.dataQuality || null,
    };
}
