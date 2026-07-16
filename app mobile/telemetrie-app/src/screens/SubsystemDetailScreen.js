import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, Animated, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout, motion } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';
import { buildDetailExplanation } from '../engine/MessageEngine';
import { Skeleton, EmptyState } from '../components/ui';

const SubsystemDetailScreen = ({ route, navigation }) => {
    const { system, vin } = route.params;
    const { width: screenWidth } = useWindowDimensions();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [technicalExpanded, setTechnicalExpanded] = useState(false);
    const contentOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchDetail();
    }, [system]);

    const fetchDetail = async () => {
        try {
            const response = await api.get(`/vehicul/${vin}/health/${system}`);
            setData(response.data);
            Animated.timing(contentOpacity, {
                toValue: 1,
                duration: motion.duration.normal,
                useNativeDriver: true,
            }).start();
        } catch (err) {
            // error handled by null data state
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>{t('detail.back')}</Text>
                    </TouchableOpacity>
                    <Skeleton variant="text" height={typography.sizes.body1} width={120} />
                </View>
                <View style={styles.skeletonContent}>
                    <Skeleton variant="card" height={80} style={styles.skGap} />
                    <Skeleton variant="text" height={typography.sizes.label2} width={100} style={styles.skGap} />
                    <Skeleton variant="card" height={120} style={styles.skGap} />
                    <Skeleton variant="text" height={typography.sizes.label2} width={100} style={styles.skGap} />
                    <Skeleton variant="card" height={160} />
                </View>
            </View>
        );
    }

    if (!data) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />
                <View style={styles.headerBar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backText}>{t('detail.back')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.centerContainer}>
                    <EmptyState
                        icon="—"
                        title={t('detail.noData')}
                        subtitle="Nu există date pentru acest subsistem."
                        size="lg"
                    />
                </View>
            </View>
        );
    }

    const explanation = buildDetailExplanation(system, data);
    const { evolution, diagnostics, sensorQuality } = data;

    const chartKey = system === 'electric' ? 'voltaj_min' : system === 'turbo' ? 'boost_mediu' : system === 'motor' ? 'coolant_max' : 'health_score';
    const hasChart = evolution && evolution.length >= 2;
    const chartData = hasChart
        ? evolution.map((item, idx) => ({
            value: item[chartKey] || item.health_score || 0,
            label: idx === 0 ? '#1' : idx === evolution.length - 1 ? `#${evolution.length}` : '',
        }))
        : [];

    const chartWidth = screenWidth - layout.screenPaddingH * 2 - spacing[4] * 2;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />

            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>{t('detail.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t(`detail.systems.${system}`)}</Text>
            </View>

            <Animated.ScrollView
                style={[styles.scroll, { opacity: contentOpacity }]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {explanation && explanation.conclusion && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.conclusionLabel')}</Text>
                        <Text style={styles.conclusionText}>{explanation.conclusion}</Text>
                        {explanation.dataQuality && (
                            <Text style={[styles.qualityHint, explanation.dataQuality.level === 'low' && styles.qualityWarn]}>
                                {explanation.dataQuality.text}
                            </Text>
                        )}
                    </View>
                )}

                {explanation && explanation.factors && explanation.factors.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.whyLabel')}</Text>
                        <View style={styles.factorsList}>
                            {explanation.factors.map((f, idx) => (
                                <View key={idx} style={styles.factorRow}>
                                    <View style={styles.factorDot} />
                                    <View style={styles.factorContent}>
                                        <Text style={styles.factorParam}>{f.param}: <Text style={styles.factorValue}>{f.value}</Text></Text>
                                        {f.impact && <Text style={styles.factorImpact}>{f.impact}</Text>}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {hasChart && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.evolutionLabel')}</Text>
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={chartData}
                                width={chartWidth}
                                height={100}
                                spacing={chartWidth / Math.max(chartData.length - 1, 1)}
                                color={colors.accent.default}
                                thickness={2}
                                hideRules
                                yAxisColor="transparent"
                                xAxisColor={colors.border.default}
                                yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                hideYAxisText
                                dataPointsRadius={3}
                                dataPointsColor={colors.accent.default}
                                curved
                                startFillColor={colors.accent.muted}
                                endFillColor="rgba(77,142,245,0.01)"
                                areaChart
                                noOfSections={3}
                            />
                        </View>
                    </View>
                )}

                {explanation && explanation.baselineExplanation && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.baselineLabel')}</Text>
                        <View style={styles.baselineList}>
                            {explanation.baselineExplanation.map((b, idx) => (
                                <View key={idx} style={styles.baselineRow}>
                                    <Text style={styles.baselineParam}>{b.param}</Text>
                                    <Text style={[styles.baselineValue, b.isDeviation && styles.baselineDeviation]}>
                                        {b.value}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {explanation && explanation.relevantCorrelations && explanation.relevantCorrelations.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.correlationsLabel')}</Text>
                        {explanation.relevantCorrelations.map((c, idx) => (
                            <View key={idx} style={styles.correlationCard}>
                                <Text style={styles.correlationPair}>{c.pair}</Text>
                                <Text style={styles.correlationMessage}>{c.message}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {explanation && explanation.recommendation && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.recommendationLabel')}</Text>
                        <View style={styles.recommendationBox}>
                            <Text style={styles.recommendationText}>{explanation.recommendation}</Text>
                        </View>
                    </View>
                )}

                {diagnostics && diagnostics.length > 0 && (
                    <View style={styles.technicalSection}>
                        <TouchableOpacity
                            style={styles.technicalToggle}
                            onPress={() => setTechnicalExpanded(!technicalExpanded)}
                        >
                            <Text style={styles.technicalToggleText}>
                                {technicalExpanded ? t('detail.collapseTechnical') : t('detail.expandTechnical')}
                            </Text>
                        </TouchableOpacity>

                        {technicalExpanded && (
                            <View style={styles.technicalContent}>
                                {diagnostics.map((diag, idx) => (
                                    <View key={idx} style={styles.diagCard}>
                                        <Text style={styles.diagTitle}>{diag.diagnosis}</Text>
                                        <View style={styles.diagMeta}>
                                            <Text style={[styles.diagProb, styles.tabular]}>{diag.probability}%</Text>
                                            {diag.trendStatus && (
                                                <Text style={styles.diagTrend}>
                                                    {diag.trendStatus === 'CONFIRMED' ? t('detail.trendConfirmed') : t('detail.trendStable')}
                                                </Text>
                                            )}
                                        </View>
                                        {diag.factors && diag.factors.map((f, fi) => (
                                            <Text key={fi} style={styles.diagFactor}>
                                                {f.parameter}: {f.value}
                                                {f.deviation?.significant ? ` (${f.deviation.direction === 'DOWN' ? '↓' : '↑'}${Math.abs(f.deviation.deviationPct)}%)` : ''}
                                            </Text>
                                        ))}
                                    </View>
                                ))}

                                {sensorQuality && sensorQuality.length > 0 && (
                                    <View style={styles.sensorSection}>
                                        {sensorQuality.map((sq, idx) => (
                                            <View key={idx} style={styles.sensorRow}>
                                                <Text style={styles.sensorName}>{sq.sensor}</Text>
                                                <View style={styles.sensorBarBg}>
                                                    <View style={[styles.sensorBarFill, {
                                                        width: `${sq.quality}%`,
                                                        backgroundColor: getSubsystemColor(sq.quality),
                                                    }]} />
                                                </View>
                                                <Text style={[styles.sensorPct, styles.tabular]}>{sq.quality}%</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: spacing[10] }} />
            </Animated.ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 44,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skeletonContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[5],
    },
    skGap: { marginBottom: spacing[3] },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[3],
        borderBottomColor: colors.border.subtle,
        borderBottomWidth: 1,
    },
    backBtn: {
        marginRight: spacing[3],
        paddingVertical: spacing[1],
    },
    backText: {
        color: colors.accent.default,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
    },
    headerTitle: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[5],
    },
    section: {
        marginBottom: spacing[6],
    },
    sectionLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: spacing[2] + 2,
    },
    conclusionText: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.medium,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body1,
    },
    qualityHint: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[2],
    },
    qualityWarn: {
        color: colors.status.monitor,
    },
    factorsList: {
        gap: spacing[2] + 2,
    },
    factorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    factorDot: {
        width: 6,
        height: 6,
        borderRadius: radii.full,
        backgroundColor: colors.accent.default,
        marginTop: spacing[1] + 2,
        marginRight: spacing[2] + 2,
    },
    factorContent: {
        flex: 1,
    },
    factorParam: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.label1,
    },
    factorValue: {
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    factorImpact: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
    chartContainer: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    baselineList: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
        gap: spacing[2],
    },
    baselineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    baselineParam: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    baselineValue: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
    },
    baselineDeviation: {
        color: colors.status.monitor,
    },
    correlationCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[2],
    },
    correlationPair: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        marginBottom: spacing[1],
    },
    correlationMessage: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label2 + 1,
    },
    recommendationBox: {
        backgroundColor: colors.tint.good,
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: 'rgba(52,209,114,0.20)',
    },
    recommendationText: {
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
    },
    technicalSection: {
        marginTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        paddingTop: spacing[4],
    },
    technicalToggle: {
        paddingVertical: spacing[2] + 2,
        alignItems: 'center',
    },
    technicalToggleText: {
        fontSize: typography.sizes.label2,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },
    technicalContent: {
        marginTop: spacing[3],
        gap: spacing[2],
    },
    diagCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    diagTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        marginBottom: spacing[1] + 2,
    },
    diagMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2] + 2,
        marginBottom: spacing[2],
    },
    diagProb: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.accent.default,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    diagTrend: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    diagFactor: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.caption,
    },
    sensorSection: {
        marginTop: spacing[2],
    },
    sensorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[1] + 1,
    },
    sensorName: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        width: 80,
    },
    sensorBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: colors.border.default,
        borderRadius: radii.xs,
        overflow: 'hidden',
        marginHorizontal: spacing[2],
    },
    sensorBarFill: {
        height: 4,
        borderRadius: radii.xs,
    },
    sensorPct: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        width: 30,
        textAlign: 'right',
    },
});

export default SubsystemDetailScreen;
