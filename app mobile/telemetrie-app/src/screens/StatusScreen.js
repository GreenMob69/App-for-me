/**
 * StatusScreen — ecranul principal al aplicației.
 *
 * Răspunde la o singură întrebare: "Pot pleca liniștit cu mașina mea?"
 * Health score-ul nu este afișat ca element primar.
 * Limbaj natural, numerele sunt informații secundare.
 */

import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    Animated,
    TouchableOpacity,
    Platform,
    StatusBar,
    StyleSheet,
} from 'react-native';
import { useScreenFadeIn } from '../utils/animations';
import { fetchFullStatus } from '../services/vehicleService';
import { getVin } from '../utils/config';
import { mapStatusData } from '../mappers/statusMapper';
import { t } from '../i18n';
import { colors, typography, spacing, layout, radii, motion } from '../theme';
import { TREND_INDICATORS } from '../utils/statusUtils';
import { NotificationContext } from '../context/NotificationContext';

import {
    Card,
    SectionHeader,
    Button,
    Skeleton,
    HeroCard,
    RecommendationCard,
    PredictionCard,
    TimelineCard,
    MaintenanceCard,
    EmptyState,
    StatusBadge,
    VehicleAvatar,
} from '../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Mapări semantice
// ─────────────────────────────────────────────────────────────────────────────

const DRIVEABILITY = {
    EXCELLENT: { answer: 'Da, poți pleca liniștit.',                         status: 'optimal',  icon: '✓' },
    GOOD:      { answer: 'Da, poți pleca liniștit.',                         status: 'good',     icon: '✓' },
    ATTENTION: { answer: 'Poți pleca, dar recomand o verificare în curând.', status: 'monitor',  icon: '⚠' },
    PROBLEM:   { answer: 'Poți pleca, dar recomand o verificare în curând.', status: 'caution',  icon: '⚠' },
    CRITICAL:  { answer: 'Nu recomand un drum lung înainte de verificare.',  status: 'critical', icon: '✗' },
};

const SEVERITY_TO_PRIORITY = {
    info:     'low',
    warning:  'medium',
    serious:  'high',
    critical: 'critical',
};

const SEVERITY_TO_REC_ICON = {
    critical: '🚨',
    serious:  '⚠',
    warning:  '💡',
    info:     '●',
};

const DATA_QUALITY = {
    HIGH:   { label: t('footer.qualityHigh'),   pct: '90%+', status: 'optimal'  },
    MEDIUM: { label: t('footer.qualityMedium'),  pct: '~65%', status: 'monitor'  },
    LOW:    { label: t('footer.qualityLow'),     pct: '~35%', status: 'caution'  },
};

const getSeverityMaintenance = (severity) => ({
    status:  ['critical', 'serious'].includes(severity) ? 'overdue' : 'upcoming',
    urgency: severity === 'critical' || severity === 'serious' ? 'high'
           : severity === 'warning' ? 'normal'
           : 'low',
});

// Formatare dată/oră pt footer (nu importăm din MessageEngine — e o utilitate locală)
const formatDateTime = (iso) => {
    if (!iso) return t('footer.neverSynced');
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
};

const formatRelative = (iso) => {
    if (!iso) return t('footer.neverSynced');
    const diffMs = new Date() - new Date(iso);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)  return 'Acum';
    if (diffMin < 60) return `Acum ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)   return `Acum ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    return `Acum ${diffD} zile`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton — afișat la prima încărcare
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
    <View style={styles.skeletonWrap}>
        <Skeleton variant="card" height={152} />
        <View style={styles.skeletonGap} />
        <Skeleton variant="card" height={72} />
        <View style={styles.skeletonGap} />
        <Skeleton variant="text" height={typography.sizes.label1} width={120} />
        <View style={styles.skeletonGapSm} />
        <Skeleton variant="card" height={120} />
        <View style={styles.skeletonGap} />
        <Skeleton variant="card" height={100} />
        <View style={styles.skeletonGap} />
        <Skeleton variant="text" height={typography.sizes.label1} width={140} />
        <View style={styles.skeletonGapSm} />
        <Skeleton variant="card" height={88} />
        <View style={styles.skeletonGapSm} />
        <Skeleton variant="card" height={88} />
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// StatusScreen
// ─────────────────────────────────────────────────────────────────────────────

const StatusScreen = ({ navigation }) => {
    const [screenState, setScreenState] = useState('loading');
    const [refreshing, setRefreshing]   = useState(false);
    const [statusModel, setStatusModel] = useState(null);
    const [showAllPreds, setShowAllPreds] = useState(false);

    const { unreadCount, syncFromSummary } = useContext(NotificationContext);

    const screenFadeStyle = useScreenFadeIn(screenState);

    // Navigate to parent RootStack screens
    const openNotifications = useCallback(() => {
        navigation?.getParent()?.navigate('Notifications');
    }, [navigation]);

    const openSearch = useCallback(() => {
        navigation?.getParent()?.navigate('GlobalSearch');
    }, [navigation]);

    const loadStatus = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setScreenState('loading');
        try {
            const raw   = await fetchFullStatus();
            const model = mapStatusData(raw.health, raw.trends);
            setStatusModel(model);
            setShowAllPreds(false);
            setScreenState(model.state === 'empty' ? 'empty' : 'success');
            // Feed health summary to NotificationContext (fire-and-forget)
            if (raw.health) {
                syncFromSummary(raw.health).catch(() => {});
            }
        } catch {
            // Nu suprascrie 'success' existent cu 'error' la refresh eșuat
            setScreenState(prev => prev === 'success' ? prev : 'error');
        } finally {
            setRefreshing(false);
        }
    }, [syncFromSummary]);

    useEffect(() => { loadStatus(); }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadStatus(true);
    }, [loadStatus]);

    // ── Stati speciale ───────────────────────────────────────────────────────

    if (screenState === 'loading') {
        return (
            <View style={styles.container}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <LoadingSkeleton />
                </ScrollView>
            </View>
        );
    }

    if (screenState === 'error') {
        return (
            <View style={[styles.container, styles.center]}>
                <EmptyState
                    icon="⚠"
                    title={t('states.errorTitle')}
                    subtitle={t('states.errorSubtitle')}
                    action={{ label: t('states.retry'), onPress: () => loadStatus() }}
                    size="lg"
                />
            </View>
        );
    }

    if (screenState === 'empty' || !statusModel) {
        return (
            <View style={[styles.container, styles.center]}>
                <EmptyState
                    icon="📡"
                    title={t('status.empty.message')}
                    subtitle={t('status.empty.subtitle')}
                    size="lg"
                />
            </View>
        );
    }

    // ── Date din model ───────────────────────────────────────────────────────

    const {
        evaluation,
        message,
        subtitle,
        observations,
        comparison,
        upcoming,
        lastEvent,
        longTripReady,
        lastUpdated,
        dataQuality,
    } = statusModel;

    const drive = useMemo(() => DRIVEABILITY[evaluation] || DRIVEABILITY.GOOD, [evaluation]);
    const primaryObs   = useMemo(() => observations?.[0], [observations]);
    const secondaryObs = useMemo(() => observations?.slice(1) ?? [], [observations]);
    const hasObs       = useMemo(() => (observations?.length || 0) > 0, [observations]);
    const hasUpcoming  = useMemo(() => (upcoming?.length || 0) > 0, [upcoming]);
    const trendStyle   = useMemo(() => comparison ? (TREND_INDICATORS[comparison.trend] || TREND_INDICATORS.stable) : null, [comparison]);
    const qualityInfo  = useMemo(() => dataQuality ? (DATA_QUALITY[dataQuality] || DATA_QUALITY.MEDIUM) : null, [dataQuality]);
    const hasFooter    = useMemo(() => !!(lastUpdated || dataQuality), [lastUpdated, dataQuality]);
    const visiblePreds = useMemo(() => showAllPreds ? secondaryObs : secondaryObs.slice(0, 2), [showAllPreds, secondaryObs]);
    const hiddenCount  = useMemo(() => secondaryObs.length - 2, [secondaryObs]);

    // Descrierea cardului principal: motivul specific dacă există, altfel subtitle
    const heroDescription = longTripReady?.detail || null;

    // ── Observație primară → RecommendationCard ──────────────────────────────

    const buildPrimaryAction = (obs) => {
        if (obs.hasDetail && obs.systemKey) {
            return {
                label: 'Detalii tehnice',
                onPress: () => navigation?.navigate('SubsystemDetail', {
                    system: obs.systemKey,
                    vin: getVin(),
                }),
            };
        }
        return undefined;
    };

    const buildPrimaryDescription = (obs) => {
        const parts = [obs.evidence];
        if (!obs.hasDetail || !obs.systemKey) parts.push(obs.action);
        return parts.filter(Boolean).join('\n') || undefined;
    };

    // ── Observații secundare → PredictionCard ───────────────────────────────

    const buildPredictionText = (obs) =>
        [obs.urgency, obs.evidence].filter(Boolean).join('\n') || obs.title;

    const buildTimeframe = (obs) => {
        if (obs.estimateKm && obs.estimateDays)
            return `~${obs.estimateKm} km · ~${obs.estimateDays} zile`;
        if (obs.estimateKm)   return `~${obs.estimateKm} km`;
        if (obs.estimateDays) return `~${obs.estimateDays} zile`;
        return undefined;
    };

    // ────────────────────────────────────────────────────────────────────────

    return (
        <Animated.View style={[styles.container, screenFadeStyle]}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent.default}
                        colors={[colors.accent.default]}
                    />
                }
            >
                {/* ── 0. VEHICLE IDENTITY ──────────────────────────────── */}
                <View style={styles.identityStrip}>
                    <VehicleAvatar
                        status={drive.status}
                        fuelType="DIESEL"
                        size="sm"
                        showBadge={false}
                    />
                    <View style={styles.identityInfo}>
                        <Text style={styles.identityModel}>Audi A6 C4</Text>
                        <Text style={styles.identityVin}>{getVin().slice(-6)}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={openSearch}
                        accessibilityRole="button"
                        accessibilityLabel="Cauta in vehicul"
                    >
                        <Text style={styles.headerIconBtnText}>🔍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={openNotifications}
                        accessibilityRole="button"
                        accessibilityLabel={`Notificari${unreadCount > 0 ? `, ${unreadCount} necitite` : ''}`}
                    >
                        <Text style={styles.headerIconBtnText}>🔔</Text>
                        {unreadCount > 0 && (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── 0b. DASHBOARD SUMMARY ─────────────────────────────── */}
                <View style={styles.summaryStrip}>
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNum, { color: drive.status === 'optimal' || drive.status === 'good' ? colors.status.good : colors.status.caution }]}>
                            {drive.status === 'optimal' || drive.status === 'good' ? 'OK' : '⚠'}
                        </Text>
                        <Text style={styles.summaryLabel}>VEHICUL</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNum, { color: (observations?.length || 0) > 0 ? colors.status.caution : colors.status.good }]}>
                            {observations?.length || 0}
                        </Text>
                        <Text style={styles.summaryLabel}>PROBLEME</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryNum, { color: (upcoming?.length || 0) > 0 ? colors.status.monitor : colors.status.good }]}>
                            {upcoming?.length || 0}
                        </Text>
                        <Text style={styles.summaryLabel}>MENTENANȚĂ</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <TouchableOpacity style={styles.summaryItem} onPress={openNotifications}>
                        <Text style={[styles.summaryNum, { color: unreadCount > 0 ? colors.accent.default : colors.text.secondary }]}>
                            {unreadCount}
                        </Text>
                        <Text style={styles.summaryLabel}>NOTIFICĂRI</Text>
                    </TouchableOpacity>
                </View>

                {/* ── 1. HERO — răspuns direct la "Pot pleca?" ─────────── */}
                <HeroCard
                    title="POT PLECA CU MAȘINA?"
                    value={drive.answer}
                    description={heroDescription}
                    status={drive.status}
                    icon={drive.icon}
                    style={styles.hero}
                />

                {/* ── 2. STATUS AI — propoziția de context ─────────────── */}
                {subtitle ? (
                    <Card
                        variant="filled"
                        status={drive.status}
                        padding="sm"
                        style={styles.aiLine}
                    >
                        <Text style={styles.aiText}>{subtitle}</Text>
                    </Card>
                ) : null}

                {/* ── 3. RECOMANDAREA PRINCIPALĂ ───────────────────────── */}
                {hasObs && primaryObs ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('sections.observations') || 'Ce necesită atenție'}
                            size="sm"
                        />
                        <RecommendationCard
                            title={primaryObs.title}
                            description={buildPrimaryDescription(primaryObs)}
                            priority={SEVERITY_TO_PRIORITY[primaryObs.severity] || 'medium'}
                            icon={SEVERITY_TO_REC_ICON[primaryObs.severity] || '⚠'}
                            action={buildPrimaryAction(primaryObs)}
                        />
                    </View>
                ) : null}

                {/* ── 4. PREDICȚII SECUNDARE (max 2 + toggle) ──────────── */}
                {secondaryObs.length > 0 ? (
                    <View style={styles.sectionNoHeader}>
                        {visiblePreds.map((obs, i) => (
                            <PredictionCard
                                key={`pred-${i}`}
                                title={obs.title}
                                prediction={buildPredictionText(obs)}
                                confidence={obs.confidence?.toLowerCase?.() || 'medium'}
                                timeframe={buildTimeframe(obs)}
                                icon={SEVERITY_TO_REC_ICON[obs.severity] || '●'}
                                style={styles.cardGap}
                            />
                        ))}
                        {hiddenCount > 0 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                label={showAllPreds
                                    ? 'Arată mai puțin'
                                    : `Vezi toate (${secondaryObs.length})`}
                                onPress={() => setShowAllPreds(v => !v)}
                                style={styles.seeAllBtn}
                            />
                        ) : null}
                    </View>
                ) : null}

                {/* ── 5. CE SE APROPIE ─────────────────────────────────── */}
                {hasUpcoming ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('upcoming.sectionTitle') || 'Ce se apropie'}
                            size="sm"
                        />
                        {upcoming.map((item, i) => {
                            const m = getSeverityMaintenance(item.severity);
                            return (
                                <MaintenanceCard
                                    key={`upcoming-${i}`}
                                    title={item.component}
                                    subtitle={item.reason}
                                    dueDate={item.timeframe}
                                    status={m.status}
                                    urgency={m.urgency}
                                    style={i > 0 ? styles.cardGap : undefined}
                                />
                            );
                        })}
                    </View>
                ) : null}

                {/* ── 6. FAȚĂ DE CURSELE ANTERIOARE ────────────────────── */}
                {comparison ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('comparison.sectionTitle') || 'Față de luna trecută'}
                            size="sm"
                        />
                        <Card padding="md" style={styles.compCard}>
                            <View style={styles.compRow}>
                                <Text style={[styles.trendSymbol, { color: trendStyle.color }]}>
                                    {trendStyle.symbol}
                                </Text>
                                <View style={styles.compTextGroup}>
                                    <Text style={styles.compSummary}>{comparison.summary}</Text>
                                    {comparison.detail ? (
                                        <Text style={styles.compDetail}>{comparison.detail}</Text>
                                    ) : null}
                                </View>
                            </View>
                        </Card>
                    </View>
                ) : null}

                {/* ── 7. ULTIMUL EVENIMENT IMPORTANT ───────────────────── */}
                {lastEvent ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('lastEvent.sectionTitle') || 'Ultimul eveniment important'}
                            size="sm"
                        />
                        <TimelineCard
                            title={lastEvent.title}
                            description={lastEvent.description}
                            date={lastEvent.date}
                            time={lastEvent.meta}
                            type={lastEvent.type}
                            isFirst
                            isLast
                        />
                    </View>
                ) : null}

                {/* ── FĂRĂ DATE: mesaj calm ────────────────────────────── */}
                {!hasObs && !hasUpcoming && !comparison && !lastEvent ? (
                    <View style={styles.calmExtra}>
                        <Text style={styles.calmNote}>
                            {t('calm.message') || 'Nicio problemă detectată'}
                        </Text>
                    </View>
                ) : null}

                {/* ── 8. FOOTER — info despre analiza și date ──────────── */}
                {hasFooter ? (
                    <Card
                        variant="filled"
                        padding="sm"
                        style={styles.footerCard}
                    >
                        <View style={styles.footerRow}>
                            <View style={styles.footerItem}>
                                <Text style={styles.footerLabel}>{t('footer.lastAnalysis')}</Text>
                                <Text style={[styles.footerValue, styles.tabular]}>
                                    {formatDateTime(lastUpdated)}
                                </Text>
                            </View>
                            <View style={styles.footerSep} />
                            <View style={styles.footerItem}>
                                <Text style={styles.footerLabel}>{t('footer.dataCompleteness')}</Text>
                                {qualityInfo ? (
                                    <View style={styles.footerQualityRow}>
                                        <StatusBadge
                                            label={qualityInfo.label}
                                            status={qualityInfo.status}
                                            variant="dot"
                                            size="sm"
                                        />
                                        <Text style={styles.footerPct}>{qualityInfo.pct}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.footerValue}>—</Text>
                                )}
                            </View>
                            <View style={styles.footerSep} />
                            <View style={styles.footerItem}>
                                <Text style={styles.footerLabel}>{t('footer.lastSync')}</Text>
                                <Text style={styles.footerValue}>
                                    {formatRelative(lastUpdated)}
                                </Text>
                            </View>
                        </View>
                    </Card>
                ) : null}

            </ScrollView>
        </Animated.View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Stiluri
// ─────────────────────────────────────────────────────────────────────────────

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

    scroll: { flex: 1 },
    content: {
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[10],
        paddingTop: spacing[2],
    },

    // ── Vehicle identity ──────────────────────────────────────────────────
    identityStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginBottom: spacing[2],
        paddingHorizontal: spacing[1],
    },
    identityInfo: { flex: 1 },
    identityModel: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    identityVin: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        fontVariant: ['tabular-nums'],
    },
    headerIconBtn: {
        width: 32, height: 32, borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1, borderColor: colors.border.default,
        justifyContent: 'center', alignItems: 'center',
        position: 'relative',
    },
    headerIconBtnText: { fontSize: 14 },
    notifBadge: {
        position: 'absolute', top: -4, right: -4,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: colors.status.critical,
        justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 2,
    },
    notifBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: typography.weights.bold },

    // ── Dashboard Summary Strip ───────────────────────────────────────────
    summaryStrip: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1],
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
        overflow: 'hidden',
    },
    summaryItem: {
        flex: 1,
        paddingVertical: spacing[2] + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryNum: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        lineHeight: typography.sizes.title3 + 4,
    },
    summaryLabel: {
        fontSize: 8,
        fontWeight: typography.weights.bold,
        color: colors.text.disabled,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        backgroundColor: colors.border.subtle,
        alignSelf: 'stretch',
        marginVertical: spacing[2],
    },

    // ── Hero ──────────────────────────────────────────────────────────────
    hero: {
        marginBottom: spacing[3],
    },

    // ── AI Line ───────────────────────────────────────────────────────────
    aiLine: {
        marginBottom: layout.sectionGap + spacing[1],
    },
    aiText: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // ── Sections ──────────────────────────────────────────────────────────
    section: {
        marginTop: layout.interSectionGap - spacing[2],
    },
    sectionNoHeader: {
        marginTop: spacing[2],
    },
    cardGap: {
        marginTop: spacing[3],
    },

    // ── Predictions toggle ────────────────────────────────────────────────
    seeAllBtn: {
        marginTop: spacing[2],
        alignSelf: 'flex-start',
    },

    // ── Comparison ────────────────────────────────────────────────────────
    compCard: {},
    compRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[3],
    },
    trendSymbol: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.bold,
        lineHeight: typography.lineHeights.title2,
        marginTop: 1, // optical alignment
    },
    compTextGroup: {
        flex: 1,
        gap: spacing[1] + 2,
    },
    compSummary: {
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
        fontWeight: typography.weights.medium,
    },
    compDetail: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label1,
    },

    // ── Calm extra ────────────────────────────────────────────────────────
    calmExtra: {
        marginTop: spacing[6],
        alignItems: 'center',
        paddingHorizontal: spacing[8],
    },
    calmNote: {
        fontSize: typography.sizes.body2,
        color: colors.text.tertiary,
        textAlign: 'center',
        lineHeight: typography.lineHeights.body2,
    },

    // ── Footer data card ──────────────────────────────────────────────────
    footerCard: {
        marginTop: layout.interSectionGap,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[3],
    },
    footerItem: {
        flex: 1,
        gap: spacing[1],
    },
    footerSep: {
        width: 1,
        backgroundColor: colors.border.default,
        alignSelf: 'stretch',
        marginVertical: 2, // optical
    },
    footerLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        lineHeight: typography.lineHeights.caption,
    },
    footerValue: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.caption,
    },
    footerQualityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1],
        flexWrap: 'wrap',
    },
    footerPct: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        lineHeight: typography.lineHeights.caption,
    },
    tabular: { fontVariant: ['tabular-nums'] },

    // ── Skeleton ──────────────────────────────────────────────────────────
    skeletonWrap: {},
    skeletonGap:   { height: spacing[3] },
    skeletonGapSm: { height: spacing[2] },
});

export default StatusScreen;
