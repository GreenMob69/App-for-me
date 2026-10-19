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
import { safeNum, safeFmt, safeArr, safeCoord } from '../../utils/safeMath';

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

    const finalX = centerX + x1 * scale;
    const finalY = centerY - y2 * scale;
    return {
        x: safeCoord(finalX, centerX),
        y: safeCoord(finalY, centerY),
        depth: safeCoord(z2, 0),
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
    bumperFrontL: Object.freeze([-0.68, -0.05, 1.68]),
    bumperFrontR: Object.freeze([0.68, -0.05, 1.68]),
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
    bumperRearL: Object.freeze([-0.68, -0.05, -1.72]),
    bumperRearR: Object.freeze([0.68, -0.05, -1.72]),
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

// ─── MEMOIZED SPATIAL SHEET SUB-STATIONS (FRAME ISOLATION & ZERO GC) ──────────

// ─── CFD SIGNATURE: 3D WIND TUNNEL & THERMAL STRESS MAPPING ──────────────────
const StationSpatialCfd = React.memo(function StationSpatialCfd({
    cfdData,
    telemetry,
    activeAccent,
    appLang = 'RO'
}) {
    const isEn = appLang === 'EN';
    const speed = safeNum(telemetry?.speed, 0);
    const coolantTemp = safeNum(telemetry?.coolantTemp, 90);
    const oilTemp = safeNum(telemetry?.oilTemp, 90);
    const exhaustTemp = safeNum(telemetry?.exhaustTemp, 380);
    const chraTemp = safeNum(telemetry?.chraTemp, 210);

    const cfdWidth = SCREEN_WIDTH - 48;
    const cfdHeight = 150;

    return (
        <View>
            <View style={styles.sheetHeaderRow}>
                <View>
                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                        {isEn ? '3D CFD WIND TUNNEL & THERMAL STRESS MAPPING' : 'TUNEL AERODINAMIC 3D CFD & HARTĂ STRES TERMIC'}
                    </Text>
                    <Text style={styles.sheetSub}>ANALIZĂ REZISTENȚĂ LA ÎNAINTARE (Cd=0.29) ȘI FLUXURI LAMINARE</Text>
                </View>
                <View style={[styles.cfdBadge, { borderColor: activeAccent.primary }]}>
                    <Text style={[styles.cfdBadgeText, { color: activeAccent.primary }]}>Cd: {cfdData?.dragCoefficientCd}</Text>
                </View>
            </View>

            {/* 1. SVG Aerodynamic Wind Tunnel Visualization */}
            <View style={styles.cfdChamberBox}>
                <Svg width={cfdWidth} height={cfdHeight} viewBox="0 0 320 150">
                    {/* Tunnel Boundary */}
                    <Line x1="10" y1="15" x2="310" y2="15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,4" />
                    <Line x1="10" y1="135" x2="310" y2="135" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

                    {/* Ground boundary layer */}
                    <Rect x="10" y="136" width="300" height="4" fill="rgba(0, 240, 255, 0.15)" />

                    {/* Simplified Car Profile Silhouettes */}
                    <Path
                        d="M 60 135 L 75 110 L 110 100 L 145 70 L 210 70 L 245 105 L 270 110 L 275 135 Z"
                        fill="rgba(10, 25, 45, 0.8)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.8"
                    />

                    {/* Wind Tunnel Streamlines */}
                    {/* Streamline 1: Roof laminar flow */}
                    <Path
                        d="M 15 50 Q 80 50 115 62 Q 145 58 210 58 Q 250 65 305 95"
                        fill="none"
                        stroke="#00F0FF"
                        strokeWidth="2"
                        strokeDasharray="12, 6"
                    />
                    {/* Streamline 2: Hood flow */}
                    <Path
                        d="M 15 85 Q 70 85 105 88 Q 140 68 200 68 Q 240 85 305 110"
                        fill="none"
                        stroke="#00FF66"
                        strokeWidth="2"
                        strokeDasharray="10, 5"
                    />
                    {/* Streamline 3: Underbody ground-effect Venturi */}
                    <Path
                        d="M 15 128 L 70 128 L 265 128 Q 285 125 305 118"
                        fill="none"
                        stroke="#FFB800"
                        strokeWidth="1.8"
                        strokeDasharray="8, 4"
                    />
                    {/* Wake turbulence vortex behind trunk */}
                    <Circle cx="282" cy="98" r="8" fill="none" stroke="#FF5500" strokeWidth="1.5" strokeDasharray="3,3" />
                    <Circle cx="295" cy="112" r="6" fill="none" stroke="#FF2A2A" strokeWidth="1.5" strokeDasharray="3,3" />

                    {/* Flow Velocity Vectors */}
                    <Line x1="20" y1="28" x2="55" y2="28" stroke="#00F0FF" strokeWidth="2" />
                    <Line x1="50" y1="24" x2="56" y2="28" stroke="#00F0FF" strokeWidth="2" />
                    <Line x1="50" y1="32" x2="56" y2="28" stroke="#00F0FF" strokeWidth="2" />
                </Svg>
            </View>

            {/* Aerodynamic Real-time Metrics Grid */}
            <View style={styles.cfdMetricsGrid}>
                <View style={styles.cfdMetricCard}>
                    <Text style={styles.cfdMetricLabel}>{isEn ? 'DRAG FORCE (Fx)' : 'REZISTENȚĂ LA ÎNAINTARE'}</Text>
                    <Text style={[styles.cfdMetricVal, { color: '#00F0FF' }]}>{cfdData?.dragForceNewtons || 0} N</Text>
                    <Text style={styles.cfdMetricSub}>Suprafață: {cfdData?.frontalAreaM2} m²</Text>
                </View>
                <View style={styles.cfdMetricCard}>
                    <Text style={styles.cfdMetricLabel}>{isEn ? 'AERO DOWNFORCE (Fz)' : 'APĂSARE AERODINAMICĂ'}</Text>
                    <Text style={[styles.cfdMetricVal, { color: '#00FF66' }]}>{cfdData?.downforceNewtons || 0} N</Text>
                    <Text style={styles.cfdMetricSub}>Echilibru Axe: 48:52</Text>
                </View>
                <View style={styles.cfdMetricCard}>
                    <Text style={styles.cfdMetricLabel}>{isEn ? 'AERO POWER LOSS' : 'PUTERE CONSUMATĂ AER'}</Text>
                    <Text style={[styles.cfdMetricVal, { color: '#FFB800' }]}>{cfdData?.aeroPowerLossKw || 0} kW</Text>
                    <Text style={styles.cfdMetricSub}>Viteză Aer: {cfdData?.airSpeedMs} m/s</Text>
                </View>
            </View>

            {/* 2. Component Thermal Stress Color Mapping */}
            <Text style={[styles.categoryTitle, { color: activeAccent.primary, marginTop: 14 }]}>
                {isEn ? '3D COMPONENT THERMAL STRESS MAPPING' : 'HARTĂ GRADIENT STRES TERMIC PE COMPONENTE'}
            </Text>

            <View style={styles.thermalStressGrid}>
                {/* Engine Bay Block */}
                <View style={styles.thermalStressCard}>
                    <View style={styles.thermalCardHeader}>
                        <Text style={styles.thermalCardTitle}>BLOC MOTOR & CHIULASĂ</Text>
                        <View style={[styles.thermalBadge, { backgroundColor: coolantTemp > 98 ? '#FF2A2A22' : '#00FF6622', borderColor: coolantTemp > 98 ? '#FF2A2A' : '#00FF66' }]}>
                            <Text style={[styles.thermalBadgeText, { color: coolantTemp > 98 ? '#FF2A2A' : '#00FF66' }]}>
                                {coolantTemp > 98 ? 'STRES RIDICAT' : 'OPTIM'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.thermalMetric}>{coolantTemp}°C <Text style={styles.thermalUnit}>ANTIGEL</Text> · {oilTemp}°C <Text style={styles.thermalUnit}>ULEI</Text></Text>
                    <Text style={styles.thermalDesc}>Gradient de temperatură carter: Stres termomecanic nominal.</Text>
                </View>

                {/* Turbo Core CHRA */}
                <View style={styles.thermalStressCard}>
                    <View style={styles.thermalCardHeader}>
                        <Text style={styles.thermalCardTitle}>MIEZ TURBINĂ CHRA</Text>
                        <View style={[styles.thermalBadge, { backgroundColor: chraTemp > 240 ? '#FFB80022' : '#00FF6622', borderColor: chraTemp > 240 ? '#FFB800' : '#00FF66' }]}>
                            <Text style={[styles.thermalBadgeText, { color: chraTemp > 240 ? '#FFB800' : '#00FF66' }]}>
                                {chraTemp > 240 ? 'COOLDOWN NECESAR' : 'NOMINAL'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.thermalMetric}>{chraTemp}°C <Text style={styles.thermalUnit}>RĂCIRE LAGĂRE</Text></Text>
                    <Text style={styles.thermalDesc}>Risc de cocsare a uleiului la oprire bruscă: Minim la ralanti.</Text>
                </View>

                {/* Exhaust & Downpipe */}
                <View style={styles.thermalStressCard}>
                    <View style={styles.thermalCardHeader}>
                        <Text style={styles.thermalCardTitle}>EVACUARE & DPF REGENERARE</Text>
                        <View style={[styles.thermalBadge, { backgroundColor: exhaustTemp > 650 ? '#FF550022' : '#00F0FF22', borderColor: exhaustTemp > 650 ? '#FF5500' : '#00F0FF' }]}>
                            <Text style={[styles.thermalBadgeText, { color: exhaustTemp > 650 ? '#FF5500' : '#00F0FF' }]}>
                                {exhaustTemp > 650 ? 'REGEN DPF' : 'TERMIC OK'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.thermalMetric}>{exhaustTemp}°C <Text style={styles.thermalUnit}>EGT GAZE</Text></Text>
                    <Text style={styles.thermalDesc}>Disipare termică galerie evacuare & conector flexibil.</Text>
                </View>
            </View>
            {/* ── HOLOGRAPHIC FLOATING GLASS CAPSULE DEBRIEF ── */}
            <Modal
                visible={core.showDebriefModal}
                transparent
                animationType="fade"
                onRequestClose={core.closeTripDebrief}
            >
                <View style={styles.spatialDebriefBackdrop}>
                    <View style={[styles.spatialDebriefCard, { borderColor: activeAccent.primary }]}>
                        <View style={styles.spatialDebriefHead}>
                            <View style={[styles.spatialDebriefBadge, { backgroundColor: activeAccent.primary }]}>
                                <Text style={styles.spatialDebriefBadgeText}>3D TELEMETRY CAPSULE</Text>
                            </View>
                            <Text style={[styles.spatialDebriefTitle, { color: activeAccent.primary }]}>
                                {isEn ? 'POST-TRIP TELEMETRY DEBRIEF' : 'BILANȚ HOLOGRAFIC POST-CURSĂ'}
                            </Text>
                        </View>
                        <Text style={styles.spatialDebriefSub}>HOLOGRAM RECONSTRUCTION · 32 KALMAN OBSERVERS LOG</Text>

                        <View style={styles.spatialDebriefGrid}>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'DISTANCE' : 'DISTANȚĂ'}</Text>
                                <Text style={[styles.spatialDebriefVal, { color: '#00FF66' }]}>{core.lastTripDebrief?.km} KM</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'DURATION' : 'DURATĂ'}</Text>
                                <Text style={styles.spatialDebriefVal}>{core.lastTripDebrief?.duration}</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'MAX SPEED' : 'VITEZĂ MAXIMĂ'}</Text>
                                <Text style={[styles.spatialDebriefVal, { color: '#00F0FF' }]}>{core.lastTripDebrief?.maxSpeed} KM/H</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'AVG CONSUMPTION' : 'CONSUM MEDIU'}</Text>
                                <Text style={styles.spatialDebriefVal}>{core.lastTripDebrief?.avgConsumption} L/100</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'FUEL BURNED' : 'CARBURANT'}</Text>
                                <Text style={styles.spatialDebriefVal}>{core.lastTripDebrief?.fuelBurnedLiters} L ({core.lastTripDebrief?.fuelCostRon} RON)</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'BRAKE ENERGY' : 'DISIPARE FRÂNE'}</Text>
                                <Text style={[styles.spatialDebriefVal, { color: '#FFB800' }]}>{core.lastTripDebrief?.brakeEnergyMj} MJ</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'OIL WEAR' : 'UZURĂ ULEI'}</Text>
                                <Text style={styles.spatialDebriefVal}>{core.lastTripDebrief?.oilStressFactor}x</Text>
                            </View>
                            <View style={styles.spatialDebriefCell}>
                                <Text style={styles.spatialDebriefLabel}>{isEn ? 'HEALTH SCORE' : 'SCOR SĂNĂTATE'}</Text>
                                <Text style={[styles.spatialDebriefVal, { color: '#00FF66' }]}>{core.lastTripDebrief?.healthScore}%</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.spatialDebriefCloseBtn, { borderColor: activeAccent.primary, backgroundColor: `${activeAccent.primary}22` }]}
                            onPress={() => {
                                hapticTap();
                                core.closeTripDebrief();
                            }}
                        >
                            <Text style={[styles.spatialDebriefCloseText, { color: activeAccent.primary }]}>
                                [ ✕ {isEn ? 'DISMISS CAPSULE' : 'ÎNCHIDE CAPSULĂ'} ]
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
});

const StationSpatialXRay = React.memo(function StationSpatialXRay({
    virtualSensors,
    searchQuery = '',
    setSearchQuery,
    matchedDtc = [],
    isExplodedView,
    setIsExplodedView,
    activeAccent,
    appLang = 'RO',
}) {
    const isEn = appLang === 'EN';
    const catLabels = {
        engine: '01. GRUP PROPULSOR & INJECȚIE',
        turbo: '02. SUPRAALIMENTARE & ADMISIE',
        thermal: '03. ECHILIBRU TERMIC & RĂCIRE',
        dpf: '04. POST-TRATARE EMISII DPF/SCR',
        electric: '05. REȚEA ELECTRICĂ & BATERIE',
        safety: '06. DINAMICĂ ȘASIU & SIGURANȚĂ',
    };

    return (
        <View>
            <View style={styles.sheetHeaderRow}>
                <View>
                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                        {isEn ? '3D VIRTUAL ANATOMY · 32 PHYSICAL OBSERVERS' : '3D ANATOMIE VIRTUALĂ · 32 OBSERVATORI FIZICI'}
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

            {/* Fast DTC & Sensor Holographic Search Box */}
            <View style={styles.spatialSearchBox}>
                <Text style={[styles.spatialSearchPrefix, { color: activeAccent.primary }]}>🔍 DTC QUERY:</Text>
                <TextInput
                    style={styles.spatialSearchInput}
                    placeholder={isEn ? "Search DTC (P0234, 00550, MAF, DPF) or sensor..." : "Caută cod DTC (P0234, 00550, MAF, DPF) sau senzor..."}
                    placeholderTextColor="#64748B"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: activeAccent.primary, fontFamily: MONO, fontWeight: '900' }}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Matched DTC Cards */}
            {safeArr(matchedDtc).length > 0 && (
                <View style={styles.spatialDtcMatchesBox}>
                    <Text style={[styles.spatialDtcMatchesTitle, { color: activeAccent.primary }]}>
                        {isEn ? '// DTC DATABASE HOLOGRAPHIC MATCHES:' : '// ANOMALII DTC IDENTIFICATE:'}
                    </Text>
                    {matchedDtc.map(item => (
                        <View key={item.code} style={styles.spatialDtcCard}>
                            <View style={styles.spatialDtcCardHead}>
                                <Text style={[styles.spatialDtcCode, { color: activeAccent.primary }]}>{item.code} / VAG {item.vagCode}</Text>
                                <Text style={[styles.spatialDtcSev, { color: item.severity === 'CRIT' ? '#FF2A2A' : '#FFB800' }]}>{item.severity}</Text>
                            </View>
                            <Text style={styles.spatialDtcCardTitle}>{item.title}</Text>
                            <Text style={styles.spatialDtcDesc}><Text style={{ color: '#64748B' }}>CAUZĂ: </Text>{item.cause}</Text>
                            <Text style={styles.spatialDtcDesc}><Text style={{ color: '#64748B' }}>SIMPTOM: </Text>{item.symptoms}</Text>
                            <Text style={styles.spatialDtcCost}><Text style={{ color: '#00FF66' }}>COST EST: </Text>{item.costEst} · {item.action}</Text>
                        </View>
                    ))}
                </View>
            )}

            {Object.entries(virtualSensors || {}).map(([catKey, sensors]) => (
                <View key={catKey} style={styles.spatialCategoryBox}>
                    <Text style={[styles.categoryTitle, { color: activeAccent.primary }]}>
                        {catLabels[catKey] || catKey.toUpperCase()}
                    </Text>
                    <View style={styles.sensorsGrid}>
                        {safeArr(sensors).map((s) => {
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
            ))}
        </View>
    );
});

const StationSpatialReplay = React.memo(function StationSpatialReplay({
    appLang = 'RO',
    selectedTripId,
    tripsList,
    replaySpeed,
    replayTotalSamples,
    replayIndex,
    isReplaying,
    activeSpeed,
    activeRpm,
    activeBoost,
    activeLatG,
    togglePlayPause,
    cycleReplaySpeed,
    exportTripPdf,
    exportItpDossier,
    selectTripForReplay,
    activeAccent
}) {
    const activeTrip = tripsList.find(t => t.id === selectedTripId);

    return (
        <View>
            <View style={styles.sheetHeaderRow}>
                <View>
                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                        3D TELEMETRY REPLAY · CONTROL PAS-CU-PAS
                    </Text>
                    <Text style={styles.sheetSub}>MAȘINA 3D DINAMICĂ ÎN TIMP REAL CONFORM TELEMETRIEI</Text>
                </View>
                <Text style={[styles.replaySpeedBadge, { color: activeAccent.primary }]}>{replaySpeed}x</Text>
            </View>

            <View style={styles.replayGlassCard}>
                <View style={styles.tripGlassHeader}>
                    <Text style={styles.tripGlassTitle}>
                        {selectedTripId ? (activeTrip?.title || 'CURSĂ SELECTATĂ') : 'NICIUN TRASEU SELECTAT'}
                    </Text>
                    <Text style={styles.tripGlassDate}>
                        PROBĂ: {replayIndex} / {replayTotalSamples}
                    </Text>
                </View>

                {/* Scrubber Bar */}
                <View style={styles.replayTrack}>
                    <View style={[styles.replayFill, { width: `${replayTotalSamples > 0 ? (replayIndex / replayTotalSamples) * 100 : 0}%`, backgroundColor: activeAccent.primary }]} />
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
                        <Text style={styles.replayMetricVal}>{safeFmt(activeBoost, 2, '0.00')} bar</Text>
                    </View>
                    <View style={styles.replayMetricCol}>
                        <Text style={styles.replayMetricKey}>G-LAT</Text>
                        <Text style={styles.replayMetricVal}>{safeFmt(activeLatG, 2, '0.00')} G</Text>
                    </View>
                </View>

                {/* Playback Controls */}
                <View style={styles.replayBtnsRow}>
                    <TouchableOpacity
                        style={[styles.spatialBtn, { backgroundColor: isReplaying ? '#FFB80022' : activeAccent.bg, borderColor: isReplaying ? '#FFB800' : activeAccent.primary }]}
                        onPress={() => {
                            hapticTap();
                            togglePlayPause();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={[styles.spatialBtnText, { color: isReplaying ? '#FFB800' : activeAccent.primary }]}>
                            {isReplaying ? '❚❚ PAUZĂ' : '▶ REDĂ'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                        onPress={() => {
                            hapticTap();
                            cycleReplaySpeed();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={[styles.spatialBtnText, { color: '#8CA0BA' }]}>{replaySpeed}x VITEZĂ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                        onPress={() => {
                            hapticTap();
                            exportTripPdf(selectedTripId || 'trip_108');
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={[styles.spatialBtnText, { color: '#8CA0BA' }]}>📄 PDF CURSĂ</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.spatialBtn, { backgroundColor: '#091322', borderColor: '#16283D' }]}
                        onPress={() => {
                            hapticTap();
                            exportItpDossier();
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
            {safeArr(tripsList).map((t) => {
                const isSelected = selectedTripId === t.id;
                return (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tripGlassCard, isSelected && { borderColor: activeAccent.primary, backgroundColor: activeAccent.bg }]}
                        onPress={() => {
                            hapticTap();
                            selectTripForReplay(t.id);
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
    );
});

const StationSpatialService = React.memo(function StationSpatialService({
    appLang = 'RO',
    maintenanceItems,
    legalDocuments,
    markServiceItemCompleted,
    tireSize,
    setTireSize,
    vehicleMassKg,
    setVehicleMassKg,
    fuelPricePerLiter,
    setFuelPricePerLiter,
    activeAccent
}) {
    const isEn = appLang === 'EN';
    return (
        <View>
            <View style={styles.sheetHeaderRow}>
                <View>
                    <Text style={[styles.sheetTitle, { color: activeAccent.primary }]}>
                        {isEn ? 'TESLA SERVICE CENTER · VEHICLE SPECS & WEAR' : 'TESLA SERVICE CENTER · CONFIGURARE VEHICUL & UZURĂ'}
                    </Text>
                    <Text style={styles.sheetSub}>MODELE ARRHENIUS / ARCHARD & TERMENE VALABILITATE</Text>
                </View>
            </View>

            {/* ── Holographic Glass Configurator ── */}
            <View style={styles.spatialConfigCard}>
                <Text style={[styles.spatialConfigTitle, { color: activeAccent.primary }]}>
                    {isEn ? '// VEHICLE SPECS, TIRES & FUEL SETUP' : '// CONFIGURATOR ANVELOPE, MASĂ & CARBURANT'}
                </Text>

                {/* Tire Size */}
                <Text style={styles.spatialConfigLabel}>{isEn ? 'TIRE PROFILE (ROLLING RADIUS):' : 'PROFIL ANVELOPE (RAZĂ RULARE):'}</Text>
                <View style={styles.spatialConfigRow}>
                    {['205/55 R16', '225/50 R17', '225/45 R18', '235/40 R19'].map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[styles.spatialConfigBtn, tireSize === s && { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }]}
                            onPress={() => { hapticTap(); setTireSize(s); }}
                        >
                            <Text style={[styles.spatialConfigBtnText, tireSize === s && { color: '#04070D', fontWeight: '900' }]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Vehicle Mass */}
                <Text style={styles.spatialConfigLabel}>{isEn ? 'CURB WEIGHT (CHASSIS INERTIA):' : 'MASĂ ȘASIU (CALCUL DYNO & INERȚIE):'}</Text>
                <View style={styles.spatialConfigRow}>
                    {[1250, 1450, 1650, 1850].map(m => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.spatialConfigBtn, vehicleMassKg === m && { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }]}
                            onPress={() => { hapticTap(); setVehicleMassKg(m); }}
                        >
                            <Text style={[styles.spatialConfigBtnText, vehicleMassKg === m && { color: '#04070D', fontWeight: '900' }]}>{m} kg</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Fuel Price */}
                <Text style={styles.spatialConfigLabel}>{isEn ? 'FUEL PRICE (RON/L):' : 'PREȚ COMBUSTIBIL (RON/L):'}</Text>
                <View style={styles.spatialConfigRow}>
                    {[7.10, 7.45, 7.80, 8.20].map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.spatialConfigBtn, fuelPricePerLiter === p && { backgroundColor: activeAccent.primary, borderColor: activeAccent.primary }]}
                            onPress={() => { hapticTap(); setFuelPricePerLiter(p); }}
                        >
                            <Text style={[styles.spatialConfigBtnText, fuelPricePerLiter === p && { color: '#04070D', fontWeight: '900' }]}>{p.toFixed(2)}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* CBM Wear List */}
            <Text style={[styles.categoryTitle, { color: activeAccent.primary }]}>
                COMPONENTE ȘI UZURĂ FIZICĂ PREDICTIVĂ (CBM)
            </Text>
            {safeArr(maintenanceItems).map((item) => {
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
                                    markServiceItemCompleted(item.id);
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
                {safeArr(legalDocuments).map((doc, idx) => {
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
    );
});

const StationSpatialSentry = React.memo(function StationSpatialSentry({
    appLang = 'RO',
    sentryArmed,
    setSentryArmed,
    triggerShockSimulation,
    sentryEvents,
    valetActive,
    valetSpeedLimit,
    valetRpmLimit,
    toggleValetMode,
    carGpsCoords,
    openWalkingDirections,
    parkingMinutesRemaining,
    addParkingTime,
    activeAccent
}) {
    return (
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
                        <Text style={styles.sentrySub}>STARE: {sentryArmed ? 'ARMAT (RADAR MICROUNDE ON)' : 'DEZARMAT'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.sentryToggleBtn, { backgroundColor: sentryArmed ? '#FF2A2A22' : '#00FF6622', borderColor: sentryArmed ? '#FF2A2A' : '#00FF66' }]}
                        onPress={() => {
                            hapticTap();
                            setSentryArmed(!sentryArmed);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.sentryToggleText, { color: sentryArmed ? '#FF2A2A' : '#00FF66' }]}>
                            {sentryArmed ? 'DEZARMEAZĂ' : 'ARMEAZĂ'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Shock Simulation Button */}
                <TouchableOpacity
                    style={[styles.shockTestBtn, { backgroundColor: `${activeAccent.primary}18`, borderColor: `${activeAccent.primary}55` }]}
                    onPress={() => {
                        hapticTap();
                        triggerShockSimulation();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={[styles.shockTestText, { color: activeAccent.primary }]}>
                        ⚡ SIMULEAZĂ ȘOC / TILT ASUPRA SENZORILOR 3D
                    </Text>
                </TouchableOpacity>

                {/* Shock Event Log */}
                {safeArr(sentryEvents).length > 0 && (
                    <View style={styles.sentryAlertsList}>
                        <Text style={styles.sentryAlertTitle}>EVENIMENTE RECENTE DETECTATE</Text>
                        {safeArr(sentryEvents).slice(0, 2).map((ev) => (
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
                        <Text style={styles.sentrySub}>LIMITĂ: {valetSpeedLimit} km/h · {valetRpmLimit} RPM</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.sentryToggleBtn, { backgroundColor: valetActive ? '#FFB80022' : '#091322', borderColor: valetActive ? '#FFB800' : '#16283D' }]}
                        onPress={() => {
                            hapticTap();
                            toggleValetMode();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.sentryToggleText, { color: valetActive ? '#FFB800' : '#8CA0BA' }]}>
                            {valetActive ? 'ACTIV' : 'INACTIV'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* GPS Navigation Directions */}
                <View style={[styles.sentryHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#162B44' }]}>
                    <View>
                        <Text style={styles.sentryTitle}>GĂSEȘTE-MI MAȘINA (GPS)</Text>
                        <Text style={[styles.sentrySub, { color: activeAccent.primary }]}>
                            {safeFmt(carGpsCoords?.lat, 4, '44.4323')}°N, {safeFmt(carGpsCoords?.lng ?? carGpsCoords?.lon, 4, '26.1063')}°E
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.sentryToggleBtn, { backgroundColor: activeAccent.bg, borderColor: activeAccent.primary }]}
                        onPress={() => {
                            hapticTap();
                            openWalkingDirections();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={[styles.sentryToggleText, { color: activeAccent.primary }]}>NAVIGHEAZĂ 📍</Text>
                    </TouchableOpacity>
                </View>

                {/* Parking Ticket Countdown */}
                <View style={styles.parkingRow}>
                    <Text style={styles.parkingLabel}>CRONOMETRU TICHET PARCARE:</Text>
                    <Text style={[styles.parkingTimeText, { color: parkingMinutesRemaining < 15 ? '#FF2A2A' : '#00FF66' }]}>
                        {parkingMinutesRemaining} MIN
                    </Text>
                    <View style={styles.parkingChipsRow}>
                        {[15, 30, 60].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={styles.parkingChip}
                                onPress={() => {
                                    hapticTap();
                                    addParkingTime(mins);
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
    );
});

const StationSpatialCopilot = React.memo(function StationSpatialCopilot({
    aiMessages,
    isAiLoading,
    sendAiPrompt,
    activeAccent,
    appLang = 'RO',
}) {
    const isEn = appLang === 'EN';
    const [localInput, setLocalInput] = useState('');

    const handleSend = useCallback(() => {
        if (!localInput.trim()) return;
        hapticTap();
        sendAiPrompt(localInput);
        setLocalInput('');
    }, [localInput, sendAiPrompt]);

    return (
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
                            sendAiPrompt(chip);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <Text style={styles.copilotChipText} numberOfLines={1}>{chip}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Chat Messages */}
            <View style={styles.copilotChatBox}>
                {safeArr(aiMessages).slice(-3).map((m) => (
                    <View key={m.id} style={styles.copilotMsgRow}>
                        <Text style={[styles.copilotSender, { color: m.sender === 'user' ? activeAccent.primary : '#FFB800' }]}>
                            {m.sender === 'user' ? '[PILOT]' : '[COPILOT AI]'}:
                        </Text>
                        <Text style={styles.copilotMsgText}>{m.text}</Text>
                    </View>
                ))}
                {isAiLoading && (
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
                    value={localInput}
                    onChangeText={setLocalInput}
                />
                <TouchableOpacity
                    style={[styles.copilotSendBtn, { backgroundColor: activeAccent.primary }]}
                    onPress={handleSend}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.copilotSendBtnText}>{isEn ? 'SEND' : 'TRIMITE'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function SpatialCanvasParadigm() {
    const insets = useSafeInsets();
    // Stări Standalone OS: 'XRAY' | 'REPLAY' | 'SERVICE' | 'SENTRY' | 'COPILOT'
    const [spatialSheet, setSpatialSheet] = useState('XRAY');
    const isLiveViewActive = spatialSheet === 'XRAY';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal, appLang, toggleAppLang } = useUiParadigm();
    const isEn = appLang === 'EN';
    const [spatialAccentKey, setSpatialAccentKey] = useState('CYAN'); // 'CYAN' | 'GOLD' | 'EMERALD'

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

    // PanResponder cu Inerție Fină, rAF Throttle (max 1 update/frame) și freeze când un sheet e deschis
    const inertiaTimerRef = useRef(null);
    const lastGestureRef = useRef({ dx: 0, dy: 0 });
    const rafHandleRef = useRef(null);
    const pendingDeltaRef = useRef({ dx: 0, dy: 0 });

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => isLive3DActive,
                onMoveShouldSetPanResponder: () => isLive3DActive,
                onPanResponderGrant: () => {
                    lastGestureRef.current = { dx: 0, dy: 0 };
                    pendingDeltaRef.current = { dx: 0, dy: 0 };
                    if (rafHandleRef.current) {
                        cancelAnimationFrame(rafHandleRef.current);
                        rafHandleRef.current = null;
                    }
                    if (inertiaTimerRef.current) clearInterval(inertiaTimerRef.current);
                },
                onPanResponderMove: (_, gestureState) => {
                    if (!isLive3DActive) return;
                    const deltaX = gestureState.dx - lastGestureRef.current.dx;
                    const deltaY = gestureState.dy - lastGestureRef.current.dy;
                    lastGestureRef.current = { dx: gestureState.dx, dy: gestureState.dy };
                    pendingDeltaRef.current.dx += deltaX;
                    pendingDeltaRef.current.dy += deltaY;

                    if (!rafHandleRef.current) {
                        rafHandleRef.current = requestAnimationFrame(() => {
                            const curDx = pendingDeltaRef.current.dx;
                            const curDy = pendingDeltaRef.current.dy;
                            pendingDeltaRef.current = { dx: 0, dy: 0 };
                            rafHandleRef.current = null;
                            setRotY((prev) => prev + curDx * 0.022);
                            setRotX((prev) => Math.max(0.08, Math.min(1.2, prev - curDy * 0.012)));
                        });
                    }
                },
                onPanResponderRelease: (_, gestureState) => {
                    if (!isLive3DActive) return;
                    if (rafHandleRef.current) {
                        cancelAnimationFrame(rafHandleRef.current);
                        rafHandleRef.current = null;
                    }
                    let vY = gestureState.vx * 0.14;
                    let vX = -gestureState.vy * 0.04;
                    inertiaTimerRef.current = setInterval(() => {
                        vY *= 0.93;
                        vX *= 0.93;
                        setRotY((prev) => prev + vY);
                        setRotX((prev) => Math.max(0.08, Math.min(1.2, prev + vX)));
                        if (Math.abs(vY) < 0.0004 && Math.abs(vX) < 0.0004) {
                            clearInterval(inertiaTimerRef.current);
                        }
                    }, 16);
                },
            }),
        [isLive3DActive]
    );

    // ── GEOMETRIE 3D DIGITAL TWIN CU BACK-FACE CULLING & X-RAY VIEW ──────
    const lastMeshRef = useRef(null);
    const carMesh3D = useMemo(() => {
        if (!isLive3DActive && lastMeshRef.current) {
            return lastMeshRef.current;
        }

        const explode = isExplodedView ? 0.35 : 0.0;
        const p = (x, y, z) => project3D(x, y, z, rotX, rotY, suspensionRoll, suspensionPitch, 0.85, SCREEN_WIDTH / 2, 125);
        const V = BASE_CAR_VERTICES;

        // Capotă & Bot (cu explozie exterioară în mod X-Ray)
        const noseL = p(V.noseL[0] - explode, V.noseL[1], V.noseL[2] + explode);
        const noseR = p(V.noseR[0] + explode, V.noseR[1], V.noseR[2] + explode);
        const bumperFrontL = p(V.bumperFrontL[0] - explode, V.bumperFrontL[1], V.bumperFrontL[2] + explode);
        const bumperFrontR = p(V.bumperFrontR[0] + explode, V.bumperFrontR[1], V.bumperFrontR[2] + explode);
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
        const bumperRearL = p(V.bumperRearL[0] - explode, V.bumperRearL[1], V.bumperRearL[2] - explode);
        const bumperRearR = p(V.bumperRearR[0] + explode, V.bumperRearR[1], V.bumperRearR[2] - explode);

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

        const result = {
            noseL, noseR, hoodL, hoodR,
            bumperFrontL, bumperFrontR, bumperRearL, bumperRearR,
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
        lastMeshRef.current = result;
        return result;
    }, [rotX, rotY, suspensionRoll, suspensionPitch, isExplodedView, activeLatG, isLive3DActive]);

    // Culoare dinamică frâne în funcție de temperatură
    const brakeColor = brakeFluidTemp > 140 ? '#FF2A2A' : brakeFluidTemp > 105 ? '#FFB800' : activeAccent.primary;
    const isIceRisk = Boolean(telemetry?.criticalAlerts && safeArr(telemetry.criticalAlerts).some(a => a?.id === 'BLACK_ICE'));
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

                    {/* Bilanț Cursă Holografic */}
                    <TouchableOpacity
                        style={[styles.hudActionBtn, { borderColor: activeAccent.primary, backgroundColor: `${activeAccent.primary}22` }]}
                        onPress={() => {
                            hapticTap();
                            core.openTripDebrief();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.hudActionBtnText, { color: activeAccent.primary }]}>🧾</Text>
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
                            <Stop offset="0" stopColor="#12253B" stopOpacity={isExplodedView ? 0.45 : 0.98} />
                            <Stop offset="0.5" stopColor="#1E3E63" stopOpacity={isExplodedView ? 0.35 : 0.95} />
                            <Stop offset="1" stopColor="#0B1726" stopOpacity={isExplodedView ? 0.45 : 0.98} />
                        </LinearGradient>
                        <LinearGradient id="carSideGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#163255" stopOpacity={isExplodedView ? 0.4 : 0.95} />
                            <Stop offset="1" stopColor="#08111D" stopOpacity={isExplodedView ? 0.4 : 0.98} />
                        </LinearGradient>
                        <LinearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={activeAccent.primary} stopOpacity={isExplodedView ? 0.3 : 0.55} />
                            <Stop offset="1" stopColor="#003554" stopOpacity={isExplodedView ? 0.15 : 0.35} />
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

                    {/* 1. Flanc Lateral Stânga (Portiere, Aripi, Prag) */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                            ${carMesh3D.trunkL.x},${carMesh3D.trunkL.y}
                            ${carMesh3D.tailL.x},${carMesh3D.tailL.y}
                            ${carMesh3D.bumperRearL.x},${carMesh3D.bumperRearL.y}
                            ${carMesh3D.sillRearL.x},${carMesh3D.sillRearL.y}
                            ${carMesh3D.sillFrontL.x},${carMesh3D.sillFrontL.y}
                            ${carMesh3D.bumperFrontL.x},${carMesh3D.bumperFrontL.y}
                        `}
                        fill="url(#carSideGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.2"
                    />

                    {/* 2. Geamuri Laterale Stânga */}
                    <Polygon
                        points={`
                            ${carMesh3D.hoodL.x},${carMesh3D.hoodL.y}
                            ${carMesh3D.roofFrontL.x},${carMesh3D.roofFrontL.y}
                            ${carMesh3D.roofRearL.x},${carMesh3D.roofRearL.y}
                            ${carMesh3D.trunkL.x},${carMesh3D.trunkL.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1"
                    />

                    {/* 3. Flanc Lateral Dreapta (Portiere, Aripi, Prag) */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.trunkR.x},${carMesh3D.trunkR.y}
                            ${carMesh3D.tailR.x},${carMesh3D.tailR.y}
                            ${carMesh3D.bumperRearR.x},${carMesh3D.bumperRearR.y}
                            ${carMesh3D.sillRearR.x},${carMesh3D.sillRearR.y}
                            ${carMesh3D.sillFrontR.x},${carMesh3D.sillFrontR.y}
                            ${carMesh3D.bumperFrontR.x},${carMesh3D.bumperFrontR.y}
                        `}
                        fill="url(#carSideGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1.2"
                    />

                    {/* 4. Geamuri Laterale Dreapta */}
                    <Polygon
                        points={`
                            ${carMesh3D.hoodR.x},${carMesh3D.hoodR.y}
                            ${carMesh3D.roofFrontR.x},${carMesh3D.roofFrontR.y}
                            ${carMesh3D.roofRearR.x},${carMesh3D.roofRearR.y}
                            ${carMesh3D.trunkR.x},${carMesh3D.trunkR.y}
                        `}
                        fill="url(#glassGrad)"
                        stroke={activeAccent.primary}
                        strokeWidth="1"
                    />

                    {/* 5. Bară Față & Grilă Aerodinamică */}
                    <Polygon
                        points={`
                            ${carMesh3D.noseL.x},${carMesh3D.noseL.y}
                            ${carMesh3D.noseR.x},${carMesh3D.noseR.y}
                            ${carMesh3D.bumperFrontR.x},${carMesh3D.bumperFrontR.y}
                            ${carMesh3D.bumperFrontL.x},${carMesh3D.bumperFrontL.y}
                        `}
                        fill="#0A1828"
                        stroke={activeAccent.primary}
                        strokeWidth="1.5"
                    />

                    {/* 6. Faruri LED Matrix Neon */}
                    <Line
                        x1={carMesh3D.noseL.x}
                        y1={carMesh3D.noseL.y}
                        x2={carMesh3D.bumperFrontL.x}
                        y2={carMesh3D.bumperFrontL.y}
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                    />
                    <Line
                        x1={carMesh3D.noseR.x}
                        y1={carMesh3D.noseR.y}
                        x2={carMesh3D.bumperFrontR.x}
                        y2={carMesh3D.bumperFrontR.y}
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                    />

                    {/* 7. Fațete Superioare: Capotă */}
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

                    {/* 8. Parbriz */}
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

                    {/* 9. Plafon */}
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

                    {/* 10. Lunetă */}
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

                    {/* 11. Portbagaj */}
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

                    {/* 12. Bară Spate & Difuzor */}
                    <Polygon
                        points={`
                            ${carMesh3D.tailL.x},${carMesh3D.tailL.y}
                            ${carMesh3D.tailR.x},${carMesh3D.tailR.y}
                            ${carMesh3D.bumperRearR.x},${carMesh3D.bumperRearR.y}
                            ${carMesh3D.bumperRearL.x},${carMesh3D.bumperRearL.y}
                        `}
                        fill="#0A121E"
                        stroke="#FF2A2A"
                        strokeWidth="1.5"
                    />

                    {/* 13. Bandă Stopuri LED Spate Roșie */}
                    <Line
                        x1={carMesh3D.tailL.x}
                        y1={carMesh3D.tailL.y}
                        x2={carMesh3D.tailR.x}
                        y2={carMesh3D.tailR.y}
                        stroke="#FF1744"
                        strokeWidth="3"
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

                {/* HUD Plutitor Tesla Model S Style */}
                <View style={styles.floatingSpeedHud} pointerEvents="none">
                    {/* PRND Gear Selector */}
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        {['P', 'R', 'N', 'D'].map((g) => {
                            const isCur = String(gear).toUpperCase() === g || (g === 'D' && typeof gear === 'number' && gear > 0);
                            return (
                                <Text
                                    key={g}
                                    style={{
                                        fontFamily: MONO,
                                        fontSize: 10,
                                        fontWeight: '900',
                                        color: isCur ? activeAccent.primary : '#334155',
                                    }}
                                >
                                    {g}
                                </Text>
                            );
                        })}
                    </View>
                    <Text style={styles.floatingSpeedNumber}>{activeSpeed}</Text>
                    <View style={styles.floatingSpeedMeta}>
                        <Text style={[styles.floatingSpeedUnit, { color: activeAccent.primary }]}>KM/H</Text>
                        <Text style={styles.floatingRpmMeta}>{activeRpm} RPM · {activeBoost} BAR</Text>
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
                    { id: 'OVERVIEW', label: isEn ? '1. OVERVIEW' : '1. GENERAL' },
                    { id: 'ENGINE_BAY', label: isEn ? '2. ENGINE' : '2. MOTOR' },
                    { id: 'CHASSIS_BRAKES', label: isEn ? '3. BRAKES' : '3. FRÂNE' },
                    { id: 'HIGHWAY_CHASE', label: isEn ? '4. CHASE' : '4. PILOT' },
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

            {/* ── 4. BARA TABS PENTRU CELE 6 FOI DE STICLĂ SPATIALE ── */}
            <View style={styles.spatialTabBar}>
                {[
                    { id: 'XRAY', label: '🔬 X-RAY' },
                    { id: 'REPLAY', label: '📼 REPLAY' },
                    { id: 'SERVICE', label: '🔧 SERVICE' },
                    { id: 'CFD', label: '🌪️ CFD' },
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

                    {spatialSheet === 'XRAY' && (
                        <StationSpatialXRay
                            appLang={appLang}
                            virtualSensors={core.virtualSensors}
                            searchQuery={core.searchQuery}
                            setSearchQuery={core.setSearchQuery}
                            matchedDtc={core.matchedDtc}
                            isExplodedView={isExplodedView}
                            setIsExplodedView={setIsExplodedView}
                            activeAccent={activeAccent}
                        />
                    )}

                    {spatialSheet === 'REPLAY' && (
                        <StationSpatialReplay
                            appLang={appLang}
                            selectedTripId={core.selectedTripId}
                            tripsList={core.tripsList}
                            replaySpeed={core.replaySpeed}
                            replayTotalSamples={core.replayTotalSamples}
                            replayIndex={core.replayIndex}
                            isReplaying={core.isReplaying}
                            activeSpeed={activeSpeed}
                            activeRpm={activeRpm}
                            activeBoost={activeBoost}
                            activeLatG={activeLatG}
                            togglePlayPause={core.togglePlayPause}
                            cycleReplaySpeed={core.cycleReplaySpeed}
                            exportTripPdf={core.exportTripPdf}
                            exportItpDossier={core.exportItpDossier}
                            selectTripForReplay={core.selectTripForReplay}
                            activeAccent={activeAccent}
                        />
                    )}

                    {spatialSheet === 'SERVICE' && (
                        <StationSpatialService
                            appLang={appLang}
                            maintenanceItems={core.maintenanceItems}
                            legalDocuments={core.legalDocuments}
                            markServiceItemCompleted={core.markServiceItemCompleted}
                            tireSize={core.tireSize}
                            setTireSize={core.setTireSize}
                            vehicleMassKg={core.vehicleMassKg}
                            setVehicleMassKg={core.setVehicleMassKg}
                            fuelPricePerLiter={core.fuelPricePerLiter}
                            setFuelPricePerLiter={core.setFuelPricePerLiter}
                            activeAccent={activeAccent}
                        />
                    )}

                    {spatialSheet === 'CFD' && (
                        <StationSpatialCfd
                            cfdData={core.cfdData}
                            telemetry={telemetry}
                            activeAccent={activeAccent}
                            appLang={appLang}
                        />
                    )}

                    {spatialSheet === 'SENTRY' && (
                        <StationSpatialSentry
                            appLang={appLang}
                            sentryArmed={core.sentryArmed}
                            setSentryArmed={core.setSentryArmed}
                            triggerShockSimulation={core.triggerShockSimulation}
                            sentryEvents={core.sentryEvents}
                            valetActive={core.valetActive}
                            valetSpeedLimit={core.valetSpeedLimit}
                            valetRpmLimit={core.valetRpmLimit}
                            toggleValetMode={core.toggleValetMode}
                            carGpsCoords={core.carGpsCoords}
                            openWalkingDirections={core.openWalkingDirections}
                            parkingMinutesRemaining={core.parkingMinutesRemaining}
                            addParkingTime={core.addParkingTime}
                            activeAccent={activeAccent}
                        />
                    )}

                    {spatialSheet === 'COPILOT' && (
                        <StationSpatialCopilot
                            appLang={appLang}
                            aiMessages={core.aiMessages}
                            isAiLoading={core.isAiLoading}
                            sendAiPrompt={core.sendAiPrompt}
                            activeAccent={activeAccent}
                        />
                    )}

                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({

    cfdBadge: {
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    cfdBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    cfdChamberBox: {
        backgroundColor: '#060B12',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#16283D',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        marginVertical: 6,
    },
    cfdMetricsGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
    },
    cfdMetricCard: {
        flex: 1,
        backgroundColor: '#08121E',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#162B44',
        padding: 6,
    },
    cfdMetricLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        marginBottom: 2,
    },
    cfdMetricVal: {
        fontFamily: MONO,
        fontSize: 14,
        fontWeight: '900',
    },
    cfdMetricSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginTop: 2,
    },
    thermalStressGrid: {
        gap: 6,
        marginTop: 6,
    },
    thermalStressCard: {
        backgroundColor: '#08121E',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#162B44',
        padding: 8,
    },
    thermalCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    thermalCardTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    thermalBadge: {
        borderWidth: 1,
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    thermalBadgeText: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
    },
    thermalMetric: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    thermalUnit: {
        fontSize: 8,
        color: '#8CA0BA',
        fontWeight: '600',
    },
    thermalDesc: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginTop: 2,
    },
    spatialSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#08121E',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 4,
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    spatialSearchPrefix: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        marginRight: 6,
    },
    spatialSearchInput: {
        flex: 1,
        fontFamily: MONO,
        fontSize: 9,
        color: '#FFFFFF',
        paddingVertical: 6,
    },
    spatialDtcMatchesBox: {
        backgroundColor: '#08121E',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
    },
    spatialDtcMatchesTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        marginBottom: 4,
    },
    spatialDtcCard: {
        backgroundColor: '#040912',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 3,
        padding: 6,
        marginBottom: 6,
    },
    spatialDtcCardHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    spatialDtcCode: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    spatialDtcSev: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
    },
    spatialDtcCardTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    spatialDtcDesc: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        marginTop: 1,
    },
    spatialDtcCost: {
        fontFamily: MONO,
        fontSize: 7,
        marginTop: 2,
    },
    spatialConfigCard: {
        backgroundColor: '#08121E',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
    },
    spatialConfigTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        marginBottom: 6,
    },
    spatialConfigLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        marginTop: 4,
        marginBottom: 2,
    },
    spatialConfigRow: {
        flexDirection: 'row',
        gap: 4,
        flexWrap: 'wrap',
    },
    spatialConfigBtn: {
        backgroundColor: '#0A1728',
        borderWidth: 1,
        borderColor: '#162B44',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 3,
    },
    spatialConfigBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
    },
    spatialDebriefBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(4, 7, 13, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    spatialDebriefCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#08121E',
        borderWidth: 2,
        borderRadius: 6,
        padding: 14,
    },
    spatialDebriefHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    spatialDebriefBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 2,
    },
    spatialDebriefBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#04070D',
    },
    spatialDebriefTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    spatialDebriefSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        marginBottom: 10,
    },
    spatialDebriefGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginVertical: 4,
    },
    spatialDebriefCell: {
        width: '48%',
        backgroundColor: '#040912',
        borderWidth: 1,
        borderColor: '#162B44',
        borderRadius: 3,
        padding: 6,
    },
    spatialDebriefLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
    },
    spatialDebriefVal: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    spatialDebriefCloseBtn: {
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    spatialDebriefCloseText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },

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
        ...StyleSheet.absoluteFill,
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
