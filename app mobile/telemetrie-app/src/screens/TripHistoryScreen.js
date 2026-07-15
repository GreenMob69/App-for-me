import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar, TextInput, Modal, Alert, Share } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import api from '../services/api';
import TripDetailScreen from './TripDetailScreen';

const { width } = Dimensions.get('window');

const TAGS = [
    { key: 'PERSONAL', label: 'Personal', icon: '⌂', color: '#58a6ff' },
    { key: 'BUSINESS', label: 'Serviciu', icon: '◆', color: '#3fb950' },
    { key: 'TESTARE', label: 'Testare', icon: '⚙', color: '#d29922' },
];

const FILTERS = [
    { key: 'ALL', label: 'Toate' },
    { key: 'ALERTS', label: 'Cu alerte' },
    { key: 'DTC', label: 'Cu erori DTC' },
    { key: 'TEMP', label: 'Temp > 95°C' },
];

const TripHistoryScreen = () => {
    const [trips, setTrips] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('LIST');
    const [chartMetric, setChartMetric] = useState('CONSUM');
    const [selectedTripId, setSelectedTripId] = useState(null);

    // Filtrare
    const [activeFilter, setActiveFilter] = useState('ALL');
    const [activeTag, setActiveTag] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);

    // Raport lunar
    const [showMonthlyReport, setShowMonthlyReport] = useState(false);
    const [monthlyData, setMonthlyData] = useState(null);
    const [reportMonth, setReportMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Tag modal
    const [tagModalTrip, setTagModalTrip] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (dateFrom) params.startDate = dateFrom;
            if (dateTo) params.endDate = dateTo;
            if (activeFilter === 'ALERTS') params.hasAlerts = 'true';
            if (activeFilter === 'DTC') params.hasDTC = 'true';
            if (activeFilter === 'TEMP') params.tempOver = '95';
            if (activeTag !== 'ALL') params.tag = activeTag;

            const hasFilter = Object.keys(params).length > 0;

            const [tripsRes, statsRes] = await Promise.all([
                hasFilter
                    ? api.get('/calatorii/filtrate', { params })
                    : api.get('/calatorii'),
                api.get('/vehicul/WAUZZZ4A1RN000000/statistici')
            ]);
            setTrips(tripsRes.data || []);
            setStats(statsRes.data || {});
        } catch (error) {
            console.error('[API EROARE]', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeFilter, activeTag]);

    const applyDateFilter = () => {
        setShowDateFilter(false);
        fetchData();
    };

    const clearDateFilter = () => {
        setDateFrom('');
        setDateTo('');
        setShowDateFilter(false);
        fetchData();
    };

    const fetchMonthlyReport = async () => {
        const [year, month] = reportMonth.split('-');
        try {
            const res = await api.get(`/rapoarte/lunar/${year}/${month}`);
            setMonthlyData(res.data);
            setShowMonthlyReport(true);
        } catch (err) {
            Alert.alert('Eroare', 'Nu s-a putut genera raportul lunar.');
        }
    };

    const setTripTag = async (tripId, tag) => {
        try {
            await api.put(`/calatorii/${tripId}/tag`, { tag });
            setTrips(prev => prev.map(t =>
                (t.id_calatorie === tripId) ? { ...t, trip_tag: tag } : t
            ));
            setTagModalTrip(null);
        } catch (err) {
            Alert.alert('Eroare', 'Nu s-a putut seta tag-ul.');
        }
    };

    if (selectedTripId !== null) {
        return (
            <TripDetailScreen
                tripId={selectedTripId}
                onBack={() => { setSelectedTripId(null); fetchData(); }}
            />
        );
    }

    const getBarChartData = () => {
        return trips.slice(0, 7).reverse().map((trip) => {
            const val = chartMetric === 'CONSUM' ? parseFloat(trip.consum_total_l || 0) : parseFloat(trip.km_parcursi || 0);
            const color = chartMetric === 'CONSUM' ? '#d29922' : '#3fb950';
            return {
                value: val,
                label: `#${trip.id_calatorie}`,
                frontColor: color,
                topLabelComponent: () => (
                    <Text style={{ color: '#8b949e', fontSize: 10, marginBottom: 2 }}>{val}</Text>
                )
            };
        });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Activa...';
        const d = new Date(timestamp);
        return `${d.toLocaleDateString('ro-RO')} ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const getTagInfo = (tag) => TAGS.find(t => t.key === tag) || TAGS[0];

    if (loading) {
        return (
            <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={{ color: '#8b949e', marginTop: 15 }}>Se încarcă istoricul...</Text>
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.title} numberOfLines={1}>Arhiva Curse</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>Audi A6 C4 · Logbook</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchData}>
                        <Text style={styles.refreshBtnText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reportBtn} onPress={fetchMonthlyReport}>
                        <Text style={styles.reportBtnText}>Raport</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* STATS BANNER */}
                <View style={styles.statsBanner}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>SESIUNI</Text>
                        <Text style={styles.statValue}>{stats.total_calatorii || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>KM</Text>
                        <Text style={styles.statValue}>{(stats.total_km || 0).toFixed(1)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>LITRI</Text>
                        <Text style={styles.statValue}>{(stats.total_combustibil || 0).toFixed(1)}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>ECO</Text>
                        <Text style={[styles.statValue, { color: '#3fb950' }]}>{Math.round(stats.scor_mediu || 100)}</Text>
                    </View>
                </View>

                {/* FILTRE RAPIDE */}
                <View style={styles.filterSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {FILTERS.map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
                                onPress={() => setActiveFilter(f.key)}
                            >
                                <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <View style={styles.filterSeparator} />
                        <TouchableOpacity
                            style={[styles.filterChip, activeTag !== 'ALL' && styles.filterChipActive]}
                            onPress={() => {
                                const tags = ['ALL', ...TAGS.map(t => t.key)];
                                const idx = tags.indexOf(activeTag);
                                setActiveTag(tags[(idx + 1) % tags.length]);
                            }}
                        >
                            <Text style={[styles.filterChipText, activeTag !== 'ALL' && styles.filterChipTextActive]}>
                                {activeTag === 'ALL' ? 'Tag: Toate' : getTagInfo(activeTag).label}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, (dateFrom || dateTo) && styles.filterChipActive]}
                            onPress={() => setShowDateFilter(!showDateFilter)}
                        >
                            <Text style={[styles.filterChipText, (dateFrom || dateTo) && styles.filterChipTextActive]}>
                                {(dateFrom || dateTo) ? 'Dată ✓' : 'Dată'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* DATE FILTER INPUT */}
                {showDateFilter && (
                    <View style={styles.dateFilterBox}>
                        <Text style={styles.dateFilterLabel}>Filtrare după perioadă</Text>
                        <View style={styles.dateRow}>
                            <View style={styles.dateInputContainer}>
                                <Text style={styles.dateInputLabel}>De la:</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="2025-01-01"
                                    placeholderTextColor="#484f58"
                                    value={dateFrom}
                                    onChangeText={setDateFrom}
                                    keyboardType="default"
                                />
                            </View>
                            <View style={styles.dateInputContainer}>
                                <Text style={styles.dateInputLabel}>Până la:</Text>
                                <TextInput
                                    style={styles.dateInput}
                                    placeholder="2025-04-13"
                                    placeholderTextColor="#484f58"
                                    value={dateTo}
                                    onChangeText={setDateTo}
                                    keyboardType="default"
                                />
                            </View>
                        </View>
                        <Text style={styles.dateHint}>Format: YYYY-MM-DD (ex: 2025-01-01) sau doar ziua: 2025-04-13</Text>
                        <View style={styles.dateActions}>
                            <TouchableOpacity style={styles.dateApplyBtn} onPress={applyDateFilter}>
                                <Text style={styles.dateApplyText}>Aplică</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.dateClearBtn} onPress={clearDateFilter}>
                                <Text style={styles.dateClearText}>Resetează</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* VIEW MODE TOGGLE */}
                <View style={styles.viewToggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'LIST' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('LIST')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'LIST' && styles.toggleTextActive]}>Lista</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'CHART' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('CHART')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'CHART' && styles.toggleTextActive]}>Grafic</Text>
                    </TouchableOpacity>
                </View>

                {/* CHART VIEW */}
                {viewMode === 'CHART' && (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>ULTIMELE 7 SESIUNI</Text>
                        <View style={styles.metricSelector}>
                            <TouchableOpacity
                                style={[styles.metricBtn, chartMetric === 'CONSUM' && { backgroundColor: '#d29922' }]}
                                onPress={() => setChartMetric('CONSUM')}
                            >
                                <Text style={styles.metricBtnText}>Consum (L)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.metricBtn, chartMetric === 'KM' && { backgroundColor: '#3fb950' }]}
                                onPress={() => setChartMetric('KM')}
                            >
                                <Text style={styles.metricBtnText}>Distanță (km)</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ alignItems: 'center', marginTop: 15 }}>
                            <BarChart
                                data={getBarChartData()}
                                width={width - 80}
                                height={200}
                                barWidth={28}
                                spacing={20}
                                roundedTop
                                yAxisTextStyle={{ color: '#8b949e', fontSize: 11 }}
                                xAxisLabelTextStyle={{ color: '#c9d1d9', fontSize: 11, fontWeight: 'bold' }}
                                rulesColor="#30363d"
                                noOfSections={4}
                            />
                        </View>
                    </View>
                )}

                {/* LIST VIEW */}
                {viewMode === 'LIST' && (
                    <View>
                        {trips.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Nicio cursă găsită cu filtrele selectate.</Text>
                                <TouchableOpacity onPress={() => { setActiveFilter('ALL'); setActiveTag('ALL'); setDateFrom(''); setDateTo(''); }}>
                                    <Text style={styles.emptyReset}>Resetează filtrele</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            trips.map((trip) => {
                                const tagInfo = getTagInfo(trip.trip_tag || 'PERSONAL');
                                return (
                                    <TouchableOpacity
                                        key={trip.id_calatorie}
                                        style={styles.tripCard}
                                        onPress={() => setSelectedTripId(trip.id_calatorie)}
                                        onLongPress={() => setTagModalTrip(trip.id_calatorie)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.tripHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.tripId}>#{trip.id_calatorie}</Text>
                                                <View style={[styles.tagBadge, { borderColor: tagInfo.color }]}>
                                                    <Text style={[styles.tagBadgeText, { color: tagInfo.color }]}>{tagInfo.icon} {tagInfo.label}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.tripDate}>{formatDate(trip.timestamp_start)}</Text>
                                        </View>

                                        <View style={styles.tripDetailsGrid}>
                                            <View style={styles.tripDetail}>
                                                <Text style={styles.detailLabel}>KM</Text>
                                                <Text style={styles.detailValue}>{(trip.km_parcursi || 0).toFixed(1)}</Text>
                                            </View>
                                            <View style={styles.tripDetail}>
                                                <Text style={styles.detailLabel}>LITRI</Text>
                                                <Text style={styles.detailValue}>{(trip.consum_total_l || 0).toFixed(1)}</Text>
                                            </View>
                                            <View style={styles.tripDetail}>
                                                <Text style={styles.detailLabel}>L/100</Text>
                                                <Text style={styles.detailValue}>{trip.consum_mediu_100km || 0}</Text>
                                            </View>
                                            <View style={styles.tripDetail}>
                                                <Text style={styles.detailLabel}>ECO</Text>
                                                <Text style={[styles.detailValue, { color: (trip.scor_eco || 100) >= 80 ? '#3fb950' : '#f85149' }]}>
                                                    {trip.scor_eco || 100}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Indicators row */}
                                        {(trip.nr_alerte > 0 || trip.nr_dtc > 0 || trip.health_score) && (
                                            <View style={styles.indicatorsRow}>
                                                {trip.health_score && (
                                                    <Text style={[styles.indicator, { color: trip.health_score >= 80 ? '#3fb950' : '#d29922' }]}>
                                                        Health: {trip.health_score}%
                                                    </Text>
                                                )}
                                                {trip.nr_alerte > 0 && (
                                                    <Text style={[styles.indicator, { color: '#f85149' }]}>
                                                        {trip.nr_alerte} alerte
                                                    </Text>
                                                )}
                                                {trip.nr_dtc > 0 && (
                                                    <Text style={[styles.indicator, { color: '#f85149' }]}>
                                                        {trip.nr_dtc} DTC
                                                    </Text>
                                                )}
                                            </View>
                                        )}

                                        <Text style={styles.tapHint}>Apasă lung pentru tag</Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                )}
            </ScrollView>

            {/* TAG MODAL */}
            <Modal visible={tagModalTrip !== null} transparent animationType="fade" onRequestClose={() => setTagModalTrip(null)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTagModalTrip(null)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Etichetă Cursă #{tagModalTrip}</Text>
                        {TAGS.map(tag => (
                            <TouchableOpacity
                                key={tag.key}
                                style={styles.modalOption}
                                onPress={() => setTripTag(tagModalTrip, tag.key)}
                            >
                                <Text style={[styles.modalOptionText, { color: tag.color }]}>{tag.icon}  {tag.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setTagModalTrip(null)}>
                            <Text style={styles.modalCancelText}>Anulează</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* MONTHLY REPORT MODAL */}
            <Modal visible={showMonthlyReport} transparent animationType="slide" onRequestClose={() => setShowMonthlyReport(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.reportModal}>
                        <View style={styles.reportHeader}>
                            <Text style={styles.reportTitle}>Sinteză Lunară</Text>
                            <TouchableOpacity onPress={() => setShowMonthlyReport(false)}>
                                <Text style={styles.reportClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Month selector */}
                        <View style={styles.monthSelector}>
                            <TextInput
                                style={styles.monthInput}
                                placeholder="2025-07"
                                placeholderTextColor="#484f58"
                                value={reportMonth}
                                onChangeText={setReportMonth}
                            />
                            <TouchableOpacity style={styles.monthFetchBtn} onPress={fetchMonthlyReport}>
                                <Text style={styles.monthFetchText}>Generează</Text>
                            </TouchableOpacity>
                        </View>

                        {monthlyData && (
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                <Text style={styles.reportSubtitle}>
                                    {monthlyData.month}/{monthlyData.year} — {monthlyData.totalTrips} curse
                                </Text>

                                <View style={styles.reportGrid}>
                                    <View style={styles.reportCard}>
                                        <Text style={styles.reportCardValue}>{monthlyData.totalKm}</Text>
                                        <Text style={styles.reportCardLabel}>km total</Text>
                                    </View>
                                    <View style={styles.reportCard}>
                                        <Text style={styles.reportCardValue}>{monthlyData.totalLitri}</Text>
                                        <Text style={styles.reportCardLabel}>litri</Text>
                                    </View>
                                    <View style={styles.reportCard}>
                                        <Text style={styles.reportCardValue}>{monthlyData.consumMediu100}</Text>
                                        <Text style={styles.reportCardLabel}>L/100km</Text>
                                    </View>
                                    <View style={styles.reportCard}>
                                        <Text style={[styles.reportCardValue, { color: '#3fb950' }]}>{monthlyData.totalCost}</Text>
                                        <Text style={styles.reportCardLabel}>RON cost</Text>
                                    </View>
                                    <View style={styles.reportCard}>
                                        <Text style={styles.reportCardValue}>{monthlyData.totalCO2}</Text>
                                        <Text style={styles.reportCardLabel}>kg CO₂</Text>
                                    </View>
                                    <View style={styles.reportCard}>
                                        <Text style={styles.reportCardValue}>{monthlyData.totalDurataMin}</Text>
                                        <Text style={styles.reportCardLabel}>min condus</Text>
                                    </View>
                                </View>

                                {monthlyData.avgHealthScore && (
                                    <View style={styles.reportRow}>
                                        <Text style={styles.reportRowLabel}>Health Score mediu:</Text>
                                        <Text style={[styles.reportRowValue, { color: monthlyData.avgHealthScore >= 80 ? '#3fb950' : '#d29922' }]}>
                                            {monthlyData.avgHealthScore}%
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.reportRow}>
                                    <Text style={styles.reportRowLabel}>Eco Score mediu:</Text>
                                    <Text style={[styles.reportRowValue, { color: monthlyData.avgEcoScore >= 80 ? '#3fb950' : '#d29922' }]}>
                                        {monthlyData.avgEcoScore}
                                    </Text>
                                </View>

                                {/* BY TAG */}
                                {monthlyData.byTag && Object.keys(monthlyData.byTag).length > 0 && (
                                    <View style={styles.reportTagSection}>
                                        <Text style={styles.reportTagTitle}>Defalcare pe categorie:</Text>
                                        {Object.entries(monthlyData.byTag).map(([tag, data]) => {
                                            const info = getTagInfo(tag);
                                            return (
                                                <View key={tag} style={styles.reportTagRow}>
                                                    <Text style={[styles.reportTagName, { color: info.color }]}>{info.icon} {info.label}</Text>
                                                    <Text style={styles.reportTagData}>{data.trips} curse · {data.km.toFixed(1)} km · {data.cost.toFixed(0)} RON</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {/* BUTON DESCARCĂ / SHARE */}
                                <TouchableOpacity
                                    style={styles.shareBtn}
                                    onPress={() => {
                                        const tagLines = monthlyData.byTag
                                            ? Object.entries(monthlyData.byTag).map(([tag, d]) => `  ${getTagInfo(tag).label}: ${d.trips} curse, ${d.km.toFixed(1)} km, ${d.cost.toFixed(0)} RON`).join('\n')
                                            : '';
                                        const text = [
                                            `RAPORT LUNAR — ${monthlyData.month}/${monthlyData.year}`,
                                            `Audi A6 C4 · 2.5 TDI`,
                                            ``,
                                            `Total curse: ${monthlyData.totalTrips}`,
                                            `Distanță: ${monthlyData.totalKm} km`,
                                            `Combustibil: ${monthlyData.totalLitri} L`,
                                            `Consum mediu: ${monthlyData.consumMediu100} L/100km`,
                                            `Cost total: ${monthlyData.totalCost} RON`,
                                            `Emisii CO2: ${monthlyData.totalCO2} kg`,
                                            `Timp condus: ${monthlyData.totalDurataMin} min`,
                                            `Eco Score mediu: ${monthlyData.avgEcoScore}`,
                                            monthlyData.avgHealthScore ? `Health Score mediu: ${monthlyData.avgHealthScore}%` : '',
                                            tagLines ? `\nDefalcare:\n${tagLines}` : '',
                                            ``,
                                            `Generat de OBD-II Monitor App`,
                                        ].filter(Boolean).join('\n');
                                        Share.share({ message: text, title: `Raport ${monthlyData.month}/${monthlyData.year}` });
                                    }}
                                >
                                    <Text style={styles.shareBtnText}>Descarcă / Trimite Raportul</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
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
    headerTitleContainer: { flex: 1, paddingRight: 10 },
    title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    subtitle: { fontSize: 11, color: '#8b949e', marginTop: 2 },
    refreshBtn: { backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },
    refreshBtnText: { color: '#8b949e', fontWeight: '700', fontSize: 11 },
    reportBtn: { backgroundColor: '#1f6feb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
    reportBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 11 },
    scrollContainer: { flex: 1, paddingHorizontal: 16 },
    statsBanner: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#161b22',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#30363d',
        marginTop: 12,
        marginBottom: 12,
    },
    statItem: { alignItems: 'center' },
    statLabel: { fontSize: 9, color: '#8b949e', fontWeight: '700', marginBottom: 3 },
    statValue: { fontSize: 16, fontWeight: '900', color: '#ffffff' },

    // Filters
    filterSection: { marginBottom: 10 },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#21262d',
        borderWidth: 1,
        borderColor: '#30363d',
        marginRight: 8,
    },
    filterChipActive: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
    filterChipText: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
    filterChipTextActive: { color: '#ffffff' },
    filterSeparator: { width: 1, backgroundColor: '#30363d', marginHorizontal: 4 },

    // Date filter
    dateFilterBox: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#30363d',
        marginBottom: 12,
    },
    dateFilterLabel: { color: '#c9d1d9', fontSize: 12, fontWeight: '700', marginBottom: 10 },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateInputContainer: { flex: 1 },
    dateInputLabel: { color: '#8b949e', fontSize: 10, marginBottom: 4 },
    dateInput: {
        backgroundColor: '#0d1117',
        borderWidth: 1,
        borderColor: '#30363d',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#ffffff',
        fontSize: 13,
    },
    dateHint: { color: '#484f58', fontSize: 10, marginTop: 8 },
    dateActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    dateApplyBtn: { backgroundColor: '#1f6feb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    dateApplyText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    dateClearBtn: { backgroundColor: '#21262d', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },
    dateClearText: { color: '#8b949e', fontWeight: '600', fontSize: 12 },

    // View toggle
    viewToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#161b22',
        borderRadius: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#21262d', borderColor: '#8b949e', borderWidth: 1 },
    toggleText: { color: '#8b949e', fontWeight: '700', fontSize: 12 },
    toggleTextActive: { color: '#ffffff' },

    // Chart
    chartContainer: { backgroundColor: '#161b22', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#30363d', marginBottom: 12 },
    chartTitle: { color: '#c9d1d9', fontSize: 11, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
    metricSelector: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
    metricBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
    metricBtnText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },

    // Trip card
    tripCard: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#21262d',
    },
    tripId: { color: '#58a6ff', fontWeight: '700', fontSize: 14 },
    tripDate: { color: '#8b949e', fontSize: 11 },
    tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
    tagBadgeText: { fontSize: 10, fontWeight: '700' },
    tripDetailsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    tripDetail: { alignItems: 'center', flex: 1 },
    detailLabel: { fontSize: 9, color: '#8b949e', fontWeight: '700', marginBottom: 3 },
    detailValue: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
    indicatorsRow: { flexDirection: 'row', marginTop: 8, gap: 12 },
    indicator: { fontSize: 11, fontWeight: '600' },
    tapHint: { color: '#30363d', fontSize: 9, marginTop: 6, textAlign: 'right' },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#8b949e', fontSize: 13, marginBottom: 12 },
    emptyReset: { color: '#58a6ff', fontSize: 13, fontWeight: '600' },

    // Tag modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#161b22',
        borderRadius: 14,
        padding: 24,
        width: width * 0.75,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    modalOption: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    modalOptionText: { fontSize: 15, fontWeight: '600' },
    modalCancel: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
    modalCancelText: { color: '#8b949e', fontSize: 14 },

    // Monthly report modal
    reportModal: {
        backgroundColor: '#0d1117',
        borderRadius: 16,
        padding: 20,
        width: width * 0.9,
        maxHeight: '80%',
        borderWidth: 1,
        borderColor: '#30363d',
    },
    reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    reportTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
    reportClose: { color: '#8b949e', fontSize: 20 },
    monthSelector: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    monthInput: {
        flex: 1,
        backgroundColor: '#161b22',
        borderWidth: 1,
        borderColor: '#30363d',
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        color: '#ffffff',
        fontSize: 14,
    },
    monthFetchBtn: { backgroundColor: '#1f6feb', paddingHorizontal: 16, borderRadius: 6, justifyContent: 'center' },
    monthFetchText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    reportSubtitle: { color: '#8b949e', fontSize: 13, marginBottom: 14 },
    reportGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
    reportCard: {
        width: '31%',
        backgroundColor: '#161b22',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    reportCardValue: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
    reportCardLabel: { fontSize: 9, color: '#8b949e', marginTop: 2 },
    reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    reportRowLabel: { color: '#8b949e', fontSize: 13 },
    reportRowValue: { fontSize: 14, fontWeight: '800' },
    reportTagSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#21262d', paddingTop: 12 },
    reportTagTitle: { color: '#c9d1d9', fontSize: 12, fontWeight: '700', marginBottom: 8 },
    reportTagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    reportTagName: { fontSize: 13, fontWeight: '700' },
    reportTagData: { color: '#8b949e', fontSize: 11 },
    shareBtn: { backgroundColor: '#1f6feb', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
    shareBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});

export default TripHistoryScreen;
