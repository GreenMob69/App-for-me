import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, useWindowDimensions, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import api from '../services/api';
import { colors, typography, radii, spacing, layout } from '../theme';
import { getHealthColor } from '../utils/statusUtils';

const getInsightStyle = (type) => {
    switch (type) {
        case 'POSITIVE': return { bg: colors.tint.good,     border: colors.status.good,     text: colors.status.good };
        case 'WARNING':  return { bg: colors.tint.monitor,  border: colors.status.monitor,  text: colors.status.monitor };
        case 'NEGATIVE': return { bg: colors.tint.critical, border: colors.status.critical, text: colors.status.critical };
        default:         return { bg: colors.tint.accent,   border: colors.accent.default,  text: colors.accent.default };
    }
};

const getDrivingRankReport = (ecoScore, aggressivePct) => {
    if (ecoScore >= 90 && aggressivePct < 10) return { label: 'Eco Master', color: colors.status.optimal };
    if (ecoScore >= 75) return { label: 'Eficient',    color: colors.status.good };
    if (aggressivePct > 30) return { label: 'Agresiv', color: colors.status.critical };
    return { label: 'Moderat', color: colors.status.monitor };
};

const ScoreBar = ({ label, score, color }) => (
    <View style={styles.scoreBarContainer}>
        <View style={styles.scoreBarHeader}>
            <Text style={styles.scoreBarLabel}>{label}</Text>
            <Text style={[styles.scoreBarValue, { color }]}>{score}%</Text>
        </View>
        <View style={styles.scoreBarBg}>
            <View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: color }]} />
        </View>
    </View>
);

const TripReportScreen = ({ route, navigation }) => {
    const { width } = useWindowDimensions();
    const [report, setReport] = useState(route?.params?.report || null);
    const [loading, setLoading] = useState(!report);

    useEffect(() => {
        if (!report && route?.params?.tripId) {
            fetchReport(route.params.tripId);
        }
    }, []);

    const fetchReport = async (tripId) => {
        try {
            const response = await api.get(`/calatorii/${tripId}/report`);
            setReport(response.data);
        } catch (err) {
            console.error('[TripReport] Eroare:', err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent.default} />
                <Text style={styles.loadingText}>Se generează raportul...</Text>
            </View>
        );
    }

    if (!report) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Raportul nu este disponibil</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
                    <Text style={styles.backBtnText}>Înapoi</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { healthScore, scores, stats, driving, insights, predictions } = report;
    const color = getHealthColor(healthScore);
    const rank = getDrivingRankReport(stats.ecoScore, driving.aggressivePct);

    const gaugeSize = width * 0.5;
    const strokeWidth = 12;
    const radius = (gaugeSize - strokeWidth) / 2 - 8;
    const centerX = gaugeSize / 2;
    const centerY = gaugeSize / 2 + 8;
    const startAngle = Math.PI;
    const progressAngle = startAngle + (healthScore / 100) * Math.PI;

    const describeArc = (startA, endA) => {
        const x1 = centerX + radius * Math.cos(startA);
        const y1 = centerY + radius * Math.sin(startA);
        const x2 = centerX + radius * Math.cos(endA);
        const y2 = centerY + radius * Math.sin(endA);
        const largeArc = endA - startA > Math.PI ? 1 : 0;
        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()}>
                    <Text style={styles.headerBack}>← Înapoi</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Raport Cursă</Text>
                <Text style={styles.headerTrip}>#{report.tripId}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={styles.gaugeSection}>
                    <View style={{ width: gaugeSize, height: gaugeSize * 0.55, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Svg width={gaugeSize} height={gaugeSize * 0.55} style={{ position: 'absolute', top: 0 }}>
                            <Path d={describeArc(startAngle, 2 * Math.PI)} stroke={colors.border.strong} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                            <Path d={describeArc(startAngle, progressAngle)} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                        </Svg>
                        <View style={styles.gaugeCenter}>
                            <Text style={[styles.gaugeScore, { color }]}>{healthScore}</Text>
                            <Text style={styles.gaugePercent}>%</Text>
                        </View>
                    </View>
                    <Text style={styles.gaugeLabel}>Health Score</Text>
                    <View style={[styles.rankBadge, { borderColor: rank.color }]}>
                        <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <ScoreBar label="Motor"        score={scores.engine}  color={getHealthColor(scores.engine)} />
                    <ScoreBar label="Combustibil"  score={scores.fuel}    color={getHealthColor(scores.fuel)} />
                    <ScoreBar label="Stil Condus"  score={scores.driving} color={getHealthColor(scores.driving)} />
                    <ScoreBar label="Siguranță"    score={scores.safety}  color={getHealthColor(scores.safety)} />
                </View>

                <View style={styles.statsGrid}>
                    {[
                        { value: stats.distanceKm,        unit: 'km',      label: 'Distanță' },
                        { value: stats.durationMin,        unit: 'min',     label: 'Durată' },
                        { value: stats.consumptionPer100,  unit: 'L/100km', label: 'Consum' },
                        { value: stats.costRON,            unit: 'RON',     label: 'Cost' },
                        { value: stats.co2Kg,              unit: 'kg CO₂',  label: 'Emisii' },
                        { value: stats.ecoScore,           unit: 'puncte',  label: 'Eco Score',
                          color: stats.ecoScore >= 80 ? colors.status.good : colors.status.monitor },
                    ].map((s, i) => (
                        <View key={i} style={styles.statCard}>
                            <Text style={[styles.statValue, s.color && { color: s.color }]}>{s.value ?? '—'}</Text>
                            <Text style={styles.statUnit}>{s.unit}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stil de Condus</Text>
                    <View style={styles.drivingBars}>
                        {[
                            { label: 'Fluent',    pct: driving.smoothPct,     fill: colors.status.good },
                            { label: 'Economic',  pct: driving.economicPct,   fill: colors.accent.default },
                            { label: 'Agresiv',   pct: driving.aggressivePct, fill: colors.status.critical },
                        ].map((row) => (
                            <View key={row.label} style={styles.drivingRow}>
                                <Text style={styles.drivingLabel}>{row.label}</Text>
                                <View style={styles.drivingBarBg}>
                                    <View style={[styles.drivingBarFill, { width: `${row.pct}%`, backgroundColor: row.fill }]} />
                                </View>
                                <Text style={styles.drivingPct}>{Math.round(row.pct)}%</Text>
                            </View>
                        ))}
                    </View>
                    {(driving.hardBrakes > 0 || driving.hardAccelerations > 0 || driving.overspeeds > 0) && (
                        <View style={styles.eventsRow}>
                            {driving.hardBrakes > 0        && <Text style={styles.eventBadge}>Frânări: {driving.hardBrakes}</Text>}
                            {driving.hardAccelerations > 0 && <Text style={styles.eventBadge}>Accelerări: {driving.hardAccelerations}</Text>}
                            {driving.overspeeds > 0        && <Text style={styles.eventBadge}>Depășiri: {driving.overspeeds}</Text>}
                        </View>
                    )}
                </View>

                {insights && insights.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Observații</Text>
                        {insights.map((insight, idx) => {
                            const s = getInsightStyle(insight.type);
                            return (
                                <View key={idx} style={[styles.insightCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                                    <Text style={[styles.insightIcon, { color: s.text }]}>{insight.icon}</Text>
                                    <Text style={[styles.insightText, { color: s.text }]}>{insight.text}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {predictions && predictions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Predicții Active</Text>
                        {predictions.map((pred, idx) => (
                            <View key={idx} style={styles.predCard}>
                                <View style={styles.predHeader}>
                                    <Text style={styles.predComponent}>{pred.component}</Text>
                                    <Text style={[styles.predSeverity, {
                                        color: pred.severity === 'HIGH' ? colors.status.critical : colors.status.monitor,
                                    }]}>{pred.probability}%</Text>
                                </View>
                                <Text style={styles.predRecommendation}>{pred.recommendation}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: spacing[10] }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: colors.bg[0],
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[10],
    },
    loadingText: {
        color: colors.text.secondary,
        marginTop: spacing[3],
        fontSize: typography.sizes.body2,
    },
    errorText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.body2,
        marginBottom: spacing[4],
    },
    backBtn: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.sm,
    },
    backBtnText: {
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[3],
        borderBottomColor: colors.border.default,
        borderBottomWidth: 1,
    },
    headerBack: {
        color: colors.accent.default,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
    },
    headerTitle: {
        color: colors.text.primary,
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
    },
    headerTrip: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label1,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[5],
    },
    gaugeSection: {
        alignItems: 'center',
        marginBottom: spacing[5],
    },
    gaugeCenter: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    gaugeScore: {
        fontSize: typography.sizes.hero,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    gaugePercent: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        marginLeft: 2,  // optical: aliniază % cu baseline scorului
    },
    gaugeLabel: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginTop: spacing[1],
    },
    rankBadge: {
        marginTop: spacing[2] + 2,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[1],
        borderRadius: radii.full,
        borderWidth: 1.5,
    },
    rankText: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
    },
    section: { marginBottom: spacing[5] },
    sectionTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing[3],
    },
    scoreBarContainer: { marginBottom: spacing[2] + 2 },
    scoreBarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing[1],
    },
    scoreBarLabel: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
    },
    scoreBarValue: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    scoreBarBg: {
        height: 6,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        overflow: 'hidden',
    },
    scoreBarFill: {
        height: 6,
        borderRadius: radii.xs,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: spacing[5],
    },
    statCard: {
        width: '31%',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        alignItems: 'center',
        marginBottom: spacing[2],
        borderColor: colors.border.default,
        borderWidth: 1,
    },
    statValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    statUnit: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginTop: 2,  // optical: tight sub-value label
    },
    statLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginTop: spacing[1],
        fontWeight: typography.weights.semibold,
    },
    drivingBars: { marginBottom: spacing[2] + 2 },
    drivingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    drivingLabel: {
        fontSize: typography.sizes.label2,
        color: colors.text.primary,
        width: 70,  // coloană fixă — aliniament tabel
    },
    drivingBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        overflow: 'hidden',
        marginHorizontal: spacing[2] + 2,
    },
    drivingBarFill: {
        height: 6,
        borderRadius: radii.xs,
    },
    drivingPct: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        width: 35,  // coloană fixă — aliniament tabel
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
    },
    eventsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    eventBadge: {
        fontSize: typography.sizes.caption,
        color: colors.status.critical,
        backgroundColor: colors.tint.critical,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        borderRadius: radii.xs,
        overflow: 'hidden',
    },
    insightCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing[3],
        borderRadius: radii.sm,
        borderWidth: 1,
        marginBottom: spacing[2],
    },
    insightIcon: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        marginRight: spacing[2] + 2,
        marginTop: 1,  // optical: aliniere verticală icon cu text
    },
    insightText: {
        fontSize: typography.sizes.label1,
        flex: 1,
        lineHeight: typography.lineHeights.body2,
    },
    predCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: layout.cardPaddingV,
        borderColor: colors.border.default,
        borderWidth: 1,
        marginBottom: spacing[2],
    },
    predHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[1] + 2,
    },
    predComponent: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    predSeverity: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    predRecommendation: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label1,
    },
});

export default TripReportScreen;
