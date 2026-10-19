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
    PanResponder,
    Animated,
    ScrollView,
    TextInput,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, {
    Polygon,
    Polyline,
    Line,
    Circle,
    Defs,
    LinearGradient,
    Stop,
    G,
    Rect,
    Path,
    Ellipse,
} from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useParadigmCoreData } from '../../hooks/useParadigmCoreData';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.SPATIAL_CANVAS];

// ─── 1. Motor Matematic 3D cu Pitch (Dive) & Roll (Ruliu) ─────────────────────
function project3D(x, y, z, rotX, rotY, roll = 0, pitch = 0, zoom = 0.85, centerX = SCREEN_WIDTH / 2, centerY = 125) {
    // Aplicare Pitch (Dive la frânare / Squat la accelerare)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const yP = y * cosP - z * sinP;
    const zP = y * sinP + z * cosP;

    // Aplicare Roll (Înclinare laterală la forțe G)
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const xR = x * cosR - yP * sinR;
    const yR = x * sinR + yP * cosR;

    // Rotație pe axa Y (orizontală)
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = xR * cosY - zP * sinY;
    const z1 = xR * sinY + zP * cosY;

    // Rotație pe axa X (verticală/înclinare cameră)
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y2 = yR * cosX - z1 * sinX;
    const z2 = yR * sinX + z1 * cosX;

    // Proiecție perspectivă
    const fov = 300 * zoom;
    const distance = 4.2;
    const zProj = z2 + distance;
    const safeZ = zProj > 0.4 ? zProj : 0.4;
    const scale = fov / safeZ;

    return {
        x: centerX + x1 * scale,
        y: centerY - y2 * scale,
        depth: z2,
    };
}

// 1. Back-Face Culling via 2D Screen Space Cross-Product
function isClockwise(p1, p2, p3) {
    return ((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) > 0;
}

// ─── Zero-GC Geometrie 3D Înghețată ──────────────────────────────────────────
const BASE_CAR_VERTICES = Object.freeze({
    noseL: Object.freeze([-0.7, 0.12, 1.7]),
    noseR: Object.freeze([0.7, 0.12, 1.7]),
    hoodL: Object.freeze([-0.65, 0.38, 0.9]),
    hoodR: Object.freeze([0.65, 0.38, 0.9]),
    roofFrontL: Object.freeze([-0.52, 0.72, 0.35]),
    roofFrontR: Object.freeze([0.52, 0.72, 0.35]),
    roofRearL: Object.freeze([-0.50, 0.68, -0.65]),
    roofRearR: Object.freeze([0.50, 0.68, -0.65]),
    trunkL: Object.freeze([-0.62, 0.40, -1.35]),
    trunkR: Object.freeze([0.62, 0.40, -1.35]),
    tailL: Object.freeze([-0.68, 0.22, -1.75]),
    tailR: Object.freeze([0.68, 0.22, -1.75]),
    sillFrontL: Object.freeze([-0.72, -0.05, 0.9]),
    sillFrontR: Object.freeze([0.72, -0.05, 0.9]),
    sillRearL: Object.freeze([-0.72, -0.05, -1.0]),
    sillRearR: Object.freeze([0.72, -0.05, -1.0]),
    engineBlockFront: Object.freeze([0, 0.18, 1.2]),
    turboCore: Object.freeze([0.28, 0.15, 0.85]),
    exhaustDownpipe: Object.freeze([0.18, 0.05, -0.2]),
    wheelFL: Object.freeze([-0.78, -0.02, 1.05]),
    wheelFR: Object.freeze([0.78, -0.02, 1.05]),
    wheelRL: Object.freeze([-0.78, -0.02, -1.05]),
    wheelRR: Object.freeze([0.78, -0.02, -1.05]),
});

const SPATIAL_ACCENTS = Object.freeze({
    CYAN: Object.freeze({ primary: '#00F0FF', border: 'rgba(0, 240, 255, 0.4)', bg: 'rgba(0, 240, 255, 0.12)' }),
    GOLD: Object.freeze({ primary: '#FFB800', border: 'rgba(255, 184, 0, 0.4)', bg: 'rgba(255, 184, 0, 0.12)' }),
    EMERALD: Object.freeze({ primary: '#00FF66', border: 'rgba(0, 255, 102, 0.4)', bg: 'rgba(0, 255, 102, 0.12)' }),
});

const GROUND_GRID_X = Object.freeze([-1.8, -0.9, 0, 0.9, 1.8]);
const CYLINDER_ORDER = Object.freeze([1, 2, 4, 5, 3]);

export default function SpatialCanvasParadigm() {
    const insets = useSafeInsets();
    // Stări Standalone OS: 'XRAY' | 'REPLAY' | 'SERVICE' | 'SENTRY' | 'COPILOT'
    const [spatialSheet, setSpatialSheet] = useState('XRAY');
    const isLiveViewActive = spatialSheet === 'XRAY';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();
    const [spatialAccentKey, setSpatialAccentKey] = useState('CYAN'); // 'CYAN' | 'GOLD' | 'EMERALD'
    const [copilotInput, setCopilotInput] = useState('');

    // 4 Zone de Cameră: 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    const [cameraZone, setCameraZone] = useState('OVERVIEW');
    const [isExplodedView, setIsExplodedView] = useState(false);

    // Unghiuri de rotație 3D
    const [rotY, setRotY] = useState(0.55);
    const [rotX, setRotX] = useState(0.35);
    const [wheelAngle, setWheelAngle] = useState(0);
    const [aeroOffset, setAeroOffset] = useState(0);

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
        activeCylinder,
        isConnected,
    } = telemetry;

    // Telemetrie activă sincronizată cu modul Replay pas-cu-pas
    const isReplaying = core.isReplaying;
    const isLive3DActive = spatialSheet === 'XRAY' || (spatialSheet === 'REPLAY' && isReplaying);
    const activeSpeed = (isReplaying && core.currentReplaySample) ? core.currentReplaySample.speed : speed;
    const activeRpm = (isReplaying && core.currentReplaySample) ? core.currentReplaySample.rpm : rpm;
    const activeBoost = (isReplaying && core.currentReplaySample) ? core.currentReplaySample.boost : boost;
    const activeLatG = (isReplaying && core.currentReplaySample) ? core.currentReplaySample.gForceLat : gForceLat;
    const activeLongG = (isReplaying && core.currentReplaySample) ? core.currentReplaySample.gForceLong : gForceLong;

    const activeAccent = SPATIAL_ACCENTS[spatialAccentKey] || SPATIAL_ACCENTS.CYAN;

    // Calcul Pitch & Roll din forțe G (animate și în mod Replay)
    const suspensionPitch = useMemo(() => {
        return Math.max(-0.08, Math.min(0.08, -activeLongG * 0.05));
    }, [activeLongG]);

    const suspensionRoll = useMemo(() => {
        return Math.max(-0.09, Math.min(0.09, activeLatG * 0.06));
    }, [activeLatG]);

    // Buclă de rotație a roților și linii aerodinamice CFD (throttled când 3D nu e activ)
    useEffect(() => {
        if (isLive3DActive && activeSpeed > 0) {
            const interval = setInterval(() => {
                setWheelAngle((prev) => (prev + (activeSpeed / 12)) % 360);
                setAeroOffset((prev) => (prev + (activeSpeed / 8)) % 100);
            }, 33);
            return () => clearInterval(interval);
        }
    }, [isLive3DActive, activeSpeed]);

    // Oprește timerul de inerție când părăsim modul 3D activ sau la demontare
    useEffect(() => {
        if (!isLive3DActive && inertiaTimerRef.current) {
            clearInterval(inertiaTimerRef.current);
            inertiaTimerRef.current = null;
        }
        return () => {
            if (inertiaTimerRef.current) clearInterval(inertiaTimerRef.current);
        };
    }, [isLive3DActive]);

    // Comutare perspective cameră
    useEffect(() => {
        if (cameraZone === 'OVERVIEW') {
            setRotY(0.55);
            setRotX(0.35);
        } else if (cameraZone === 'ENGINE_BAY') {
            setRotY(0.12);
            setRotX(0.52);
        } else if (cameraZone === 'CHASSIS_BRAKES') {
            setRotY(1.45);
            setRotX(0.20);
        } else if (cameraZone === 'HIGHWAY_CHASE') {
            setRotY(3.14);
            setRotX(0.22);
        }
    }, [cameraZone]);

    // PanResponder cu Inerție Fină și Spring Decay
    const inertiaTimerRef = useRef(null);
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                    if (inertiaTimerRef.current) clearInterval(inertiaTimerRef.current);
                },
                onPanResponderMove: (_, gestureState) => {
                    setRotY((prev) => prev + gestureState.vx * 0.008);
                    setRotX((prev) => Math.max(0.08, Math.min(1.2, prev - gestureState.vy * 0.006)));
                },
                onPanResponderRelease: (_, gestureState) => {
                    let vY = gestureState.vx * 0.006;
                    let vX = -gestureState.vy * 0.004;
                    inertiaTimerRef.current = setInterval(() => {
                        vY *= 0.88;
                        vX *= 0.88;
                        setRotY((prev) => prev + vY);
                        setRotX((prev) => Math.max(0.08, Math.min(1.2, prev + vX)));
                        if (Math.abs(vY) < 0.0005 && Math.abs(vX) < 0.0005) {
                            clearInterval(inertiaTimerRef.current);
                        }
                    }, 25);
                },
            }),
        []
    );

    // ── GEOMETRIE 3D DIGITAL TWIN CU BACK-FACE CULLING & X-RAY VIEW ──────
    const carMesh3D = useMemo(() => {
        const explode = isExplodedView ? 0.35 : 0.0;
        const p = (x, y, z) => project3D(x, y, z, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125);
        const V = BASE_CAR_VERTICES;

        // Capotă & Bot (cu explozie exterioară în mod X-Ray)
        const noseL = p(V.noseL[0] - explode, V.noseL[1], V.noseL[2] + explode);
        const noseR = p(V.noseR[0] + explode, V.noseR[1], V.noseR[2] + explode);
        const hoodL = p(V.hoodL[0] - explode, V.hoodL[1] + explode, V.hoodL[2]);
        const hoodR = p(V.hoodR[0] + explode, V.hoodR[1] + explode, V.hoodR[2]);

        // Cabină & Plafon
        const roofFrontL = p(V.roofFrontL[0], V.roofFrontL[1] + explode * 0.5, V.roofFrontL[2]);
        const roofFrontR = p(V.roofFrontR[0], V.roofFrontR[1] + explode * 0.5, V.roofFrontR[2]);
        const roofRearL = p(V.roofRearL[0], V.roofRearL[1] + explode * 0.5, V.roofRearL[2]);
        const roofRearR = p(V.roofRearR[0], V.roofRearR[1] + explode * 0.5, V.roofRearR[2]);

        // Spate & Portbagaj
        const trunkL = p(V.trunkL[0] - explode, V.trunkL[1], V.trunkL[2] - explode);
        const trunkR = p(V.trunkR[0] + explode, V.trunkR[1], V.trunkR[2] - explode);
        const tailL = p(V.tailL[0] - explode, V.tailL[1], V.tailL[2] - explode);
        const tailR = p(V.tailR[0] + explode, V.tailR[1], V.tailR[2] - explode);

        // Praguri inferioare
        const sillFrontL = p(V.sillFrontL[0] - explode, V.sillFrontL[1], V.sillFrontL[2]);
        const sillFrontR = p(V.sillFrontR[0] + explode, V.sillFrontR[1], V.sillFrontR[2]);
        const sillRearL = p(V.sillRearL[0] - explode, V.sillRearL[1], V.sillRearL[2]);
        const sillRearR = p(V.sillRearR[0] + explode, V.sillRearR[1], V.sillRearR[2]);

        // Componente Interne Powertrain expuse în X-Ray
        const engineBlockFront = p(V.engineBlockFront[0], V.engineBlockFront[1], V.engineBlockFront[2]);
        const turboCore = p(V.turboCore[0], V.turboCore[1], V.turboCore[2]);
        const exhaustDownpipe = p(V.exhaustDownpipe[0], V.exhaustDownpipe[1], V.exhaustDownpipe[2]);

        // Poziții 4 Roți cu virare dinamică
        const steerAngle = (activeLatG || 0) * 0.35;
        const wheelFL = p(V.wheelFL[0], V.wheelFL[1], V.wheelFL[2]);
        const wheelFR = p(V.wheelFR[0], V.wheelFR[1], V.wheelFR[2]);
        const wheelRL = p(V.wheelRL[0], V.wheelRL[1], V.wheelRL[2]);
        const wheelRR = p(V.wheelRR[0], V.wheelRR[1], V.wheelRR[2]);

        return {
            noseL, noseR, hoodL, hoodR,
            roofFrontL, roofFrontR, roofRearL, roofRearR,
            trunkL, trunkR, tailL, tailR,
            sillFrontL, sillFrontR, sillRearL, sillRearR,
            engineBlockFront, turboCore, exhaustDownpipe,
            wheels: [
                { pos: wheelFL, label: 'FL', isFront: true, steer: steerAngle },
                { pos: wheelFR, label: 'FR', isFront: true, steer: steerAngle },
                { pos: wheelRL, label: 'RL', isFront: false, steer: 0 },
                { pos: wheelRR, label: 'RR', isFront: false, steer: 0 },
            ],
        };
    }, [rotX, rotY, suspensionRoll, suspensionPitch, isExplodedView, activeLatG]);

    // Culoare dinamică frâne în funcție de temperatură
    const brakeColor = brakeFluidTemp > 140 ? '#FF2A2A' : brakeFluidTemp > 105 ? '#FFB800' : activeAccent.primary;
    const safeTop = typeof insets?.top === 'number' && !isNaN(insets.top) ? Math.max(insets.top, 24) : 24;
    const safeBottom = typeof insets?.bottom === 'number' && !isNaN(insets.bottom) ? Math.max(insets.bottom, 12) : 12;

    return (
        <View style={[styles.container, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
            <StatusBar barStyle="light-content" backgroundColor="#04070D" />

            {/* ── 1. Antet Spațial cu Butoane Protejate la Atingere ── */}
            <View style={styles.topHudBar}>
                <View style={styles.hudBrand}>
                    <View style={[styles.holoBadge, { backgroundColor: activeAccent.primary }]}>
                        <Text style={styles.holoBadgeText}>3D DIGITAL TWIN</Text>
                    </View>
                    <View style={[styles.netDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.vinHud} numberOfLines={1}>
                        {activeVehicle?.model || 'ACURA CDX // AUDI 3D'}
                    </Text>
                </View>

                {/* Acțiuni de Top cu STIL primul garantat vizibil */}
                <View style={styles.hudActions}>
                    <TouchableOpacity
                        style={[styles.hudActionBtn, { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: '#04070D', fontWeight: '900' }]}>
                            🎨 STIL
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.hudActionBtn}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={styles.hudActionBtnText}>⮌ CLASIC</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.hudActionBtn, { borderColor: '#FFB800', backgroundColor: '#FFB80018' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: '#FFB800' }]}>🎮</Text>
                    </TouchableOpacity>

                    {/* Buton Mod X-Ray Powertrain */}
                    <TouchableOpacity
                        style={[
                            styles.hudActionBtn,
                            { borderColor: activeAccent.primary, backgroundColor: isExplodedView ? `${activeAccent.primary}33` : activeAccent.bg },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setIsExplodedView(!isExplodedView);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: activeAccent.primary }]}>
                            {isExplodedView ? '🔬 ON' : '🔬'}
                        </Text>
                    </TouchableOpacity>

                    {/* Sub-Accent Switcher (CYAN / GOLD / EMERALD) */}
                    <TouchableOpacity
                        style={[styles.hudActionBtn, { borderColor: activeAccent.primary, backgroundColor: activeAccent.bg }]}
                        onPress={() => {
                            hapticTap();
                            setSpatialAccentKey(prev => prev === 'CYAN' ? 'GOLD' : prev === 'GOLD' ? 'EMERALD' : 'CYAN');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: activeAccent.primary }]}>
                            {spatialAccentKey === 'CYAN' ? '🔷' : spatialAccentKey === 'GOLD' ? '🟧' : '🟩'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 2. Zona Centrală: Canvas Tridimensional Interactiv ── */}
            <View style={styles.canvasContainer} {...panResponder.panHandlers}>
                <Svg width={SCREEN_WIDTH} height={250} viewBox={`0 0 ${SCREEN_WIDTH} 250`}>
                    <Defs>
                        {/* PBR Metal Shading Gradient */}
                        <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#0B1A2E" stopOpacity={isExplodedView ? 0.35 : 0.95} />
                            <Stop offset="0.5" stopColor="#1E3A5F" stopOpacity={isExplodedView ? 0.25 : 0.9} />
                            <Stop offset="1" stopColor="#03070E" stopOpacity={isExplodedView ? 0.35 : 0.95} />
                        </LinearGradient>
                        <LinearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={activeAccent.primary} stopOpacity={isExplodedView ? 0.2 : 0.45} />
                            <Stop offset="1" stopColor="#004466" stopOpacity={isExplodedView ? 0.1 : 0.2} />
                        </LinearGradient>
                        {/* Fascicul Faruri 3D Proiectat în Față */}
                        <LinearGradient id="headlightBeam" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={activeAccent.primary} stopOpacity="0.35" />
                            <Stop offset="1" stopColor={activeAccent.primary} stopOpacity="0.0" />
                        </LinearGradient>
                    </Defs>

                    {/* Grilă Perspective Sol */}
                    {GROUND_GRID_X.map((lineX, i) => {
                        const pStart = project3D(lineX, -0.06, -2.5, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125);
                        const pEnd = project3D(lineX, -0.06, 2.8, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125);
                        return (
                            <Line
                                key={`grid-${i}`}
                                x1={pStart.x}
                                y1={pStart.y}
                                x2={pEnd.x}
                                y2={pEnd.y}
                                stroke={isIceRisk ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 240, 255, 0.12)'}
                                strokeWidth={isIceRisk ? 1.5 : 1}
                                strokeDasharray="3, 3"
                            />
                        );
                    })}

                    {/* Umbre Sol sub Fiecare Roată */}
                    {carMesh3D.wheels.map((wh, idx) => (
                        <Ellipse
                            key={`shadow-${idx}`}
                            cx={wh.pos.x}
                            cy={wh.pos.y + 12}
                            rx={14}
                            ry={4}
                            fill="rgba(0, 0, 0, 0.65)"
                        />
                    ))}

                    {/* Fascicul Faruri 3D Proiectat în Față */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${project3D(1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125).x},${project3D(1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125).y}
                            ${project3D(-1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125).x},${project3D(-1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125).y}
                        `}
                        fill="url(#headlightBeam)"
                    />

                    {/* Componente Interne Expuse în X-Ray */}
                    {isExplodedView && (
                        <G>
                            <Circle cx={carMesh3D.engineBlockFront.x} cy={carMesh3D.engineBlockFront.y} r={16} fill="#2A3B4C" stroke={activeAccent.primary} strokeWidth="1.5" />
                            <Circle cx={carMesh3D.turboCore.x} cy={carMesh3D.turboCore.y} r={10} fill="#FF5500" stroke="#FF2A2A" strokeWidth="2" />
                            <Line
                                x1={carMesh3D.turboCore.x}
                                y1={carMesh3D.turboCore.y}
                                x2={carMesh3D.exhaustDownpipe.x}
                                y2={carMesh3D.exhaustDownpipe.y}
                                stroke="#FF8800"
                                strokeWidth="3"
                            />
                        </G>
                    )}

                    {/* Fațete Poligonale Caroserie */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                        `}
                        fill="url(#carBodyGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.2"
                    />

                    <Polygon
                        points={`
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.roofFrontR.x},${carMesh3D.roofFrontR.y}
                            ${carMesh3D.roofFrontL.x},${carMesh3D.roofFrontL.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.5"
                    />

                    <Polygon
                        points={`
                            ${carMesh3D.roofFrontL.x},${carMesh3D.roofFrontL.y}
                            ${carMesh3D.roofFrontR.x},${carMesh3D.roofFrontR.y}
                            ${carMesh3D.roofRearR.x},${carMesh3D.roofRearR.y}
                            ${carMesh3D.roofRearL.x},${carMesh3D.roofRearL.y}
                        `}
                        fill="url(#carBodyGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1"
                    />

                    <Polygon
                        points={`
                            ${carMesh3D.roofRearL.x},${carMesh3D.roofRearL.y}
                            ${carMesh3D.roofRearR.x},${carMesh3D.roofRearR.y}
                            ${carMesh3D.trunkR.x},${carMesh3D.trunkR.y}
                            ${carMesh3D.trunkL.x},${carMesh3D.trunkL.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.2"
                    />

                    <Polygon
                        points={`
                            ${carMesh3D.trunkL.x},${carMesh3D.trunkL.y}
                            ${carMesh3D.trunkR.x},${carMesh3D.trunkR.y}
                            ${carMesh3D.tailR.x},${carMesh3D.tailR.y}
                            ${carMesh3D.tailL.x},${carMesh3D.tailL.y}
                        `}
                        fill="#0B1524"
                        stroke="#FF2A2A"
                        strokeWidth="2"
                    />

                    {/* Linii Aerodinamice CFD animate */}
                    {activeSpeed > 15 && (
                        <G>
                            <Line
                                x1={carMesh3D.noseL.x + (carMesh3D.noseR.x - carMesh3D.noseL.x) * 0.3}
                                y1={carMesh3D.noseL.y - 4}
                                x2={carMesh3D.roofRearL.x + (carMesh3D.roofRearR.x - carMesh3D.roofRearL.x) * 0.3}
                                y2={carMesh3D.roofRearL.y - 12}
                                stroke="rgba(0, 240, 255, 0.45)"
                                strokeWidth="1.2"
                                strokeDasharray="8, 6"
                                strokeDashoffset={-aeroOffset}
                            />
                            <Line
                                x1={carMesh3D.noseL.x + (carMesh3D.noseR.x - carMesh3D.noseL.x) * 0.7}
                                y1={carMesh3D.noseL.y - 4}
                                x2={carMesh3D.roofRearL.x + (carMesh3D.roofRearR.x - carMesh3D.roofRearL.x) * 0.7}
                                y2={carMesh3D.roofRearL.y - 12}
                                stroke="rgba(0, 240, 255, 0.45)"
                                strokeWidth="1.2"
                                strokeDasharray="8, 6"
                                strokeDashoffset={-aeroOffset}
                            />
                        </G>
                    )}

                    {/* 4 Roți 3D Active cu Spițe și Discuri de Frână */}
                    {carMesh3D.wheels.map((wh, idx) => {
                        const spokeRad = (wheelAngle * Math.PI) / 180;
                        const r = 14;
                        return (
                            <G key={`wheel-${idx}`}>
                                <Circle
                                    cx={wh.pos.x}
                                    cy={wh.pos.y}
                                    r={r}
                                    fill="#060B12"
                                    stroke="#1E293B"
                                    strokeWidth="2.5"
                                />
                                <Circle
                                    cx={wh.pos.x}
                                    cy={wh.pos.y}
                                    r={r * 0.65}
                                    fill="#0C1524"
                                    stroke={brakeColor}
                                    strokeWidth="1.8"
                                    strokeDasharray="6, 3"
                                />
                                <Line
                                    x1={wh.pos.x - Math.cos(spokeRad) * (r * 0.7)}
                                    y1={wh.pos.y - Math.sin(spokeRad) * (r * 0.7)}
                                    x2={wh.pos.x + Math.cos(spokeRad) * (r * 0.7)}
                                    y2={wh.pos.y + Math.sin(spokeRad) * (r * 0.7)}
                                    stroke="#8CA0BA"
                                    strokeWidth="1.5"
                                />
                                <Line
                                    x1={wh.pos.x - Math.sin(spokeRad) * (r * 0.7)}
                                    y1={wh.pos.y + Math.cos(spokeRad) * (r * 0.7)}
                                    x2={wh.pos.x + Math.sin(spokeRad) * (r * 0.7)}
                                    y2={wh.pos.y - Math.cos(spokeRad) * (r * 0.7)}
                                    stroke="#8CA0BA"
                                    strokeWidth="1.5"
                                />
                            </G>
                        );
                    })}
                </Svg>

                {/* Butoane Hotspot Tridimensionale */}
                <View style={styles.hotspotsLayer} pointerEvents="box-none">
                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 60, left: SCREEN_WIDTH / 2 - 40, borderColor: `${activeAccent.primary}66` }]}
                        onPress={() => {
                            hapticTap();
                            setSpatialSheet('XRAY');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hotspotText, { color: activeAccent.primary }]}>🔥 MOTOR {coolantTemp}°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 130, left: 14 }]}
                        onPress={() => {
                            hapticTap();
                            setSpatialSheet('SERVICE');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hotspotText, { color: brakeColor }]}>🛞 FRÂNE {brakeFluidTemp}°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 140, right: 14 }]}
                        onPress={() => {
                            hapticTap();
                            setSpatialSheet('SENTRY');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hotspotText, { color: '#00FF66' }]}>🛡️ RUL {minRulKm}k</Text>
                    </TouchableOpacity>
                </View>

                {/* HUD Plutitor Viteză */}
                <View style={styles.floatingSpeedHud} pointerEvents="none">
                    <Text style={styles.floatingSpeedNumber}>{activeSpeed}</Text>
                    <View style={styles.floatingSpeedMeta}>
                        <Text style={[styles.floatingSpeedUnit, { color: activeAccent.primary }]}>KM/H</Text>
                        <Text style={styles.floatingRpmMeta}>{activeRpm} RPM · TR. {gear}</Text>
                    </View>
                </View>

                {/* Secvență Aprindere */}
                <View style={styles.firingSequenceBadge} pointerEvents="none">
                    <Text style={styles.firingBadgeLabel}>ORDINE: </Text>
                    {CYLINDER_ORDER.map((cyl) => (
                        <View
                            key={cyl}
                            style={[
                                styles.cylinderDot,
                                activeCylinder === cyl && [styles.cylinderDotActive, { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }],
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cylinderDotText,
                                    activeCylinder === cyl && styles.cylinderDotTextActive,
                                ]}
                            >
                                {cyl}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* ── 3. Selector Zone de Cameră Cinematică ── */}
            <View style={styles.cameraZonesBar}>
                {[
                    { id: 'OVERVIEW', label: '1. GENERAL' },
                    { id: 'ENGINE_BAY', label: '2. MOTOR' },
                    { id: 'CHASSIS_BRAKES', label: '3. FRÂNE' },
                    { id: 'HIGHWAY_CHASE', label: '4. PILOT' },
                ].map((zone) => (
                    <TouchableOpacity
                        key={zone.id}
                        style={[styles.zoneBtn, cameraZone === zone.id && [styles.zoneBtnActive, { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }]]}
                        onPress={() => {
                            hapticTap();
                            setCameraZone(zone.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                        <Text style={[styles.zoneBtnText, cameraZone === zone.id && styles.zoneBtnTextActive]}>
                            {zone.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── 4. BARA TABS PENTRU CELE 5 FOI DE STICLĂ SPATIALE ── */}
            <View style={styles.spatialTabBar}>
                {[
                    { id: 'XRAY', label: '🔬 X-RAY' },
                    { id: 'REPLAY', label: '📼 REPLAY' },
                    { id: 'SERVICE', label: '🔧 SERVICE' },
                    { id: 'SENTRY', label: '🛡️ SENTRY' },
                    { id: 'COPILOT', label: '🧠 COPILOT' },
                ].map((tab) => {
                    const isActive = spatialSheet === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[
                                styles.spatialTabBtn,
                                isActive && { backgroundColor: activeAccent.bg, borderColor: activeAccent.primary }
                            ]}
                            onPress={() => {
                                hapticTap();
                                setSpatialSheet(tab.id);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                            <Text style={[
                                styles.spatialTabText,
                                { color: isActive ? activeAccent.primary : '#64748B' }
                            ]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── 5. CORPUL CENTRAL: FOAIA DE STICLĂ ACTIVĂ (FLOATING GLASS SHEET) ── */}
            <View style={styles.sheetContainer}>
                <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>

                    {/* ──── FOAIA 1: 3D X-RAY (32 VIRTUAL SENSORS MATRIX) ──── */}
                    {spatialSheet === 'XRAY' && (
                        <View>
                            <View style={styles.sheetHeaderRow}>
                                <View>
                                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                                        3D ANATOMIE VIRTUALĂ · 32 OBSERVATORI FIZICI
                                    </Text>
                                    <Text style={styles.sheetSub}>MOTOR KALMAN FILTER · DIAGNOZĂ TOLERANȚE</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.xrayToggleBtn, { borderColor: activeAccent.primary, backgroundColor: activeAccent.bg }]}
                                    onPress={() => {
                                        hapticTap();
                                        setIsExplodedView(!isExplodedView);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[styles.xrayToggleText, { color: activeAccent.primary }]}>
                                        {isExplodedView ? 'COMPACT' : 'EXPLOZAT'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

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
                                    <View key={catKey} style={styles.spatialCategoryBox}>
                                        <Text style={[styles.categoryTitle, { color: activeAccent.primary }]}>
                                            {catLabels[catKey] || catKey.toUpperCase()}
                                        </Text>
                                        <View style={styles.sensorsGrid}>
                                            {sensors.map((s) => {
                                                const isWarn = s.status === 'WARN';
                                                const isAlert = s.status === 'ALERT';
                                                const statusColor = isAlert ? '#FF2A2A' : isWarn ? '#FFB800' : '#00FF66';
                                                return (
                                                    <View key={s.id} style={[styles.spatialSensorCard, { borderColor: isAlert ? '#FF2A2A88' : '#162B44' }]}>
                                                        <View style={styles.sensorCardHeader}>
                                                            <Text style={styles.spatialSensorLabel} numberOfLines={1}>{s.label}</Text>
                                                            <View style={[styles.spatialStatusDot, { backgroundColor: statusColor }]} />
                                                        </View>
                                                        <View style={styles.sensorCardFooter}>
                                                            <Text style={[styles.spatialSensorVal, { color: statusColor }]}>{s.val}</Text>
                                                            <Text style={styles.spatialSensorRef}>REF: {s.target}</Text>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* ──── FOAIA 2: 3D REPLAY PLAYER & EXPORT DOSAR ──── */}
                    {spatialSheet === 'REPLAY' && (
                        <View>
                            <View style={styles.sheetHeaderRow}>
                                <View>
                                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                                        3D TELEMETRY REPLAY · CONTROL PAS-CU-PAS
                                    </Text>
                                    <Text style={styles.sheetSub}>MAȘINA 3D DINAMICĂ ÎN TIMP REAL CONFORM TELEMETRIEI</Text>
                                </View>
                                <Text style={[styles.replaySpeedBadge, { color: activeAccent.primary }]}>{core.replaySpeed}x</Text>
                            </View>

                            <View style={styles.replayGlassCard}>
                                <View style={styles.tripGlassHeader}>
                                    <Text style={styles.tripGlassTitle}>
                                        {core.selectedTripId ? core.tripsList.find(t => t.id === core.selectedTripId)?.title || 'CURSĂ SELECTATĂ' : 'NICIUN TRASEU SELECTAT'}
                                    </Text>
                                    <Text style={styles.tripGlassDate}>
                                        PROBĂ: {core.replayIndex} / {core.replayTotalSamples}
                                    </Text>
                                </View>

                                {/* Scrubber Bar */}
                                <View style={styles.replayTrack}>
                                    <View style={[styles.replayFill, { width: `${core.replayTotalSamples > 0 ? (core.replayIndex / core.replayTotalSamples) * 100 : 0}%`, backgroundColor: activeAccent.primary }]} />
                                </View>

                                {/* Active Replay Metrics */}
                                <View style={styles.replayMetricsGrid}>
                                    <View style={styles.replayMetricCol}>
                                        <Text style={styles.replayMetricKey}>VITEZĂ</Text>
                                        <Text style={styles.replayMetricVal}>{activeSpeed} km/h</Text>
                                    </View>
                                    <View style={styles.replayMetricCol}>
                                        <Text style={styles.replayMetricKey}>TURAȚIE</Text>
                                        <Text style={styles.replayMetricVal}>{activeRpm} RPM</Text>
                                    </View>
                                    <View style={styles.replayMetricCol}>
                                        <Text style={styles.replayMetricKey}>BOOST</Text>
                                        <Text style={styles.replayMetricVal}>{Number(activeBoost).toFixed(2)} bar</Text>
                                    </View>
                                    <View style={styles.replayMetricCol}>
                                        <Text style={styles.replayMetricKey}>G-LAT</Text>
                                        <Text style={styles.replayMetricVal}>{Number(activeLatG).toFixed(2)} G</Text>
                                    </View>
                                </View>

                                {/* Playback Controls */}
                                <View style={styles.replayBtnsRow}>
                                    <TouchableOpacity
                                        style={[styles.spatialBtn, { backgroundColor: core.isReplaying ? '#FFB80022' : activeAccent.bg, borderColor: core.isReplaying ? '#FFB800' : activeAccent.primary }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.togglePlayPause();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.spatialBtnText, { color: core.isReplaying ? '#FFB800' : activeAccent.primary }]}>
                                            {core.isReplaying ? '❚❚ PAUZĂ' : '▶ REDĂ'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.cycleReplaySpeed();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.spatialBtnText, { color: '#8CA0BA' }]}>{core.replaySpeed}x VITEZĂ</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.exportTripPdf(core.selectedTripId || 'trip_108');
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.spatialBtnText, { color: '#8CA0BA' }]}>📄 PDF CURSĂ</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.exportItpDossier();
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Text style={[styles.spatialBtnText, { color: '#8CA0BA' }]}>📋 DOSAR ITP</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Previous Trips List */}
                            <Text style={[styles.categoryTitle, { color: activeAccent.primary, marginTop: 10 }]}>
                                CURSE RECENTE ÎNREGISTRATE
                            </Text>
                            {core.tripsList.map((t) => {
                                const isSelected = core.selectedTripId === t.id;
                                return (
                                    <TouchableOpacity
                                        key={t.id}
                                        style={[styles.tripGlassCard, isSelected && { borderColor: activeAccent.primary, backgroundColor: activeAccent.bg }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.selectTripForReplay(t.id);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <View style={styles.tripGlassHeader}>
                                            <Text style={styles.tripGlassTitle}>{t.title}</Text>
                                            <Text style={styles.tripGlassDate}>{t.date}</Text>
                                        </View>
                                        <View style={styles.tripGlassRow}>
                                            <Text style={styles.tripGlassStat}>DIST: {t.km} km</Text>
                                            <Text style={styles.tripGlassStat}>VMAX: {t.maxSpeed} km/h</Text>
                                            <Text style={styles.tripGlassStat}>CONSUM: {t.avgConsumption} l/100km</Text>
                                            <Text style={styles.tripGlassStat}>ECO: {t.ecoScore}%</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* ──── FOAIA 3: TESLA SERVICE CENTER & PORTOFEL ACTE ──── */}
                    {spatialSheet === 'SERVICE' && (
                        <View>
                            <View style={styles.sheetHeaderRow}>
                                <View>
                                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                                        TESLA SERVICE CENTER · UZURĂ FIZICĂ & ACTE
                                    </Text>
                                    <Text style={styles.sheetSub}>MODELE ARRHENIUS / ARCHARD & TERMENE VALABILITATE</Text>
                                </View>
                            </View>

                            {/* CBM Wear List */}
                            <Text style={[styles.categoryTitle, { color: activeAccent.primary }]}>
                                COMPONENTE ȘI UZURĂ FIZICĂ PREDICTIVĂ (CBM)
                            </Text>
                            {core.maintenanceItems.map((item) => {
                                const isWarn = item.status === 'WARN';
                                const isCrit = item.status === 'ALERT';
                                const barColor = isCrit ? '#FF2A2A' : isWarn ? '#FFB800' : '#00FF66';
                                return (
                                    <View key={item.id} style={styles.cbmWearCard}>
                                        <View style={styles.cbmHeader}>
                                            <Text style={styles.cbmTitle}>{item.title.toUpperCase()}</Text>
                                            <Text style={[styles.cbmWearText, { color: barColor }]}>{item.wearPct}% UZURĂ</Text>
                                        </View>
                                        <View style={styles.cbmBarTrack}>
                                            <View style={[styles.cbmBarFill, { width: `${item.wearPct}%`, backgroundColor: barColor }]} />
                                        </View>
                                        <View style={styles.cbmFooter}>
                                            <Text style={styles.cbmKmText}>{item.currentKm} km / max {item.maxKm} km</Text>
                                            <TouchableOpacity
                                                style={[styles.cbmResetBtn, { borderColor: activeAccent.primary }]}
                                                onPress={() => {
                                                    hapticTap();
                                                    core.markServiceItemCompleted(item.id);
                                                }}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={[styles.cbmResetText, { color: activeAccent.primary }]}>[ ✓ RESET SERVICE ]</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Legal Documents */}
                            <Text style={[styles.categoryTitle, { color: activeAccent.primary, marginTop: 12 }]}>
                                PORTOFEL DIGITAL ACTE LEGALE
                            </Text>
                            <View style={styles.sensorsGrid}>
                                {core.legalDocuments.map((doc, idx) => {
                                    const isExp = doc.daysRemaining < 30;
                                    return (
                                        <View key={idx} style={[styles.docGlassCard, { borderColor: isExp ? '#FF2A2A66' : '#162B44' }]}>
                                            <View style={styles.docGlassHeader}>
                                                <Text style={[styles.docGlassType, { color: activeAccent.primary }]}>{doc.type}</Text>
                                                <View style={[styles.docGlassBadge, { backgroundColor: isExp ? '#FF2A2A22' : '#00FF6622', borderColor: isExp ? '#FF2A2A' : '#00FF66' }]}>
                                                    <Text style={[styles.docGlassBadgeText, { color: isExp ? '#FF2A2A' : '#00FF66' }]}>{doc.status}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.docGlassIssuer}>EMITENT: {doc.issuer}</Text>
                                            <Text style={styles.docGlassDays}>EXPIRĂ: <Text style={{ color: isExp ? '#FF2A2A' : '#FFFFFF', fontWeight: '900' }}>{doc.daysRemaining} ZILE</Text></Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ──── FOAIA 4: SENTRY GUARD DOME & MOBILITATE SMART ──── */}
                    {spatialSheet === 'SENTRY' && (
                        <View>
                            <View style={styles.sheetHeaderRow}>
                                <View>
                                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                                        SENTRY ENERGY DOME · SECURITATE & LOCALIZARE
                                    </Text>
                                    <Text style={styles.sheetSub}>RADAR PROTECȚIE PARCARE & MONITORIZARE GPS</Text>
                                </View>
                            </View>

                            <View style={styles.sentryBox}>
                                <View style={styles.sentryHeaderRow}>
                                    <View>
                                        <Text style={styles.sentryTitle}>SENTRY GUARD DOME</Text>
                                        <Text style={styles.sentrySub}>STARE: {core.sentryArmed ? 'ARMAT (RADAR MICROUNDE ON)' : 'DEZARMAT'}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.sentryToggleBtn, { backgroundColor: core.sentryArmed ? '#FF2A2A22' : '#00FF6622', borderColor: core.sentryArmed ? '#FF2A2A' : '#00FF66' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.setSentryArmed(!core.sentryArmed);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.sentryToggleText, { color: core.sentryArmed ? '#FF2A2A' : '#00FF66' }]}>
                                            {core.sentryArmed ? 'DEZARMEAZĂ' : 'ARMEAZĂ'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Shock Simulation Button */}
                                <TouchableOpacity
                                    style={[styles.shockTestBtn, { backgroundColor: `${activeAccent.primary}18`, borderColor: `${activeAccent.primary}55` }]}
                                    onPress={() => {
                                        hapticTap();
                                        core.triggerShockSimulation();
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[styles.shockTestText, { color: activeAccent.primary }]}>
                                        ⚡ SIMULEAZĂ ȘOC / TILT ASUPRA SENZORILOR 3D
                                    </Text>
                                </TouchableOpacity>

                                {/* Shock Event Log */}
                                {core.sentryEvents?.length > 0 && (
                                    <View style={styles.sentryAlertsList}>
                                        <Text style={styles.sentryAlertTitle}>EVENIMENTE RECENTE DETECTATE</Text>
                                        {core.sentryEvents.slice(0, 2).map((ev) => (
                                            <View key={ev.id} style={styles.sentryAlertRow}>
                                                <Text style={styles.sentryAlertTime}>{ev.time}</Text>
                                                <Text style={styles.sentryAlertDesc}>{ev.desc}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Valet Mode Limiter */}
                                <View style={[styles.sentryHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#162B44' }]}>
                                    <View>
                                        <Text style={styles.sentryTitle}>MOD VALET (LIMITATOR VITEZĂ/RPM)</Text>
                                        <Text style={styles.sentrySub}>LIMITĂ: {core.valetSpeedLimit} km/h · {core.valetRpmLimit} RPM</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.sentryToggleBtn, { backgroundColor: core.valetActive ? '#FFB80022' : '#091322', borderColor: core.valetActive ? '#FFB800' : '#16283D' }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.toggleValetMode();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.sentryToggleText, { color: core.valetActive ? '#FFB800' : '#8CA0BA' }]}>
                                            {core.valetActive ? 'ACTIV' : 'INACTIV'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* GPS Navigation Directions */}
                                <View style={[styles.sentryHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#162B44' }]}>
                                    <View>
                                        <Text style={styles.sentryTitle}>GĂSEȘTE-MI MAȘINA (GPS)</Text>
                                        <Text style={[styles.sentrySub, { color: activeAccent.primary }]}>
                                            {core.carGpsCoords.lat.toFixed(4)}°N, {core.carGpsCoords.lng.toFixed(4)}°E
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.sentryToggleBtn, { backgroundColor: activeAccent.bg, borderColor: activeAccent.primary }]}
                                        onPress={() => {
                                            hapticTap();
                                            core.openWalkingDirections();
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.sentryToggleText, { color: activeAccent.primary }]}>NAVIGHEAZĂ 📍</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Parking Ticket Countdown */}
                                <View style={styles.parkingRow}>
                                    <Text style={styles.parkingLabel}>CRONOMETRU TICHET PARCARE:</Text>
                                    <Text style={[styles.parkingTimeText, { color: core.parkingMinutesRemaining < 15 ? '#FF2A2A' : '#00FF66' }]}>
                                        {core.parkingMinutesRemaining} MIN
                                    </Text>
                                    <View style={styles.parkingChipsRow}>
                                        {[15, 30, 60].map((mins) => (
                                            <TouchableOpacity
                                                key={mins}
                                                style={styles.parkingChip}
                                                onPress={() => {
                                                    hapticTap();
                                                    core.addParkingTime(mins);
                                                }}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <Text style={[styles.parkingChipText, { color: activeAccent.primary }]}>+{mins}m</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ──── FOAIA 5: NEURAL COPILOT AI INGINER ──── */}
                    {spatialSheet === 'COPILOT' && (
                        <View>
                            <View style={styles.sheetHeaderRow}>
                                <View>
                                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                                        NEURAL COPILOT · ASISTENT DIAGNOZĂ AI
                                    </Text>
                                    <Text style={styles.sheetSub}>ANALIZĂ PREDICTIVĂ PE BAZA FIZICII 3D & TELEMETRIEI</Text>
                                </View>
                            </View>

                            {/* Diagnostic Chips */}
                            <View style={styles.copilotChipsRow}>
                                {[
                                    '🔬 Analizează geometria 3D și telemetria live',
                                    '🛞 Verifică uzura frânelor Archard și riscurile termice',
                                    '🔥 Evaluează starea miezului turbină CHRA',
                                    '📄 Generează raport sintetic pentru ITP',
                                ].map((chip, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.copilotChip}
                                        onPress={() => {
                                            hapticTap();
                                            core.sendAiPrompt(chip);
                                        }}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={styles.copilotChipText} numberOfLines={1}>{chip}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Chat Messages */}
                            <View style={styles.copilotChatBox}>
                                {core.aiMessages.slice(-3).map((m) => (
                                    <View key={m.id} style={styles.copilotMsgRow}>
                                        <Text style={[styles.copilotSender, { color: m.sender === 'user' ? activeAccent.primary : '#FFB800' }]}>
                                            {m.sender === 'user' ? '[PILOT]' : '[COPILOT AI]'}:
                                        </Text>
                                        <Text style={styles.copilotMsgText}>{m.text}</Text>
                                    </View>
                                ))}
                                {core.isAiLoading && (
                                    <Text style={[styles.copilotMsgText, { color: activeAccent.primary }]}>
                                        🤖 NEURAL COPILOT: Se analizează parametrii telemetriei...
                                    </Text>
                                )}
                            </View>

                            {/* Input Row */}
                            <View style={styles.copilotInputRow}>
                                <TextInput
                                    style={styles.copilotTextInput}
                                    placeholder="Întreabă Neural Copilot despre starea mașinii..."
                                    placeholderTextColor="#475569"
                                    value={copilotInput}
                                    onChangeText={setCopilotInput}
                                />
                                <TouchableOpacity
                                    style={[styles.copilotSendBtn, { backgroundColor: activeAccent.primary }]}
                                    onPress={() => {
                                        if (!copilotInput.trim()) return;
                                        hapticTap();
                                        core.sendAiPrompt(copilotInput);
                                        setCopilotInput('');
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={styles.copilotSendBtnText}>TRIMITE</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#04070D',
    },
    topHudBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#122338',
    },
    hudBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        flexShrink: 1,
    },
    holoBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
    },
    holoBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#000000',
    },
    netDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    vinHud: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    hudActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    hudActionBtn: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1E3A5F',
        backgroundColor: '#0A1524',
    },
    hudActionBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8EADC8',
        fontWeight: '700',
    },
    canvasContainer: {
        height: 250,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    hotspotsLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    spatialHotspot: {
        position: 'absolute',
        backgroundColor: 'rgba(10, 21, 36, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
    },
    hotspotText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
    },
    floatingSpeedHud: {
        position: 'absolute',
        top: 8,
        left: 14,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    floatingSpeedNumber: {
        fontFamily: MONO,
        fontSize: 36,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    floatingSpeedMeta: {
        alignItems: 'flex-start',
    },
    floatingSpeedUnit: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '800',
    },
    floatingRpmMeta: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
        fontVariant: ['tabular-nums'],
    },
    firingSequenceBadge: {
        position: 'absolute',
        top: 10,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(8, 17, 30, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1E3A5F',
        gap: 4,
    },
    firingBadgeLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#6A87A5',
        fontWeight: '700',
    },
    cylinderDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0D1E33',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#1E3A5F',
    },
    cylinderDotActive: {
        backgroundColor: '#00F0FF',
        borderColor: '#00F0FF',
    },
    cylinderDotText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#6A87A5',
        fontWeight: '700',
    },
    cylinderDotTextActive: {
        color: '#000000',
        fontWeight: '900',
    },
    cameraZonesBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#060C16',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#122338',
    },
    zoneBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16283D',
        backgroundColor: '#091322',
    },
    zoneBtnActive: {
        backgroundColor: '#00F0FF',
        borderColor: '#00F0FF',
    },
    zoneBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    zoneBtnTextActive: {
        color: '#04070D',
        fontWeight: '900',
    },
    spatialTabBar: {
        flexDirection: 'row',
        backgroundColor: '#060C16',
        borderBottomWidth: 1,
        borderBottomColor: '#122338',
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 6,
    },
    spatialTabBtn: {
        flex: 1,
        paddingVertical: 6,
        paddingHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16283D',
        backgroundColor: '#091322',
    },
    spatialTabText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    sheetContainer: {
        flex: 1,
        backgroundColor: 'rgba(6, 12, 22, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#122338',
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    sheetScroll: {
        flex: 1,
    },
    sheetHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#162B44',
    },
    sheetTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sheetSub: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
        marginTop: 2,
    },
    xrayToggleBtn: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
    },
    xrayToggleText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    spatialCategoryBox: {
        marginBottom: 10,
    },
    categoryTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    sensorsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    spatialSensorCard: {
        width: '48.8%',
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 5,
        padding: 6,
    },
    sensorCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    spatialSensorLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
        flex: 1,
        marginRight: 4,
    },
    spatialStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    sensorCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    spatialSensorVal: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    spatialSensorRef: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#475569',
    },
    replaySpeedBadge: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    replayGlassCard: {
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
    },
    replayTrack: {
        height: 6,
        backgroundColor: '#0C1B2E',
        borderRadius: 3,
        overflow: 'hidden',
        marginVertical: 8,
    },
    replayFill: {
        height: '100%',
        borderRadius: 3,
    },
    replayMetricsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#162B44',
        marginBottom: 8,
    },
    replayMetricCol: {
        alignItems: 'center',
        flex: 1,
    },
    replayMetricKey: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    replayMetricVal: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    replayBtnsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    spatialBtn: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    spatialBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    tripGlassCard: {
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 4,
        padding: 8,
        marginBottom: 6,
    },
    tripGlassHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tripGlassTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    tripGlassDate: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    tripGlassRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    tripGlassStat: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
    cbmWearCard: {
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 5,
        padding: 8,
        marginBottom: 6,
    },
    cbmHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cbmTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    cbmWearText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    cbmBarTrack: {
        height: 5,
        backgroundColor: '#0C1B2E',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    cbmBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    cbmFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cbmKmText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    cbmResetBtn: {
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        backgroundColor: '#060C16',
    },
    cbmResetText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    docGlassCard: {
        width: '48.8%',
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 5,
        padding: 6,
    },
    docGlassHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    docGlassType: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    docGlassBadge: {
        borderWidth: 1,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
    },
    docGlassBadgeText: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
    },
    docGlassIssuer: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
    },
    docGlassDays: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
        marginTop: 2,
    },
    sentryBox: {
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
    },
    sentryHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sentryTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    sentrySub: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#64748B',
        marginTop: 2,
    },
    sentryToggleBtn: {
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    sentryToggleText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    shockTestBtn: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
    },
    shockTestText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    sentryAlertsList: {
        marginTop: 6,
        padding: 6,
        backgroundColor: '#060C16',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#162B44',
    },
    sentryAlertTitle: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#FFB800',
        fontWeight: '800',
        marginBottom: 2,
    },
    sentryAlertRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    sentryAlertTime: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
    },
    sentryAlertDesc: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
    parkingRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#162B44',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    parkingLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
    parkingTimeText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    parkingChipsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    parkingChip: {
        backgroundColor: '#091322',
        borderWidth: 1,
        borderColor: '#162B44',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
    },
    parkingChipText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
    },
    copilotChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    copilotChip: {
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    copilotChipText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
    copilotChatBox: {
        backgroundColor: 'rgba(6, 12, 22, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 5,
        padding: 8,
        minHeight: 70,
        marginBottom: 8,
    },
    copilotMsgRow: {
        flexDirection: 'row',
        marginBottom: 4,
        gap: 6,
    },
    copilotSender: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    copilotMsgText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#E2E8F0',
        flex: 1,
    },
    copilotInputRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    copilotTextInput: {
        flex: 1,
        backgroundColor: 'rgba(10, 22, 38, 0.85)',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontFamily: MONO,
        fontSize: 9,
        color: '#FFFFFF',
    },
    copilotSendBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    copilotSendBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#04070D',
    },
});
