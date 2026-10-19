import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    StatusBar,
    Dimensions,
    Animated,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle, Rect } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticCriticalWarning } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.NOTHING_MINIMAL];

// Generare cale ECG bio-mecanică reactivă la RPM și sarcină motor
function generatePulsePath(width, height, loadPct = 20, rpm = 800) {
    const baselineY = height / 2;
    const intensity = Math.min(Math.max(loadPct / 100, 0.15), 1.0);
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
    const insets = useSafeInsets();
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stări locale pentru modurile Nothing
    const [activeTab, setActiveTab] = useState('01'); // '01'|'02'|'03'|'04'|'05'
    const [ghostMode, setGhostMode] = useState(false);
    const [mirrorHud, setMirrorHud] = useState(false);
    const [expandedAlerts, setExpandedAlerts] = useState(false);

    // Animație pentru Red Pill Alert
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (telemetry.criticalAlerts.length > 0) {
            hapticCriticalWarning();
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.25, duration: 400, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                ])
            );
            loop.start();
            return () => loop.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [telemetry.criticalAlerts.length]);

    const {
        speed,
        rpm,
        gear,
        throttle,
        boost,
        coolantTemp,
        oilTemp,
        exhaustTemp,
        batteryVoltage,
        batterySoH,
        fuelLevel,
        fuelRate,
        fuelBurnedLiters,
        brakeFluidTemp,
        brakeEnergyTrip,
        gForceLat,
        gForceLong,
        weibullRul,
        minRulKm,
        breakdownRisk,
        criticalAlerts,
        isConnected,
    } = telemetry;

    const pulseSvgPath = useMemo(() => {
        return generatePulsePath(SCREEN_WIDTH - 40, 50, throttle, rpm);
    }, [throttle, rpm]);

    // Glyph Matrix: 7 segmente luminoase LED albe care se aprind progresiv cu RPM
    const glyphLeds = useMemo(() => {
        const count = 7;
        const activeCount = Math.min(count, Math.floor((rpm / 4500) * count));
        return Array.from({ length: count }, (_, i) => i < activeCount);
    }, [rpm]);

    // Benzile perforate de combustibil (10 găurele punctate)
    const fuelDots = useMemo(() => {
        const total = 10;
        const filled = Math.round((fuelLevel / 100) * total);
        return Array.from({ length: total }, (_, i) => i < filled);
    }, [fuelLevel]);

    const isGhostDimmed = ghostMode && speed < 5 && criticalAlerts.length === 0;

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }, mirrorHud && styles.mirrorHudTransform]}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" translucent />

            {/* ── 1. GLYPH INTERFACE MATRIX (Bara de lumina Nothing pe margine sus) ── */}
            <View style={styles.glyphMatrixContainer}>
                {glyphLeds.map((active, idx) => (
                    <View
                        key={`glyph-${idx}`}
                        style={[
                            styles.glyphBar,
                            active && styles.glyphBarActive,
                            idx === 6 && active && { backgroundColor: theme.accent },
                        ]}
                    />
                ))}
            </View>

            {/* ── 2. Top Bar Minimalist & Controluri ── */}
            <View style={styles.topBar}>
                <View style={styles.brandRow}>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00FF66' : '#FF3B00' }]} />
                    <Text style={styles.brandText} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRIE // CALM TECH'}
                    </Text>
                    <Text style={styles.dotSeparator}>·</Text>
                    <Text style={styles.rpmLiveBadge}>{rpm} RPM</Text>
                </View>

                {/* Butoane de acțiune */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: '#00F0FF', backgroundColor: '#00F0FF12' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    {/* Ghost Drive Toggle */}
                    <TouchableOpacity
                        style={[styles.v2Button, ghostMode && styles.v2ButtonActive]}
                        onPress={() => {
                            hapticTap();
                            setGhostMode(!ghostMode);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, ghostMode && { color: '#FFFFFF' }]}>
                            {ghostMode ? 'GHOST ON' : 'GHOST'}
                        </Text>
                    </TouchableOpacity>

                    {/* Mirror HUD Toggle */}
                    <TouchableOpacity
                        style={[styles.v2Button, mirrorHud && styles.v2ButtonActive]}
                        onPress={() => {
                            hapticTap();
                            setMirrorHud(!mirrorHud);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, mirrorHud && { color: '#FFFFFF' }]}>🪞 HUD</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.v2Button}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.v2ButtonText}>⮌ V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.stylePickerButton}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.stylePickerText}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Corpul Central (cu Ghost Mode Dimming) ── */}
            <ScrollView
                style={[styles.mainScroll, isGhostDimmed && styles.ghostDimmed]}
                contentContainerStyle={styles.mainScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. AFISAJ MONUMENTAL VITEZĂ & BIO-PULSE */}
                <View style={styles.heroSection}>
                    <View style={styles.speedRow}>
                        <Text style={styles.speedMonumental}>{speed}</Text>
                        <View style={styles.speedMeta}>
                            <View style={styles.gearPill}>
                                <Text style={styles.gearText}>{gear}</Text>
                            </View>
                            <Text style={styles.unitText}>KM/H</Text>
                            <Text style={styles.loadSub}>{throttle}% ACCEL</Text>
                        </View>
                    </View>

                    {/* ECG Bio-mechanical Pulse Line */}
                    <View style={styles.pulseContainer}>
                        <Svg width={SCREEN_WIDTH - 40} height={50} viewBox={`0 0 ${SCREEN_WIDTH - 40} 50`}>
                            <Defs>
                                <LinearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
                                    <Stop offset="0" stopColor="#333333" stopOpacity="0.4" />
                                    <Stop offset="0.5" stopColor={theme.accent} stopOpacity="1" />
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

                {/* 2. CRITICAL RED PILL / NOMINAL BANNER (Design by Absence) */}
                <View style={styles.anomalyWrapper}>
                    {criticalAlerts.length === 0 ? (
                        <View style={styles.nominalBanner}>
                            <View style={styles.nominalDot} />
                            <Text style={styles.nominalText} numberOfLines={1}>
                                TOATE CELE 32 SISTEME NOMINALE // FĂRĂ ANOMALII
                            </Text>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.alertBanner}
                            onPress={() => {
                                hapticTap();
                                setExpandedAlerts(!expandedAlerts);
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.alertHeader}>
                                <Animated.View style={[styles.redPillDot, { transform: [{ scale: pulseAnim }] }]} />
                                <Text style={styles.alertBadge}>[ ! PERICOL CRITIC DETECTAT ]</Text>
                                <Text style={styles.alertCount}>{criticalAlerts.length} ALERTE</Text>
                            </View>
                            {criticalAlerts.map((alt, idx) => (
                                <View key={alt.id || idx} style={styles.alertItemRow}>
                                    <Text style={styles.alertMsg}>▶ {alt.title}</Text>
                                    {expandedAlerts && <Text style={styles.alertDesc}>{alt.desc}</Text>}
                                </View>
                            ))}
                        </TouchableOpacity>
                    )}
                </View>

                {/* 3. BANDA PERFORATĂ DE CARBURANT (Perforated Dots) */}
                <View style={styles.fuelStripContainer}>
                    <View style={styles.fuelStripHeader}>
                        <Text style={styles.fuelStripLabel}>REZERVOR COMBUSTIBIL</Text>
                        <Text style={styles.fuelStripValue}>{fuelLevel}% · {fuelRate} L/100KM</Text>
                    </View>
                    <View style={styles.fuelDotsRow}>
                        {fuelDots.map((isFilled, idx) => (
                            <View
                                key={`fdot-${idx}`}
                                style={[
                                    styles.fuelDot,
                                    isFilled ? styles.fuelDotFilled : styles.fuelDotEmpty,
                                    idx < 2 && isFilled && { backgroundColor: theme.accent },
                                ]}
                            />
                        ))}
                    </View>
                </View>

                {/* 4. CONȚINUT DINAMIC BAZAT PE TAB-UL SELECTAT */}
                {activeTab === '01' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 01 · PARAMETRI VITALI DE RULARE</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>BOOST TURBO</Text>
                                <Text style={styles.metricValue}>{boost} <Text style={styles.metricUnit}>BAR</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TEMPERATURĂ ANTIGEL</Text>
                                <Text style={[styles.metricValue, coolantTemp > 98 && { color: theme.accent }]}>
                                    {coolantTemp} <Text style={styles.metricUnit}>°C</Text>
                                </Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TENSIUNE ALTERNATOR</Text>
                                <Text style={styles.metricValue}>{batteryVoltage} <Text style={styles.metricUnit}>V</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>TEMPERATURĂ ULEI</Text>
                                <Text style={styles.metricValue}>{oilTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '02' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 02 · TERMICĂ & EVACUARE EGT</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>EGT EVACUARE</Text>
                                <Text style={styles.metricValue}>{exhaustTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>LICHID FRÂNĂ</Text>
                                <Text style={[styles.metricValue, brakeFluidTemp > 140 && { color: theme.accent }]}>
                                    {brakeFluidTemp} <Text style={styles.metricUnit}>°C</Text>
                                </Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>ENERGIE FRÂNARE</Text>
                                <Text style={styles.metricValue}>{brakeEnergyTrip} <Text style={styles.metricUnit}>kJ</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>CONSUM TOTAL</Text>
                                <Text style={styles.metricValue}>{fuelBurnedLiters} <Text style={styles.metricUnit}>L</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '03' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 03 · VECTORI G-FORCE & DINAMICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>ACCELERAȚIE LATERALĂ</Text>
                                <Text style={styles.metricValue}>{gForceLat} <Text style={styles.metricUnit}>G</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>ACCELERAȚIE LONGITUDINALĂ</Text>
                                <Text style={styles.metricValue}>{gForceLong} <Text style={styles.metricUnit}>G</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '04' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 04 · FIABILITATE WEIBULL & RUL</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>RUL MINIM PANĂ</Text>
                                <Text style={[styles.metricValue, { color: '#00FF66' }]}>{minRulKm} <Text style={styles.metricUnit}>KM</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>RISC DEFECTARE</Text>
                                <Text style={styles.metricValue}>{breakdownRisk} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>SOH BATERIE</Text>
                                <Text style={styles.metricValue}>{batterySoH} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>RUL ULEI</Text>
                                <Text style={styles.metricValue}>{weibullRul.oil} <Text style={styles.metricUnit}>KM</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '05' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>// 05 · ECO & EFICIENȚĂ CALORICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>CONSUM INSTANT</Text>
                                <Text style={styles.metricValue}>{fuelRate} <Text style={styles.metricUnit}>L/100</Text></Text>
                            </View>
                            <View style={styles.metricCell}>
                                <Text style={styles.metricLabel}>COMBUSTIBIL ARS</Text>
                                <Text style={styles.metricValue}>{fuelBurnedLiters} <Text style={styles.metricUnit}>L</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Jog-Wheel Selector Inferior (01 .. 05) ── */}
            <View style={styles.jogWheelContainer}>
                {['01', '02', '03', '04', '05'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.jogTab, activeTab === tab && styles.jogTabActive]}
                        onPress={() => {
                            hapticTap();
                            setActiveTab(tab);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.jogTabText, activeTab === tab && styles.jogTabTextActive]}>
                            {tab}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    mirrorHudTransform: {
        transform: [{ scaleX: -1 }],
    },
    glyphMatrixContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        gap: 6,
        backgroundColor: '#000000',
    },
    glyphBar: {
        flex: 1,
        height: 3,
        backgroundColor: '#1E1E1E',
        borderRadius: 2,
    },
    glyphBarActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#161616',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 8,
    },
    brandText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        letterSpacing: 1,
        fontWeight: '700',
        flexShrink: 1,
    },
    dotSeparator: {
        color: '#444444',
        marginHorizontal: 6,
        fontSize: 10,
    },
    rpmLiveBadge: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#8E8E93',
        fontVariant: ['tabular-nums'],
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    v2Button: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#262626',
        backgroundColor: '#0C0C0C',
    },
    v2ButtonActive: {
        borderColor: '#FFFFFF',
        backgroundColor: '#222222',
    },
    v2ButtonText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#8E8E93',
        fontWeight: '700',
    },
    stylePickerButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
    stylePickerText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#000000',
        fontWeight: '900',
    },
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    ghostDimmed: {
        opacity: 0.08,
    },
    heroSection: {
        marginBottom: 16,
    },
    speedRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    speedMonumental: {
        fontFamily: MONO_FONT,
        fontSize: 88,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 90,
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
    },
    speedMeta: {
        alignItems: 'flex-end',
        paddingTop: 8,
    },
    gearPill: {
        borderWidth: 1,
        borderColor: '#333333',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 6,
    },
    gearText: {
        fontFamily: MONO_FONT,
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    unitText: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '700',
    },
    loadSub: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#555555',
        marginTop: 4,
        fontVariant: ['tabular-nums'],
    },
    pulseContainer: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#161616',
    },
    pulseMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    pulseMetaLeft: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#555555',
        letterSpacing: 1,
    },
    pulseMetaRight: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#8E8E93',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    anomalyWrapper: {
        marginBottom: 16,
    },
    nominalBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#0A0A0A',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1A1A1A',
    },
    nominalDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00FF66',
        marginRight: 8,
    },
    nominalText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#8E8E93',
        fontWeight: '600',
        flexShrink: 1,
    },
    alertBanner: {
        padding: 12,
        backgroundColor: '#160505',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#D71920',
    },
    alertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    redPillDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#D71920',
        marginRight: 8,
    },
    alertBadge: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#D71920',
        fontWeight: '800',
        flex: 1,
    },
    alertCount: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#FFFFFF',
    },
    alertItemRow: {
        marginTop: 4,
    },
    alertMsg: {
        fontFamily: MONO_FONT,
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    alertDesc: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#A0A0A0',
        marginTop: 2,
    },
    fuelStripContainer: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#0A0A0A',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#161616',
    },
    fuelStripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    fuelStripLabel: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#666666',
        letterSpacing: 1,
    },
    fuelStripValue: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    fuelDotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    fuelDot: {
        flex: 1,
        height: 6,
        borderRadius: 3,
    },
    fuelDotFilled: {
        backgroundColor: '#FFFFFF',
    },
    fuelDotEmpty: {
        backgroundColor: '#202020',
    },
    tabContent: {
        marginBottom: 16,
    },
    sectionHeader: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        color: '#666666',
        letterSpacing: 1,
        marginBottom: 10,
    },
    grid2x2: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    metricCell: {
        width: (SCREEN_WIDTH - 40) / 2,
        backgroundColor: '#0A0A0A',
        padding: 12,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#161616',
    },
    metricLabel: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        color: '#666666',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    metricValue: {
        fontFamily: MONO_FONT,
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    metricUnit: {
        fontSize: 10,
        color: '#8E8E93',
        fontWeight: '500',
    },
    jogWheelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#161616',
        backgroundColor: '#000000',
    },
    jogTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    jogTabActive: {
        backgroundColor: '#FFFFFF',
    },
    jogTabText: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        fontWeight: '700',
        color: '#666666',
    },
    jogTabTextActive: {
        color: '#000000',
    },
});
