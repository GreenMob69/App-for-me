/**
 * MaintenanceScreen — Maintenance Center inteligent.
 *
 * Răspunde la: "Ce trebuie să fac la mașină și când?"
 * Read-only în acest sprint. Fără editare de date.
 *
 * Secțiuni: HeroCard → Atenție Acum → Urmează → Documente →
 *           Sănătate → Costuri → Istoric Service → Workshop → Footer
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    Animated,
    TouchableOpacity,
    Alert,
    Platform,
    StatusBar,
    Linking,
    StyleSheet,
} from 'react-native';
import { useScreenFadeIn } from '../utils/animations';
import { useNavigation } from '@react-navigation/native';
import { useVehicle } from '../context/VehicleContext';
import api from '../services/api';
import { fetchMaintenanceData, fetchDocuments } from '../services/vehicleService';
import { getDtcDescription, getDtcSeverityColor } from '../data/dtcCodes';
import { t } from '../i18n';
import { colors, typography, spacing, layout } from '../theme';

import {
    Card,
    SectionHeader,
    Button,
    Skeleton,
    HeroCard,
    MaintenanceCard,
    TimelineCard,
    DocumentCard,
    WorkshopCard,
    CostCard,
    HealthGauge,
    EmptyState,
    VehicleAvatar,
    BottomSheet,
    StatusBadge,
} from '../components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Mapări și helpers de date — nu traduse, rămân la nivel de modul
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS = {
    OIL_CHANGE:          'Schimb ulei',
    FILTER_OIL:          'Filtru ulei',
    FILTER_AIR:          'Filtru aer',
    FILTER_FUEL:         'Filtru combustibil',
    FILTER_CABIN:        'Filtru habitaclu',
    BRAKE_PADS_FRONT:    'Plăcuțe față',
    BRAKE_PADS_REAR:     'Plăcuțe spate',
    TIMING_BELT:         'Curea distribuție',
    SERPENTINE_BELT:     'Curea alternator',
    COOLANT_FLUSH:       'Antigel',
    BRAKE_FLUID:         'Lichid frână',
    SPARK_PLUGS:         'Bujii',
    TRANSMISSION_FLUID:  'Ulei transmisie',
};

// Starea hero a mentenanței
function buildHeroInfo(summary) {
    if (!summary) return {
        answer: t('maint.hero.noUrgent'),
        subtitle: t('maint.hero.noUrgentSub'),
        status: 'optimal',
        icon: '✓',
    };

    const { overdue = 0, due_soon = 0 } = summary;

    if (overdue >= 2) return {
        answer: t('maint.hero.manyOverdue', { count: overdue }),
        subtitle: t('maint.hero.manyOverdueSub'),
        status: 'critical',
        icon: '!',
    };
    if (overdue === 1) return {
        answer: t('maint.hero.oneOverdue'),
        subtitle: t('maint.hero.oneOverdueSub'),
        status: 'critical',
        icon: '!',
    };
    if (due_soon >= 2) return {
        answer: t('maint.hero.manyDueSoon', { count: due_soon }),
        subtitle: t('maint.hero.manyDueSoonSub'),
        status: 'monitor',
        icon: '⚠',
    };
    if (due_soon === 1) return {
        answer: t('maint.hero.oneDueSoon'),
        subtitle: t('maint.hero.oneDueSoonSub'),
        status: 'monitor',
        icon: '⚠',
    };
    return {
        answer: t('maint.hero.noUrgent'),
        subtitle: t('maint.hero.noUrgentSub'),
        status: 'optimal',
        icon: '✓',
    };
}

// Statut MaintenanceCard din statut backend
function mapItemStatus(backendStatus) {
    return backendStatus === 'OVERDUE' ? 'overdue' : 'upcoming';
}

// Urgency MaintenanceCard din item backend
function mapItemUrgency(item) {
    if (item.status === 'OVERDUE') return 'high';
    if (item.remaining_days != null && item.remaining_days <= 30) return 'high';
    if (item.remaining_km != null  && item.remaining_km  <= 2000) return 'high';
    if (item.remaining_days != null && item.remaining_days <= 60) return 'normal';
    if (item.remaining_km != null  && item.remaining_km  <= 5000) return 'normal';
    return 'low';
}

// Text dată scadentă
function buildDueDate(item) {
    if (item.status === 'OVERDUE') return t('maint.item.overdue');
    if (item.status === 'UNKNOWN') return t('maint.item.unknown');
    if (item.remaining_km && item.remaining_days)
        return t('maint.item.remaining', { km: item.remaining_km.toLocaleString(), days: item.remaining_days });
    if (item.remaining_km)
        return t('maint.item.remainingKm', { km: item.remaining_km.toLocaleString() });
    if (item.remaining_days)
        return t('maint.item.remainingDays', { days: item.remaining_days });
    return null;
}

// Text subtitlu (ultima revizie)
function buildItemSubtitle(item) {
    if (item.last_service_km)
        return t('maint.item.lastAtKm', { km: item.last_service_km.toLocaleString() });
    if (item.last_service_description) return item.last_service_description;
    return null;
}

// Titlu sesiune de service din tipuri
function buildServiceTitle(session) {
    if (session.title) return session.title;
    if (!session.types) return t('maint.history.serviceDefault');
    const types = session.types.split(',').map(t => t.trim());
    return types
        .slice(0, 2)
        .map(tp => SERVICE_TYPE_LABELS[tp] || tp)
        .join(', ');
}

// Formatare dată din Unix timestamp (secunde)
function formatServiceDate(unixTs) {
    if (!unixTs) return '';
    const d = new Date(unixTs * 1000);
    return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Formatare km estimat (cu separator mii)
function formatKm(km) {
    if (km == null) return '—';
    return `${Math.round(km).toLocaleString()} km`;
}

// Formatare timp relativ (lastUpdated este ISO string)
function formatRelative(iso) {
    if (!iso) return '—';
    const diffMs  = new Date() - new Date(iso);
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)  return 'Acum';
    if (diffMin < 60) return `Acum ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH  < 24)  return `Acum ${diffH} h`;
    return `Acum ${Math.floor(diffH / 24)} zile`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
    <View>
        <Skeleton variant="card" height={140} />
        <View style={styles.gapMd} />
        <Skeleton variant="text" height={typography.sizes.label1} width={140} />
        <View style={styles.gapSm} />
        <Skeleton variant="card" height={88} />
        <View style={styles.gapSm} />
        <Skeleton variant="card" height={88} />
        <View style={styles.gapMd} />
        <Skeleton variant="text" height={typography.sizes.label1} width={120} />
        <View style={styles.gapSm} />
        <Skeleton variant="card" height={72} />
        <View style={styles.gapSm} />
        <Skeleton variant="card" height={72} />
        <View style={styles.gapMd} />
        <Skeleton variant="card" height={180} />
        <View style={styles.gapMd} />
        <Skeleton variant="card" height={120} />
        <View style={styles.gapMd} />
        <Skeleton variant="card" height={100} />
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// MaintenanceScreen
// ─────────────────────────────────────────────────────────────────────────────

const MaintenanceScreen = () => {
    const navigation = useNavigation();
    const { activeVin, vehicleLabel } = useVehicle();
    const [screenState, setScreenState] = useState('loading');
    const [refreshing, setRefreshing]   = useState(false);
    const [maintData, setMaintData]     = useState(null);
    const [documents,  setDocuments]    = useState([]);
    const [showAllUrgent, setShowAllUrgent]   = useState(false);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [dtcData, setDtcData] = useState(null);
    const [peekMaintItem, setPeekMaintItem]     = useState(null);
    const [peekHistoryItem, setPeekHistoryItem] = useState(null);

    const screenFadeStyle = useScreenFadeIn(screenState);

    const loadMaintenance = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setScreenState('loading');
        try {
            const [data, docs] = await Promise.allSettled([
                fetchMaintenanceData(),
                fetchDocuments(),
            ]);
            const maintResult = data.status === 'fulfilled' ? data.value : null;
            setMaintData(maintResult);
            setDocuments(docs.status === 'fulfilled' ? docs.value : []);
            setShowAllUrgent(false);
            setShowAllHistory(false);
            const hasData = maintResult?.profile?.maintenance_summary?.items?.length > 0;
            setScreenState(hasData ? 'success' : 'empty');
        } catch {
            setScreenState(prev => prev === 'success' ? prev : 'error');
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadMaintenance();
        api.get(`/vehicul/${activeVin}/diagnoza`).then(r => setDtcData(r.data)).catch(() => {});
    }, [activeVin, loadMaintenance]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadMaintenance(true);
    }, [loadMaintenance]);

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
                    action={{ label: t('states.retry'), onPress: () => loadMaintenance() }}
                    size="lg"
                />
            </View>
        );
    }

    if (screenState === 'empty' || !maintData) {
        return (
            <View style={[styles.container, styles.center]}>
                <EmptyState
                    icon="🔧"
                    title={t('maint.empty.message')}
                    subtitle={t('maint.empty.subtitle')}
                    size="lg"
                />
            </View>
        );
    }

    // ── Date din model ───────────────────────────────────────────────────────

    const { profile, costs, health } = maintData;
    const summary   = profile?.maintenance_summary;
    const allItems  = summary?.items || [];
    const services  = profile?.recent_services || [];
    const workshops = profile?.workshops || [];
    const vehicle   = profile?.vehicle;

    // Hero
    const heroInfo = buildHeroInfo(summary);

    // Atenție Acum — OVERDUE + DUE_SOON
    const urgentAll = allItems.filter(i => i.status === 'OVERDUE' || i.status === 'DUE_SOON');
    const urgentVisible = showAllUrgent ? urgentAll : urgentAll.slice(0, 3);
    const urgentHidden  = urgentAll.length - 3;

    // Urmează — OK cu uzură ≥ 40% sau remaining < 8000 km sau < 90 zile
    const upcomingItems = allItems
        .filter(i => i.status === 'OK' && (
            (i.wear_percent != null && i.wear_percent >= 40) ||
            (i.remaining_km != null && i.remaining_km <= 8000) ||
            (i.remaining_days != null && i.remaining_days <= 90)
        ))
        .slice(0, 3);

    // Sănătate
    const healthScore   = profile?.health_score ?? health?.overallHealth ?? null;
    const dataQuality   = health?.dataQuality ?? null;
    const lastUpdated   = health?.lastUpdated ?? null;

    // Costuri
    const yearCost = costs ?? null;
    const costBreakdown = yearCost ? [
        { label: t('maint.costs.fuel'),    amount: yearCost.fuel    ?? 0, icon: '⛽' },
        { label: t('maint.costs.service'), amount: yearCost.service ?? 0, icon: '🔧' },
    ] : null;

    // Istoric service
    const historyAll     = services;
    const historyVisible = showAllHistory ? historyAll : historyAll.slice(0, 3);
    const historyHidden  = historyAll.length - 3;

    // Workshop — preferă trusted
    const workshop = workshops.find(w => w.is_trusted) || workshops[0] || null;

    // Footer
    const doneCount = allItems.filter(i => i.last_service_date).length;
    const estimatedKm = profile?.estimated_odometer_km ?? null;

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
                        status={heroInfo.status}
                        fuelType="DIESEL"
                        size="sm"
                        showBadge={false}
                    />
                    <View style={styles.identityInfo}>
                        <Text style={styles.identityModel}>{vehicleLabel || activeVin.slice(-6)}</Text>
                        <Text style={styles.identityVin}>{activeVin.slice(-6)}</Text>
                    </View>
                </View>

                {/* ── 1. HERO ──────────────────────────────────────────── */}
                <HeroCard
                    title={t('maint.hero.title')}
                    value={heroInfo.answer}
                    description={heroInfo.subtitle}
                    status={heroInfo.status}
                    icon={heroInfo.icon}
                    style={styles.hero}
                />

                {/* ── 2. ATENȚIE ACUM ──────────────────────────────────── */}
                {urgentAll.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('maint.sections.attentionNow')}
                            size="sm"
                        />
                        {urgentVisible.map((item, i) => (
                            <MaintenanceCard
                                key={`urgent-${item.id}`}
                                title={item.item_name}
                                subtitle={buildItemSubtitle(item)}
                                dueKm={item.next_due_km}
                                dueDate={buildDueDate(item)}
                                status={mapItemStatus(item.status)}
                                urgency={mapItemUrgency(item)}
                                onPress={() => setPeekMaintItem(item)}
                                style={i > 0 ? styles.cardGap : undefined}
                            />
                        ))}
                        {urgentHidden > 0 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                label={showAllUrgent
                                    ? 'Arată mai puțin'
                                    : `Vezi toate (${urgentAll.length})`}
                                onPress={() => setShowAllUrgent(v => !v)}
                                style={styles.seeAllBtn}
                            />
                        ) : null}
                    </View>
                ) : null}

                {/* ── 3. URMEAZĂ ───────────────────────────────────────── */}
                {upcomingItems.length > 0 ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('maint.sections.upcoming')}
                            size="sm"
                        />
                        {upcomingItems.map((item, i) => (
                            <MaintenanceCard
                                key={`upcoming-${item.id}`}
                                title={item.item_name}
                                subtitle={buildItemSubtitle(item)}
                                dueKm={item.next_due_km}
                                dueDate={buildDueDate(item)}
                                status="upcoming"
                                urgency={mapItemUrgency(item)}
                                onPress={() => setPeekMaintItem(item)}
                                style={i > 0 ? styles.cardGap : undefined}
                            />
                        ))}
                    </View>
                ) : (
                    urgentAll.length === 0 ? (
                        <View style={styles.section}>
                            <SectionHeader title={t('maint.sections.upcoming')} size="sm" />
                            <Card padding="md">
                                <Text style={styles.calmText}>
                                    Nicio intervenție programată în următoarele 3 luni.
                                </Text>
                            </Card>
                        </View>
                    ) : null
                )}

                {/* ── 4. DOCUMENTE ─────────────────────────────────────── */}
                <View style={styles.section}>
                    <SectionHeader
                        title={t('maint.sections.documents')}
                        size="sm"
                    />
                    {documents.length > 0 ? documents.map((doc, idx) => {
                        const statusToType = { EXPIRED: 'pdf', EXPIRING: 'doc', ACTIVE: 'xls' };
                        const expiryMs = doc.expiry_date
                            ? (doc.expiry_date < 1e11 ? doc.expiry_date * 1000 : doc.expiry_date)
                            : null;
                        const expiryText = expiryMs
                            ? new Date(expiryMs).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : undefined;
                        return (
                            <DocumentCard
                                key={doc.id ?? idx}
                                title={doc.title}
                                documentType={statusToType[doc.status] || 'other'}
                                category={doc.type}
                                date={expiryText}
                                style={styles.docCard}
                            />
                        );
                    }) : (
                        <Card padding="md">
                            <Text style={styles.calmText}>
                                Niciun document adăugat. Adaugă ITP, RCA și Rovinietă.
                            </Text>
                        </Card>
                    )}
                </View>

                {/* ── 5. SĂNĂTATEA VEHICULULUI ─────────────────────────── */}
                <View style={styles.section}>
                    <SectionHeader
                        title={t('maint.sections.healthSummary')}
                        size="sm"
                    />
                    <Card padding="md">
                        <View style={styles.healthRow}>
                            {healthScore != null ? (
                                <HealthGauge
                                    score={healthScore}
                                    size="sm"
                                />
                            ) : (
                                <View style={styles.healthGaugePlaceholder} />
                            )}
                            <View style={styles.healthMeta}>
                                {healthScore != null ? (
                                    <View style={styles.healthScoreRow}>
                                        <Text style={[styles.healthScore, styles.tabular]}>
                                            {healthScore}
                                        </Text>
                                        <Text style={styles.healthScoreUnit}>/100</Text>
                                    </View>
                                ) : null}
                                {dataQuality ? (
                                    <Text style={styles.healthDetail}>
                                        Date {dataQuality === 'HIGH' ? 'complete' : dataQuality === 'MEDIUM' ? 'parțiale' : 'limitate'}
                                    </Text>
                                ) : null}
                                {lastUpdated ? (
                                    <Text style={styles.healthDetail}>
                                        Analizat {formatRelative(lastUpdated)}
                                    </Text>
                                ) : null}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    label="Mergi la STARE →"
                                    onPress={() => navigation?.navigate('Stare')}
                                    style={styles.goToStatus}
                                />
                            </View>
                        </View>
                    </Card>
                </View>

                {/* ── 6. COSTURI ───────────────────────────────────────── */}
                {yearCost ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('maint.sections.costs')}
                            size="sm"
                        />
                        <CostCard
                            title={t('maint.costs.thisYear', { year: yearCost.year ?? new Date().getFullYear() })}
                            amount={yearCost.total ?? 0}
                            currency="RON"
                            breakdown={costBreakdown}
                        />
                    </View>
                ) : null}

                {/* ── 7. ISTORIC SERVICE ───────────────────────────────── */}
                <View style={styles.section}>
                    <SectionHeader
                        title={t('maint.sections.serviceHistory')}
                        size="sm"
                    />
                    {historyAll.length > 0 ? (
                        <>
                            {historyVisible.map((session, i) => (
                                <TimelineCard
                                    key={`service-${session.id}`}
                                    title={buildServiceTitle(session)}
                                    description={session.cost_total
                                        ? `${session.cost_total.toLocaleString()} RON`
                                        : null}
                                    date={formatServiceDate(session.performed_at)}
                                    time={session.mileage_km
                                        ? `${session.mileage_km.toLocaleString()} km`
                                        : null}
                                    type="maintenance"
                                    isFirst={i === 0}
                                    isLast={i === historyVisible.length - 1}
                                    onPress={() => setPeekHistoryItem(session)}
                                />
                            ))}
                            {historyHidden > 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    label={showAllHistory
                                        ? t('maint.history.seeLess')
                                        : t('maint.history.seeAll')}
                                    onPress={() => setShowAllHistory(v => !v)}
                                    style={styles.seeAllBtn}
                                />
                            ) : null}
                        </>
                    ) : (
                        <Card padding="md">
                            <Text style={styles.calmText}>{t('maint.history.noHistory')}</Text>
                        </Card>
                    )}
                </View>

                {/* ── 8. DIAGNOSTICĂ DTC ───────────────────────────────── */}
                {dtcData && (
                    <View style={styles.section}>
                        <SectionHeader title="Diagnostică OBD-II" size="sm" />
                        {dtcData.coduri_dtc?.length > 0 ? (
                            <>
                                {dtcData.coduri_dtc.map((e, i) => {
                                    const desc = e.descriere || getDtcDescription(e.cod) || 'Cod OBD-II detectat';
                                    const color = getDtcSeverityColor(e.severitate);
                                    return (
                                        <View key={`dtc-${i}`} style={[styles.dtcRow, i > 0 && styles.dtcRowBorder]}>
                                            <View style={[styles.dtcBullet, { backgroundColor: color }]} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.dtcCode}>{e.cod}</Text>
                                                <Text style={styles.dtcDesc}>{desc}</Text>
                                            </View>
                                            <Text style={[styles.dtcSev, { color }]}>
                                                {(e.severitate || 'INFO').toUpperCase()}
                                            </Text>
                                        </View>
                                    );
                                })}
                                <TouchableOpacity
                                    style={styles.dtcClearBtn}
                                    onPress={() =>
                                        Alert.alert(
                                            'Șterge erori',
                                            'Vrei să ștergi toate erorile OBD-II active?',
                                            [
                                                { text: 'Anulează', style: 'cancel' },
                                                { text: 'Șterge', style: 'destructive', onPress: async () => {
                                                    try {
                                                        await api.post(`/vehicul/${activeVin}/stergere-erori`);
                                                        setDtcData(d => ({ ...d, coduri_dtc: [], total_erori: 0 }));
                                                    } catch {
                                                        Alert.alert('Eroare', 'Nu s-a putut șterge.');
                                                    }
                                                }},
                                            ]
                                        )
                                    }
                                >
                                    <Text style={styles.dtcClearBtnText}>Șterge erori active</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <Card padding="md">
                                <Text style={styles.calmText}>
                                    Niciun cod DTC activ — sistemul este curat.
                                </Text>
                                <Text style={[styles.calmText, { marginTop: spacing[1] }]}>
                                    Tensiune: {dtcData.sistem_electric?.voltaj_curent?.toFixed(1)} V
                                    {' · '}Alternator: {dtcData.sistem_electric?.stare_alternator === 'OPTIM' ? '✓ Optim' : '⚠ Verificați'}
                                </Text>
                            </Card>
                        )}
                    </View>
                )}

                {/* ── 9. WORKSHOP ──────────────────────────────────────── */}
                {workshop ? (
                    <View style={styles.section}>
                        <SectionHeader
                            title={t('maint.sections.workshop')}
                            size="sm"
                        />
                        <WorkshopCard
                            name={workshop.name}
                            address={workshop.address}
                            rating={workshop.rating ?? null}
                            phone={workshop.phone}
                            certified={workshop.is_trusted === 1}
                            onCallPress={workshop.phone
                                ? () => Linking.openURL(`tel:${workshop.phone}`)
                                : undefined}
                        />
                    </View>
                ) : null}

                {/* ── 9. FOOTER INFO ───────────────────────────────────── */}
                <Card
                    variant="filled"
                    padding="sm"
                    style={styles.footerCard}
                >
                    <View style={styles.footerRow}>
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>{t('maint.footer.lastUpdate')}</Text>
                            <Text style={styles.footerValue}>{formatRelative(lastUpdated)}</Text>
                        </View>
                        <View style={styles.footerSep} />
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>{t('maint.footer.totalInterventions')}</Text>
                            <Text style={[styles.footerValue, styles.tabular]}>{doneCount}</Text>
                        </View>
                        <View style={styles.footerSep} />
                        <View style={styles.footerItem}>
                            <Text style={styles.footerLabel}>{t('maint.footer.estimatedKm')}</Text>
                            <Text style={[styles.footerValue, styles.tabular]}>
                                {formatKm(estimatedKm)}
                            </Text>
                        </View>
                    </View>
                </Card>

            </ScrollView>

            {/* ── Progressive Disclosure: Maintenance Item Peek Sheet ─────── */}
            <BottomSheet
                visible={!!peekMaintItem}
                onClose={() => setPeekMaintItem(null)}
                title="Detalii Lucrare Service"
            >
                {peekMaintItem && (
                    <ScrollView
                        style={styles.peekScroll}
                        contentContainerStyle={styles.peekScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.peekHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.peekTitle}>{peekMaintItem.item_name}</Text>
                                <Text style={styles.peekSubtitle}>
                                    {buildItemSubtitle(peekMaintItem)}
                                </Text>
                            </View>
                            <StatusBadge
                                status={peekMaintItem.status === 'OVERDUE' ? 'critical' : 'monitor'}
                                label={peekMaintItem.status === 'OVERDUE' ? 'DEPĂȘIT' : 'PROGRAMAT'}
                                variant="filled"
                                size="sm"
                            />
                        </View>

                        {/* Due status banner */}
                        <View style={[
                            styles.peekAlertBox,
                            peekMaintItem.status === 'OVERDUE'
                                ? { backgroundColor: 'rgba(235, 87, 87, 0.1)', borderColor: 'rgba(235, 87, 87, 0.3)' }
                                : { backgroundColor: 'rgba(77, 142, 245, 0.1)', borderColor: 'rgba(77, 142, 245, 0.3)' }
                        ]}>
                            <Text style={styles.peekAlertLabel}>Scadență / Rulaj rămas:</Text>
                            <Text style={[
                                styles.peekAlertVal,
                                { color: peekMaintItem.status === 'OVERDUE' ? colors.status.critical : colors.accent.default }
                            ]}>
                                {buildDueDate(peekMaintItem) || 'Conform planificării'}
                            </Text>
                        </View>

                        {/* 2x2 Metric Grid */}
                        <View style={styles.peekMetricsGrid}>
                            <View style={styles.peekMetricCard}>
                                <Text style={styles.peekMetricLabel}>KILOMETRAJ SCADENT</Text>
                                <Text style={styles.peekMetricVal}>
                                    {formatKm(peekMaintItem.next_due_km)}
                                </Text>
                            </View>

                            <View style={styles.peekMetricCard}>
                                <Text style={styles.peekMetricLabel}>ESTIMARE COST</Text>
                                <Text style={styles.peekMetricVal}>
                                    {peekMaintItem.estimated_cost ? `${peekMaintItem.estimated_cost} RON` : '~300 - 500 RON'}
                                </Text>
                            </View>
                        </View>

                        {/* Technical OE info */}
                        <View style={styles.peekDescBox}>
                            <Text style={styles.peekDescTitle}>RECOMANDARE TEHNICĂ & SPECIFICAȚIE OE</Text>
                            <Text style={styles.peekDescText}>
                                {peekMaintItem.item_name?.toLowerCase().includes('ulei')
                                    ? 'Normă VW 505.00 / 505.01 (Synthetic 5W-40). Capacitate baie: ~4.5L. Înlocuiți obligatoriu și filtrul de ulei + șaiba de cupru la bușon.'
                                    : peekMaintItem.item_name?.toLowerCase().includes('frân')
                                    ? 'Grosime minimă garnituri de fricțiune: 3.0 mm. Verificați și nivelul / umiditatea lichidului de frână DOT 4.'
                                    : peekMaintItem.item_name?.toLowerCase().includes('distribu')
                                    ? 'Kit complet curea dințată + rolă întinzătoare + pompă de apă. Risc mecanic ridicat în caz de depășire a intervalului!'
                                    : 'Utilizați doar piese omologate conform specificațiilor producătorului pentru menținerea fiabilității.'}
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.peekActions}>
                            <Button
                                variant="primary"
                                label="Consultă AI Expert pentru procedură & piese 💬"
                                onPress={() => {
                                    const itm = peekMaintItem;
                                    setPeekMaintItem(null);
                                    navigation?.navigate('AIExpert', {
                                        initialPrompt: `Am de efectuat lucrarea de mentenanță "${itm.item_name}". Ce coduri de piese OE, specificații tehnice și sfaturi de montaj recomanzi?`,
                                    });
                                }}
                                style={styles.peekBtn}
                            />
                            {workshop?.phone ? (
                                <Button
                                    variant="secondary"
                                    label={`Sună la ${workshop.name || 'Service'} 📞`}
                                    onPress={() => {
                                        Linking.openURL(`tel:${workshop.phone}`);
                                    }}
                                    style={styles.peekBtn}
                                />
                            ) : null}
                        </View>
                    </ScrollView>
                )}
            </BottomSheet>

            {/* ── Progressive Disclosure: History Item Peek Sheet ─────────── */}
            <BottomSheet
                visible={!!peekHistoryItem}
                onClose={() => setPeekHistoryItem(null)}
                title="Detalii Intervenție Trecută"
            >
                {peekHistoryItem && (
                    <ScrollView
                        style={styles.peekScroll}
                        contentContainerStyle={styles.peekScrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.peekHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.peekTitle}>{buildServiceTitle(peekHistoryItem)}</Text>
                                <Text style={styles.peekSubtitle}>
                                    Data: {formatServiceDate(peekHistoryItem.performed_at)}
                                </Text>
                            </View>
                            <StatusBadge
                                status="good"
                                label="FINALIZAT"
                                variant="filled"
                                size="sm"
                            />
                        </View>

                        <View style={styles.peekMetricsGrid}>
                            <View style={styles.peekMetricCard}>
                                <Text style={styles.peekMetricLabel}>RULAJ LA SERVICE</Text>
                                <Text style={styles.peekMetricVal}>
                                    {formatKm(peekHistoryItem.mileage_km)}
                                </Text>
                            </View>

                            <View style={styles.peekMetricCard}>
                                <Text style={styles.peekMetricLabel}>TOTAL ACHITAT</Text>
                                <Text style={[styles.peekMetricVal, { color: colors.status.good }]}>
                                    {peekHistoryItem.cost_total ? `${peekHistoryItem.cost_total.toLocaleString()} RON` : 'Neînregistrat'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.peekDescBox}>
                            <Text style={styles.peekDescTitle}>ATELIER & DETALII INTERVENȚIE</Text>
                            <Text style={styles.peekDescText}>
                                {peekHistoryItem.workshop_name
                                    ? `Efectuat la: ${peekHistoryItem.workshop_name}`
                                    : 'Efectuat în regie proprie sau service autorizat.'}
                                {'\n\n'}
                                {peekHistoryItem.notes || 'Intervenție validată în carnetul electronic de service.'}
                            </Text>
                        </View>

                        <View style={styles.peekActions}>
                            <Button
                                variant="primary"
                                label="Întreabă AI când trebuie repetată 💬"
                                onPress={() => {
                                    const s = peekHistoryItem;
                                    setPeekHistoryItem(null);
                                    navigation?.navigate('AIExpert', {
                                        initialPrompt: `Am efectuat lucrarea "${buildServiceTitle(s)}" la kilometrajul ${s.mileage_km || 'curent'}. Când este recomandat să o repet și la ce semne să fiu atent?`,
                                    });
                                }}
                                style={styles.peekBtn}
                            />
                        </View>
                    </ScrollView>
                )}
            </BottomSheet>
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

    // ── Gaps ─────────────────────────────────────────────────────────────
    gapSm: { height: spacing[2] },
    gapMd: { height: spacing[3] },

    // ── Vehicle identity ─────────────────────────────────────────────────
    identityStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginBottom: spacing[3],
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

    // ── Hero ─────────────────────────────────────────────────────────────
    hero: { marginBottom: spacing[3] },

    // ── Sections ─────────────────────────────────────────────────────────
    section: {
        marginTop: layout.interSectionGap - spacing[2],
    },
    cardGap: {
        marginTop: spacing[3],
    },

    // ── Buttons ──────────────────────────────────────────────────────────
    seeAllBtn: {
        marginTop: spacing[2],
        alignSelf: 'flex-start',
    },

    // ── Documents ────────────────────────────────────────────────────────
    docCard: {
        marginTop: spacing[2],
    },

    // ── Health summary ────────────────────────────────────────────────────
    healthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[4],
    },
    healthGaugePlaceholder: {
        width: 120,
        height: 66, // half of sm gauge size
    },
    healthMeta: {
        flex: 1,
        gap: spacing[1],
    },
    healthScoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing[1],
    },
    healthScore: {
        fontSize: typography.sizes.title1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.title1,
    },
    healthScoreUnit: {
        fontSize: typography.sizes.body2,
        color: colors.text.tertiary,
        fontWeight: typography.weights.regular,
    },
    healthDetail: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.caption,
    },
    goToStatus: {
        marginTop: spacing[2],
        alignSelf: 'flex-start',
    },

    // ── Calm text (empty sections) ────────────────────────────────────────
    calmText: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
        textAlign: 'center',
    },

    // ── DTC ──────────────────────────────────────────────────────────────
    dtcRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing[3],
        backgroundColor: colors.bg[1],
        paddingHorizontal: spacing[4],
        gap: spacing[3],
    },
    dtcRowBorder: {
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    dtcBullet: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
        flexShrink: 0,
    },
    dtcCode: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    dtcDesc: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: 2,
        lineHeight: 16,
    },
    dtcSev: {
        fontSize: 9,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        marginTop: 3,
    },
    dtcClearBtn: {
        marginTop: spacing[2],
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        alignItems: 'center',
        backgroundColor: colors.bg[1],
    },
    dtcClearBtnText: {
        fontSize: typography.sizes.label2,
        color: colors.status.critical,
        fontWeight: typography.weights.semibold,
    },

    // ── Footer ───────────────────────────────────────────────────────────
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
    tabular: { fontVariant: ['tabular-nums'] },

    // ── Peek BottomSheet Styles ───────────────────────────────────────────────
    peekScroll: {
        maxHeight: 520,
    },
    peekScrollContent: {
        paddingHorizontal: spacing[5],
        paddingBottom: spacing[5],
    },
    peekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[3],
    },
    peekTitle: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    peekSubtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    peekAlertBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: radii.md,
        padding: spacing[3],
        marginBottom: spacing[4],
    },
    peekAlertLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    peekAlertVal: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    peekMetricsGrid: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[4],
    },
    peekMetricCard: {
        flex: 1,
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3],
    },
    peekMetricLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    peekMetricVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    peekDescBox: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
        marginBottom: spacing[4],
    },
    peekDescTitle: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.8,
        marginBottom: spacing[1],
    },
    peekDescText: {
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        lineHeight: 20,
    },
    peekActions: {
        gap: spacing[2],
        marginTop: spacing[2],
    },
    peekBtn: {
        width: '100%',
    },
});

export default MaintenanceScreen;
