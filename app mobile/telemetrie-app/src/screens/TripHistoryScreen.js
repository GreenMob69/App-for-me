import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, ScrollView,
    TouchableOpacity, Share, RefreshControl, Platform, StatusBar,
    useWindowDimensions,
} from 'react-native';
import api from '../services/api';
import { getVin } from '../utils/config';
import {
    HeroCard,
    SearchBar,
    StatusBadge,
    TimelineCard,
    MetricCard,
    CostCard,
    EmptyState,
    SectionHeader,
    Button,
    BottomSheet,
} from '../components/ui';
import TripDetailScreen from './TripDetailScreen';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = [
    { key: 'ALL',   label: 'Toate'     },
    { key: 'TODAY', label: 'Astăzi'    },
    { key: 'WEEK',  label: 'Săptămâna' },
    { key: 'MONTH', label: 'Luna'      },
];

const MONTH_NAMES = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// toISOString() returnează UTC, ceea ce în România (UTC+3) înseamnă data de ieri.
// Folosim getFullYear/getMonth/getDate pentru a obține data locală corectă.
function localDateStr(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function getFilterDates(filter) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
        case 'TODAY': {
            const s = localDateStr(today);
            return { startDate: s, endDate: s };
        }
        case 'WEEK': {
            const w = new Date(today);
            w.setDate(w.getDate() - 7);
            return { startDate: localDateStr(w), endDate: null };
        }
        case 'MONTH': {
            const m = new Date(today.getFullYear(), today.getMonth(), 1);
            return { startDate: localDateStr(m), endDate: null };
        }
        default:
            return { startDate: null, endDate: null };
    }
}

function formatTripDate(ts) {
    if (!ts) return '';
    const date    = new Date(ts);
    const now     = new Date();
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tripMs  = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.round((todayMs - tripMs) / 86400000);

    if (diffDays === 0) return 'Astăzi';
    if (diffDays === 1) return 'Ieri';
    if (diffDays < 7)  return `Acum ${diffDays} zile`;
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

function formatTripTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function buildTripTitle(trip) {
    const km   = parseFloat(trip.km_parcursi || 0);
    const hour = trip.timestamp_start ? new Date(trip.timestamp_start).getHours() : 12;

    const timeCtx =
        (hour >= 5  && hour < 10) ? 'de dimineață' :
        (hour >= 10 && hour < 13) ? 'de zi' :
        (hour >= 13 && hour < 17) ? 'de după-amiază' :
        (hour >= 17 && hour < 22) ? 'de seară' : 'de noapte';

    if (km < 2)  return `Deplasare ${timeCtx}`;
    if (km < 15) return `Drum ${timeCtx}`;
    if (km < 60) return `Drum ${timeCtx} · ${km.toFixed(0)} km`;
    return `Drum lung · ${km.toFixed(0)} km`;
}

function buildTripDesc(trip) {
    const km    = parseFloat(trip.km_parcursi || 0);
    const cons  = parseFloat(trip.consum_mediu_100km || 0);
    const start = trip.timestamp_start;
    const end   = trip.timestamp_end;
    const dur   = (end && start) ? Math.round((end - start) / 60000) : 0;

    const parts = [];
    if (cons > 0)                parts.push(`${cons.toFixed(1)} L/100km`);
    if (km > 0 && dur > 0) {
        const avg = Math.round((km / dur) * 60);
        if (avg > 5 && avg < 250) parts.push(`~${avg} km/h`);
    }
    if (dur > 0) parts.push(`${dur} min`);

    return parts.join(' · ') || '—';
}

function buildTripBadges(trip) {
    const hasDTC    = (trip.nr_dtc    || 0) > 0;
    const hasAlerts = (trip.nr_alerte || 0) > 0;
    const coolantMx = parseFloat(trip.coolant_max || 0);
    const cons      = parseFloat(trip.consum_mediu_100km || 0);
    const eco       = trip.scor_eco || 100;

    const badges = [];
    if (hasDTC)               badges.push({ label: 'Erori DTC',      status: 'critical' });
    else if (coolantMx > 100) badges.push({ label: 'Supraîncălzire', status: 'critical' });
    else if (hasAlerts)       badges.push({ label: 'Alerte',          status: 'caution'  });
    else if (cons > 9)        badges.push({ label: 'Consum ridicat',  status: 'monitor'  });
    else                      badges.push({ label: 'Normal',           status: 'good'     });

    if (eco >= 90 && !hasDTC && !hasAlerts) {
        badges.push({ label: 'Eco', status: 'optimal' });
    }
    return badges;
}

function getTripType(trip) {
    if ((trip.nr_dtc || 0) > 0 || parseFloat(trip.coolant_max || 0) > 100) return 'alert';
    if ((trip.nr_alerte || 0) > 0) return 'alert';
    return 'trip';
}

function buildHeroInfo(trips, stats) {
    if (!trips || trips.length === 0) {
        return {
            value: '0', unit: 'curse',
            subtitle: 'Nicio cursă înregistrată încă.',
            description: 'Efectuează prima cursă pentru a vedea jurnalul.',
            status: 'neutral',
        };
    }
    const recent   = trips.slice(0, 5);
    const anyDTC   = recent.some(t => (t.nr_dtc     || 0) > 0);
    const anyCool  = recent.some(t => (t.coolant_max || 0) > 100);
    const highCons = recent.some(t => parseFloat(t.consum_mediu_100km || 0) > 9);
    const avgEco   = Math.round(recent.reduce((s, t) => s + (t.scor_eco || 100), 0) / recent.length);
    const ecoDisp  = String(Math.round(stats.scor_mediu || avgEco));
    const cnt      = recent.length;

    if (anyDTC || anyCool) return {
        value: ecoDisp, unit: '/100',
        subtitle: 'Am observat probleme la cursele recente.',
        description: 'Verifică cursele marcate cu roșu mai jos.',
        status: 'caution',
    };
    if (highCons) return {
        value: ecoDisp, unit: '/100',
        subtitle: 'Consumul a crescut în ultima perioadă.',
        description: 'Ultimele curse au un consum mai ridicat decât de obicei.',
        status: 'monitor',
    };
    if (avgEco >= 90) return {
        value: ecoDisp, unit: '/100',
        subtitle: `Ultimele ${cnt} curse au fost excelente.`,
        description: 'Condus economic și fără probleme detectate.',
        status: 'optimal',
    };
    return {
        value: ecoDisp, unit: '/100',
        subtitle: `Ultimele ${cnt} curse au fost normale.`,
        description: 'Nicio problemă importantă detectată.',
        status: 'good',
    };
}

function buildMonthlyHeroText(data) {
    if (!data || !data.totalTrips) return { text: 'Nu am date pentru această lună.', status: 'neutral' };
    const km   = parseFloat(data.totalKm     || 0);
    const cons = parseFloat(data.consumMediu100 || 0);
    const eco  = data.avgEcoScore  || 100;
    const hlth = data.avgHealthScore;

    let text = `${data.totalTrips} curse · ${km.toFixed(0)} km parcurși`;
    if (cons > 0) text += `, ${cons.toFixed(1)} L/100km medie`;
    text += '.';

    let status = 'good';
    if (hlth && hlth < 70) { text += ' Am detectat probleme la câteva curse.'; status = 'caution'; }
    else if (eco >= 88)    { text += ' Conducere economică. Bine!';             status = 'optimal'; }
    else                   { text += ' Nicio problemă importantă detectată.'; }

    return { text, status };
}

// ─── Component ────────────────────────────────────────────────────────────────

const TripHistoryScreen = () => {
    const { width: screenWidth } = useWindowDimensions();
    const metricCardStyle = useMemo(() => ({
        width:        screenWidth >= 600 ? '32%' : '48.5%',
        marginBottom: spacing[3],
    }), [screenWidth]);

    const [screenState,    setScreenState]    = useState('loading');
    const [refreshing,     setRefreshing]     = useState(false);
    const [trips,          setTrips]          = useState([]);
    const [stats,          setStats]          = useState({});
    const [search,         setSearch]         = useState('');
    const [activeFilter,   setActiveFilter]   = useState('ALL');
    const [selectedTripId, setSelectedTripId] = useState(null);
    const [showReport,     setShowReport]     = useState(false);
    const [monthlyData,    setMonthlyData]    = useState(null);
    const [reportLoading,  setReportLoading]  = useState(false);
    const [reportMonth,    setReportMonth]    = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    });

    const loadData = useCallback(async () => {
        setScreenState(prev => prev === 'success' ? 'success' : 'loading');
        try {
            const { startDate, endDate } = getFilterDates(activeFilter);
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate)   params.endDate   = endDate;

            const [tripsRes, statsRes] = await Promise.allSettled([
                api.get('/calatorii/filtrate', { params }),
                api.get(`/vehicul/${getVin()}/statistici`),
            ]);

            setTrips(tripsRes.status === 'fulfilled' ? (tripsRes.value.data || []) : []);
            setStats(statsRes.status === 'fulfilled' ? (statsRes.value.data || {}) : {});
            setScreenState('success');
        } catch {
            setScreenState(prev => prev === 'success' ? prev : 'error');
        }
    }, [activeFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await loadData(); }
        finally { setRefreshing(false); }
    }, [loadData]);

    const fetchMonthlyReport = useCallback(async () => {
        const [year, month] = reportMonth.split('-');
        if (!year || !month) return;
        setReportLoading(true);
        setMonthlyData(null);
        try {
            const res = await api.get(`/rapoarte/lunar/${year}/${month}`);
            setMonthlyData(res.data);
        } catch {
            setMonthlyData(null);
        } finally {
            setReportLoading(false);
        }
    }, [reportMonth]);

    const filteredTrips = useMemo(() => {
        if (!search.trim()) return trips;
        const q = search.toLowerCase();
        return trips.filter(trip => {
            const title = buildTripTitle(trip).toLowerCase();
            const date  = formatTripDate(trip.timestamp_start).toLowerCase();
            const km    = String(Math.round(trip.km_parcursi || 0));
            const cons  = String(trip.consum_mediu_100km || '');
            const bgs   = buildTripBadges(trip).map(b => b.label.toLowerCase()).join(' ');
            return title.includes(q) || date.includes(q) || km.includes(q) || cons.includes(q) || bgs.includes(q);
        });
    }, [trips, search]);

    const heroInfo = useMemo(() => buildHeroInfo(trips, stats), [trips, stats]);

    // renderItem trebuie declarat ÎNAINTE de orice early return (Rules of Hooks)
    const renderItem = useCallback(({ item: trip, index }) => {
        const isFirst = index === 0;
        const isLast  = index === filteredTrips.length - 1;
        const badges  = buildTripBadges(trip);

        return (
            <View>
                <TimelineCard
                    title={buildTripTitle(trip)}
                    description={buildTripDesc(trip)}
                    date={formatTripDate(trip.timestamp_start)}
                    time={formatTripTime(trip.timestamp_start)}
                    type={getTripType(trip)}
                    isFirst={isFirst}
                    isLast={isLast}
                    onPress={() => setSelectedTripId(trip.id_calatorie)}
                />
                {badges.length > 0 && (
                    <View style={[styles.badgesRow, isLast && styles.badgesRowLast]}>
                        {badges.map(b => (
                            <StatusBadge
                                key={b.label}
                                status={b.status}
                                label={b.label}
                                variant="filled"
                                size="sm"
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    }, [filteredTrips]);

    // ─── Trip Detail (inline rendering — navigation prepare in Sprint 3.5) ───
    if (selectedTripId !== null) {
        return (
            <TripDetailScreen
                tripId={selectedTripId}
                onBack={() => { setSelectedTripId(null); loadData(); }}
            />
        );
    }

    if (screenState === 'loading') {
        return (
            <View style={styles.main}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Jurnal</Text>
                        <Text style={styles.subtitle}>Audi A6 C4 · Logbook</Text>
                    </View>
                </View>
                <View style={[{ flex: 1, paddingHorizontal: layout.screenPaddingH, paddingTop: spacing[4] }]}>
                    <HeroCard
                        value="…"
                        unit="/100"
                        title="JURNALUL MAȘINII"
                        subtitle="Se încarcă istoricul..."
                        status="neutral"
                        loading
                    />
                </View>
            </View>
        );
    }

    if (screenState === 'error') {
        return (
            <View style={[styles.main, styles.center]}>
                <EmptyState
                    title="Nu mă pot conecta la server."
                    subtitle="Verifică conexiunea și încearcă din nou."
                    action={{ label: 'Încearcă din nou', onPress: loadData }}
                    style={{ paddingHorizontal: layout.screenPaddingH }}
                />
            </View>
        );
    }

    // ─── Monthly report share ─────────────────────────────────────────────────
    const shareMonthly = () => {
        if (!monthlyData) return;
        const [yr, mo] = reportMonth.split('-');
        const monthName = MONTH_NAMES[parseInt(mo, 10) - 1] || mo;
        const text = [
            `RAPORT LUNAR — ${monthName} ${yr}`,
            'Audi A6 C4 · 2.5 TDI', '',
            `Curse: ${monthlyData.totalTrips}`,
            `Distanță: ${monthlyData.totalKm} km`,
            `Combustibil: ${monthlyData.totalLitri} L`,
            `Consum mediu: ${monthlyData.consumMediu100} L/100km`,
            `Cost total: ${monthlyData.totalCost} RON`,
            `Emisii CO₂: ${monthlyData.totalCO2} kg`,
            `Eco Score mediu: ${monthlyData.avgEcoScore}`,
            monthlyData.avgHealthScore ? `Health Score: ${monthlyData.avgHealthScore}%` : '',
            '', 'Generat de OBD-II Monitor',
        ].filter(Boolean).join('\n');
        Share.share({ message: text, title: `Raport ${monthName} ${yr}` });
    };

    // ─── Non-hook helpers (după early returns) ───────────────────────────────
    const [yr, mo] = reportMonth.split('-');
    const monthLabel = (mo && yr)
        ? `${MONTH_NAMES[parseInt(mo, 10) - 1] || mo} ${yr}`
        : reportMonth;

    const monthlyHero = monthlyData ? buildMonthlyHeroText(monthlyData) : null;

    const ListHeader = () => (
        <View>
            <HeroCard
                value={heroInfo.value}
                unit={heroInfo.unit}
                title="JURNALUL MAȘINII"
                subtitle={heroInfo.subtitle}
                description={heroInfo.description}
                status={heroInfo.status}
                style={styles.heroCard}
            />
            <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Caută curse, date, km, etichete..."
                style={styles.searchBar}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.chip, activeFilter === f.key && styles.chipActive]}
                        onPress={() => setActiveFilter(f.key)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Filtrează: ${f.label}`}
                        accessibilityState={{ checked: activeFilter === f.key }}
                    >
                        <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            {filteredTrips.length > 0 && (
                <SectionHeader
                    title={`${filteredTrips.length} ${filteredTrips.length === 1 ? 'CURSĂ' : 'CURSE'}`}
                    size="sm"
                    style={styles.sectionHeader}
                />
            )}
        </View>
    );

    const ListEmpty = () => (
        <EmptyState
            title="Nicio cursă în această perioadă."
            subtitle="Cursele înregistrate vor apărea aici ca jurnal."
            action={(activeFilter !== 'ALL' || search.trim()) ? {
                label: 'Resetează filtrele',
                onPress: () => { setActiveFilter('ALL'); setSearch(''); },
            } : undefined}
            style={styles.emptyState}
        />
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.main}>
            {/* ── Header ───────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Jurnal</Text>
                    <Text style={styles.subtitle}>Audi A6 C4 · Logbook</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={loadData}
                        accessibilityRole="button"
                        accessibilityLabel="Reîncarcă lista de curse"
                    >
                        <Text style={styles.iconBtnText}>↺</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconBtn, styles.iconBtnAccent]}
                        onPress={() => setShowReport(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Deschide raportul lunar"
                    >
                        <Text style={[styles.iconBtnText, { color: '#FFFFFF' }]}>Raport</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Trip timeline ─────────────────────────────────────────────── */}
            <FlatList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                data={filteredTrips}
                keyExtractor={item => String(item.id_calatorie)}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={ListEmpty}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                initialNumToRender={12}
                maxToRenderPerBatch={12}
                windowSize={7}
                removeClippedSubviews
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.accent.default}
                        colors={[colors.accent.default]}
                    />
                }
            />

            {/* ── Monthly Report — BottomSheet ─────────────────────────────── */}
            <BottomSheet visible={showReport} onClose={() => setShowReport(false)} title="Raport Lunar">
                <View style={styles.sheetContent}>
                        {/* Month quick-select chips */}
                        <View style={styles.monthRow}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                {[0, 1, 2, 3].map(offset => {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - offset);
                                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    const lbl = MONTH_NAMES[d.getMonth()].slice(0, 3);
                                    return (
                                        <TouchableOpacity
                                            key={val}
                                            style={[styles.chip, reportMonth === val && styles.chipActive]}
                                            onPress={() => setReportMonth(val)}
                                            accessibilityRole="radio"
                                            accessibilityLabel={MONTH_NAMES[d.getMonth()]}
                                            accessibilityState={{ checked: reportMonth === val }}
                                        >
                                            <Text style={[styles.chipText, reportMonth === val && styles.chipTextActive]}>
                                                {lbl}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            <TouchableOpacity
                                style={[styles.iconBtn, styles.iconBtnAccent, { marginLeft: spacing[2] }]}
                                onPress={fetchMonthlyReport}
                                accessibilityRole="button"
                                accessibilityLabel={reportLoading ? 'Se generează raportul' : 'Generează raportul lunar'}
                            >
                                <Text style={[styles.iconBtnText, { color: '#FFFFFF' }]}>
                                    {reportLoading ? '...' : 'Vezi'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            {/* HeroCard — AI summary */}
                            {monthlyData && monthlyHero && (
                                <HeroCard
                                    value={String(parseFloat(monthlyData.totalKm || 0).toFixed(0))}
                                    unit="km"
                                    title={monthLabel.toUpperCase()}
                                    subtitle={monthlyHero.text}
                                    status={monthlyHero.status}
                                    style={styles.reportSection}
                                />
                            )}

                            {/* CostCard — total cost */}
                            {monthlyData && parseFloat(monthlyData.totalCost || 0) > 0 && (
                                <CostCard
                                    title="Costuri deplasare"
                                    amount={parseFloat(monthlyData.totalCost || 0)}
                                    currency="RON"
                                    period={monthLabel}
                                    breakdown={[
                                        { label: 'Combustibil', amount: parseFloat(monthlyData.totalCost || 0) },
                                    ]}
                                    style={styles.reportSection}
                                />
                            )}

                            {/* MetricCards grid */}
                            {monthlyData && monthlyData.totalTrips > 0 && (
                                <View style={styles.metricsGrid}>
                                    <MetricCard
                                        label="L/100KM"
                                        value={parseFloat(monthlyData.consumMediu100 || 0).toFixed(1)}
                                        unit="medie"
                                        size="sm"
                                        style={metricCardStyle}
                                    />
                                    <MetricCard
                                        label="ECO SCORE"
                                        value={monthlyData.avgEcoScore || 100}
                                        unit="/100"
                                        size="sm"
                                        status={(monthlyData.avgEcoScore || 100) >= 80 ? 'good' : 'monitor'}
                                        style={metricCardStyle}
                                    />
                                    <MetricCard
                                        label="LITRI"
                                        value={parseFloat(monthlyData.totalLitri || 0).toFixed(0)}
                                        unit="L"
                                        size="sm"
                                        style={metricCardStyle}
                                    />
                                    <MetricCard
                                        label="CO₂"
                                        value={parseFloat(monthlyData.totalCO2 || 0).toFixed(1)}
                                        unit="kg"
                                        size="sm"
                                        style={metricCardStyle}
                                    />
                                    <MetricCard
                                        label="TIMP"
                                        value={monthlyData.totalDurataMin || 0}
                                        unit="min"
                                        size="sm"
                                        style={metricCardStyle}
                                    />
                                    {monthlyData.avgHealthScore ? (
                                        <MetricCard
                                            label="HEALTH"
                                            value={monthlyData.avgHealthScore}
                                            unit="%"
                                            size="sm"
                                            status={monthlyData.avgHealthScore >= 80 ? 'good' : 'monitor'}
                                            style={metricCardStyle}
                                        />
                                    ) : (
                                        <MetricCard
                                            label="CURSE"
                                            value={monthlyData.totalTrips}
                                            unit="total"
                                            size="sm"
                                            style={metricCardStyle}
                                        />
                                    )}
                                </View>
                            )}

                            {/* Empty / prompt states */}
                            {!monthlyData && !reportLoading && (
                                <EmptyState
                                    title="Selectează o lună."
                                    subtitle="Apasă 'Vezi' pentru a genera raportul lunar."
                                    style={styles.reportEmpty}
                                />
                            )}
                            {monthlyData && monthlyData.totalTrips === 0 && (
                                <EmptyState
                                    title="Nicio cursă în această lună."
                                    subtitle={`Nu am date înregistrate pentru ${monthLabel}.`}
                                    style={styles.reportEmpty}
                                />
                            )}

                            {/* Share */}
                            {monthlyData && monthlyData.totalTrips > 0 && (
                                <Button
                                    label="Descarcă / Trimite raportul"
                                    variant="primary"
                                    onPress={shareMonthly}
                                    style={styles.shareBtn}
                                />
                            )}
                        </ScrollView>
                </View>
            </BottomSheet>
        </View>
    );
};

const styles = StyleSheet.create({
    main: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    center: { justifyContent: 'center', alignItems: 'center' },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    title:    { fontSize: typography.sizes.title3, fontWeight: typography.weights.bold, color: colors.text.primary },
    subtitle: { fontSize: typography.sizes.caption, color: colors.text.secondary, marginTop: spacing[1] - 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    iconBtn: {
        height: 32,
        paddingHorizontal: spacing[3],
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 32,
    },
    iconBtnAccent: { backgroundColor: colors.accent.default, borderColor: colors.accent.default },
    iconBtnText: { color: colors.text.secondary, fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },

    // ── List ──────────────────────────────────────────────────────────────────
    list: { flex: 1 },
    listContent: { paddingHorizontal: layout.screenPaddingH, paddingBottom: spacing[12] },

    // ── List header ───────────────────────────────────────────────────────────
    heroCard:      { marginTop: spacing[4], marginBottom: spacing[3] },
    searchBar:     { marginBottom: spacing[3] },
    filterRow:     { marginBottom: spacing[2] },
    sectionHeader: { marginTop: spacing[2], marginBottom: spacing[1] },
    chip: {
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginRight: spacing[2],
    },
    chipActive:     { backgroundColor: colors.accent.default, borderColor: colors.accent.default },
    chipText:       { color: colors.text.secondary, fontSize: typography.sizes.label2, fontWeight: typography.weights.semibold },
    chipTextActive: { color: '#FFFFFF' },

    // ── Trip entries ──────────────────────────────────────────────────────────
    badgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        paddingLeft: 28 + spacing[3] + spacing[3],
        marginTop: -spacing[2],
        paddingBottom: spacing[3],
    },
    badgesRowLast: { paddingBottom: spacing[2] },
    emptyState: { marginTop: spacing[6] },

    // ── Monthly report BottomSheet ────────────────────────────────────────────
    sheetContent: { paddingHorizontal: spacing[5] },
    monthRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },

    // ── Monthly report content ────────────────────────────────────────────────
    reportSection: { marginBottom: spacing[3] },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
    },
    reportEmpty:  { marginVertical: spacing[6] },
    shareBtn:     { marginBottom: spacing[6] },
});

export default TripHistoryScreen;
