/**
 * MessageEngine.js — Vehicle Assistant Personality
 *
 * This is the voice of the application. It decides WHAT to say and HOW to say it
 * based on raw data inputs. It uses i18n for all user-facing text.
 *
 * Rules:
 * 1. Never panic. Always calm, informative tone.
 * 2. Never state assumptions as facts. "Data suggests..." not "X is broken."
 * 3. Always explain WHY (provide evidence).
 * 4. Always state urgency clearly.
 * 5. Always provide an action the user can take.
 * 6. Health Score is internal — never shown as primary info.
 */

import { t } from '../i18n';

// --- Evaluation ---

export function computeEvaluation(healthScore) {
    if (healthScore >= 90) return 'EXCELLENT';
    if (healthScore >= 80) return 'GOOD';
    if (healthScore >= 65) return 'ATTENTION';
    if (healthScore >= 45) return 'PROBLEM';
    return 'CRITICAL';
}

// --- Main message ---

export function buildHeaderMessage(evaluation, predictions) {
    const hasHigh = predictions.some(p => p.severity === 'HIGH');
    const hasMedium = predictions.some(p => p.severity === 'MEDIUM');

    switch (evaluation) {
        case 'EXCELLENT':
            return {
                message: t('status.excellent.message'),
                subtitle: t('status.excellent.subtitle'),
            };
        case 'GOOD':
            if (hasMedium) {
                return {
                    message: t('status.goodWithObservation.message'),
                    subtitle: t('status.goodWithObservation.subtitle'),
                };
            }
            return {
                message: t('status.good.message'),
                subtitle: t('status.good.subtitle'),
            };
        case 'ATTENTION':
            return {
                message: t('status.attention.message'),
                subtitle: hasHigh
                    ? t('status.attention.subtitleWithHigh')
                    : t('status.attention.subtitleGeneral'),
            };
        case 'PROBLEM':
            return {
                message: t('status.problem.message'),
                subtitle: t('status.problem.subtitle'),
            };
        case 'CRITICAL':
            return {
                message: t('status.critical.message'),
                subtitle: t('status.critical.subtitle'),
            };
        default:
            return { message: '', subtitle: '' };
    }
}

// --- Prediction → User message ---

export function buildPredictionMessage(prediction) {
    const component = prediction.component || 'Sistem';
    const probability = prediction.probability || 0;

    if (probability >= 60) {
        return t('prediction.highProbability', { component });
    }
    if (probability >= 35) {
        return t('prediction.mediumProbability', { component });
    }
    return t('prediction.lowProbability', { component });
}

export function buildPredictionEvidence(prediction) {
    if (!prediction.factors || prediction.factors.length === 0) return null;
    const main = prediction.factors[0];
    return `${main.param}: ${main.value}`;
}

export function buildPredictionExplanation(prediction) {
    if (!prediction.factors || prediction.factors.length === 0) return null;
    return prediction.factors
        .map(f => `${f.param}: ${f.value} — ${f.impact}`)
        .join('\n');
}

export function buildUrgencyMessage(severity, estimateDays) {
    if (severity === 'HIGH') {
        return t('urgency.high');
    }
    if (severity === 'MEDIUM') {
        if (estimateDays && estimateDays <= 60) {
            return t('urgency.withTimeframe', { days: estimateDays });
        }
        return t('urgency.medium');
    }
    return t('urgency.low');
}

// --- Trend alert → User message ---

export function buildTrendAlertMessage(alert) {
    const systemLabel = t(`trends.systems.${alert.sistem}`) || alert.sistem;
    return {
        title: t('trends.title', { system: systemLabel }),
        explanation: alert.detaliu || null,
        action: t(`actions.${alert.sistem}`) || t('actions.DEFAULT'),
        urgency: t('trends.followUp'),
    };
}

// --- Comparison ---

export function buildComparisonMessages(metrici) {
    const healthVar = parseFloat(metrici.health_score?.variatie_pct || 0);
    const costVar = parseFloat(metrici.cost?.variatie_pct || 0);
    const coolantVar = parseFloat(metrici.coolant?.variatie_pct || 0);
    const voltVar = parseFloat(metrici.voltaj?.variatie_pct || 0);
    const mafVar = parseFloat(metrici.maf?.variatie_pct || 0);

    const significantChanges = {
        healthUp: healthVar > 5,
        healthDown: healthVar < -5,
        costUp: costVar > 10,
        costDown: costVar < -10,
        coolantUp: coolantVar > 5,
        voltDown: voltVar < -3,
        mafDown: mafVar < -8,
    };

    const changeCount = Object.values(significantChanges).filter(Boolean).length;

    if (changeCount === 0) {
        return {
            trend: 'stable',
            summary: t('comparison.noChange'),
            detail: null,
        };
    }

    // Correlation detection — two related changes with a probable cause
    if (significantChanges.costUp && significantChanges.coolantUp) {
        return {
            trend: 'declining',
            summary: t('comparison.consumptionAndCoolant', { percent: Math.round(costVar) }),
            detail: null,
        };
    }

    if (significantChanges.costUp && significantChanges.mafDown) {
        return {
            trend: 'declining',
            summary: t('comparison.consumptionAndMaf', { percent: Math.round(costVar) }),
            detail: null,
        };
    }

    if (significantChanges.voltDown && significantChanges.healthDown) {
        return {
            trend: 'declining',
            summary: t('comparison.voltageAndHealth'),
            detail: null,
        };
    }

    if (significantChanges.healthDown && significantChanges.coolantUp) {
        return {
            trend: 'declining',
            summary: t('comparison.healthAndCoolant'),
            detail: null,
        };
    }

    // Single dominant change — pick the most impactful
    if (significantChanges.healthUp) {
        return {
            trend: 'improving',
            summary: t('comparison.healthImproved'),
            detail: null,
        };
    }

    if (significantChanges.costUp) {
        const detail = significantChanges.mafDown || significantChanges.coolantUp
            ? null
            : t('comparison.causeStyle');
        return {
            trend: 'declining',
            summary: t('comparison.consumptionUp', { percent: Math.round(costVar) }),
            detail,
        };
    }

    if (significantChanges.costDown) {
        return {
            trend: 'improving',
            summary: t('comparison.consumptionDown', { percent: Math.round(Math.abs(costVar)) }),
            detail: null,
        };
    }

    if (significantChanges.healthDown) {
        return {
            trend: 'declining',
            summary: t('comparison.healthDeclined'),
            detail: t('comparison.causeWear'),
        };
    }

    if (significantChanges.coolantUp) {
        return {
            trend: 'warning',
            summary: t('comparison.coolantUp'),
            detail: t('comparison.causeUnknown'),
        };
    }

    if (significantChanges.voltDown) {
        return {
            trend: 'warning',
            summary: t('comparison.voltageDown'),
            detail: t('comparison.causeUnknown'),
        };
    }

    return {
        trend: 'stable',
        summary: t('comparison.noChange'),
        detail: null,
    };
}

// --- Upcoming maintenance timeline ---

export function buildUpcomingTimeline(predictions) {
    if (!predictions || predictions.length === 0) {
        return null;
    }

    const scored = predictions
        .filter(p => p.probability >= 20)
        .map(p => ({
            ...p,
            priorityScore: computePriorityScore(p),
        }))
        .sort((a, b) => b.priorityScore - a.priorityScore);

    if (scored.length === 0) return null;

    return scored.map(p => ({
        component: p.component,
        severity: mapSeverityToCardSeverity(p.severity),
        urgency: buildUrgencyMessage(p.severity, p.estimatedRemainingDays),
        timeframe: buildTimeframeText(p.estimatedRemainingKm, p.estimatedRemainingDays),
        reason: buildReasonSummary(p.factors),
        confidence: mapConfidenceLevel(p.confidence),
        recommendation: p.recommendation || null,
    }));
}

function computePriorityScore(prediction) {
    let score = 0;

    // Severity weight
    if (prediction.severity === 'HIGH') score += 50;
    else if (prediction.severity === 'MEDIUM') score += 25;
    else score += 10;

    // Probability weight
    score += (prediction.probability || 0) * 0.3;

    // Time proximity — closer = higher priority
    if (prediction.estimatedRemainingDays) {
        if (prediction.estimatedRemainingDays <= 14) score += 30;
        else if (prediction.estimatedRemainingDays <= 30) score += 20;
        else if (prediction.estimatedRemainingDays <= 60) score += 10;
    }

    // Confidence boost — more confident = more actionable
    if (prediction.confidence >= 70) score += 10;

    return score;
}

function buildTimeframeText(km, days) {
    if (km && days) return t('upcoming.timeframeBoth', { km, days });
    if (km) return t('upcoming.timeframeKm', { km });
    if (days) return t('upcoming.timeframeDays', { days });
    return t('upcoming.timeframeUnknown');
}

function buildReasonSummary(factors) {
    if (!factors || factors.length === 0) return null;
    return factors
        .slice(0, 2)
        .map(f => `${f.param}: ${f.value}`)
        .join(' · ');
}

// --- Long trip readiness ---

export function buildLongTripMessage(healthScore, predictions) {
    const hasHigh = predictions.some(p => p.severity === 'HIGH');
    const coolantIssue = predictions.some(p =>
        p.category === 'TERMIC' && (p.severity === 'HIGH' || p.severity === 'MEDIUM')
    );
    const electricIssue = predictions.some(p =>
        p.category === 'ELECTRIC' && p.severity === 'HIGH'
    );

    if (healthScore >= 80 && !hasHigh) {
        let detail = t('longTrip.readyDetail');
        const dpf = predictions.find(p => p.category === 'EMISII' && p.severity === 'MEDIUM');
        if (dpf) detail += t('longTrip.readyDpfNote');
        return { answer: t('longTrip.ready'), detail };
    }

    if (coolantIssue || electricIssue) {
        const reason = coolantIssue
            ? t('longTrip.reasons.cooling')
            : t('longTrip.reasons.electric');
        return {
            answer: t('longTrip.notRecommended'),
            detail: t('longTrip.notRecommendedDetail', { reason }),
        };
    }

    if (hasHigh) {
        const highPred = predictions.find(p => p.severity === 'HIGH');
        const component = (highPred?.component || 'un sistem').toLowerCase();
        return {
            answer: t('longTrip.caution'),
            detail: t('longTrip.cautionDetail', { component }),
        };
    }

    return {
        answer: t('longTrip.monitor'),
        detail: t('longTrip.monitorDetail'),
    };
}

// --- Last trip ---

export function buildLastTripMessage(lastTrip) {
    if (!lastTrip) return null;

    const date = formatRelativeDate(lastTrip.date);
    const meta = `${date} · ${lastTrip.distanceKm} km · ${lastTrip.durationMin} min`;

    let detail = t('lastTrip.normal');
    if (lastTrip.healthScore && lastTrip.healthScore < 70) {
        detail = t('lastTrip.problems');
    } else if (lastTrip.ecoScore && lastTrip.ecoScore < 70) {
        detail = t('lastTrip.aggressive');
    }

    return { text: meta, detail };
}

function formatRelativeDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('dates.today');
    if (diffDays === 1) return t('dates.yesterday');
    if (diffDays < 7) return t('dates.daysAgo', { days: diffDays });

    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// --- Confidence mapping ---

export function mapConfidenceLevel(confidence) {
    if (confidence >= 70) return 'HIGH';
    if (confidence >= 45) return 'MEDIUM';
    return 'LOW';
}

export function mapSeverityToCardSeverity(severity) {
    if (severity === 'HIGH') return 'serious';
    if (severity === 'MEDIUM') return 'warning';
    return 'info';
}

// --- Detail screen explanation builder ---

export function buildDetailExplanation(system, data) {
    if (!data) return null;

    const { diagnostics, reliability, predictions, evolution, baseline, correlations, sensorQuality } = data;

    // 1. Conclusion — what it means for the user
    const conclusion = buildSystemConclusion(system, predictions, diagnostics);

    // 2. Why — main factors and deviations
    const factors = buildDetailFactors(diagnostics, predictions);

    // 3. Baseline comparison — human-readable
    const baselineExplanation = buildBaselineExplanation(baseline);

    // 4. Correlations — only if they help explain
    const relevantCorrelations = buildRelevantCorrelations(correlations);

    // 5. Recommendation — concrete action
    const recommendation = buildDetailRecommendation(predictions, diagnostics);

    // 6. Data quality indicator
    const dataQuality = buildDataQualityMessage(sensorQuality);

    return {
        conclusion,
        factors,
        baselineExplanation,
        relevantCorrelations,
        recommendation,
        dataQuality,
    };
}

function buildSystemConclusion(system, predictions, diagnostics) {
    const hasPrediction = predictions && predictions.length > 0;
    const hasHighSeverity = hasPrediction && predictions.some(p => p.severity === 'HIGH');
    const hasMediumSeverity = hasPrediction && predictions.some(p => p.severity === 'MEDIUM');

    let level = 'ok';
    if (hasHighSeverity) level = 'problem';
    else if (hasMediumSeverity || (diagnostics && diagnostics.length > 0)) level = 'attention';

    const key = `detail.conclusions.${system}_${level}`;
    const text = t(key);
    if (text !== key) return text;
    return t(`detail.conclusions.generic_${level}`);
}

function buildDetailFactors(diagnostics, predictions) {
    const factors = [];

    if (predictions) {
        predictions.forEach(p => {
            if (p.factors) {
                p.factors.forEach(f => {
                    factors.push({
                        param: f.param,
                        value: f.value,
                        impact: f.impact || null,
                        significant: true,
                    });
                });
            }
        });
    }

    if (diagnostics && factors.length === 0) {
        diagnostics.forEach(d => {
            if (d.factors) {
                d.factors.forEach(f => {
                    factors.push({
                        param: f.parameter || f.param,
                        value: f.value,
                        impact: f.deviation?.significant
                            ? t('detail.factorDeviation', {
                                direction: f.deviation.direction === 'DOWN' ? t('detail.factorDown') : t('detail.factorUp'),
                                percent: Math.abs(f.deviation.deviationPct || 0),
                            })
                            : null,
                        significant: f.deviation?.significant || false,
                    });
                });
            }
        });
    }

    // Deduplicate and limit to top 4
    const seen = new Set();
    return factors.filter(f => {
        const key = f.param;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 4);
}

function buildBaselineExplanation(baseline) {
    if (!baseline || Object.keys(baseline).length === 0) return null;

    return Object.entries(baseline).map(([key, val]) => ({
        param: key,
        value: String(val),
        isDeviation: typeof val === 'string' && (val.startsWith('+') || val.startsWith('-')),
    }));
}

function buildRelevantCorrelations(correlations) {
    if (!correlations || !correlations.anomalies || correlations.anomalies.length === 0) return null;

    return correlations.anomalies
        .filter(a => Math.abs(a.coeficient) >= 0.6)
        .slice(0, 2)
        .map(a => ({
            pair: a.pereche,
            coefficient: a.coeficient,
            message: a.mesaj,
        }));
}

function buildDetailRecommendation(predictions, diagnostics) {
    if (predictions && predictions.length > 0) {
        const highPred = predictions.find(p => p.severity === 'HIGH');
        if (highPred && highPred.recommendation) return highPred.recommendation;
        const medPred = predictions.find(p => p.severity === 'MEDIUM');
        if (medPred && medPred.recommendation) return medPred.recommendation;
    }

    if (diagnostics && diagnostics.length > 0) {
        for (const d of diagnostics) {
            if (d.rule && d.rule.recommendations && d.rule.recommendations.length > 0) {
                return d.rule.recommendations[0];
            }
        }
    }

    return null;
}

function buildDataQualityMessage(sensorQuality) {
    if (!sensorQuality || sensorQuality.length === 0) return null;
    const avg = sensorQuality.reduce((s, sq) => s + sq.quality, 0) / sensorQuality.length;
    if (avg >= 85) return { level: 'good', text: t('detail.sensorQualityGood') };
    if (avg >= 60) return { level: 'medium', text: t('detail.sensorQualityMedium') };
    return { level: 'low', text: t('detail.sensorQualityLow') };
}
