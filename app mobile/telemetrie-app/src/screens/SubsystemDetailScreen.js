import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, Animated, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout, motion, useThemeTemplate } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';
import { buildDetailExplanation } from '../engine/MessageEngine';
import { Skeleton, EmptyState } from '../components/ui';
import { getRootNavigation } from '../utils/navigation';
import PropTypes from 'prop-types';

const SubsystemDetailScreen = ({ route, navigation }) => {
    const { system, vin } = route.params;
    const { width: screenWidth } = useWindowDimensions();
    const tpl = useThemeTemplate();
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
            <View style={[styles.container, { backgroundColor: tpl.bg }]}>
                <StatusBar barStyle="light-content" backgroundColor={tpl.bg} />
                <View style={[styles.headerBar, { borderBottomColor: tpl.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={[styles.backText, { color: tpl.accent }]}>{t('detail.back')}</Text>
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
            <View style={[styles.container, { backgroundColor: tpl.bg }]}>
                <StatusBar barStyle="light-content" backgroundColor={tpl.bg} />
                <View style={[styles.headerBar, { borderBottomColor: tpl.border }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={[styles.backText, { color: tpl.accent }]}>{t('detail.back')}</Text>
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

    const chartMeta = system === 'electric'
        ? { key: 'voltaj_min', label: 'Tensiune Minimă', unit: 'V' }
        : system === 'turbo'
            ? { key: 'boost_mediu', label: 'Presiune Medie Turbo', unit: 'bar' }
            : system === 'motor'
                ? { key: 'coolant_max', label: 'Temp. Lichid Răcire Max', unit: '°C' }
                : { key: 'health_score', label: 'Scor Sănătate', unit: '%' };

    const chartKey = chartMeta.key;
    const hasChart = evolution && evolution.length >= 2;
    const chartData = hasChart
        ? evolution.map((item, idx) => {
            const raw = item[chartKey] !== undefined ? item[chartKey] : (item.health_score || 0);
            const num = parseFloat(raw) || 0;
            return {
                value: Math.round(num * 10) / 10,
                rawVal: num,
                label: idx === 0 ? '#1' : idx === evolution.length - 1 ? `#${evolution.length}` : '',
                cursa: idx + 1,
            };
        })
        : [];

    const evoVals = chartData.map(d => d.value);
    const evoMax  = evoVals.length ? Math.max(...evoVals) : 0;
    const evoMin  = evoVals.length ? Math.min(...evoVals) : 0;
    const evoAvg  = evoVals.length ? Math.round((evoVals.reduce((a, b) => a + b, 0) / evoVals.length) * 10) / 10 : 0;

    const chartWidth = screenWidth - layout.screenPaddingH * 2 - spacing[4] * 2;

    return (
        <View style={[styles.container, { backgroundColor: tpl.bg }]}>
            <StatusBar barStyle="light-content" backgroundColor={tpl.bg} />

            <View style={[styles.headerBar, { borderBottomColor: tpl.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={[styles.backText, { color: tpl.accent }]}>{t('detail.back')}</Text>
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
                        <View style={styles.chartHeaderRow}>
                            <Text style={styles.sectionLabel}>{t('detail.evolutionLabel')}</Text>
                            <View style={styles.chartMetricBadge}>
                                <Text style={styles.chartMetricBadgeText}>{chartMeta.label}</Text>
                            </View>
                        </View>
                        <View style={styles.chartContainer}>
                            {/* Mini Bento Stats */}
                            <View style={styles.chartStatsRow}>
                                <View style={[styles.chartStatCard, { borderLeftColor: colors.status.good, borderLeftWidth: 2 }]}>
                                    <Text style={styles.chartStatLbl}>🔺 MAX</Text>
                                    <Text style={[styles.chartStatVal, { color: colors.status.good }]}>
                                        {evoMax.toFixed(1)} <Text style={styles.chartStatUnit}>{chartMeta.unit}</Text>
                                    </Text>
                                </View>
                                <View style={[styles.chartStatCard, { borderLeftColor: colors.status.caution, borderLeftWidth: 2 }]}>
                                    <Text style={styles.chartStatLbl}>🔻 MIN</Text>
                                    <Text style={styles.chartStatVal}>
                                        {evoMin.toFixed(1)} <Text style={styles.chartStatUnit}>{chartMeta.unit}</Text>
                                    </Text>
                                </View>
                                <View style={[styles.chartStatCard, { borderLeftColor: colors.accent.default, borderLeftWidth: 2 }]}>
                                    <Text style={styles.chartStatLbl}>📊 MEDIE</Text>
                                    <Text style={styles.chartStatVal}>
                                        {evoAvg.toFixed(1)} <Text style={styles.chartStatUnit}>{chartMeta.unit}</Text>
                                    </Text>
                                </View>
                            </View>

                            <LineChart
                                data={chartData}
                                width={chartWidth}
                                height={125}
                                spacing={chartWidth / Math.max(chartData.length - 1, 1)}
                                color={colors.accent.default}
                                thickness={2.5}
                                yAxisColor="transparent"
                                xAxisColor="rgba(56, 189, 248, 0.25)"
                                rulesColor="rgba(56, 189, 248, 0.1)"
                                rulesType="dashed"
                                yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                hideYAxisText
                                dataPointsRadius={4}
                                dataPointsColor={colors.accent.default}
                                curved
                                startFillColor={colors.accent.default}
                                endFillColor="rgba(0, 0, 0, 0.01)"
                                startOpacity={0.35}
                                endOpacity={0.02}
                                areaChart
                                noOfSections={3}
                                pointerConfig={{
                                    pointerStripColor: 'rgba(56, 189, 248, 0.5)',
                                    pointerStripWidth: 2,
                                    pointerColor: colors.accent.default,
                                    radius: 5,
                                    pointerLabelWidth: 85,
                                    pointerLabelHeight: 34,
                                    activatePointersOnLongPress: false,
                                    autoAdjustPointerLabelPosition: true,
                                    pointerLabelComponent: items => (
                                        <View style={styles.chartTooltip}>
                                            <Text style={styles.chartTooltipVal}>
                                                {items[0].value} {chartMeta.unit}
                                            </Text>
                                            <Text style={styles.chartTooltipSub}>Cursă #{items[0].cursa}</Text>
                                        </View>
                                    ),
                                }}
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

                {/* ── Ask AI Engineer Button ───────────────────────── */}
                <TouchableOpacity
                    style={styles.aiAskBtn}
                    onPress={() => {
                        const rec = explanation?.recommendation || explanation?.conclusion || '';
                        const q = `Sunt în ecranul de detalii pentru subsistemul "${t(`detail.systems.${system}`)}" al vehiculului. Sistemul indică: "${rec}". Ce diagnoză aprofundată și verificări la fața locului recomanzi?`;
                        getRootNavigation(navigation)?.navigate('AIExpert', { initialPrompt: q });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Întreabă Inginerul AI despre acest subsistem"
                >
                    <Text style={styles.aiAskBtnText}>✨ Întreabă Inginerul AI despre acest subsistem</Text>
                </TouchableOpacity>

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
        fontVariant: ['tabular-nums'],
    },
    factorImpact: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    chartMetricBadge: {
        backgroundColor: colors.accent.default + '18',
        borderRadius: radii.full,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: colors.accent.default + '40',
    },
    chartMetricBadgeText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.accent.default,
    },
    chartStatsRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    chartStatCard: {
        flex: 1,
        backgroundColor: colors.bg[2],
        borderRadius: radii.sm,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    chartStatLbl: {
        fontSize: 8,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    chartStatVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    chartStatUnit: {
        fontSize: 8,
        fontWeight: typography.weights.regular,
        color: colors.text.secondary,
    },
    chartTooltip: {
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderColor: colors.border.default,
        borderWidth: 1,
        alignItems: 'center',
    },
    chartTooltipVal: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        color: colors.accent.default,
        fontVariant: ['tabular-nums'],
    },
    chartTooltipSub: {
        fontSize: 8,
        color: colors.text.secondary,
        marginTop: 1,
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
        fontVariant: ['tabular-nums'],
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
    aiAskBtn: {
        marginTop: spacing[4],
        backgroundColor: colors.accent.default + '18',
        borderWidth: 1,
        borderColor: colors.accent.default,
        borderRadius: radii.sm,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiAskBtnText: {
        color: colors.accent.default,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
    },
});

export default SubsystemDetailScreen;

SubsystemDetailScreen.propTypes = {
    route: PropTypes.shape({ params: PropTypes.shape({ system: PropTypes.string, vin: PropTypes.string }) }).isRequired,
    navigation: PropTypes.object.isRequired,
};
