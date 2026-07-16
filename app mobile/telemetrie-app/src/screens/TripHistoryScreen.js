import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, SectionList, ScrollView,
    TouchableOpacity, Share, RefreshControl, Platform, StatusBar,
    ActivityIndicator, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { getVin, getVehicleLabel } from '../utils/config';
import { writeCache } from '../utils/cache';
import {
    HeroCard, SearchBar, StatusBadge,
    MetricCard, CostCard, EmptyState,
    SectionHeader, Button, BottomSheet,
} from '../components/ui';
import TripDetailScreen from './TripDetailScreen';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const FILTERS = [
    { key: 'ALL',   label: 'Toate'      },
    { key: 'TODAY', label: 'Astăzi'     },
    { key: 'WEEK',  label: 'Săptămâna'  },
    { key: 'MONTH', label: 'Luna'       },
];

const MONTH_NAMES = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    if (cons > 0) parts.push(`${cons.toFixed(1)} L/100km`);
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

// Group trips by date into SectionList-compatible sections
function groupTripsByDate(trips) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const groups  = new Map();
    const orderedKeys = [];

    trips.forEach(trip => {
        if (!trip.timestamp_start) return;
        const d = new Date(trip.timestamp_start);
        const tripDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((today.getTime() - tripDay.getTime()) / 86400000);

        let label;
        if (diffDays === 0) label = 'Astăzi';
        else if (diffDays === 1) label = 'Ieri';
        else if (diffDays < 7) {
            label = tripDay.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' });
            label = label.charAt(0).toUpperCase() + label.slice(1);
        } else {
            label = tripDay.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!groups.has(key)) {
            groups.set(key, { title: label, sortTs: trip.timestamp_start, data: [] });
            orderedKeys.push(key);
        }
        groups.get(key).data.push(trip);
    });

    return orderedKeys.map(k => groups.get(k));
}

// Stale-while-revalidate cache helper
async function fetchWithOfflineFallback(cacheKey, fetchFn, ttl = 30 * 60 * 1000) {
    try {
        const data = await fetchFn();
        await writeCache(cacheKey, data, { ttl });
        return { data, fromCache: false, ageMs: 0 };
    } catch {
        const raw = await AsyncStorage.getItem(`@cache::${cacheKey}`);
        if (raw) {
            try {
                const entry = JSON.parse(raw);
                return { data: entry.data, fromCache: true, ageMs: Date.now() - (entry.cachedAt || 0) };
            } catch {}
        }
        throw new Error('offline_no_cache');
    }
}

// ─── TripRow component ───────────────────────────────────────────────────────

const TripRow = ({ trip, onPress }) => {
    const eco    = trip.scor_eco ?? 100;
    const km     = parseFloat(trip.km_parcursi ?? 0);
    const hasDTC = (trip.nr_dtc ?? 0) > 0;
    const hasCool = parseFloat(trip.coolant_max ?? 0) > 100;
    const hasAlerts = (trip.nr_alerte ?? 0) > 0;
    const badges = buildTripBadges(trip);

    const lineColor = hasDTC || hasCool
        ? colors.status.critical
        : hasAlerts
        ? colors.status.caution
        : eco >= 85 ? colors.status.good
        : eco >= 65 ? colors.status.monitor
        : colors.status.caution;

    const ecoColor = eco >= 85 ? colors.status.good
        : eco >= 65 ? colors.status.monitor : colors.status.caution;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.72} style={styles.tripRow}>
            {/* Left colored strip */}
            <View style={[styles.tripStrip, { backgroundColor: lineColor }]} />

            <View style={styles.tripBody}>
                {/* Row 1: title + time */}
                <View style={styles.tripTopRow}>
                    <Text style={styles.tripTitle} numberOfLines={1}>{buildTripTitle(trip)}</Text>
                    <Text style={styles.tripTime}>{formatTripTime(trip.timestamp_start)}</Text>
                </View>

                {/* Row 2: desc + eco pill */}
                <View style={styles.tripMidRow}>
                    <Text style={styles.tripDesc} numberOfLines={1}>{buildTripDesc(trip)}</Text>
                    <View style={[styles.ecoPill, { borderColor: ecoColor }]}>
                        <Text style={[styles.ecoPillNum, { color: ecoColor }]}>{eco}</Text>
                        <Text style={styles.ecoPillMax}>/100</Text>
                    </View>
                </View>

                {/* Row 3: eco progress bar + km */}
                <View style={styles.tripBarRow}>
                    <View style={styles.tripBarBg}>
                        <View style={[styles.tripBarFill, {
                            width: `${Math.min(100, eco)}%`,
                            backgroundColor: ecoColor,
                        }]} />
                    </View>
                    <Text style={styles.tripKm}>{km.toFixed(1)} km</Text>
                </View>

                {/* Row 3b: speed stats */}
                {(trip.viteza_medie > 0 || trip.viteza_max > 0) && (
                    <View style={styles.tripSpeedRow}>
                        {trip.viteza_medie > 0 && (
                            <Text style={styles.tripSpeedStat}>
                                ø {Math.round(trip.viteza_medie)} km/h
                            </Text>
                        )}
                        {trip.viteza_max > 0 && (
                            <Text style={styles.tripSpeedStat}>
                                ↑ {Math.round(trip.viteza_max)} km/h
                            </Text>
                        )}
                    </View>
                )}

                {/* Row 4: status badges */}
                <View style={styles.tripBadgesRow}>
                    {badges.map(b => (
                        <StatusBadge key={b.label} status={b.status} label={b.label} variant="filled" size="sm" />
                    ))}
                </View>
            </View>
        </TouchableOpacity>
    );
};

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
    const [fromCache,      setFromCache]      = useState(false);
    const [cacheAgeMin,    setCacheAgeMin]    = useState(null);
    const [hasMore,        setHasMore]        = useState(false);
    const [loadingMore,    setLoadingMore]    = useState(false);
    const offsetRef = useRef(0);
    const [reportMonth,    setReportMonth]    = useState(() => {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    });

    const loadData = useCallback(async (forceRefresh = false) => {
        setScreenState(prev => prev === 'success' ? 'success' : 'loading');
        setFromCache(false);
        setCacheAgeMin(null);
        offsetRef.current = 0;

        const { startDate, endDate } = getFilterDates(activeFilter);
        const params = { limit: PAGE_SIZE, offset: 0 };
        if (startDate) params.startDate = startDate;
        if (endDate)   params.endDate   = endDate;

        const tripsKey = `trips_${getVin()}_${activeFilter}`;
        const statsKey = `stats_${getVin()}`;

        try {
            const tripsResult = await fetchWithOfflineFallback(
                tripsKey,
                () => api.get('/calatorii/filtrate', { params, timeout: 7000 }).then(r => r.data),
                forceRefresh ? 0 : 30 * 60 * 1000,
            );
            // Backend returns { rows, total } — handle both old array format and new object
            const rows  = Array.isArray(tripsResult.data) ? tripsResult.data : (tripsResult.data?.rows || []);
            const total = tripsResult.data?.total ?? rows.length;
            setTrips(rows);
            setHasMore(rows.length < total);
            offsetRef.current = rows.length;

            if (tripsResult.fromCache) {
                setFromCache(true);
                setCacheAgeMin(Math.floor(tripsResult.ageMs / 60000));
            }

            try {
                const statsResult = await fetchWithOfflineFallback(
                    statsKey,
                    () => api.get(`/vehicul/${getVin()}/statistici`, { timeout: 5000 }).then(r => r.data),
                    60 * 60 * 1000,
                );
                setStats(statsResult.data || {});
            } catch {
                setStats({});
            }

            setScreenState('success');
        } catch {
            setScreenState(prev => prev === 'success' ? prev : 'error');
        }
    }, [activeFilter]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || search.trim()) return;
        setLoadingMore(true);
        try {
            const { startDate, endDate } = getFilterDates(activeFilter);
            const params = { limit: PAGE_SIZE, offset: offsetRef.current };
            if (startDate) params.startDate = startDate;
            if (endDate)   params.endDate   = endDate;

            const res  = await api.get('/calatorii/filtrate', { params, timeout: 7000 });
            const rows  = res.data?.rows || [];
            const total = res.data?.total ?? 0;

            if (rows.length > 0) {
                setTrips(prev => {
                    const existingIds = new Set(prev.map(t => t.id_calatorie));
                    const fresh = rows.filter(t => !existingIds.has(t.id_calatorie));
                    const merged = [...prev, ...fresh];
                    offsetRef.current = merged.length;
                    setHasMore(merged.length < total);
                    return merged;
                });
            } else {
                setHasMore(false);
            }
        } catch {}
        finally { setLoadingMore(false); }
    }, [loadingMore, hasMore, search, activeFilter]);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try { await loadData(true); }
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

    // Weekly activity dots — computed from ALL trips (not filtered)
    const weekActivity = useMemo(() => {
        const now = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const dayEnd   = dayStart + 86400000;

            const dayTrips = trips.filter(t =>
                (t.timestamp_start || 0) >= dayStart && (t.timestamp_start || 0) < dayEnd
            );
            const km      = dayTrips.reduce((s, t) => s + (t.km_parcursi || 0), 0);
            const bestEco = dayTrips.length > 0
                ? Math.max(...dayTrips.map(t => t.scor_eco || 100))
                : 0;

            days.push({
                label:    d.toLocaleDateString('ro-RO', { weekday: 'narrow' }),
                hasTrips: dayTrips.length > 0,
                km,
                eco:      bestEco,
                isToday:  i === 0,
                count:    dayTrips.length,
            });
        }
        return days;
    }, [trips]);

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

    // Group filtered trips into sections by date
    const sections = useMemo(() => groupTripsByDate(filteredTrips), [filteredTrips]);

    const heroInfo = useMemo(() => buildHeroInfo(trips, stats), [trips, stats]);

    const renderItem = useCallback(({ item: trip }) => (
        <TripRow
            trip={trip}
            onPress={() => setSelectedTripId(trip.id_calatorie)}
        />
    ), []);

    // ── Trip Detail ───────────────────────────────────────────────────────────
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
                    <Text style={styles.title}>Jurnal</Text>
                    <Text style={styles.subtitle}>{getVehicleLabel() || 'Logbook'}</Text>
                </View>
                <View style={{ flex: 1, paddingHorizontal: layout.screenPaddingH, paddingTop: spacing[4] }}>
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

    // ── Monthly report share ──────────────────────────────────────────────────
    const shareMonthly = () => {
        if (!monthlyData) return;
        const [yr, mo] = reportMonth.split('-');
        const monthName = MONTH_NAMES[parseInt(mo, 10) - 1] || mo;
        const text = [
            `RAPORT LUNAR — ${monthName} ${yr}`,
            getVehicleLabel() || 'Vehicul', '',
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

    const [yr, mo] = reportMonth.split('-');
    const monthLabel = (mo && yr)
        ? `${MONTH_NAMES[parseInt(mo, 10) - 1] || mo} ${yr}`
        : reportMonth;
    const monthlyHero = monthlyData ? buildMonthlyHeroText(monthlyData) : null;

    // ─── List header component ────────────────────────────────────────────────
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

            {/* Offline cache indicator */}
            {fromCache && (
                <View style={styles.cacheBar}>
                    <Text style={styles.cacheBarText}>
                        Date din cache{cacheAgeMin != null ? ` · ${cacheAgeMin} min` : ''} — server indisponibil
                    </Text>
                    <TouchableOpacity onPress={onRefresh}>
                        <Text style={styles.cacheBarRefresh}>↺ Reîncarcă</Text>
                    </TouchableOpacity>
                </View>
            )}

            <SearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Caută curse, date, km, etichete..."
                style={styles.searchBar}
            />

            {/* Filter chips */}
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

            {/* Weekly activity dots */}
            {trips.length > 0 && (
                <View style={styles.weekRow}>
                    {weekActivity.map((day, i) => {
                        const dotColor = day.hasTrips
                            ? day.eco >= 85 ? colors.status.good
                            : day.eco >= 65 ? colors.status.monitor
                            : colors.status.caution
                            : colors.border.default;
                        return (
                            <View key={i} style={styles.weekDayCol}>
                                <View style={[styles.weekDot, { backgroundColor: dotColor }]} />
                                {day.hasTrips && (
                                    <Text style={styles.weekDotKm}>{Math.round(day.km)}</Text>
                                )}
                                <Text style={[styles.weekDotLabel, day.isToday && { color: colors.accent.default, fontWeight: typography.weights.bold }]}>
                                    {day.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}

            {filteredTrips.length > 0 && (
                <SectionHeader
                    title={`${filteredTrips.length} ${filteredTrips.length === 1 ? 'CURSĂ' : 'CURSE'}`}
                    size="sm"
                    style={styles.sectionHeader}
                />
            )}
        </View>
    );

    const renderSectionHeader = ({ section }) => (
        <View style={styles.dateSectionHeader}>
            <Text style={styles.dateSectionTitle}>{section.title}</Text>
            <Text style={styles.dateSectionCount}>
                {section.data.length} {section.data.length === 1 ? 'cursă' : 'curse'}
            </Text>
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
                    <Text style={styles.subtitle}>{getVehicleLabel() || 'Logbook'}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={onRefresh}
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

            {/* ── SectionList — trips grouped by date ──────────────────────── */}
            <SectionList
                style={styles.list}
                contentContainerStyle={styles.listContent}
                sections={sections}
                keyExtractor={item => String(item.id_calatorie)}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={ListEmpty}
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.loadMoreFooter}>
                            <ActivityIndicator size="small" color={colors.accent.default} />
                            <Text style={styles.loadMoreText}>Se încarcă mai multe curse...</Text>
                        </View>
                    ) : hasMore && !search.trim() ? (
                        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                            <Text style={styles.loadMoreBtnText}>Încarcă mai multe</Text>
                        </TouchableOpacity>
                    ) : null
                }
                onEndReached={() => { if (!search.trim()) loadMore(); }}
                onEndReachedThreshold={0.3}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={7}
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
                        {monthlyData && parseFloat(monthlyData.totalCost || 0) > 0 && (
                            <CostCard
                                title="Costuri deplasare"
                                amount={parseFloat(monthlyData.totalCost || 0)}
                                currency="RON"
                                period={monthLabel}
                                breakdown={[{ label: 'Combustibil', amount: parseFloat(monthlyData.totalCost || 0) }]}
                                style={styles.reportSection}
                            />
                        )}
                        {monthlyData && monthlyData.totalTrips > 0 && (
                            <View style={styles.metricsGrid}>
                                <MetricCard label="L/100KM"   value={parseFloat(monthlyData.consumMediu100 || 0).toFixed(1)} unit="medie" size="sm" style={metricCardStyle} />
                                <MetricCard label="ECO SCORE" value={monthlyData.avgEcoScore || 100} unit="/100" size="sm" status={(monthlyData.avgEcoScore || 100) >= 80 ? 'good' : 'monitor'} style={metricCardStyle} />
                                <MetricCard label="LITRI"     value={parseFloat(monthlyData.totalLitri || 0).toFixed(0)} unit="L" size="sm" style={metricCardStyle} />
                                <MetricCard label="CO₂"       value={parseFloat(monthlyData.totalCO2 || 0).toFixed(1)} unit="kg" size="sm" style={metricCardStyle} />
                                <MetricCard label="TIMP"      value={monthlyData.totalDurataMin || 0} unit="min" size="sm" style={metricCardStyle} />
                                {monthlyData.avgHealthScore ? (
                                    <MetricCard label="HEALTH" value={monthlyData.avgHealthScore} unit="%" size="sm" status={monthlyData.avgHealthScore >= 80 ? 'good' : 'monitor'} style={metricCardStyle} />
                                ) : (
                                    <MetricCard label="CURSE" value={monthlyData.totalTrips} unit="total" size="sm" style={metricCardStyle} />
                                )}
                            </View>
                        )}
                        {!monthlyData && !reportLoading && (
                            <EmptyState title="Selectează o lună." subtitle="Apasă 'Vezi' pentru a genera raportul lunar." style={styles.reportEmpty} />
                        )}
                        {monthlyData && monthlyData.totalTrips === 0 && (
                            <EmptyState title="Nicio cursă în această lună." subtitle={`Nu am date înregistrate pentru ${monthLabel}.`} style={styles.reportEmpty} />
                        )}
                        {monthlyData && monthlyData.totalTrips > 0 && (
                            <Button label="Descarcă / Trimite raportul" variant="primary" onPress={shareMonthly} style={styles.shareBtn} />
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
    list:        { flex: 1 },
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

    // ── Offline cache indicator ───────────────────────────────────────────────
    cacheBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.tint.monitor,
        borderWidth: 1,
        borderColor: colors.status.monitor,
        borderRadius: radii.xs,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        marginBottom: spacing[3],
    },
    cacheBarText: {
        fontSize: typography.sizes.caption,
        color: colors.status.monitor,
        flex: 1,
    },
    cacheBarRefresh: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.bold,
        marginLeft: spacing[2],
    },

    // ── Weekly dots ───────────────────────────────────────────────────────────
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[2],
        marginBottom: spacing[3],
    },
    weekDayCol: {
        flex: 1,
        alignItems: 'center',
        gap: spacing[1] - 2,
    },
    weekDot: {
        width: 10,
        height: 10,
        borderRadius: radii.full,
    },
    weekDotKm: {
        fontSize: typography.sizes.micro - 1,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
    },
    weekDotLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
    },

    // ── Section header (date) ─────────────────────────────────────────────────
    dateSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[2] + 2,
        paddingTop: spacing[4],
    },
    dateSectionTitle: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateSectionCount: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },

    // ── Trip row ──────────────────────────────────────────────────────────────
    tripRow: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[2] + 2,
        overflow: 'hidden',
    },
    tripStrip: {
        width: 4,
        alignSelf: 'stretch',
    },
    tripBody: {
        flex: 1,
        padding: spacing[3],
    },
    tripTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[1],
    },
    tripMidRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    tripBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    tripTitle: {
        flex: 1,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        marginRight: spacing[2],
    },
    tripTime: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
    },
    tripDesc: {
        flex: 1,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginRight: spacing[2],
    },
    ecoPill: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1] - 2,
        borderRadius: radii.full,
        borderWidth: 1,
    },
    ecoPillNum: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    ecoPillMax: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginLeft: 1,
    },
    tripBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: colors.border.default,
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    tripBarFill: {
        height: 4,
        borderRadius: radii.full,
    },
    tripKm: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontVariant: ['tabular-nums'],
        minWidth: 44,
        textAlign: 'right',
    },
    tripSpeedRow: {
        flexDirection: 'row',
        gap: spacing[3],
        marginTop: 2,
    },
    tripSpeedStat: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
        fontVariant: ['tabular-nums'],
    },
    tripBadgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[1] + 1,
    },
    emptyState: { marginTop: spacing[6] },

    loadMoreFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing[4],
        gap: spacing[2],
    },
    loadMoreText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    loadMoreBtn: {
        alignItems: 'center',
        paddingVertical: spacing[3],
        marginBottom: spacing[4],
    },
    loadMoreBtnText: {
        fontSize: typography.sizes.label2,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },

    // ── Monthly report BottomSheet ────────────────────────────────────────────
    sheetContent: { paddingHorizontal: spacing[5] },
    monthRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] },
    reportSection: { marginBottom: spacing[3] },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
    },
    reportEmpty: { marginVertical: spacing[6] },
    shareBtn:    { marginBottom: spacing[6] },
});

export default TripHistoryScreen;
