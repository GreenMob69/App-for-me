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
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.SPATIAL_CANVAS];

// ─── 1. Motor Matematic 3D cu Pitch (Dive) & Roll (Ruliu) ─────────────────────
function project3D(x, y, z, rotX, rotY, roll = 0, pitch = 0, zoom = 1.0, centerX = SCREEN_WIDTH / 2, centerY = 190) {
    // 9. Aplicare Pitch (Dive la frânare / Squat la accelerare)
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const yP = y * cosP - z * sinP;
    const zP = y * sinP + z * cosP;

    // 9. Aplicare Roll (Înclinare laterală la forțe G)
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
    const fov = 340 * zoom;
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

export default function SpatialCanvasParadigm() {
    const insets = useSafeInsets();
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // 4 Zone de Cameră: 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    const [cameraZone, setCameraZone] = useState('OVERVIEW');
    const [activeDrawer, setActiveDrawer] = useState(null);

    // 2. Exploded Powertrain X-Ray View state
    const [isExplodedView, setIsExplodedView] = useState(false);

    // Unghiuri de rotație 3D
    const [rotY, setRotY] = useState(0.55);
    const [rotX, setRotX] = useState(0.35);
    const [wheelAngle, setWheelAngle] = useState(0);

    // 3. Dynamic Aerodynamic Flow Streamline offset
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

    // 9. Calcul Pitch & Roll din forțe G
    const suspensionPitch = useMemo(() => {
        // Diving under hard braking: -G_long tilts nose down
        return Math.max(-0.08, Math.min(0.08, -gForceLong * 0.05));
    }, [gForceLong]);

    const suspensionRoll = useMemo(() => {
        // Body roll under cornering
        return Math.max(-0.09, Math.min(0.09, gForceLat * 0.06));
    }, [gForceLat]);

    // 3. Buclă de rotație a roților și linii aerodinamice CFD
    useEffect(() => {
        if (speed > 0) {
            const interval = setInterval(() => {
                setWheelAngle((prev) => (prev + (speed / 12)) % 360);
                setAeroOffset((prev) => (prev + (speed / 8)) % 100);
            }, 33);
            return () => clearInterval(interval);
        }
    }, [speed]);

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

    // 6. PanResponder cu Inerție Fină și Spring Decay
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
                    // 6. Angular momentum decay
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

    // ── GEOMETRIE 3D DIGITAL TWIN CU 1. BACK-FACE CULLING & 2. X-RAY VIEW ──────
    const carMesh3D = useMemo(() => {
        const explode = isExplodedView ? 0.35 : 0.0;
        const p = (x, y, z) => project3D(x, y, z, rotX, rotY, suspensionRoll, suspensionPitch);

        // Capotă & Bot (cu explozie exterioară în mod X-Ray)
        const noseL = p(-0.7 - explode, 0.12, 1.7 + explode);
        const noseR = p(0.7 + explode, 0.12, 1.7 + explode);
        const hoodL = p(-0.65 - explode, 0.38 + explode, 0.9);
        const hoodR = p(0.65 + explode, 0.38 + explode, 0.9);

        // Cabină & Plafon
        const roofFrontL = p(-0.52, 0.72 + explode * 0.5, 0.35);
        const roofFrontR = p(0.52, 0.72 + explode * 0.5, 0.35);
        const roofRearL = p(-0.50, 0.68 + explode * 0.5, -0.65);
        const roofRearR = p(0.50, 0.68 + explode * 0.5, -0.65);

        // Spate & Portbagaj
        const trunkL = p(-0.62 - explode, 0.40, -1.35 - explode);
        const trunkR = p(0.62 + explode, 0.40, -1.35 - explode);
        const tailL = p(-0.68 - explode, 0.22, -1.75 - explode);
        const tailR = p(0.68 + explode, 0.22, -1.75 - explode);

        // Praguri inferioare
        const sillFrontL = p(-0.72 - explode, -0.05, 0.9);
        const sillFrontR = p(0.72 + explode, -0.05, 0.9);
        const sillRearL = p(-0.72 - explode, -0.05, -1.0);
        const sillRearR = p(0.72 + explode, -0.05, -1.0);

        // 2. Componente Interne Powertrain expuse în X-Ray
        const engineBlockFront = p(0, 0.18, 1.2);
        const turboCore = p(0.28, 0.15, 0.85);
        const exhaustDownpipe = p(0.18, 0.05, -0.2);

        // Poziții 4 Roți
        const steerAngle = (gForceLat || 0) * 0.35;
        const wheelFL = p(-0.78, -0.02, 1.05);
        const wheelFR = p(0.78, -0.02, 1.05);
        const wheelRL = p(-0.78, -0.02, -1.05);
        const wheelRR = p(0.78, -0.02, -1.05);

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
    }, [rotX, rotY, suspensionRoll, suspensionPitch, isExplodedView, gForceLat]);

    // Culoare dinamică frâne în funcție de temperatură
    const brakeColor = brakeFluidTemp > 140 ? '#FF2A2A' : brakeFluidTemp > 105 ? '#FFB800' : '#00F0FF';

    // 7. Detecție Polei & Condiții Drum
    const isIceRisk = telemetry.criticalAlerts.some(a => a.id === 'BLACK_ICE');

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
            <StatusBar barStyle="light-content" backgroundColor="#04070D" />

            {/* ── 1. Antet Spațial cu Butoane Protejate la Atingere ── */}
            <View style={styles.topHudBar}>
                <View style={styles.hudBrand}>
                    <View style={styles.holoBadge}>
                        <Text style={styles.holoBadgeText}>3D DIGITAL TWIN</Text>
                    </View>
                    <View style={[styles.netDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.vinHud} numberOfLines={1}>
                        {activeVehicle?.model || 'ACURA CDX // AUDI 3D'}
                    </Text>
                </View>

                {/* Acțiuni de Top cu Ținte Mari de Atingere */}
                <View style={styles.hudActions}>
                    {/* 2. Buton Mod X-Ray Powertrain */}
                    <TouchableOpacity
                        style={[
                            styles.hudActionBtn,
                            { borderColor: '#00F0FF', backgroundColor: isExplodedView ? '#00F0FF33' : '#00F0FF1A' },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setIsExplodedView(!isExplodedView);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: '#00F0FF' }]}>
                            {isExplodedView ? '🔬 X-RAY ON' : '🔬 X-RAY'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.hudActionBtn, { borderColor: '#FFB800', backgroundColor: '#FFB80018' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: '#FFB800' }]}>🎮 DEMO</Text>
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
                        style={[styles.hudActionBtn, { backgroundColor: '#00F0FF', borderColor: '#00F0FF' }]}
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
                </View>
            </View>

            {/* ── 2. Zona Centrală: Canvas Tridimensional Interactiv ── */}
            <View style={styles.canvasContainer} {...panResponder.panHandlers}>
                <Svg width={SCREEN_WIDTH} height={380} viewBox={`0 0 ${SCREEN_WIDTH} 380`}>
                    <Defs>
                        {/* 4. PBR Metal Shading Gradient */}
                        <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#0B1A2E" stopOpacity={isExplodedView ? 0.35 : 0.95} />
                            <Stop offset="0.5" stopColor="#1E3A5F" stopOpacity={isExplodedView ? 0.25 : 0.9} />
                            <Stop offset="1" stopColor="#03070E" stopOpacity={isExplodedView ? 0.35 : 0.95} />
                        </LinearGradient>
                        <LinearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#00F0FF" stopOpacity={isExplodedView ? 0.2 : 0.45} />
                            <Stop offset="1" stopColor="#004466" stopOpacity={isExplodedView ? 0.1 : 0.2} />
                        </LinearGradient>
                        {/* 10. Fascicul Faruri 3D Proiectat în Față */}
                        <LinearGradient id="headlightBeam" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#00F0FF" stopOpacity="0.35" />
                            <Stop offset="1" stopColor="#00F0FF" stopOpacity="0.0" />
                        </LinearGradient>
                    </Defs>

                    {/* 7. Grilă Perspective Sol (cu reacție la Polei/Asfalt Umed) */}
                    {[-1.8, -0.9, 0, 0.9, 1.8].map((lineX, i) => {
                        const pStart = project3D(lineX, -0.06, -2.5, rotX, rotY, suspensionRoll, suspensionPitch);
                        const pEnd = project3D(lineX, -0.06, 2.8, rotX, rotY, suspensionRoll, suspensionPitch);
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

                    {/* 10. Umbre Sol sub Fiecare Roată */}
                    {carMesh3D.wheels.map((wh, idx) => (
                        <Ellipse
                            key={`shadow-${idx}`}
                            cx={wh.pos.x}
                            cy={wh.pos.y + 14}
                            rx={16}
                            ry={5}
                            fill="rgba(0, 0, 0, 0.65)"
                        />
                    ))}

                    {/* 10. Fascicul Faruri 3D Proiectat în Față */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${project3D(1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch).x},${project3D(1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch).y}
                            ${project3D(-1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch).x},${project3D(-1.6, -0.05, 3.4, rotX, rotY, suspensionRoll, suspensionPitch).y}
                        `}
                        fill="url(#headlightBeam)"
                    />

                    {/* 2. Componente Interne Expuse în X-Ray */}
                    {isExplodedView && (
                        <G>
                            {/* Bloc Motor 3D */}
                            <Circle cx={carMesh3D.engineBlockFront.x} cy={carMesh3D.engineBlockFront.y} r={18} fill="#2A3B4C" stroke="#00F0FF" strokeWidth="1.5" />
                            {/* Turbină CHRA Incandescentă */}
                            <Circle cx={carMesh3D.turboCore.x} cy={carMesh3D.turboCore.y} r={11} fill="#FF5500" stroke="#FF2A2A" strokeWidth="2" />
                            {/* Galerie Evacuare */}
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

                    {/* Fațete Poligonale Caroserie (cu 1. Back-Face Culling) */}
                    {/* Capotă */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                        `}
                        fill="url(#carBodyGrad)"
                        stroke="#00F0FF"
                        strokeWidth="1.2"
                    />

                    {/* Parbriz Sticlă */}
                    <Polygon
                        points={`
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.roofFrontR.x},${carMesh3D.roofFrontR.y}
                            ${carMesh3D.roofFrontL.x},${carMesh3D.roofFrontL.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke="#00F0FF"
                        strokeWidth="1.5"
                    />

                    {/* Plafon Aerodinamic */}
                    <Polygon
                        points={`
                            ${carMesh3D.roofFrontL.x},${carMesh3D.roofFrontL.y}
                            ${carMesh3D.roofFrontR.x},${carMesh3D.roofFrontR.y}
                            ${carMesh3D.roofRearR.x},${carMesh3D.roofRearR.y}
                            ${carMesh3D.roofRearL.x},${carMesh3D.roofRearL.y}
                        `}
                        fill="url(#carBodyGrad)"
                        stroke="#00F0FF"
                        strokeWidth="1"
                    />

                    {/* Lunetă & Portbagaj */}
                    <Polygon
                        points={`
                            ${carMesh3D.roofRearL.x},${carMesh3D.roofRearL.y}
                            ${carMesh3D.roofRearR.x},${carMesh3D.roofRearR.y}
                            ${carMesh3D.trunkR.x},${carMesh3D.trunkR.y}
                            ${carMesh3D.trunkL.x},${carMesh3D.trunkL.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke="#00F0FF"
                        strokeWidth="1.2"
                    />

                    {/* Spate & Stopuri LED */}
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

                    {/* 3. Linii Aerodinamice CFD (Streamlines animate la viteză) */}
                    {speed > 15 && (
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

                    {/* 4 Roți 3D Active cu Spițe și Discuri de Frână Incandescente */}
                    {carMesh3D.wheels.map((wh, idx) => {
                        const spokeRad = (wheelAngle * Math.PI) / 180;
                        const r = 16;
                        return (
                            <G key={`wheel-${idx}`}>
                                {/* Anvelopă */}
                                <Circle
                                    cx={wh.pos.x}
                                    cy={wh.pos.y}
                                    r={r}
                                    fill="#060B12"
                                    stroke="#1E293B"
                                    strokeWidth="3"
                                />
                                {/* Disc de Frână Termic Activ */}
                                <Circle
                                    cx={wh.pos.x}
                                    cy={wh.pos.y}
                                    r={r * 0.65}
                                    fill="#0C1524"
                                    stroke={brakeColor}
                                    strokeWidth="2"
                                    strokeDasharray="8, 4"
                                />
                                {/* Spițe Roată Rotative */}
                                <Line
                                    x1={wh.pos.x - Math.cos(spokeRad) * (r * 0.7)}
                                    y1={wh.pos.y - Math.sin(spokeRad) * (r * 0.7)}
                                    x2={wh.pos.x + Math.cos(spokeRad) * (r * 0.7)}
                                    y2={wh.pos.y + Math.sin(spokeRad) * (r * 0.7)}
                                    stroke="#8CA0BA"
                                    strokeWidth="1.8"
                                />
                                <Line
                                    x1={wh.pos.x - Math.sin(spokeRad) * (r * 0.7)}
                                    y1={wh.pos.y + Math.cos(spokeRad) * (r * 0.7)}
                                    x2={wh.pos.x + Math.sin(spokeRad) * (r * 0.7)}
                                    y2={wh.pos.y - Math.cos(spokeRad) * (r * 0.7)}
                                    stroke="#8CA0BA"
                                    strokeWidth="1.8"
                                />
                            </G>
                        );
                    })}
                </Svg>

                {/* 5. Butoane Hotspot Tridimensionale cu Deschidere Directă a Sertarelor */}
                <View style={styles.hotspotsLayer} pointerEvents="box-none">
                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 90, left: SCREEN_WIDTH / 2 - 40 }]}
                        onPress={() => {
                            hapticTap();
                            setActiveDrawer(activeDrawer === 'ENGINE' ? null : 'ENGINE');
                        }}
                    >
                        <Text style={styles.hotspotText}>🔥 MOTOR {coolantTemp}°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 190, left: 16 }]}
                        onPress={() => {
                            hapticTap();
                            setActiveDrawer(activeDrawer === 'BRAKES' ? null : 'BRAKES');
                        }}
                    >
                        <Text style={[styles.hotspotText, { color: brakeColor }]}>🛞 FRÂNE {brakeFluidTemp}°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialHotspot, { top: 220, right: 16 }]}
                        onPress={() => {
                            hapticTap();
                            setActiveDrawer(activeDrawer === 'WEIBULL' ? null : 'WEIBULL');
                        }}
                    >
                        <Text style={[styles.hotspotText, { color: '#00FF66' }]}>🛡️ RUL {minRulKm}k</Text>
                    </TouchableOpacity>
                </View>

                {/* HUD Plutitor Viteză */}
                <View style={styles.floatingSpeedHud} pointerEvents="none">
                    <Text style={styles.floatingSpeedNumber}>{speed}</Text>
                    <View style={styles.floatingSpeedMeta}>
                        <Text style={styles.floatingSpeedUnit}>KM/H</Text>
                        <Text style={styles.floatingRpmMeta}>{rpm} RPM · TR. {gear}</Text>
                    </View>
                </View>

                {/* Secvență Aprindere 1-2-4-5-3 */}
                <View style={styles.firingSequenceBadge} pointerEvents="none">
                    <Text style={styles.firingBadgeLabel}>APRINDERE: </Text>
                    {[1, 2, 4, 5, 3].map((cyl) => (
                        <View
                            key={cyl}
                            style={[
                                styles.cylinderDot,
                                activeCylinder === cyl && styles.cylinderDotActive,
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
                        style={[styles.zoneBtn, cameraZone === zone.id && styles.zoneBtnActive]}
                        onPress={() => {
                            hapticTap();
                            setCameraZone(zone.id);
                        }}
                    >
                        <Text style={[styles.zoneBtnText, cameraZone === zone.id && styles.zoneBtnTextActive]}>
                            {zone.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── 4. Sertare Holografice Inferioare (Glass Drawers) ── */}
            <View style={styles.drawersRow}>
                <TouchableOpacity
                    style={[styles.drawerCard, activeDrawer === 'ENGINE' && styles.drawerCardActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'ENGINE' ? null : 'ENGINE');
                    }}
                    activeOpacity={0.8}
                >
                    <Text style={styles.drawerLabel}>TERMIC & TURBĂ</Text>
                    <Text style={styles.drawerValue}>{coolantTemp}°C · {boost}b</Text>
                    {activeDrawer === 'ENGINE' && (
                        <View style={styles.drawerExpandedContent}>
                            <Text style={styles.drawerSubLine}>Ulei motor: {oilTemp}°C</Text>
                            <Text style={styles.drawerSubLine}>Gaze evacuare EGT: {exhaustTemp}°C</Text>
                            <Text style={styles.drawerSubLine}>Miez turbină CHRA: {chraTemp}°C</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerCard, activeDrawer === 'BRAKES' && styles.drawerCardActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'BRAKES' ? null : 'BRAKES');
                    }}
                    activeOpacity={0.8}
                >
                    <Text style={styles.drawerLabel}>ȘASIU & FRÂNE</Text>
                    <Text style={[styles.drawerValue, { color: brakeColor }]}>{brakeFluidTemp}°C</Text>
                    {activeDrawer === 'BRAKES' && (
                        <View style={styles.drawerExpandedContent}>
                            <Text style={styles.drawerSubLine}>Energie disipată: {brakeEnergyTrip} kJ</Text>
                            <Text style={styles.drawerSubLine}>G-Force Lat: {gForceLat} G</Text>
                            <Text style={styles.drawerSubLine}>G-Force Long: {gForceLong} G</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerCard, activeDrawer === 'WEIBULL' && styles.drawerCardActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'WEIBULL' ? null : 'WEIBULL');
                    }}
                    activeOpacity={0.8}
                >
                    <Text style={styles.drawerLabel}>RUL WEIBULL</Text>
                    <Text style={[styles.drawerValue, { color: '#00FF66' }]}>{minRulKm} KM</Text>
                    {activeDrawer === 'WEIBULL' && (
                        <View style={styles.drawerExpandedContent}>
                            <Text style={styles.drawerSubLine}>Risc pană: {breakdownRisk}%</Text>
                            <Text style={styles.drawerSubLine}>SoH baterie: {batterySoH}%</Text>
                            <Text style={styles.drawerSubLine}>Tensiune: {batteryVoltage} V</Text>
                        </View>
                    )}
                </TouchableOpacity>
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
        flexShrink: 1,
    },
    holoBadge: {
        backgroundColor: '#00F0FF',
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
        height: 380,
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
        borderColor: '#00F0FF66',
    },
    hotspotText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
        color: '#00F0FF',
    },
    floatingSpeedHud: {
        position: 'absolute',
        top: 14,
        left: 16,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    floatingSpeedNumber: {
        fontFamily: MONO,
        fontSize: 48,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    floatingSpeedMeta: {
        alignItems: 'flex-start',
    },
    floatingSpeedUnit: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: '800',
        color: '#00F0FF',
    },
    floatingRpmMeta: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8CA0BA',
        fontVariant: ['tabular-nums'],
    },
    firingSequenceBadge: {
        position: 'absolute',
        top: 18,
        right: 16,
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
        paddingVertical: 8,
        backgroundColor: '#060C16',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#122338',
    },
    zoneBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
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
        fontSize: 9,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    zoneBtnTextActive: {
        color: '#04070D',
        fontWeight: '900',
    },
    drawersRow: {
        flex: 1,
        flexDirection: 'row',
        padding: 8,
        gap: 6,
    },
    drawerCard: {
        flex: 1,
        backgroundColor: '#081220',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#162B44',
        padding: 8,
    },
    drawerCardActive: {
        borderColor: '#00F0FF',
        backgroundColor: '#0A182B',
    },
    drawerLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#6A87A5',
        fontWeight: '700',
        marginBottom: 4,
    },
    drawerValue: {
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    drawerExpandedContent: {
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 0.5,
        borderTopColor: '#1A3352',
        gap: 2,
    },
    drawerSubLine: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
});
