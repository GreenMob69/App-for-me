import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { getVin } from '../utils/config';
import HealthGauge from '../components/HealthGauge';
import SubsystemCard from '../components/SubsystemCard';
import PredictionCard from '../components/PredictionCard';
import HealthTimeline from '../components/HealthTimeline';

const { width } = Dimensions.get('window');
const CACHE_KEY = '@health_cache';

const VehicleHealthScreen = ({ navigation }) => {
    const [healthData, setHealthData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [showScoreTooltip, setShowScoreTooltip] = useState(false);

    const loadCachedData = async () => {
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                setHealthData(JSON.parse(cached));
                setLoading(false);
            }
        } catch (e) {}
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
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchHealth(true);
    }, []);

    const handleSubsystemPress = (systemKey) => {
        if (navigation) {
            navigation.navigate('SubsystemDetail', { system: systemKey, vin: getVin() });
        }
    };

    const handlePredictionPress = (prediction) => {
        const categoryToSystem = {
            'ELECTRIC': 'electric',
            'TURBO': 'turbo',
            'COMBUSTIBIL': 'combustibil',
            'EMISII': 'combustibil',
            'TERMIC': 'motor',
            'ADMISIE': 'motor',
        };
        const system = categoryToSystem[prediction.category] || 'motor';
        if (navigation) {
            navigation.navigate('SubsystemDetail', { system, vin: getVin() });
        }
    };

    // STARE: LOADING (primul load)
    if (loading && !healthData) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={styles.loadingText}>Se încarcă starea vehiculului...</Text>
            </View>
        );
    }

    // STARE: NO DATA
    if (healthData && healthData.status === 'NO_DATA') {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.noDataIcon}>—</Text>
                <Text style={styles.noDataTitle}>Așteptăm date</Text>
                <Text style={styles.noDataText}>
                    Efectuează prima cursă pentru a genera raportul de sănătate.{'\n\n'}
                    Conectează adaptorul OBD-II și pornește motorul.
                </Text>
            </View>
        );
    }

    // STARE: ERROR (fără cache)
    if (error && !healthData) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorIcon}>⊘</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchHealth(); }}>
                    <Text style={styles.retryText}>Reîncearcă</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { overallHealth, scores, subsystems, predictions, timeline, lastTrip, lastUpdated, dataQuality, overallTrend } = healthData || {};

    const isOffline = !!error && !!healthData;
    const isCritical = overallHealth < 40;
    const isWarning = overallHealth >= 40 && overallHealth < 75;

    const formatTimeAgo = (isoDate) => {
        if (!isoDate) return '';
        const diff = Date.now() - new Date(isoDate).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Chiar acum';
        if (minutes < 60) return `Acum ${minutes} min`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Acum ${hours} ore`;
        const days = Math.floor(hours / 24);
        return `Acum ${days} zile`;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0d1117" />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58a6ff" colors={['#58a6ff']} />}
                showsVerticalScrollIndicator={false}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.vehicleName}>Audi A6 C4 · 2.5 TDI</Text>
                        <Text style={styles.lastUpdate}>{formatTimeAgo(lastUpdated)}</Text>
                    </View>
                    {isOffline && (
                        <View style={styles.offlineBadge}>
                            <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                        </View>
                    )}
                    {dataQuality && dataQuality !== 'HIGH' && !isOffline && (
                        <View style={[styles.qualityBadge, dataQuality === 'LOW' && styles.qualityBadgeLow]}>
                            <Text style={styles.qualityBadgeText}>DATE {dataQuality}</Text>
                        </View>
                    )}
                </View>

                {/* CRITICAL BANNER */}
                {isCritical && (
                    <View style={styles.criticalBanner}>
                        <Text style={styles.criticalText}>Stare critică detectată</Text>
                    </View>
                )}

                {/* HERO GAUGE */}
                <TouchableOpacity activeOpacity={0.8} onPress={() => setShowScoreTooltip(!showScoreTooltip)}>
                    <HealthGauge score={overallHealth} subsystems={subsystems} size={width * 0.6} />
                </TouchableOpacity>

                {/* SCORE TOOLTIP (tap to expand) */}
                {showScoreTooltip && scores && (
                    <View style={styles.tooltipContainer}>
                        <View style={styles.tooltipRow}>
                            <Text style={styles.tooltipLabel}>Engine</Text>
                            <Text style={[styles.tooltipValue, { color: scores.engine >= 80 ? '#3fb950' : '#d29922' }]}>{scores.engine}%</Text>
                        </View>
                        <View style={styles.tooltipRow}>
                            <Text style={styles.tooltipLabel}>Fuel</Text>
                            <Text style={[styles.tooltipValue, { color: scores.fuel >= 80 ? '#3fb950' : '#d29922' }]}>{scores.fuel}%</Text>
                        </View>
                        <View style={styles.tooltipRow}>
                            <Text style={styles.tooltipLabel}>Driving</Text>
                            <Text style={[styles.tooltipValue, { color: scores.driving >= 80 ? '#3fb950' : '#d29922' }]}>{scores.driving}%</Text>
                        </View>
                        <View style={styles.tooltipRow}>
                            <Text style={styles.tooltipLabel}>Safety</Text>
                            <Text style={[styles.tooltipValue, { color: scores.safety >= 80 ? '#3fb950' : '#d29922' }]}>{scores.safety}%</Text>
                        </View>
                    </View>
                )}

                {/* SUBSISTEME GRID */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Subsisteme</Text>
                </View>
                {subsystems && (
                    <View style={styles.subsystemGrid}>
                        {Object.entries(subsystems).map(([key, data]) => (
                            <SubsystemCard
                                key={key}
                                systemKey={key}
                                data={data}
                                onPress={handleSubsystemPress}
                            />
                        ))}
                    </View>
                )}

                {/* PREDICTIONS / ATTENTION */}
                {predictions && predictions.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, isWarning && { color: '#d29922' }, isCritical && { color: '#f85149' }]}>
                                Atenție
                            </Text>
                            {predictions.length > 2 && (
                                <Text style={styles.sectionMore}>+{predictions.length - 2} monitorizate</Text>
                            )}
                        </View>
                        {predictions.slice(0, 2).map((pred, idx) => (
                            <PredictionCard
                                key={idx}
                                prediction={pred}
                                onPress={() => handlePredictionPress(pred)}
                            />
                        ))}
                    </View>
                )}

                {/* TIMELINE */}
                <View style={styles.section}>
                    <HealthTimeline timeline={timeline} />
                </View>

                {/* ULTIMA CURSĂ */}
                {lastTrip && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.lastTripCard}
                            activeOpacity={0.7}
                            onPress={() => navigation?.navigate('TripReport', { tripId: lastTrip.id })}
                        >
                            <View style={styles.lastTripHeader}>
                                <Text style={styles.lastTripTitle}>Ultima cursă</Text>
                                <Text style={styles.lastTripDate}>{formatTimeAgo(lastTrip.date)}</Text>
                            </View>
                            <View style={styles.lastTripStats}>
                                <View style={styles.lastTripStat}>
                                    <Text style={styles.statValue}>{lastTrip.distanceKm}</Text>
                                    <Text style={styles.statLabel}>km</Text>
                                </View>
                                <View style={styles.lastTripStat}>
                                    <Text style={styles.statValue}>{lastTrip.durationMin}</Text>
                                    <Text style={styles.statLabel}>min</Text>
                                </View>
                                <View style={styles.lastTripStat}>
                                    <Text style={styles.statValue}>{lastTrip.consumptionPer100 || '—'}</Text>
                                    <Text style={styles.statLabel}>L/100</Text>
                                </View>
                                <View style={styles.lastTripStat}>
                                    <Text style={[styles.statValue, { color: lastTrip.ecoScore >= 80 ? '#3fb950' : '#d29922' }]}>{lastTrip.ecoScore}</Text>
                                    <Text style={styles.statLabel}>Eco</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 44,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#0d1117',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        color: '#8b949e',
        fontSize: 14,
        marginTop: 12,
    },
    noDataIcon: {
        fontSize: 48,
        color: '#30363d',
        marginBottom: 16,
    },
    noDataTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#c9d1d9',
        marginBottom: 12,
    },
    noDataText: {
        fontSize: 14,
        color: '#8b949e',
        textAlign: 'center',
        lineHeight: 22,
    },
    errorIcon: {
        fontSize: 40,
        color: '#f85149',
        marginBottom: 12,
    },
    errorText: {
        fontSize: 14,
        color: '#8b949e',
        textAlign: 'center',
        marginBottom: 16,
    },
    retryBtn: {
        backgroundColor: '#21262d',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderColor: '#30363d',
        borderWidth: 1,
    },
    retryText: {
        color: '#58a6ff',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    vehicleName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    lastUpdate: {
        fontSize: 12,
        color: '#8b949e',
        marginTop: 2,
    },
    offlineBadge: {
        backgroundColor: '#3b2322',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderColor: '#da3633',
        borderWidth: 1,
    },
    offlineBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#f85149',
    },
    qualityBadge: {
        backgroundColor: '#2d2a1e',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderColor: '#d29922',
        borderWidth: 1,
    },
    qualityBadgeLow: {
        backgroundColor: '#3b2322',
        borderColor: '#da3633',
    },
    qualityBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#d29922',
    },
    criticalBanner: {
        backgroundColor: '#3b2322',
        borderColor: '#da3633',
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginBottom: 8,
    },
    criticalText: {
        color: '#f85149',
        fontSize: 13,
        fontWeight: '700',
    },
    tooltipContainer: {
        backgroundColor: '#161b22',
        borderColor: '#30363d',
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    tooltipRow: {
        alignItems: 'center',
    },
    tooltipLabel: {
        fontSize: 10,
        color: '#8b949e',
        fontWeight: '600',
        marginBottom: 4,
    },
    tooltipValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#c9d1d9',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionMore: {
        fontSize: 11,
        color: '#8b949e',
    },
    section: {
        marginTop: 16,
    },
    subsystemGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    lastTripCard: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        borderColor: '#30363d',
        borderWidth: 1,
    },
    lastTripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    lastTripTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#c9d1d9',
    },
    lastTripDate: {
        fontSize: 11,
        color: '#8b949e',
    },
    lastTripStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    lastTripStat: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff',
    },
    statLabel: {
        fontSize: 10,
        color: '#8b949e',
        marginTop: 2,
    },
});

export default VehicleHealthScreen;
