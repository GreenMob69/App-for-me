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
    TextInput,
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
import { useParadigmCoreData } from '../../hooks/useParadigmCoreData';
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
    // Stare Pagini Pitwall: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
    const [pitwallPage, setPitwallPage] = useState('P1');
    const isLiveViewActive = pitwallPage === 'P1' || pitwallPage === 'P2';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();
    const [f1AccentKey, setF1AccentKey] = useState('CYAN'); // 'CYAN' | 'RED' | 'LIME'
    const [radioPromptInput, setRadioPromptInput] = useState('');

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
        if (!isLiveViewActive) return;

        const idx = ringIndexRef.current;
        ringBufferRef.current[idx] = { boost, rpm };
        ringIndexRef.current = (idx + 1) % 25;

        // Generate SVG points string directly without array allocations
        let bPoints = '';
        let rPoints = '';
        for (let i = 0; i < 25; i++) {
            const bufferIdx = (ringIndexRef.current + i) % 25;
            const pt = ringBufferRef.current[bufferIdx];
            const x = (i * (160 / 25)).toFixed(1);
            const yBoost = (52 - (pt.boost * 20)).toFixed(1);
            const yRpm = (56 - (pt.rpm / 110)).toFixed(1);
            bPoints += (i === 0 ? '' : ' ') + x + ',' + yBoost;
            rPoints += (i === 0 ? '' : ' ') + x + ',' + yRpm;
        }
        setOscilloscopePoints({
            boostPoints: bPoints,
            rpmPoints: rPoints,
        });

        // 1. Dynamic Shift Alert
        if (rpm >= targetShiftRpm - 100) {
            hapticShiftAlert();
            audioGong.playGong('pit');
        }

        // Peak updates
        if (totalG > peakG) setPeakG(totalG);
        if (boost > peakBoost) setPeakBoost(boost);
    }, [isLiveViewActive, telemetry.rpm, telemetry.boost, targetShiftRpm, totalG, peakG, peakBoost]);

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

    // 9. Qualy Purple vs Race Neon Theme Mapping & Sub-Accents (McLaren/Scuderia/Aston)
    const f1Accents = {
        CYAN: { primary: '#00F0FF', border: '#16263D' },
        RED: { primary: '#FF2A2A', border: '#3D1616' },
        LIME: { primary: '#00FF66', border: '#163D20' },
    };
    const activeAccentSet = f1Accents[f1AccentKey] || f1Accents.CYAN;
    const isQualy = sessionMode === 'QUAL';
    const isPit = sessionMode === 'PIT';
    const primaryAccent = isQualy ? '#B000FF' : activeAccentSet.primary;
    const borderAccent = isQualy ? '#600099' : activeAccentSet.border;

    const safeTop = typeof insets?.top === 'number' && !isNaN(insets.top) ? Math.max(insets.top, 24) : 24;
    const safeBottom = typeof insets?.bottom === 'number' && !isNaN(insets.bottom) ? Math.max(insets.bottom, 12) : 12;

    return (
        <View style={[
            styles.container,
            { paddingTop: safeTop, paddingBottom: safeBottom },
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
                        style={[styles.actionBtn, styles.stylePickerBtn]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={styles.stylePickerText}>🎨 STIL</Text>
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
                        style={[styles.actionBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF1A' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionBtnText, { color: '#00F0FF' }]}>🎮</Text>
                    </TouchableOpacity>

                    {/* Sub-Accent Switcher (CYAN / RED / LIME) */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: primaryAccent, backgroundColor: `${primaryAccent}1A` }]}
                        onPress={() => {
                            hapticTap();
                            setF1AccentKey(prev => prev === 'CYAN' ? 'RED' : prev === 'RED' ? 'LIME' : 'CYAN');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionBtnText, { color: primaryAccent }]}>
                            {f1AccentKey === 'CYAN' ? '🔷' : f1AccentKey === 'RED' ? '🔴' : '🟢'}
                        </Text>
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

            {/* ── PITWALL PAGES SELECTOR (P1..P5) ── */}
            <View style={styles.pitwallTabBar}>
                {[
                    { id: 'P1', label: 'P1 RACE' },
                    { id: 'P2', label: 'P2 X-RAY' },
                    { id: 'P3', label: 'P3 STINT' },
                    { id: 'P4', label: 'P4 SCRUT' },
                    { id: 'P5', label: 'P5 AI COMMS' },
                ].map((tab) => {
                    const isActive = pitwallPage === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.pitwallTabBtn,
                                isActive && { backgroundColor: `${primaryAccent}22`, borderColor: primaryAccent }
                            ]}
                            onPress={() => {
                                hapticTap();
                                setPitwallPage(tab.id);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.pitwallTabText,
                                { color: isActive ? primaryAccent : '#64748B' }
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── 3. CORPUL CENTRAL: GRILĂ 6 MONITOARE SAU MONITOR MĂRIT ── */}
            <View style={styles.viewportLockedContent}>
                {pitwallPage === 'P1' && (
                    expandedPanel === null ? (
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
                ))}

                {/* ── P2: X-RAY 32 VIRTUAL SENSORS MATRIX ── */}
                {pitwallPage === 'P2' && (
                    <View style={styles.pitwallPageContainer}>
                        <View style={styles.pitwallPageHeader}>
                            <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                                [ P2 ] McLAREN PITWALL · 32 VIRTUAL SENSORS MATRIX
                            </Text>
                            <Text style={styles.pitwallPageSub}>CAN-BUS 500kbps · OBSERVER KALMAN HYBRID</Text>
                        </View>
                        <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                            {Object.entries(core.virtualSensors).map(([catKey, sensors]) => {
                                const catLabels = {
                                    engine: '01. GRUP PROPULSOR & INJECȚIE',
                                    turbo: '02. SUPRAALIMENTARE & ADMISIE',
                                    thermal: '03. ECHILIBRU TERMIC & RĂCIRE',
                                    dpf: '04. POST-TRATARE EMISII DPF/SCR',
                                    electric: '05. REȚEA ELECTRICĂ & BATERIE',
                                    safety: '06. DINAMICĂ ȘASIU & SIGURANȚĂ',
                                };
                                return (
                                    <View key={catKey} style={styles.pitwallSensorsBox}>
                                        <Text style={[styles.sensorsGroupTitle, { color: primaryAccent }]}>
                                            {catLabels[catKey] || catKey.toUpperCase()}
                                        </Text>
                                        <View style={styles.sensorsGrid2Col}>
                                            {sensors.map((s) => {
                                                const isWarn = s.status === 'WARN';
                                                const isAlert = s.status === 'ALERT';
                                                const statusColor = isAlert ? '#FF2A2A' : isWarn ? '#FFB800' : '#00FF66';
                                                return (
                                                    <View key={s.id} style={[styles.sensorCellF1, { borderColor: isAlert ? '#FF2A2A88' : '#16263D' }]}>
                                                        <View style={styles.sensorCellTop}>
                                                            <Text style={styles.sensorLabelF1} numberOfLines={1}>{s.label}</Text>
                                                            <View style={[styles.f1StatusDot, { backgroundColor: statusColor }]} />
                                                        </View>
                                                        <View style={styles.sensorCellBottom}>
                                                            <Text style={[styles.sensorValF1, { color: statusColor }]}>{s.val}</Text>
                                                            <Text style={styles.sensorTargetF1}>REF: {s.target}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ── P3: STINT REPLAY PLAYER & FIA DOSSIER ── */}
                {pitwallPage === 'P3' && (
                    <View style={styles.pitwallPageContainer}>
                        <View style={styles.pitwallPageHeader}>
                            <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                                [ P3 ] TELEMETRIE STINTURI & BLACK-BOX REPLAY
                            </Text>
                            <Text style={styles.pitwallPageSub}>DESCARCĂ & REPLAY SIMULARE ÎN TIMP REAL</Text>
                        </View>
                        <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                            {/* Live Replay Player Controller */}
                            <View style={styles.f1ReplayBox}>
                                <View style={styles.replayHeaderF1}>
                                    <Text style={styles.f1ReplayTitle}>
                                        REPLAY: {core.selectedTripId ? core.tripsList.find(t => t.id === core.selectedTripId)?.title || 'STINT SELECTAT' : 'NICIUN STINT'}
                                    </Text>
                                    <Text style={[styles.f1ReplaySpeedBadge, { color: primaryAccent }]}>{core.replaySpeed}x</Text>
                                </View>

                                {/* Progress bar / Scrubber */}
                                <View style={styles.f1ScrubberTrack}>
                                    <View style={[styles.f1ScrubberFill, { width: `${core.replayTotalSamples > 0 ? (core.replayIndex / core.replayTotalSamples) * 100 : 0}%`, backgroundColor: primaryAccent }]} />
                                </View>

                                {/* Telemetry data for active replay point */}
                                <View style={styles.f1ReplayMetricsRow}>
                                    <View style={styles.f1ReplayCol}>
                                        <Text style={styles.f1ReplayLabel}>VITEZĂ</Text>
                                        <Text style={styles.f1ReplayVal}>{core.currentReplaySample?.speed ?? speed} <Text style={styles.f1Unit}>km/h</Text></Text>
                                    </View>
                                    <View style={styles.f1ReplayCol}>
                                        <Text style={styles.f1ReplayLabel}>TURAȚIE</Text>
                                        <Text style={styles.f1ReplayVal}>{core.currentReplaySample?.rpm ?? rpm} <Text style={styles.f1Unit}>RPM</Text></Text>
                                    </View>
                                    <View style={styles.f1ReplayCol}>
                                        <Text style={styles.f1ReplayLabel}>BOOST</Text>
                                        <Text style={styles.f1ReplayVal}>{(core.currentReplaySample?.boost ?? boost).toFixed(2)} <Text style={styles.f1Unit}>bar</Text></Text>
                                    </View>
                                    <View style={styles.f1ReplayCol}>
                                        <Text style={styles.f1ReplayLabel}>G-LAT</Text>
                                        <Text style={styles.f1ReplayVal}>{(core.currentReplaySample?.gForceLat ?? gForceLat).toFixed(2)} <Text style={styles.f1Unit}>G</Text></Text>
                                    </View>
                                </View>

                                {/* Playback Controls */}
                                <View style={styles.f1ControlsRow}>
                                    <TouchableOpacity
                                        style={[styles.f1Btn, { backgroundColor: core.isReplaying ? '#FFB80022' : `${primaryAccent}22`, borderColor: core.isReplaying ? '#FFB800' : primaryAccent }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.togglePlayPause();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.f1BtnText, { color: core.isReplaying ? '#FFB800' : primaryAccent }]}>
                                            {core.isReplaying ? '❚❚ PAUZĂ' : '▶ REDĂ'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.cycleReplaySpeed();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.f1BtnText}>{core.replaySpeed}x VITEZĂ</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.exportTripPdf(core.selectedTripId || 'trip_108');
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.f1BtnText}>📄 PDF STINT</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.exportItpDossier();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.f1BtnText}>📋 DOSAR FIA</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* List of Previous Stints */}
                            <Text style={[styles.sensorsGroupTitle, { color: primaryAccent, marginTop: 12 }]}>
                                ISTORIC SESIUNI & STINTURI SALVATE
                            </Text>
                            {core.tripsList.map((trip) => {
                                const isSelected = core.selectedTripId === trip.id;
                                return (
                                    <TouchableOpacity
                                        key={trip.id}
                                        style={[styles.stintCard, isSelected && { borderColor: primaryAccent, backgroundColor: `${primaryAccent}11` }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.selectTripForReplay(trip.id);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <View style={styles.stintCardHeader}>
                                            <Text style={styles.stintTitle}>{trip.title}</Text>
                                            <Text style={styles.stintDate}>{trip.date}</Text>
                                        </View>
                                        <View style={styles.stintStatsRow}>
                                            <Text style={styles.stintStat}>DISTANȚĂ: <Text style={{ color: '#FFFFFF' }}>{trip.km} km</Text></Text>
                                            <Text style={styles.stintStat}>VMAX: <Text style={{ color: '#00F0FF' }}>{trip.maxSpeed} km/h</Text></Text>
                                            <Text style={styles.stintStat}>CONSUM: <Text style={{ color: '#00FF66' }}>{trip.avgConsumption} l/100km</Text></Text>
                                            <Text style={styles.stintStat}>ECO: <Text style={{ color: '#FFB800' }}>{trip.ecoScore}%</Text></Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* ── P4: FIA SCRUTINEERING & PASSES ── */}
                {pitwallPage === 'P4' && (
                    <View style={styles.pitwallPageContainer}>
                        <View style={styles.pitwallPageHeader}>
                            <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                                [ P4 ] FIA SCRUTINEERING · MENTENANȚĂ & PAȘAPORT TEHNIC
                            </Text>
                            <Text style={styles.pitwallPageSub}>UZURĂ ARRHENIUS / ARCHARD & MONITORIZARE LICENȚE</Text>
                        </View>
                        <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                            {/* Wear / CBM List */}
                            <Text style={[styles.sensorsGroupTitle, { color: primaryAccent }]}>
                                COMPONENT WEAR & LIFESPAN (CBM)
                            </Text>
                            {core.maintenanceItems.map((item) => {
                                const isWarn = item.status === 'WARN';
                                const isCrit = item.status === 'ALERT';
                                const barColor = isCrit ? '#FF2A2A' : isWarn ? '#FFB800' : '#00FF66';
                                return (
                                    <View key={item.id} style={styles.scrutCard}>
                                        <View style={styles.scrutHeaderRow}>
                                            <Text style={styles.scrutName}>{item.title.toUpperCase()}</Text>
                                            <Text style={[styles.scrutWear, { color: barColor }]}>{item.wearPct}% UZURĂ</Text>
                                        </View>
                                        <View style={styles.scrutBarBg}>
                                            <View style={[styles.scrutBarFill, { width: `${item.wearPct}%`, backgroundColor: barColor }]} />
                                        </View>
                                        <View style={styles.scrutFooterRow}>
                                            <Text style={styles.scrutKm}>{item.currentKm} km / max {item.maxKm} km</Text>
                                            <TouchableOpacity
                                                style={[styles.resetComponentBtn, { borderColor: primaryAccent }]}
                                                onPress={() => {
                                                    hapticTap();
                                                    core.markServiceItemCompleted(item.id);
                                                }}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={[styles.resetComponentBtnText, { color: primaryAccent }]}>[ ✓ RESETARE FIA ]</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Legal Documents / Passports */}
                            <Text style={[styles.sensorsGroupTitle, { color: primaryAccent, marginTop: 14 }]}>
                                PAȘAPORT TEHNIC & LICENȚE DE CIRCULAȚIE
                            </Text>
                            <View style={styles.sensorsGrid2Col}>
                                {core.legalDocuments.map((doc, idx) => {
                                    const isExp = doc.daysRemaining < 30;
                                    return (
                                        <View key={idx} style={[styles.scrutCard, { flex: 1, marginHorizontal: 2 }]}>
                                            <View style={styles.scrutHeaderRow}>
                                                <Text style={[styles.scrutName, { color: primaryAccent }]}>{doc.type}</Text>
                                                <View style={[styles.fiaBadge, { backgroundColor: isExp ? '#FF2A2A22' : '#00FF6622', borderColor: isExp ? '#FF2A2A' : '#00FF66' }]}>
                                                    <Text style={[styles.fiaBadgeText, { color: isExp ? '#FF2A2A' : '#00FF66' }]}>{doc.status}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.docIssuerF1}>EMITENT: {doc.issuer}</Text>
                                            <Text style={styles.docDaysF1}>EXPIRĂ ÎN: <Text style={{ color: isExp ? '#FF2A2A' : '#FFFFFF', fontWeight: '900' }}>{doc.daysRemaining} ZILE</Text></Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* ── P5: PADDOCK SECURITY & TEAM RADIO AI ── */}
                {pitwallPage === 'P5' && (
                    <View style={styles.pitwallPageContainer}>
                        <View style={styles.pitwallPageHeader}>
                            <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                                [ P5 ] PADDOCK SECURITY & TEAM RADIO INGINER AI
                            </Text>
                            <Text style={styles.pitwallPageSub}>SENTRY SHOCK GUARD · VALET LIMITER · PITWALL RADIO</Text>
                        </View>
                        <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                            {/* Paddock & Sentry Security */}
                            <View style={styles.paddockSecurityBox}>
                                <View style={styles.paddockHeaderRow}>
                                    <View>
                                        <Text style={[styles.paddockTitle, { color: primaryAccent }]}>SENTRY GUARD · PROTECȚIE PARCARE</Text>
                                        <Text style={styles.paddockSub}>STARE: {core.sentryArmed ? 'ACTIVAT (RADAR VIBRAȚIE ON)' : 'DEZARMAT'}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.paddockToggleBtn, { backgroundColor: core.sentryArmed ? '#FF2A2A22' : '#00FF6622', borderColor: core.sentryArmed ? '#FF2A2A' : '#00FF66' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.setSentryArmed(!core.sentryArmed);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.paddockToggleText, { color: core.sentryArmed ? '#FF2A2A' : '#00FF66' }]}>
                                            {core.sentryArmed ? 'DEZARMEAZĂ' : 'ARMEAZĂ'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Shock simulation button */}
                                <TouchableOpacity
                                    style={styles.shockSimBtnF1}
                                    onPress={() => {
                                        hapticTap();
                                        core.triggerShockSimulation();
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.shockSimTextF1}>⚡ SIMULEAZĂ ȘOC / TILT ACCELEROMETRU (G-SPIKE)</Text>
                                </TouchableOpacity>

                                {/* Sentry Events Log */}
                                {core.sentryEvents?.length > 0 && (
                                    <View style={styles.paddockEventsBox}>
                                        <Text style={styles.paddockEventsTitle}>JURNAL ALERTE SENZORI VIBRAȚIE</Text>
                                        {core.sentryEvents.slice(0, 2).map((ev) => (
                                            <View key={ev.id} style={styles.paddockEventRow}>
                                                <Text style={styles.paddockEventTime}>{ev.time}</Text>
                                                <Text style={styles.paddockEventDesc}>{ev.desc}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Valet Mode & GPS Directions */}
                                <View style={[styles.paddockHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#16263D' }]}>
                                    <View>
                                        <Text style={styles.paddockTitle}>MOD VALET (LIMITARE PUTERE)</Text>
                                        <Text style={styles.paddockSub}>LIMITĂ: {core.valetSpeedLimit} km/h · {core.valetRpmLimit} RPM</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.paddockToggleBtn, { backgroundColor: core.valetActive ? '#FFB80022' : '#16263D', borderColor: core.valetActive ? '#FFB800' : '#2D446B' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.toggleValetMode();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.paddockToggleText, { color: core.valetActive ? '#FFB800' : '#8EADC8' }]}>
                                            {core.valetActive ? 'ACTIV' : 'INACTIV'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* GPS Paddock Route & Parking Timer */}
                                <View style={[styles.paddockHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#16263D' }]}>
                                    <View>
                                        <Text style={styles.paddockTitle}>COORDONATE GPS MAȘINĂ</Text>
                                        <Text style={styles.paddockCoords}>{core.carGpsCoords.lat.toFixed(4)}°N, {core.carGpsCoords.lng.toFixed(4)}°E</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.paddockNavBtn, { borderColor: primaryAccent }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.openWalkingDirections();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.paddockNavBtnText, { color: primaryAccent }]}>NAVIGHEAZĂ 📍</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Parking Ticket Stint Timer */}
                                <View style={styles.stintTimerRow}>
                                    <Text style={styles.stintTimerLabel}>CRONOMETRU TICHET PARCARE:</Text>
                                    <Text style={[styles.stintTimerVal, { color: core.parkingMinutesRemaining < 15 ? '#FF2A2A' : '#00FF66' }]}>
                                        {core.parkingMinutesRemaining} MIN
                                    </Text>
                                    <View style={styles.stintBtnsRow}>
                                        {[15, 30, 60].map(mins => (
                                            <TouchableOpacity
                                                key={mins}
                                                style={styles.stintAddBtn}
                                                onPress={() => {
                                                    hapticTap();
                                                    core.addParkingTime(mins);
                                                }}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <Text style={styles.stintAddBtnText}>+{mins}m</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* Team Radio Pitwall AI Engineer */}
                            <Text style={[styles.sensorsGroupTitle, { color: primaryAccent, marginTop: 14 }]}>
                                PITWALL TEAM RADIO · INGINER CURSĂ AI
                            </Text>
                            {/* Quick Diagnostic Chips */}
                            <View style={styles.radioChipsRow}>
                                {[
                                    'BOX BOX: Verifică uzura pneurilor și frânelor',
                                    'TURBO: Analizează temperatura miezului CHRA',
                                    'DPF: Nivel încărcare filtru și contrapresiune',
                                    'TELEMETRIE: Rezumat parametri ultimul stint',
                                ].map((chip, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.radioChip}
                                        onPress={() => {
                                            hapticTap();
                                            core.sendAiPrompt(chip);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={styles.radioChipText} numberOfLines={1}>{chip}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* AI Radio Messages Box */}
                            <View style={styles.radioCommsBox}>
                                {core.aiMessages.slice(-3).map((msg) => (
                                    <View key={msg.id} style={styles.radioMsgRow}>
                                        <Text style={[styles.radioSender, { color: msg.sender === 'user' ? '#00F0FF' : '#FFB800' }]}>
                                            {msg.sender === 'user' ? '[PILOT]' : '[PITWALL ENG]'}:
                                        </Text>
                                        <Text style={styles.radioMsgText}>{msg.text}</Text>
                                    </View>
                                ))}
                                {core.isAiLoading && (
                                    <Text style={[styles.radioMsgText, { color: '#00F0FF' }]}>📡 PITWALL COMMS: Se procesează telemetria...</Text>
                                )}
                            </View>

                            {/* AI Radio Input Row */}
                            <View style={styles.radioInputRow}>
                                <TextInput
                                    style={styles.radioTextInput}
                                    placeholder="Transmite mesaj către inginerul de cursă..."
                                    placeholderTextColor="#475569"
                                    value={radioPromptInput}
                                    onChangeText={setRadioPromptInput}
                                />
                                <TouchableOpacity
                                    style={[styles.radioSendBtn, { backgroundColor: primaryAccent }]}
                                    onPress={() => {
                                        if (!radioPromptInput.trim()) return;
                                        hapticTap();
                                        core.sendAiPrompt(radioPromptInput);
                                        setRadioPromptInput('');
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.radioSendBtnText}>TRANSMITE</Text>
                                </TouchableOpacity>
                            </View>
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
        flex: 1,
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
        flexShrink: 0,
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
    pitwallTabBar: {
        flexDirection: 'row',
        backgroundColor: '#060B12',
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 6,
    },
    pitwallTabBtn: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#16263D',
        backgroundColor: '#0A121E',
    },
    pitwallTabText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pitwallPageContainer: {
        flex: 1,
    },
    pitwallPageHeader: {
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
    },
    pitwallPageTitle: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pitwallPageSub: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#64748B',
        marginTop: 2,
    },
    pitwallPageScroll: {
        flex: 1,
    },
    pitwallSensorsBox: {
        marginBottom: 12,
    },
    sensorsGroupTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    sensorsGrid2Col: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    sensorCellF1: {
        width: '49%',
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 6,
    },
    sensorCellTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sensorLabelF1: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8EADC8',
        flex: 1,
        marginRight: 4,
    },
    f1StatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    sensorCellBottom: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
    },
    sensorValF1: {
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    sensorTargetF1: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#475569',
    },
    f1ReplayBox: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
    },
    replayHeaderF1: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    f1ReplayTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
        flex: 1,
    },
    f1ReplaySpeedBadge: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    f1ScrubberTrack: {
        height: 6,
        backgroundColor: '#0F1E33',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 10,
    },
    f1ScrubberFill: {
        height: '100%',
        borderRadius: 3,
    },
    f1ReplayMetricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingVertical: 6,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#16263D',
    },
    f1ReplayCol: {
        alignItems: 'center',
        flex: 1,
    },
    f1ReplayLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
        fontWeight: '700',
    },
    f1ReplayVal: {
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    f1Unit: {
        fontSize: 8,
        color: '#64748B',
        fontWeight: '400',
    },
    f1ControlsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    f1Btn: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 3,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    f1BtnOutlined: {
        flex: 1,
        paddingVertical: 7,
        borderRadius: 3,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A121E',
    },
    f1BtnText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#8EADC8',
    },
    stintCard: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 8,
        marginBottom: 6,
    },
    stintCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    stintTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    stintDate: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    stintStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 6,
    },
    stintStat: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    scrutCard: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 8,
        marginBottom: 6,
    },
    scrutHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    scrutName: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    scrutWear: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    scrutBarBg: {
        height: 6,
        backgroundColor: '#0F1E33',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    scrutBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    scrutFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    scrutKm: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    resetComponentBtn: {
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
        backgroundColor: '#0A121E',
    },
    resetComponentBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    fiaBadge: {
        borderWidth: 1,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    fiaBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    docIssuerF1: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
        marginTop: 2,
    },
    docDaysF1: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8EADC8',
        marginTop: 4,
    },
    paddockSecurityBox: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
    },
    paddockHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paddockTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    paddockSub: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
        marginTop: 2,
    },
    paddockToggleBtn: {
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
    },
    paddockToggleText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    shockSimBtnF1: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: '#111E30',
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#00F0FF44',
        alignItems: 'center',
    },
    shockSimTextF1: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#00F0FF',
    },
    paddockEventsBox: {
        marginTop: 8,
        padding: 6,
        backgroundColor: '#04070D',
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#16263D',
    },
    paddockEventsTitle: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#FFB800',
        fontWeight: '800',
        marginBottom: 4,
    },
    paddockEventRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    paddockEventTime: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    paddockEventDesc: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    paddockCoords: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#00F0FF',
        fontWeight: '800',
        marginTop: 2,
    },
    paddockNavBtn: {
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        backgroundColor: '#0A121E',
    },
    paddockNavBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    stintTimerRow: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#16263D',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stintTimerLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    stintTimerVal: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '900',
    },
    stintBtnsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    stintAddBtn: {
        backgroundColor: '#111E30',
        borderWidth: 1,
        borderColor: '#16263D',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
    },
    stintAddBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#00F0FF',
    },
    radioChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    radioChip: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    radioChipText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    radioCommsBox: {
        backgroundColor: '#04070D',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
        minHeight: 64,
    },
    radioMsgRow: {
        flexDirection: 'row',
        marginBottom: 4,
        gap: 6,
    },
    radioSender: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    radioMsgText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#E2E8F0',
        flex: 1,
    },
    radioInputRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    radioTextInput: {
        flex: 1,
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontFamily: MONO,
        fontSize: 9,
        color: '#FFFFFF',
    },
    radioSendBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioSendBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#000000',
    },
});
