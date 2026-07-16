import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    useWindowDimensions, Platform, StatusBar, Alert, Linking,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import api from '../services/api';
import { t } from '../i18n';
import { getActiveServerUrl } from '../utils/config';
import { colors, typography, radii, spacing, layout } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';
import {
    Skeleton, MetricCard, PredictionCard, SectionHeader, EmptyState,
} from '../components/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.toLocaleDateString('ro-RO')} ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
};

const getDuration = (start, end) => {
    if (!start || !end) return '—';
    const sec = Math.round((end - start) / 1000);
    const min = Math.floor(sec / 60);
    const hrs = Math.floor(min / 60);
    if (hrs > 0) return `${hrs}h ${min % 60}m`;
    return `${min}m ${sec % 60}s`;
};

const predConfidence = (prob) => {
    if (prob >= 80) return 'high';
    if (prob >= 60) return 'medium';
    return 'low';
};

const predStatus = (severity) => {
    if (severity === 'HIGH')   return 'critical';
    if (severity === 'MEDIUM') return 'caution';
    return 'monitor';
};

// ─── Driving Style Bar ────────────────────────────────────────────────────────

const StyleBar = ({ label, pct, color }) => (
    <View style={barStyles.row}>
        <Text style={barStyles.label}>{label}</Text>
        <View style={barStyles.track}>
            <View style={[barStyles.fill, { width: `${Math.min(100, pct || 0)}%`, backgroundColor: color }]} />
        </View>
        <Text style={[barStyles.pct, { color }]}>{Math.round(pct || 0)}%</Text>
    </View>
);

const barStyles = StyleSheet.create({
    row:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2] + 1 },
    label: { width: 80, fontSize: typography.sizes.label2, color: colors.text.secondary },
    track: {
        flex: 1,
        height: 6,
        backgroundColor: colors.border.default,
        borderRadius: radii.full,
        overflow: 'hidden',
        marginHorizontal: spacing[2],
    },
    fill:  { height: 6, borderRadius: radii.full },
    pct:   { width: 36, fontSize: typography.sizes.label2, fontWeight: typography.weights.bold, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

// ─── CHART CONFIGS ────────────────────────────────────────────────────────────

const CHART_CONFIGS = {
    RPM:   { key: 'rpm',   label: 'Turație (RPM)',      color: colors.accent.default,  field: 'rpm' },
    SPEED: { key: 'speed', label: 'Viteză (km/h)',       color: colors.status.good,     field: 'speed' },
    TEMP:  { key: 'temp',  label: 'Temp. Lichid (°C)',   color: colors.status.critical, field: 'temp_apa_c' },
    BOOST: { key: 'boost', label: 'Presiune Turbo (bar)',color: colors.status.monitor,  field: 'boost_bar' },
};

// ─────────────────────────────────────────────────────────────────────────────

const TripDetailScreen = ({ tripId, onBack }) => {
    const { width: screenWidth } = useWindowDimensions();
    const [loading,     setLoading]     = useState(true);
    const [trip,        setTrip]        = useState(null);
    const [alerte,      setAlerte]      = useState([]);
    const [graficData,  setGraficData]  = useState([]);
    const [analiza,     setAnaliza]     = useState(null);
    const [activeChart, setActiveChart] = useState('RPM');
    const [sharing,     setSharing]     = useState(false);

    const exportCSV = useCallback(async () => {
        if (sharing) return;
        setSharing(true);
        try {
            const url = `${getActiveServerUrl()}/api/calatorii/${tripId}/export/csv`;
            await Linking.openURL(url);
        } catch (e) {
            Alert.alert('Eroare CSV', `Nu s-a putut descărca exportul: ${e.message}`);
        } finally {
            setSharing(false);
        }
    }, [tripId, sharing]);

    useEffect(() => {
        const load = async () => {
            try {
                const [detailRes, analizaRes] = await Promise.allSettled([
                    api.get(`/calatorii/${tripId}`),
                    api.get(`/calatorii/${tripId}/analiza`),
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
                // error handled by null trip state
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tripId]);

    const chartWidth = screenWidth - layout.screenPaddingH * 2 - spacing[8];

    const getChartData = () => {
        const config = CHART_CONFIGS[activeChart];
        if (!graficData.length) return [];
        const step = Math.max(1, Math.floor(graficData.length / 80));
        const points = [];
        for (let i = 0; i < graficData.length; i += step) {
            const row = graficData[i];
            const val = parseFloat(row?.[config.field] || row?.motor?.[config.field] || 0);
            points.push({ value: isNaN(val) ? 0 : val });
        }
        return points;
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Înapoi">
                        <Text style={styles.backBtnText}>{t('detail.back')}</Text>
                    </TouchableOpacity>
                    <Skeleton variant="text" height={typography.sizes.body1} width={140} />
                    <View style={{ width: 60 }} />
                </View>
                <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing[10] }} showsVerticalScrollIndicator={false}>
                    <Skeleton variant="card" height={80}  style={styles.skGap} />
                    <View style={styles.metricsRow}>
                        {[0,1,2,3].map(i => <Skeleton key={i} variant="card" height={72} style={styles.skMetric} />)}
                    </View>
                    <Skeleton variant="text" height={typography.sizes.label1} width={120} style={styles.skGap} />
                    <Skeleton variant="card" height={120} style={styles.skGap} />
                    <Skeleton variant="text" height={typography.sizes.label1} width={100} style={styles.skGap} />
                    <Skeleton variant="card" height={96}  style={styles.skGap} />
                    <Skeleton variant="card" height={96}  style={{ marginTop: spacing[2] }} />
                </ScrollView>
            </View>
        );
    }

    // ── No data ───────────────────────────────────────────────────────────────
    if (!trip) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button">
                        <Text style={styles.backBtnText}>{t('detail.back')}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.center}>
                    <EmptyState
                        icon="⊘"
                        title="Date indisponibile"
                        subtitle="Nu s-au putut încărca datele cursei."
                        action={{ label: t('detail.back'), onPress: onBack }}
                        size="lg"
                    />
                </View>
            </View>
        );
    }

    const chartData    = getChartData();
    const chartConfig  = CHART_CONFIGS[activeChart];
    const driveStyle   = analiza?.ai?.driving?.style;
    const predictions  = (analiza?.ai?.intelligence?.predictions || []).filter(
        p => p.severity === 'HIGH' || p.severity === 'MEDIUM'
    ).slice(0, 3);
    const tripDateLabel = trip.timestamp_start
        ? new Date(trip.timestamp_start).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
        : `#${tripId}`;

    return (
        <View style={styles.container}>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Înapoi la jurnal"
                >
                    <Text style={styles.backBtnText}>{t('detail.back')}</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{tripDateLabel}</Text>
                    <Text style={styles.headerSub}>{getDuration(trip.timestamp_start, trip.timestamp_end)}</Text>
                </View>
                <View style={styles.headerRight}>
                    {analiza?.health_score != null && (
                        <View style={[styles.healthPill, { borderColor: getSubsystemColor(analiza.health_score) }]}>
                            <Text style={[styles.healthPillText, { color: getSubsystemColor(analiza.health_score) }]}>
                                {analiza.health_score}%
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={exportCSV}
                        disabled={sharing}
                        style={styles.shareBtn}
                        accessibilityRole="button"
                        accessibilityLabel={sharing ? 'Se exportă...' : 'Exportă CSV date brute'}
                        accessibilityState={{ disabled: sharing }}
                    >
                        <Text style={styles.shareBtnText}>{sharing ? '...' : 'CSV'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: spacing[10] }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Metrics grid ──────────────────────────────────────── */}
                <View style={styles.metricsRow}>
                    <MetricCard
                        label="DISTANȚĂ"
                        value={(trip.km_parcursi || 0).toFixed(1)}
                        unit="km"
                        size="sm"
                        status="neutral"
                        style={styles.metricItem}
                    />
                    <MetricCard
                        label="CONSUM"
                        value={trip.consum_mediu_100km || 0}
                        unit="L/100"
                        size="sm"
                        status="neutral"
                        style={styles.metricItem}
                    />
                    <MetricCard
                        label="COMBUSTIBIL"
                        value={(trip.consum_total_l || 0).toFixed(1)}
                        unit="L"
                        size="sm"
                        status="neutral"
                        style={styles.metricItem}
                    />
                    <MetricCard
                        label="ECO SCORE"
                        value={trip.scor_eco || 100}
                        unit="/100"
                        size="sm"
                        status={
                            (trip.scor_eco || 100) >= 85 ? 'good' :
                            (trip.scor_eco || 100) >= 65 ? 'monitor' : 'caution'
                        }
                        style={styles.metricItem}
                    />
                </View>

                {/* ── Stil de condus ────────────────────────────────────── */}
                {driveStyle && (
                    <>
                        <SectionHeader title="Stil de condus" style={styles.sectionHeader} />
                        <View style={styles.card}>
                            <StyleBar label="Economic"  pct={driveStyle.economicPct}   color={colors.status.good}    />
                            <StyleBar label="Liniștit"  pct={driveStyle.smoothPct}     color={colors.status.optimal} />
                            <StyleBar label="Agresiv"   pct={driveStyle.aggressivePct} color={colors.status.caution} />
                            <StyleBar label="Vit. const." pct={driveStyle.constantSpeedPct} color={colors.accent.default} />
                            {(analiza.hard_brakes > 0 || analiza.hard_accelerations > 0) && (
                                <View style={styles.eventsRow}>
                                    {analiza.hard_brakes > 0 && (
                                        <View style={styles.eventChip}>
                                            <Text style={[styles.eventChipText, { color: colors.status.caution }]}>
                                                {analiza.hard_brakes} frânări bruște
                                            </Text>
                                        </View>
                                    )}
                                    {analiza.hard_accelerations > 0 && (
                                        <View style={styles.eventChip}>
                                            <Text style={[styles.eventChipText, { color: colors.status.monitor }]}>
                                                {analiza.hard_accelerations} accel. bruște
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </>
                )}

                {/* ── Predicții ─────────────────────────────────────────── */}
                {predictions.length > 0 && (
                    <>
                        <SectionHeader title="Predicții detectate" style={styles.sectionHeader} />
                        {predictions.map((pred, i) => (
                            <PredictionCard
                                key={i}
                                title={pred.component || pred.category || 'Componentă'}
                                prediction={pred.recommendation || pred.prediction || '—'}
                                confidence={predConfidence(pred.probability)}
                                timeframe={pred.estimatedRemainingKm
                                    ? `~${Math.round(pred.estimatedRemainingKm)} km`
                                    : pred.estimatedRemainingDays
                                        ? `~${pred.estimatedRemainingDays} zile`
                                        : undefined}
                                status={predStatus(pred.severity)}
                                style={i > 0 ? { marginTop: spacing[2] } : undefined}
                            />
                        ))}
                    </>
                )}

                {/* ── Telemetrie grafic ─────────────────────────────────── */}
                {graficData.length > 0 && (
                    <>
                        <SectionHeader title="Telemetrie" style={styles.sectionHeader} />
                        <View style={styles.card}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                                {Object.entries(CHART_CONFIGS).map(([key, cfg]) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={[styles.chartTab, activeChart === key && { backgroundColor: cfg.color }]}
                                        onPress={() => setActiveChart(key)}
                                        accessibilityRole="radio"
                                        accessibilityLabel={cfg.label}
                                        accessibilityState={{ checked: activeChart === key }}
                                    >
                                        <Text style={[styles.chartTabText, activeChart === key && { color: '#FFFFFF' }]}>
                                            {cfg.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            {chartData.length > 0 ? (
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
                            ) : (
                                <Text style={styles.chartNoData}>
                                    Nu sunt date disponibile pentru acest parametru.
                                </Text>
                            )}
                            <Text style={styles.chartFooter}>{graficData.length} puncte înregistrate</Text>
                        </View>
                    </>
                )}

                {/* ── Alerte ────────────────────────────────────────────── */}
                {alerte.length > 0 && (
                    <>
                        <SectionHeader
                            title={`Alerte (${alerte.length})`}
                            style={styles.sectionHeader}
                        />
                        <View style={styles.card}>
                            {alerte.slice(0, 10).map((a, i) => (
                                <View
                                    key={i}
                                    style={[styles.alertItem, i === Math.min(alerte.length, 10) - 1 && { borderBottomWidth: 0 }]}
                                >
                                    <View style={[styles.alertDot, {
                                        backgroundColor: a.severitate === 'CRITICAL'
                                            ? colors.status.critical
                                            : colors.status.monitor,
                                    }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.alertText}>{a.descriere || a.tip}</Text>
                                        <Text style={styles.alertMeta}>
                                            {a.parametru}: {a.valoare} (limita: {a.limita})
                                        </Text>
                                    </View>
                                </View>
                            ))}
                            {alerte.length > 10 && (
                                <Text style={styles.alertMore}>...și încă {alerte.length - 10} alerte</Text>
                            )}
                        </View>
                    </>
                )}

                {/* ── Cost / Emisii ─────────────────────────────────────── */}
                {analiza && (analiza.cost_combustibil > 0 || analiza.emisii_co2 > 0) && (
                    <>
                        <SectionHeader title="Cost & Emisii" style={styles.sectionHeader} />
                        <View style={styles.metricsRow}>
                            {analiza.cost_combustibil > 0 && (
                                <MetricCard
                                    label="COST"
                                    value={parseFloat(analiza.cost_combustibil || 0).toFixed(2)}
                                    unit="RON"
                                    size="sm"
                                    status="neutral"
                                    style={styles.metricItem}
                                />
                            )}
                            {analiza.emisii_co2 > 0 && (
                                <MetricCard
                                    label="CO₂"
                                    value={parseFloat(analiza.emisii_co2 || 0).toFixed(2)}
                                    unit="kg"
                                    size="sm"
                                    status="neutral"
                                    style={styles.metricItem}
                                />
                            )}
                            {analiza.viteza_medie > 0 && (
                                <MetricCard
                                    label="VIT. MEDIE"
                                    value={Math.round(analiza.viteza_medie)}
                                    unit="km/h"
                                    size="sm"
                                    status="neutral"
                                    style={styles.metricItem}
                                />
                            )}
                            {analiza.rpm_mediu > 0 && (
                                <MetricCard
                                    label="RPM MEDIU"
                                    value={Math.round(analiza.rpm_mediu)}
                                    unit="rpm"
                                    size="sm"
                                    status="neutral"
                                    style={styles.metricItem}
                                />
                            )}
                        </View>
                    </>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    shareBtn: {
        backgroundColor: colors.accent.default,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.sm,
    },
    shareBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
    },
    headerTitle: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    headerSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
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
    healthPill: {
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 52,
    },
    healthPillText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },

    scroll: { flex: 1, paddingHorizontal: layout.screenPaddingH },

    // ── Skeleton ──────────────────────────────────────────────────────────────
    skGap:    { marginTop: spacing[3] },
    metricsRow: {
        flexDirection: 'row',
        marginTop: spacing[3],
        gap: spacing[2],
    },
    skMetric: { flex: 1 },
    metricItem: { flex: 1 },

    // ── Section ───────────────────────────────────────────────────────────────
    sectionHeader: { marginTop: spacing[4], marginBottom: spacing[2] },
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border.default,
    },

    // ── Driving style events ──────────────────────────────────────────────────
    eventsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginTop: spacing[2],
    },
    eventChip: {
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 1,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    eventChipText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },

    // ── Chart ─────────────────────────────────────────────────────────────────
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

    // ── Alerts ────────────────────────────────────────────────────────────────
    alertItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing[2] + 2,
    },
    alertDot: {
        width: 8, height: 8,
        borderRadius: radii.full,
        marginTop: spacing[1],
        flexShrink: 0,
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
        textAlign: 'center',
    },
});

export default TripDetailScreen;
