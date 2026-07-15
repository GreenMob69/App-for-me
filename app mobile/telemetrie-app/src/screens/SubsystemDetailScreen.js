import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';

const SYSTEM_LABELS = {
    motor: 'Motor & Răcire',
    electric: 'Sistem Electric',
    turbo: 'Turbosuflantă',
    combustibil: 'Combustibil & Emisii',
    stil_condus: 'Stil de Condus',
};

const SYSTEM_ICONS = {
    motor: '⚙',
    electric: '⚡',
    turbo: '🌀',
    combustibil: '⛽',
    stil_condus: '🛣',
};

const getReliabilityColor = (grade) => {
    if (grade === 'HIGH') return '#3fb950';
    if (grade === 'MEDIUM') return '#d29922';
    return '#f85149';
};

const SubsystemDetailScreen = ({ route, navigation }) => {
    const { system, vin } = route.params;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedDiag, setExpandedDiag] = useState(null);

    useEffect(() => {
        fetchDetail();
    }, [system]);

    const fetchDetail = async () => {
        try {
            const response = await api.get(`/vehicul/${vin}/health/${system}`);
            setData(response.data);
        } catch (err) {
            console.error('[SubsystemDetail] Eroare:', err.message);
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
                <Text style={styles.errorText}>Nu s-au putut încărca datele</Text>
            </View>
        );
    }

    const { diagnostics, reliability, predictions, evolution, baseline, correlations, conflicts, sensorQuality } = data;

    const renderEvolutionChart = () => {
        if (!evolution || evolution.length < 2) return null;

        const chartKey = system === 'electric' ? 'voltaj_min' : system === 'turbo' ? 'boost_mediu' : system === 'motor' ? 'coolant_max' : 'health_score';
        const chartLabel = system === 'electric' ? 'Voltaj (V)' : system === 'turbo' ? 'Boost mediu (bar)' : system === 'motor' ? 'Coolant max (°C)' : 'Health Score (%)';

        const chartData = evolution.map((item, idx) => ({
            value: item[chartKey] || item.health_score || 0,
            label: idx === 0 || idx === evolution.length - 1 ? `#${idx + 1}` : '',
        }));

        return (
            <View style={styles.chartSection}>
                <Text style={styles.chartTitle}>Evoluție: {chartLabel}</Text>
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
                    dataPointsRadius={4}
                    dataPointsColor="#58a6ff"
                    curved
                    startFillColor="rgba(88, 166, 255, 0.12)"
                    endFillColor="rgba(88, 166, 255, 0.01)"
                    areaChart
                    noOfSections={3}
                />
            </View>
        );
    };

    const renderDiagnostic = (diag, idx) => {
        const isExpanded = expandedDiag === idx;
        const rel = reliability?.find(r => r.diagnosis === diag.diagnosis);

        return (
            <TouchableOpacity
                key={idx}
                style={styles.diagCard}
                onPress={() => setExpandedDiag(isExpanded ? null : idx)}
                activeOpacity={0.7}
            >
                <View style={styles.diagHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.diagTitle} numberOfLines={2}>{diag.diagnosis}</Text>
                        <View style={styles.diagBadges}>
                            <View style={[styles.badge, { backgroundColor: 'rgba(88, 166, 255, 0.1)', borderColor: '#58a6ff' }]}>
                                <Text style={[styles.badgeText, { color: '#58a6ff' }]}>{diag.probability}%</Text>
                            </View>
                            {rel && (
                                <View style={[styles.badge, { backgroundColor: 'rgba(63, 185, 80, 0.1)', borderColor: getReliabilityColor(rel.grade) }]}>
                                    <Text style={[styles.badgeText, { color: getReliabilityColor(rel.grade) }]}>{rel.grade}</Text>
                                </View>
                            )}
                            <Text style={styles.diagVerdict}>{diag.verdict || ''}</Text>
                        </View>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </View>

                {isExpanded && (
                    <View style={styles.diagExpanded}>
                        {/* Factori */}
                        {diag.factors && diag.factors.length > 0 && (
                            <View style={styles.factorSection}>
                                <Text style={styles.factorTitle}>Factori contribuitori:</Text>
                                {diag.factors.map((f, fi) => (
                                    <View key={fi} style={styles.factorRow}>
                                        <Text style={styles.factorParam}>{f.parameter}</Text>
                                        <Text style={styles.factorValue}>{f.value}</Text>
                                        {f.deviation && f.deviation.significant && (
                                            <Text style={[styles.factorDeviation, { color: f.deviation.direction === 'DOWN' ? '#f85149' : '#d29922' }]}>
                                                {f.deviation.direction === 'DOWN' ? '↓' : '↑'} {Math.abs(f.deviation.deviationPct)}%
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Trend & Baseline */}
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Trend:</Text>
                            <Text style={[styles.metaValue, diag.trendStatus === 'CONFIRMED' && { color: '#f85149' }]}>
                                {diag.trendStatus === 'CONFIRMED' ? 'Confirmat' : diag.trendStatus === 'STABLE' ? 'Stabil' : 'N/A'}
                            </Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Baseline:</Text>
                            <Text style={styles.metaValue}>
                                {diag.baselineStatus === 'DEVIATION_DETECTED' ? 'Deviație detectată' : diag.baselineStatus === 'WITHIN_NORMAL' ? 'În limite normale' : 'N/A'}
                            </Text>
                        </View>

                        {/* Fiabilitate */}
                        {rel && (
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Fiabilitate diagnoză:</Text>
                                <Text style={[styles.metaValue, { color: getReliabilityColor(rel.grade) }]}>
                                    {rel.reliability}% ({rel.grade})
                                </Text>
                            </View>
                        )}

                        {/* Recomandare din KnowledgeBase */}
                        {diag.rule && diag.rule.recommendations && (
                            <View style={styles.recommendationBox}>
                                <Text style={styles.recommendationTitle}>Recomandare:</Text>
                                <Text style={styles.recommendationText}>{diag.rule.recommendations[0]}</Text>
                            </View>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderPrediction = (pred, idx) => (
        <View key={idx} style={styles.predictionCard}>
            <View style={styles.predHeader}>
                <Text style={styles.predTitle}>{pred.component}</Text>
                <Text style={[styles.predSeverity, { color: pred.severity === 'HIGH' ? '#f85149' : '#d29922' }]}>
                    {pred.severity}
                </Text>
            </View>
            <View style={styles.predBarContainer}>
                <View style={styles.predBarBg}>
                    <View style={[styles.predBarFill, { width: `${pred.probability}%`, backgroundColor: pred.severity === 'HIGH' ? '#da3633' : '#d29922' }]} />
                </View>
                <Text style={styles.predPct}>{pred.probability}%</Text>
            </View>
            <View style={styles.predDetails}>
                <Text style={styles.predDetail}>~{pred.estimatedRemainingKm?.toLocaleString()} km rămași</Text>
                <Text style={styles.predDetail}>Încredere: {pred.confidence}%</Text>
            </View>
            <Text style={styles.predRecommendation}>{pred.recommendation}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

            {/* Header cu back button */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Înapoi</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{SYSTEM_ICONS[system]} {SYSTEM_LABELS[system]}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Baseline info */}
                {baseline && Object.keys(baseline).length > 0 && (
                    <View style={styles.baselineCard}>
                        <Text style={styles.baselineTitle}>Comparație cu normalul învățat</Text>
                        {Object.entries(baseline).map(([key, val]) => (
                            <View key={key} style={styles.baselineRow}>
                                <Text style={styles.baselineLabel}>{key}</Text>
                                <Text style={[styles.baselineValue, { color: val.startsWith('+') ? '#d29922' : val.startsWith('-') ? '#58a6ff' : '#8b949e' }]}>{val}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Diagnostice active */}
                {diagnostics && diagnostics.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Diagnostice Active</Text>
                        {diagnostics.map((d, i) => renderDiagnostic(d, i))}
                    </View>
                )}

                {/* Conflicte / Ambiguitate */}
                {conflicts && conflicts.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Diagnostic Ambiguu</Text>
                        {conflicts.map((c, idx) => (
                            <View key={idx} style={styles.conflictCard}>
                                <Text style={styles.conflictTitle}>{c.symptom}</Text>
                                <Text style={styles.conflictExpl}>{c.explanation}</Text>
                                {c.candidates && c.candidates.map((cand, ci) => (
                                    <Text key={ci} style={styles.conflictCandidate}>
                                        • {cand.cause} ({cand.score} pts)
                                    </Text>
                                ))}
                            </View>
                        ))}
                    </View>
                )}

                {/* Predicții */}
                {predictions && predictions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Predicții</Text>
                        {predictions.map((p, i) => renderPrediction(p, i))}
                    </View>
                )}

                {/* Evoluție chart */}
                {renderEvolutionChart()}

                {/* Calitate senzori */}
                {sensorQuality && sensorQuality.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Calitate Senzori</Text>
                        {sensorQuality.map((sq, idx) => (
                            <View key={idx} style={styles.sensorRow}>
                                <Text style={styles.sensorName}>{sq.sensor}</Text>
                                <View style={styles.sensorBarBg}>
                                    <View style={[styles.sensorBarFill, { width: `${sq.quality}%`, backgroundColor: sq.quality >= 85 ? '#238636' : sq.quality >= 60 ? '#d29922' : '#da3633' }]} />
                                </View>
                                <Text style={styles.sensorPct}>{sq.quality}%</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Corelații anomalii */}
                {correlations && correlations.anomalies && correlations.anomalies.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Anomalii Corelație</Text>
                        {correlations.anomalies.map((a, idx) => (
                            <View key={idx} style={styles.anomalyCard}>
                                <Text style={styles.anomalyPair}>{a.pereche} (r={a.coeficient})</Text>
                                <Text style={styles.anomalyMsg}>{a.mesaj}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
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
        paddingTop: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#c9d1d9',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    baselineCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#30363d',
        borderWidth: 1,
        marginBottom: 16,
    },
    baselineTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8b949e',
        marginBottom: 8,
    },
    baselineRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    baselineLabel: {
        fontSize: 13,
        color: '#c9d1d9',
        textTransform: 'capitalize',
    },
    baselineValue: {
        fontSize: 13,
        fontWeight: '600',
    },
    diagCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#30363d',
        borderWidth: 1,
        marginBottom: 8,
    },
    diagHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    diagTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 6,
    },
    diagBadges: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        marginRight: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    diagVerdict: {
        fontSize: 10,
        color: '#8b949e',
        fontStyle: 'italic',
    },
    expandIcon: {
        color: '#8b949e',
        fontSize: 10,
        marginLeft: 8,
        marginTop: 4,
    },
    diagExpanded: {
        marginTop: 12,
        paddingTop: 12,
        borderTopColor: '#21262d',
        borderTopWidth: 1,
    },
    factorSection: {
        marginBottom: 10,
    },
    factorTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8b949e',
        marginBottom: 6,
    },
    factorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
    },
    factorParam: {
        fontSize: 12,
        color: '#c9d1d9',
        width: 100,
    },
    factorValue: {
        fontSize: 12,
        color: '#ffffff',
        fontWeight: '600',
        flex: 1,
    },
    factorDeviation: {
        fontSize: 11,
        fontWeight: '700',
        marginLeft: 8,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    metaLabel: {
        fontSize: 12,
        color: '#8b949e',
    },
    metaValue: {
        fontSize: 12,
        color: '#c9d1d9',
        fontWeight: '600',
    },
    recommendationBox: {
        backgroundColor: '#0d1117',
        borderRadius: 6,
        padding: 10,
        marginTop: 10,
        borderColor: '#238636',
        borderWidth: 1,
    },
    recommendationTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3fb950',
        marginBottom: 4,
    },
    recommendationText: {
        fontSize: 12,
        color: '#c9d1d9',
        lineHeight: 18,
    },
    predictionCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#30363d',
        borderWidth: 1,
        marginBottom: 8,
    },
    predHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    predTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    predSeverity: {
        fontSize: 10,
        fontWeight: '800',
    },
    predBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    predBarBg: {
        flex: 1,
        height: 5,
        backgroundColor: '#21262d',
        borderRadius: 3,
        overflow: 'hidden',
        marginRight: 8,
    },
    predBarFill: {
        height: 5,
        borderRadius: 3,
    },
    predPct: {
        fontSize: 12,
        fontWeight: '700',
        color: '#c9d1d9',
        minWidth: 30,
        textAlign: 'right',
    },
    predDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    predDetail: {
        fontSize: 11,
        color: '#8b949e',
    },
    predRecommendation: {
        fontSize: 12,
        color: '#8b949e',
        fontStyle: 'italic',
        lineHeight: 17,
    },
    chartSection: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#30363d',
        borderWidth: 1,
        marginBottom: 20,
    },
    chartTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#c9d1d9',
        marginBottom: 10,
    },
    sensorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    sensorName: {
        fontSize: 12,
        color: '#c9d1d9',
        width: 80,
    },
    sensorBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: '#21262d',
        borderRadius: 2,
        overflow: 'hidden',
        marginHorizontal: 10,
    },
    sensorBarFill: {
        height: 4,
        borderRadius: 2,
    },
    sensorPct: {
        fontSize: 11,
        color: '#8b949e',
        fontWeight: '600',
        minWidth: 30,
        textAlign: 'right',
    },
    conflictCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#d29922',
        borderWidth: 1,
        marginBottom: 8,
    },
    conflictTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#d29922',
        marginBottom: 4,
    },
    conflictExpl: {
        fontSize: 12,
        color: '#8b949e',
        marginBottom: 8,
        lineHeight: 17,
    },
    conflictCandidate: {
        fontSize: 12,
        color: '#c9d1d9',
        paddingVertical: 2,
    },
    anomalyCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 12,
        borderColor: '#f85149',
        borderWidth: 1,
        marginBottom: 8,
    },
    anomalyPair: {
        fontSize: 12,
        fontWeight: '700',
        color: '#f85149',
        marginBottom: 4,
    },
    anomalyMsg: {
        fontSize: 12,
        color: '#8b949e',
        lineHeight: 17,
    },
});

export default SubsystemDetailScreen;
