import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, ActivityIndicator, Animated } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';
import { t } from '../i18n';
import { buildDetailExplanation } from '../engine/MessageEngine';

const SubsystemDetailScreen = ({ route, navigation }) => {
    const { system, vin } = route.params;
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
                duration: 400,
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
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#58a6ff" />
            </View>
        );
    }

    if (!data) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.noDataText}>{t('detail.noData')}</Text>
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

            {/* Header */}
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
                {/* 1. CONCLUZIA */}
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

                {/* 2. DE CE */}
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

                {/* 3. EVOLUTIE IN TIMP */}
                {hasChart && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.evolutionLabel')}</Text>
                        <View style={styles.chartContainer}>
                            <LineChart
                                data={chartData}
                                width={280}
                                height={100}
                                spacing={280 / Math.max(chartData.length - 1, 1)}
                                color="#58a6ff"
                                thickness={2}
                                hideRules
                                yAxisColor="transparent"
                                xAxisColor="#30363d"
                                yAxisTextStyle={{ color: '#8b949e', fontSize: 9 }}
                                xAxisLabelTextStyle={{ color: '#8b949e', fontSize: 9 }}
                                hideYAxisText
                                dataPointsRadius={3}
                                dataPointsColor="#58a6ff"
                                curved
                                startFillColor="rgba(88, 166, 255, 0.12)"
                                endFillColor="rgba(88, 166, 255, 0.01)"
                                areaChart
                                noOfSections={3}
                            />
                        </View>
                    </View>
                )}

                {/* 4. BASELINE */}
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

                {/* 5. CORELATII — doar daca ajuta */}
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

                {/* 6. RECOMANDARE */}
                {explanation && explanation.recommendation && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>{t('detail.recommendationLabel')}</Text>
                        <View style={styles.recommendationBox}>
                            <Text style={styles.recommendationText}>{explanation.recommendation}</Text>
                        </View>
                    </View>
                )}

                {/* NIVEL 3: Date tehnice — progressive disclosure */}
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
                                            <Text style={styles.diagProb}>{diag.probability}%</Text>
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
                                                        backgroundColor: sq.quality >= 85 ? '#3fb950' : sq.quality >= 60 ? '#d29922' : '#f85149',
                                                    }]} />
                                                </View>
                                                <Text style={styles.sensorPct}>{sq.quality}%</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </Animated.ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 44,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noDataText: {
        color: '#8b949e',
        fontSize: 14,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomColor: '#21262d',
        borderBottomWidth: 1,
    },
    backBtn: {
        marginRight: 12,
        paddingVertical: 4,
    },
    backText: {
        color: '#58a6ff',
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b949e',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    conclusionText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#ffffff',
        lineHeight: 22,
    },
    qualityHint: {
        fontSize: 11,
        color: '#8b949e',
        marginTop: 8,
    },
    qualityWarn: {
        color: '#d29922',
    },
    factorsList: {
        gap: 10,
    },
    factorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    factorDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#58a6ff',
        marginTop: 6,
        marginRight: 10,
    },
    factorContent: {
        flex: 1,
    },
    factorParam: {
        fontSize: 13,
        color: '#c9d1d9',
        lineHeight: 19,
    },
    factorValue: {
        fontWeight: '600',
        color: '#ffffff',
    },
    factorImpact: {
        fontSize: 12,
        color: '#8b949e',
        marginTop: 2,
    },
    chartContainer: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    baselineList: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#30363d',
        gap: 8,
    },
    baselineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    baselineParam: {
        fontSize: 13,
        color: '#c9d1d9',
        textTransform: 'capitalize',
    },
    baselineValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8b949e',
    },
    baselineDeviation: {
        color: '#d29922',
    },
    correlationCard: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#30363d',
        marginBottom: 8,
    },
    correlationPair: {
        fontSize: 13,
        fontWeight: '600',
        color: '#c9d1d9',
        marginBottom: 4,
    },
    correlationMessage: {
        fontSize: 12,
        color: '#8b949e',
        lineHeight: 17,
    },
    recommendationBox: {
        backgroundColor: 'rgba(63,185,80,0.06)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(63,185,80,0.2)',
    },
    recommendationText: {
        fontSize: 14,
        color: '#c9d1d9',
        lineHeight: 20,
    },
    technicalSection: {
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#21262d',
        paddingTop: 16,
    },
    technicalToggle: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    technicalToggleText: {
        fontSize: 12,
        color: '#58a6ff',
        fontWeight: '600',
    },
    technicalContent: {
        marginTop: 12,
        gap: 8,
    },
    diagCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    diagTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 6,
    },
    diagMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    diagProb: {
        fontSize: 11,
        fontWeight: '700',
        color: '#58a6ff',
    },
    diagTrend: {
        fontSize: 11,
        color: '#8b949e',
    },
    diagFactor: {
        fontSize: 11,
        color: '#8b949e',
        lineHeight: 16,
    },
    sensorSection: {
        marginTop: 8,
    },
    sensorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    },
    sensorName: {
        fontSize: 11,
        color: '#c9d1d9',
        width: 80,
    },
    sensorBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: '#21262d',
        borderRadius: 2,
        overflow: 'hidden',
        marginHorizontal: 8,
    },
    sensorBarFill: {
        height: 4,
        borderRadius: 2,
    },
    sensorPct: {
        fontSize: 10,
        color: '#8b949e',
        fontWeight: '600',
        width: 30,
        textAlign: 'right',
    },
});

export default SubsystemDetailScreen;
