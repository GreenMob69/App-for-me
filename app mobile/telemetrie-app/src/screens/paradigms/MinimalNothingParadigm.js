import React, { useState, useContext, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Generare cale ECG bio-mecanică reactivă la RPM și sarcină motor
function generatePulsePath(width, height, loadPct = 20, rpm = 800) {
    const baselineY = height / 2;
    const intensity = Math.min(Math.max(loadPct / 100, 0.15), 1.0);
    const rpmFactor = Math.min(Math.max((rpm - 800) / 4500, 0), 1.0);
    const peakHeight = (height * 0.42) * (0.4 + intensity * 0.6);

    const step = width / 12;
    const p1 = baselineY;
    const p2 = baselineY - (peakHeight * 0.25);
    const p3 = baselineY + (peakHeight * 0.2);
    const p4 = baselineY - peakHeight;
    const p5 = baselineY + (peakHeight * 0.85);
    const p6 = baselineY - (peakHeight * 0.45);
    const p7 = baselineY;

    return `M 0 ${baselineY} ` +
        `L ${step * 2} ${baselineY} ` +
        `L ${step * 3} ${p1} ` +
        `L ${step * 3.8} ${p2} ` +
        `L ${step * 4.4} ${p3} ` +
        `L ${step * 5.2} ${p4} ` +
        `L ${step * 6.0} ${p5} ` +
        `L ${step * 6.8} ${p6} ` +
        `L ${step * 7.5} ${p7} ` +
        `L ${width} ${baselineY}`;
}

export default function MinimalNothingParadigm() {
    const { liveData, isConnected } = useContext(LiveContext);
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker } = useUiParadigm();

    const [activeTab, setActiveTab] = useState('01'); // '01'|'02'|'03'|'04'|'05'

    // Extragere valori telemetrice sigure
    const speed = Math.round(Number(liveData?.viteza_kmh ?? liveData?.viteza ?? 0));
    const rpm = Math.round(Number(liveData?.turatie_rpm ?? liveData?.turatie ?? 0));
    const load = Math.round(Number(liveData?.sarcina_motor_pct ?? liveData?.sarcina ?? 0));
    const boost = Number(liveData?.presiune_turbo_bar ?? liveData?.turbo_boost_bar ?? 0).toFixed(2);
    const coolant = Math.round(Number(liveData?.temperatura_antigel ?? liveData?.temp_antigel ?? 0));
    const oilTemp = Math.round(Number(liveData?.temperatura_ulei ?? liveData?.temp_ulei ?? 0));
    const voltage = Number(liveData?.tensiune_baterie ?? liveData?.tensiune ?? 0).toFixed(1);
    const torque = Math.round(Number(liveData?.cuplu_motor_nm ?? liveData?.fizica?.cuplu_nm ?? 0));
    const powerKw = Math.round(Number(liveData?.putere_motor_kw ?? liveData?.fizica?.putere_kw ?? 0));
    const consumption = Number(liveData?.consum_instant ?? liveData?.consum_l_100km ?? 0).toFixed(1);

    // Fizică avansată (cele 32 de modele)
    const fizica = liveData?.fizica || {};
    const oilWear = Math.round(Number(fizica?.uzura_ulei_pct ?? 18));
    const brakeWear = Math.round(Number(fizica?.uzura_frane_pct ?? 12));
    const brakeTemp = Math.round(Number(fizica?.temp_frane_c ?? 110));
    const batterySoh = Math.round(Number(fizica?.baterie_soh_pct ?? 94));
    const tireWear = Math.round(Number(fizica?.uzura_anvelope_pct ?? 8));
    const thermalEff = Math.round(Number(fizica?.eficienta_pct ?? 36));
    const gLat = Number(fizica?.forta_g_lat ?? 0).toFixed(2);
    const gLong = Number(fizica?.forta_g_long ?? 0).toFixed(2);

    // Determinare treaptă de viteză
    const currentGear = useMemo(() => {
        if (speed === 0) return 'N';
        if (liveData?.motor?.treapta_viteza) return `G${liveData.motor.treapta_viteza}`;
        if (liveData?.treapta_recomandata) return `G${liveData.treapta_recomandata}`;
        if (rpm > 0) {
            const ratio = speed / (rpm / 1000);
            if (ratio < 10) return 'G1';
            if (ratio < 18) return 'G2';
            if (ratio < 27) return 'G3';
            if (ratio < 37) return 'G4';
            if (ratio < 48) return 'G5';
            return 'G6';
        }
        return 'G-';
    }, [speed, rpm, liveData]);

    // Detecție anomalii active (Design by Absence)
    const activeAlerts = useMemo(() => {
        const list = [];
        if (Array.isArray(liveData?.alerte) && liveData.alerte.length > 0) {
            list.push(...liveData.alerte.map(a => typeof a === 'string' ? a : a.mesaj || a.titlu));
        }
        if (fizica?.turbo_surge_risc) list.push('RISC TURBO SURGE DETECTAT');
        if (fizica?.black_ice_risc) list.push('POLEI / PIERDERE ADERENȚĂ');
        if (coolant > 105) list.push(`TEMPERATURĂ ANTIGEL CRITICĂ: ${coolant}°C`);
        if (oilTemp > 130) list.push(`TEMPERATURĂ ULEI RIDICATĂ: ${oilTemp}°C`);
        if (voltage < 12.0 && voltage > 0) list.push(`TENSIUNE SCĂZUTĂ ALTERNATOR: ${voltage}V`);
        return list;
    }, [liveData, fizica, coolant, oilTemp, voltage]);

    const pulseSvgPath = useMemo(() => {
        return generatePulsePath(SCREEN_WIDTH - 40, 50, load, rpm);
    }, [load, rpm]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* ── Top Bar Minimalist ── */}
            <View style={styles.topBar}>
                <View style={styles.brandRow}>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00FF66' : '#FF3B00' }]} />
                    <Text style={styles.brandText}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRIE // CALM TECH'}
                    </Text>
                    <Text style={styles.dotSeparator}>·</Text>
                    <Text style={styles.rpmLiveBadge}>{rpm} RPM</Text>
                </View>

                {/* Butoane de acțiune și revenire rapidă */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.v2Button}
                        onPress={() => setUiParadigm('CLASSIC_V2')}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                    >
                        <Text style={styles.v2ButtonText}>⮌ CLASIC V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.stylePickerButton}
                        onPress={openExperiencePicker}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                    >
                        <Text style={styles.stylePickerText}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Corpul Central (Schimbat de Jog-Wheel) ── */}
            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.mainScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. AFISAJ MONUMENTAL VITEZĂ & BIO-PULSE (PULSE CORE) */}
                <View style={styles.heroSection}>
                    <View style={styles.speedRow}>
                        <Text style={styles.speedMonumental}>{speed}</Text>
                        <View style={styles.speedMeta}>
                            <View style={styles.gearPill}>
                                <Text style={styles.gearText}>{currentGear}</Text>
                            </View>
                            <Text style={styles.unitText}>KM/H</Text>
                            <Text style={styles.loadSub}>{load}% SARCINĂ</Text>
                        </View>
                    </View>

                    {/* ECG Bio-mechanical Pulse Line */}
                    <View style={styles.pulseContainer}>
                        <Svg width={SCREEN_WIDTH - 40} height={50} viewBox={`0 0 ${SCREEN_WIDTH - 40} 50`}>
                            <Defs>
                                <LinearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
                                    <Stop offset="0" stopColor="#333333" stopOpacity="0.4" />
                                    <Stop offset="0.5" stopColor="#FF3B00" stopOpacity="1" />
                                    <Stop offset="1" stopColor="#333333" stopOpacity="0.4" />
                                </LinearGradient>
                            </Defs>
                            <Line x1="0" y1="25" x2={SCREEN_WIDTH - 40} y2="25" stroke="#1A1A1A" strokeWidth="1" strokeDasharray="4, 4" />
                            <Path d={pulseSvgPath} fill="none" stroke="url(#pulseGrad)" strokeWidth="2" strokeLinecap="round" />
                        </Svg>
                        <View style={styles.pulseMetaRow}>
                            <Text style={styles.pulseMetaLeft}>RITM TERMIC MOTOR</Text>
                            <Text style={styles.pulseMetaRight}>{boost} BAR BOOST</Text>
                        </View>
                    </View>
                </View>

                {/* 2. EXCEPTION-BASED ANOMALY BANNER (Design by Absence) */}
                <View style={styles.anomalyWrapper}>
                    {activeAlerts.length === 0 ? (
                        <View style={styles.nominalBanner}>
                            <View style={styles.nominalDot} />
                            <Text style={styles.nominalText}>
                                TOATE CELE 32 SISTEME NOMINALE // FĂRĂ ANOMALII
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.alertBanner}>
                            <View style={styles.alertHeader}>
                                <Text style={styles.alertBadge}>[ ! ATENȚIE CRITICĂ ]</Text>
                                <Text style={styles.alertCount}>{activeAlerts.length} ANOMALII</Text>
                            </View>
                            {activeAlerts.map((msg, idx) => (
                                <Text key={idx} style={styles.alertMsg}>
                                    ▶ {msg}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>

                {/* 3. CONȚINUT DINAMIC BAZAT PE TAB-UL SELECTAT */}
                {activeTab === '01' && (
                    /* TAB 01: PULSE & VITALS */
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 01 · PARAMETRI VITALI DE RULARE</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>BOOST TURBO</Text>
                                <Text style={styles.metricValue}>{boost} <Text style={styles.metricUnit}>BAR</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TEMPERATURĂ ANTIGEL</Text>
                                <Text style={[styles.metricValue, coolant > 98 && { color: '#FF3B00' }]}>
                                    {coolant} <Text style={styles.metricUnit}>°C</Text>
                                </Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TENSIUNE ALTERNATOR</Text>
                                <Text style={styles.metricValue}>{voltage} <Text style={styles.metricUnit}>V</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TEMPERATURĂ ULEI</Text>
                                <Text style={styles.metricValue}>{oilTemp > 0 ? oilTemp : '—'} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '02' && (
                    /* TAB 02: ADVANCED PHYSICS */
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 02 · MODELE FIZICE & DINAMICĂ (32 OBS.)</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>CUPLU ESTIMAT</Text>
                                <Text style={styles.metricValue}>{torque} <Text style={styles.metricUnit}>NM</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>PUTERE ARBORE</Text>
                                <Text style={styles.metricValue}>{powerKw} <Text style={styles.metricUnit}>KW</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>EFICIENȚĂ TERMICĂ</Text>
                                <Text style={styles.metricValue}>{thermalEff} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>FORȚĂ G (LAT / LONG)</Text>
                                <Text style={styles.metricValue}>{gLat} / {gLong} <Text style={styles.metricUnit}>G</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '03' && (
                    /* TAB 03: WEAR & HEALTH */
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 03 · UZURĂ SUBANSAMBLE & TERMICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>UZURĂ ULEI ESTIMATĂ</Text>
                                <Text style={styles.metricValue}>{oilWear} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TEMP. ESTIMATĂ FRÂNE</Text>
                                <Text style={styles.metricValue}>{brakeTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>SĂNĂTATE BATERIE (SOH)</Text>
                                <Text style={styles.metricValue}>{batterySoh} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>UZURĂ ANVELOPE</Text>
                                <Text style={styles.metricValue}>{tireWear} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '04' && (
                    /* TAB 04: TRIP & EFFICIENCY */
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 04 · CURSĂ & EFICIENȚĂ ENERGETICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>CONSUM INSTANTANEU</Text>
                                <Text style={styles.metricValue}>{consumption} <Text style={styles.metricUnit}>L/100</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>SCOR ECO CALCULAT</Text>
                                <Text style={[styles.metricValue, { color: '#00FF66' }]}>
                                    {Math.round(Number(liveData?.eco_score ?? 88))} <Text style={styles.metricUnit}>/100</Text>
                                </Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>DISTANȚĂ SESIUNE</Text>
                                <Text style={styles.metricValue}>
                                    {Number(liveData?.distanta_km ?? 0).toFixed(1)} <Text style={styles.metricUnit}>KM</Text>
                                </Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>COMBUSTIBIL CONSUMAT</Text>
                                <Text style={styles.metricValue}>
                                    {Number(liveData?.combustibil_litri ?? 0).toFixed(2)} <Text style={styles.metricUnit}>L</Text>
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '05' && (
                    /* TAB 05: SETTINGS & QUICK PARADIGM SWITCH */
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 05 · SETĂRI RAPIDE & PARADIGME</Text>
                        <View style={styles.settingsBox}>
                            <Text style={styles.settingsTitle}>COMUTATOR DE PARADIGMĂ VIZUALĂ</Text>
                            <Text style={styles.settingsDesc}>
                                Ești în modul Nothing OS Calm Tech. Alege oricare alt stil fără să pierzi conexiunea sau analiza fizică.
                            </Text>

                            <TouchableOpacity
                                style={styles.actionRowBtn}
                                onPress={() => setUiParadigm('CLASSIC_V2')}
                            >
                                <Text style={styles.actionRowBtnText}>➜ Comută la Bordul Clasic V2 (Multi-Tab)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionRowBtn, { borderColor: '#FF8800' }]}
                                onPress={() => setUiParadigm('RETRO_AUDI_96')}
                            >
                                <Text style={[styles.actionRowBtnText, { color: '#FF8800' }]}>➜ Comută la Audi 1996 Digifiz VFD</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionRowBtn, { borderColor: '#00E5FF', backgroundColor: '#00E5FF10' }]}
                                onPress={openExperiencePicker}
                            >
                                <Text style={[styles.actionRowBtnText, { color: '#00E5FF' }]}>🎨 Deschide Selectorul Complet de Experiențe</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── 5-Position Tactile Jog-Wheel / Switcher (Bottom) ── */}
            <View style={styles.jogWheelContainer}>
                {[
                    { id: '01', label: '01·PULS' },
                    { id: '02', label: '02·FIZICĂ' },
                    { id: '03', label: '03·UZURĂ' },
                    { id: '04', label: '04·CURSĂ' },
                    { id: '05', label: '05·SETĂRI' },
                ].map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.jogItem,
                                isSelected && styles.jogItemSelected,
                            ]}
                            onPress={() => setActiveTab(item.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                        >
                            <Text style={[
                                styles.jogItemText,
                                isSelected && styles.jogItemTextSelected,
                            ]}>
                                {item.label}
                            </Text>
                            {isSelected && <View style={styles.jogActiveIndicator} />}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    brandText: {
        color: '#888888',
        fontSize: 11,
        fontFamily: MONO_FONT,
        letterSpacing: 1,
    },
    dotSeparator: {
        color: '#444444',
        marginHorizontal: 6,
        fontFamily: MONO_FONT,
    },
    rpmLiveBadge: {
        color: '#F5F5F7',
        fontSize: 11,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    v2Button: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#333333',
        borderRadius: 4,
        backgroundColor: '#0A0A0A',
    },
    v2ButtonText: {
        color: '#A0AEC0',
        fontSize: 10,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    stylePickerButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#FF3B00',
        borderRadius: 4,
        backgroundColor: '#FF3B0015',
    },
    stylePickerText: {
        color: '#FF3B00',
        fontSize: 10,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    heroSection: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    speedRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    speedMonumental: {
        color: '#FFFFFF',
        fontSize: 116,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
        letterSpacing: -4,
        lineHeight: 124,
    },
    speedMeta: {
        marginLeft: 12,
        paddingTop: 16,
        alignItems: 'flex-start',
    },
    gearPill: {
        borderWidth: 1.5,
        borderColor: '#FF3B00',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#FF3B0015',
        marginBottom: 6,
    },
    gearText: {
        color: '#FF3B00',
        fontSize: 14,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    unitText: {
        color: '#666666',
        fontSize: 12,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    loadSub: {
        color: '#444444',
        fontSize: 9,
        fontFamily: MONO_FONT,
        marginTop: 4,
    },
    pulseContainer: {
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
    },
    pulseMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 4,
        paddingHorizontal: 4,
    },
    pulseMetaLeft: {
        color: '#555555',
        fontSize: 9,
        fontFamily: MONO_FONT,
        letterSpacing: 0.5,
    },
    pulseMetaRight: {
        color: '#FF3B00',
        fontSize: 9,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    anomalyWrapper: {
        marginBottom: 20,
    },
    nominalBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#181818',
        borderRadius: 6,
        backgroundColor: '#050505',
    },
    nominalDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00FF66',
        marginRight: 8,
    },
    nominalText: {
        color: '#777777',
        fontSize: 10,
        fontFamily: MONO_FONT,
        letterSpacing: 0.5,
    },
    alertBanner: {
        borderWidth: 1.5,
        borderColor: '#FF3B00',
        borderRadius: 6,
        padding: 12,
        backgroundColor: '#FF3B0010',
    },
    alertHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    alertBadge: {
        color: '#FF3B00',
        fontSize: 11,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    alertCount: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: MONO_FONT,
    },
    alertMsg: {
        color: '#FFFFFF',
        fontSize: 11,
        fontFamily: MONO_FONT,
        marginTop: 3,
    },
    tabContent: {
        marginBottom: 16,
    },
    sectionHeader: {
        color: '#555555',
        fontSize: 10,
        fontFamily: MONO_FONT,
        letterSpacing: 1,
        marginBottom: 12,
    },
    grid2x2: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metricCell: {
        width: (SCREEN_WIDTH - 52) / 2,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        borderRadius: 6,
        padding: 14,
        backgroundColor: '#080808',
    },
    metricLabel: {
        color: '#666666',
        fontSize: 9,
        fontFamily: MONO_FONT,
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    metricValue: {
        color: '#F5F5F7',
        fontSize: 22,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    metricUnit: {
        color: '#777777',
        fontSize: 11,
        fontWeight: 'normal',
    },
    settingsBox: {
        borderWidth: 1,
        borderColor: '#222222',
        borderRadius: 8,
        padding: 16,
        backgroundColor: '#080808',
    },
    settingsTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    settingsDesc: {
        color: '#777777',
        fontSize: 11,
        fontFamily: MONO_FONT,
        lineHeight: 16,
        marginBottom: 16,
    },
    actionRowBtn: {
        borderWidth: 1,
        borderColor: '#333333',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#0F0F0F',
    },
    actionRowBtnText: {
        color: '#CCCCCC',
        fontSize: 11,
        fontFamily: MONO_FONT,
        fontWeight: 'bold',
    },
    jogWheelContainer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
        backgroundColor: '#030303',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    jogItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
    },
    jogItemSelected: {
        backgroundColor: '#111111',
        borderRadius: 4,
    },
    jogItemText: {
        color: '#555555',
        fontSize: 10,
        fontFamily: MONO_FONT,
        fontWeight: '600',
    },
    jogItemTextSelected: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    jogActiveIndicator: {
        width: 14,
        height: 2,
        backgroundColor: '#FF3B00',
        marginTop: 4,
        borderRadius: 1,
    },
});
