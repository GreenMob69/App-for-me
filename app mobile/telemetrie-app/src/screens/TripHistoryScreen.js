import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import api from '../services/api';
import TripDetailScreen from './TripDetailScreen'; 

const { width } = Dimensions.get('window');

const TripHistoryScreen = () => {
    const [trips, setTrips] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('LIST');
    const [chartMetric, setChartMetric] = useState('CONSUM');

    const [selectedTripId, setSelectedTripId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tripsRes, statsRes] = await Promise.all([
                api.get('/calatorii'),
                api.get('/vehicul/WAUZZZ4A1RN000000/statistici')
            ]);
            setTrips(tripsRes.data || []);
            setStats(statsRes.data || {});
        } catch (error) {
            console.error('[API EROARE] Nu s-a putut încărca istoricul:', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (selectedTripId !== null) {
        return (
            <TripDetailScreen 
                tripId={selectedTripId} 
                onBack={() => {
                    setSelectedTripId(null); 
                    fetchData();
                }} 
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

    const formatData = (timestamp) => {
        if (!timestamp) return 'Sesiune activă...';
        const d = new Date(timestamp);
        return `${d.toLocaleDateString('ro-RO')} ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
    };

    if (loading) {
        return (
            <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={{ color: '#8b949e', marginTop: 15 }}>Se decriptează logbook-ul auto...</Text>
            </View>
        );
    }

    return (
        <View style={styles.mainContainer}>
            {/* ANTET FIXAT SUS CU PROTECȚIE STATUS BAR ȘI FLEX-TEXT */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.title} numberOfLines={1}>Arhivă & Istoric</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>Audi A6 C4 • Logbook SQLite</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={fetchData}>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11 }}>🔄 REFRESH</Text>
                </TouchableOpacity>
            </View>

            {/* ZONĂ SCROLLABILĂ PENTRU CONȚINUT */}
            <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                
                <View style={styles.statsBanner}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>TOTAL SESIUNI</Text>
                        <Text style={styles.statValue}>{stats.total_calatorii || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>KILOMETRAJH</Text>
                        <Text style={styles.statValue}>{(stats.total_km || 0).toFixed(1)} <Text style={styles.unit}>km</Text></Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>CARBURANT ARS</Text>
                        <Text style={styles.statValue}>{(stats.total_combustibil || 0).toFixed(1)} <Text style={styles.unit}>L</Text></Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>SCOR ECO MEDIU</Text>
                        <Text style={[styles.statValue, { color: '#3fb950' }]}>
                            {Math.round(stats.scor_mediu || 100)} <Text style={styles.unit}>pct</Text>
                        </Text>
                    </View>
                </View>

                <View style={styles.viewToggleContainer}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'LIST' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('LIST')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'LIST' && styles.toggleTextActive]}>
                            📑 LISTĂ CRONOLOGICĂ
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'CHART' && styles.toggleBtnActive]}
                        onPress={() => setViewMode('CHART')}
                    >
                        <Text style={[styles.toggleText, viewMode === 'CHART' && styles.toggleTextActive]}>
                            📊 ANALIZĂ COMPARATIVĂ
                        </Text>
                    </TouchableOpacity>
                </View>

                {viewMode === 'CHART' && (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>COMPARATIE PE ULTIMELE 7 SESIUNI</Text>
                        
                        <View style={styles.metricSelector}>
                            <TouchableOpacity
                                style={[styles.metricBtn, chartMetric === 'CONSUM' && { backgroundColor: '#d29922' }]}
                                onPress={() => setChartMetric('CONSUM')}
                            >
                                <Text style={styles.metricBtnText}>CONSUM TOTAL (Litri)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.metricBtn, chartMetric === 'KM' && { backgroundColor: '#3fb950' }]}
                                onPress={() => setChartMetric('KM')}
                            >
                                <Text style={styles.metricBtnText}>DISTANȚĂ PARCURSĂ (km)</Text>
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

                {viewMode === 'LIST' && (
                    <View>
                        {trips.length === 0 ? (
                            <Text style={{ color: '#8b949e', textAlign: 'center', marginTop: 30 }}>Nicio călătorie încheiată momentan. Pornește simulatorul!</Text>
                        ) : (
                            trips.map((trip) => (
                                <TouchableOpacity 
                                    key={trip.id_calatorie} 
                                    style={styles.tripCard}
                                    onPress={() => setSelectedTripId(trip.id_calatorie)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.tripHeader}>
                                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                            <Text style={styles.tripId}>SESIUNEA #{trip.id_calatorie}</Text>
                                            <Text style={{color: '#8b949e', fontSize: 10}}>👆 Atinge pentru diagnoză</Text>
                                        </View>
                                        <Text style={styles.tripDate}>{formatData(trip.timestamp_start)}</Text>
                                    </View>

                                    <View style={styles.tripDetailsGrid}>
                                        <View>
                                            <Text style={styles.detailLabel}>DISTANȚĂ</Text>
                                            <Text style={styles.detailValue}>{trip.km_parcursi || 0} <Text style={styles.unitSmall}>km</Text></Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailLabel}>CONSUM TOTAL</Text>
                                            <Text style={styles.detailValue}>{trip.consum_total_l || 0} <Text style={styles.unitSmall}>L</Text></Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailLabel}>MEDIE 100KM</Text>
                                            <Text style={styles.detailValue}>{trip.consum_mediu_100km || 0} <Text style={styles.unitSmall}>L</Text></Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailLabel}>SCOR ECO</Text>
                                            <Text style={[
                                                styles.detailValue, 
                                                { color: trip.scor_eco >= 80 ? '#3fb950' : '#f85149' }
                                            ]}>
                                                {trip.scor_eco || 100} <Text style={styles.unitSmall}>pct</Text>
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    // Containerul principal primește protecția pentru bara de sus (notch/baterie)
    mainContainer: { 
        flex: 1, 
        backgroundColor: '#0d1117', 
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 30 
    },
    // Antet fixat
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingBottom: 15, 
        borderBottomWidth: 1, 
        borderBottomColor: '#21262d',
        marginBottom: 15
    },
    headerTitleContainer: { flex: 1, paddingRight: 10 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
    subtitle: { fontSize: 11, color: '#8b949e', marginTop: 2 },
    refreshBtn: { backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center' },

    scrollContainer: { flex: 1, paddingHorizontal: 16 },

    statsBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#161b22', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#30363d', marginBottom: 20 },
    statItem: { alignItems: 'center' },
    statLabel: { fontSize: 9, color: '#8b949e', fontWeight: 'bold', marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
    unit: { fontSize: 11, color: '#58a6ff', fontWeight: 'normal' },

    viewToggleContainer: { flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 8, p: 4, marginBottom: 20, borderWidth: 1, borderColor: '#30363d' },
    toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#21262d', borderColor: '#8b949e', borderWidth: 1 },
    toggleText: { color: '#8b949e', fontWeight: 'bold', fontSize: 12 },
    toggleTextActive: { color: '#ffffff' },

    chartContainer: { backgroundColor: '#161b22', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#30363d', marginBottom: 20 },
    chartTitle: { color: '#c9d1d9', fontSize: 12, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    metricSelector: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
    metricBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#21262d', borderWidth: 1, borderColor: '#30363d' },
    metricBtnText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },

    tripCard: { backgroundColor: '#161b22', borderRadius: 10, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#30363d' },
    tripHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#21262d', paddingBottom: 10, marginBottom: 12 },
    tripId: { color: '#58a6ff', fontWeight: 'bold', fontSize: 14 },
    tripDate: { color: '#8b949e', fontSize: 11 },
    tripDetailsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    detailLabel: { fontSize: 9, color: '#8b949e', fontWeight: 'bold', marginBottom: 4 },
    detailValue: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
    unitSmall: { fontSize: 10, color: '#8b949e', fontWeight: 'normal' }
});

export default TripHistoryScreen;