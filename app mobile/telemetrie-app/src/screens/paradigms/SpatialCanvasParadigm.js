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
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticCriticalWarning } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.SPATIAL_CANVAS];

export default function SpatialCanvasParadigm() {
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // 4 Zone de Cameră: 'OVERVIEW' | 'ENGINE_BAY' | 'CHASSIS_BRAKES' | 'HIGHWAY_CHASE'
    const [cameraZone, setCameraZone] = useState('OVERVIEW');

    // Sertar holografic activ (null | 'AI' | 'TRIP' | 'BATTERY')
    const [activeDrawer, setActiveDrawer] = useState(null);

    // Stare rotație 3D controlată prin gesturi tactile
    const rotationX = useRef(0.3);
    const rotationY = useRef(0.6);
    const targetCamPos = useRef({ x: 3.5, y: 2.2, z: 4.5 });

    // Referințe noduri 3D pentru rotație & shader frâne
    const wheelsRef = useRef([]);
    const brakeDiscsRef = useRef([]);
    const carBodyRef = useRef(null);
    const reqAnimRef = useRef(null);

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

    // PanResponder pentru rotație tactilă 360° (Orbit Control)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                rotationY.current += gestureState.vx * 0.04;
                rotationX.current = Math.max(0.05, Math.min(1.2, rotationX.current - gestureState.vy * 0.02));
            },
        })
    ).current;

    // Actualizare țintă cameră la schimbarea zonei
    useEffect(() => {
        if (cameraZone === 'OVERVIEW') {
            targetCamPos.current = { x: 3.2, y: 1.8, z: 4.2 };
        } else if (cameraZone === 'ENGINE_BAY') {
            targetCamPos.current = { x: 0.2, y: 1.4, z: 2.0 };
        } else if (cameraZone === 'CHASSIS_BRAKES') {
            targetCamPos.current = { x: 2.2, y: 0.6, z: 1.8 };
        } else if (cameraZone === 'HIGHWAY_CHASE') {
            targetCamPos.current = { x: 0.0, y: 1.2, z: -4.5 };
        }
    }, [cameraZone]);

    // Inițializare Scenă 3D WebGL (Three.js peste expo-gl)
    const onContextCreate = async (gl) => {
        try {
            const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

            const renderer = new THREE.WebGLRenderer({
                gl,
                alpha: true,
                antialias: true,
            });
            renderer.setSize(width, height);
            renderer.setClearColor(0x04070d, 1);

            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
            camera.position.set(3.5, 2.2, 4.5);
            camera.lookAt(0, 0.4, 0);

            // Lumini fotorealiste
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
            scene.add(ambientLight);

            const mainLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
            mainLight.position.set(5, 8, 5);
            scene.add(mainLight);

            const rimLight = new THREE.DirectionalLight(0xff8800, 1.2);
            rimLight.position.set(-5, 4, -5);
            scene.add(rimLight);

            // Grilă podea holografică
            const gridHelper = new THREE.GridHelper(10, 20, 0x00f0ff, 0x112233);
            gridHelper.position.y = -0.01;
            scene.add(gridHelper);

            // ── CONSTRUCȚIE MODEL 3D DIGITAL TWIN (Tesla Style) ──
            const carGroup = new THREE.Group();

            // 1. Caroserie metalică (PBR Metallic Paint)
            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0x0a1424,
                metalness: 0.85,
                roughness: 0.2,
            });

            // Șasiu inferior
            const chassisGeo = new THREE.BoxGeometry(1.6, 0.35, 3.6);
            const chassisMesh = new THREE.Mesh(chassisGeo, bodyMat);
            chassisMesh.position.y = 0.4;
            carGroup.add(chassisMesh);

            // Cabină și acoperiș aerodinamic
            const cabinGeo = new THREE.BoxGeometry(1.3, 0.4, 1.8);
            const cabinMat = new THREE.MeshStandardMaterial({
                color: 0x050d18,
                metalness: 0.9,
                roughness: 0.15,
            });
            const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
            cabinMesh.position.set(0, 0.72, -0.2);
            carGroup.add(cabinMesh);

            // Sticlă parbriz și lunetă
            const glassMat = new THREE.MeshStandardMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.35,
                roughness: 0.05,
            });
            const windshieldGeo = new THREE.PlaneGeometry(1.2, 0.5);
            const windshield = new THREE.Mesh(windshieldGeo, glassMat);
            windshield.rotation.x = -Math.PI / 4;
            windshield.position.set(0, 0.7, 0.8);
            carGroup.add(windshield);

            // Faruri LED Neon
            const headlightMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            const hlGeo = new THREE.BoxGeometry(0.25, 0.08, 0.1);
            const hlLeft = new THREE.Mesh(hlGeo, headlightMat);
            hlLeft.position.set(-0.6, 0.45, 1.8);
            const hlRight = new THREE.Mesh(hlGeo, headlightMat);
            hlRight.position.set(0.6, 0.45, 1.8);
            carGroup.add(hlLeft);
            carGroup.add(hlRight);

            // Stopuri LED Spate
            const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });
            const tlGeo = new THREE.BoxGeometry(1.4, 0.06, 0.08);
            const tailStrip = new THREE.Mesh(tlGeo, tailMat);
            tailStrip.position.set(0, 0.5, -1.8);
            carGroup.add(tailStrip);

            // 2. Cele 4 Roți Tridimensionale & Discuri de Frână
            const wheelPositions = [
                { x: -0.85, y: 0.3, z: 1.1, isFront: true },   // FL
                { x: 0.85, y: 0.3, z: 1.1, isFront: true },    // FR
                { x: -0.85, y: 0.3, z: -1.1, isFront: false }, // RL
                { x: 0.85, y: 0.3, z: -1.1, isFront: false },  // RR
            ];

            const wheels = [];
            const brakeDiscs = [];

            wheelPositions.forEach((pos) => {
                const wheelHub = new THREE.Group();
                wheelHub.position.set(pos.x, pos.y, pos.z);

                // Anvelopă cauciuc
                const tireGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
                const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
                const tireMesh = new THREE.Mesh(tireGeo, tireMat);
                tireMesh.rotation.z = Math.PI / 2;
                wheelHub.add(tireMesh);

                // Jantă aliaj
                const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.24, 12);
                const rimMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.9, roughness: 0.2 });
                const rimMesh = new THREE.Mesh(rimGeo, rimMat);
                rimMesh.rotation.z = Math.PI / 2;
                wheelHub.add(rimMesh);

                // Disc frână cu shader termic emissiv
                const discGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 12);
                const discMat = new THREE.MeshStandardMaterial({
                    color: 0x444444,
                    emissive: 0x000000,
                    emissiveIntensity: 0,
                    metalness: 0.8,
                });
                const discMesh = new THREE.Mesh(discGeo, discMat);
                discMesh.rotation.z = Math.PI / 2;
                discMesh.position.x = pos.x > 0 ? -0.1 : 0.1;
                wheelHub.add(discMesh);

                brakeDiscs.push(discMat);
                wheels.push(wheelHub);
                carGroup.add(wheelHub);
            });

            wheelsRef.current = wheels;
            brakeDiscsRef.current = brakeDiscs;
            carBodyRef.current = carGroup;
            scene.add(carGroup);

            // Buclă de Randare la 60 FPS
            let currentCamPos = { ...camera.position };

            const render = () => {
                reqAnimRef.current = requestAnimationFrame(render);

                // Interpolare lină a camerei
                currentCamPos.x += (targetCamPos.current.x - currentCamPos.x) * 0.05;
                currentCamPos.y += (targetCamPos.current.y - currentCamPos.y) * 0.05;
                currentCamPos.z += (targetCamPos.current.z - currentCamPos.z) * 0.05;

                // Aplicare rotație tactilă de orbită
                const radius = Math.sqrt(currentCamPos.x * currentCamPos.x + currentCamPos.z * currentCamPos.z);
                camera.position.x = Math.sin(rotationY.current) * radius;
                camera.position.z = Math.cos(rotationY.current) * radius;
                camera.position.y = currentCamPos.y + (rotationX.current - 0.5) * 2;
                camera.lookAt(0, 0.4, 0);

                // Rotație roți conform vitezei reale (km/h -> rad/s)
                const wheelRotationSpeed = (telemetry.speed / 3.6) * 0.05;
                wheelsRef.current.forEach((wheel, idx) => {
                    wheel.children.forEach(part => {
                        part.rotation.x += wheelRotationSpeed;
                    });
                    // Unghi virare roți față la viraj
                    if (idx < 2) {
                        wheel.rotation.y = telemetry.gForceLat * 0.4;
                    }
                });

                // Căldură discuri de frână (Emissive Glow la peste 120°C)
                const temp = telemetry.brakeFluidTemp || 80;
                const glowIntensity = Math.max(0, Math.min(1.0, (temp - 90) / 100));
                brakeDiscsRef.current.forEach(mat => {
                    mat.emissive.setHex(temp > 150 ? 0xff2200 : 0xffaa00);
                    mat.emissiveIntensity = glowIntensity * 1.5;
                });

                renderer.render(scene, camera);
                gl.endFrameEXP();
            };

            render();
        } catch (err) {
            console.error('Eroare inițializare Three.js / GLView:', err);
        }
    };

    // Cleanup la unmount
    useEffect(() => {
        return () => {
            if (reqAnimRef.current) {
                cancelAnimationFrame(reqAnimRef.current);
            }
        };
    }, []);

    const selectZone = (zone) => {
        hapticTap();
        setCameraZone(zone);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#04070D" />

            {/* ── 1. Top HUD Bar ── */}
            <View style={styles.topHudBar}>
                <View style={styles.hudBrand}>
                    <View style={styles.holoBadge}>
                        <Text style={styles.holoBadgeText}>SPATIAL 3D DIGITAL TWIN</Text>
                    </View>
                    <View style={[styles.netDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.vinHud} numberOfLines={1}>
                        {activeVehicle?.model || 'TESLA / AUDI PBR TWIN'}
                    </Text>
                </View>

                {/* Butoane acțiune */}
                <View style={styles.hudActions}>
                    <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF14' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                    >
                        <Text style={[styles.smallBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                    >
                        <Text style={styles.smallBtnText}>⮌ V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.launcherBtn}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                    >
                        <Text style={styles.launcherText}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 2. Zona Centrală 3D WebGL (Direct GPU Rendering) ── */}
            <View style={styles.canvasContainer} {...panResponder.panHandlers}>
                <GLView style={styles.glSurface} onContextCreate={onContextCreate} />

                {/* HUD Plutitor Suprapus cu Vitezometru Holografic */}
                <View style={styles.floatingSpeedHud} pointerEvents="none">
                    <Text style={styles.floatingSpeedNumber}>{speed}</Text>
                    <View style={styles.floatingSpeedMeta}>
                        <Text style={styles.floatingSpeedUnit}>KM/H</Text>
                        <Text style={styles.floatingRpmMeta}>{rpm} RPM · TREAPTA {gear}</Text>
                    </View>
                </View>

                {/* Martor 3D Animație Aprindere Cilindri (1-2-4-5-3) */}
                <View style={styles.firingSequenceBadge} pointerEvents="none">
                    <Text style={styles.firingBadgeLabel}>SECVEȚĂ APRINDERE: </Text>
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

                {/* Hint tactil de rotație */}
                <View style={styles.touchHintContainer} pointerEvents="none">
                    <Text style={styles.touchHintText}>⟲ GLISEAZĂ PENTRU ROTAȚIE 360° // PINCH PENTRU ZOOM</Text>
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
                        onPress={() => selectZone(cam.id)}
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
                    <Text style={styles.drawerBtnText}>🔥 TERMICĂ FRÂNE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.drawerBtn, activeDrawer === 'RUL' && styles.drawerBtnActive]}
                    onPress={() => {
                        hapticTap();
                        setActiveDrawer(activeDrawer === 'RUL' ? null : 'RUL');
                    }}
                >
                    <Text style={styles.drawerBtnText}>🛡️ FIABILITATE WEIBULL</Text>
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
        backgroundColor: 'rgba(4, 7, 13, 0.9)',
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
    smallBtn: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
    },
    smallBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#94A3B8',
        fontWeight: '700',
    },
    launcherBtn: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: '#00F0FF',
    },
    launcherText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#04070D',
        fontWeight: '900',
    },
    canvasContainer: {
        flex: 1,
        position: 'relative',
    },
    glSurface: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    floatingSpeedHud: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    floatingSpeedNumber: {
        fontFamily: MONO,
        fontSize: 54,
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
        top: 24,
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
