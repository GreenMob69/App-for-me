// @ts-check
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
    PanResponder,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle, Rect, G } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticCriticalWarning, hapticShiftAlert } from '../../services/hapticFeedback';
import { audioGong } from '../../services/audioGongService';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const baseTheme = PARADIGM_THEMES[PARADIGM_KEYS.NOTHING_MINIMAL];

// ─── 8. Pre-baked 5x7 Vector Dot Matrix Numbers for SVG ──────────────────────
const FONT_5X7 = {
    '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
    '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
    '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
    '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
    '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
    '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
    '7': [[1,1,1],[0,0,1],[0,1,0],[0,1,0],[0,1,0]],
    '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
    '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
    ' ': [[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
    '-': [[0,0,0],[0,0,0],[1,1,1],[0,0,0],[0,0,0]],
};

function SvgDotMatrixChar({ char = '0', x = 0, y = 0, dotSize = 4, gap = 2, color = '#FFFFFF' }) {
    const matrix = FONT_5X7[char] || FONT_5X7['0'];
    const elements = [];
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
            if (matrix[r][c] === 1) {
                elements.push(
                    <Circle
                        key={`dot-${r}-${c}`}
                        cx={x + c * (dotSize + gap) + dotSize / 2}
                        cy={y + r * (dotSize + gap) + dotSize / 2}
                        r={dotSize / 2}
                        fill={color}
                    />
                );
            }
        }
    }
    return <G>{elements}</G>;
}

// ─── 10. Bionic Thermal Ribbon (Color-Free Contrast Shading) ─────────────────
function generateBionicPulsePath(width, height, loadPct = 20, coolantTemp = 90) {
    const baselineY = height / 2;
    const intensity = Math.min(Math.max(loadPct / 100, 0.15), 1.0);
    const peakHeight = (height * 0.44) * (0.35 + intensity * 0.65);

    const step = width / 12;
    const p1 = baselineY;
    const p2 = baselineY - (peakHeight * 0.25);
    const p3 = baselineY + (peakHeight * 0.2);
    const p4 = baselineY - peakHeight;
    const p5 = baselineY + (peakHeight * 0.85);
    const p6 = baselineY - (peakHeight * 0.45);
    const p7 = baselineY;

    const pathD = `M 0 ${baselineY} ` +
        `L ${step * 2} ${baselineY} ` +
        `L ${step * 3} ${p1} ` +
        `L ${step * 3.8} ${p2} ` +
        `L ${step * 4.4} ${p3} ` +
        `L ${step * 5.2} ${p4} ` +
        `L ${step * 6.0} ${p5} ` +
        `L ${step * 6.8} ${p6} ` +
        `L ${step * 7.5} ${p7} ` +
        `L ${width} ${baselineY}`;

    // Contrast shading properties:
    // Cold (<75°C) = Dotted 1px; Optimal (75-96°C) = Solid 2.5px; Stress (>98°C) = Heavy Stipple
    let strokeWidth = 2.0;
    let strokeDasharray = undefined;
    if (coolantTemp < 75) {
        strokeWidth = 1.2;
        strokeDasharray = '3, 4';
    } else if (coolantTemp > 98) {
        strokeWidth = 3.2;
        strokeDasharray = '6, 2';
    }

    return { pathD, strokeWidth, strokeDasharray };
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
    const [invertedEPaper, setInvertedEPaper] = useState(false); // 2. High-Contrast Inverted E-Paper Mode

    // ─── 1. OLED Anti-Burn-In Micro-Jitter (Pixel Shifter) ─────────────────────
    const [jitterOffset, setJitterOffset] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const jitterPositions = [
            { x: -1, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 },
        ];
        let idx = 0;
        const interval = setInterval(() => {
            idx = (idx + 1) % jitterPositions.length;
            setJitterOffset(jitterPositions[idx]);
        }, 90000); // 90 seconds per subtle sub-pixel orbit
        return () => clearInterval(interval);
    }, []);

    // ─── 4. Ultra-Low-Power Standby Sub-Rendering during Steady Highway Cruise ──
    const [cruiseStandby, setCruiseStandby] = useState(false);
    const prevSpeedRef = useRef(telemetry.speed);
    const steadyCounterRef = useRef(0);

    useEffect(() => {
        const speedDelta = Math.abs(telemetry.speed - prevSpeedRef.current);
        prevSpeedRef.current = telemetry.speed;

        if (telemetry.speed > 55 && speedDelta < 1.0 && telemetry.criticalAlerts.length === 0) {
            steadyCounterRef.current += 1;
            if (steadyCounterRef.current >= 5) { // 5 consecutive seconds of steady speed
                setCruiseStandby(true);
            }
        } else {
            steadyCounterRef.current = 0;
            if (cruiseStandby) {
                setCruiseStandby(false);
            }
        }
    }, [telemetry.speed, telemetry.criticalAlerts.length]);

    // ─── 9. Tactile Haptic Metronome for Speed Limit Thresholds ────────────────
    const lastMetronomeRef = useRef(0);
    useEffect(() => {
        if (telemetry.speed > 130) {
            const now = Date.now();
            if (now - lastMetronomeRef.current > 4000) {
                lastMetronomeRef.current = now;
                hapticTap();
            }
        }
    }, [telemetry.speed]);

    // Animație pentru Red Pill Alert
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (telemetry.criticalAlerts.length > 0) {
            hapticCriticalWarning();
            audioGong.playGong('critical');
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

    // ─── 6. BSFC Gear Shift Advisor dot-matrix arrow ──────────────────────────
    const shiftRecommendation = useMemo(() => {
        const numericGear = parseInt(gear, 10);
        if (isNaN(numericGear)) return null;

        // Shift up if high RPM and light/medium throttle (BSFC optimization zone)
        if (rpm > 2300 && numericGear < 6 && throttle < 70) {
            return { direction: 'UP', targetGear: numericGear + 1, savingLiters: '0.8' };
        }
        // Shift down if engine lugging (<1250 RPM) under load
        if (rpm < 1250 && numericGear > 1 && speed > 15) {
            return { direction: 'DOWN', targetGear: numericGear - 1, savingLiters: 'LUG' };
        }
        return null;
    }, [rpm, gear, throttle, speed]);

    // ─── 3. Glyph Telegraphy Patterns on 7-Bar LED ────────────────────────────
    const [glyphPhase, setGlyphPhase] = useState(0);
    useEffect(() => {
        // High RPM shift telegraphy pulse
        if (rpm >= 4200) {
            hapticShiftAlert();
            const timer = setInterval(() => {
                setGlyphPhase((p) => (p + 1) % 7);
            }, 80);
            return () => clearInterval(timer);
        } else {
            setGlyphPhase(0);
        }
    }, [rpm >= 4200]);

    const glyphLeds = useMemo(() => {
        const count = 7;
        // Shift alert chase light pattern
        if (rpm >= 4200) {
            return Array.from({ length: count }, (_, i) => i === glyphPhase);
        }
        // Hard decel brake flash (center outwards)
        if (gForceLong < -0.45) {
            return [true, true, true, true, true, true, true];
        }
        // Normal proportional fill
        const activeCount = Math.min(count, Math.floor((rpm / 4500) * count));
        return Array.from({ length: count }, (_, i) => i < activeCount);
    }, [rpm, glyphPhase, gForceLong]);

    // ─── 7. Full-Screen Blind Swipes Gesture Responder ────────────────────────
    const panResponder = useMemo(() => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gesture) => {
                return Math.abs(gesture.dx) > 30 || Math.abs(gesture.dy) > 30;
            },
            onPanResponderRelease: (_, gesture) => {
                const tabs = ['01', '02', '03', '04', '05'];
                const currentIdx = tabs.indexOf(activeTab);

                if (gesture.dy < -50 && Math.abs(gesture.dx) < 40) {
                    // Swipe UP -> Toggle HUD Mirror
                    hapticTap();
                    setMirrorHud((prev) => !prev);
                } else if (gesture.dy > 50 && Math.abs(gesture.dx) < 40) {
                    // Swipe DOWN -> Toggle Ghost Drive
                    hapticTap();
                    setGhostMode((prev) => !prev);
                } else if (gesture.dx < -50) {
                    // Swipe LEFT -> Next Tab
                    hapticTap();
                    const nextIdx = (currentIdx + 1) % tabs.length;
                    setActiveTab(tabs[nextIdx]);
                } else if (gesture.dx > 50) {
                    // Swipe RIGHT -> Prev Tab
                    hapticTap();
                    const prevIdx = (currentIdx - 1 + tabs.length) % tabs.length;
                    setActiveTab(tabs[prevIdx]);
                }
            },
        });
    }, [activeTab]);

    // Bionic path computation
    const bionicPulse = useMemo(() => {
        return generateBionicPulsePath(SCREEN_WIDTH - 40, 50, throttle, coolantTemp);
    }, [throttle, coolantTemp]);

    // Perforated Fuel Dots
    const fuelDots = useMemo(() => {
        const total = 10;
        const filled = Math.round((fuelLevel / 100) * total);
        return Array.from({ length: total }, (_, i) => i < filled);
    }, [fuelLevel]);

    const isGhostDimmed = (ghostMode || cruiseStandby) && criticalAlerts.length === 0;

    // Dinamic Theme mapping for E-Paper vs OLED True Black
    const currentTheme = useMemo(() => {
        if (invertedEPaper) {
            return {
                bg: '#FFFFFF',
                cardBg: '#F2F2F2',
                cardBorder: '#E0E0E0',
                textPrimary: '#000000',
                textSecondary: '#555555',
                textDim: '#888888',
                accent: baseTheme.accent,
                barActive: '#000000',
                barInactive: '#DDDDDD',
                divider: '#E5E5E5',
            };
        }
        return {
            bg: '#000000',
            cardBg: '#0A0A0A',
            cardBorder: '#161616',
            textPrimary: '#FFFFFF',
            textSecondary: '#8E8E93',
            textDim: '#555555',
            accent: baseTheme.accent,
            barActive: '#FFFFFF',
            barInactive: '#1E1E1E',
            divider: '#161616',
        };
    }, [invertedEPaper]);

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: currentTheme.bg, paddingTop: Math.max(insets.top, 24) },
                mirrorHud && styles.mirrorHudTrapezoid, // 5. Trapezoidal Keystone Projection
                { transform: [{ translateX: jitterOffset.x }, { translateY: jitterOffset.y }] }, // 1. Pixel Shifter
            ]}
            {...panResponder.panHandlers}
        >
            <StatusBar
                barStyle={invertedEPaper ? 'dark-content' : 'light-content'}
                backgroundColor={currentTheme.bg}
                translucent
            />

            {/* ── 1. GLYPH INTERFACE MATRIX (7 Segmente Telegraphic) ── */}
            <View style={[styles.glyphMatrixContainer, { backgroundColor: currentTheme.bg }]}>
                {glyphLeds.map((active, idx) => (
                    <View
                        key={`glyph-${idx}`}
                        style={[
                            styles.glyphBar,
                            { backgroundColor: currentTheme.barInactive },
                            active && { backgroundColor: currentTheme.barActive, shadowOpacity: invertedEPaper ? 0 : 0.8 },
                            (idx === 6 || rpm >= 4200) && active && { backgroundColor: currentTheme.accent },
                        ]}
                    />
                ))}
            </View>

            {/* ── 2. Top Bar Minimalist & Controluri ── */}
            <View style={[styles.topBar, { borderBottomColor: currentTheme.divider }]}>
                <View style={styles.brandRow}>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00FF66' : '#FF3B00' }]} />
                    <Text style={[styles.brandText, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRIE // CALM TECH'}
                    </Text>
                    <Text style={[styles.dotSeparator, { color: currentTheme.textDim }]}>·</Text>
                    <Text style={[styles.rpmLiveBadge, { color: currentTheme.textSecondary }]}>{rpm} RPM</Text>
                </View>

                {/* Butoane de acțiune */}
                <View style={styles.headerActions}>
                    {/* Inverted E-Paper Daylight Toggle */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg }]}
                        onPress={() => {
                            hapticTap();
                            setInvertedEPaper(!invertedEPaper);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.textPrimary }]}>
                            {invertedEPaper ? '🌙 OLED' : '☀️ LUX'}
                        </Text>
                    </TouchableOpacity>

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
                        style={[
                            styles.v2Button,
                            { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg },
                            ghostMode && { backgroundColor: currentTheme.textPrimary },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setGhostMode(!ghostMode);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: ghostMode ? currentTheme.bg : currentTheme.textSecondary }]}>
                            {ghostMode ? 'GHOST ON' : 'GHOST'}
                        </Text>
                    </TouchableOpacity>

                    {/* Mirror HUD Toggle */}
                    <TouchableOpacity
                        style={[
                            styles.v2Button,
                            { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg },
                            mirrorHud && { backgroundColor: currentTheme.textPrimary },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setMirrorHud(!mirrorHud);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: mirrorHud ? currentTheme.bg : currentTheme.textSecondary }]}>
                            🪞 HUD
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg }]}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.textSecondary }]}>⮌ V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.stylePickerButton, { backgroundColor: currentTheme.textPrimary }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.stylePickerText, { color: currentTheme.bg }]}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Corpul Central (cu Ghost Mode Dimming & Sub-Rendering) ── */}
            <ScrollView
                style={[styles.mainScroll, isGhostDimmed && styles.ghostDimmed]}
                contentContainerStyle={styles.mainScrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. AFISAJ MONUMENTAL VITEZĂ & BIO-PULSE */}
                <View style={styles.heroSection}>
                    <View style={styles.speedRow}>
                        <Text style={[styles.speedMonumental, { color: currentTheme.textPrimary }]}>{speed}</Text>
                        <View style={styles.speedMeta}>
                            <View style={[styles.gearPill, { borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.gearText, { color: currentTheme.textPrimary }]}>{gear}</Text>
                            </View>

                            {/* 6. BSFC Gear Shift Advisor Badge */}
                            {shiftRecommendation && (
                                <View style={[styles.shiftAdvisorPill, { borderColor: currentTheme.accent }]}>
                                    <Text style={[styles.shiftAdvisorText, { color: currentTheme.accent }]}>
                                        {shiftRecommendation.direction === 'UP' ? '▲' : '▼'} {shiftRecommendation.targetGear}
                                    </Text>
                                </View>
                            )}

                            <Text style={[styles.unitText, { color: currentTheme.textSecondary }]}>KM/H</Text>
                            <Text style={[styles.loadSub, { color: currentTheme.textDim }]}>{throttle}% ACCEL</Text>
                        </View>
                    </View>

                    {/* 10. Bionic Thermal Ribbon (Color-Free Contrast Shading) */}
                    <View style={[styles.pulseContainer, { borderTopColor: currentTheme.divider }]}>
                        <Svg width={SCREEN_WIDTH - 40} height={50} viewBox={`0 0 ${SCREEN_WIDTH - 40} 50`}>
                            <Line
                                x1="0"
                                y1="25"
                                x2={SCREEN_WIDTH - 40}
                                y2="25"
                                stroke={currentTheme.divider}
                                strokeWidth="1"
                                strokeDasharray="4, 4"
                            />
                            <Path
                                d={bionicPulse.pathD}
                                fill="none"
                                stroke={currentTheme.textPrimary}
                                strokeWidth={bionicPulse.strokeWidth}
                                strokeDasharray={bionicPulse.strokeDasharray}
                                strokeLinecap="round"
                            />
                        </Svg>
                        <View style={styles.pulseMetaRow}>
                            <Text style={[styles.pulseMetaLeft, { color: currentTheme.textDim }]}>
                                {coolantTemp < 75 ? '· · · ÎNCĂLZIRE RECE' : coolantTemp > 98 ? '▲ ▲ STRES TERMIC' : '— TERMIC OPTIM'}
                            </Text>
                            <Text style={[styles.pulseMetaRight, { color: currentTheme.textSecondary }]}>
                                {boost} BAR BOOST · {coolantTemp}°C
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 2. CRITICAL RED PILL / NOMINAL BANNER */}
                <View style={styles.anomalyWrapper}>
                    {criticalAlerts.length === 0 ? (
                        <View style={[styles.nominalBanner, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                            <View style={styles.nominalDot} />
                            <Text style={[styles.nominalText, { color: currentTheme.textSecondary }]} numberOfLines={1}>
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
                <View style={[styles.fuelStripContainer, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                    <View style={styles.fuelStripHeader}>
                        <Text style={[styles.fuelStripLabel, { color: currentTheme.textDim }]}>REZERVOR COMBUSTIBIL</Text>
                        <Text style={[styles.fuelStripValue, { color: currentTheme.textPrimary }]}>
                            {fuelLevel}% · {fuelRate} L/100KM
                        </Text>
                    </View>
                    <View style={styles.fuelDotsRow}>
                        {fuelDots.map((isFilled, idx) => (
                            <View
                                key={`fdot-${idx}`}
                                style={[
                                    styles.fuelDot,
                                    isFilled
                                        ? { backgroundColor: currentTheme.textPrimary }
                                        : { backgroundColor: currentTheme.barInactive },
                                    idx < 2 && isFilled && { backgroundColor: currentTheme.accent },
                                ]}
                            />
                        ))}
                    </View>
                </View>

                {/* 4. CONȚINUT DINAMIC BAZAT PE TAB-UL SELECTAT */}
                {activeTab === '01' && (
                    <View style={styles.tabContent}>
                        <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>// 01 · PARAMETRI VITALI DE RULARE</Text>
                        <View style={styles.grid2x2}>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>BOOST TURBO</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{boost} <Text style={styles.metricUnit}>BAR</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>TEMPERATURĂ ANTIGEL</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }, coolantTemp > 98 && { color: currentTheme.accent }]}>
                                    {coolantTemp} <Text style={styles.metricUnit}>°C</Text>
                                </Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>TENSIUNE ALTERNATOR</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{batteryVoltage} <Text style={styles.metricUnit}>V</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>TEMPERATURĂ ULEI</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{oilTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '02' && (
                    <View style={styles.tabContent}>
                        <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>// 02 · TERMICĂ & EVACUARE EGT</Text>
                        <View style={styles.grid2x2}>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>EGT EVACUARE</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{exhaustTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>LICHID FRÂNĂ</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }, brakeFluidTemp > 140 && { color: currentTheme.accent }]}>
                                    {brakeFluidTemp} <Text style={styles.metricUnit}>°C</Text>
                                </Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>ENERGIE FRÂNARE</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{brakeEnergyTrip} <Text style={styles.metricUnit}>kJ</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>CONSUM TOTAL</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{fuelBurnedLiters} <Text style={styles.metricUnit}>L</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '03' && (
                    <View style={styles.tabContent}>
                        <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>// 03 · VECTORI G-FORCE & DINAMICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>ACCELERAȚIE LATERALĂ</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{gForceLat} <Text style={styles.metricUnit}>G</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>ACCELERAȚIE LONGITUDINALĂ</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{gForceLong} <Text style={styles.metricUnit}>G</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '04' && (
                    <View style={styles.tabContent}>
                        <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>// 04 · FIABILITATE WEIBULL & RUL</Text>
                        <View style={styles.grid2x2}>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>RUL MINIM PANĂ</Text>
                                <Text style={[styles.metricValue, { color: '#00FF66' }]}>{minRulKm} <Text style={styles.metricUnit}>KM</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>RISC DEFECTARE</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{breakdownRisk} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>SOH BATERIE</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{batterySoH} <Text style={styles.metricUnit}>%</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>RUL ULEI</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{weibullRul?.oil || 14200} <Text style={styles.metricUnit}>KM</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {activeTab === '05' && (
                    <View style={styles.tabContent}>
                        <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>// 05 · ECO & EFICIENȚĂ CALORICĂ</Text>
                        <View style={styles.grid2x2}>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>CONSUM INSTANT</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{fuelRate} <Text style={styles.metricUnit}>L/100</Text></Text>
                            </View>
                            <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                                <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>COMBUSTIBIL ARS</Text>
                                <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{fuelBurnedLiters} <Text style={styles.metricUnit}>L</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Jog-Wheel Selector Inferior (01 .. 05) ── */}
            <View style={[styles.jogWheelContainer, { borderTopColor: currentTheme.divider, backgroundColor: currentTheme.bg }]}>
                {['01', '02', '03', '04', '05'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[
                            styles.jogTab,
                            activeTab === tab && { backgroundColor: currentTheme.textPrimary },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setActiveTab(tab);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.jogTabText, { color: activeTab === tab ? currentTheme.bg : currentTheme.textDim }]}>
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
    },
    // 5. Trapezoidal Keystone Projection for HUD Windshield Angle
    mirrorHudTrapezoid: {
        transform: [
            { perspective: 500 },
            { rotateX: '18deg' },
            { scaleX: -1 },
        ],
    },
    glyphMatrixContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        gap: 6,
    },
    glyphBar: {
        flex: 1,
        height: 3,
        borderRadius: 2,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
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
        letterSpacing: 1,
        fontWeight: '700',
        flexShrink: 1,
    },
    dotSeparator: {
        marginHorizontal: 6,
        fontSize: 10,
    },
    rpmLiveBadge: {
        fontFamily: MONO_FONT,
        fontSize: 10,
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
    },
    v2ButtonText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
    },
    stylePickerButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    stylePickerText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
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
        opacity: 0.06,
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
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 4,
    },
    gearText: {
        fontFamily: MONO_FONT,
        fontSize: 14,
        fontWeight: '800',
    },
    shiftAdvisorPill: {
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        marginBottom: 6,
        backgroundColor: '#D7192015',
    },
    shiftAdvisorText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '900',
    },
    unitText: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        fontWeight: '700',
    },
    loadSub: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        marginTop: 4,
        fontVariant: ['tabular-nums'],
    },
    pulseContainer: {
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
    },
    pulseMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    pulseMetaLeft: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        letterSpacing: 1,
    },
    pulseMetaRight: {
        fontFamily: MONO_FONT,
        fontSize: 9,
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
        borderRadius: 4,
        borderWidth: 1,
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
        borderRadius: 4,
        borderWidth: 1,
    },
    fuelStripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    fuelStripLabel: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        letterSpacing: 1,
    },
    fuelStripValue: {
        fontFamily: MONO_FONT,
        fontSize: 10,
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
    tabContent: {
        marginBottom: 16,
    },
    sectionHeader: {
        fontFamily: MONO_FONT,
        fontSize: 10,
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
        padding: 12,
        borderRadius: 4,
        borderWidth: 1,
    },
    metricLabel: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    metricValue: {
        fontFamily: MONO_FONT,
        fontSize: 18,
        fontWeight: '700',
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
    },
    jogTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
    },
    jogTabText: {
        fontFamily: MONO_FONT,
        fontSize: 12,
        fontWeight: '700',
    },
});
