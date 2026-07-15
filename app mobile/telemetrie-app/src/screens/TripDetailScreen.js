import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';

const { width } = Dimensions.get('window');

const TripDetailScreen = ({ tripId, onBack }) => {
    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState(null);
    const [alerte, setAlerte] = useState([]);
    const [graficData, setGraficData] = useState([]);
    const [analiza, setAnaliza] = useState(null);
    const [activeChart, setActiveChart] = useState('RPM');

    useEffect(() => {
        const load = async () => {
            try {
                const [detailRes, analizaRes] = await Promise.allSettled([
                    api.get(`/calatorii/${tripId}`),
                    api.get(`/calatorii/${tripId}/analiza`)
                ]);

                if (detailRes.status === 'fulfilled' && detailRes.value.data) {
                    const d = detailRes.value.data;
                    setTrip(d.rezumat);
                    setAlerte(d.alerte || []);
                    setGraficData(d.date_grafic || []);
                }

                if (analizaRes.status === 'fulfilled' && analizaRes.value.data) {
                    setAnaliza(analizaRes.value.data);
                }
            } catch (e) {
                console.error('[TripDetail] Eroare:', e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tripId]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '—';
        const d = new Date(timestamp);
        return `${d.toLocaleDateString('ro-RO')} ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const getDuration = () => {
        if (!trip?.timestamp_start || !trip?.timestamp_end) return '—';
        const sec = Math.round((trip.timestamp_end - trip.timestamp_start) / 1000);
        const min = Math.floor(sec / 60);
        const hrs = Math.floor(min / 60);
        if (hrs > 0) return `${hrs}h ${min % 60}m`;
        return `${min}m ${sec % 60}s`;
    };

    const CHART_CONFIGS = {
        RPM: { key: 'rpm', label: 'Turație (RPM)', color: '#58a6ff', field: 'rpm' },
        SPEED: { key: 'speed', label: 'Viteză (km/h)', color: '#3fb950', field: 'speed' },
        TEMP: { key: 'temp', label: 'Temp. Lichid (C)', color: '#f85149', field: 'coolant_temp' },
        BOOST: { key: 'boost', label: 'Presiune Turbo (kPa)', color: '#d29922', field: 'boost_pressure' },
    };

    const getChartData = () => {
        const config = CHART_CONFIGS[activeChart];
        if (!graficData.length) return [];

        const step = Math.max(1, Math.floor(graficData.length / 80));
        const points = [];
        for (let i = 0; i < graficData.length; i += step) {
            const row = graficData[i];
            const val = parseFloat(row?.[config.field] || row?.motor?.[config.field] || row?.motor?.rpm || 0);
            points.push({ value: isNaN(val) ? 0 : val });
        }
        return points;
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={styles.loadingText}>Se incarca detaliile cursei...</Text>
            </View>
        );
    }

    if (!trip) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.errorText}>Nu s-au putut incarca datele cursei.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>Inapoi</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const chartData = getChartData();
    const chartConfig = CHART_CONFIGS[activeChart];

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>Inapoi</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cursa #{tripId}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* INFO CARD */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>REZUMAT</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Start</Text>
                        <Text style={styles.infoValue}>{formatDate(trip.timestamp_start)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Sfarsit</Text>
                        <Text style={styles.infoValue}>{formatDate(trip.timestamp_end)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Durata</Text>
                        <Text style={styles.infoValue}>{getDuration()}</Text>
                    </View>
                </View>

                {/* METRICS GRID */}
                <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{(trip.km_parcursi || 0).toFixed(1)}</Text>
                        <Text style={styles.metricLabel}>km</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{(trip.consum_total_l || 0).toFixed(1)}</Text>
                        <Text style={styles.metricLabel}>litri</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>{trip.consum_mediu_100km || 0}</Text>
                        <Text style={styles.metricLabel}>L/100km</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={[styles.metricValue, { color: (trip.scor_eco || 100) >= 80 ? '#3fb950' : '#f85149' }]}>
                            {trip.scor_eco || 100}
                        </Text>
                        <Text style={styles.metricLabel}>Eco Score</Text>
                    </View>
                </View>

                {/* ANALIZA AI */}
                {analiza && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>ANALIZA AI</Text>
                        {analiza.health_score != null && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Health Score</Text>
                                <Text style={[styles.infoValue, { color: analiza.health_score >= 80 ? '#3fb950' : '#d29922', fontWeight: '900' }]}>
                                    {analiza.health_score}%
                                </Text>
                            </View>
                        )}
                        {analiza.ai?.diagnostics && analiza.ai.diagnostics.length > 0 && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.subLabel}>Diagnostice:</Text>
                                {analiza.ai.diagnostics.slice(0, 4).map((diag, i) => (
                                    <View key={i} style={styles.diagItem}>
                                        <Text style={styles.diagText}>{diag.issue || diag.component}</Text>
                                        {diag.confidence && <Text style={styles.diagConf}>{diag.confidence}%</Text>}
                                    </View>
                                ))}
                            </View>
                        )}
                        {analiza.ai?.intelligence?.predictions && analiza.ai.intelligence.predictions.length > 0 && (
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.subLabel}>Predictii:</Text>
                                {analiza.ai.intelligence.predictions.slice(0, 3).map((pred, i) => (
                                    <View key={i} style={styles.diagItem}>
                                        <Text style={styles.diagText}>{pred.component}: {pred.prediction}</Text>
                                        <Text style={[styles.diagConf, { color: pred.severity === 'HIGH' ? '#f85149' : '#d29922' }]}>
                                            {pred.probability}%
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* GRAFIC TELEMETRIE */}
                {graficData.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>TELEMETRIE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                            {Object.entries(CHART_CONFIGS).map(([key, cfg]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.chartTab, activeChart === key && { backgroundColor: cfg.color }]}
                                    onPress={() => setActiveChart(key)}
                                >
                                    <Text style={[styles.chartTabText, activeChart === key && { color: '#fff' }]}>{cfg.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {chartData.length > 0 ? (
                            <View style={{ alignItems: 'center' }}>
                                <LineChart
                                    data={chartData}
                                    width={width - 80}
                                    height={180}
                                    color={chartConfig.color}
                                    thickness={2}
                                    hideDataPoints
                                    yAxisTextStyle={{ color: '#8b949e', fontSize: 10 }}
                                    xAxisLabelTextStyle={{ color: '#8b949e', fontSize: 9 }}
                                    rulesColor="#21262d"
                                    backgroundColor="#0d1117"
                                    noOfSections={4}
                                    curved
                                    startFillColor={chartConfig.color}
                                    endFillColor="transparent"
                                    startOpacity={0.2}
                                    endOpacity={0}
                                    areaChart
                                />
                            </View>
                        ) : (
                            <Text style={{ color: '#8b949e', textAlign: 'center', padding: 20 }}>
                                Nu sunt date disponibile pentru acest parametru.
                            </Text>
                        )}
                        <Text style={styles.chartFooter}>{graficData.length} puncte inregistrate</Text>
                    </View>
                )}

                {/* ALERTE */}
                {alerte.length > 0 && (
                    <View style={styles.card}>
                        <Text style={[styles.cardTitle, { color: '#f85149' }]}>ALERTE ({alerte.length})</Text>
                        {alerte.slice(0, 10).map((a, i) => (
                            <View key={i} style={styles.alertItem}>
                                <View style={[styles.alertDot, { backgroundColor: a.severitate === 'CRITICAL' ? '#f85149' : '#d29922' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.alertText}>{a.descriere || a.tip}</Text>
                                    <Text style={styles.alertMeta}>{a.parametru}: {a.valoare} (limita: {a.limita})</Text>
                                </View>
                            </View>
                        ))}
                        {alerte.length > 10 && (
                            <Text style={{ color: '#8b949e', fontSize: 11, marginTop: 8 }}>
                                ...si inca {alerte.length - 10} alerte
                            </Text>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#21262d',
    },
    headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    backBtn: { backgroundColor: '#21262d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },
    backBtnText: { color: '#58a6ff', fontWeight: '700', fontSize: 12 },
    scroll: { flex: 1, paddingHorizontal: 16 },
    loadingText: { color: '#8b949e', marginTop: 15 },
    errorText: { color: '#f85149', fontSize: 14, marginBottom: 20 },

    card: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    cardTitle: { fontSize: 11, color: '#c9d1d9', fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    infoLabel: { color: '#8b949e', fontSize: 13 },
    infoValue: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    subLabel: { color: '#8b949e', fontSize: 11, fontWeight: '700', marginBottom: 6 },

    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    metricBox: {
        flex: 1,
        backgroundColor: '#161b22',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    metricValue: { fontSize: 18, fontWeight: '900', color: '#ffffff' },
    metricLabel: { fontSize: 9, color: '#8b949e', marginTop: 4, fontWeight: '700' },

    diagItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    diagText: { color: '#c9d1d9', fontSize: 12, flex: 1, marginRight: 10 },
    diagConf: { color: '#58a6ff', fontSize: 12, fontWeight: '700' },

    chartTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#21262d',
        borderWidth: 1,
        borderColor: '#30363d',
        marginRight: 8,
    },
    chartTabText: { color: '#8b949e', fontSize: 11, fontWeight: '600' },
    chartFooter: { color: '#484f58', fontSize: 10, textAlign: 'center', marginTop: 8 },

    alertItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#21262d', gap: 10 },
    alertDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
    alertText: { color: '#c9d1d9', fontSize: 12, fontWeight: '600' },
    alertMeta: { color: '#8b949e', fontSize: 10, marginTop: 2 },
});

export default TripDetailScreen;
