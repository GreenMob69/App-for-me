import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import api from '../services/api';

const { width } = Dimensions.get('window');

const getHealthColor = (score) => {
    if (score >= 90) return '#3fb950';
    if (score >= 75) return '#7ee787';
    if (score >= 60) return '#d29922';
    if (score >= 40) return '#f0883e';
    return '#f85149';
};

const getInsightStyle = (type) => {
    switch (type) {
        case 'POSITIVE': return { bg: 'rgba(63, 185, 80, 0.08)', border: '#238636', text: '#3fb950' };
        case 'WARNING': return { bg: 'rgba(210, 153, 34, 0.08)', border: '#d29922', text: '#d29922' };
        case 'NEGATIVE': return { bg: 'rgba(248, 81, 73, 0.08)', border: '#da3633', text: '#f85149' };
        default: return { bg: 'rgba(88, 166, 255, 0.08)', border: '#1f6feb', text: '#58a6ff' };
    }
};

const getDrivingRank = (ecoScore, aggressivePct) => {
    if (ecoScore >= 90 && aggressivePct < 10) return { label: 'Eco Master', color: '#3fb950' };
    if (ecoScore >= 75) return { label: 'Eficient', color: '#7ee787' };
    if (aggressivePct > 30) return { label: 'Agresiv', color: '#f85149' };
    return { label: 'Moderat', color: '#d29922' };
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
                <ActivityIndicator size="large" color="#58a6ff" />
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
    const rank = getDrivingRank(stats.ecoScore, driving.aggressivePct);

    // Arc gauge
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
            <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation?.goBack()}>
                    <Text style={styles.headerBack}>← Înapoi</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Raport Cursă</Text>
                <Text style={styles.headerTrip}>#{report.tripId}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* HEALTH GAUGE */}
                <View style={styles.gaugeSection}>
                    <View style={{ width: gaugeSize, height: gaugeSize * 0.55, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Svg width={gaugeSize} height={gaugeSize * 0.55} style={{ position: 'absolute', top: 0 }}>
                            <Path d={describeArc(startAngle, 2 * Math.PI)} stroke="#21262d" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                            <Path d={describeArc(startAngle, progressAngle)} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
                        </Svg>
                        <View style={styles.gaugeCenter}>
                            <Text style={[styles.gaugeScore, { color }]}>{healthScore}</Text>
                            <Text style={styles.gaugePercent}>%</Text>
                        </View>
                    </View>
                    <Text style={styles.gaugeLabel}>Health Score</Text>

                    {/* Rank badge */}
                    <View style={[styles.rankBadge, { borderColor: rank.color }]}>
                        <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
                    </View>
                </View>

                {/* SUB-SCORES */}
                <View style={styles.section}>
                    <ScoreBar label="Motor" score={scores.engine} color={getHealthColor(scores.engine)} />
                    <ScoreBar label="Combustibil" score={scores.fuel} color={getHealthColor(scores.fuel)} />
                    <ScoreBar label="Stil Condus" score={scores.driving} color={getHealthColor(scores.driving)} />
                    <ScoreBar label="Siguranță" score={scores.safety} color={getHealthColor(scores.safety)} />
                </View>

                {/* STATISTICI CURSĂ */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.distanceKm}</Text>
                        <Text style={styles.statUnit}>km</Text>
                        <Text style={styles.statLabel}>Distanță</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.durationMin}</Text>
                        <Text style={styles.statUnit}>min</Text>
                        <Text style={styles.statLabel}>Durată</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.consumptionPer100}</Text>
                        <Text style={styles.statUnit}>L/100km</Text>
                        <Text style={styles.statLabel}>Consum</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.costRON}</Text>
                        <Text style={styles.statUnit}>RON</Text>
                        <Text style={styles.statLabel}>Cost</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{stats.co2Kg}</Text>
                        <Text style={styles.statUnit}>kg CO₂</Text>
                        <Text style={styles.statLabel}>Emisii</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, { color: stats.ecoScore >= 80 ? '#3fb950' : '#d29922' }]}>{stats.ecoScore}</Text>
                        <Text style={styles.statUnit}>puncte</Text>
                        <Text style={styles.statLabel}>Eco Score</Text>
                    </View>
                </View>

                {/* DRIVING STYLE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Stil de Condus</Text>
                    <View style={styles.drivingBars}>
                        <View style={styles.drivingRow}>
                            <Text style={styles.drivingLabel}>Fluent</Text>
                            <View style={styles.drivingBarBg}>
                                <View style={[styles.drivingBarFill, { width: `${driving.smoothPct}%`, backgroundColor: '#3fb950' }]} />
                            </View>
                            <Text style={styles.drivingPct}>{Math.round(driving.smoothPct)}%</Text>
                        </View>
                        <View style={styles.drivingRow}>
                            <Text style={styles.drivingLabel}>Economic</Text>
                            <View style={styles.drivingBarBg}>
                                <View style={[styles.drivingBarFill, { width: `${driving.economicPct}%`, backgroundColor: '#58a6ff' }]} />
                            </View>
                            <Text style={styles.drivingPct}>{Math.round(driving.economicPct)}%</Text>
                        </View>
                        <View style={styles.drivingRow}>
                            <Text style={styles.drivingLabel}>Agresiv</Text>
                            <View style={styles.drivingBarBg}>
                                <View style={[styles.drivingBarFill, { width: `${driving.aggressivePct}%`, backgroundColor: '#f85149' }]} />
                            </View>
                            <Text style={styles.drivingPct}>{Math.round(driving.aggressivePct)}%</Text>
                        </View>
                    </View>
                    {(driving.hardBrakes > 0 || driving.hardAccelerations > 0 || driving.overspeeds > 0) && (
                        <View style={styles.eventsRow}>
                            {driving.hardBrakes > 0 && <Text style={styles.eventBadge}>Frânări: {driving.hardBrakes}</Text>}
                            {driving.hardAccelerations > 0 && <Text style={styles.eventBadge}>Accelerări: {driving.hardAccelerations}</Text>}
                            {driving.overspeeds > 0 && <Text style={styles.eventBadge}>Depășiri: {driving.overspeeds}</Text>}
                        </View>
                    )}
                </View>

                {/* INSIGHTS */}
                {insights && insights.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Observații</Text>
                        {insights.map((insight, idx) => {
                            const style = getInsightStyle(insight.type);
                            return (
                                <View key={idx} style={[styles.insightCard, { backgroundColor: style.bg, borderColor: style.border }]}>
                                    <Text style={[styles.insightIcon, { color: style.text }]}>{insight.icon}</Text>
                                    <Text style={[styles.insightText, { color: style.text }]}>{insight.text}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* PREDICTIONS */}
                {predictions && predictions.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Predicții Active</Text>
                        {predictions.map((pred, idx) => (
                            <View key={idx} style={styles.predCard}>
                                <View style={styles.predHeader}>
                                    <Text style={styles.predComponent}>{pred.component}</Text>
                                    <Text style={[styles.predSeverity, { color: pred.severity === 'HIGH' ? '#f85149' : '#d29922' }]}>{pred.probability}%</Text>
                                </View>
                                <Text style={styles.predRecommendation}>{pred.recommendation}</Text>
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
        padding: 40,
    },
    loadingText: { color: '#8b949e', marginTop: 12, fontSize: 14 },
    errorText: { color: '#8b949e', fontSize: 14, marginBottom: 16 },
    backBtn: { backgroundColor: '#21262d', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
    backBtnText: { color: '#58a6ff', fontWeight: '600' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomColor: '#21262d',
        borderBottomWidth: 1,
    },
    headerBack: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },
    headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    headerTrip: { color: '#8b949e', fontSize: 13 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
    gaugeSection: { alignItems: 'center', marginBottom: 20 },
    gaugeCenter: { flexDirection: 'row', alignItems: 'baseline' },
    gaugeScore: { fontSize: 44, fontWeight: '900' },
    gaugePercent: { fontSize: 18, fontWeight: '700', color: '#8b949e', marginLeft: 2 },
    gaugeLabel: { fontSize: 12, color: '#8b949e', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 },
    rankBadge: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5 },
    rankText: { fontSize: 13, fontWeight: '700' },
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: '#c9d1d9', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    scoreBarContainer: { marginBottom: 10 },
    scoreBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    scoreBarLabel: { fontSize: 13, color: '#c9d1d9' },
    scoreBarValue: { fontSize: 13, fontWeight: '800' },
    scoreBarBg: { height: 6, backgroundColor: '#21262d', borderRadius: 3, overflow: 'hidden' },
    scoreBarFill: { height: 6, borderRadius: 3 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    statCard: {
        width: '31%',
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        marginBottom: 8,
        borderColor: '#30363d',
        borderWidth: 1,
    },
    statValue: { fontSize: 20, fontWeight: '900', color: '#ffffff' },
    statUnit: { fontSize: 10, color: '#8b949e', marginTop: 2 },
    statLabel: { fontSize: 10, color: '#8b949e', marginTop: 4, fontWeight: '600' },
    drivingBars: { marginBottom: 10 },
    drivingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    drivingLabel: { fontSize: 12, color: '#c9d1d9', width: 70 },
    drivingBarBg: { flex: 1, height: 6, backgroundColor: '#21262d', borderRadius: 3, overflow: 'hidden', marginHorizontal: 10 },
    drivingBarFill: { height: 6, borderRadius: 3 },
    drivingPct: { fontSize: 12, color: '#8b949e', fontWeight: '600', width: 35, textAlign: 'right' },
    eventsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    eventBadge: { fontSize: 11, color: '#f85149', backgroundColor: 'rgba(248, 81, 73, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
    insightCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
    },
    insightIcon: { fontSize: 14, fontWeight: '700', marginRight: 10, marginTop: 1 },
    insightText: { fontSize: 13, flex: 1, lineHeight: 19 },
    predCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderColor: '#30363d',
        borderWidth: 1,
        marginBottom: 8,
    },
    predHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    predComponent: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
    predSeverity: { fontSize: 14, fontWeight: '800' },
    predRecommendation: { fontSize: 12, color: '#8b949e', lineHeight: 17 },
});

export default TripReportScreen;
