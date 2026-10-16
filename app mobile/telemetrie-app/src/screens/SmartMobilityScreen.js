import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, TextInput, Linking, Alert, RefreshControl,
    Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import socketService from '../services/socket';
import { useVehicle } from '../context/VehicleContext';
import { colors, typography, radii, spacing, layout, useThemeTemplate } from '../theme';

const TABS = [
    { id: 'PARCARE', label: 'SENTINELĂ & PARCARE', icon: 'shield-checkmark' },
    { id: 'VALET',   label: 'MOD VALET & SERVICE',  icon: 'speedometer' },
    { id: 'TRASEU',  label: 'TRASEU & GROPI',       icon: 'map' },
    { id: 'SOS',     label: 'eCALL & SALVARE SOS',  icon: 'medkit' },
];

export default function SmartMobilityScreen({ showBack = true }) {
    const tpl = useThemeTemplate();
    const navigation = useNavigation();
    const { activeVin, vehicleLabel } = useVehicle();

    const [activeTab, setActiveTab] = useState('PARCARE');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // ── Date Stare Tab 1: Parcare & Sentinelă ───────────────────────────────
    const [parkingData, setParkingData] = useState({
        isArmed: true,
        lat: 44.4323,
        lon: 26.1063,
        parkedMinutes: 0,
        parkingMeter: { active: false, remainingMinutes: 0 },
        lastImpact: null,
        lastTilt: null,
        sentryEvents: [],
        navigationUrl: '',
    });

    // ── Date Stare Tab 2: Mod Valet ─────────────────────────────────────────
    const [valetData, setValetData] = useState({
        isActive: false,
        centerLat: 44.4323,
        centerLon: 26.1063,
        maxRadiusKm: 3.0,
        maxSpeedKmh: 80,
        maxRpm: 3500,
        violationsCount: 0,
        violations: [],
    });

    // ── Date Stare Tab 3: Harta Traseului & Gropi ────────────────────────────
    const [trajectoryData, setTrajectoryData] = useState({
        tripId: null,
        points: [],
        potholes: [],
        hardBrakes: [],
    });

    // ── Date Stare Tab 4: Contacte Urgență ──────────────────────────────────
    const [sosData, setSosData] = useState({
        nume: 'Familie / Contact Urgență',
        telefon: '',
        mesajPersonalizat: 'Posibil accident detectat! Verifică starea mea la coordonatele GPS atașate.',
        autoSendSos: true,
    });
    const [savingSos, setSavingSos] = useState(false);

    // ── Încărcare inițială a datelor ───────────────────────────────────────
    const fetchAllData = useCallback(async () => {
        if (!activeVin) return;
        setLoading(true);
        try {
            const [pRes, vRes, sRes] = await Promise.allSettled([
                api.get(`/vehicul/${activeVin}/parcare`),
                api.get(`/vehicul/${activeVin}/valet`),
                api.get(`/vehicul/${activeVin}/sos/contacte`),
            ]);

            if (pRes.status === 'fulfilled') setParkingData(pRes.value.data);
            if (vRes.status === 'fulfilled') setValetData(vRes.value.data);
            if (sRes.status === 'fulfilled') setSosData(sRes.value.data);

            // Căutăm ultima călătorie pentru a încărca traseul și gropile
            const tripsRes = await api.get('/calatorii/istoric').catch(() => null);
            const tripsList = tripsRes?.data?.calatorii || tripsRes?.data || [];
            if (Array.isArray(tripsList) && tripsList.length > 0) {
                const latestId = tripsList[0].id_calatorie || tripsList[0].id;
                if (latestId) {
                    const trajRes = await api.get(`/calatorii/${latestId}/harta-telemetrie`).catch(() => null);
                    if (trajRes?.data) setTrajectoryData(trajRes.data);
                }
            }
        } catch (e) {
            console.error('[SmartMobility] Eroare fetch date:', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeVin]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // ── Conectare WebSocket pentru actualizări live ─────────────────────────
    useEffect(() => {
        const socket = socketService.connect();

        const onSentryAlert = (data) => {
            if (data.vin && activeVin && data.vin.toUpperCase() === activeVin.toUpperCase()) {
                setParkingData(prev => ({
                    ...prev,
                    sentryEvents: [data, ...(prev.sentryEvents || [])].slice(0, 10),
                    lastImpact: data.tip === 'IMPACT' ? { forceG: data.valoare, at: Math.floor(Date.now() / 1000) } : prev.lastImpact,
                    lastTilt: data.tip === 'INCLINARE' ? { deg: data.valoare, at: Math.floor(Date.now() / 1000) } : prev.lastTilt,
                }));
            }
        };

        const onValetAlert = (newVio) => {
            setValetData(prev => ({
                ...prev,
                violationsCount: (prev.violationsCount || 0) + 1,
                violations: [newVio, ...(prev.violations || [])].slice(0, 20),
            }));
        };

        const onPothole = (pothole) => {
            setTrajectoryData(prev => ({
                ...prev,
                potholes: [pothole, ...(prev.potholes || [])],
            }));
        };

        const onParkingUpdate = (pUpdate) => {
            if (pUpdate.vin && activeVin && pUpdate.vin.toUpperCase() === activeVin.toUpperCase()) {
                setParkingData(prev => ({
                    ...prev,
                    lat: pUpdate.lat,
                    lon: pUpdate.lon,
                    parkedMinutes: 0,
                    isArmed: pUpdate.isArmed,
                    navigationUrl: pUpdate.navigationUrl || prev.navigationUrl,
                }));
            }
        };

        socket.on('alerta_sentinela', onSentryAlert);
        socket.on('alerta_valet', onValetAlert);
        socket.on('groapa_detectata', onPothole);
        socket.on('parcare_actualizata', onParkingUpdate);

        return () => {
            socket.off('alerta_sentinela', onSentryAlert);
            socket.off('alerta_valet', onValetAlert);
            socket.off('groapa_detectata', onPothole);
            socket.off('parcare_actualizata', onParkingUpdate);
        };
    }, [activeVin]);

    // ── Handler: Toggle Armare Sentinela ────────────────────────────────────
    const toggleSentryArm = async (value) => {
        setParkingData(prev => ({ ...prev, isArmed: value }));
        try {
            await api.post(`/vehicul/${activeVin}/parcare/sentry/toggle`, { isArmed: value });
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut actualiza starea Sentinelei.');
            setParkingData(prev => ({ ...prev, isArmed: !value }));
        }
    };

    // ── Handler: Adăugare minute tichet parcare ─────────────────────────────
    const addParkingMeterMinutes = async (minutes) => {
        try {
            const res = await api.post(`/vehicul/${activeVin}/parcare/meter`, { minutes });
            setParkingData(prev => ({
                ...prev,
                parkingMeter: {
                    active: true,
                    expiresAt: res.data.expiresAt,
                    remainingMinutes: minutes,
                },
            }));
            Alert.alert('Tichet Prelungit', `Cronometrul de parcare a fost setat pentru ${minutes} minute.`);
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut seta tichetul de parcare.');
        }
    };

    // ── Handler: Navigare pe jos la mașină ──────────────────────────────────
    const handleWalkToCar = () => {
        const url = parkingData.navigationUrl || `https://www.google.com/maps/dir/?api=1&destination=${parkingData.lat},${parkingData.lon}&travelmode=walking`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Eroare', 'Nu s-a putut deschide aplicația de hărți.');
        });
    };

    // ── Handler: Salvare & Toggle Mod Valet ─────────────────────────────────
    const handleSaveValet = async (overrideActive) => {
        const nextActive = overrideActive !== undefined ? overrideActive : valetData.isActive;
        try {
            const payload = {
                isActive: nextActive,
                maxRadiusKm: valetData.maxRadiusKm,
                maxSpeedKmh: valetData.maxSpeedKmh,
                maxRpm: valetData.maxRpm,
            };
            const res = await api.post(`/vehicul/${activeVin}/valet/toggle`, payload);
            setValetData(prev => ({
                ...prev,
                isActive: res.data.isActive,
                maxRadiusKm: res.data.maxRadiusKm,
                maxSpeedKmh: res.data.maxSpeedKmh,
                maxRpm: res.data.maxRpm,
            }));
            Alert.alert('Mod Valet', nextActive ? '🛡️ Modul Valet a fost ACTIVAT cu succes!' : 'Modul Valet a fost DEZACTIVAT.');
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-au putut salva setările Modului Valet.');
        }
    };

    // ── Handler: Salvare Contact Urgență SOS ────────────────────────────────
    const handleSaveSos = async () => {
        setSavingSos(true);
        try {
            await api.post(`/vehicul/${activeVin}/sos/contacte`, sosData);
            Alert.alert('Salvat', 'Datele de urgență și salvare SOS au fost actualizate.');
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut salva contactul de urgență.');
        } finally {
            setSavingSos(false);
        }
    };

    // ── Handler: Testare Simulare Accident & SOS ────────────────────────────
    const handleTriggerCrashTest = async () => {
        Alert.alert(
            'Test eCall & Coliziune',
            'Se va declanșa un eveniment de test coliziune violentă (3.2G la 68 km/h). Fereastra de salvare de 30 secunde va apărea pe ecran.',
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'DECLANȘEAZĂ TEST',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(`/vehicul/${activeVin}/sos/test`, {
                                lat: parkingData.lat || 44.4323,
                                lon: parkingData.lon || 26.1063,
                                forceG: 3.2,
                                speed: 68,
                            });
                        } catch (e) {
                            Alert.alert('Eroare', 'Nu s-a putut trimite semnalul de test.');
                        }
                    },
                },
            ]
        );
    };

    // ── Simulare Test Sentinela (Șoc sau Înclinare) ─────────────────────────
    const handleTriggerSentryTest = async (tip = 'IMPACT') => {
        try {
            await api.post(`/vehicul/${activeVin}/sentry/test`, {
                tip,
                forceG: 0.85,
                tiltDeg: 4.2,
            });
            Alert.alert(
                tip === 'INCLINARE' ? '📐 Test Înclinare Transmis' : '🎯 Test Șoc Transmis',
                tip === 'INCLINARE'
                    ? 'S-a simulat o înclinare de 4.2° (tentativă furt roți / platformă). Alerta a fost logată!'
                    : 'S-a simulat un impact în parcare de 0.85G. Alerta Sentinela a fost declanșată!'
            );
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut trimite testul de sentinela.');
        }
    };

    // ── Simulare Test Violare Mod Valet ─────────────────────────────────────
    const handleTriggerValetTest = async () => {
        try {
            await api.post(`/vehicul/${activeVin}/valet/test`, {
                speed: 94,
                rpm: 3950,
            });
            Alert.alert('⚠️ Test Abuz Valet Transmis', 'S-a simulat depășirea limitelor (94 km/h și 3950 RPM). Alerta apare în jurnal!');
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut trimite testul de valet.');
        }
    };

    // ── Simulare Test Groapă Asfalt ─────────────────────────────────────────
    const handleTriggerPotholeTest = async () => {
        try {
            await api.post(`/vehicul/${activeVin}/pothole/test`, {
                forceG: 1.95,
                speed: 48,
            });
            Alert.alert('🕳️ Test Groapă Transmis', 'S-a detectat o denivelare violentă de 1.95G. Punctul a fost adăugat pe traseu!');
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut trimite testul de groapă.');
        }
    };

    const pt = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

    return (
        <View style={[styles.root, { backgroundColor: tpl.bg, paddingTop: pt }]}>
            {/* ── Header Ecran ────────────────────────────────────────────── */}
            <View style={[styles.header, { borderBottomColor: tpl.border }]}>
                {showBack && (
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                    >
                        <Ionicons name="arrow-back" size={24} color={tpl.text || '#eef0f8'} />
                    </TouchableOpacity>
                )}
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: tpl.textSecondary || '#8b96b5' }]}>
                        SMART MOBILITY & SECURITATE
                    </Text>
                    <Text style={[styles.headerSub, { color: tpl.text || '#eef0f8' }]}>
                        {vehicleLabel || activeVin || 'Vehicul Conectat'}
                    </Text>
                </View>
                <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>GPS ACTIV</Text>
                </View>
            </View>

            {/* ── Segmented Control Bar ───────────────────────────────────── */}
            <View style={[styles.tabsBar, { borderBottomColor: tpl.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[
                                    styles.tabBtn,
                                    { borderColor: tpl.border },
                                    isActive && { backgroundColor: tpl.accent, borderColor: tpl.accent },
                                ]}
                                onPress={() => setActiveTab(tab.id)}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={15}
                                    color={isActive ? '#05070e' : (tpl.textSecondary || '#8b96b5')}
                                />
                                <Text
                                    style={[
                                        styles.tabBtnText,
                                        { color: tpl.textSecondary || '#8b96b5' },
                                        isActive && styles.tabBtnTextActive,
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── Conținut Principal Tabs ─────────────────────────────────── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchAllData();
                        }}
                        tintColor={tpl.accent}
                    />
                }
            >
                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={tpl.accent} />
                        <Text style={[styles.loaderText, { color: tpl.textSecondary }]}>
                            Se sincronizează telemetria și senzorii de securitate...
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* ========================================================= */}
                        {/* TAB 1: PARCARE & SENTINELĂ                                */}
                        {/* ========================================================= */}
                        {activeTab === 'PARCARE' && (
                            <View style={styles.tabContent}>
                                {/* Card Găsește-mi Mașina */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="navigate-circle" size={22} color={tpl.accent} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>GĂSEȘTE-MI MAȘINA</Text>
                                        </View>
                                        <View style={styles.badgePill}>
                                            <Text style={styles.badgePillText}>
                                                {parkingData.parkedMinutes > 0 ? `Parcat de ${parkingData.parkedMinutes}m` : 'Locație Curentă'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Coordonatele GPS sunt memorate automat la oprirea contactului pentru a te ghida pe jos direct la autoturism.
                                    </Text>

                                    <View style={styles.coordRow}>
                                        <View style={styles.coordBox}>
                                            <Text style={[styles.coordLabel, { color: tpl.textSecondary || '#8b96b5' }]}>LATITUDINE</Text>
                                            <Text style={[styles.coordVal, { color: tpl.text || '#eef0f8' }]}>
                                                {parkingData.lat?.toFixed(5) || '44.43230'}
                                            </Text>
                                        </View>
                                        <View style={styles.coordBox}>
                                            <Text style={[styles.coordLabel, { color: tpl.textSecondary || '#8b96b5' }]}>LONGITUDINE</Text>
                                            <Text style={[styles.coordVal, { color: tpl.text || '#eef0f8' }]}>
                                                {parkingData.lon?.toFixed(5) || '26.10630'}
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: tpl.accent }]}
                                        onPress={handleWalkToCar}
                                    >
                                        <Ionicons name="walk" size={18} color="#05070e" />
                                        <Text style={[styles.primaryActionBtnText, { color: '#05070e' }]}>
                                            NAVIGHEAZĂ PE JOS LA MAȘINĂ
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Card Cronometru Tichet Parcare cu Plată */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="timer-outline" size={22} color="#f0c04a" />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>TICHET PARCARE CU PLATĂ</Text>
                                        </View>
                                        {parkingData.parkingMeter?.active && (
                                            <View style={[styles.badgePill, { backgroundColor: 'rgba(240,192,74,0.15)', borderColor: '#f0c04a' }]}>
                                                <Text style={[styles.badgePillText, { color: '#f0c04a' }]}>ACTIV</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.meterDisplay}>
                                        <Text style={[styles.meterMinutes, { color: parkingData.parkingMeter?.active ? '#f0c04a' : (tpl.textSecondary || '#8b96b5') }]}>
                                            {parkingData.parkingMeter?.remainingMinutes || 0}
                                        </Text>
                                        <Text style={[styles.meterSub, { color: tpl.textSecondary || '#8b96b5' }]}>minute rămase pe tichet</Text>
                                    </View>

                                    <Text style={[styles.meterPrompt, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Setează sau prelungește timpul de parcare pentru a primi notificare înainte de expirare:
                                    </Text>

                                    <View style={styles.meterButtonsRow}>
                                        {[15, 30, 60, 120].map(mins => (
                                            <TouchableOpacity
                                                key={mins}
                                                style={[styles.meterChip, { borderColor: tpl.border, backgroundColor: 'rgba(255,255,255,0.03)' }]}
                                                onPress={() => addParkingMeterMinutes(mins)}
                                            >
                                                <Text style={[styles.meterChipText, { color: tpl.text || '#eef0f8' }]}>
                                                    +{mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Card Sentinela de Parcare (Sentry Mode) */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="shield-half" size={22} color={colors.status.optimal} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>SENTINELA DE PARCARE</Text>
                                        </View>
                                        <Switch
                                            value={parkingData.isArmed}
                                            onValueChange={toggleSentryArm}
                                            trackColor={{ false: '#2e3555', true: colors.status.optimal }}
                                            thumbColor="#ffffff"
                                        />
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Monitorizează pasiv șocurile de caroserie (tamponări), unghiul de înclinare (furt roți / ridicare platformă) și perimetrul antifurt invizibil de 30m.
                                    </Text>

                                    {/* Indicatori Senzori Sentinela */}
                                    <View style={styles.sentrySensorsGrid}>
                                        <View style={[styles.sentrySensorItem, { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: tpl.border }]}>
                                            <Ionicons name="flash-outline" size={20} color={parkingData.lastImpact ? colors.status.caution : colors.status.good} />
                                            <Text style={[styles.sensorName, { color: tpl.textSecondary || '#8b96b5' }]}>Șoc / Tamponare</Text>
                                            <Text style={[styles.sensorState, { color: tpl.text || '#eef0f8' }]}>
                                                {parkingData.lastImpact ? `${parkingData.lastImpact.forceG}G` : 'Normal (0.0G)'}
                                            </Text>
                                        </View>

                                        <View style={[styles.sentrySensorItem, { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: tpl.border }]}>
                                            <Ionicons name="trending-up-outline" size={20} color={parkingData.lastTilt ? colors.status.caution : colors.status.good} />
                                            <Text style={[styles.sensorName, { color: tpl.textSecondary || '#8b96b5' }]}>Înclinare Șasiu</Text>
                                            <Text style={[styles.sensorState, { color: tpl.text || '#eef0f8' }]}>
                                                {parkingData.lastTilt ? `${parkingData.lastTilt.deg}°` : 'Stabil (0.0°)'}
                                            </Text>
                                        </View>

                                        <View style={[styles.sentrySensorItem, { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: tpl.border }]}>
                                            <Ionicons name="radio-outline" size={20} color={colors.status.good} />
                                            <Text style={[styles.sensorName, { color: tpl.textSecondary || '#8b96b5' }]}>Geofence Antifurt</Text>
                                            <Text style={[styles.sensorState, { color: tpl.text || '#eef0f8' }]}>Rază 30m OK</Text>
                                        </View>
                                    </View>

                                    {/* Evenimente recente sentinela */}
                                    {parkingData.sentryEvents && parkingData.sentryEvents.length > 0 && (
                                        <View style={styles.eventsSection}>
                                            <Text style={[styles.eventsTitle, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                EVENIMENTE DETECTATE ÎN PARCARE
                                            </Text>
                                            {parkingData.sentryEvents.map((ev, idx) => (
                                                <View key={idx} style={[styles.eventRow, { borderColor: tpl.border }]}>
                                                    <Ionicons
                                                        name={ev.tip === 'IMPACT' ? 'warning' : (ev.tip === 'INCLINARE' ? 'swap-vertical' : 'location')}
                                                        size={18}
                                                        color={colors.status.caution}
                                                    />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.eventTitlu, { color: tpl.text || '#eef0f8' }]}>{ev.titlu || ev.descriere}</Text>
                                                        <Text style={[styles.eventDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                    {/* Card Testare Simulare Sentinela Demo */}
                                    <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: tpl.border, marginTop: spacing[3] }]}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.cardTitleRow}>
                                                <Ionicons name="flask-outline" size={20} color={tpl.accent} />
                                                <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8', fontSize: typography.sizes.caption }]}>SIMULARE LIVE / TEST DEMO COMISIE</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                            Declanșează instant evenimentele de protecție pentru a demonstra reacția senzorilor în timp real:
                                        </Text>
                                        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                                            <TouchableOpacity
                                                style={[styles.primaryActionBtn, { flex: 1, backgroundColor: 'rgba(240,100,100,0.18)', borderWidth: 1, borderColor: colors.status.critical }]}
                                                onPress={() => handleTriggerSentryTest('IMPACT')}
                                            >
                                                <Ionicons name="flash" size={16} color={colors.status.critical} />
                                                <Text style={[styles.primaryActionBtnText, { color: colors.status.critical, fontSize: typography.sizes.tiny }]}>Șoc 0.85G</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.primaryActionBtn, { flex: 1, backgroundColor: 'rgba(240,192,74,0.18)', borderWidth: 1, borderColor: colors.status.monitor }]}
                                                onPress={() => handleTriggerSentryTest('INCLINARE')}
                                            >
                                                <Ionicons name="trending-up" size={16} color={colors.status.monitor} />
                                                <Text style={[styles.primaryActionBtnText, { color: colors.status.monitor, fontSize: typography.sizes.tiny }]}>Înclinare 4.2°</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* ========================================================= */}
                        {/* TAB 2: MOD VALET / SERVICE / ÎMPRUMUT                      */}
                        {/* ========================================================= */}
                        {activeTab === 'VALET' && (
                            <View style={styles.tabContent}>
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="key" size={22} color={colors.accent.default} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>MOD VALET & SERVICE</Text>
                                        </View>
                                        <Switch
                                            value={valetData.isActive}
                                            onValueChange={(val) => handleSaveValet(val)}
                                            trackColor={{ false: '#2e3555', true: colors.accent.default }}
                                            thumbColor="#ffffff"
                                        />
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Setează restricții stricte când lași mașina la spălătorie, mecanic sau prieteni. Orice depășire de viteză, turație sau perimetru este înregistrată instant!
                                    </Text>

                                    {/* Limită Viteză */}
                                    <View style={styles.settingGroup}>
                                        <View style={styles.settingLabelRow}>
                                            <Text style={[styles.settingLabel, { color: tpl.text || '#eef0f8' }]}>VITEZĂ MAXIMĂ PERMISĂ</Text>
                                            <Text style={[styles.settingValue, { color: tpl.accent }]}>{valetData.maxSpeedKmh} km/h</Text>
                                        </View>
                                        <View style={styles.selectorRow}>
                                            {[50, 70, 80, 100].map(spd => (
                                                <TouchableOpacity
                                                    key={spd}
                                                    style={[
                                                        styles.selectorBtn,
                                                        { borderColor: tpl.border },
                                                        valetData.maxSpeedKmh === spd && { backgroundColor: tpl.accent, borderColor: tpl.accent },
                                                    ]}
                                                    onPress={() => setValetData(p => ({ ...p, maxSpeedKmh: spd }))}
                                                >
                                                    <Text style={[styles.selectorBtnText, { color: tpl.textSecondary || '#8b96b5' }, valetData.maxSpeedKmh === spd && styles.selectorBtnTextActive]}>
                                                        {spd} km/h
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Limită Turație RPM */}
                                    <View style={styles.settingGroup}>
                                        <View style={styles.settingLabelRow}>
                                            <Text style={[styles.settingLabel, { color: tpl.text || '#eef0f8' }]}>TURAȚIE MAXIMĂ (RPM LIMITER)</Text>
                                            <Text style={[styles.settingValue, { color: tpl.accent }]}>{valetData.maxRpm} RPM</Text>
                                        </View>
                                        <View style={styles.selectorRow}>
                                            {[2500, 3000, 3500, 4200].map(rpm => (
                                                <TouchableOpacity
                                                    key={rpm}
                                                    style={[
                                                        styles.selectorBtn,
                                                        { borderColor: tpl.border },
                                                        valetData.maxRpm === rpm && { backgroundColor: tpl.accent, borderColor: tpl.accent },
                                                    ]}
                                                    onPress={() => setValetData(p => ({ ...p, maxRpm: rpm }))}
                                                >
                                                    <Text style={[styles.selectorBtnText, { color: tpl.textSecondary || '#8b96b5' }, valetData.maxRpm === rpm && styles.selectorBtnTextActive]}>
                                                        {rpm} RPM
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Rază Geofence față de atelier */}
                                    <View style={styles.settingGroup}>
                                        <View style={styles.settingLabelRow}>
                                            <Text style={[styles.settingLabel, { color: tpl.text || '#eef0f8' }]}>RAZĂ PERIMETRU (DE LA ATELIER)</Text>
                                            <Text style={[styles.settingValue, { color: tpl.accent }]}>{valetData.maxRadiusKm} km</Text>
                                        </View>
                                        <View style={styles.selectorRow}>
                                            {[1.0, 2.0, 3.0, 5.0].map(rad => (
                                                <TouchableOpacity
                                                    key={rad}
                                                    style={[
                                                        styles.selectorBtn,
                                                        { borderColor: tpl.border },
                                                        valetData.maxRadiusKm === rad && { backgroundColor: tpl.accent, borderColor: tpl.accent },
                                                    ]}
                                                    onPress={() => setValetData(p => ({ ...p, maxRadiusKm: rad }))}
                                                >
                                                    <Text style={[styles.selectorBtnText, { color: tpl.textSecondary || '#8b96b5' }, valetData.maxRadiusKm === rad && styles.selectorBtnTextActive]}>
                                                        {rad} km
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: tpl.accent, marginTop: spacing[3] }]}
                                        onPress={() => handleSaveValet(true)}
                                    >
                                        <Ionicons name="save-outline" size={18} color="#05070e" />
                                        <Text style={[styles.primaryActionBtnText, { color: '#05070e' }]}>
                                            {valetData.isActive ? 'ACTUALIZEAZĂ LIMITELE VALET' : 'ACTIVEAZĂ MODUL VALET ACUM'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Jurnal Violări Mod Valet */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="alert-circle-outline" size={22} color={colors.status.caution} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>JURNAL VIOLĂRI & ABUZURI</Text>
                                        </View>
                                        <View style={[styles.badgePill, { backgroundColor: valetData.violationsCount > 0 ? 'rgba(240,100,100,0.15)' : 'rgba(47,207,164,0.15)' }]}>
                                            <Text style={[styles.badgePillText, { color: valetData.violationsCount > 0 ? colors.status.critical : colors.status.optimal }]}>
                                                {valetData.violationsCount} VIOLĂRI
                                            </Text>
                                        </View>
                                    </View>

                                    {valetData.violations && valetData.violations.length > 0 ? (
                                        <View style={styles.violationsList}>
                                            {valetData.violations.map((vio, index) => (
                                                <View key={index} style={[styles.eventRow, { borderColor: tpl.border }]}>
                                                    <Ionicons name="warning" size={18} color={colors.status.critical} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.eventTitlu, { color: tpl.text || '#eef0f8' }]}>{vio.descriere}</Text>
                                                        <Text style={[styles.eventDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                            {new Date(vio.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Coordonate: {vio.lat?.toFixed(4)}, {vio.lon?.toFixed(4)}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5', textAlign: 'center', marginVertical: spacing[3] }]}>
                                            Nicio încălcare detectată! Vehiculul se află în parametrii permiși.
                                        </Text>
                                    )}

                                    {/* Buton Test Simulare Abuz Valet */}
                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: 'rgba(240,100,100,0.18)', borderWidth: 1, borderColor: colors.status.critical, marginTop: spacing[3] }]}
                                        onPress={handleTriggerValetTest}
                                    >
                                        <Ionicons name="speedometer-outline" size={16} color={colors.status.critical} />
                                        <Text style={[styles.primaryActionBtnText, { color: colors.status.critical }]}>
                                            SIMULEAZĂ ABUZ VALET (94 KM/H & 3950 RPM)
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ========================================================= */}
                        {/* TAB 3: TRASEU & GROPI (AMPRENTĂ TELEMETRICĂ)              */}
                        {/* ========================================================= */}
                        {activeTab === 'TRASEU' && (
                            <View style={styles.tabContent}>
                                {/* Sumar Cursă Activă / Recentă */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="trail-sign-outline" size={22} color={tpl.accent} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>AMPRENTĂ TELEMETRICĂ</Text>
                                        </View>
                                        <Text style={[styles.badgePillText, { color: tpl.textSecondary || '#8b96b5' }]}>
                                            {trajectoryData.totalPoints || trajectoryData.points?.length || 0} puncte GPS
                                        </Text>
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Fuziune GPS + OBD-II cu evidențierea consumului și solicitării mecanice pe segmente de culoare:
                                    </Text>

                                    {/* Legendă culori traseu */}
                                    <View style={styles.legendRow}>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: '#10b981' }]} />
                                            <Text style={[styles.legendText, { color: tpl.textSecondary || '#8b96b5' }]}>Economic / Lin</Text>
                                        </View>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: '#f59e0b' }]} />
                                            <Text style={[styles.legendText, { color: tpl.textSecondary || '#8b96b5' }]}>Sarcină Medie</Text>
                                        </View>
                                        <View style={styles.legendItem}>
                                            <View style={[styles.legendColor, { backgroundColor: '#ff453a' }]} />
                                            <Text style={[styles.legendText, { color: tpl.textSecondary || '#8b96b5' }]}>Sarcină Maximă / Accel</Text>
                                        </View>
                                    </View>

                                    {/* Eșantion Traseu GPS */}
                                    {trajectoryData.points && trajectoryData.points.length > 0 ? (
                                        <View style={styles.trajectoryPointsList}>
                                            <Text style={[styles.subSectionTitle, { color: tpl.text || '#eef0f8' }]}>PUNCTE TRASEU RECENȚI</Text>
                                            {trajectoryData.points.slice(0, 5).map((pt, i) => (
                                                <View key={i} style={[styles.trajPointItem, { borderColor: tpl.border }]}>
                                                    <View style={[styles.pointIndicator, { backgroundColor: pt.color }]} />
                                                    <Text style={[styles.pointCoords, { color: tpl.text || '#eef0f8' }]}>
                                                        {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                                                    </Text>
                                                    <Text style={[styles.pointMeta, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                        {Math.round(pt.speedKmh)} km/h • {pt.consumLh.toFixed(1)} L/h
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5', textAlign: 'center', marginVertical: spacing[2] }]}>
                                            Porniți o călătorie pentru a înregistra segmentele telemetrice.
                                        </Text>
                                    )}
                                </View>

                                {/* Card Detecție Gropi Asfalt */}
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="alert" size={22} color={colors.status.caution} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>DETECȚIE GROPI & DENIVELĂRI</Text>
                                        </View>
                                        <View style={[styles.badgePill, { backgroundColor: 'rgba(240,192,74,0.15)' }]}>
                                            <Text style={[styles.badgePillText, { color: colors.status.monitor }]}>
                                                {trajectoryData.potholes?.length || 0} GROPI
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        Accelerometrul vertical inerțial identifică denivelările periculoase din carosabil (&gt; 1.75G) și le mapează exact prin coordonate GPS.
                                    </Text>

                                    {trajectoryData.potholes && trajectoryData.potholes.length > 0 ? (
                                        <View style={styles.potholeList}>
                                            {trajectoryData.potholes.map((ph, idx) => (
                                                <View key={idx} style={[styles.potholeItem, { borderColor: tpl.border }]}>
                                                    <View style={styles.potholeLeft}>
                                                        <Text style={[styles.potholeForce, { color: colors.status.caution }]}>
                                                            {ph.forceG?.toFixed(2)} G
                                                        </Text>
                                                        <Text style={[styles.potholeTime, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                            {new Date(ph.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.potholeCenter}>
                                                        <Text style={[styles.potholeDesc, { color: tpl.text || '#eef0f8' }]}>
                                                            {ph.descriere || 'Groapă / denivelare violentă'}
                                                        </Text>
                                                        <Text style={[styles.potholeCoords, { color: tpl.textSecondary || '#8b96b5' }]}>
                                                            GPS: {ph.lat?.toFixed(5)}, {ph.lon?.toFixed(5)}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={[styles.mapBtn, { borderColor: tpl.border }]}
                                                        onPress={() => Linking.openURL(`https://maps.google.com/?q=${ph.lat},${ph.lon}`)}
                                                    >
                                                        <Ionicons name="map-outline" size={16} color={tpl.accent} />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5', textAlign: 'center', marginVertical: spacing[3] }]}>
                                            Nicio groapă severă detectată în această sesiune!
                                        </Text>
                                    )}

                                    {/* Buton Test Simulare Groapă Asfalt */}
                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: 'rgba(240,192,74,0.18)', borderWidth: 1, borderColor: colors.status.monitor, marginTop: spacing[3] }]}
                                        onPress={handleTriggerPotholeTest}
                                    >
                                        <Ionicons name="alert-outline" size={16} color={colors.status.monitor} />
                                        <Text style={[styles.primaryActionBtnText, { color: colors.status.monitor }]}>
                                            SIMULEAZĂ GROAPĂ SEVERĂ (1.95G PE COORDONATELE CURENTE)
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* ========================================================= */}
                        {/* TAB 4: eCALL & SALVARE SOS                                */}
                        {/* ========================================================= */}
                        {activeTab === 'SOS' && (
                            <View style={styles.tabContent}>
                                <View style={[styles.card, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="heart-dislike" size={22} color={colors.status.critical} />
                                            <Text style={[styles.cardTitle, { color: tpl.text || '#eef0f8' }]}>DETECȚIE ACCIDENT & eCALL</Text>
                                        </View>
                                        <View style={[styles.badgePill, { backgroundColor: 'rgba(240,100,100,0.15)' }]}>
                                            <Text style={[styles.badgePillText, { color: colors.status.critical }]}>ACTIVAT (&gt;2.8G)</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.cardDesc, { color: tpl.textSecondary || '#8b96b5' }]}>
                                        La detectarea unui impact sever (&gt; 2.8G la viteză), aplicația pornește o numărătoare inversă de 30 secunde. Dacă nu este anulată, transmite automat coordonatele Google Maps către persoana de contact!
                                    </Text>

                                    {/* Câmp Nume Contact */}
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: tpl.textSecondary || '#8b96b5' }]}>NUME PERSOANĂ DE CONTACT</Text>
                                        <TextInput
                                            style={[styles.textInput, { backgroundColor: tpl.bg, borderColor: tpl.border, color: tpl.text || '#eef0f8' }]}
                                            value={sosData.nume}
                                            onChangeText={(t) => setSosData(p => ({ ...p, nume: t }))}
                                            placeholder="Ex: Soț / Soție / Părinte"
                                            placeholderTextColor={tpl.textSecondary || '#8b96b5'}
                                        />
                                    </View>

                                    {/* Câmp Telefon */}
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: tpl.textSecondary || '#8b96b5' }]}>NUMĂR DE TELEFON (PENTRU SMS & APEL SOS)</Text>
                                        <TextInput
                                            style={[styles.textInput, { backgroundColor: tpl.bg, borderColor: tpl.border, color: tpl.text || '#eef0f8' }]}
                                            value={sosData.telefon}
                                            onChangeText={(t) => setSosData(p => ({ ...p, telefon: t }))}
                                            placeholder="Ex: +40722123456"
                                            placeholderTextColor={tpl.textSecondary || '#8b96b5'}
                                            keyboardType="phone-pad"
                                        />
                                    </View>

                                    {/* Mesaj SOS Personalizat */}
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: tpl.textSecondary || '#8b96b5' }]}>MESAJ SALVARE PERSONALIZAT</Text>
                                        <TextInput
                                            style={[styles.textInputArea, { backgroundColor: tpl.bg, borderColor: tpl.border, color: tpl.text || '#eef0f8' }]}
                                            value={sosData.mesajPersonalizat}
                                            onChangeText={(t) => setSosData(p => ({ ...p, mesajPersonalizat: t }))}
                                            multiline
                                            numberOfLines={3}
                                            placeholderTextColor={tpl.textSecondary || '#8b96b5'}
                                        />
                                    </View>

                                    {/* Buton Salvare */}
                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: tpl.accent, marginTop: spacing[2] }]}
                                        onPress={handleSaveSos}
                                        disabled={savingSos}
                                    >
                                        {savingSos ? (
                                            <ActivityIndicator size="small" color="#05070e" />
                                        ) : (
                                            <>
                                                <Ionicons name="shield-checkmark-outline" size={18} color="#05070e" />
                                                <Text style={[styles.primaryActionBtnText, { color: '#05070e' }]}>SALVEAZĂ CONTACTUL DE URGENȚĂ</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {/* Card Testare Simulare SOS */}
                                <View style={[styles.card, { backgroundColor: '#140708', borderColor: '#d32f2f' }]}>
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardTitleRow}>
                                            <Ionicons name="flame" size={22} color="#ff5252" />
                                            <Text style={[styles.cardTitle, { color: '#ffffff' }]}>SIMULARE DEMO / TEST eCALL</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.cardDesc, { color: '#ffcdd2' }]}>
                                        Apasă butonul de mai jos pentru a declanșa o simulare de impact sever (3.2G). Vei vedea fereastra de alertă de 30 de secunde și transmiterea coordonatelor.
                                    </Text>

                                    <TouchableOpacity
                                        style={[styles.primaryActionBtn, { backgroundColor: '#d32f2f', marginTop: spacing[2] }]}
                                        onPress={handleTriggerCrashTest}
                                    >
                                        <Ionicons name="warning-outline" size={18} color="#ffffff" />
                                        <Text style={styles.primaryActionBtnText}>
                                            DECLANȘEAZĂ TEST SIMULARE IMPACT
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    backBtn: {
        marginRight: spacing[3],
        padding: spacing[1],
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.heavy,
        color: '#8b96b5',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    headerSub: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
        marginTop: 1,
    },
    livePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing[2],
        paddingVertical: 4,
        borderRadius: radii.full,
        backgroundColor: 'rgba(47,207,164,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(47,207,164,0.3)',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.status.optimal,
    },
    livePillText: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.heavy,
        color: colors.status.optimal,
    },
    tabsBar: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        paddingVertical: spacing[2],
    },
    tabsScroll: {
        paddingHorizontal: layout.screenPaddingH,
        gap: spacing[2],
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    tabBtnText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#8b96b5',
    },
    tabBtnTextActive: {
        color: '#05070e',
        fontWeight: '800',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: layout.screenPaddingH,
        paddingBottom: spacing[8],
    },
    loaderContainer: {
        paddingVertical: spacing[8],
        alignItems: 'center',
        gap: spacing[3],
    },
    loaderText: {
        fontSize: typography.sizes.caption,
        color: '#8b96b5',
    },
    tabContent: {
        gap: spacing[4],
    },
    card: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[4],
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    cardTitle: {
        fontSize: typography.sizes.callout,
        fontWeight: typography.weights.heavy,
        color: '#eef0f8',
        letterSpacing: 0.6,
    },
    cardDesc: {
        fontSize: typography.sizes.caption,
        color: '#8b96b5',
        lineHeight: 18,
        marginBottom: spacing[3],
    },
    badgePill: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: 'rgba(77,142,245,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(77,142,245,0.3)',
    },
    badgePillText: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.bold,
        color: colors.accent.default,
    },
    coordRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    coordBox: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: spacing[3],
        borderRadius: radii.md,
    },
    coordLabel: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.bold,
        color: '#8b96b5',
    },
    coordVal: {
        fontSize: typography.sizes.callout,
        fontWeight: typography.weights.heavy,
        color: '#eef0f8',
        marginTop: 2,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    primaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        paddingVertical: spacing[3],
        borderRadius: radii.md,
    },
    primaryActionBtnText: {
        color: '#05070e',
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    meterDisplay: {
        alignItems: 'center',
        marginVertical: spacing[2],
    },
    meterMinutes: {
        fontSize: 54,
        fontWeight: typography.weights.heavy,
        color: '#8b96b5',
        lineHeight: 58,
    },
    meterSub: {
        fontSize: typography.sizes.caption,
        color: '#8b96b5',
    },
    meterPrompt: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
        textAlign: 'center',
        marginBottom: spacing[2],
    },
    meterButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing[2],
    },
    meterChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
    },
    meterChipText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        color: '#eef0f8',
    },
    sentrySensorsGrid: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    sentrySensorItem: {
        flex: 1,
        alignItems: 'center',
        padding: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
        gap: 2,
    },
    sensorName: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
        textAlign: 'center',
        marginTop: 2,
    },
    sensorState: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        color: '#eef0f8',
        textAlign: 'center',
    },
    eventsSection: {
        marginTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        paddingTop: spacing[2],
    },
    eventsTitle: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.bold,
        color: '#8b96b5',
        letterSpacing: 0.6,
        marginBottom: spacing[2],
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[2],
        borderBottomWidth: 1,
    },
    eventTitlu: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
    },
    eventDesc: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
        marginTop: 2,
    },
    settingGroup: {
        marginBottom: spacing[3],
    },
    settingLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    settingLabel: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
    },
    settingValue: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
    },
    selectorRow: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    selectorBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    selectorBtnText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#8b96b5',
    },
    selectorBtnTextActive: {
        color: '#05070e',
        fontWeight: '800',
    },
    legendRow: {
        flexDirection: 'row',
        gap: spacing[3],
        marginBottom: spacing[3],
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendColor: {
        width: 12,
        height: 12,
        borderRadius: 2,
    },
    legendText: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
    },
    trajectoryPointsList: {
        gap: spacing[2],
    },
    subSectionTitle: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
        marginBottom: 2,
    },
    trajPointItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingVertical: spacing[1],
        borderBottomWidth: 1,
    },
    pointIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    pointCoords: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    pointMeta: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
        marginLeft: 'auto',
    },
    potholeList: {
        gap: spacing[2],
    },
    potholeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderBottomWidth: 1,
        gap: spacing[3],
    },
    potholeLeft: {
        alignItems: 'center',
        minWidth: 50,
    },
    potholeForce: {
        fontSize: typography.sizes.callout,
        fontWeight: typography.weights.heavy,
    },
    potholeTime: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
    },
    potholeCenter: {
        flex: 1,
    },
    potholeDesc: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: '#eef0f8',
    },
    potholeCoords: {
        fontSize: typography.sizes.tiny,
        color: '#8b96b5',
        marginTop: 2,
    },
    mapBtn: {
        padding: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
    },
    inputGroup: {
        marginBottom: spacing[3],
    },
    inputLabel: {
        fontSize: typography.sizes.tiny,
        fontWeight: typography.weights.bold,
        color: '#8b96b5',
        letterSpacing: 0.6,
        marginBottom: spacing[1],
    },
    textInput: {
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        fontSize: typography.sizes.caption,
        color: '#eef0f8',
    },
    textInputArea: {
        borderRadius: radii.md,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        fontSize: typography.sizes.caption,
        color: '#eef0f8',
        height: 64,
        textAlignVertical: 'top',
    },
});
