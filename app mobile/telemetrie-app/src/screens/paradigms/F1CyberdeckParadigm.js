// @ts-check
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
    Modal,
    useWindowDimensions,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, {
    Rect,
    Circle,
    Line,
    Polyline,
    Path,
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
import { safeNum, safeFmt, safeArr, sanitizeSvgPath } from '../../utils/safeMath';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.F1_CYBERDECK];

// ─── MEMOIZED F1 SUB-STATION COMPONENTS (FRAME ISOLATION & ZERO GC) ──────────

// ─── P6 SIGNATURE: F1 VIRTUAL DYNO & DRAG BOX ────────────────────────────────
const StationF1DynoDrag = React.memo(function StationF1DynoDrag({
    dynoData,
    dragBox,
    telemetry,
    primaryAccent,
    appLang = 'RO'
}) {
    const isEn = appLang === 'EN';
    const rpm = safeNum(telemetry?.rpm, 800);
    const speed = safeNum(telemetry?.speed, 0);
    const throttle = safeNum(telemetry?.throttle, 0);

    // Dyno points SVG Path generator
    const dynoGraphWidth = SCREEN_WIDTH - 48;
    const dynoGraphHeight = 150;
    const points = dynoData?.points || [];

    // Scale helpers (RPM: 1000-6000, HP/Nm: 0-400)
    const mapX = (r) => Math.max(25, Math.min(dynoGraphWidth - 15, 25 + ((r - 1000) / 5000) * (dynoGraphWidth - 40)));
    const mapY = (v) => Math.max(15, Math.min(dynoGraphHeight - 25, dynoGraphHeight - 25 - (v / 400) * (dynoGraphHeight - 40)));

    let hpPath = '';
    let nmPath = '';
    points.forEach((p, idx) => {
        const x = mapX(p.rpm);
        const yHp = mapY(p.powerHp);
        const yNm = mapY(p.torqueNm);
        const cmd = idx === 0 ? 'M' : 'L';
        hpPath += `${cmd}${x.toFixed(1)},${yHp.toFixed(1)} `;
        nmPath += `${cmd}${x.toFixed(1)},${yNm.toFixed(1)} `;
    });

    const curX = mapX(rpm);
    const curYHp = mapY(dynoData?.currentHp || 0);

    return (
        <View style={styles.pitwallPageContainer}>
            <View style={styles.pitwallPageHeader}>
                <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                    {isEn ? '[ P6 ] VIRTUAL DYNO CHASSIS & PERFORMANCE DRAG BOX' : '[ P6 ] STAND DYNO VIRTUAL & TELEMETRIE DRAG RACING'}
                </Text>
                <Text style={styles.pitwallPageSub}>CALCUL PUTERE SAE & CUPLU DINAMIC PE BAZA FIZICII VEHICULULUI</Text>
            </View>
            <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                {/* 1. Virtual Dyno Graph Card */}
                <View style={styles.f1DynoCard}>
                    <View style={styles.f1DynoHeader}>
                        <View>
                            <Text style={[styles.f1DynoTitle, { color: primaryAccent }]}>
                                {isEn ? 'POWER & TORQUE CURVES (SAE J1349)' : 'CURBĂ PUTERE ȘI CUPLU MOTOR'}
                            </Text>
                            <Text style={styles.f1DynoSub}>TURBO POWER SIMULATION · OBSERVER COUPLING</Text>
                        </View>
                        <View style={styles.f1DynoPeakBadge}>
                            <Text style={[styles.f1DynoPeakText, { color: '#00F0FF' }]}>PEAK: {dynoData?.peakHp} CP / {dynoData?.peakNm} Nm</Text>
                        </View>
                    </View>

                    {/* SVG Dyno Graph */}
                    <View style={styles.f1DynoGraphWrap}>
                        <Svg width={dynoGraphWidth} height={dynoGraphHeight}>
                            {/* Grid Lines */}
                            <Line x1="25" y1="20" x2={dynoGraphWidth - 10} y2="20" stroke="#16263D" strokeDasharray="3,3" />
                            <Line x1="25" y1="60" x2={dynoGraphWidth - 10} y2="60" stroke="#16263D" strokeDasharray="3,3" />
                            <Line x1="25" y1="100" x2={dynoGraphWidth - 10} y2="100" stroke="#16263D" strokeDasharray="3,3" />
                            <Line x1="25" y1={dynoGraphHeight - 25} x2={dynoGraphWidth - 10} y2={dynoGraphHeight - 25} stroke="#2D446B" strokeWidth="1.5" />
                            <Line x1="25" y1="15" x2="25" y2={dynoGraphHeight - 25} stroke="#2D446B" strokeWidth="1.5" />

                            {/* Axis Labels */}
                            <SvgText x="5" y="25" fill="#64748B" fontSize="8" fontFamily={MONO}>350</SvgText>
                            <SvgText x="5" y="65" fill="#64748B" fontSize="8" fontFamily={MONO}>200</SvgText>
                            <SvgText x="5" y="105" fill="#64748B" fontSize="8" fontFamily={MONO}>100</SvgText>
                            <SvgText x="25" y={dynoGraphHeight - 10} fill="#64748B" fontSize="8" fontFamily={MONO}>1k</SvgText>
                            <SvgText x={mapX(3000)} y={dynoGraphHeight - 10} fill="#64748B" fontSize="8" fontFamily={MONO}>3k</SvgText>
                            <SvgText x={mapX(5000)} y={dynoGraphHeight - 10} fill="#64748B" fontSize="8" fontFamily={MONO}>5k RPM</SvgText>

                            {/* Torque Curve (Cyan) */}
                            {nmPath ? <Polyline points={nmPath} fill="none" stroke="#00F0FF" strokeWidth="2.5" /> : null}

                            {/* Power Curve (Orange/Amber) */}
                            {hpPath ? <Polyline points={hpPath} fill="none" stroke="#FFB800" strokeWidth="2.5" /> : null}

                            {/* Current Operating Point */}
                            <Line x1={curX} y1="15" x2={curX} y2={dynoGraphHeight - 25} stroke={primaryAccent} strokeWidth="1.5" strokeDasharray="2,2" />
                            <Circle cx={curX} cy={curYHp} r="5" fill={primaryAccent} stroke="#FFFFFF" strokeWidth="1" />
                        </Svg>
                    </View>

                    {/* Live Metric Badges */}
                    <View style={styles.f1DynoReadoutRow}>
                        <View style={styles.f1DynoReadout}>
                            <Text style={styles.f1DynoReadoutLabel}>{isEn ? 'CURRENT POWER' : 'PUTERE INSTANTANEE'}</Text>
                            <Text style={[styles.f1DynoReadoutVal, { color: '#FFB800' }]}>{dynoData?.currentHp || 0} CP</Text>
                            <Text style={styles.f1DynoReadoutSub}>@ {rpm} RPM ({throttle}% Sarcină)</Text>
                        </View>
                        <View style={styles.f1DynoReadout}>
                            <Text style={styles.f1DynoReadoutLabel}>{isEn ? 'CURRENT TORQUE' : 'CUPLU MOTOR REAL'}</Text>
                            <Text style={[styles.f1DynoReadoutVal, { color: '#00F0FF' }]}>{dynoData?.currentNm || 0} Nm</Text>
                            <Text style={styles.f1DynoReadoutSub}>Peak: {dynoData?.peakNm} Nm @ {dynoData?.peakNmRpm} RPM</Text>
                        </View>
                    </View>
                </View>

                {/* 2. Drag Box Precision Timing Card */}
                <View style={[styles.f1DynoCard, { marginTop: 12 }]}>
                    <View style={styles.f1DynoHeader}>
                        <View>
                            <Text style={[styles.f1DynoTitle, { color: primaryAccent }]}>
                                {isEn ? 'PERFORMANCE DRAG BOX TELEMETRY' : 'CRONOMETRU ACCELERAȚIE & DRAG BOX'}
                            </Text>
                            <Text style={styles.f1DynoSub}>10Hz GPS / CAN SPEED VALIDATION</Text>
                        </View>
                        <View style={[styles.f1DynoPeakBadge, { borderColor: '#00FF66' }]}>
                            <Text style={[styles.f1DynoPeakText, { color: '#00FF66' }]}>STAGE: READY</Text>
                        </View>
                    </View>

                    <View style={styles.f1DragGrid}>
                        <View style={styles.f1DragCell}>
                            <Text style={styles.f1DragCellLabel}>0 — 100 KM/H</Text>
                            <Text style={[styles.f1DragCellVal, { color: '#00FF66' }]}>{dragBox?.time0_100}</Text>
                            <Text style={styles.f1DragCellSub}>Sprint Dinamic</Text>
                        </View>
                        <View style={styles.f1DragCell}>
                            <Text style={styles.f1DragCellLabel}>80 — 120 KM/H</Text>
                            <Text style={[styles.f1DragCellVal, { color: '#00F0FF' }]}>{dragBox?.time80_120}</Text>
                            <Text style={styles.f1DragCellSub}>Repriză Treapta 4</Text>
                        </View>
                        <View style={styles.f1DragCell}>
                            <Text style={styles.f1DragCellLabel}>400 METRI (1/4 MILE)</Text>
                            <Text style={[styles.f1DragCellVal, { color: '#FFB800' }]}>{dragBox?.drag400m}</Text>
                            <Text style={styles.f1DragCellSub}>Trap Speed: 148 km/h</Text>
                        </View>
                        <View style={styles.f1DragCell}>
                            <Text style={styles.f1DragCellLabel}>100 — 0 FRÂNARE</Text>
                            <Text style={[styles.f1DragCellVal, { color: '#FF2A2A' }]}>{dragBox?.brake100_0}</Text>
                            <Text style={styles.f1DragCellSub}>Decelerație: 1.08 G</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
});

const StationF1Sensors = React.memo(function StationF1Sensors({
    virtualSensors,
    searchQuery = '',
    setSearchQuery,
    matchedDtc = [],
    primaryAccent,
    appLang = 'RO',
    onOpenMechanicGuide,
}) {
    const catLabels = {
        engine: '01. GRUP PROPULSOR & INJECȚIE',
        turbo: '02. SUPRAALIMENTARE & ADMISIE',
        thermal: '03. ECHILIBRU TERMIC & RĂCIRE',
        dpf: '04. POST-TRATARE EMISII DPF/SCR',
        electric: '05. REȚEA ELECTRICĂ & BATERIE',
        safety: '06. DINAMICĂ ȘASIU & SIGURANȚĂ',
    };

    const isEn = appLang === 'EN';
    return (
        <View style={styles.pitwallPageContainer}>
            <View style={styles.pitwallPageHeader}>
                <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                    {isEn ? '[ P2 ] McLAREN PITWALL · 32 VIRTUAL SENSORS MATRIX' : '[ P2 ] McLAREN PITWALL · 32 SENZORI VIRTUALI KALMAN'}
                </Text>
                <Text style={styles.pitwallPageSub}>CAN-BUS 500kbps · OBSERVER KALMAN HYBRID</Text>
            </View>

            {/* Fast DTC & Sensor Search Box */}
            <View style={styles.f1SearchBox}>
                <Text style={[styles.f1SearchPrefix, { color: primaryAccent }]}>// CAN QUERY:</Text>
                <TextInput
                    style={styles.f1SearchInput}
                    placeholder={isEn ? "Search DTC (P0234, 00550, MAF, DPF) or sensor..." : "Caută cod DTC (P0234, 00550, MAF, DPF) sau senzor..."}
                    placeholderTextColor="#475569"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: primaryAccent, fontFamily: MONO, fontWeight: '900' }}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Matched DTC Cards */}
            {safeArr(matchedDtc).length > 0 && (
                <View style={styles.f1DtcMatchesBox}>
                    <Text style={[styles.f1DtcMatchesTitle, { color: primaryAccent }]}>
                        {isEn ? '// DTC DATABASE TELEMETRY MATCHES:' : '// ANOMALII DTC IDENTIFICATE ÎN CAN:'}
                    </Text>
                    {matchedDtc.map(item => (
                        <View key={item.code} style={styles.f1DtcCard}>
                            <View style={styles.f1DtcCardHead}>
                                <Text style={[styles.f1DtcCode, { color: primaryAccent }]}>{item.code} / VAG {item.vagCode}</Text>
                                <Text style={[styles.f1DtcSev, { color: item.severity === 'CRIT' ? '#FF2A2A' : '#FFB800' }]}>{item.severity}</Text>
                            </View>
                            <Text style={styles.f1DtcCardTitle}>{item.title}</Text>
                            <Text style={styles.f1DtcDesc}><Text style={{ color: '#64748B' }}>CAUZĂ: </Text>{item.cause}</Text>
                            <Text style={styles.f1DtcDesc}><Text style={{ color: '#64748B' }}>SIMPTOM: </Text>{item.symptoms}</Text>
                            <Text style={styles.f1DtcCost}><Text style={{ color: '#00FF66' }}>COST EST: </Text>{item.costEst} · {item.action}</Text>
                            {onOpenMechanicGuide && (
                                <TouchableOpacity
                                    style={{
                                        marginTop: 6,
                                        paddingVertical: 5,
                                        paddingHorizontal: 8,
                                        backgroundColor: '#FF2A2A20',
                                        borderWidth: 1,
                                        borderColor: '#FF2A2A',
                                        borderRadius: 4,
                                        alignSelf: 'flex-start',
                                    }}
                                    onPress={() => {
                                        hapticTap();
                                        onOpenMechanicGuide(item.code || item.title);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ fontFamily: MONO, fontSize: 10, color: '#FF6B6B', fontWeight: '900' }}>
                                        {isEn ? '🔧 PHYSICAL MECHANIC INSPECTION GUIDE' : '🔧 GHID VERIFICARE FIZICĂ MECANICĂ'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            )}

            <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                {Object.entries(virtualSensors || {}).map(([catKey, sensors]) => (
                    <View key={catKey} style={styles.pitwallSensorsBox}>
                        <Text style={[styles.sensorsGroupTitle, { color: primaryAccent }]}>
                            {catLabels[catKey] || catKey.toUpperCase()}
                        </Text>
                        <View style={styles.sensorsGrid2Col}>
                            {safeArr(sensors).map((s) => {
                                const isWarn = s.status === 'WARN';
                                const isAlert = s.status === 'ALERT';
                                const statusColor = isAlert ? '#FF2A2A' : isWarn ? '#FFB800' : '#00FF66';
                                return (
                                    <TouchableOpacity
                                        key={s.id}
                                        style={[styles.sensorCellF1, { borderColor: isAlert ? '#FF2A2A88' : '#16263D' }]}
                                        onPress={() => {
                                            if (isAlert || isWarn) {
                                                hapticTap();
                                                onOpenMechanicGuide?.(s.label || s.id);
                                            }
                                        }}
                                        activeOpacity={isAlert || isWarn ? 0.7 : 1}
                                    >
                                        <View style={styles.sensorCellTop}>
                                            <Text style={styles.sensorLabelF1} numberOfLines={1}>{s.label}</Text>
                                            <View style={[styles.f1StatusDot, { backgroundColor: statusColor }]} />
                                        </View>
                                        <View style={styles.sensorCellBottom}>
                                            <Text style={[styles.sensorValF1, { color: statusColor }]}>{s.val}</Text>
                                            <Text style={styles.sensorTargetF1}>{isAlert || isWarn ? '🔧 GHID' : `REF: ${s.target}`}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
});

const StationF1Replay = React.memo(function StationF1Replay({
    selectedTripId,
    tripsList,
    replaySpeed,
    replayTotalSamples,
    replayIndex,
    currentReplaySample,
    isReplaying,
    togglePlayPause,
    cycleReplaySpeed,
    exportTripPdf,
    exportItpDossier,
    selectTripForReplay,
    primaryAccent,
    speed,
    rpm,
    boost,
    gForceLat
}) {
    const activeTrip = tripsList.find(t => t.id === selectedTripId);

    // Precalculate SVG sparkline for stint speed profile with 1 decimal precision
    const sparklinePath = useMemo(() => {
        if (!tripsList || tripsList.length < 2) return '';
        const maxV = Math.max(...tripsList.map(t => safeNum(t.maxSpeed, 120)), 140);
        const w = 240;
        const h = 32;
        let d = '';
        tripsList.slice(0, 10).forEach((t, i, arr) => {
            const x = safeFmt((i / (arr.length - 1 || 1)) * w, 1, '0.0');
            const y = safeFmt(h - (safeNum(t.maxSpeed, 0) / maxV) * h, 1, '0.0');
            d += `${i === 0 ? 'M' : 'L'}${x} ${y}`;
        });
        return d;
    }, [tripsList]);

    return (
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
                            REPLAY: {selectedTripId ? (activeTrip?.title || 'STINT SELECTAT') : 'NICIUN STINT'}
                        </Text>
                        <Text style={[styles.f1ReplaySpeedBadge, { color: primaryAccent }]}>{replaySpeed}x</Text>
                    </View>

                    {/* Progress bar / Scrubber */}
                    <View style={styles.f1ScrubberTrack}>
                        <View style={[styles.f1ScrubberFill, { width: `${replayTotalSamples > 0 ? (replayIndex / replayTotalSamples) * 100 : 0}%`, backgroundColor: primaryAccent }]} />
                    </View>

                    {/* Telemetry data for active replay point */}
                    <View style={styles.f1ReplayMetricsRow}>
                        <View style={styles.f1ReplayCol}>
                            <Text style={styles.f1ReplayLabel}>VITEZĂ</Text>
                            <Text style={styles.f1ReplayVal}>{currentReplaySample?.speed ?? speed} <Text style={styles.f1Unit}>km/h</Text></Text>
                        </View>
                        <View style={styles.f1ReplayCol}>
                            <Text style={styles.f1ReplayLabel}>TURAȚIE</Text>
                            <Text style={styles.f1ReplayVal}>{currentReplaySample?.rpm ?? rpm} <Text style={styles.f1Unit}>RPM</Text></Text>
                        </View>
                        <View style={styles.f1ReplayCol}>
                            <Text style={styles.f1ReplayLabel}>BOOST</Text>
                            <Text style={styles.f1ReplayVal}>{safeFmt(currentReplaySample?.boost ?? boost, 2, '0.00')} <Text style={styles.f1Unit}>bar</Text></Text>
                        </View>
                        <View style={styles.f1ReplayCol}>
                            <Text style={styles.f1ReplayLabel}>G-LAT</Text>
                            <Text style={styles.f1ReplayVal}>{safeFmt(currentReplaySample?.gForceLat ?? gForceLat, 2, '0.00')} <Text style={styles.f1Unit}>G</Text></Text>
                        </View>
                    </View>

                    {/* Stint Sparkline SVG */}
                    {sparklinePath ? (
                        <View style={{ marginTop: 8, height: 32, alignItems: 'center' }}>
                            <Svg width={240} height={32} viewBox="0 0 240 32">
                                <Path fill="none" stroke={primaryAccent} strokeWidth="1.5" d={sparklinePath} />
                            </Svg>
                        </View>
                    ) : null}

                    {/* Playback Controls */}
                    <View style={styles.f1ControlsRow}>
                        <TouchableOpacity
                            style={[styles.f1Btn, { backgroundColor: isReplaying ? '#FFB80022' : `${primaryAccent}22`, borderColor: isReplaying ? '#FFB800' : primaryAccent }]}
                            onPress={() => {
                                hapticTap();
                                togglePlayPause();
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={[styles.f1BtnText, { color: isReplaying ? '#FFB800' : primaryAccent }]}>
                                {isReplaying ? '❚❚ PAUZĂ' : '▶ REDĂ'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                            onPress={() => {
                                hapticTap();
                                cycleReplaySpeed();
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.f1BtnText}>{replaySpeed}x VITEZĂ</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                            onPress={() => {
                                hapticTap();
                                exportTripPdf(selectedTripId || 'trip_108');
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.f1BtnText}>📄 PDF STINT</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.f1BtnOutlined, { borderColor: '#16263D' }]}
                            onPress={() => {
                                hapticTap();
                                exportItpDossier();
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
                {safeArr(tripsList).map((trip) => {
                    const isSelected = selectedTripId === trip.id;
                    return (
                        <TouchableOpacity
                            key={trip.id}
                            style={[styles.stintCard, isSelected && { borderColor: primaryAccent, backgroundColor: `${primaryAccent}11` }]}
                            onPress={() => {
                                hapticTap();
                                selectTripForReplay(trip.id);
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
    );
});

const StationF1Scrutineering = React.memo(function StationF1Scrutineering({
    maintenanceItems,
    legalDocuments,
    markServiceItemCompleted,
    tireSize,
    setTireSize,
    vehicleMassKg,
    setVehicleMassKg,
    fuelPricePerLiter,
    setFuelPricePerLiter,
    primaryAccent,
    appLang = 'RO',
    onOpenMechanicGuide,
}) {
    const isEn = appLang === 'EN';
    return (
        <View style={styles.pitwallPageContainer}>
            <View style={styles.pitwallPageHeader}>
                <Text style={[styles.pitwallPageTitle, { color: primaryAccent }]}>
                    {isEn ? '[ P4 ] FIA SCRUTINEERING · VEHICLE SETUP & MAINTENANCE' : '[ P4 ] FIA SCRUTINEERING · CONFIGURARE VEHICUL & SERVICE'}
                </Text>
                <Text style={styles.pitwallPageSub}>UZURĂ ARRHENIUS / ARCHARD & MONITORIZARE LICENȚE</Text>
            </View>
            <ScrollView style={styles.pitwallPageScroll} showsVerticalScrollIndicator={false}>
                {/* ── F1 Vehicle & Tire Configurator ── */}
                <View style={styles.f1ConfigCard}>
                    <Text style={[styles.f1ConfigTitle, { color: primaryAccent }]}>
                        {isEn ? '// CHASSIS MASS, TIRES & FUEL SETUP' : '// CONFIGURATOR RAPID ANVELOPE, MASĂ & COMBUSTIBIL'}
                    </Text>

                    {/* Tire Size */}
                    <Text style={styles.f1ConfigLabel}>{isEn ? 'TIRE PROFILE (ROLLING RADIUS):' : 'PROFIL ANVELOPE (RAZĂ RULARE):'}</Text>
                    <View style={styles.f1ConfigRow}>
                        {['205/55 R16', '225/50 R17', '225/45 R18', '235/40 R19'].map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.f1ConfigBtn, tireSize === s && { backgroundColor: `${primaryAccent}22`, borderColor: primaryAccent }]}
                                onPress={() => { hapticTap(); setTireSize(s); }}
                            >
                                <Text style={[styles.f1ConfigBtnText, tireSize === s && { color: primaryAccent, fontWeight: '900' }]}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Vehicle Mass */}
                    <Text style={styles.f1ConfigLabel}>{isEn ? 'CURB WEIGHT (CHASSIS INERTIA):' : 'MASĂ ȘASIU (CALCUL DYNO & INERȚIE):'}</Text>
                    <View style={styles.f1ConfigRow}>
                        {[1250, 1450, 1650, 1850].map(m => (
                            <TouchableOpacity
                                key={m}
                                style={[styles.f1ConfigBtn, vehicleMassKg === m && { backgroundColor: `${primaryAccent}22`, borderColor: primaryAccent }]}
                                onPress={() => { hapticTap(); setVehicleMassKg(m); }}
                            >
                                <Text style={[styles.f1ConfigBtnText, vehicleMassKg === m && { color: primaryAccent, fontWeight: '900' }]}>{m} kg</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Fuel Price */}
                    <Text style={styles.f1ConfigLabel}>{isEn ? 'FUEL PRICE (RON/L):' : 'PREȚ COMBUSTIBIL (RON/L):'}</Text>
                    <View style={styles.f1ConfigRow}>
                        {[7.10, 7.45, 7.80, 8.20].map(p => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.f1ConfigBtn, fuelPricePerLiter === p && { backgroundColor: `${primaryAccent}22`, borderColor: primaryAccent }]}
                                onPress={() => { hapticTap(); setFuelPricePerLiter(p); }}
                            >
                                <Text style={[styles.f1ConfigBtnText, fuelPricePerLiter === p && { color: primaryAccent, fontWeight: '900' }]}>{p.toFixed(2)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                {/* Wear / CBM List */}
                <Text style={[styles.sensorsGroupTitle, { color: primaryAccent }]}>
                    COMPONENT WEAR & LIFESPAN (CBM)
                </Text>
                {safeArr(maintenanceItems).map((item) => {
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {(isWarn || isCrit) && onOpenMechanicGuide && (
                                        <TouchableOpacity
                                            style={[styles.resetComponentBtn, { borderColor: '#FFB800', backgroundColor: '#FFB80018' }]}
                                            onPress={() => {
                                                hapticTap();
                                                onOpenMechanicGuide(item.title);
                                            }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={[styles.resetComponentBtnText, { color: '#FFB800' }]}>[ 🔧 GHID ]</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={[styles.resetComponentBtn, { borderColor: primaryAccent }]}
                                        onPress={() => {
                                            hapticTap();
                                            markServiceItemCompleted(item.id);
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={[styles.resetComponentBtnText, { color: primaryAccent }]}>[ ✓ RESETARE FIA ]</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    );
                })}

                {/* Legal Documents / Passports */}
                <Text style={[styles.sensorsGroupTitle, { color: primaryAccent, marginTop: 14 }]}>
                    PAȘAPORT TEHNIC & LICENȚE DE CIRCULAȚIE
                </Text>
                <View style={styles.sensorsGrid2Col}>
                    {safeArr(legalDocuments).map((doc, idx) => {
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
    );
});

const StationF1PaddockRadio = React.memo(function StationF1PaddockRadio({
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
    aiMessages,
    isAiLoading,
    sendAiPrompt,
    primaryAccent
}) {
    const [localRadioInput, setLocalRadioInput] = useState('');

    const handleSendRadio = useCallback(() => {
        if (!localRadioInput.trim()) return;
        hapticTap();
        sendAiPrompt(localRadioInput);
        setLocalRadioInput('');
    }, [localRadioInput, sendAiPrompt]);

    return (
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
                            <Text style={styles.paddockSub}>STARE: {sentryArmed ? 'ACTIVAT (RADAR VIBRAȚIE ON)' : 'DEZARMAT'}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.paddockToggleBtn, { backgroundColor: sentryArmed ? '#FF2A2A22' : '#00FF6622', borderColor: sentryArmed ? '#FF2A2A' : '#00FF66' }]}
                            onPress={() => {
                                hapticTap();
                                setSentryArmed(!sentryArmed);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={[styles.paddockToggleText, { color: sentryArmed ? '#FF2A2A' : '#00FF66' }]}>
                                {sentryArmed ? 'DEZARMEAZĂ' : 'ARMEAZĂ'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Shock simulation button */}
                    <TouchableOpacity
                        style={styles.shockSimBtnF1}
                        onPress={() => {
                            hapticTap();
                            triggerShockSimulation();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.shockSimTextF1}>⚡ SIMULEAZĂ ȘOC / TILT ACCELEROMETRU (G-SPIKE)</Text>
                    </TouchableOpacity>

                    {/* Sentry Events Log */}
                    {safeArr(sentryEvents).length > 0 && (
                        <View style={styles.paddockEventsBox}>
                            <Text style={styles.paddockEventsTitle}>JURNAL ALERTE SENZORI VIBRAȚIE</Text>
                            {safeArr(sentryEvents).slice(0, 2).map((ev) => (
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
                            <Text style={styles.paddockSub}>LIMITĂ: {valetSpeedLimit} km/h · {valetRpmLimit} RPM</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.paddockToggleBtn, { backgroundColor: valetActive ? '#FFB80022' : '#16263D', borderColor: valetActive ? '#FFB800' : '#2D446B' }]}
                            onPress={() => {
                                hapticTap();
                                toggleValetMode();
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={[styles.paddockToggleText, { color: valetActive ? '#FFB800' : '#8EADC8' }]}>
                                {valetActive ? 'ACTIV' : 'INACTIV'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* GPS Paddock Route & Parking Timer */}
                    <View style={[styles.paddockHeaderRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#16263D' }]}>
                        <View>
                            <Text style={styles.paddockTitle}>COORDONATE GPS MAȘINĂ</Text>
                            <Text style={styles.paddockCoords}>{safeFmt(carGpsCoords?.lat, 4, '44.4323')}°N, {safeFmt(carGpsCoords?.lng ?? carGpsCoords?.lon, 4, '26.1063')}°E</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.paddockNavBtn, { borderColor: primaryAccent }]}
                            onPress={() => {
                                hapticTap();
                                openWalkingDirections();
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={[styles.paddockNavBtnText, { color: primaryAccent }]}>NAVIGHEAZĂ 📍</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Parking Ticket Stint Timer */}
                    <View style={styles.stintTimerRow}>
                        <Text style={styles.stintTimerLabel}>CRONOMETRU TICHET PARCARE:</Text>
                        <Text style={[styles.stintTimerVal, { color: parkingMinutesRemaining < 15 ? '#FF2A2A' : '#00FF66' }]}>
                            {parkingMinutesRemaining} MIN
                        </Text>
                        <View style={styles.stintBtnsRow}>
                            {[15, 30, 60].map(mins => (
                                <TouchableOpacity
                                    key={mins}
                                    style={styles.stintAddBtn}
                                    onPress={() => {
                                        hapticTap();
                                        addParkingTime(mins);
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
                                sendAiPrompt(chip);
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                            <Text style={styles.radioChipText} numberOfLines={1}>{chip}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* AI Radio Messages Box */}
                <View style={styles.radioCommsBox}>
                    {safeArr(aiMessages).slice(-3).map((msg) => (
                        <View key={msg.id} style={styles.radioMsgRow}>
                            <Text style={[styles.radioSender, { color: msg.sender === 'user' ? '#00F0FF' : '#FFB800' }]}>
                                {msg.sender === 'user' ? '[PILOT]' : '[PITWALL ENG]'}:
                            </Text>
                            <Text style={styles.radioMsgText}>{msg.text}</Text>
                        </View>
                    ))}
                    {isAiLoading && (
                        <Text style={[styles.radioMsgText, { color: '#00F0FF' }]}>📡 PITWALL COMMS: Se procesează telemetria...</Text>
                    )}
                </View>

                {/* AI Radio Input Row */}
                <View style={styles.radioInputRow}>
                    <TextInput
                        style={styles.radioTextInput}
                        placeholder="Transmite mesaj către inginerul de cursă..."
                        placeholderTextColor="#475569"
                        value={localRadioInput}
                        onChangeText={setLocalRadioInput}
                    />
                    <TouchableOpacity
                        style={[styles.radioSendBtn, { backgroundColor: primaryAccent }]}
                        onPress={handleSendRadio}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.radioSendBtnText}>TRANSMITE</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
});

export default function F1CyberdeckParadigm() {
    const insets = useSafeInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const isLandscape = screenWidth > screenHeight;

    // Stare Pagini Pitwall: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
    const [pitwallPage, setPitwallPage] = useState('P1');
    const isLiveViewActive = pitwallPage === 'P1' || pitwallPage === 'P2';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const {
        setUiParadigm,
        openExperiencePicker,
        openSimulatorModal,
        appLang,
        toggleAppLang,
        openMechanicGuide,
    } = useUiParadigm();
    const isEn = appLang === 'EN';
    const [f1AccentKey, setF1AccentKey] = useState('CYAN'); // 'CYAN' | 'RED' | 'LIME'

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
        const val = Math.sqrt(safeNum(gForceLat) * safeNum(gForceLat) + safeNum(gForceLong) * safeNum(gForceLong));
        return Number(safeFmt(val, 2, '0.00'));
    }, [gForceLat, gForceLong]);

    const gripUtilizationPct = useMemo(() => {
        return Math.min(100, Math.round((totalG / 1.10) * 100));
    }, [totalG]);

    // 5. 4-Corner Brake Disc Pyrometer simulation (°C)
    const brakePyrometer = useMemo(() => {
        const base = Math.max(safeNum(brakeFluidTemp, 90) + 80, 180);
        const sLat = safeNum(gForceLat, 0);
        const sLong = safeNum(gForceLong, 0);
        const biasFL = Math.round(base + Math.abs(sLat) * 25 + (sLong < 0 ? Math.abs(sLong) * 45 : 0));
        const biasFR = Math.round(base - Math.abs(sLat) * 10 + (sLong < 0 ? Math.abs(sLong) * 45 : 0));
        const biasRL = Math.round(base * 0.75 + Math.abs(sLat) * 15);
        const biasRR = Math.round(base * 0.75 - Math.abs(sLat) * 5);
        return { fl: biasFL, fr: biasFR, rl: biasRL, rr: biasRR };
    }, [brakeFluidTemp, gForceLat, gForceLong]);

    // 3. Alimentare osciloscop în ring buffer fără alocări masive
    useEffect(() => {
        if (!isLiveViewActive) return;

        const idx = ringIndexRef.current;
        ringBufferRef.current[idx] = { boost: safeNum(boost, 0), rpm: safeNum(rpm, 800) };
        ringIndexRef.current = (idx + 1) % 25;

        // Generate SVG Path d string with 1 decimal precision
        let bPath = '';
        let rPath = '';
        for (let i = 0; i < 25; i++) {
            const bufferIdx = (ringIndexRef.current + i) % 25;
            const pt = ringBufferRef.current[bufferIdx] || { boost: 0, rpm: 800 };
            const ptBoost = safeNum(pt.boost, 0);
            const ptRpm = safeNum(pt.rpm, 800);
            const x = safeFmt(i * (160 / 24), 1, '0.0');
            const yBoost = safeFmt(52 - (ptBoost * 20), 1, '0.0');
            const yRpm = safeFmt(56 - (ptRpm / 110), 1, '0.0');
            const cmd = i === 0 ? 'M' : 'L';
            bPath += `${cmd}${x} ${yBoost}`;
            rPath += `${cmd}${x} ${yRpm}`;
        }
        setOscilloscopePoints({
            boostPoints: bPath,
            rpmPoints: rPath,
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

    const cellWidth = isLandscape ? Math.floor((screenWidth - 36) / 3) : Math.floor((screenWidth - 22) / 2);
    const cellHeight = isLandscape ? '48%' : '32%';
    const dynamicCell = { width: cellWidth, height: cellHeight, borderColor: borderAccent };

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
                        <Text style={styles.actionBtnText}>◀ CLASIC V2</Text>
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

                    {/* Stint Debrief Button */}
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: primaryAccent, backgroundColor: `${primaryAccent}1A` }]}
                        onPress={() => {
                            hapticTap();
                            core.openTripDebrief();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionBtnText, { color: primaryAccent }]}>🧾</Text>
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

            {/* ── PITWALL PAGES SELECTOR (P1..P6) ── */}
            <View style={styles.pitwallTabBar}>
                {[
                    { id: 'P1', label: isEn ? 'P1·RACE' : 'P1·CURSĂ' },
                    { id: 'P2', label: isEn ? 'P2·SENSORS' : 'P2·SENZORI' },
                    { id: 'P3', label: isEn ? 'P3·REPLAY' : 'P3·REPLAY' },
                    { id: 'P4', label: isEn ? 'P4·SCRUT' : 'P4·VERIF' },
                    { id: 'P5', label: isEn ? 'P5·RADIO' : 'P5·RADIO' },
                    { id: 'P6', label: isEn ? 'P6·DYNO' : 'P6·DYNO' },
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
                        <View style={[styles.monitorCell, dynamicCell]}>
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
                                    <Text style={styles.gearLabel}>{isEn ? 'GEAR' : 'TREAPTĂ'}</Text>
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
                        <View style={[styles.monitorCell, dynamicCell]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>{isEn ? 'M2 // LIVE SCOPE' : 'M2 // OSCILOSCOP LIVE'}</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(2)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={[styles.monMaxIcon, { color: primaryAccent }]}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.oscilloscopeContainer}>
                                <Svg width={Math.max(100, Math.floor(cellWidth - 14))} height={56} viewBox="0 0 160 56">
                                    <Line x1="0" y1="28" x2="160" y2="28" stroke="#112233" strokeDasharray="3, 3" />
                                    {oscilloscopePoints.boostPoints ? (
                                        <Path
                                            fill="none"
                                            stroke={primaryAccent}
                                            strokeWidth="2"
                                            d={oscilloscopePoints.boostPoints}
                                        />
                                    ) : null}
                                    {oscilloscopePoints.rpmPoints ? (
                                        <Path
                                            fill="none"
                                            stroke="#FFB800"
                                            strokeWidth="1"
                                            strokeDasharray="2, 2"
                                            d={oscilloscopePoints.rpmPoints}
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
                        <View style={[styles.monitorCell, dynamicCell]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>{isEn ? 'M3 // SENSOR DNA' : 'M3 // MATRICE SENZORI'}</Text>
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
                        <View style={[styles.monitorCell, dynamicCell]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>{isEn ? 'M4 // BRAKES & SANKEY' : 'M4 // FRÂNE & ENERGIE'}</Text>
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
                        <View style={[styles.monitorCell, dynamicCell]}>
                            <View style={styles.monHeader}>
                                <Text style={[styles.monTitle, { color: primaryAccent }]}>{isEn ? 'M5 // STRATEGY & RUL' : 'M5 // STRATEGIE & UZURĂ'}</Text>
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
                                <Text style={styles.weibullLine}>{isEn ? 'RISK' : 'RISC PANĂ'}: <Text style={{ color: '#FFB800' }}>{breakdownRisk}%</Text></Text>
                            </View>
                        </View>

                        {/* ── M6: 8. BOSCH UDS & CAN-BUS TEC/REC MONITOR ── */}
                        <View style={[styles.monitorCell, dynamicCell]}>
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
                                    <TouchableOpacity
                                        onPress={() => {
                                            hapticTap();
                                            openMechanicGuide(criticalAlerts[0].title || criticalAlerts[0].key);
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.udsLog, { color: '#FF2A2A' }]} numberOfLines={1}>
                                            [DTC] {criticalAlerts[0].title} 🔧
                                        </Text>
                                    </TouchableOpacity>
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
                                <Text style={styles.closeExpandedText}>{isEn ? '◀ BACK TO ALL 6 MONITORS' : '◀ ÎNAPOI LA TOATE CELE 6 MONITOARE'}</Text>
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
                    <StationF1Sensors
                        virtualSensors={core.virtualSensors}
                        searchQuery={core.searchQuery}
                        setSearchQuery={core.setSearchQuery}
                        matchedDtc={core.matchedDtc}
                        primaryAccent={primaryAccent}
                        appLang={appLang}
                        onOpenMechanicGuide={openMechanicGuide}
                    />
                )}

                {/* ── P3: STINT REPLAY PLAYER & FIA DOSSIER ── */}
                {pitwallPage === 'P3' && (
                    <StationF1Replay
                        selectedTripId={core.selectedTripId}
                        tripsList={core.tripsList}
                        replaySpeed={core.replaySpeed}
                        replayTotalSamples={core.replayTotalSamples}
                        replayIndex={core.replayIndex}
                        currentReplaySample={core.currentReplaySample}
                        isReplaying={core.isReplaying}
                        togglePlayPause={core.togglePlayPause}
                        cycleReplaySpeed={core.cycleReplaySpeed}
                        exportTripPdf={core.exportTripPdf}
                        exportItpDossier={core.exportItpDossier}
                        selectTripForReplay={core.selectTripForReplay}
                        primaryAccent={primaryAccent}
                        speed={speed}
                        rpm={rpm}
                        boost={boost}
                        gForceLat={gForceLat}
                    />
                )}

                {/* ── P4: FIA SCRUTINEERING & PASSES ── */}
                {pitwallPage === 'P4' && (
                    <StationF1Scrutineering
                        maintenanceItems={core.maintenanceItems}
                        legalDocuments={core.legalDocuments}
                        markServiceItemCompleted={core.markServiceItemCompleted}
                        tireSize={core.tireSize}
                        setTireSize={core.setTireSize}
                        vehicleMassKg={core.vehicleMassKg}
                        setVehicleMassKg={core.setVehicleMassKg}
                        fuelPricePerLiter={core.fuelPricePerLiter}
                        setFuelPricePerLiter={core.setFuelPricePerLiter}
                        primaryAccent={primaryAccent}
                        appLang={appLang}
                        onOpenMechanicGuide={openMechanicGuide}
                    />
                )}

                {/* ── P5: PADDOCK SECURITY & TEAM RADIO AI ── */}
                {pitwallPage === 'P5' && (
                    <StationF1PaddockRadio
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
                        aiMessages={core.aiMessages}
                        isAiLoading={core.isAiLoading}
                        sendAiPrompt={core.sendAiPrompt}
                        primaryAccent={primaryAccent}
                    />
                )}

                {/* ── P6: VIRTUAL DYNO CHASSIS & PERFORMANCE DRAG BOX ── */}
                {pitwallPage === 'P6' && (
                    <StationF1DynoDrag
                        dynoData={core.dynoData}
                        dragBox={core.dragBox}
                        telemetry={telemetry}
                        primaryAccent={primaryAccent}
                        appLang={appLang}
                    />
                )}
            </View>

            {/* ── PARC FERMÉ STINT DEBRIEF MODAL ── */}
            <Modal
                visible={core.showDebriefModal}
                transparent
                animationType="fade"
                onRequestClose={core.closeTripDebrief}
            >
                <View style={styles.f1DebriefBackdrop}>
                    <View style={[styles.f1DebriefCard, { borderColor: primaryAccent }]}>
                        <View style={styles.f1DebriefHead}>
                            <View style={[styles.f1DebriefBadge, { backgroundColor: primaryAccent }]}>
                                <Text style={styles.f1DebriefBadgeText}>FIA PARC FERMÉ</Text>
                            </View>
                            <Text style={[styles.f1DebriefTitle, { color: primaryAccent }]}>
                                {isEn ? 'STINT TELEMETRY DEBRIEF' : 'BILANȚ TELEMETRIE STINT'}
                            </Text>
                        </View>
                        <Text style={styles.f1DebriefSub}>McLAREN TELEMETRY ACQUISITION SYSTEM · CAN-BUS LOG</Text>

                        <View style={styles.f1DebriefGrid}>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'STINT DISTANCE' : 'DISTANȚĂ STINT'}</Text>
                                <Text style={[styles.f1DebriefVal, { color: '#00FF66' }]}>{core.lastTripDebrief?.km} KM</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'STINT DURATION' : 'DURATĂ STINT'}</Text>
                                <Text style={styles.f1DebriefVal}>{core.lastTripDebrief?.duration}</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'TOP SPEED' : 'VITEZĂ MAXIMĂ'}</Text>
                                <Text style={[styles.f1DebriefVal, { color: '#00F0FF' }]}>{core.lastTripDebrief?.maxSpeed} KM/H</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'AVG CONSUMPTION' : 'CONSUM MEDIU'}</Text>
                                <Text style={styles.f1DebriefVal}>{core.lastTripDebrief?.avgConsumption} L/100</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'FUEL BURNED' : 'CARBURANT ARS'}</Text>
                                <Text style={styles.f1DebriefVal}>{core.lastTripDebrief?.fuelBurnedLiters} L ({core.lastTripDebrief?.fuelCostRon} RON)</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'BRAKE ENERGY' : 'DISIPARE FRÂNE'}</Text>
                                <Text style={[styles.f1DebriefVal, { color: '#FFB800' }]}>{core.lastTripDebrief?.brakeEnergyMj} MJ</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'OIL WEAR FACTOR' : 'UZURĂ ULEI ARRHENIUS'}</Text>
                                <Text style={styles.f1DebriefVal}>{core.lastTripDebrief?.oilStressFactor}x</Text>
                            </View>
                            <View style={styles.f1DebriefCell}>
                                <Text style={styles.f1DebriefLabel}>{isEn ? 'HEALTH SCORE' : 'SCOR DE SĂNĂTATE'}</Text>
                                <Text style={[styles.f1DebriefVal, { color: '#00FF66' }]}>{core.lastTripDebrief?.healthScore}%</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.f1DebriefCloseBtn, { borderColor: primaryAccent, backgroundColor: `${primaryAccent}22` }]}
                            onPress={() => {
                                hapticTap();
                                core.closeTripDebrief();
                            }}
                        >
                            <Text style={[styles.f1DebriefCloseText, { color: primaryAccent }]}>
                                [ ✕ {isEn ? 'CLOSE PARC FERMÉ DEBRIEF' : 'ÎNCHIDE BILANȚ STINT'} ]
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({

    f1DynoCard: {
        backgroundColor: '#080D16',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 10,
    },
    f1DynoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    f1DynoTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    f1DynoSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
    },
    f1DynoPeakBadge: {
        borderWidth: 1,
        borderColor: '#00F0FF',
        borderRadius: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    f1DynoPeakText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
    },
    f1DynoGraphWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        backgroundColor: '#04070B',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#0E1726',
        paddingVertical: 4,
    },
    f1DynoReadoutRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    f1DynoReadout: {
        flex: 1,
        backgroundColor: '#0B1524',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 8,
    },
    f1DynoReadoutLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginBottom: 2,
    },
    f1DynoReadoutVal: {
        fontFamily: MONO,
        fontSize: 15,
        fontWeight: '900',
    },
    f1DynoReadoutSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8EADC8',
        marginTop: 2,
    },
    f1DragGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    f1DragCell: {
        width: (SCREEN_WIDTH - 64) / 2,
        backgroundColor: '#0B1524',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 8,
    },
    f1DragCellLabel: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
        fontWeight: '800',
    },
    f1DragCellVal: {
        fontFamily: MONO,
        fontSize: 16,
        fontWeight: '900',
        marginVertical: 2,
    },
    f1DragCellSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
    },
    f1SearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    f1SearchPrefix: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        marginRight: 6,
    },
    f1SearchInput: {
        flex: 1,
        fontFamily: MONO,
        fontSize: 9,
        color: '#FFFFFF',
        paddingVertical: 6,
    },
    f1DtcMatchesBox: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
    },
    f1DtcMatchesTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        marginBottom: 4,
    },
    f1DtcCard: {
        backgroundColor: '#04070B',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 3,
        padding: 6,
        marginBottom: 6,
    },
    f1DtcCardHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    f1DtcCode: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },
    f1DtcSev: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
    },
    f1DtcCardTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    f1DtcDesc: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8EADC8',
        marginTop: 1,
    },
    f1DtcCost: {
        fontFamily: MONO,
        fontSize: 7,
        marginTop: 2,
    },
    f1ConfigCard: {
        backgroundColor: '#080D16',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
    },
    f1ConfigTitle: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        marginBottom: 6,
    },
    f1ConfigLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginTop: 4,
        marginBottom: 2,
    },
    f1ConfigRow: {
        flexDirection: 'row',
        gap: 4,
        flexWrap: 'wrap',
    },
    f1ConfigBtn: {
        backgroundColor: '#0B1524',
        borderWidth: 1,
        borderColor: '#16263D',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 3,
    },
    f1ConfigBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8EADC8',
    },
    f1DebriefBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(3, 5, 8, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    f1DebriefCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#080D16',
        borderWidth: 2,
        borderRadius: 6,
        padding: 14,
    },
    f1DebriefHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    f1DebriefBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 2,
    },
    f1DebriefBadgeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '900',
        color: '#000000',
    },
    f1DebriefTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
    },
    f1DebriefSub: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        marginBottom: 10,
    },
    f1DebriefGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginVertical: 4,
    },
    f1DebriefCell: {
        width: '48%',
        backgroundColor: '#04070B',
        borderWidth: 1,
        borderColor: '#16263D',
        borderRadius: 3,
        padding: 6,
    },
    f1DebriefLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
    },
    f1DebriefVal: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    f1DebriefCloseBtn: {
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    f1DebriefCloseText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
    },

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
