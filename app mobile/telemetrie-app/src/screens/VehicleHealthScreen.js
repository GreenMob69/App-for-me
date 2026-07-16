import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    TouchableOpacity, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { getVin, getVehicleLabel } from '../utils/config';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout } from '../theme';
import { formatTimeAgo } from '../utils/formatters';
import { getSubsystemColor } from '../utils/statusUtils';
import {
    HealthGauge, MetricCard, SectionHeader, PredictionCard,
    TimelineCard, Skeleton, EmptyState,
} from '../components/ui';

const CACHE_KEY = '@health_cache';

// ── Helpers ───────────────────────────────────────────────────────────────────

function subScore(score) {
    if (score == null)  return 'neutral';
    if (score >= 90)    return 'optimal';
    if (score >= 75)    return 'good';
    if (score >= 55)    return 'monitor';
    if (score >= 35)    return 'caution';
    return 'critical';
}

function predConfidence(prob) {
    if (prob >= 80) return 'high';
    if (prob >= 60) return 'medium';
    return 'low';
}

function predStatus(severity) {
    if (severity === 'HIGH')   return 'critical';
    if (severity === 'MEDIUM') return 'caution';
    return 'monitor';
}

function tsToDateParts(ts) {
    if (!ts) return { date: '—', time: '' };
    const d = ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
    return {
        date: d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }),
        time: d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
    };
}

function tlEventType(category) {
    if (category === 'MAINTENANCE') return 'maintenance';
    if (category === 'HEALTH')      return 'alert';
    if (category === 'TRIP')        return 'trip';
    if (category === 'MILESTONE')   return 'milestone';
    return 'event';
}

// ─────────────────────────────────────────────────────────────────────────────

const hashPred = (pred) => {
    const s = `${pred.title || ''}${pred.category || ''}${pred.severity || ''}`;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return Math.abs(h).toString(16).slice(0, 12);
};

const ecoBarColor = (v) => {
    if (v >= 85) return colors.status.good;
    if (v >= 65) return colors.status.monitor;
    return colors.status.caution;
};

const VehicleHealthScreen = ({ navigation }) => {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError]           = useState(null);
    const [trendData,    setTrendData]    = useState(null);
    const [resolvedPreds, setResolvedPreds] = useState(new Set());

    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                setHealthData(JSON.parse(cached));
                setLoading(false);
            }
        } catch {}
    };

    const fetchHealth = async (isRefresh = false) => {
        try {
            const response = await api.get(`/vehicul/${getVin()}/health`);
            const data = response.data;
            setHealthData(data);
            setError(null);
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (err) {
            if (!healthData) setError('Nu s-a putut conecta la server');
        } finally {
            setLoading(false);
            if (isRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        loadCachedData().then(() => fetchHealth());
        api.get(`/vehicul/${getVin()}/trend-eco?weeks=8`).then(r => {
            if (r.data?.weeks) setTrendData(r.data.weeks);
        }).catch(() => {});
        api.get(`/vehicul/${getVin()}/predictii/active`).then(r => {
            if (Array.isArray(r.data)) setResolvedPreds(new Set(r.data));
        }).catch(() => {});
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchHealth(true);
    };

    const handleSubsystemPress = useCallback((systemKey) => {
        if (navigation) {
            navigation.navigate('SubsystemDetail', { system: systemKey, vin: getVin() });
        }
    }, [navigation]);

    const handleMarkPrediction = useCallback(async (pred, status) => {
        const hash = hashPred(pred);
        try {
            await api.post(`/vehicul/${getVin()}/predictii/valideaza`, {
                prediction_hash: hash,
                titlu: pred.title || pred.component || '',
                status,
            });
            setResolvedPreds(prev => new Set([...prev, hash]));
        } catch {}
    }, []);

    const handlePredictionPress = useCallback((prediction) => {
        const categoryToSystem = {
            ELECTRIC: 'electric', TURBO: 'turbo', COMBUSTIBIL: 'combustibil',
            EMISII: 'combustibil', TERMIC: 'motor', ADMISIE: 'motor',
        };
        const system = categoryToSystem[prediction.category] || 'motor';
        if (navigation) {
            navigation.navigate('SubsystemDetail', { system, vin: getVin() });
        }
    }, [navigation]);

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (loading && !healthData) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Skeleton variant="card" height={48} style={styles.skGap} />
                    <Skeleton variant="circle" height={144} width={240} style={styles.skGaugeWrap} />
                    <Skeleton variant="text" height={typography.sizes.label1} width={120} style={styles.skGap} />
                    <View style={styles.skRow}>
                        {[0,1,2,3].map(i => (
                            <Skeleton key={i} variant="card" height={80} style={styles.skCard} />
                        ))}
                    </View>
                    <Skeleton variant="text" height={typography.sizes.label1} width={120} style={styles.skGap} />
                    <Skeleton variant="card" height={96} />
                    <Skeleton variant="card" height={96} style={styles.skTopGap} />
                </ScrollView>
            </View>
        );
    }

    if (healthData && healthData.status === 'NO_DATA') {
        return (
            <View style={[styles.container, styles.center]}>
                <EmptyState
                    icon="—"
                    title="Așteptăm date"
                    subtitle={`Efectuează prima cursă pentru a genera raportul de sănătate.\n\nConectează adaptorul OBD-II și pornește motorul.`}
                    size="lg"
                />
            </View>
        );
    }

    if (error && !healthData) {
        return (
            <View style={[styles.container, styles.center]}>
                <EmptyState
                    icon="⊘"
                    title="Conexiune eșuată"
                    subtitle={error}
                    action={{ label: t('states.retry'), onPress: () => { setLoading(true); fetchHealth(); } }}
                    size="lg"
                />
            </View>
        );
    }

    const {
        overallHealth, scores, subsystems, predictions, timeline,
        lastTrip, lastUpdated, dataQuality,
    } = healthData || {};

    const isOffline  = !!error && !!healthData;
    const isCritical = overallHealth < 40;

    const subsystemEntries = useMemo(() => {
        if (!subsystems) return [];
        return Object.entries(subsystems);
    }, [subsystems]);

    const timelineItems = useMemo(() => {
        if (!Array.isArray(timeline)) return [];
        return timeline.slice(0, 5);
    }, [timeline]);

    const gaugeSubtitle = useMemo(() => {
        if (overallHealth == null) return '—';
        if (overallHealth >= 90) return 'Stare excelentă';
        if (overallHealth >= 75) return 'Funcționează normal';
        if (overallHealth >= 55) return 'Monitorizare recomandată';
        if (overallHealth >= 35) return 'Atenție necesară';
        return 'Stare critică';
    }, [overallHealth]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bg[0]} />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent.default}
                        colors={[colors.accent.default]}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.vehicleName}>{getVehicleLabel() || getVin().slice(-6)}</Text>
                        <Text style={styles.lastUpdate}>{formatTimeAgo(lastUpdated)}</Text>
                    </View>
                    <View style={styles.headerBadges}>
                        {isOffline && (
                            <View style={styles.offlineBadge}>
                                <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                            </View>
                        )}
                        {dataQuality && dataQuality !== 'HIGH' && !isOffline && (
                            <View style={[styles.qualityBadge, dataQuality === 'LOW' && styles.qualityBadgeLow]}>
                                <Text style={[styles.qualityBadgeText, dataQuality === 'LOW' && styles.qualityBadgeTextLow]}>
                                    DATE {dataQuality}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {isCritical && (
                    <View style={styles.criticalBanner}>
                        <Text style={styles.criticalText}>Stare critică detectată</Text>
                    </View>
                )}

                {/* ── Health Gauge ─────────────────────────────────────────── */}
                <View style={styles.gaugeWrap}>
                    <HealthGauge
                        score={overallHealth}
                        label="SĂNĂTATE"
                        subtitle={gaugeSubtitle}
                        size="lg"
                        animate
                    />
                </View>

                {/* ── Scores row ───────────────────────────────────────────── */}
                {scores && (
                    <View style={styles.metricsRow}>
                        {[
                            { key: 'engine',  label: t('health.engine'),  value: scores.engine  },
                            { key: 'fuel',    label: t('health.fuel'),    value: scores.fuel    },
                            { key: 'driving', label: t('health.driving'), value: scores.driving },
                            { key: 'safety',  label: t('health.safety'),  value: scores.safety  },
                        ].filter(m => m.value != null).map(m => (
                            <MetricCard
                                key={m.key}
                                label={m.label}
                                value={Math.round(m.value)}
                                unit="/100"
                                status={subScore(m.value)}
                                size="sm"
                                style={styles.metricItem}
                            />
                        ))}
                    </View>
                )}

                {/* ── Subsystems ───────────────────────────────────────────── */}
                {subsystemEntries.length > 0 && (
                    <>
                        <SectionHeader title="Subsisteme" style={styles.sectionHeader} />
                        <View style={styles.subsystemGrid}>
                            {subsystemEntries.map(([key, data]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={styles.subsystemCard}
                                    onPress={() => handleSubsystemPress(key)}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={key}
                                >
                                    <View style={[styles.subsystemDot, { backgroundColor: getSubsystemColor(data.score) }]} />
                                    <Text style={styles.subsystemName} numberOfLines={1}>
                                        {key.replace(/_/g, ' ').toUpperCase()}
                                    </Text>
                                    <Text style={[styles.subsystemScore, { color: getSubsystemColor(data.score) }]}>
                                        {data.score != null ? Math.round(data.score) : '—'}
                                    </Text>
                                    {data.status ? (
                                        <Text style={styles.subsystemStatus} numberOfLines={1}>{data.status}</Text>
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                )}

                {/* ── Trend scor eco (8 săptămâni) ─────────────────────── */}
                {trendData && trendData.some(w => w.avg_eco != null) && (
                    <>
                        <SectionHeader title="Trend scor eco (8 săptămâni)" style={styles.sectionHeader} />
                        <View style={styles.trendCard}>
                            <View style={styles.trendBars}>
                                {trendData.map((w, i) => {
                                    const val = w.avg_eco;
                                    const barH = val != null ? Math.max(4, (val / 100) * 72) : 4;
                                    const color = val != null ? ecoBarColor(val) : colors.border.default;
                                    return (
                                        <View key={i} style={styles.trendBarWrap}>
                                            <View style={styles.trendBarTrack}>
                                                <View style={[styles.trendBarFill, { height: barH, backgroundColor: color }]} />
                                            </View>
                                            <Text style={styles.trendBarLabel}>
                                                {val != null ? Math.round(val) : '—'}
                                            </Text>
                                            <Text style={styles.trendBarWeek}>S{i + 1}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                            <Text style={styles.trendNote}>
                                Medie scor eco pe fiecare săptămână · barele goale = fără date
                            </Text>
                        </View>
                    </>
                )}

                {/* ── Predictions ──────────────────────────────────────────── */}
                {predictions && predictions.length > 0 && (
                    <>
                        <SectionHeader
                            title={isCritical ? 'Atenție — Risc ridicat' : 'Predicții'}
                            style={styles.sectionHeader}
                        />
                        {predictions.slice(0, 2).map((pred, idx) => {
                            const hash = hashPred(pred);
                            const isResolved = resolvedPreds.has(hash);
                            return (
                                <View key={idx} style={idx > 0 ? styles.cardGap : undefined}>
                                    <PredictionCard
                                        title={pred.component || pred.category || 'Predicție'}
                                        prediction={pred.recommendation || pred.description || pred.component || '—'}
                                        confidence={predConfidence(pred.probability)}
                                        timeframe={pred.estimatedRemainingKm
                                            ? `~${Math.round(pred.estimatedRemainingKm)} km`
                                            : undefined}
                                        status={isResolved ? 'good' : predStatus(pred.severity)}
                                        onPress={() => handlePredictionPress(pred)}
                                    />
                                    {!isResolved ? (
                                        <View style={styles.predActionsRow}>
                                            <TouchableOpacity
                                                style={styles.predActionBtn}
                                                onPress={() => handleMarkPrediction(pred, 'REZOLVATA')}
                                            >
                                                <Text style={[styles.predActionText, { color: colors.status.good }]}>
                                                    ✓ Rezolvat
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.predActionBtn}
                                                onPress={() => handleMarkPrediction(pred, 'FALSA')}
                                            >
                                                <Text style={[styles.predActionText, { color: colors.text.disabled }]}>
                                                    ✕ Fals pozitiv
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <Text style={styles.predResolvedLabel}>✓ Marcat ca rezolvat</Text>
                                    )}
                                </View>
                            );
                        })}
                        {predictions.length > 2 && (
                            <Text style={styles.moreText}>+{predictions.length - 2} monitorizate</Text>
                        )}
                    </>
                )}

                {/* ── Timeline ─────────────────────────────────────────────── */}
                {timelineItems.length > 0 && (
                    <>
                        <SectionHeader title="Jurnal vehicul" style={styles.sectionHeader} />
                        {timelineItems.map((ev, idx) => {
                            const { date, time } = tsToDateParts(ev.event_date);
                            return (
                                <TimelineCard
                                    key={ev.id ?? idx}
                                    title={ev.title || ev.event_type || '—'}
                                    description={ev.description}
                                    date={date}
                                    time={time}
                                    type={tlEventType(ev.category)}
                                    isFirst={idx === 0}
                                    isLast={idx === timelineItems.length - 1}
                                />
                            );
                        })}
                    </>
                )}

                {/* ── Last trip ────────────────────────────────────────────── */}
                {lastTrip && (
                    <>
                        <SectionHeader title="Ultima cursă" style={styles.sectionHeader} />
                        <TouchableOpacity
                            style={styles.lastTripCard}
                            activeOpacity={0.7}
                            onPress={() => navigation?.navigate('TripReport', { tripId: lastTrip.id })}
                            accessibilityRole="button"
                        >
                            <View style={styles.lastTripHeader}>
                                <Text style={styles.lastTripTitle}>Ultima cursă</Text>
                                <Text style={styles.lastTripDate}>{formatTimeAgo(lastTrip.date)}</Text>
                            </View>
                            <View style={styles.lastTripStats}>
                                {[
                                    { value: lastTrip.distanceKm,             label: 'km'   },
                                    { value: lastTrip.durationMin,            label: 'min'  },
                                    { value: lastTrip.consumptionPer100 || '—', label: 'L/100' },
                                    { value: lastTrip.ecoScore,               label: 'Eco', colored: true },
                                ].map((stat, i) => (
                                    <View key={i} style={styles.lastTripStat}>
                                        <Text style={[
                                            styles.statValue,
                                            styles.tabular,
                                            stat.colored && { color: getSubsystemColor(stat.value) },
                                        ]}>
                                            {stat.value}
                                        </Text>
                                        <Text style={styles.statLabel}>{stat.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                <View style={{ height: spacing[8] }} />
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
    center: { justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: layout.screenPaddingH },

    // ── Skeleton ──────────────────────────────────────────────────────────────
    skGap:      { marginTop: spacing[3], marginBottom: spacing[2] },
    skTopGap:   { marginTop: spacing[2] },
    skGaugeWrap:{ alignSelf: 'center', marginVertical: spacing[4] },
    skRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    skCard:     { width: '47%' },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[3],
    },
    vehicleName: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    lastUpdate: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
    headerBadges: { flexDirection: 'row', gap: spacing[2] },
    offlineBadge: {
        backgroundColor: colors.tint.critical,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        borderRadius: radii.xs,
        borderColor: colors.status.critical,
        borderWidth: 1,
    },
    offlineBadgeText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.status.critical,
    },
    qualityBadge: {
        backgroundColor: colors.tint.monitor,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
        borderRadius: radii.xs,
        borderColor: colors.status.monitor,
        borderWidth: 1,
    },
    qualityBadgeLow: {
        backgroundColor: colors.tint.critical,
        borderColor: colors.status.critical,
    },
    qualityBadgeText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.status.monitor,
    },
    qualityBadgeTextLow: { color: colors.status.critical },

    criticalBanner: {
        backgroundColor: colors.tint.critical,
        borderColor: colors.status.critical,
        borderWidth: 1,
        borderRadius: radii.sm,
        padding: spacing[2] + 2,
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    criticalText: {
        color: colors.status.critical,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
    },

    // ── Gauge ─────────────────────────────────────────────────────────────────
    gaugeWrap: { alignItems: 'center', marginVertical: spacing[4] },

    // ── Metrics row ───────────────────────────────────────────────────────────
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    metricItem: { flex: 1, minWidth: '22%' },

    // ── Section header ────────────────────────────────────────────────────────
    sectionHeader: { marginTop: spacing[4], marginBottom: spacing[2] },

    // ── Subsystem grid ────────────────────────────────────────────────────────
    subsystemGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: spacing[2],
    },
    subsystemCard: {
        width: '47%',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3],
    },
    subsystemDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginBottom: spacing[2],
    },
    subsystemName: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.3,
        marginBottom: spacing[1],
    },
    subsystemScore: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    subsystemStatus: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginTop: spacing[1],
    },

    cardGap: { marginTop: spacing[2] },

    // ── Eco Trend ─────────────────────────────────────────────────────────────
    trendCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
    },
    trendBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing[2],
        height: 88,
    },
    trendBarWrap: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    trendBarTrack: {
        width: '100%',
        height: 72,
        justifyContent: 'flex-end',
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        overflow: 'hidden',
    },
    trendBarFill: {
        width: '100%',
        borderRadius: radii.xs,
    },
    trendBarLabel: {
        fontSize: 9,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
    },
    trendBarWeek: {
        fontSize: 8,
        color: colors.text.disabled,
        textAlign: 'center',
    },
    trendNote: {
        fontSize: typography.sizes.micro,
        color: colors.text.disabled,
        marginTop: spacing[2],
        textAlign: 'center',
    },

    // ── Prediction actions ────────────────────────────────────────────────────
    predActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing[4],
        paddingTop: spacing[2],
        paddingHorizontal: spacing[1],
    },
    predActionBtn: {
        paddingVertical: spacing[1],
    },
    predActionText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },
    predResolvedLabel: {
        fontSize: typography.sizes.caption,
        color: colors.status.good,
        textAlign: 'right',
        paddingTop: spacing[1],
        paddingHorizontal: spacing[1],
    },

    moreText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        textAlign: 'right',
        marginTop: spacing[2],
    },

    // ── Last trip ─────────────────────────────────────────────────────────────
    lastTripCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderColor: colors.border.default,
        borderWidth: 1,
    },
    lastTripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    lastTripTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    lastTripDate: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    lastTripStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    lastTripStat: { alignItems: 'center' },
    statValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
    },
    tabular: { fontVariant: ['tabular-nums'] },
    statLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
});

export default VehicleHealthScreen;
