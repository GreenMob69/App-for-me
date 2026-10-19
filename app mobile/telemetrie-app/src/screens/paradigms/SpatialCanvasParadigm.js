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
} from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.SPATIAL_CANVAS];

// ─── Motor Matematic 3D Tridimensional ──────────────────────────────────────
function project3D(x, y, z, rotX, rotY, zoom = 1.0, centerX = SCREEN_WIDTH / 2, centerY = 190) {
    // Rotație pe axa Y (orizontală)
    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    // Rotație pe axa X (verticală/înclinare)
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

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

export default function SpatialCanvasParadigm() {
    const insets = useSafeInsets();
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // 4 Zone de Cameră: 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    const [cameraZone, setCameraZone] = useState('OVERVIEW');
    const [activeDrawer, setActiveDrawer] = useState(null);

    // Unghiuri de rotație 3D
    const [rotY, setRotY] = useState(0.55);
    const [rotX, setRotX] = useState(0.35);
    const [wheelAngle, setWheelAngle] = useState(0);

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

    // Buclă de rotație a roților la deplasare (60 FPS sincronizat)
    useEffect(() => {
        if (speed > 0) {
            const interval = setInterval(() => {
                setWheelAngle((prev) => (prev + (speed / 12)) % 360);
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

    // PanResponder pentru rotire tactilă 360° fluidă
    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderMove: (_, gestureState) => {
                    setRotY((prev) => prev + gestureState.vx * 0.008);
                    setRotX((prev) => Math.max(0.08, Math.min(1.2, prev - gestureState.vy * 0.006)));
                },
            }),
        []
    );

    // ── GEOMETRIE 3D DIGITAL TWIN (Stil Tesla Model 3 / Cyberpunk) ──
    // Puncte esențiale caroserie (x: lățime, y: înălțime, z: lungime)
    const carMesh3D = useMemo(() => {
        const p = (x, y, z) => project3D(x, y, z, rotX, rotY);

        // Capotă & Bot
        const noseL = p(-0.7, 0.12, 1.7);
        const noseR = p(0.7, 0.12, 1.7);
        const hoodL = p(-0.65, 0.38, 0.9);
        const hoodR = p(0.65, 0.38, 0.9);

        // Cabină & Plafon
        const roofFrontL = p(-0.52, 0.72, 0.35);
        const roofFrontR = p(0.52, 0.72, 0.35);
        const roofRearL = p(-0.50, 0.68, -0.65);
        const roofRearR = p(0.50, 0.68, -0.65);

        // Spate & Portbagaj
        const trunkL = p(-0.62, 0.40, -1.35);
        const trunkR = p(0.62, 0.40, -1.35);
        const tailL = p(-0.68, 0.22, -1.75);
        const tailR = p(0.68, 0.22, -1.75);

        // Praguri inferioare
        const sillFrontL = p(-0.72, -0.05, 0.9);
        const sillFrontR = p(0.72, -0.05, 0.9);
        const sillRearL = p(-0.72, -0.05, -1.0);
        const sillRearR = p(0.72, -0.05, -1.0);

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
            wheels: [
                { pos: wheelFL, label: 'FL', isFront: true, steer: steerAngle },
                { pos: wheelFR, label: 'FR', isFront: true, steer: steerAngle },
                { pos: wheelRL, label: 'RL', isFront: false, steer: 0 },
                { pos: wheelRR, label: 'RR', isFront: false, steer: 0 },
            ],
        };
    }, [rotX, rotY, gForceLat]);

    // Culoare dinamică frâne în funcție de temperatură
    const brakeColor = brakeFluidTemp > 140 ? '#FF2A2A' : brakeFluidTemp > 105 ? '#FFB800' : '#00F0FF';

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
                    <TouchableOpacity
                        style={[styles.hudActionBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF1A' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
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
                        <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#0B1A2E" stopOpacity="0.95" />
                            <Stop offset="0.5" stopColor="#07101E" stopOpacity="0.9" />
                            <Stop offset="1" stopColor="#03070E" stopOpacity="0.95" />
                        </LinearGradient>
                        <LinearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#00F0FF" stopOpacity="0.45" />
                            <Stop offset="1" stopColor="#004466" stopOpacity="0.2" />
                        </LinearGradient>
                        <LinearGradient id="headlightBeam" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#00F0FF" stopOpacity="0.3" />
                            <Stop offset="1" stopColor="#00F0FF" stopOpacity="0.0" />
                        </LinearGradient>
                    </Defs>

                    {/* Grilă Perspective Sol */}
                    {[-1.8, -0.9, 0, 0.9, 1.8].map((lineX, i) => {
                        const pStart = project3D(lineX, -0.06, -2.5, rotX, rotY);
                        const pEnd = project3D(lineX, -0.06, 2.8, rotX, rotY);
                        return (
                            <Line
                                key={`grid-${i}`}
                                x1={pStart.x}
                                y1={pStart.y}
                                x2={pEnd.x}
                                y2={pEnd.y}
                                stroke="rgba(0, 240, 255, 0.12)"
                                strokeWidth="1"
                                strokeDasharray="3, 3"
                            />
                        );
                    })}

                    {/* Fascicul Faruri 3D Proiectat în Față */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${project3D(1.6, -0.05, 3.4, rotX, rotY).x},${project3D(1.6, -0.05, 3.4, rotX, rotY).y}
                            ${project3D(-1.6, -0.05, 3.4, rotX, rotY).x},${project3D(-1.6, -0.05, 3.4, rotX, rotY).y}
                        `}
                        fill="url(#headlightBeam)"
                    />

                    {/* Fațete Poligonale Caroserie (PBR Shading) */}
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

                    {/* Linii Laterale Profil */}
                    <Line
                        x1={carMesh3D.noseL.x} y1={carMesh3D.noseL.y}
                        x2={carMesh3D.sillFrontL.x} y2={carMesh3D.sillFrontL.y}
                        stroke="#00F0FF" strokeWidth="1"
                    />
                    <Line
                        x1={carMesh3D.noseR.x} y1={carMesh3D.noseR.y}
                        x2={carMesh3D.sillFrontR.x} y2={carMesh3D.sillFrontR.y}
                        stroke="#00F0FF" strokeWidth="1"
                    />
                    <Line
                        x1={carMesh3D.sillFrontL.x} y1={carMesh3D.sillFrontL.y}
                        x2={carMesh3D.sillRearL.x} y2={carMesh3D.sillRearL.y}
                        stroke="#00F0FF" strokeWidth="1"
                    />
                    <Line
                        x1={carMesh3D.sillFrontR.x} y1={carMesh3D.sillFrontR.y}
                        x2={carMesh3D.sillRearR.x} y2={carMesh3D.sillRearR.y}
                        stroke="#00F0FF" strokeWidth="1"
                    />

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
                                styles.cylDot,
                                activeCylinder === cyl && styles.cylDotActive,
                            ]}
                        >
                            <Text style={[styles.cylDotText, activeCylinder === cyl && { color: '#030508' }]}>
                                {cyl}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.touchHintContainer} pointerEvents="none">
                    <Text style={styles.touchHintText}>⟲ ATINGE ȘI GLISEAZĂ PENTRU ROTAȚIE 360° SPAȚIALĂ</Text>
                </View>
            </View>

            {/* ── 3. Selectorul celor 4 Camere Cinematic ── */}
            <View style={styles.cameraPillsRow}>
                {[
                    { id: 'OVERVIEW', label: '1. GENERAL' },
                    { id: 'ENGINE_BAY', label: '2. MOTOR' },
                    { id: 'CHASSIS_BRAKES', label: '3. FRÂNE' },
                    { id: 'HIGHWAY_CHASE', label: '4. PILOT' },
                ].map((cam) => (
                    <TouchableOpacity
                        key={cam.id}
                        style={[
                            styles.cameraPill,
                            cameraZone === cam.id && styles.cameraPillActive,
                        ]}
                        onPress={() => {
                            hapticTap();
                            setCameraZone(cam.id);
                        }}
                    >
                        <Text
                            style={[
                                styles.cameraPillText,
                                cameraZone === cam.id && styles.cameraPillTextActive,
                            ]}
                        >
                            {cam.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── 4. Sertare Holografice Inferioare (Glass Drawers) ── */}
            <View style={styles.drawersBar}>
                <TouchableOpacity
                    style={[styles.drawerBtn, activeDrawer === 'TELEMETRY' && styles.drawerBtnActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'TELEMETRY' ? null : 'TELEMETRY');
                    }}
                >
                    <Text style={styles.drawerBtnText}>⚡ PARAMETRI VITALI</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerBtn, activeDrawer === 'THERMAL' && styles.drawerBtnActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'THERMAL' ? null : 'THERMAL');
                    }}
                >
                    <Text style={styles.drawerBtnText}>🔥 FRÂNE & MIEZ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerBtn, activeDrawer === 'RUL' && styles.drawerBtnActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'RUL' ? null : 'RUL');
                    }}
                >
                    <Text style={styles.drawerBtnText}>🛡️ FIABILITATE RUL</Text>
                </TouchableOpacity>
            </View>

            {/* Sertar Extins Holografic */}
            {activeDrawer !== null && (
                <View style={styles.drawerContentCard}>
                    <View style={styles.drawerHeader}>
                        <Text style={styles.drawerTitle}>
                            {activeDrawer === 'TELEMETRY' && 'RAPORT TELEMETRIE DIGITAL TWIN'}
                            {activeDrawer === 'THERMAL' && 'STATUS TERMIC FRÂNE & TURBOMECANICĂ'}
                            {activeDrawer === 'RUL' && 'PREDICTIV WEIBULL & DURATĂ DE VIAȚĂ (RUL)'}
                        </Text>
                        <TouchableOpacity onPress={() => setActiveDrawer(null)}>
                            <Text style={styles.closeDrawerText}>[ ✖ ÎNCHIDE ]</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.drawerDataRow}>
                        {activeDrawer === 'TELEMETRY' && (
                            <>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>BOOST TURBO</Text>
                                    <Text style={styles.dataVal}>{boost} BAR</Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>ANTIGEL</Text>
                                    <Text style={styles.dataVal}>{coolantTemp} °C</Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>TENSIUNE ECU</Text>
                                    <Text style={styles.dataVal}>{batteryVoltage} V</Text>
                                </View>
                            </>
                        )}

                        {activeDrawer === 'THERMAL' && (
                            <>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>LICHID FRÂNĂ</Text>
                                    <Text style={[styles.dataVal, brakeFluidTemp > 140 && { color: '#FF2A2A' }]}>
                                        {brakeFluidTemp} °C
                                    </Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>MIEZ TURBINĂ</Text>
                                    <Text style={styles.dataVal}>{chraTemp} °C</Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>ENERGIE FRÂNARE</Text>
                                    <Text style={styles.dataVal}>{brakeEnergyTrip} kJ</Text>
                                </View>
                            </>
                        )}

                        {activeDrawer === 'RUL' && (
                            <>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>RUL MINIM</Text>
                                    <Text style={[styles.dataVal, { color: '#00FF66' }]}>{minRulKm} KM</Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>RISC PANĂ</Text>
                                    <Text style={styles.dataVal}>{breakdownRisk} %</Text>
                                </View>
                                <View style={styles.drawerDataCell}>
                                    <Text style={styles.dataLabel}>SOH BATERIE</Text>
                                    <Text style={styles.dataVal}>{batterySoH} %</Text>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            )}
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 240, 255, 0.2)',
        backgroundColor: 'rgba(4, 7, 13, 0.95)',
    },
    hudBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    holoBadge: {
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#00F0FF',
        marginRight: 6,
    },
    holoBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#00F0FF',
    },
    netDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    vinHud: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#94A3B8',
        fontWeight: '700',
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
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
    },
    hudActionBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#94A3B8',
        fontWeight: '700',
    },
    canvasContainer: {
        flex: 1,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    floatingSpeedHud: {
        position: 'absolute',
        top: 14,
        left: 20,
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    floatingSpeedNumber: {
        fontFamily: MONO,
        fontSize: 50,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        letterSpacing: -1,
    },
    floatingSpeedMeta: {
        marginLeft: 8,
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
        color: '#94A3B8',
        marginTop: 2,
        fontVariant: ['tabular-nums'],
    },
    firingSequenceBadge: {
        position: 'absolute',
        top: 18,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 18, 30, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
    },
    firingBadgeLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        fontWeight: '700',
    },
    cylDot: {
        width: 14,
        height: 14,
        borderRadius: 2,
        backgroundColor: '#08101C',
        borderWidth: 1,
        borderColor: '#16263D',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 3,
    },
    cylDotActive: {
        backgroundColor: '#00F0FF',
        borderColor: '#00F0FF',
    },
    cylDotText: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
        color: '#64748B',
    },
    touchHintContainer: {
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    touchHintText: {
        fontFamily: MONO,
        fontSize: 8,
        color: 'rgba(148, 163, 184, 0.6)',
        letterSpacing: 1,
    },
    cameraPillsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(6, 11, 20, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 240, 255, 0.15)',
    },
    cameraPill: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        marginHorizontal: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
        backgroundColor: '#0A1424',
    },
    cameraPillActive: {
        borderColor: '#00F0FF',
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
    },
    cameraPillText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '700',
        color: '#94A3B8',
    },
    cameraPillTextActive: {
        color: '#00F0FF',
        fontWeight: '900',
    },
    drawersBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
        backgroundColor: '#030508',
    },
    drawerBtn: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#090E17',
    },
    drawerBtnActive: {
        borderColor: '#00F0FF',
        backgroundColor: 'rgba(0, 240, 255, 0.1)',
    },
    drawerBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#E2E8F0',
        fontWeight: '700',
    },
    drawerContentCard: {
        backgroundColor: 'rgba(10, 18, 30, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#00F0FF',
        padding: 12,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    drawerTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
        color: '#00F0FF',
        letterSpacing: 0.5,
    },
    closeDrawerText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#FF2A2A',
        fontWeight: '700',
    },
    drawerDataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    drawerDataCell: {
        flex: 1,
        backgroundColor: '#060B12',
        borderRadius: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: '#16263D',
    },
    dataLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginBottom: 2,
    },
    dataVal: {
        fontFamily: MONO,
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
});
