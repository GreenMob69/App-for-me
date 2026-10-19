// @ts-check
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, {
    Rect,
    Circle,
    Line,
    Polyline,
    Text as SvgText,
    Defs,
    LinearGradient,
    Stop,
} from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert, hapticCriticalWarning } from '../../services/hapticFeedback';
import { audioGong } from '../../services/audioGongService';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.F1_CYBERDECK];

export default function F1CyberdeckParadigm() {
    const insets = useSafeInsets();
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stare Tap-to-Maximize: null = 6 micro-monitoare; 1..6 = monitor mărit
    const [expandedPanel, setExpandedPanel] = useState(null);

    // 9. Mod de sesiune: 'RACE' | 'QUAL' | 'PIT'
    const [sessionMode, setSessionMode] = useState('RACE');

    // 3. Zero-GC Circular Ring Buffer for Oscilloscope
    const ringBufferRef = useRef(new Array(25).fill({ boost: 0, rpm: 800 }));
    const ringIndexRef = useRef(0);
    const [oscilloscopePoints, setOscilloscopePoints] = useState({ boostPoints: '', rpmPoints: '' });

    // 4. Track Pacer Lap Delta-T simulation
    const [lapDelta, setLapDelta] = useState('-0.18s');
    const [isDeltaPositive, setIsDeltaPositive] = useState(false);

    // 9. Peak Telemetry Trackers for Qualy mode
    const [peakG, setPeakG] = useState(1.15);
    const [peakBoost, setPeakBoost] = useState(telemetry.boost);

    const {
        speed,
        rpm,
        gear,
        throttle,
        boost,
        coolantTemp,
        oilTemp,
        exhaustTemp,
        chraTemp,
        chraCooldownSec,
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
        b2bRoi,
        sankey,
        isSteadyState,
        steadyConfidence,
        criticalAlerts,
        isConnected,
    } = telemetry;

    // 1. Dynamic Shift Point Interpolation per gear
    const targetShiftRpm = useMemo(() => {
        if (gear === '1') return 4250;
        if (gear === '2') return 4400;
        if (gear === '3') return 4550;
        return 4650;
    }, [gear]);

    // 2. Kamm Friction Circle Adhesion Vector
    const totalG = useMemo(() => {
        const val = Math.sqrt(gForceLat * gForceLat + gForceLong * gForceLong);
        return Number(val.toFixed(2));
    }, [gForceLat, gForceLong]);

    const gripUtilizationPct = useMemo(() => {
        return Math.min(100, Math.round((totalG / 1.10) * 100));
    }, [totalG]);

    // 5. 4-Corner Brake Disc Pyrometer simulation (°C)
    const brakePyrometer = useMemo(() => {
        const base = Math.max(brakeFluidTemp + 80, 180);
        const biasFL = Math.round(base + Math.abs(gForceLat) * 25 + (gForceLong < 0 ? Math.abs(gForceLong) * 45 : 0));
        const biasFR = Math.round(base - Math.abs(gForceLat) * 10 + (gForceLong < 0 ? Math.abs(gForceLong) * 45 : 0));
        const biasRL = Math.round(base * 0.75 + Math.abs(gForceLat) * 15);
        const biasRR = Math.round(base * 0.75 - Math.abs(gForceLat) * 5);
        return { fl: biasFL, fr: biasFR, rl: biasRL, rr: biasRR };
    }, [brakeFluidTemp, gForceLat, gForceLong]);

    // 3. Alimentare osciloscop în ring buffer fără alocări masive
    useEffect(() => {
        const idx = ringIndexRef.current;
        ringBufferRef.current[idx] = { boost, rpm };
        ringIndexRef.current = (idx + 1) % 25;

        // Generate SVG points string directly
        const bPoints = [];
        const rPoints = [];
        for (let i = 0; i < 25; i++) {
            const bufferIdx = (ringIndexRef.current + i) % 25;
            const pt = ringBufferRef.current[bufferIdx];
            const x = i * (160 / 25);
            const yBoost = 52 - (pt.boost * 20);
            const yRpm = 56 - (pt.rpm / 110);
            bPoints.push(`${x.toFixed(1)},${yBoost.toFixed(1)}`);
            rPoints.push(`${x.toFixed(1)},${yRpm.toFixed(1)}`);
        }
        setOscilloscopePoints({
            boostPoints: bPoints.join(' '),
            rpmPoints: rPoints.join(' '),
        });

        // 1. Dynamic Shift Alert
        if (rpm >= targetShiftRpm - 100) {
            hapticShiftAlert();
            audioGong.playGong('pit');
        }

        // Peak updates
        if (totalG > peakG) setPeakG(totalG);
        if (boost > peakBoost) setPeakBoost(boost);
    }, [telemetry.rpm, telemetry.boost, targetShiftRpm, totalG, peakG, peakBoost]);

    const togglePanel = (panelId) => {
        hapticTap();
        setExpandedPanel((prev) => (prev === panelId ? null : panelId));
    };

    // 1. 15-LED Shift Light Bar F1 (Scalat dinamic după treaptă)
    const shiftLights = useMemo(() => {
        const total = 15;
        const progress = Math.min(1.0, Math.max(0, (rpm - 1500) / (targetShiftRpm - 1500)));
        const activeCount = Math.round(progress * total);
        return Array.from({ length: total }).map((_, i) => {
            const active = i < activeCount;
            let color = '#00FF66'; // 1-5 Verde
            if (i >= 5 && i < 10) color = '#FFB800'; // 6-10 Galben
            else if (i >= 10 && i < 14) color = '#FF2A2A'; // 11-14 Roșu
            else if (i >= 14) color = '#00F0FF'; // 15 Albastru Flash
            return { active, color };
        });
    }, [rpm, targetShiftRpm]);

    // 9. Qualy Purple vs Race Neon Theme Mapping
    const isQualy = sessionMode === 'QUAL';
    const isPit = sessionMode === 'PIT';
    const primaryAccent = isQualy ? '#B000FF' : '#00F0FF';
    const borderAccent = isQualy ? '#600099' : '#16263D';

    return (
        <View style={[
            styles.container,
            { paddingTop: Math.max(insets.top, 24) },
            isPit && styles.pitLimiterActiveBorder, // 9. Flashing Pit border
        ]}>
            <StatusBar barStyle="light-content" backgroundColor="#030508" translucent />

            {/* ── 1. ANTET CURAT CU SPAȚIERE SIGURĂ ȘI BUTOANE MARI ── */}
            <View style={styles.header}>
                <View style={styles.brandGroup}>
                    <View style={[styles.cyberTag, isQualy && { backgroundColor: '#B000FF' }]}>
                        <Text style={styles.cyberTagText}>{isQualy ? 'QUAL-POLE' : 'F1-DECK'}</Text>
                    </View>
                    <View style={[styles.liveDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.modelText} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRIE WEC'}
                    </Text>

                    {/* 4. Delta-T Pacer Box */}
                    <View style={[styles.deltaPill, { borderColor: isDeltaPositive ? '#FF2A2A' : '#D000FF' }]}>
                        <Text style={[styles.deltaText, { color: isDeltaPositive ? '#FF2A2A' : '#D000FF' }]}>
                            Δ {lapDelta}
                        </Text>
                    </View>
                </View>

                {/* Butoane Tactile Clare cu Zona Minima de 44px */}
                <View style={styles.actionsGroup}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF1A' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={styles.actionBtnText}>⮌ CLASIC</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.stylePickerBtn]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={styles.stylePickerText}>🎨 STIL</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 2. Bara F1 Shift Lights & Comutator Sesiune (RACE / QUAL / PIT) ── */}
            <View style={styles.shiftLightRow}>
                <TouchableOpacity
                    style={[
                        styles.sessionModePill,
                        isQualy && { backgroundColor: '#B000FF' },
                        isPit && { backgroundColor: '#FFB800' },
                    ]}
                    onPress={() => {
                        hapticTap();
                        setSessionMode(prev => prev === 'RACE' ? 'QUAL' : prev === 'QUAL' ? 'PIT' : 'RACE');
                    }}
                >
                    <Text style={[styles.sessionModeText, (isQualy || isPit) && { color: '#000000', fontWeight: '900' }]}>
                        {sessionMode}
                    </Text>
                </TouchableOpacity>

                <View style={styles.ledsTrack}>
                    {shiftLights.map((led, idx) => (
                        <View
                            key={`shift-${idx}`}
                            style={[
                                styles.shiftLed,
                                {
                                    backgroundColor: led.active ? led.color : '#0B1522',
                                    borderColor: led.active ? led.color : '#16263D',
                                    shadowColor: led.active ? led.color : 'transparent',
                                    shadowOpacity: led.active ? 0.9 : 0,
                                    shadowRadius: 3,
                                },
                            ]}
                        />
                    ))}
                </View>
            </View>

            {/* ── 3. CORPUL CENTRAL: GRILĂ 6 MONITOARE SAU MONITOR MĂRIT ── */}
            <View style={styles.viewportLockedContent}>
                {expandedPanel === null ? (
                    <View style={styles.monitorsGrid}>
                        {/* ── M1: NUCLEU VITEZĂ, TREAPTĂ & 2. KAMM G-RADAR ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M1 // NUCLEUS & KAMM</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(1)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m1Body}>
                                <View style={styles.gearBox}>
                                    <Text style={[styles.gearNumber, { color: primaryAccent }]}>{gear}</Text>
                                    <Text style={styles.gearLabel}>TREAPTĂ</Text>
                                </View>
                                <View style={styles.speedBox}>
                                    <Text style={styles.speedNumber}>{speed}</Text>
                                    <Text style={styles.speedLabel}>KM/H · {rpm} RPM</Text>
                                </View>
                                {/* 2. Kamm Friction Circle SVG */}
                                <View style={styles.miniRadar}>
                                    <Svg width={44} height={44} viewBox="0 0 44 44">
                                        <Circle
                                            cx="22"
                                            cy="22"
                                            r="19"
                                            fill="none"
                                            stroke={gripUtilizationPct > 90 ? '#FF2A2A' : '#16263D'}
                                            strokeWidth={gripUtilizationPct > 90 ? 1.5 : 1}
                                        />
                                        <Circle cx="22" cy="22" r="9.5" fill="none" stroke="#0D1A2D" strokeWidth="1" />
                                        <Line x1="3" y1="22" x2="41" y2="22" stroke="#16263D" strokeWidth="0.8" />
                                        <Line x1="22" y1="3" x2="22" y2="41" stroke="#16263D" strokeWidth="0.8" />
                                        <Circle
                                            cx={22 + (gForceLat * 10)}
                                            cy={22 - (gForceLong * 10)}
                                            r="4"
                                            fill={gripUtilizationPct > 90 ? '#FF2A2A' : primaryAccent}
                                        />
                                    </Svg>
                                    <Text style={[styles.radarLabel, gripUtilizationPct > 90 && { color: '#FF2A2A' }]}>
                                        {totalG}G ({gripUtilizationPct}%)
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* ── M2: 3. ZERO-GC OSCILOSCOP DUAL-CHANNEL ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M2 // OSCILLOSCOPE</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(2)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.oscilloscopeContainer}>
                                <Svg width={SCREEN_WIDTH * 0.42} height={56} viewBox="0 0 160 56">
                                    <Line x1="0" y1="28" x2="160" y2="28" stroke="#112233" strokeDasharray="3, 3" />
                                    {oscilloscopePoints.boostPoints ? (
                                        <Polyline
                                            fill="none"
                                            stroke={primaryAccent}
                                            strokeWidth="2"
                                            points={oscilloscopePoints.boostPoints}
                                        />
                                    ) : null}
                                    {oscilloscopePoints.rpmPoints ? (
                                        <Polyline
                                            fill="none"
                                            stroke="#FFB800"
                                            strokeWidth="1"
                                            strokeDasharray="2, 2"
                                            points={oscilloscopePoints.rpmPoints}
                                        />
                                    ) : null}
                                </Svg>
                                <View style={styles.scopeMetaRow}>
                                    <Text style={styles.scopeLegend1}>― BST {boost}b</Text>
                                    <Text style={styles.scopeLegend2}>┄ RPM {rpm}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── M3: ENGINE HEALTH HEATMAP (3x3) ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M3 // ENGINE DNA</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(3)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.heatmapGrid}>
                                {[
                                    { name: 'COOL', val: `${coolantTemp}°`, ok: coolantTemp < 100 },
                                    { name: 'OIL', val: `${oilTemp}°`, ok: oilTemp < 120 },
                                    { name: 'EGT', val: `${exhaustTemp}°`, ok: exhaustTemp < 750 },
                                    { name: 'BST', val: `${boost}b`, ok: boost < 2.0 },
                                    { name: 'CHRA', val: `${chraTemp}°`, ok: chraTemp < 300 },
                                    { name: 'BRK', val: `${brakeFluidTemp}°`, ok: brakeFluidTemp < 140 },
                                    { name: 'BATT', val: `${batteryVoltage}v`, ok: batteryVoltage > 12.2 },
                                    { name: 'SOH', val: `${batterySoH}%`, ok: batterySoH > 80 },
                                    { name: 'FUEL', val: `${fuelLevel}%`, ok: fuelLevel > 15 },
                                ].map((item, idx) => (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.heatmapCell,
                                            { backgroundColor: item.ok ? '#081B1A' : '#2A0A0A', borderColor: item.ok ? '#00FF6644' : '#FF2A2A66' }
                                        ]}
                                    >
                                        <Text style={styles.heatName}>{item.name}</Text>
                                        <Text style={[styles.heatVal, { color: item.ok ? '#00FF66' : '#FF2A2A' }]}>{item.val}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* ── M4: 5. 4-ROTOR BRAKE PYROMETER & 6. SANKEY LOSS ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M4 // BRAKES & SANKEY</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(4)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m4Body}>
                                {/* 5. 4-Corner Brake Heat Pyrometer */}
                                <View style={styles.pyroRow}>
                                    <Text style={[styles.pyroCorner, brakePyrometer.fl > 300 && { color: '#FF2A2A' }]}>
                                        FL {brakePyrometer.fl}°
                                    </Text>
                                    <Text style={[styles.pyroCorner, brakePyrometer.fr > 300 && { color: '#FF2A2A' }]}>
                                        FR {brakePyrometer.fr}°
                                    </Text>
                                </View>
                                <View style={styles.sankeyBarFrame}>
                                    <View style={[styles.sankeySeg, { flex: sankey.mechanicalPct, backgroundColor: '#00FF66' }]} />
                                    <View style={[styles.sankeySeg, { flex: sankey.exhaustHeatPct, backgroundColor: '#FFB800' }]} />
                                    <View style={[styles.sankeySeg, { flex: sankey.coolingFrictionPct, backgroundColor: '#FF2A2A' }]} />
                                </View>
                                <View style={styles.sankeyMeta}>
                                    <Text style={styles.sankeyLabel}>MEC {sankey.mechanicalPct}%</Text>
                                    <Text style={styles.sankeyLabel}>EVAC {sankey.exhaustHeatPct}%</Text>
                                    <Text style={styles.sankeyLabel}>RĂC {sankey.coolingFrictionPct}%</Text>
                                </View>
                                {chraCooldownSec > 0 ? (
                                    <Text style={styles.chraAlert}>COOLDOWN: {chraCooldownSec}s</Text>
                                ) : (
                                    <Text style={styles.chraOk}>TURBINE CHRA OK</Text>
                                )}
                            </View>
                        </View>

                        {/* ── M5: 7. PITWALL STRATEGY & WEIBULL RUL ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M5 // STRATEGY & RUL</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(5)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m5Body}>
                                <Text style={styles.weibullLine}>RUL MIN: <Text style={{ color: '#00FF66', fontWeight: '900' }}>{minRulKm} KM</Text></Text>
                                <Text style={styles.weibullLine}>STRAT: <Text style={{ color: '#00F0FF' }}>2.1 L/TUR · 18 TURI</Text></Text>
                                <Text style={styles.weibullLine}>LIFT&COAST: <Text style={{ color: '#FFB800' }}>-0.2L TARGET</Text></Text>
                                <Text style={styles.weibullLine}>RISC PANĂ: <Text style={{ color: '#FFB800' }}>{breakdownRisk}%</Text></Text>
                            </View>
                        </View>

                        {/* ── M6: 8. BOSCH UDS & CAN-BUS TEC/REC MONITOR ── */}
                        <View style={[styles.monitorCell, { borderColor: borderAccent }]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>M6 // CAN & UDS BUS</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(6)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.udsTerminal}>
                                <Text style={styles.udsLog}>[CAN] TEC: 0 | REC: 0 | LOAD: 38%</Text>
                                <Text style={styles.udsLog}>[KALMAN] STEADY: {isSteadyState ? 'TRUE' : 'TRANSIENT'}</Text>
                                <Text style={styles.udsLog}>[CONF] {steadyConfidence}% EXACTITATE</Text>
                                {criticalAlerts.length > 0 ? (
                                    <Text style={[styles.udsLog, { color: '#FF2A2A' }]} numberOfLines={1}>
                                        [DTC] {criticalAlerts[0].title}
                                    </Text>
                                ) : (
                                    <Text style={[styles.udsLog, { color: '#00FF66' }]}>[BUS-OFF] NICIUN EROR</Text>
                                )}
                            </View>
                        </View>
                    </View>
                ) : (
                    /* ── MONITOR MĂRIT CU BUTON CLAR DE ÎNCHIDERE ── */
                    <View style={styles.expandedContainer}>
                        <View style={styles.expandedHeader}>
                            <Text style={styles.expandedTitle}>MONITOR M{expandedPanel} // TELEMETRIE DETALIATĂ</Text>
                            <TouchableOpacity
                                style={styles.closeExpandedBtn}
                                onPress={() => setExpandedPanel(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.closeExpandedText}>◀ ÎNAPOI LA TOATE CELE 6 MONITOARE</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.expandedBody} showsVerticalScrollIndicator={false}>
                            {expandedPanel === 1 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>DINAMICĂ ȘI CUPLU MOTOR</Text>
                                    <Text style={styles.expandedMetricBig}>{speed} <Text style={styles.expandedMetricSub}>KM/H</Text></Text>
                                    <Text style={styles.expandedSubText}>TURAȚIE: {rpm} RPM · TREAPTA: {gear} · ACCELERAȚIE: {throttle}%</Text>
                                    <Text style={styles.expandedSubText}>FORȚĂ G TOTALĂ: {totalG} G (ADERENȚĂ KAMM: {gripUtilizationPct}%)</Text>
                                    <Text style={styles.expandedSubText}>Punct shift dinamic: {targetShiftRpm} RPM</Text>
                                </View>
                            )}

                            {expandedPanel === 2 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>OSCILOSCOP DUAL-CHANNEL PRESIUNI</Text>
                                    <Text style={styles.expandedMetricBig}>{boost} <Text style={styles.expandedMetricSub}>BAR BOOST</Text></Text>
                                    <Text style={styles.expandedSubText}>Turație motor corelată: {rpm} RPM · Temperatură antigel: {coolantTemp}°C</Text>
                                    <Text style={styles.expandedSubText}>Ring Buffer de 25 puncte cu alocare Zero-GC.</Text>
                                </View>
                            )}

                            {expandedPanel === 3 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>MATRICE TERMICĂ CHIULASĂ & EVACUARE</Text>
                                    <Text style={styles.expandedMetricBig}>{coolantTemp}°C <Text style={styles.expandedMetricSub}>ANTIGEL</Text></Text>
                                    <Text style={styles.expandedSubText}>Ulei: {oilTemp}°C · Evacuare EGT: {exhaustTemp}°C · Turbină CHRA: {chraTemp}°C</Text>
                                    <Text style={styles.expandedSubText}>Tensiune alternator: {batteryVoltage}V · SoH baterie: {batterySoH}%</Text>
                                </View>
                            )}

                            {expandedPanel === 4 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>BALANȚĂ TERMODINAMICĂ SANKEY & FRÂNE</Text>
                                    <Text style={styles.expandedMetricBig}>{sankey.mechanicalPct}% <Text style={styles.expandedMetricSub}>LUCRU UTIL</Text></Text>
                                    <Text style={styles.expandedSubText}>Frâne Față: FL {brakePyrometer.fl}°C / FR {brakePyrometer.fr}°C</Text>
                                    <Text style={styles.expandedSubText}>Frâne Spate: RL {brakePyrometer.rl}°C / RR {brakePyrometer.rr}°C</Text>
                                    <Text style={styles.expandedSubText}>Timp răcire turbină recomandat la oprire: {chraCooldownSec} secunde.</Text>
                                </View>
                            )}

                            {expandedPanel === 5 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>STRATEGIE PITWALL ȘI WEIBULL RUL</Text>
                                    <Text style={styles.expandedMetricBig}>{minRulKm} <Text style={styles.expandedMetricSub}>KM RUL MIN</Text></Text>
                                    <Text style={styles.expandedSubText}>Consum per tur: 2.1 Litri · Tururi rămase: 18 tururi</Text>
                                    <Text style={styles.expandedSubText}>Risc pană: {breakdownRisk}% · Economie B2B: +{b2bRoi} €/an</Text>
                                </View>
                            )}

                            {expandedPanel === 6 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>JURNAL BOSCH KALMAN & STATISTICI CAN</Text>
                                    <Text style={styles.expandedMetricBig}>{steadyConfidence}% <Text style={styles.expandedMetricSub}>ÎNCREDERE</Text></Text>
                                    <Text style={styles.expandedSubText}>Transmit Error Counter (TEC): 0 · Receive Error Counter (REC): 0</Text>
                                    <Text style={styles.expandedSubText}>Stare: {isSteadyState ? 'Regim Staționar Stabil' : 'Regim Tranzitoriu Dinamic'}</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030508',
    },
    pitLimiterActiveBorder: {
        borderWidth: 2,
        borderColor: '#FFB800',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 6,
    },
    cyberTag: {
        backgroundColor: '#00F0FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
    },
    cyberTagText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#000000',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    modelText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
        flexShrink: 1,
    },
    deltaPill: {
        borderWidth: 1,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        backgroundColor: '#000000',
    },
    deltaText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    actionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionBtn: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1E3A5F',
        backgroundColor: '#0A1524',
    },
    actionBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8EADC8',
        fontWeight: '700',
    },
    stylePickerBtn: {
        backgroundColor: '#FFB800',
        borderColor: '#FFB800',
    },
    stylePickerText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#000000',
        fontWeight: '900',
    },
    shiftLightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#060B12',
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
        gap: 8,
    },
    sessionModePill: {
        backgroundColor: '#0D1E33',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#00F0FF66',
    },
    sessionModeText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#00F0FF',
    },
    ledsTrack: {
        flex: 1,
        flexDirection: 'row',
        gap: 4,
    },
    shiftLed: {
        flex: 1,
        height: 7,
        borderRadius: 2,
        borderWidth: 0.5,
    },
    viewportLockedContent: {
        flex: 1,
        padding: 8,
    },
    monitorsGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignContent: 'space-between',
    },
    monitorCell: {
        width: (SCREEN_WIDTH - 22) / 2,
        height: '32%',
        backgroundColor: '#080D16',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 6,
        justifyContent: 'space-between',
    },
    monHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#16263D',
        paddingBottom: 2,
    },
    monTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    expandHit: {
        padding: 2,
    },
    monMaxIcon: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    m1Body: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
    },
    gearBox: {
        alignItems: 'center',
    },
    gearNumber: {
        fontFamily: MONO,
        fontSize: 24,
        fontWeight: '900',
    },
    gearLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#6A87A5',
    },
    speedBox: {
        alignItems: 'center',
    },
    speedNumber: {
        fontFamily: MONO,
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    speedLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8EADC8',
    },
    miniRadar: {
        alignItems: 'center',
    },
    radarLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#00F0FF',
        fontWeight: '700',
        marginTop: 2,
    },
    oscilloscopeContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    scopeMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    scopeLegend1: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#00F0FF',
        fontWeight: '700',
    },
    scopeLegend2: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#FFB800',
        fontWeight: '700',
    },
    heatmapGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        paddingTop: 3,
    },
    heatmapCell: {
        width: '31%',
        height: '28%',
        borderRadius: 2,
        borderWidth: 0.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heatName: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#8EADC8',
    },
    heatVal: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '800',
    },
    m4Body: {
        flex: 1,
        justifyContent: 'center',
    },
    pyroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    pyroCorner: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#00F0FF',
        fontWeight: '700',
    },
    sankeyBarFrame: {
        flexDirection: 'row',
        height: 6,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 3,
    },
    sankeySeg: {
        height: '100%',
    },
    sankeyMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sankeyLabel: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#6A87A5',
    },
    chraAlert: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#FF2A2A',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
    },
    chraOk: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#00FF66',
        textAlign: 'center',
        marginTop: 2,
    },
    m5Body: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    weibullLine: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    udsTerminal: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    udsLog: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8EADC8',
    },
    expandedContainer: {
        flex: 1,
        backgroundColor: '#080D16',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 12,
    },
    expandedHeader: {
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
        paddingBottom: 10,
        marginBottom: 12,
        gap: 8,
    },
    expandedTitle: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: '900',
        color: '#00F0FF',
        letterSpacing: 1,
    },
    closeExpandedBtn: {
        backgroundColor: '#FF2A2A22',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#FF2A2A',
        alignItems: 'center',
    },
    closeExpandedText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FF2A2A',
        letterSpacing: 0.5,
    },
    expandedBody: {
        flex: 1,
    },
    expandedCard: {
        backgroundColor: '#04070D',
        padding: 16,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#16263D',
    },
    expandedCardTitle: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '800',
        color: '#FFB800',
        marginBottom: 8,
    },
    expandedMetricBig: {
        fontFamily: MONO,
        fontSize: 36,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        marginBottom: 6,
    },
    expandedMetricSub: {
        fontSize: 14,
        color: '#8EADC8',
    },
    expandedSubText: {
        fontFamily: MONO,
        fontSize: 11,
        color: '#8EADC8',
        marginTop: 4,
    },
});
