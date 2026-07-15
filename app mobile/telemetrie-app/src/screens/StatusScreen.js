import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { fetchFullStatus } from '../services/vehicleService';
import { getVin } from '../utils/config';
import { mapStatusData } from '../mappers/statusMapper';
import { t } from '../i18n';
import StatusHeader from '../components/StatusHeader';
import CalmState from '../components/CalmState';
import UrgentBanner from '../components/UrgentBanner';
import ObservationCard from '../components/ObservationCard';
import ComparisonSection from '../components/ComparisonSection';
import UpcomingTimeline from '../components/UpcomingTimeline';

const StatusScreen = ({ navigation }) => {
    const [screenState, setScreenState] = useState('loading');
    const [refreshing, setRefreshing] = useState(false);
    const [statusModel, setStatusModel] = useState(null);

    const loadStatus = async (isRefresh = false) => {
        if (!isRefresh) setScreenState('loading');

        try {
            const raw = await fetchFullStatus();
            const model = mapStatusData(raw.health, raw.trends);
            setStatusModel(model);
            setScreenState(model.state === 'empty' ? 'empty' : 'success');
        } catch (error) {
            if (!statusModel) {
                setScreenState('error');
            }
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadStatus(true);
    }, []);

    // --- LOADING ---
    if (screenState === 'loading') {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={styles.stateText}>{t('states.loading')}</Text>
            </View>
        );
    }

    // --- ERROR ---
    if (screenState === 'error') {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.errorTitle}>{t('states.errorTitle')}</Text>
                <Text style={styles.stateText}>{t('states.errorSubtitle')}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => loadStatus()}>
                    <Text style={styles.retryText}>{t('states.retry')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // --- EMPTY (no data yet) ---
    if (screenState === 'empty' || !statusModel) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.emptyTitle}>{t('status.empty.message')}</Text>
                <Text style={styles.stateText}>{t('status.empty.subtitle')}</Text>
            </View>
        );
    }

    // --- Determine which contextual card to show ---
    const isCalm = statusModel.evaluation === 'EXCELLENT' || (statusModel.evaluation === 'GOOD' && statusModel.observations.length === 0);
    const isUrgent = statusModel.evaluation === 'PROBLEM' || statusModel.evaluation === 'CRITICAL';
    const hasObservations = statusModel.observations.length > 0;

    // --- SUCCESS ---
    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#58a6ff"
                        colors={['#58a6ff']}
                    />
                }
            >
                {/* Verdictul principal */}
                <StatusHeader
                    evaluation={statusModel.evaluation}
                    message={statusModel.message}
                    subtitle={statusModel.subtitle}
                />

                {/* CALM: Totul e bine — ecran aproape gol */}
                {isCalm && (
                    <CalmState lastTrip={statusModel.lastTrip} />
                )}

                {/* URGENT: Problema importanta sau Critic — banner vizual distinct */}
                {isUrgent && hasObservations && (
                    <UrgentBanner
                        evaluation={statusModel.evaluation}
                        primaryObservation={statusModel.observations[0]}
                    />
                )}

                {/* Observatii secundare (degradare lenta sau observatii dupa banner) */}
                {hasObservations && !isCalm && (
                    <View style={styles.section}>
                        {!isUrgent && (
                            <Text style={styles.sectionLabel}>{t('sections.observations')}</Text>
                        )}
                        {statusModel.observations
                            .slice(isUrgent ? 1 : 0)
                            .map((obs, index) => (
                                <ObservationCard
                                    key={index}
                                    index={index}
                                    title={obs.title}
                                    evidence={obs.evidence}
                                    explanation={obs.explanation}
                                    action={obs.action}
                                    urgency={obs.urgency}
                                    confidence={obs.confidence}
                                    severity={obs.severity}
                                    estimateKm={obs.estimateKm}
                                    estimateDays={obs.estimateDays}
                                    onDetailPress={obs.hasDetail && obs.systemKey ? () => {
                                        if (navigation) {
                                            navigation.navigate('SubsystemDetail', {
                                                system: obs.systemKey,
                                                vin: getVin(),
                                            });
                                        }
                                    } : undefined}
                                />
                            ))
                        }
                    </View>
                )}

                {/* Sunt gata de drum lung? — apare cand nu e critic */}
                {statusModel.longTripReady && !isCalm && (
                    <View style={styles.cardSection}>
                        <Text style={styles.sectionLabel}>{t('longTrip.sectionTitle')}</Text>
                        <Text style={styles.answerText}>{statusModel.longTripReady.answer}</Text>
                        <Text style={styles.detailText}>{statusModel.longTripReady.detail}</Text>
                    </View>
                )}

                {/* Ce se apropie — cronologie mentenanta */}
                {statusModel.upcoming && !isCalm && (
                    <UpcomingTimeline items={statusModel.upcoming} />
                )}

                {/* Comparatie temporala — narativ inteligent */}
                {statusModel.comparison && (
                    <ComparisonSection comparison={statusModel.comparison} />
                )}

                {/* Ultima cursa — apare cand nu e calm (calm state o include deja) */}
                {statusModel.lastTrip && !isCalm && (
                    <View style={styles.cardSection}>
                        <Text style={styles.sectionLabel}>{t('lastTrip.sectionTitle')}</Text>
                        <Text style={styles.lastTripMeta}>{statusModel.lastTrip.text}</Text>
                        <Text style={styles.detailText}>{statusModel.lastTrip.detail}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    stateText: {
        color: '#8b949e',
        marginTop: 12,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
    },
    errorTitle: {
        color: '#f85149',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    emptyTitle: {
        color: '#c9d1d9',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    retryBtn: {
        marginTop: 20,
        backgroundColor: '#21262d',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    retryText: {
        color: '#58a6ff',
        fontWeight: '600',
        fontSize: 13,
    },
    section: {
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b949e',
        letterSpacing: 0.5,
        marginBottom: 10,
        marginLeft: 4,
    },
    cardSection: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    answerText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
        lineHeight: 22,
        marginBottom: 6,
    },
    detailText: {
        fontSize: 13,
        color: '#8b949e',
        lineHeight: 19,
    },
    lastTripMeta: {
        fontSize: 13,
        color: '#c9d1d9',
        fontWeight: '600',
        marginBottom: 4,
    },
});

export default StatusScreen;
