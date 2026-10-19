// @ts-check
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
    Modal,
    TextInput,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, { Rect, Path, Circle, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useParadigmCoreData } from '../../hooks/useParadigmCoreData';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert } from '../../services/hapticFeedback';
import { audioGong } from '../../services/audioGongService';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETRO_FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.RETRO_AUDI_96];

// ─── 8. Stepped Tachometer Bitmask Vector Optimization (Single Path SVG) ────
const GHOST_BARGRAPH_CACHE = {};
function getGhostBargraphPath(width, totalBlocks = 25) {
    if (GHOST_BARGRAPH_CACHE[width]) return GHOST_BARGRAPH_CACHE[width];
    let d = '';
    const blockWidth = Math.max((width - 60) / totalBlocks, 6);
    const blockGap = 2.5;
    for (let i = 0; i < totalBlocks; i++) {
        const x = i * (blockWidth + blockGap) + 10;
        const blockHeight = 12 + Math.floor((i / totalBlocks) * 16);
        const y = 34 - blockHeight;
        d += `M ${x} ${y} h ${blockWidth} v ${blockHeight} h -${blockWidth} Z `;
    }
    GHOST_BARGRAPH_CACHE[width] = d;
    return d;
}

const AudiTachometerBargraph = React.memo(function AudiTachometerBargraph({ rpm = 800, maxRpm = 6500, width = SCREEN_WIDTH - 40, brightness = 1.0, phosphorTrailRpm = 800 }) {
    const totalBlocks = 25;
    const clampedRpm = Math.min(Math.max(rpm, 0), maxRpm);
    const activeBlocksCount = Math.round((clampedRpm / maxRpm) * totalBlocks);
    const trailBlocksCount = Math.round((Math.min(Math.max(phosphorTrailRpm, 0), maxRpm) / maxRpm) * totalBlocks);

    const blockWidth = Math.max((width - 60) / totalBlocks, 6);
    const blockGap = 2.5;

    // Build unified path strings using bitwise index iteration (Zero DOM reconciliation overhead)
    let activePathD = '';
    let trailPathD = '';
    const inactivePathD = getGhostBargraphPath(width, totalBlocks);

    const maxLit = Math.max(activeBlocksCount, trailBlocksCount);
    for (let i = 0; i < maxLit; i++) {
        const x = i * (blockWidth + blockGap) + 10;
        const blockHeight = 12 + Math.floor((i / totalBlocks) * 16);
        const y = 34 - blockHeight;
        const rectD = `M ${x} ${y} h ${blockWidth} v ${blockHeight} h -${blockWidth} Z `;

        if (i < activeBlocksCount) {
            activePathD += rectD;
        } else if (i < trailBlocksCount) {
            trailPathD += rectD; // 1. Phosphor Decay Trail
        }
    }

    return (
        <View style={styles.tachoWrapper}>
            <View style={styles.tachoHeader}>
                <Text style={[styles.tachoLabel, { opacity: brightness }]}>DREHZAHL // x1000 min⁻¹</Text>
                <Text style={[styles.tachoValue, { opacity: brightness }]}>
                    {(rpm / 1000).toFixed(1)} <Text style={styles.tachoUnit}>RPM</Text>
                </Text>
            </View>

            <Svg width={width} height={38} viewBox={`0 0 ${width} 38`}>
                <Defs>
                    <LinearGradient id="tachoActiveGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#00FF66" stopOpacity={brightness} />
                        <Stop offset="0.6" stopColor="#FF8800" stopOpacity={brightness} />
                        <Stop offset="0.85" stopColor="#FF3300" stopOpacity={brightness} />
                    </LinearGradient>
                </Defs>

                {/* Inactive ghost background segments */}
                {inactivePathD ? (
                    <Path d={inactivePathD} fill="rgba(255, 136, 0, 0.07)" stroke="#1F0803" strokeWidth="0.5" />
                ) : null}

                {/* 1. Phosphor Decay Trail (Luminescent Persistence) */}
                {trailPathD ? (
                    <Path d={trailPathD} fill="#FF8800" opacity={0.22 * brightness} stroke="#FFAA33" strokeWidth="0.5" />
                ) : null}

                {/* Active Lit Segments */}
                {activePathD ? (
                    <Path d={activePathD} fill="url(#tachoActiveGrad)" stroke="#FFAA33" strokeWidth={0.8} />
                ) : null}

                <Line x1="10" y1="36" x2={width - 20} y2="36" stroke="#4A180C" strokeWidth="1" />
                <SvgText x="12" y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>0</SvgText>
                <SvgText x={width * 0.3} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>2</SvgText>
                <SvgText x={width * 0.58} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>4</SvgText>
                <SvgText x={width * 0.82} y="32" fill="#FF4422" fontSize="7" fontFamily={RETRO_FONT}>6</SvgText>
            </Svg>
        </View>
    );
});

// ─── Vertical LED Segment Column with Peak Hold Indicator ────────────────────
function VerticalLedColumn({
    label,
    value,
    unit,
    min,
    max,
    warnThreshold,
    critThreshold,
    color = '#FF8800',
    brightness = 1.0,
    peakHold = null,
}) {
    const totalSegments = 10;
    const val = Number(value) || 0;
    const ratio = Math.min(Math.max((val - min) / (max - min), 0), 1);
    const litCount = Math.round(ratio * totalSegments);

    const peakRatio = peakHold !== null ? Math.min(Math.max((peakHold - min) / (max - min), 0), 1) : null;
    const peakIndex = peakRatio !== null ? Math.round(peakRatio * totalSegments) - 1 : null;

    const isCrit = critThreshold && val >= critThreshold;
    const isWarn = warnThreshold && val >= warnThreshold;
    const activeColor = isCrit ? '#FF3300' : isWarn ? '#FFAA00' : color;

    return (
        <View style={styles.verticalCol}>
            <Text style={[styles.verticalColLabel, { opacity: brightness }]} numberOfLines={1}>{label}</Text>
            <View style={styles.verticalBarFrame}>
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const segIndex = totalSegments - 1 - i;
                    const isLit = segIndex < litCount;
                    const isPeakTick = peakIndex === segIndex; // 6. Overboost Peak-Hold marker
                    return (
                        <View
                            key={i}
                            style={[
                                styles.verticalSegment,
                                {
                                    backgroundColor: isLit
                                        ? activeColor
                                        : isPeakTick
                                        ? '#FF3300'
                                        : 'rgba(255, 136, 0, 0.07)',
                                    borderColor: isLit || isPeakTick ? activeColor : '#2A0E08',
                                    opacity: isLit || isPeakTick ? brightness : 0.6,
                                },
                            ]}
                        />
                    );
                })}
            </View>
            <Text style={[styles.verticalColValue, { opacity: brightness }, isCrit && { color: '#FF3300' }]}>
                {val} <Text style={styles.verticalColUnit}>{unit}</Text>
            </Text>
        </View>
    );
}

export default function RetroAudi96Paradigm() {
    const insets = useSafeInsets();

    // 6 Taste Basculante: '1' DIGIFIZ | '2' VAG 1551 | '3' FAHRTENBUCH | '4' SERVICEHEFT | '5' SAFE-LOCK | '6' MEISTER AI
    const [activeSwitch, setActiveSwitch] = useState('1');
    const isLiveViewActive = activeSwitch === '1' || activeSwitch === '2';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    const [retroAccentMode, setRetroAccentMode] = useState('AMBER'); // 'AMBER' | 'RED' | 'GREEN'
    const [selectedMwbGroup, setSelectedMwbGroup] = useState('engine');
    const [meisterPromptInput, setMeisterPromptInput] = useState('');

    // Stări locale bord
    const [bcModeIndex, setBcModeIndex] = useState(0);
    const [dimmerLevel, setDimmerLevel] = useState(1.0); // 1.0 = zi / 0.6 = noapte
    const [tripKmOffset, setTripKmOffset] = useState(247.4);
    const [autocheckState, setAutocheckState] = useState('OK'); // 'BREMSE' -> 'OELDRUCK' -> 'OK'
    const [showVagTester, setShowVagTester] = useState(false);
    const [vagChannel, setVagChannel] = useState('001');

    // ─── 1. Phosphor Decay Simulation Ref ─────────────────────────────────────
    const [phosphorTrailRpm, setPhosphorTrailRpm] = useState(telemetry.rpm);
    useEffect(() => {
        // Exponential decay toward current telemetry RPM
        const interval = setInterval(() => {
            setPhosphorTrailRpm((prev) => {
                if (Math.abs(prev - telemetry.rpm) < 20) return telemetry.rpm;
                return prev * 0.82 + telemetry.rpm * 0.18;
            });
        }, 50);
        return () => clearInterval(interval);
    }, [telemetry.rpm]);

    // ─── 2. 5-Cylinder Engine Vibration Micro-Jitter (at idle 850 RPM) ────────
    const [idleJitterY, setIdleJitterY] = useState(0);
    useEffect(() => {
        if (telemetry.rpm >= 750 && telemetry.rpm <= 950) {
            const timer = setInterval(() => {
                setIdleJitterY((prev) => (prev === 0 ? 0.6 : 0));
            }, 120);
            return () => clearInterval(timer);
        } else {
            setIdleJitterY(0);
        }
    }, [telemetry.rpm]);

    // ─── 3. Authentic Audi Autocheck Self-Test Sequence with Piezo Sound ──────
    const runAutocheckCycle = () => {
        audioGong.playGong('autocheck');
        setAutocheckState('BREMSE');
        setTimeout(() => setAutocheckState('OELDRUCK'), 1200);
        setTimeout(() => setAutocheckState('GENERATOR'), 2400);
        setTimeout(() => setAutocheckState('OK'), 3600);
    };

    useEffect(() => {
        const initialTimer = setTimeout(runAutocheckCycle, 800);
        return () => clearTimeout(initialTimer);
    }, []);

    // ─── 6. Turbo Boost Overboost Peak-Hold Tracking ──────────────────────────
    const [peakBoostHold, setPeakBoostHold] = useState(telemetry.boost);
    const peakHoldTimerRef = useRef(null);

    useEffect(() => {
        if (telemetry.boost > peakBoostHold) {
            setPeakBoostHold(telemetry.boost);
            if (peakHoldTimerRef.current) clearTimeout(peakHoldTimerRef.current);
            peakHoldTimerRef.current = setTimeout(() => {
                setPeakBoostHold(telemetry.boost);
            }, 3000); // Hold peak marker for 3s
        }
    }, [telemetry.boost]);

    // ─── 10. Low Temp Frost Gong (❄️) <= 4°C ─────────────────────────────────
    const [hasFiredFrostGong, setHasFiredFrostGong] = useState(false);
    const ambientTemp = 3.5; // Ambient winter temperature reading
    useEffect(() => {
        if (ambientTemp <= 4.0 && !hasFiredFrostGong) {
            audioGong.playGong('frost');
            setHasFiredFrostGong(true);
        }
    }, [ambientTemp, hasFiredFrostGong]);

    // Haptic Shift Alert
    const prevRpm = useRef(telemetry.rpm);
    useEffect(() => {
        if (telemetry.rpm >= 4200 && prevRpm.current < 4200) {
            hapticShiftAlert();
        }
        prevRpm.current = telemetry.rpm;
    }, [telemetry.rpm]);

    const {
        speed,
        rpm,
        gear,
        throttle,
        boost,
        coolantTemp,
        oilTemp,
        batteryVoltage,
        batterySoH,
        fuelLevel,
        fuelRate,
        fuelBurnedLiters,
        criticalAlerts,
        minRulKm,
        isConnected,
    } = telemetry;

    // Ceas quartz anii '90
    const [currentTime, setCurrentTime] = useState('14:38');
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            setCurrentTime(`${h}:${m}`);
        };
        updateClock();
        const interval = setInterval(updateClock, 10000);
        return () => clearInterval(interval);
    }, []);

    // ─── 4. Mechanical Drum Odometer Physics with Roll Rollover ────────────────
    const totalKm = 348912;
    const currentTripKm = Number((tripKmOffset + (speed > 0 ? 0.1 : 0)).toFixed(1));

    // ─── 7. Bordcomputer DTE (Reichweite) with Historic VDO 2-Stage Averaging ──
    const dteKm = useMemo(() => {
        // Weighted average: 70% short term, 30% long term
        const effectiveRate = fuelRate > 0 ? fuelRate * 0.7 + 6.2 * 0.3 : 6.5;
        const availableLiters = (fuelLevel / 100) * 70; // 70-liter Audi C4 fuel tank
        return Math.round((availableLiters / effectiveRate) * 100);
    }, [fuelLevel, fuelRate]);

    const bcModes = [
        { label: 'MOMENTANVERBRAUCH', value: `${fuelRate}`, unit: 'L/100KM' },
        { label: 'DURCHSCHNITTSVERBR.', value: '6.4', unit: 'L/100KM' },
        { label: 'REICHWEITE (DTE)', value: `${dteKm}`, unit: 'KM' },
        { label: 'FAHRZEIT // REISEZEIT', value: '01:42', unit: 'H:M' },
        { label: 'AUSSENTEMPERATUR', value: `+${ambientTemp}`, unit: '°C' },
    ];
    const currentBc = bcModes[bcModeIndex % bcModes.length];

    // ─── 5. Planckian Color Temperature Shift & Sub-Accents (AMBER/RED/GREEN) ──
    const clusterAccentColor = retroAccentMode === 'AMBER'
        ? (dimmerLevel === 1.0 ? '#FF6600' : '#CC3300')
        : retroAccentMode === 'RED'
        ? (dimmerLevel === 1.0 ? '#FF2200' : '#AA1100')
        : (dimmerLevel === 1.0 ? '#00FF66' : '#00AA44');
    const clusterDimColor = dimmerLevel === 1.0 ? '#882200' : '#551100';

    const safeTop = typeof insets?.top === 'number' && !isNaN(insets.top) ? Math.max(insets.top, 24) : 24;
    const safeBottom = typeof insets?.bottom === 'number' && !isNaN(insets.bottom) ? Math.max(insets.bottom, 12) : 12;

    return (
        <View style={[
            styles.container,
            { paddingTop: safeTop, paddingBottom: safeBottom },
        ]}>
            <StatusBar barStyle="light-content" backgroundColor="#050200" translucent />

            {/* ── 1. Top Bar Audi VDO & Rheostat ── */}
            <View style={styles.topBar}>
                <View style={styles.audiBadgeRow}>
                    <Text style={[styles.audiRingsText, { color: clusterAccentColor, opacity: dimmerLevel }]}>OOOO</Text>
                    <Text style={[styles.clusterTitle, { color: clusterAccentColor, opacity: dimmerLevel }]} numberOfLines={1}>
                        DIGIFIZ
                    </Text>
                </View>

                {/* Acțiuni & Rheostat */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.stylePickerButton, { backgroundColor: clusterAccentColor }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.stylePickerText}>🎨 STIL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.v2Button}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.v2ButtonText}>⮌ V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: clusterAccentColor, backgroundColor: '#FF880018' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: clusterAccentColor }]}>🎮</Text>
                    </TouchableOpacity>

                    {/* 5. Dimmer Tag/Nacht Rheostat */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: clusterAccentColor }]}
                        onPress={() => {
                            hapticTap();
                            setDimmerLevel(dimmerLevel === 1.0 ? 0.6 : 1.0);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: clusterAccentColor }]}>
                            {dimmerLevel === 1.0 ? '☀️' : '🌙'}
                        </Text>
                    </TouchableOpacity>

                    {/* Sub-Accent Switcher (AMBER / RED / GREEN) */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: clusterAccentColor, backgroundColor: `${clusterAccentColor}18` }]}
                        onPress={() => {
                            hapticTap();
                            setRetroAccentMode(prev => prev === 'AMBER' ? 'RED' : prev === 'RED' ? 'GREEN' : 'AMBER');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: clusterAccentColor }]}>
                            {retroAccentMode === 'AMBER' ? '🟧' : retroAccentMode === 'RED' ? '🟥' : '🟩'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 6 TASTE BASCULANTE AUDI C4 (1..6) ── */}
            <View style={styles.rockerSwitchBankWrapper}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rockerSwitchBankContent}
                >
                    {[
                        { id: '1', label: '1 DIGIFIZ', sub: 'KOMBI' },
                        { id: '2', label: '2 VAG 1551', sub: 'SCANNER' },
                        { id: '3', label: '3 FAHRTENBUCH', sub: 'REPLAY' },
                        { id: '4', label: '4 SERVICEHEFT', sub: 'INSPEKT' },
                        { id: '5', label: '5 SAFE-LOCK', sub: 'PROCON' },
                        { id: '6', label: '6 MEISTER AI', sub: 'EXPERT' },
                    ].map((sw) => {
                        const isActive = activeSwitch === sw.id;
                        return (
                            <TouchableOpacity
                                key={sw.id}
                                style={[
                                    styles.rockerSwitchBtn,
                                    isActive && { backgroundColor: '#1A0803', borderColor: clusterAccentColor }
                                ]}
                                onPress={() => {
                                    audioGong.playGong('autocheck');
                                    hapticTap();
                                    setActiveSwitch(sw.id);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    styles.rockerIndicatorSlit,
                                    { backgroundColor: isActive ? clusterAccentColor : '#3D150A' }
                                ]} />
                                <Text style={[
                                    styles.rockerSwitchText,
                                    { color: isActive ? clusterAccentColor : '#AA5522' }
                                ]}>
                                    {sw.label}
                                </Text>
                                <Text style={[
                                    styles.rockerSwitchSub,
                                    { color: isActive ? '#FFAA44' : '#662208' }
                                ]}>
                                    {sw.sub}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── 2. Panoul Central VFD Cluster & Module Rocker ── */}
            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={[styles.mainScrollContent, { transform: [{ translateY: idleJitterY }] }]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── 1 DIGIFIZ: KOMBIINSTRUMENT ── */}
                {activeSwitch === '1' && (
                    <View>
                        {/* 2.1 Turometru VFD Stepped (Bitmask Vector + Phosphor Decay) */}
                        <AudiTachometerBargraph
                            rpm={rpm}
                            maxRpm={6000}
                            brightness={dimmerLevel}
                            phosphorTrailRpm={phosphorTrailRpm}
                        />

                        {/* 2.2 Vitezometru Monumental VFD & Autocheck */}
                        <View style={styles.speedClusterFrame}>
                            {/* Buton fizic stânga: Reset Trip */}
                            <TouchableOpacity
                                style={styles.pushPinLeft}
                                onPress={() => {
                                    hapticTap();
                                    setTripKmOffset(0.0);
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <View style={styles.pushPinHead} />
                                <Text style={styles.pushPinText}>RESET</Text>
                            </TouchableOpacity>

                            {/* Vitezometru Central */}
                            <View style={styles.speedDisplayCenter}>
                                <Text style={[styles.speedGhost, { opacity: 0.07 }]}>888</Text>
                                <Text style={[styles.speedVfdText, { color: clusterAccentColor, opacity: dimmerLevel }]}>
                                    {speed}
                                </Text>
                                <Text style={[styles.speedUnitVfd, { opacity: dimmerLevel }]}>km/h</Text>
                            </View>

                            {/* Buton fizic dreapta: Switch Mode */}
                            <TouchableOpacity
                                style={styles.pushPinRight}
                                onPress={() => {
                                    hapticTap();
                                    setBcModeIndex(prev => prev + 1);
                                }}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <View style={styles.pushPinHead} />
                                <Text style={styles.pushPinText}>MODE</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 2.3 4. Odometru Mecanic cu Tamburi & Ceas Quartz */}
                        <View style={styles.odometerFrame}>
                            <View style={styles.odometerRow}>
                                <Text style={styles.odoLabel}>GESAMT-KM:</Text>
                                <View style={styles.drumRollBox}>
                                    <Text style={styles.drumRollText}>{totalKm}</Text>
                                </View>
                                <Text style={styles.odoLabel}>TRIP:</Text>
                                <View style={styles.drumRollBox}>
                                    <Text style={[styles.drumRollText, { color: '#FFAA00' }]}>{currentTripKm}</Text>
                                </View>
                            </View>

                            {/* Ceas Quartz & 10. Frost Chime Indicator */}
                            <View style={styles.clockRow}>
                                <Text style={styles.quartzClockText}>ZEIT: {currentTime}</Text>
                                <View style={styles.tempIceRow}>
                                    {ambientTemp <= 4.0 && <Text style={styles.iceFlakeIcon}>❄️</Text>}
                                    <Text style={[styles.tempIceText, ambientTemp <= 4.0 && { color: '#00F0FF' }]}>
                                        AUSSEN: +{ambientTemp}°C
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* 2.4 3. Audi Autocheck System Screen */}
                        <TouchableOpacity
                            style={styles.autocheckScreen}
                            onPress={() => {
                                hapticTap();
                                runAutocheckCycle();
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.autocheckHeader}>
                                <Text style={styles.autocheckTitle}>AUTOCHECK SYSTEM // GERÄTEPRÜFUNG</Text>
                                <Text style={[
                                    styles.autocheckBadge,
                                    autocheckState === 'OK' ? { color: '#00FF66' } : { color: '#FF3300' }
                                ]}>
                                    [ {autocheckState} ]
                                </Text>
                            </View>
                            <Text style={styles.autocheckSub}>
                                {autocheckState === 'OK'
                                    ? 'BREMSLICHT / KÜHLMITTEL / ÖLDRUCK: IN ORDNUNG'
                                    : `SYSTEMTEST LAUFEND: ${autocheckState} WIRD GEPRÜFT... (TAP FÜR NEUSTART)`}
                            </Text>
                        </TouchableOpacity>

                        {/* 2.5 Coloane Verticale LED VFD (cu 6. Overboost Peak-Hold) */}
                        <View style={styles.columnsRow}>
                            <VerticalLedColumn
                                label="KÜHLMITTEL"
                                value={coolantTemp}
                                unit="°C"
                                min={50}
                                max={120}
                                warnThreshold={100}
                                critThreshold={108}
                                color={clusterAccentColor}
                                brightness={dimmerLevel}
                            />
                            <VerticalLedColumn
                                label="ÖL-TEMP"
                                value={oilTemp}
                                unit="°C"
                                min={50}
                                max={150}
                                warnThreshold={125}
                                critThreshold={138}
                                color={clusterAccentColor}
                                brightness={dimmerLevel}
                            />
                            <VerticalLedColumn
                                label="LADEDRUCK"
                                value={boost}
                                unit="bar"
                                min={0}
                                max={2.5}
                                warnThreshold={1.8}
                                critThreshold={2.2}
                                color={clusterAccentColor}
                                brightness={dimmerLevel}
                                peakHold={peakBoostHold}
                            />
                            <VerticalLedColumn
                                label="KRAFTSTOFF"
                                value={fuelLevel}
                                unit="%"
                                min={0}
                                max={100}
                                warnThreshold={15}
                                critThreshold={8}
                                color="#00FF66"
                                brightness={dimmerLevel}
                            />
                        </View>

                        {/* 2.6 Bordcomputer Segment Box */}
                        <TouchableOpacity
                            style={styles.bordcomputerBox}
                            onPress={() => {
                                hapticTap();
                                setBcModeIndex(prev => prev + 1);
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.bcHeader}>
                                <Text style={styles.bcLabel}>BORDCOMPUTER // {currentBc.label}</Text>
                                <Text style={styles.bcHint}>[ TAP FÜR WEITER ]</Text>
                            </View>
                            <View style={styles.bcValueRow}>
                                <Text style={[styles.bcValue, { color: clusterAccentColor }]}>{currentBc.value}</Text>
                                <Text style={styles.bcUnit}>{currentBc.unit}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── 2 VAG 1551: DIAGNOSE & 32 MESSWERTBLÖCKE ── */}
                {activeSwitch === '2' && (
                    <View style={styles.vagStationContainer}>
                        {/* Casetă VAG 1551 de atelier */}
                        <View style={styles.vagStationCasing}>
                            <View style={styles.vagStationLcdFrame}>
                                <View style={styles.vagStationLcdHeader}>
                                    <Text style={styles.vagStationLcdBrand}>VAG 1551 SYSTEM-TESTER // V3.21</Text>
                                    <Text style={styles.vagStationLcdBaud}>10400 BAUD · K-LINE</Text>
                                </View>
                                <Text style={styles.vagStationLcdLine1}>
                                    KANAL: {selectedMwbGroup.toUpperCase()} // MWB PRÜFUNG AKTIV
                                </Text>
                                <Text style={styles.vagStationLcdLine2}>
                                    BOSCH MOTRONIC 2.3.2 // STATUS: KOMMUNIKATION OK
                                </Text>
                            </View>

                            {/* Selector Blocuri de Măsură MWB */}
                            <View style={styles.mwbSelectorRow}>
                                {[
                                    { id: 'engine', label: '001-007 MOTOR' },
                                    { id: 'turbo', label: '008-012 TURBO' },
                                    { id: 'thermal', label: '013-017 THERMIK' },
                                    { id: 'emissions', label: '018-020 DPF' },
                                    { id: 'electrical', label: '021-024 ELEKTRIK' },
                                    { id: 'safety', label: '025-032 FAHRWERK' },
                                ].map((grp) => (
                                    <TouchableOpacity
                                        key={grp.id}
                                        style={[
                                            styles.mwbBtn,
                                            selectedMwbGroup === grp.id && styles.mwbBtnActive
                                        ]}
                                        onPress={() => {
                                            hapticTap();
                                            setSelectedMwbGroup(grp.id);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    >
                                        <Text style={[
                                            styles.mwbBtnText,
                                            selectedMwbGroup === grp.id && styles.mwbBtnTextActive
                                        ]}>
                                            {grp.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Listă Observatori Fizici VAG */}
                        <Text style={styles.vagSectionHeader}>MESSWERTBLÖCKE // ISTWERT VS. SOLLWERT:</Text>
                        {(core.virtualSensors[selectedMwbGroup] || []).map((s) => (
                            <View key={s.id} style={styles.vagMwbCard}>
                                <View style={styles.vagMwbHeaderRow}>
                                    <Text style={styles.vagMwbLabel}>{s.label.toUpperCase()}</Text>
                                    <View style={[
                                        styles.vagMwbBadge,
                                        { borderColor: s.status === 'OK' ? '#00FF66' : '#FF3300' }
                                    ]}>
                                        <Text style={[
                                            styles.vagMwbBadgeText,
                                            { color: s.status === 'OK' ? '#00FF66' : '#FF3300' }
                                        ]}>
                                            {s.status === 'OK' ? 'IN ORDNUNG' : 'WARNUNG'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.vagMwbValuesRow}>
                                    <Text style={styles.vagMwbIstwert}>
                                        ISTWERT: <Text style={{ color: '#00FF66', fontWeight: '900' }}>{s.val}</Text>
                                    </Text>
                                    <Text style={styles.vagMwbSollwert}>
                                        SOLLWERT: {s.target}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── 3 FAHRTENBUCH: JURNAL & REPLAY CASSETE AUDI GAMMA ── */}
                {activeSwitch === '3' && (
                    <View style={styles.fahrtenbuchContainer}>
                        {/* Audi Gamma CC Cassette Deck */}
                        <View style={styles.cassetteDeckFrame}>
                            <View style={styles.cassetteDeckHeader}>
                                <Text style={styles.cassetteBrand}>AUDI GAMMA CC // DOLBY B-C NR</Text>
                                <View style={styles.tapeCounterBox}>
                                    <Text style={styles.tapeCounterDigits}>
                                        {String(core.currentReplaySample.progressPct).padStart(3, '0')}
                                    </Text>
                                </View>
                            </View>

                            {/* Cassette Well Graphic */}
                            <View style={styles.cassetteWell}>
                                <View style={styles.spoolLeft}>
                                    <View style={[styles.spoolTeeth, core.isReplaying && styles.spoolRotating]} />
                                </View>
                                <View style={styles.tapeWindow}>
                                    <Text style={styles.tapeLabel}>TAPE 1: FAHRT-REPLAY</Text>
                                    <View style={styles.tapeBar}>
                                        <View style={[styles.tapeFill, { width: `${core.currentReplaySample.progressPct}%` }]} />
                                    </View>
                                </View>
                                <View style={styles.spoolRight}>
                                    <View style={[styles.spoolTeeth, core.isReplaying && styles.spoolRotating]} />
                                </View>
                            </View>

                            {/* Replay VFD Stats */}
                            <View style={styles.cassetteVfdReadout}>
                                <Text style={styles.cassetteVfdText}>
                                    V: {core.currentReplaySample.speed} km/h | RPM: {core.currentReplaySample.rpm} | BST: {core.currentReplaySample.boost} bar | G: {core.currentReplaySample.gear}
                                </Text>
                            </View>

                            {/* Cassette Mechanical Keys */}
                            <View style={styles.cassetteKeysRow}>
                                <TouchableOpacity
                                    style={styles.cassetteKey}
                                    onPress={() => core.seekReplay(0)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.cassetteKeyText}>⏮ RÜCK</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cassetteKey, core.isReplaying && styles.cassetteKeyActive]}
                                    onPress={core.togglePlayPause}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.cassetteKeyText, core.isReplaying && { color: '#00FF66' }]}>
                                        {core.isReplaying ? '⏸ PAUSE' : '▶ WIEDERGABE'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.cassetteKey}
                                    onPress={core.cycleReplaySpeed}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.cassetteKeyText}>{core.replaySpeed}X TEMPO</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Export Buttons */}
                            <View style={[styles.cassetteKeysRow, { marginTop: 8 }]}>
                                <TouchableOpacity
                                    style={[styles.cassetteKey, { flex: 1 }]}
                                    onPress={() => core.exportTripPdf(core.selectedTripId)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.cassetteKeyText}>🖨️ DRUCKEN (PDF)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.cassetteKey, { flex: 1, borderColor: '#FFAA00' }]}
                                    onPress={core.exportItpDossier}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.cassetteKeyText, { color: '#FFAA00' }]}>📑 TÜV / ITP DOSAR</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Fahrtenbuch Liste */}
                        <Text style={styles.vagSectionHeader}>FAHRTENBUCH // VERZEICHNIS DER FAHRTEN:</Text>
                        {core.tripsList.map((t) => {
                            const isSelected = t.id === core.selectedTripId;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        styles.fahrtenbuchCard,
                                        isSelected && { borderColor: '#FFAA00', backgroundColor: '#1A0C06' }
                                    ]}
                                    onPress={() => {
                                        hapticTap();
                                        core.setSelectedTripId(t.id);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.fahrtenbuchHeader}>
                                        <Text style={styles.fahrtenbuchTitle}>{t.title}</Text>
                                        <Text style={styles.fahrtenbuchDate}>{t.date}</Text>
                                    </View>
                                    <View style={styles.fahrtenbuchStats}>
                                        <Text style={styles.fahrtenStat}>DISTANZ: {t.km} km</Text>
                                        <Text style={styles.fahrtenStat}>VMAX: {t.maxSpeed} km/h</Text>
                                        <Text style={styles.fahrtenStat}>VERBRAUCH: {t.avgConsumption} L/100</Text>
                                        <Text style={[styles.fahrtenStat, { color: '#00FF66' }]}>GESUNDHEIT: {t.healthScore}%</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* ── 4 SERVICEHEFT: CBM INSPEKTION & KRAFTFAHRZEUG-PAPIERE ── */}
                {activeSwitch === '4' && (
                    <View style={styles.serviceheftContainer}>
                        <Text style={styles.vagSectionHeader}>AUDI SERVICEHEFT // ZUSTANDSBASIERTE WARTUNG (CBM):</Text>
                        {core.maintenanceItems.map((item) => (
                            <View key={item.id} style={styles.serviceheftCard}>
                                <View style={styles.serviceheftHeaderRow}>
                                    <Text style={styles.serviceheftName}>{String(item.name || item.title || item.id || '').toUpperCase()}</Text>
                                    <Text style={[styles.serviceheftWear, item.status === 'URGENT' && { color: '#FF3300' }]}>
                                        VERSCHLEISS: {item.wearPct}%
                                    </Text>
                                </View>
                                <View style={styles.serviceheftBarBg}>
                                    <View style={[
                                        styles.serviceheftBarFill,
                                        { width: `${Math.min(100, item.wearPct)}%`, backgroundColor: item.status === 'URGENT' ? '#FF3300' : '#FFAA00' }
                                    ]} />
                                </View>
                                <View style={styles.serviceheftFooter}>
                                    <Text style={styles.serviceheftKm}>
                                        Restlaufstrecke: {item.remainingKm ?? (item.maxKm ? Math.max(0, item.maxKm - item.currentKm) : 3400)} km / {item.totalKm ?? item.maxKm ?? 15000} km
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.werkstattResetBtn}
                                        onPress={() => core.markServiceItemCompleted(item.id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={styles.werkstattResetBtnText}>[ WERKSTATT-RESET ]</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <Text style={[styles.vagSectionHeader, { marginTop: 16 }]}>KRAFTFAHRZEUG-PAPIERE // DOKUMENTE:</Text>
                        {core.legalDocuments.map((doc) => (
                            <View key={doc.id} style={styles.papiereCard}>
                                <View style={styles.papiereHeader}>
                                    <Text style={styles.papiereName}>{doc.name}</Text>
                                    <View style={[styles.papiereBadge, { borderColor: doc.status === 'VALABIL' ? '#00FF66' : '#FF3300' }]}>
                                        <Text style={[styles.papiereBadgeText, { color: doc.status === 'VALABIL' ? '#00FF66' : '#FF3300' }]}>
                                            {doc.status === 'VALABIL' ? 'GÜLTIG' : 'FÄLLIG'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.papiereIssuer}>Aussteller: {doc.issuer}</Text>
                                <View style={styles.papiereFooter}>
                                    <Text style={styles.papiereDate}>Ablauf: {doc.expiryDate}</Text>
                                    <Text style={[styles.papiereDays, { color: doc.daysLeft < 45 ? '#FF3300' : '#FFAA00' }]}>
                                        {doc.daysLeft} TAGE VERBLEIBEND
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── 5 SAFE-LOCK: PROCON-TEN & STANDHEIZUNG ── */}
                {activeSwitch === '5' && (
                    <View style={styles.safeLockContainer}>
                        {/* Safe-Lock Modul */}
                        <View style={styles.safeLockCard}>
                            <View style={styles.safeLockHeader}>
                                <View>
                                    <Text style={styles.safeLockTitle}>AUDI PROCON-TEN // DIEBSTAHLWARN</Text>
                                    <Text style={[styles.safeLockStatus, { color: core.sentryArmed ? '#00FF66' : '#FF3300' }]}>
                                        {core.sentryArmed ? '● GESICHERT // SAFE-LOCK AKTIV' : '○ ENTSICHERT'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.safeLockToggle, { borderColor: '#FFAA00' }]}
                                    onPress={() => {
                                        hapticTap();
                                        core.setSentryArmed(!core.sentryArmed);
                                    }}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.safeLockToggleText}>
                                        {core.sentryArmed ? 'ENTRIEGELN' : 'VERRIEGELN'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.erschutterungBtn}
                                onPress={core.triggerShockSimulation}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.erschutterungBtnText}>
                                    ⚡ ERSCHÜTTERUNGSSENSOR SIMULIEREN
                                </Text>
                            </TouchableOpacity>

                            <Text style={styles.ereignisseHeader}>EREIGNISPROTOKOLL (ALARM-LOG):</Text>
                            {core.sentryEvents.map((ev) => (
                                <View key={ev.id} style={styles.ereignisRow}>
                                    <Text style={styles.ereignisTime}>[{ev.time}]</Text>
                                    <Text style={[styles.ereignisDesc, ev.severity === 'crit' && { color: '#FF3300' }]}>
                                        {ev.type}: {ev.desc}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        {/* Standheizung & Parkuhr */}
                        <View style={[styles.safeLockCard, { marginTop: 12 }]}>
                            <Text style={styles.safeLockTitle}>PARKUHR & STANDORT (VDO QUARTZ)</Text>
                            <Text style={styles.standortText}>
                                KOORDINATEN: {core.carGpsCoords.lat} N, {core.carGpsCoords.lon} E
                            </Text>
                            <TouchableOpacity
                                style={styles.mapsRetroBtn}
                                onPress={core.openWalkingDirections}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.mapsRetroBtnText}>
                                    🧭 ZU DEM FAHRZEUG (GOOGLE MAPS)
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.parkuhrFrame}>
                                <Text style={styles.parkuhrLabel}>VERBLEIBENDE PARKZEIT:</Text>
                                <Text style={styles.parkuhrTimer}>{core.parkingMinutesRemaining} MINUTEN</Text>
                                <View style={styles.parkuhrBtnRow}>
                                    {[15, 30, 60].map((m) => (
                                        <TouchableOpacity
                                            key={m}
                                            style={styles.parkuhrBtn}
                                            onPress={() => core.addParkingTime(m)}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <Text style={styles.parkuhrBtnText}>+{m}m</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Valet & Notruf 112 */}
                        <View style={[styles.safeLockCard, { marginTop: 12 }]}>
                            <View style={styles.safeLockHeader}>
                                <View>
                                    <Text style={styles.safeLockTitle}>VALET MODUS (70 KM/H LIMIT)</Text>
                                    <Text style={[styles.safeLockStatus, { color: core.valetActive ? '#FFAA00' : '#884422' }]}>
                                        {core.valetActive ? 'AKTIV // BEGRENZUNG WIRKSAM' : 'INAKTIV'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.safeLockToggle, { borderColor: '#884422' }]}
                                    onPress={core.toggleValetMode}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.safeLockToggleText}>
                                        {core.valetActive ? 'AUS' : 'EIN'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.notrufBtn}
                                onPress={core.triggerEcallTest}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.notrufBtnText}>📡 NOTRUF 112 // eCALL SIMULATION</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── 6 MEISTER AI: VAG SERVICE MEISTER INGOLSTADT ── */}
                {activeSwitch === '6' && (
                    <View style={styles.meisterContainer}>
                        <Text style={styles.vagSectionHeader}>
                            VAG SERVICE MEISTER // AUDI AG INGOLSTADT EXPERTE:
                        </Text>

                        {/* Quick Prompt Chips */}
                        <View style={styles.meisterChipsRow}>
                            {[
                                '? INSPEKTION TURBO',
                                '? DIAGNOSE ÖL',
                                '? BREMSEN STATUS',
                                '? FEHLERCODE SCANNEN',
                            ].map((chip) => (
                                <TouchableOpacity
                                    key={chip}
                                    style={styles.meisterChip}
                                    onPress={() => core.sendAiPrompt(chip)}
                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                >
                                    <Text style={styles.meisterChipText}>{chip}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Dialogue feed */}
                        <View style={styles.meisterTerminalFrame}>
                            <View style={styles.meisterTerminalHeader}>
                                <View style={[styles.meisterDot, { backgroundColor: core.isAiLoading ? '#FFAA00' : '#00FF66' }]} />
                                <Text style={styles.meisterTerminalTitle}>
                                    AUDI VAG SERVICE MEISTER {core.isAiLoading ? '· ANALYSIERT...' : '· BEREIT'}
                                </Text>
                            </View>

                            {core.aiMessages.map((m) => (
                                <View key={m.id} style={styles.meisterMsgRow}>
                                    <Text style={[styles.meisterSender, { color: m.sender === 'ai' ? '#FF8800' : '#00FF66' }]}>
                                        {m.sender === 'ai' ? '▶ MEISTER INGOLSTADT:' : '▶ FAHRER:'}
                                    </Text>
                                    <Text style={styles.meisterMsgText}>{m.text}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Input Row */}
                        <View style={styles.meisterInputRow}>
                            <TextInput
                                style={styles.meisterTextInput}
                                placeholder="Fehlercode oder Frage eingeben..."
                                placeholderTextColor="#663300"
                                value={meisterPromptInput}
                                onChangeText={setMeisterPromptInput}
                                onSubmitEditing={() => {
                                    if (meisterPromptInput.trim()) {
                                        core.sendAiPrompt(meisterPromptInput);
                                        setMeisterPromptInput('');
                                    }
                                }}
                            />
                            <TouchableOpacity
                                style={styles.meisterSendBtn}
                                onPress={() => {
                                    if (meisterPromptInput.trim()) {
                                        core.sendAiPrompt(meisterPromptInput);
                                        setMeisterPromptInput('');
                                    }
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={styles.meisterSendBtnText}>SENDEN</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── 9. Modal Diagnoză VAG 1551 / 1552 Heritage Scan Tool ── */}
            <Modal
                visible={showVagTester}
                transparent
                animationType="slide"
                onRequestClose={() => setShowVagTester(false)}
            >
                <View style={styles.vagModalBackdrop}>
                    <View style={styles.vagDeviceHousing}>
                        <View style={styles.vagScreenFrame}>
                            <View style={styles.vagLcdHeader}>
                                <Text style={styles.vagLcdTitle}>VAG 1551 SYSTEM-TESTER</Text>
                                <Text style={styles.vagLcdVer}>V3.21 K-LINE</Text>
                            </View>
                            <Text style={styles.vagLcdLine1}>
                                KANAL {vagChannel}: {vagChannel === '001' ? 'DREHZAHL // ZÜNDUNG' : 'LADEDRUCK // N75'}
                            </Text>
                            <Text style={styles.vagLcdLine2}>
                                {vagChannel === '001'
                                    ? `RPM: ${rpm} | V: ${speed} km/h | T: ${coolantTemp}°C`
                                    : `MAP: ${boost} bar | N75: 78.4% | EGT: 640°C`}
                            </Text>
                        </View>

                        <View style={styles.vagKeypadRow}>
                            {['001', '011', '008', '002'].map((ch) => (
                                <TouchableOpacity
                                    key={ch}
                                    style={[styles.vagKey, vagChannel === ch && styles.vagKeyActive]}
                                    onPress={() => {
                                        hapticTap();
                                        setVagChannel(ch);
                                    }}
                                >
                                    <Text style={styles.vagKeyText}>CH {ch}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.vagCloseBtn}
                            onPress={() => {
                                hapticTap();
                                setShowVagTester(false);
                            }}
                        >
                            <Text style={styles.vagCloseText}>SCHLIEßEN // CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050200',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#260B05',
    },
    audiBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        flexShrink: 1,
    },
    audiRingsText: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
    },
    clusterTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    v2Button: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#4A180C',
        backgroundColor: '#120502',
    },
    v2ButtonText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA44',
        fontWeight: '700',
    },
    stylePickerButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    stylePickerText: {
        fontFamily: RETRO_FONT,
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
    tachoWrapper: {
        backgroundColor: '#0F0401',
        padding: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3D1308',
        marginBottom: 16,
    },
    tachoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    tachoLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FF6600',
        letterSpacing: 1,
    },
    tachoValue: {
        fontFamily: RETRO_FONT,
        fontSize: 14,
        color: '#FFAA00',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    tachoUnit: {
        fontSize: 9,
        color: '#884422',
    },
    speedClusterFrame: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0A0301',
        paddingVertical: 18,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#4A1608',
        marginBottom: 16,
    },
    pushPinLeft: {
        alignItems: 'center',
        padding: 6,
    },
    pushPinRight: {
        alignItems: 'center',
        padding: 6,
    },
    pushPinHead: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#2A0E08',
        borderWidth: 1.5,
        borderColor: '#6E2412',
        marginBottom: 4,
    },
    pushPinText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
        fontWeight: '700',
    },
    speedDisplayCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: 180,
        height: 100,
    },
    speedGhost: {
        position: 'absolute',
        fontFamily: RETRO_FONT,
        fontSize: 84,
        color: '#FF8800',
        letterSpacing: -2,
    },
    speedVfdText: {
        fontFamily: RETRO_FONT,
        fontSize: 84,
        fontWeight: '900',
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
    },
    speedUnitVfd: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        color: '#884422',
        fontWeight: '700',
        marginTop: -6,
    },
    odometerFrame: {
        backgroundColor: '#0F0401',
        padding: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3D1308',
        marginBottom: 16,
    },
    odometerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    odoLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884422',
        letterSpacing: 1,
    },
    drumRollBox: {
        backgroundColor: '#000000',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#333333',
    },
    drumRollText: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 1.5,
        fontVariant: ['tabular-nums'],
    },
    clockRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#260B05',
        paddingTop: 8,
    },
    quartzClockText: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#FF8800',
        fontVariant: ['tabular-nums'],
    },
    tempIceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iceFlakeIcon: {
        fontSize: 11,
    },
    tempIceText: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#FFAA00',
        fontVariant: ['tabular-nums'],
    },
    autocheckScreen: {
        backgroundColor: '#120402',
        padding: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#4A1608',
        marginBottom: 16,
    },
    autocheckHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    autocheckTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884422',
        letterSpacing: 1,
    },
    autocheckBadge: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        fontWeight: '900',
    },
    autocheckSub: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#AA5522',
        marginTop: 2,
    },
    columnsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    verticalCol: {
        alignItems: 'center',
        width: (SCREEN_WIDTH - 56) / 4,
        backgroundColor: '#0F0401',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3D1308',
    },
    verticalColLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FF8800',
        marginBottom: 6,
    },
    verticalBarFrame: {
        width: 14,
        height: 90,
        justifyContent: 'space-between',
        paddingVertical: 2,
        backgroundColor: '#050200',
        borderRadius: 2,
        borderWidth: 0.5,
        borderColor: '#260B05',
        marginBottom: 6,
    },
    verticalSegment: {
        width: 10,
        height: 6,
        alignSelf: 'center',
        borderRadius: 1,
        borderWidth: 0.5,
    },
    verticalColValue: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#FFAA00',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    verticalColUnit: {
        fontSize: 8,
        color: '#884422',
    },
    bordcomputerBox: {
        backgroundColor: '#0F0401',
        padding: 14,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3D1308',
    },
    bcHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    bcLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884422',
        letterSpacing: 1,
    },
    bcHint: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#552211',
    },
    bcValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    bcValue: {
        fontFamily: RETRO_FONT,
        fontSize: 24,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    bcUnit: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#884422',
    },
    // VAG 1551 Modal Styles
    vagModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    vagDeviceHousing: {
        width: '100%',
        backgroundColor: '#1E242B',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#34495E',
        padding: 16,
    },
    vagScreenFrame: {
        backgroundColor: '#002B49',
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#00558F',
        padding: 12,
        marginBottom: 16,
    },
    vagLcdHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#00558F',
        paddingBottom: 4,
        marginBottom: 8,
    },
    vagLcdTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#00F0FF',
        fontWeight: '900',
    },
    vagLcdVer: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#00A8FF',
    },
    vagLcdLine1: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: '700',
        marginBottom: 4,
    },
    vagLcdLine2: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#70D6FF',
    },
    vagKeypadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    vagKey: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#2C3E50',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#4A6572',
    },
    vagKeyActive: {
        backgroundColor: '#00A8FF',
        borderColor: '#00F0FF',
    },
    vagKeyText: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    vagCloseBtn: {
        backgroundColor: '#C0392B',
        paddingVertical: 10,
        borderRadius: 4,
        alignItems: 'center',
    },
    vagCloseText: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '800',
    },

    // ── 6 Taste Basculante & Module Stilizate ──
    rockerSwitchBankWrapper: {
        backgroundColor: '#0F0502',
        borderBottomWidth: 1,
        borderBottomColor: '#260B05',
    },
    rockerSwitchBankContent: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    rockerSwitchBtn: {
        backgroundColor: '#120603',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'center',
        minWidth: 84,
    },
    rockerIndicatorSlit: {
        width: 14,
        height: 3,
        borderRadius: 1,
        marginBottom: 4,
    },
    rockerSwitchText: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        fontWeight: '900',
    },
    rockerSwitchSub: {
        fontFamily: RETRO_FONT,
        fontSize: 7,
        marginTop: 2,
    },
    vagStationContainer: {
        marginBottom: 16,
    },
    vagStationCasing: {
        backgroundColor: '#1C2833',
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#2E4053',
        padding: 12,
        marginBottom: 12,
    },
    vagStationLcdFrame: {
        backgroundColor: '#0A1820',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#00558F',
        padding: 10,
        marginBottom: 10,
    },
    vagStationLcdHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#00558F',
        paddingBottom: 4,
        marginBottom: 6,
    },
    vagStationLcdBrand: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#00FF66',
        fontWeight: '900',
    },
    vagStationLcdBaud: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#00A8FF',
    },
    vagStationLcdLine1: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#00FF66',
        fontWeight: '700',
    },
    vagStationLcdLine2: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#70D6FF',
        marginTop: 2,
    },
    mwbSelectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    mwbBtn: {
        backgroundColor: '#273746',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#34495E',
    },
    mwbBtnActive: {
        backgroundColor: '#00A8FF',
        borderColor: '#00F0FF',
    },
    mwbBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#BDC3C7',
        fontWeight: '700',
    },
    mwbBtnTextActive: {
        color: '#000000',
        fontWeight: '900',
    },
    vagSectionHeader: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA00',
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    vagMwbCard: {
        backgroundColor: '#120603',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        padding: 10,
        marginBottom: 6,
    },
    vagMwbHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    vagMwbLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFAA44',
        fontWeight: '700',
        flex: 1,
    },
    vagMwbBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
        borderWidth: 1,
    },
    vagMwbBadgeText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    vagMwbValuesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    vagMwbIstwert: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFFFFF',
    },
    vagMwbSollwert: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884422',
    },
    fahrtenbuchContainer: {
        marginBottom: 16,
    },
    cassetteDeckFrame: {
        backgroundColor: '#140804',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3D150A',
        padding: 12,
        marginBottom: 12,
    },
    cassetteDeckHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cassetteBrand: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFAA00',
        fontWeight: '800',
    },
    tapeCounterBox: {
        backgroundColor: '#050200',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 2,
        borderWidth: 1,
        borderColor: '#3D150A',
    },
    tapeCounterDigits: {
        fontFamily: RETRO_FONT,
        fontSize: 11,
        color: '#00FF66',
        fontWeight: '900',
        letterSpacing: 2,
    },
    cassetteWell: {
        backgroundColor: '#080302',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        marginBottom: 8,
    },
    spoolLeft: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1E0C06',
        borderWidth: 2,
        borderColor: '#551C0C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    spoolRight: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1E0C06',
        borderWidth: 2,
        borderColor: '#551C0C',
        justifyContent: 'center',
        alignItems: 'center',
    },
    spoolTeeth: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FFAA00',
    },
    spoolRotating: {
        backgroundColor: '#00FF66',
    },
    tapeWindow: {
        flex: 1,
        paddingHorizontal: 12,
    },
    tapeLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA44',
        marginBottom: 4,
        textAlign: 'center',
    },
    tapeBar: {
        height: 4,
        backgroundColor: '#260B05',
        borderRadius: 2,
        overflow: 'hidden',
    },
    tapeFill: {
        height: '100%',
        backgroundColor: '#FFAA00',
    },
    cassetteVfdReadout: {
        backgroundColor: '#050200',
        padding: 6,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#260B05',
        marginBottom: 10,
    },
    cassetteVfdText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#00FF66',
        textAlign: 'center',
    },
    cassetteKeysRow: {
        flexDirection: 'row',
        gap: 6,
    },
    cassetteKey: {
        flex: 1,
        backgroundColor: '#1E0C06',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 3,
        paddingVertical: 6,
        alignItems: 'center',
    },
    cassetteKeyActive: {
        backgroundColor: '#3D150A',
        borderColor: '#00FF66',
    },
    cassetteKeyText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA44',
        fontWeight: '800',
    },
    fahrtenbuchCard: {
        backgroundColor: '#120603',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        padding: 10,
        marginBottom: 8,
    },
    fahrtenbuchHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    fahrtenbuchTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    fahrtenbuchDate: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884422',
    },
    fahrtenbuchStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    fahrtenStat: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA44',
    },
    serviceheftContainer: {
        marginBottom: 16,
    },
    serviceheftCard: {
        backgroundColor: '#120603',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        padding: 10,
        marginBottom: 8,
    },
    serviceheftHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    serviceheftName: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
        flex: 1,
    },
    serviceheftWear: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#00FF66',
        fontWeight: '800',
    },
    serviceheftBarBg: {
        height: 4,
        backgroundColor: '#260B05',
        borderRadius: 2,
        marginBottom: 6,
        overflow: 'hidden',
    },
    serviceheftBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    serviceheftFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceheftKm: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
    },
    werkstattResetBtn: {
        borderWidth: 1,
        borderColor: '#3D150A',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: '#1E0C06',
    },
    werkstattResetBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA44',
        fontWeight: '800',
    },
    papiereCard: {
        backgroundColor: '#120603',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        padding: 10,
        marginBottom: 8,
    },
    papiereHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    papiereName: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    papiereBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
        borderWidth: 1,
    },
    papiereBadgeText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    papiereIssuer: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
        marginBottom: 4,
    },
    papiereFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    papiereDate: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
    },
    papiereDays: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    safeLockContainer: {
        marginBottom: 16,
    },
    safeLockCard: {
        backgroundColor: '#120603',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#260B05',
        padding: 10,
    },
    safeLockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    safeLockTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFAA00',
        fontWeight: '800',
    },
    safeLockStatus: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '700',
        marginTop: 2,
    },
    safeLockToggle: {
        borderWidth: 1,
        borderRadius: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#1E0C06',
    },
    safeLockToggleText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA00',
        fontWeight: '800',
    },
    erschutterungBtn: {
        backgroundColor: '#1E0C06',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 3,
        paddingVertical: 6,
        alignItems: 'center',
        marginBottom: 8,
    },
    erschutterungBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FF3300',
        fontWeight: '800',
    },
    ereignisseHeader: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
        marginBottom: 4,
    },
    ereignisRow: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    ereignisTime: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
    },
    ereignisDesc: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA44',
        flex: 1,
    },
    standortText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
        marginVertical: 4,
    },
    mapsRetroBtn: {
        backgroundColor: '#1E0C06',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 3,
        paddingVertical: 6,
        alignItems: 'center',
        marginBottom: 8,
    },
    mapsRetroBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA44',
        fontWeight: '800',
    },
    parkuhrFrame: {
        borderTopWidth: 1,
        borderTopColor: '#260B05',
        paddingTop: 6,
    },
    parkuhrLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884422',
    },
    parkuhrTimer: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        color: '#00FF66',
        fontWeight: '900',
        marginVertical: 2,
    },
    parkuhrBtnRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    parkuhrBtn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#3D150A',
        backgroundColor: '#1E0C06',
        paddingVertical: 4,
        alignItems: 'center',
        borderRadius: 2,
    },
    parkuhrBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA44',
        fontWeight: '700',
    },
    notrufBtn: {
        backgroundColor: '#300808',
        borderWidth: 1,
        borderColor: '#FF2A2A',
        borderRadius: 3,
        paddingVertical: 6,
        alignItems: 'center',
        marginTop: 8,
    },
    notrufBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FF2A2A',
        fontWeight: '900',
    },
    meisterContainer: {
        marginBottom: 16,
    },
    meisterChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    meisterChip: {
        backgroundColor: '#1E0C06',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    meisterChipText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#FFAA00',
        fontWeight: '700',
    },
    meisterTerminalFrame: {
        backgroundColor: '#0A0402',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 4,
        padding: 10,
        minHeight: 120,
        marginBottom: 10,
    },
    meisterTerminalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#260B05',
        paddingBottom: 4,
    },
    meisterDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    meisterTerminalTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA00',
        fontWeight: '800',
    },
    meisterMsgRow: {
        marginVertical: 4,
    },
    meisterSender: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    meisterMsgText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#E0A080',
        marginTop: 2,
        lineHeight: 13,
    },
    meisterInputRow: {
        flexDirection: 'row',
        backgroundColor: '#120603',
        borderWidth: 1,
        borderColor: '#3D150A',
        borderRadius: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignItems: 'center',
    },
    meisterTextInput: {
        flex: 1,
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FFAA44',
        paddingVertical: 4,
    },
    meisterSendBtn: {
        backgroundColor: '#FFAA00',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 2,
    },
    meisterSendBtnText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        fontWeight: '900',
        color: '#000000',
    },
});
