/**
 * CausalChainCard — Diagramă vizuală cauză-efect pentru propagarea defectelor.
 *
 * Responsabilitate: afișează lanțul cauzal tripartit determinat de AI / Reasoning Engine:
 * [🔴 Cauză Rădăcină] ➔ [🟠 Efect Intermediar] ➔ [🟡 Simptom Observat]
 *
 * @prop {string} title Titlul cardului (default: "DIAGNOZĂ CAUZALĂ & PROPAGARE")
 * @prop {number|string} confidence Procentajul sau nivelul de confidență (ex: 88 sau 'high')
 * @prop {string|object} rootCause Cauza rădăcină ({ title, detail, code })
 * @prop {string|object} intermediateEffect Efectul intermediar ({ title, detail, code })
 * @prop {string|object} observedSymptom Simptomul observat ({ title, detail, code })
 * @prop {string} recommendation Recomandare tehnică opțională
 * @prop {function} onAskAI Callback la apăsarea butonului "Întreabă Inginerul AI"
 * @prop {object} style Stiluri opționale pentru container
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';
import { colors, typography, radii, spacing } from '../../theme';
import StatusBadge from './StatusBadge';

const parseNode = (node) => {
    if (!node) return { title: '—', detail: '' };
    if (typeof node === 'string') return { title: node, detail: '' };
    return {
        title: node.title || node.label || '—',
        detail: node.detail || node.description || '',
    };
};

const CausalChainCard = ({
    title = 'DIAGNOZĂ CAUZALĂ & PROPAGARE',
    confidence = 'high',
    rootCause,
    intermediateEffect,
    observedSymptom,
    recommendation,
    onAskAI,
    style,
}) => {
    const root = parseNode(rootCause);
    const inter = parseNode(intermediateEffect);
    const symp = parseNode(observedSymptom);

    // Format confidence label & status
    let confLabel = 'Confidență ridicată';
    let confStatus = 'good';
    if (typeof confidence === 'number') {
        confLabel = `Confidență ${confidence}%`;
        confStatus = confidence >= 75 ? 'good' : confidence >= 50 ? 'monitor' : 'caution';
    } else if (confidence === 'medium') {
        confLabel = 'Confidență medie';
        confStatus = 'monitor';
    } else if (confidence === 'low') {
        confLabel = 'Confidență scăzută';
        confStatus = 'caution';
    }

    return (
        <View style={[styles.card, style]}>
            {/* ── Header ────────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.icon}>⚡</Text>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                </View>
                <StatusBadge
                    status={confStatus}
                    label={confLabel}
                    size="sm"
                />
            </View>

            {/* ── Chain Stages ───────────────────────────────────── */}
            <View style={styles.chainBody}>
                {/* 1. Root Cause */}
                <View style={styles.stageBox}>
                    <View style={styles.nodeBadgeRow}>
                        <View style={[styles.stageBadge, styles.stageBadgeRoot]}>
                            <Text style={styles.stageBadgeTextRoot}>🔴 CAUZĂ RĂDĂCINĂ</Text>
                        </View>
                    </View>
                    <Text style={styles.nodeTitle}>{root.title}</Text>
                    {root.detail ? <Text style={styles.nodeDetail}>{root.detail}</Text> : null}
                </View>

                {/* Connector 1 */}
                <View style={styles.connector}>
                    <View style={styles.connectorLine} />
                    <View style={styles.arrowWrap}>
                        <Text style={styles.arrowText}>▼ generează</Text>
                    </View>
                    <View style={styles.connectorLine} />
                </View>

                {/* 2. Intermediate Effect */}
                <View style={styles.stageBox}>
                    <View style={styles.nodeBadgeRow}>
                        <View style={[styles.stageBadge, styles.stageBadgeInter]}>
                            <Text style={styles.stageBadgeTextInter}>🟠 EFECT INTERMEDIAR</Text>
                        </View>
                    </View>
                    <Text style={styles.nodeTitle}>{inter.title}</Text>
                    {inter.detail ? <Text style={styles.nodeDetail}>{inter.detail}</Text> : null}
                </View>

                {/* Connector 2 */}
                <View style={styles.connector}>
                    <View style={styles.connectorLine} />
                    <View style={styles.arrowWrap}>
                        <Text style={styles.arrowText}>▼ simptom detectat</Text>
                    </View>
                    <View style={styles.connectorLine} />
                </View>

                {/* 3. Observed Symptom */}
                <View style={styles.stageBox}>
                    <View style={styles.nodeBadgeRow}>
                        <View style={[styles.stageBadge, styles.stageBadgeSymp]}>
                            <Text style={styles.stageBadgeTextSymp}>🟡 SIMPTOM OBSERVAT</Text>
                        </View>
                    </View>
                    <Text style={styles.nodeTitle}>{symp.title}</Text>
                    {symp.detail ? <Text style={styles.nodeDetail}>{symp.detail}</Text> : null}
                </View>
            </View>

            {/* ── Optional Recommendation ────────────────────────── */}
            {recommendation ? (
                <View style={styles.recBox}>
                    <Text style={styles.recIcon}>💡</Text>
                    <Text style={styles.recText}>{recommendation}</Text>
                </View>
            ) : null}

            {/* ── Optional Ask AI Button ─────────────────────────── */}
            {onAskAI ? (
                <TouchableOpacity
                    style={styles.askButton}
                    onPress={onAskAI}
                    accessibilityRole="button"
                    accessibilityLabel="Întreabă Inginerul AI despre acest lanț cauzal"
                >
                    <Text style={styles.askButtonText}>✨ Întreabă Inginerul AI despre acest defect</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
};

CausalChainCard.propTypes = {
    title: PropTypes.string,
    confidence: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    rootCause: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    intermediateEffect: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    observedSymptom: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    recommendation: PropTypes.string,
    onAskAI: PropTypes.func,
    style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
        marginVertical: spacing[2],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle || colors.border.default,
        marginBottom: spacing[3],
    },
    headerTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing[2],
    },
    icon: {
        fontSize: 16,
        marginRight: spacing[2],
    },
    title: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    chainBody: {
        marginVertical: spacing[1],
    },
    stageBox: {
        backgroundColor: colors.bg[0],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.subtle || colors.border.default,
        padding: spacing[3],
    },
    nodeBadgeRow: {
        flexDirection: 'row',
        marginBottom: spacing[1],
    },
    stageBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.xs,
        borderWidth: 1,
    },
    stageBadgeRoot: {
        backgroundColor: 'rgba(255, 69, 58, 0.12)',
        borderColor: colors.status.critical,
    },
    stageBadgeTextRoot: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        color: colors.status.critical,
        letterSpacing: 0.5,
    },
    stageBadgeInter: {
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderColor: colors.status.caution,
    },
    stageBadgeTextInter: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        color: colors.status.caution,
        letterSpacing: 0.5,
    },
    stageBadgeSymp: {
        backgroundColor: 'rgba(255, 214, 10, 0.12)',
        borderColor: colors.status.monitor,
    },
    stageBadgeTextSymp: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        color: colors.status.monitor,
        letterSpacing: 0.5,
    },
    nodeTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginTop: 2,
    },
    nodeDetail: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: 2,
        lineHeight: 16,
    },
    connector: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    connectorLine: {
        width: 1,
        height: 6,
        backgroundColor: colors.border.default,
    },
    arrowWrap: {
        paddingVertical: 2,
        paddingHorizontal: spacing[2],
    },
    arrowText: {
        fontSize: 9,
        color: colors.text.tertiary || colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },
    recBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(77, 142, 245, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(77, 142, 245, 0.25)',
        borderRadius: radii.sm,
        padding: spacing[3],
        marginTop: spacing[3],
        gap: spacing[2],
    },
    recIcon: {
        fontSize: 14,
        marginTop: 1,
    },
    recText: {
        flex: 1,
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        lineHeight: 18,
    },
    askButton: {
        marginTop: spacing[3],
        backgroundColor: colors.accent.default + '1A',
        borderWidth: 1,
        borderColor: colors.accent.default,
        borderRadius: radii.sm,
        paddingVertical: spacing[2] + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    askButtonText: {
        color: colors.accent.default,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
});

export default React.memo(CausalChainCard);
