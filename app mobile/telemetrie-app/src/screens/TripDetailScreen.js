import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';

const TripDetailScreen = ({ tripId, onBack }) => {
    const { width: screenWidth } = useWindowDimensions();
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
        RPM:   { key: 'rpm',   label: 'Turație (RPM)',       color: colors.accent.default,  field: 'rpm' },
        SPEED: { key: 'speed', label: 'Viteză (km/h)',        color: colors.status.good,     field: 'speed' },
        TEMP:  { key: 'temp',  label: 'Temp. Lichid (°C)',    color: colors.status.critical, field: 'coolant_temp' },
        BOOST: { key: 'boost', label: 'Presiune Turbo (kPa)', color: colors.status.monitor,  field: 'boost_pressure' },
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

    const chartWidth = screenWidth - layout.screenPaddingH * 2 - spacing[8];

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.accent.default} />
                <Text style={styles.loadingText}>Se încarcă detaliile cursei...</Text>
            </View>
        );
    }

    if (!trip) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.errorText}>Nu s-au putut încărca datele cursei.</Text>
                <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                    <Text style={styles.backBtnText}>{t('detail.back')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const chartData = getChartData();
    const chartConfig = CHART_CONFIGS[activeChart];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>{t('detail.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cursa #{tripId}</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing[10] }} showsVerticalScrollIndicator={false}>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>REZUMAT</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Start</Text>
                        <Text style={styles.infoValue}>{formatDate(trip.timestamp_start)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Sfârșit</Text>
                        <Text style={styles.infoValue}>{formatDate(trip.timestamp_end)}</Text>
                    </View>
                    <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Text style={styles.infoLabel}>Durată</Text>
                        <Text style={styles.infoValue}>{getDuration()}</Text>
                    </View>
                </View>

                <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}>
                        <Text style={[styles.metricValue, styles.tabular]}>{(trip.km_parcursi || 0).toFixed(1)}</Text>
                        <Text style={styles.metricLabel}>km</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={[styles.metricValue, styles.tabular]}>{(trip.consum_total_l || 0).toFixed(1)}</Text>
                        <Text style={styles.metricLabel}>litri</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={[styles.metricValue, styles.tabular]}>{trip.consum_mediu_100km || 0}</Text>
                        <Text style={styles.metricLabel}>L/100km</Text>
                    </View>
                    <View style={styles.metricBox}>
                        <Text style={[styles.metricValue, styles.tabular, { color: getSubsystemColor(trip.scor_eco || 100) }]}>
                            {trip.scor_eco || 100}
                        </Text>
                        <Text style={styles.metricLabel}>Eco Score</Text>
                    </View>
                </View>

                {analiza && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>ANALIZĂ AI</Text>
                        {analiza.health_score != null && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Health Score</Text>
                                <Text style={[styles.infoValue, styles.tabular, { color: getSubsystemColor(analiza.health_score), fontWeight: typography.weights.heavy }]}>
                                    {analiza.health_score}%
                                </Text>
                            </View>
                        )}
                        {analiza.ai?.diagnostics && analiza.ai.diagnostics.length > 0 && (
                            <View style={{ marginTop: spacing[2] + 2 }}>
                                <Text style={styles.subLabel}>Diagnostice:</Text>
                                {analiza.ai.diagnostics.slice(0, 4).map((diag, i) => (
                                    <View key={i} style={styles.diagItem}>
                                        <Text style={styles.diagText}>{diag.issue || diag.component}</Text>
                                        {diag.confidence && <Text style={[styles.diagConf, styles.tabular]}>{diag.confidence}%</Text>}
                                    </View>
                                ))}
                            </View>
                        )}
                        {analiza.ai?.intelligence?.predictions && analiza.ai.intelligence.predictions.length > 0 && (
                            <View style={{ marginTop: spacing[2] + 2 }}>
                                <Text style={styles.subLabel}>Predicții:</Text>
                                {analiza.ai.intelligence.predictions.slice(0, 3).map((pred, i) => (
                                    <View key={i} style={styles.diagItem}>
                                        <Text style={styles.diagText}>{pred.component}: {pred.prediction}</Text>
                                        <Text style={[styles.diagConf, styles.tabular, { color: pred.severity === 'HIGH' ? colors.status.critical : colors.status.monitor }]}>
                                            {pred.probability}%
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {graficData.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>TELEMETRIE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                            {Object.entries(CHART_CONFIGS).map(([key, cfg]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.chartTab, activeChart === key && { backgroundColor: cfg.color }]}
                                    onPress={() => setActiveChart(key)}
                                >
                                    <Text style={[styles.chartTabText, activeChart === key && { color: '#FFFFFF' }]}>{cfg.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {chartData.length > 0 ? (
                            <View style={{ alignItems: 'center' }}>
                                <LineChart
                                    data={chartData}
                                    width={chartWidth}
                                    height={180}
                                    color={chartConfig.color}
                                    thickness={2}
                                    hideDataPoints
                                    yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                    xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                                    rulesColor={colors.border.subtle}
                                    backgroundColor={colors.bg[0]}
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
                            <Text style={styles.chartNoData}>
                                Nu sunt date disponibile pentru acest parametru.
                            </Text>
                        )}
                        <Text style={styles.chartFooter}>{graficData.length} puncte înregistrate</Text>
                    </View>
                )}

                {alerte.length > 0 && (
                    <View style={styles.card}>
                        <Text style={[styles.cardTitle, { color: colors.status.critical }]}>ALERTE ({alerte.length})</Text>
                        {alerte.slice(0, 10).map((a, i) => (
                            <View key={i} style={styles.alertItem}>
                                <View style={[styles.alertDot, { backgroundColor: a.severitate === 'CRITICAL' ? colors.status.critical : colors.status.monitor }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.alertText}>{a.descriere || a.tip}</Text>
                                    <Text style={styles.alertMeta}>{a.parametru}: {a.valoare} (limita: {a.limita})</Text>
                                </View>
                            </View>
                        ))}
                        {alerte.length > 10 && (
                            <Text style={styles.alertMore}>
                                ...și încă {alerte.length - 10} alerte
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
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    headerTitle: {
        color: colors.text.primary,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
    },
    backBtn: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2],
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    backBtnText: {
        color: colors.accent.default,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
    scroll: {
        flex: 1,
        paddingHorizontal: layout.screenPaddingH,
    },
    loadingText: {
        color: colors.text.secondary,
        marginTop: spacing[4],
    },
    errorText: {
        color: colors.status.critical,
        fontSize: typography.sizes.body2,
        marginBottom: spacing[5],
    },
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        marginTop: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    cardTitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        marginBottom: spacing[3],
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[1] + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    infoRowLast: {
        borderBottomWidth: 0,
    },
    infoLabel: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label1,
    },
    infoValue: {
        color: colors.text.primary,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
    },
    subLabel: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        marginBottom: spacing[1] + 2,
    },
    metricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing[3],
    },
    metricBox: {
        flex: 1,
        backgroundColor: colors.bg[1],
        borderRadius: radii.sm,
        padding: spacing[3],
        alignItems: 'center',
        marginHorizontal: 3,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    metricValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    metricLabel: {
        fontSize: typography.sizes.micro - 1,
        color: colors.text.secondary,
        marginTop: spacing[1],
        fontWeight: typography.weights.bold,
    },
    diagItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[1] + 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    diagText: {
        color: colors.text.primary,
        fontSize: typography.sizes.label2,
        flex: 1,
        marginRight: spacing[2] + 2,
    },
    diagConf: {
        color: colors.accent.default,
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
    },
    chartTab: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        backgroundColor: colors.bg[2],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginRight: spacing[2],
    },
    chartTabText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },
    chartNoData: {
        color: colors.text.secondary,
        textAlign: 'center',
        padding: spacing[5],
        fontSize: typography.sizes.label1,
    },
    chartFooter: {
        color: colors.text.disabled,
        fontSize: typography.sizes.micro,
        textAlign: 'center',
        marginTop: spacing[2],
    },
    alertItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing[2] + 2,
    },
    alertDot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
        marginTop: spacing[1],
    },
    alertText: {
        color: colors.text.primary,
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
    alertMeta: {
        color: colors.text.secondary,
        fontSize: typography.sizes.micro,
        marginTop: spacing[1] - 2,
    },
    alertMore: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        marginTop: spacing[2],
    },
});

export default TripDetailScreen;
