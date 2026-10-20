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
    TextInput,
    Modal,
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle, Rect, G } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useParadigmCoreData } from '../../hooks/useParadigmCoreData';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticCriticalWarning, hapticShiftAlert } from '../../services/hapticFeedback';
import { audioGong } from '../../services/audioGongService';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';
import { safeNum, safeFmt, safeArr, sanitizeSvgPath } from '../../utils/safeMath';
import WeibullTimeMachineCard from '../../components/innovations/WeibullTimeMachineCard';
import VirtualDynoDragCard from '../../components/innovations/VirtualDynoDragCard';
import SankeyThermalCard from '../../components/innovations/SankeyThermalCard';
import KammBrakeRadarCard from '../../components/innovations/KammBrakeRadarCard';

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

const SvgDotMatrixChar = React.memo(function SvgDotMatrixChar({ char = '0', x = 0, y = 0, dotSize = 4, gap = 2, color = '#FFFFFF' }) {
    const matrix = FONT_5X7[char] || FONT_5X7['0'];
    const sDotSize = safeNum(dotSize, 4);
    const sGap = safeNum(gap, 2);
    const sX = safeNum(x, 0);
    const sY = safeNum(y, 0);
    const r = sDotSize / 2;
    let path = '';
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
            if (matrix[row][col] === 1) {
                const cx = sX + col * (sDotSize + sGap) + r;
                const cy = sY + row * (sDotSize + sGap) + r;
                path += `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0 `;
            }
        }
    }
    return <Path d={sanitizeSvgPath(path)} fill={color} />;
});

// ─── 10. Bionic Thermal Ribbon (Color-Free Contrast Shading) ─────────────────
function generateBionicPulsePath(width, height, loadPct = 20, coolantTemp = 90) {
    const sWidth = Math.max(10, safeNum(width, 300));
    const sHeight = Math.max(10, safeNum(height, 50));
    const sLoad = safeNum(loadPct, 20);
    const sTemp = safeNum(coolantTemp, 90);

    const baselineY = sHeight / 2;
    const intensity = Math.min(Math.max(sLoad / 100, 0.15), 1.0);
    const peakHeight = (sHeight * 0.44) * (0.35 + intensity * 0.65);

    const step = sWidth / 12;
    const p1 = baselineY;
    const p2 = baselineY - (peakHeight * 0.25);
    const p3 = baselineY + (peakHeight * 0.2);
    const p4 = baselineY - peakHeight;
    const p5 = baselineY + (peakHeight * 0.85);
    const p6 = baselineY - (peakHeight * 0.45);
    const p7 = baselineY;

    const rawPath = `M 0 ${baselineY} ` +
        `L ${step * 2} ${baselineY} ` +
        `L ${step * 3} ${p1} ` +
        `L ${step * 3.8} ${p2} ` +
        `L ${step * 4.4} ${p3} ` +
        `L ${step * 5.2} ${p4} ` +
        `L ${step * 6.0} ${p5} ` +
        `L ${step * 6.8} ${p6} ` +
        `L ${step * 7.5} ${p7} ` +
        `L ${sWidth} ${baselineY}`;

    const pathD = sanitizeSvgPath(rawPath);

    // Contrast shading properties:
    // Cold (<75°C) = Dotted 1px; Optimal (75-96°C) = Solid 2.5px; Stress (>98°C) = Heavy Stipple
    let strokeWidth = 2.0;
    let strokeDasharray = undefined;
    if (sTemp < 75) {
        strokeWidth = 1.2;
        strokeDasharray = '3, 4';
    } else if (sTemp > 98) {
        strokeWidth = 3.2;
        strokeDasharray = '6, 2';
    }

    return { pathD, strokeWidth, strokeDasharray };
}

// ─── MEMOIZED SUB-STATION COMPONENTS (ZERO GC & FRAME ISOLATION) ──────────────

const StationNothingPulse = React.memo(function StationNothingPulse({
    telemetry,
    tp7Anomalies,
    zenDriveScore,
    currentTheme,
    appLang = 'RO',
    dynoData = null,
    dragBox = null,
    sankeyData = null,
    brakePyrometer = null,
}) {
    const isEn = appLang === 'EN';
    const [pulseSubMode, setPulseSubMode] = useState('PULSE'); // 'PULSE' | 'TP7' | 'ZEN'
    const boost = safeNum(telemetry?.boost, 0);
    const coolantTemp = safeNum(telemetry?.coolantTemp, 90);
    const batteryVoltage = safeNum(telemetry?.batteryVoltage, 12);
    const oilTemp = safeNum(telemetry?.oilTemp, 90);
    const exhaustTemp = safeNum(telemetry?.exhaustTemp, 380);
    const gLat = safeNum(telemetry?.gForceLat, 0);
    const gLong = safeNum(telemetry?.gForceLong, 0);
    const gTotal = safeFmt(Math.sqrt(gLat * gLat + gLong * gLong), 2, '0.00');

    return (
        <View style={styles.tabContent}>
            {/* Sub-selector Nothing: Vital Pulse | TP-7 Tape Recorder | Zen Drive Coach */}
            <View style={styles.nothingSubSwitchRow}>
                {[
                    { id: 'PULSE', label: isEn ? '01·VITAL PULSE' : '01·PULS VITAL' },
                    { id: 'TP7', label: isEn ? '02·TP-7 TAPE' : '02·TP-7 TAPE' },
                    { id: 'ZEN', label: isEn ? '03·ZEN COACH' : '03·ZEN COACH' },
                ].map((m) => (
                    <TouchableOpacity
                        key={m.id}
                        style={[
                            styles.nothingSubSwitchBtn,
                            { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg },
                            pulseSubMode === m.id && { backgroundColor: currentTheme.textPrimary, borderColor: currentTheme.textPrimary },
                        ]}
                        onPress={() => {
                            hapticTap();
                            setPulseSubMode(m.id);
                        }}
                    >
                        <Text
                            style={[
                                styles.nothingSubSwitchText,
                                { color: pulseSubMode === m.id ? currentTheme.bg : currentTheme.textDim },
                                pulseSubMode === m.id && { fontWeight: '900' },
                            ]}
                        >
                            {m.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* MOD 1: PULS VITAL GRID */}
            {pulseSubMode === 'PULSE' && (
                <>
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
                        <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                            <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>EGT EVACUARE</Text>
                            <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{exhaustTemp} <Text style={styles.metricUnit}>°C</Text></Text>
                        </View>
                        <View style={[styles.metricCell, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                            <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>G-FORCE TOTAL</Text>
                            <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{gTotal} <Text style={styles.metricUnit}>G</Text></Text>
                        </View>
                    </View>

                    {/* ── Transfer Inovații F1 & 3D în Nothing OS ── */}
                    <VirtualDynoDragCard
                        variant="nothing"
                        appLang={appLang}
                        dynoData={dynoData}
                        dragBox={dragBox}
                        telemetry={telemetry}
                    />

                    <SankeyThermalCard
                        variant="nothing"
                        appLang={appLang}
                        sankeyData={sankeyData}
                        telemetry={telemetry}
                    />

                    <KammBrakeRadarCard
                        variant="nothing"
                        appLang={appLang}
                        telemetry={telemetry}
                        brakePyrometer={brakePyrometer}
                    />
                </>
            )}

            {/* MOD 2: TP-7 TELEMETRY TAPE RECORDER (EXCLUSIVE NOTHING SIGNATURE) */}
            {pulseSubMode === 'TP7' && (
                <View style={[styles.tp7Frame, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                    <View style={styles.tp7TopRow}>
                        <View style={styles.tp7RecIndicator}>
                            <View style={[styles.tp7Led, { backgroundColor: currentTheme.accent }]} />
                            <Text style={[styles.tp7RecText, { color: currentTheme.accent }]}>● REC // CH-1 OB-II</Text>
                        </View>
                        <Text style={[styles.tp7Counter, { color: currentTheme.textPrimary }]}>04:18.92</Text>
                    </View>

                    {/* Bobine Casete Duble Animate Vectorial */}
                    <View style={styles.tp7ReelsContainer}>
                        <Svg width={SCREEN_WIDTH - 64} height={110} viewBox="0 0 300 110">
                            {/* Bandă magnetică între role */}
                            <Line x1="75" y1="55" x2="225" y2="55" stroke={currentTheme.divider} strokeWidth="12" />
                            <Line x1="75" y1="55" x2="225" y2="55" stroke={currentTheme.textDim} strokeWidth="2" strokeDasharray="4,4" />

                            {/* Rola Stânga (Supply Reel) */}
                            <Circle cx="75" cy="55" r="42" fill="none" stroke={currentTheme.textPrimary} strokeWidth="2" />
                            <Circle cx="75" cy="55" r="28" fill="none" stroke={currentTheme.cardBorder} strokeWidth="6" />
                            <Circle cx="75" cy="55" r="14" fill={currentTheme.textPrimary} />
                            <Line x1="75" y1="18" x2="75" y2="92" stroke={currentTheme.bg} strokeWidth="2" />
                            <Line x1="38" y1="55" x2="112" y2="55" stroke={currentTheme.bg} strokeWidth="2" />

                            {/* Rola Dreapta (Take-up Reel) */}
                            <Circle cx="225" cy="55" r="42" fill="none" stroke={currentTheme.textPrimary} strokeWidth="2" />
                            <Circle cx="225" cy="55" r="28" fill="none" stroke={currentTheme.cardBorder} strokeWidth="6" />
                            <Circle cx="225" cy="55" r="14" fill={currentTheme.textPrimary} />
                            <Line x1="225" y1="18" x2="225" y2="92" stroke={currentTheme.bg} strokeWidth="2" />
                            <Line x1="188" y1="55" x2="262" y2="55" stroke={currentTheme.bg} strokeWidth="2" />

                            {/* Cap de redare / Anomaly Marker Pin */}
                            <Rect x="142" y="38" width="16" height="34" rx="3" fill={currentTheme.accent} />
                            <Line x1="150" y1="38" x2="150" y2="72" stroke="#FFFFFF" strokeWidth="1" />
                        </Svg>
                    </View>

                    {/* Pini Anomalii de pe Bandă */}
                    <Text style={[styles.tp7AnomHeader, { color: currentTheme.textDim }]}>
                        {isEn ? '// TAPE ANOMALY PINS (INDEXED):' : '// PINI ANOMALII PE BANDĂ (INDEXAȚI):'}
                    </Text>
                    <View style={styles.tp7AnomGrid}>
                        {safeArr(tp7Anomalies).map((pin) => (
                            <View key={pin.id} style={[styles.tp7AnomCard, { borderColor: currentTheme.cardBorder }]}>
                                <View style={[styles.tp7PinTag, { backgroundColor: pin.pinColor }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.tp7PinLabel, { color: currentTheme.textPrimary }]}>{pin.label}</Text>
                                    <Text style={[styles.tp7PinTime, { color: currentTheme.textDim }]}>T+{pin.timeSec}s · {pin.val}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* MOD 3: ZEN DRIVE COACH (SMOOTHNESS SCORE 0-100%) */}
            {pulseSubMode === 'ZEN' && (
                <View style={[styles.zenFrame, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                    <Text style={[styles.zenHeader, { color: currentTheme.textDim }]}>
                        {isEn ? '// ZEN DRIVE COACH · LATERAL & LONGITUDINAL SMOOTHNESS' : '// ZEN DRIVE COACH · FLUIDITATE ȘI REDUCERE UZURĂ'}
                    </Text>

                    {/* Ring Central de Scor Zen */}
                    <View style={styles.zenScoreBox}>
                        <Svg width={140} height={140} viewBox="0 0 140 140">
                            <Circle cx="70" cy="70" r="54" fill="none" stroke={currentTheme.cardBorder} strokeWidth="8" />
                            <Circle
                                cx="70"
                                cy="70"
                                r="54"
                                fill="none"
                                stroke={zenDriveScore > 80 ? '#00FF66' : zenDriveScore > 60 ? '#FFB800' : currentTheme.accent}
                                strokeWidth="8"
                                strokeDasharray={`${(zenDriveScore / 100) * 339} 339`}
                                strokeLinecap="round"
                                transform="rotate(-90 70 70)"
                            />
                        </Svg>
                        <View style={styles.zenScoreCenter}>
                            <Text style={[styles.zenScoreNum, { color: currentTheme.textPrimary }]}>{zenDriveScore}</Text>
                            <Text style={[styles.zenScorePct, { color: currentTheme.textDim }]}>/ 100</Text>
                        </View>
                    </View>

                    <Text style={[styles.zenVerdict, { color: zenDriveScore > 80 ? '#00FF66' : currentTheme.textPrimary }]}>
                        {zenDriveScore > 85
                            ? (isEn ? 'SILKY SMOOTH // ZERO BRAKE/TIRE STRESS' : 'CONDUCERE FLUIDĂ // ZERO ȘOCURI MECANICE')
                            : zenDriveScore > 65
                            ? (isEn ? 'MODERATE CORNERING FORCES' : 'FORȚE MODERATE // REVIZIUIRE ACCELERAȚIE')
                            : (isEn ? 'HIGH G-SPIKES // HIGH TIRE & FUEL WEAR' : 'ȘOCURI G RIDICATE // UZURĂ ANVELOPE ȘI COMBUSTIBIL')}
                    </Text>

                    <View style={styles.zenMetricsRow}>
                        <View style={[styles.zenMetricCard, { borderColor: currentTheme.cardBorder }]}>
                            <Text style={[styles.zenMetricLabel, { color: currentTheme.textDim }]}>{isEn ? 'LATERAL G' : 'FORȚĂ G LAT'}</Text>
                            <Text style={[styles.zenMetricVal, { color: currentTheme.textPrimary }]}>{gLat} G</Text>
                        </View>
                        <View style={[styles.zenMetricCard, { borderColor: currentTheme.cardBorder }]}>
                            <Text style={[styles.zenMetricLabel, { color: currentTheme.textDim }]}>{isEn ? 'LONG G' : 'FORȚĂ G LONG'}</Text>
                            <Text style={[styles.zenMetricVal, { color: currentTheme.textPrimary }]}>{gLong} G</Text>
                        </View>
                        <View style={[styles.zenMetricCard, { borderColor: currentTheme.cardBorder }]}>
                            <Text style={[styles.zenMetricLabel, { color: currentTheme.textDim }]}>{isEn ? 'ECO RATING' : 'SCOR ECO'}</Text>
                            <Text style={[styles.zenMetricVal, { color: '#00FF66' }]}>{Math.round(zenDriveScore * 0.95)}%</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
});

const StationNothingAnatomy = React.memo(function StationNothingAnatomy({
    virtualSensors,
    searchQuery = '',
    setSearchQuery,
    matchedDtc = [],
    currentTheme,
    appLang = 'RO'
}) {
    const isEn = appLang === 'EN';
    const categories = {
        'MOTOR & INJECȚIE': virtualSensors?.engine || [],
        'TURBO & ADMISIE': virtualSensors?.turbo || [],
        'TERMIC & RĂCIRE': virtualSensors?.thermal || [],
        'DPF & EMISII': virtualSensors?.emissions || [],
        'ELECTRIC & BATERIE': virtualSensors?.electrical || [],
        'ȘASIU & SIGURANȚĂ': virtualSensors?.safety || [],
    };

    return (
        <View style={styles.tabContent}>
            {/* DTC & Sensor Fast Search Box */}
            <View style={[styles.nothingSearchBox, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                <Text style={[styles.searchPrefix, { color: currentTheme.accent }]}>// FIND:</Text>
                <TextInput
                    style={[styles.nothingSearchInput, { color: currentTheme.textPrimary }]}
                    placeholder={isEn ? "Search DTC (P0234, 00550, MAF, DPF) or sensor..." : "Caută cod DTC (P0234, 00550, MAF, DPF) sau senzor..."}
                    placeholderTextColor={currentTheme.textDim}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ color: currentTheme.accent, fontFamily: MONO_FONT, fontWeight: '900' }}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Matched DTC Cards */}
            {safeArr(matchedDtc).length > 0 && (
                <View style={[styles.nothingDtcBox, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                    <Text style={[styles.nothingDtcTitle, { color: currentTheme.accent }]}>
                        {isEn ? '// DTC DATABASE MATCHES:' : '// REZULTATE BAZĂ DATE DTC:'}
                    </Text>
                    {matchedDtc.map(item => (
                        <View key={item.code} style={[styles.nothingDtcCard, { borderColor: currentTheme.cardBorder }]}>
                            <View style={styles.nothingDtcHead}>
                                <Text style={[styles.nothingDtcCode, { color: currentTheme.accent }]}>{item.code} / VAG {item.vagCode}</Text>
                                <Text style={[styles.nothingDtcSev, { color: item.severity === 'CRIT' ? currentTheme.accent : '#FFB800' }]}>{item.severity}</Text>
                            </View>
                            <Text style={[styles.nothingDtcCardTitle, { color: currentTheme.textPrimary }]}>{item.title}</Text>
                            <Text style={[styles.nothingDtcDesc, { color: currentTheme.textSecondary }]}>
                                <Text style={{ color: currentTheme.textDim }}>CAUZĂ: </Text>{item.cause}
                            </Text>
                            <Text style={[styles.nothingDtcDesc, { color: currentTheme.textSecondary }]}>
                                <Text style={{ color: currentTheme.textDim }}>SIMPTOM: </Text>{item.symptoms}
                            </Text>
                            <Text style={[styles.nothingDtcCost, { color: '#00FF66' }]}>
                                COST ESTIMAT: {item.costEst} · {item.action}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>
                // 02 · ANATOMIE VIRTUALĂ // 32 OBSERVATORI KALMAN & FIZICĂ
            </Text>
            {Object.entries(categories).map(([category, sensors]) => (
                <View key={category} style={[styles.nothingGroupCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                    <Text style={[styles.nothingGroupTitle, { color: currentTheme.textDim }]}>▶ {category}</Text>
                    {safeArr(sensors).map((s) => (
                        <View key={s.id} style={[styles.nothingSensorRow, { borderBottomColor: currentTheme.divider }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.nothingSensorLabel, { color: currentTheme.textPrimary }]}>{s.label}</Text>
                                <Text style={[styles.nothingSensorTarget, { color: currentTheme.textDim }]}>Țintă: {s.target}</Text>
                            </View>
                            <Text style={[styles.nothingSensorVal, { color: s.status === 'WARN' ? '#FFB800' : s.status === 'CRIT' ? currentTheme.accent : currentTheme.textPrimary }]}>
                                {s.val}
                            </Text>
                            <View style={[
                                styles.nothingStatusBadge,
                                { borderColor: s.status === 'WARN' ? '#FFB800' : s.status === 'CRIT' ? currentTheme.accent : '#00FF66' }
                            ]}>
                                <Text style={[
                                    styles.nothingStatusBadgeText,
                                    { color: s.status === 'WARN' ? '#FFB800' : s.status === 'CRIT' ? currentTheme.accent : '#00FF66' }
                                ]}>
                                    {s.status}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );
});

const StationNothingTrips = React.memo(function StationNothingTrips({
    isReplaying,
    currentReplaySample,
    replaySpeed,
    selectedTripId,
    tripsList,
    togglePlayPause,
    cycleReplaySpeed,
    seekReplay,
    exportTripPdf,
    exportItpDossier,
    setSelectedTripId,
    currentTheme
}) {
    return (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>
                // 03 · JURNAL CURSE & TELEMETRIE REPLAY
            </Text>

            {/* Replay Player Controls Box */}
            <View style={[styles.nothingGroupCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                <View style={styles.nothingReplayHeader}>
                    <Text style={[styles.nothingGroupTitle, { color: currentTheme.textPrimary }]}>
                        {isReplaying ? '▶ REDARE REPLAY ACTIVĂ' : '⏸ REPLAY ÎN PAUZĂ'}
                    </Text>
                    <Text style={[styles.nothingSensorVal, { color: currentTheme.accent }]}>
                        PAS: {safeNum(currentReplaySample?.progressPct, 0)}%
                    </Text>
                </View>

                {/* Scrubber Bar */}
                <View style={[styles.scrubberBg, { backgroundColor: currentTheme.cardBorder }]}>
                    <View style={[styles.scrubberFill, { width: `${currentReplaySample?.progressPct || 0}%`, backgroundColor: currentTheme.textPrimary }]} />
                </View>

                {/* Live Replay Metrics */}
                <View style={styles.replayMetricsRow}>
                    <View style={styles.replayMetricCol}>
                        <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>VITEZĂ</Text>
                        <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{currentReplaySample?.speed || 0} <Text style={styles.metricUnit}>KM/H</Text></Text>
                    </View>
                    <View style={styles.replayMetricCol}>
                        <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>TURAȚIE</Text>
                        <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{currentReplaySample?.rpm || 800} <Text style={styles.metricUnit}>RPM</Text></Text>
                    </View>
                    <View style={styles.replayMetricCol}>
                        <Text style={[styles.metricLabel, { color: currentTheme.textDim }]}>BOOST</Text>
                        <Text style={[styles.metricValue, { color: currentTheme.textPrimary }]}>{currentReplaySample?.boost || 0} <Text style={styles.metricUnit}>BAR</Text></Text>
                    </View>
                    <View style={styles.replayMetricCol}>
                        <Text style={[styles.metricLabel, { color: currentTheme.accent }]}>TREAPTĂ</Text>
                        <Text style={[styles.metricValue, { color: currentTheme.accent }]}>{currentReplaySample?.gear || 'N'}</Text>
                    </View>
                </View>

                {/* Player Action Buttons */}
                <View style={styles.replayActionsRow}>
                    <TouchableOpacity
                        style={[styles.replayBtn, { backgroundColor: currentTheme.textPrimary }]}
                        onPress={togglePlayPause}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.replayBtnText, { color: currentTheme.bg }]}>
                            {isReplaying ? '⏸ PAUZĂ' : '▶ REDARE'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.replayBtnOutlined, { borderColor: currentTheme.cardBorder }]}
                        onPress={cycleReplaySpeed}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.replayBtnText, { color: currentTheme.textPrimary }]}>
                            {replaySpeed}X VITEZĂ
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.replayBtnOutlined, { borderColor: currentTheme.cardBorder }]}
                        onPress={() => seekReplay(0)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.replayBtnText, { color: currentTheme.textPrimary }]}>
                            ⏮ RESET
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Export Buttons */}
                <View style={[styles.replayActionsRow, { marginTop: 8 }]}>
                    <TouchableOpacity
                        style={[styles.exportBtn, { borderColor: currentTheme.cardBorder }]}
                        onPress={() => exportTripPdf(selectedTripId)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.exportBtnText, { color: currentTheme.textPrimary }]}>
                            📄 PDF EXPORT
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.exportBtn, { borderColor: currentTheme.accent }]}
                        onPress={exportItpDossier}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.exportBtnText, { color: currentTheme.accent }]}>
                            📑 DOSAR ITP
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Lista de curse */}
            <Text style={[styles.subSectionTitle, { color: currentTheme.textDim }]}>CURSE SALVATE ÎN MEMORIE:</Text>
            {safeArr(tripsList).map((t) => {
                const isSelected = t.id === selectedTripId;
                return (
                    <TouchableOpacity
                        key={t.id}
                        style={[
                            styles.tripCard,
                            { backgroundColor: currentTheme.cardBg, borderColor: isSelected ? currentTheme.textPrimary : currentTheme.cardBorder }
                        ]}
                        onPress={() => {
                            hapticTap();
                            setSelectedTripId(t.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.8}
                    >
                        <View style={styles.tripCardHeader}>
                            <Text style={[styles.tripTitle, { color: currentTheme.textPrimary }]}>{t.title}</Text>
                            <Text style={[styles.tripDate, { color: currentTheme.textDim }]}>{t.date}</Text>
                        </View>
                        <View style={styles.tripCardStats}>
                            <Text style={[styles.tripStatText, { color: currentTheme.textSecondary }]}>{t.km} KM</Text>
                            <Text style={[styles.tripStatText, { color: currentTheme.textSecondary }]}>VMAX: {t.maxSpeed} KM/H</Text>
                            <Text style={[styles.tripStatText, { color: currentTheme.textSecondary }]}>{t.avgConsumption} L/100</Text>
                            <Text style={[styles.tripStatText, { color: '#00FF66' }]}>HEALTH: {t.healthScore}%</Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
});

const StationNothingService = React.memo(function StationNothingService({
    maintenanceItems,
    legalDocuments,
    markServiceItemCompleted,
    tireSize,
    setTireSize,
    vehicleMassKg,
    setVehicleMassKg,
    fuelPricePerLiter,
    setFuelPricePerLiter,
    currentTheme,
    appLang = 'RO'
}) {
    const isEn = appLang === 'EN';
    return (
        <View style={styles.tabContent}>
            {/* Rapid Vehicle & Tire Configurator */}
            <View style={[styles.nothingConfigCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                <Text style={[styles.nothingConfigTitle, { color: currentTheme.textPrimary }]}>
                    {isEn ? '// VEHICLE SPECS & TIRE CONFIGURATOR' : '// CONFIGURATOR RAPID ROȚI & PREȚ CARBURANT'}
                </Text>

                <Text style={[styles.nothingConfigLabel, { color: currentTheme.textDim }]}>
                    {isEn ? 'TIRE SIZE (ROLLING RADIUS):' : 'DIMENSIUNE ANVELOPE (RAZĂ RULARE):'}
                </Text>
                <View style={styles.nothingConfigRow}>
                    {['205/55 R16', '225/50 R17', '225/45 R18', '235/40 R19'].map(s => (
                        <TouchableOpacity
                            key={s}
                            style={[
                                styles.nothingConfigBtn,
                                { borderColor: currentTheme.cardBorder },
                                tireSize === s && { backgroundColor: currentTheme.textPrimary, borderColor: currentTheme.textPrimary }
                            ]}
                            onPress={() => { hapticTap(); setTireSize(s); }}
                        >
                            <Text style={[styles.nothingConfigBtnText, { color: tireSize === s ? currentTheme.bg : currentTheme.textDim }]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.nothingConfigLabel, { color: currentTheme.textDim }]}>
                    {isEn ? 'CURB WEIGHT (DYNO POWER):' : 'MASĂ VEHICUL (PENTRU ESTIMARE CP):'}
                </Text>
                <View style={styles.nothingConfigRow}>
                    {[1250, 1450, 1650, 1850].map(m => (
                        <TouchableOpacity
                            key={m}
                            style={[
                                styles.nothingConfigBtn,
                                { borderColor: currentTheme.cardBorder },
                                vehicleMassKg === m && { backgroundColor: currentTheme.textPrimary, borderColor: currentTheme.textPrimary }
                            ]}
                            onPress={() => { hapticTap(); setVehicleMassKg(m); }}
                        >
                            <Text style={[styles.nothingConfigBtnText, { color: vehicleMassKg === m ? currentTheme.bg : currentTheme.textDim }]}>{m} kg</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.nothingConfigLabel, { color: currentTheme.textDim }]}>
                    {isEn ? 'FUEL PRICE (RON/L):' : 'PREȚ COMBUSTIBIL (RON/L):'}
                </Text>
                <View style={styles.nothingConfigRow}>
                    {[7.10, 7.45, 7.80, 8.20].map(p => (
                        <TouchableOpacity
                            key={p}
                            style={[
                                styles.nothingConfigBtn,
                                { borderColor: currentTheme.cardBorder },
                                fuelPricePerLiter === p && { backgroundColor: currentTheme.textPrimary, borderColor: currentTheme.textPrimary }
                            ]}
                            onPress={() => { hapticTap(); setFuelPricePerLiter(p); }}
                        >
                            <Text style={[styles.nothingConfigBtnText, { color: fuelPricePerLiter === p ? currentTheme.bg : currentTheme.textDim }]}>{p.toFixed(2)}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ── Transfer Inovații F1 & 3D: Weibull Time-Machine Slider ── */}
            <WeibullTimeMachineCard
                variant="nothing"
                appLang={appLang}
                baseMaintenanceItems={maintenanceItems}
                telemetry={telemetry}
            />

            <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>
                // 04 · CONDITION-BASED MAINTENANCE & PORTOFEL ACTE
            </Text>

            {/* CBM Degradare Fizică */}
            <Text style={[styles.subSectionTitle, { color: currentTheme.textDim }]}>UZURĂ FIZICĂ (ARRHENIUS / ARCHARD):</Text>
            {safeArr(maintenanceItems).map((item) => (
                <View
                    key={item.id}
                    style={[styles.serviceCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}
                >
                    <View style={styles.serviceHeader}>
                        <Text style={[styles.serviceName, { color: currentTheme.textPrimary }]}>{item.name || item.title || item.id}</Text>
                        <Text style={[styles.serviceWear, { color: item.status === 'URGENT' ? currentTheme.accent : '#00FF66' }]}>
                            UZURĂ: {item.wearPct}%
                        </Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: currentTheme.cardBorder }]}>
                        <View
                            style={[
                                styles.progressBarFill,
                                {
                                    width: `${Math.min(100, item.wearPct)}%`,
                                    backgroundColor: item.status === 'URGENT' ? currentTheme.accent : currentTheme.textPrimary
                                }
                            ]}
                        />
                    </View>
                    <View style={styles.serviceFooter}>
                        <Text style={[styles.serviceKmRemaining, { color: currentTheme.textSecondary }]}>
                            Rămas: {item.remainingKm ?? (item.maxKm ? Math.max(0, item.maxKm - item.currentKm) : 3400)} km din {item.totalKm ?? item.maxKm ?? 15000} km
                        </Text>
                        <TouchableOpacity
                            style={[styles.resetServiceBtn, { borderColor: currentTheme.cardBorder }]}
                            onPress={() => markServiceItemCompleted(item.id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.resetServiceBtnText, { color: currentTheme.textPrimary }]}>
                                [ ✓ RESET REVIZIE ]
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}

            {/* Portofel Acte Legale */}
            <Text style={[styles.subSectionTitle, { color: currentTheme.textDim, marginTop: 16 }]}>PORTOFEL ACTE & VALABILITĂȚI:</Text>
            {safeArr(legalDocuments).map((doc) => (
                <View
                    key={doc.id}
                    style={[styles.docCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}
                >
                    <View style={styles.docHeader}>
                        <Text style={[styles.docName, { color: currentTheme.textPrimary }]}>{doc.name}</Text>
                        <View style={[
                            styles.docBadge,
                            { borderColor: doc.status === 'VALABIL' ? '#00FF66' : currentTheme.accent }
                        ]}>
                            <Text style={[
                                styles.docBadgeText,
                                { color: doc.status === 'VALABIL' ? '#00FF66' : currentTheme.accent }
                            ]}>
                                {doc.status}
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.docIssuer, { color: currentTheme.textDim }]}>Emitent: {doc.issuer}</Text>
                    <View style={styles.docFooter}>
                        <Text style={[styles.docExpiry, { color: currentTheme.textSecondary }]}>Expiră la: {doc.expiryDate}</Text>
                        <Text style={[styles.docDays, { color: doc.daysLeft < 45 ? currentTheme.accent : currentTheme.textPrimary }]}>
                            {doc.daysLeft} ZILE RĂMASE
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
});

const StationNothingSentry = React.memo(function StationNothingSentry({
    sentryArmed,
    setSentryArmed,
    triggerShockSimulation,
    sentryEvents,
    carGpsCoords,
    openWalkingDirections,
    parkingMinutesRemaining,
    addParkingTime,
    valetActive,
    toggleValetMode,
    triggerEcallTest,
    currentTheme
}) {
    return (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>
                // 05 · SENTRY GUARD, PARCARE & MOBILITATE
            </Text>

            {/* Sentry Guard */}
            <View style={[styles.nothingGroupCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                <View style={styles.sentryHeader}>
                    <View>
                        <Text style={[styles.nothingGroupTitle, { color: currentTheme.textPrimary }]}>SENTRY GUARD // SENTINELĂ</Text>
                        <Text style={[styles.sentryStatusSub, { color: sentryArmed ? '#00FF66' : currentTheme.accent }]}>
                            {sentryArmed ? '● ARMATĂ // SUPRAVEGHERE ACTIVĂ' : '○ DEZARMATĂ'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.sentryToggleBtn,
                            { backgroundColor: sentryArmed ? currentTheme.textPrimary : currentTheme.cardBg, borderColor: currentTheme.cardBorder }
                        ]}
                        onPress={() => {
                            hapticTap();
                            setSentryArmed(!sentryArmed);
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.sentryToggleText, { color: sentryArmed ? currentTheme.bg : currentTheme.textPrimary }]}>
                            {sentryArmed ? 'DEZARMEAZĂ' : 'ARMEAZĂ'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.shockSimBtn, { borderColor: currentTheme.accent }]}
                    onPress={triggerShockSimulation}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.shockSimText, { color: currentTheme.accent }]}>
                        ⚡ TEST SENZOR ȘOC / ÎNCLINARE
                    </Text>
                </TouchableOpacity>

                <Text style={[styles.sentryLogTitle, { color: currentTheme.textDim }]}>JURNAL EVENIMENTE SENTINELĂ:</Text>
                {safeArr(sentryEvents).map((ev) => (
                    <View key={ev.id} style={styles.sentryLogRow}>
                        <Text style={[styles.sentryLogTime, { color: currentTheme.textDim }]}>[{ev.time}]</Text>
                        <Text style={[styles.sentryLogDesc, { color: ev.severity === 'crit' ? currentTheme.accent : currentTheme.textPrimary }]}>
                            {ev.type} — {ev.desc}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Parcare & GPS Walking */}
            <View style={[styles.nothingGroupCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder, marginTop: 12 }]}>
                <Text style={[styles.nothingGroupTitle, { color: currentTheme.textPrimary }]}>GĂSEȘTE-MI MAȘINA & CRONOMETRU PARCARE</Text>
                <Text style={[styles.gpsCoordsText, { color: currentTheme.textSecondary }]}>
                    Coordonate GPS: {safeFmt(carGpsCoords?.lat, 4, '44.4323')}°N, {safeFmt(carGpsCoords?.lng ?? carGpsCoords?.lon, 4, '26.1063')}°E
                </Text>
                <TouchableOpacity
                    style={[styles.mapsBtn, { borderColor: currentTheme.cardBorder }]}
                    onPress={openWalkingDirections}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.mapsBtnText, { color: currentTheme.textPrimary }]}>
                        🧭 NAVIGHEAZĂ PIETONAL LA MAȘINĂ (MAPS)
                    </Text>
                </TouchableOpacity>

                <View style={[styles.parkingTimerFrame, { borderTopColor: currentTheme.divider }]}>
                    <Text style={[styles.parkingLabel, { color: currentTheme.textDim }]}>EXPIRARE TICHET PARCARE:</Text>
                    <Text style={[styles.parkingMinutes, { color: currentTheme.accent }]}>
                        {parkingMinutesRemaining} MINUTE RĂMASE
                    </Text>
                    <View style={styles.parkingBtnRow}>
                        {[15, 30, 60].map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[styles.addTimeBtn, { borderColor: currentTheme.cardBorder }]}
                                onPress={() => addParkingTime(mins)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.addTimeText, { color: currentTheme.textPrimary }]}>+{mins}m</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Mod Valet & eCall SOS */}
            <View style={[styles.nothingGroupCard, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder, marginTop: 12 }]}>
                <View style={styles.sentryHeader}>
                    <View>
                        <Text style={[styles.nothingGroupTitle, { color: currentTheme.textPrimary }]}>MOD VALET (LIMITATOR 70 KM/H)</Text>
                        <Text style={[styles.sentryStatusSub, { color: valetActive ? currentTheme.accent : currentTheme.textDim }]}>
                            {valetActive ? 'ACTIVAT // LIMITARE VITEZĂ & RAZĂ' : 'DEZACTIVAT'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.sentryToggleBtn, { borderColor: currentTheme.cardBorder }]}
                        onPress={toggleValetMode}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.sentryToggleText, { color: currentTheme.textPrimary }]}>
                            {valetActive ? 'OPREȘTE' : 'PORNEȘTE'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.ecallBtn, { borderColor: '#FF2A2A', backgroundColor: '#FF2A2A1A' }]}
                    onPress={triggerEcallTest}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                >
                    <Text style={styles.ecallBtnText}>📡 TEST SIMULARE eCALL SOS (112 AUTOMAT)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

const StationNothingAi = React.memo(function StationNothingAi({
    aiMessages,
    isAiLoading,
    sendAiPrompt,
    currentTheme
}) {
    const [localInput, setLocalInput] = useState('');

    const handleSubmit = useCallback(() => {
        if (localInput.trim()) {
            sendAiPrompt(localInput);
            setLocalInput('');
        }
    }, [localInput, sendAiPrompt]);

    return (
        <View style={styles.tabContent}>
            <Text style={[styles.sectionHeader, { color: currentTheme.textDim }]}>
                // 06 · INGINER MECANIC AI // TERMINAL TELEX NOTHING OS
            </Text>

            {/* Quick Prompt Chips */}
            <View style={styles.aiChipsRow}>
                {[
                    '? STARE TURBO',
                    '? CONSUM OPTIM',
                    '? DIAGNOZĂ UZURĂ',
                    '? EXPLICĂ ALERTE',
                ].map((chip) => (
                    <TouchableOpacity
                        key={chip}
                        style={[styles.aiChipBtn, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg }]}
                        onPress={() => sendAiPrompt(chip)}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.aiChipText, { color: currentTheme.textPrimary }]}>{chip}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Message Transcript */}
            <View style={[styles.telexTerminalBox, { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.cardBorder }]}>
                <View style={styles.telexHeader}>
                    <View style={[styles.telexStatusDot, { backgroundColor: isAiLoading ? currentTheme.accent : '#00FF66' }]} />
                    <Text style={[styles.telexTitle, { color: currentTheme.textPrimary }]}>
                        BOSCH ME9 & KALMAN AI EXPERT {isAiLoading ? '· ANALIZEAZĂ...' : '· GATA'}
                    </Text>
                </View>

                {safeArr(aiMessages).map((msg) => (
                    <View key={msg.id} style={styles.telexMsgRow}>
                        <Text style={[styles.telexSender, { color: msg.sender === 'ai' ? currentTheme.accent : currentTheme.textDim }]}>
                            {msg.sender === 'ai' ? '▶ AI INGINER:' : '▶ TFL MASTER:'}
                        </Text>
                        <Text style={[styles.telexMsgText, { color: currentTheme.textPrimary }]}>
                            {msg.text}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Input Row */}
            <View style={[styles.aiInputRow, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg }]}>
                <TextInput
                    style={[styles.aiTextInput, { color: currentTheme.textPrimary }]}
                    placeholder="Tastează întrebare mecanică..."
                    placeholderTextColor={currentTheme.textDim}
                    value={localInput}
                    onChangeText={setLocalInput}
                    onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                    style={[styles.aiSendBtn, { backgroundColor: currentTheme.textPrimary }]}
                    onPress={handleSubmit}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.aiSendBtnText, { color: currentTheme.bg }]}>TRIMITE</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function MinimalNothingParadigm() {
    const insets = useSafeInsets();

    // Stări locale pentru modurile Nothing (01: PULS, 02: ANAT sunt live)
    const [activeTab, setActiveTab] = useState('01'); // '01'|'02'|'03'|'04'|'05'|'06'
    const isLiveViewActive = activeTab === '01' || activeTab === '02';
    const core = useParadigmCoreData(isLiveViewActive);
    const telemetry = core.telemetry;
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal, appLang, toggleAppLang } = useUiParadigm();
    const isEn = appLang === 'EN';

    const [ghostMode, setGhostMode] = useState(false);
    const [mirrorHud, setMirrorHud] = useState(false);
    const [expandedAlerts, setExpandedAlerts] = useState(false);
    const [invertedEPaper, setInvertedEPaper] = useState(false); // 2. High-Contrast Inverted E-Paper Mode
    const [nothingAccentKey, setNothingAccentKey] = useState('RED'); // 'RED' | 'MONO' | 'ACID'

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
    const prevSpeedRef = useRef(safeNum(telemetry?.speed, 0));
    const steadyCounterRef = useRef(0);

    const safeSpeed = safeNum(telemetry?.speed, 0);
    const safeAlertsCount = safeArr(telemetry?.criticalAlerts).length;

    useEffect(() => {
        const speedDelta = Math.abs(safeSpeed - prevSpeedRef.current);
        prevSpeedRef.current = safeSpeed;

        if (safeSpeed > 55 && speedDelta < 1.0 && safeAlertsCount === 0) {
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
    }, [safeSpeed, safeAlertsCount]);

    // ─── 9. Tactile Haptic Metronome for Speed Limit Thresholds ────────────────
    const lastMetronomeRef = useRef(0);
    useEffect(() => {
        if (safeSpeed > 130) {
            const now = Date.now();
            if (now - lastMetronomeRef.current > 4000) {
                lastMetronomeRef.current = now;
                hapticTap();
            }
        }
    }, [safeSpeed]);

    // Animație pentru Red Pill Alert
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (safeAlertsCount > 0) {
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
    }, [safeAlertsCount]);

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
                const tabs = ['01', '02', '03', '04', '05', '06'];
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
        const sFuel = safeNum(fuelLevel, 0);
        const filled = Math.round((sFuel / 100) * total);
        return Array.from({ length: total }, (_, i) => i < filled);
    }, [fuelLevel]);

    const isGhostDimmed = (ghostMode || cruiseStandby) && safeArr(criticalAlerts).length === 0;

    // Dinamic Theme mapping for E-Paper vs OLED True Black & Sub-Accents
    const currentTheme = useMemo(() => {
        const accent = nothingAccentKey === 'RED' ? '#D71920' : nothingAccentKey === 'ACID' ? '#D4E725' : '#FFFFFF';
        if (invertedEPaper) {
            return {
                bg: '#FFFFFF',
                cardBg: '#F2F2F2',
                cardBorder: '#E0E0E0',
                textPrimary: '#000000',
                textSecondary: '#555555',
                textDim: '#888888',
                accent,
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
            accent,
            barActive: '#FFFFFF',
            barInactive: '#1E1E1E',
            divider: '#161616',
        };
    }, [invertedEPaper, nothingAccentKey]);

    const safeTop = typeof insets?.top === 'number' && !isNaN(insets.top) ? Math.max(insets.top, 24) : 24;
    const safeBottom = typeof insets?.bottom === 'number' && !isNaN(insets.bottom) ? Math.max(insets.bottom, 12) : 12;

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: currentTheme.bg, paddingTop: safeTop, paddingBottom: safeBottom },
            ]}
        >
            <StatusBar
                barStyle={invertedEPaper ? 'dark-content' : 'light-content'}
                backgroundColor={currentTheme.bg}
                translucent
            />

            {/* ── 1. GLYPH INTERFACE MATRIX (7 Segmente Telegraphic) ── */}
            <View style={[styles.glyphMatrixContainer, { backgroundColor: currentTheme.bg, zIndex: 2 }]}>
                {safeArr(glyphLeds).map((active, idx) => (
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
            <View style={[styles.topBar, { borderBottomColor: currentTheme.divider, zIndex: 2 }]}>
                <View style={styles.brandRow}>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00FF66' : '#FF3B00' }]} />
                    <Text style={[styles.brandText, { color: currentTheme.textPrimary }]} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'CALM TECH'}
                    </Text>
                </View>

                {/* Butoane de acțiune cu comutator RO / EN */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg, minWidth: 42 }]}
                        onPress={() => {
                            hapticTap();
                            toggleAppLang();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.textPrimary, fontWeight: '800' }]} numberOfLines={1}>{appLang === 'RU' ? '🇷🇺 RU' : isEn ? '🇬🇧 EN' : '🇷🇴 RO'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.stylePickerButton, { backgroundColor: currentTheme.textPrimary }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.stylePickerText, { color: currentTheme.bg }]}>🎨 {isEn ? 'STYLE' : 'STIL'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: '#00F0FF', backgroundColor: '#00F0FF12' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: '#00F0FF' }]}>🎮</Text>
                    </TouchableOpacity>

                    {/* Bilanț Cursă Rapid (Receipt) */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: currentTheme.accent, backgroundColor: `${currentTheme.accent}18` }]}
                        onPress={() => {
                            hapticTap();
                            core.openTripDebrief();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.accent }]}>🧾</Text>
                    </TouchableOpacity>

                    {/* Inverted E-Paper Daylight Toggle */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: currentTheme.cardBorder, backgroundColor: currentTheme.cardBg }]}
                        onPress={() => {
                            hapticTap();
                            setInvertedEPaper(!invertedEPaper);
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.textPrimary }]}>
                            {invertedEPaper ? '🌙' : '☀️'}
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
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: mirrorHud ? currentTheme.bg : currentTheme.textSecondary }]}>
                            🪞
                        </Text>
                    </TouchableOpacity>

                    {/* Sub-Accent Switcher (RED / ACID / MONO) */}
                    <TouchableOpacity
                        style={[
                            styles.v2Button,
                            { borderColor: currentTheme.accent, backgroundColor: `${currentTheme.accent}15` }
                        ]}
                        onPress={() => {
                            hapticTap();
                            setNothingAccentKey(prev => prev === 'RED' ? 'ACID' : prev === 'ACID' ? 'MONO' : 'RED');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: currentTheme.accent }]}>
                            {nothingAccentKey === 'RED' ? '🔴' : nothingAccentKey === 'ACID' ? '🟢' : '⚪'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Corpul Central (cu Ghost Mode Dimming & Sub-Rendering) ── */}
            <ScrollView
                style={[
                    styles.mainScroll,
                    isGhostDimmed && styles.ghostDimmed,
                    mirrorHud && styles.mirrorHudTrapezoid,
                ]}
                contentContainerStyle={styles.mainScrollContent}
                showsVerticalScrollIndicator={false}
                {...panResponder.panHandlers}
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
                                <Text style={styles.alertCount}>{safeArr(criticalAlerts).length} ALERTE</Text>
                            </View>
                            {safeArr(criticalAlerts).map((alt, idx) => (
                                <View key={alt?.id || idx} style={styles.alertItemRow}>
                                    <Text style={styles.alertMsg}>▶ {alt?.title || 'ALERTĂ'}</Text>
                                    {expandedAlerts && <Text style={styles.alertDesc}>{alt?.desc || ''}</Text>}
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
                            {safeNum(fuelLevel, 0)}% · {safeNum(fuelRate, 0)} L/100KM
                        </Text>
                    </View>
                    <View style={styles.fuelDotsRow}>
                        {safeArr(fuelDots).map((isFilled, idx) => (
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

                {/* 4. CONȚINUT DINAMIC BAZAT PE CELE 6 STAȚII JOG-WHEEL */}

                {/* ── 01 · PULS VITAL & DINAMICĂ ── */}
                {activeTab === '01' && (
                    <StationNothingPulse
                        telemetry={telemetry}
                        tp7Anomalies={core.tp7Anomalies}
                        zenDriveScore={core.zenDriveScore}
                        currentTheme={currentTheme}
                        appLang={appLang}
                        dynoData={core.dynoData}
                        dragBox={core.dragBox}
                        sankeyData={core.sankeyData}
                        brakePyrometer={core.brakePyrometer}
                    />
                )}

                {/* ── 02 · ANATOMIE VIRTUALĂ (32 SENZORI X-RAY) ── */}
                {activeTab === '02' && (
                    <StationNothingAnatomy
                        virtualSensors={core.virtualSensors}
                        searchQuery={core.searchQuery}
                        setSearchQuery={core.setSearchQuery}
                        matchedDtc={core.matchedDtc}
                        currentTheme={currentTheme}
                        appLang={appLang}
                    />
                )}

                {/* ── 03 · JURNAL CURSE & REPLAY MINIMALIST ── */}
                {activeTab === '03' && (
                    <StationNothingTrips
                        isReplaying={core.isReplaying}
                        currentReplaySample={core.currentReplaySample}
                        replaySpeed={core.replaySpeed}
                        selectedTripId={core.selectedTripId}
                        tripsList={core.tripsList}
                        togglePlayPause={core.togglePlayPause}
                        cycleReplaySpeed={core.cycleReplaySpeed}
                        seekReplay={core.seekReplay}
                        exportTripPdf={core.exportTripPdf}
                        exportItpDossier={core.exportItpDossier}
                        setSelectedTripId={core.setSelectedTripId}
                        currentTheme={currentTheme}
                    />
                )}

                {/* ── 04 · SERVICE & ACTE (MENTENANȚĂ CBM & PORTOFEL) ── */}
                {activeTab === '04' && (
                    <StationNothingService
                        maintenanceItems={core.maintenanceItems}
                        legalDocuments={core.legalDocuments}
                        markServiceItemCompleted={core.markServiceItemCompleted}
                        tireSize={core.tireSize}
                        setTireSize={core.setTireSize}
                        vehicleMassKg={core.vehicleMassKg}
                        setVehicleMassKg={core.setVehicleMassKg}
                        fuelPricePerLiter={core.fuelPricePerLiter}
                        setFuelPricePerLiter={core.setFuelPricePerLiter}
                        currentTheme={currentTheme}
                        appLang={appLang}
                    />
                )}

                {/* ── 05 · SENTRY & GPS (SMART MOBILITY & SECURITATE) ── */}
                {activeTab === '05' && (
                    <StationNothingSentry
                        sentryArmed={core.sentryArmed}
                        setSentryArmed={core.setSentryArmed}
                        triggerShockSimulation={core.triggerShockSimulation}
                        sentryEvents={core.sentryEvents}
                        carGpsCoords={core.carGpsCoords}
                        openWalkingDirections={core.openWalkingDirections}
                        parkingMinutesRemaining={core.parkingMinutesRemaining}
                        addParkingTime={core.addParkingTime}
                        valetActive={core.valetActive}
                        toggleValetMode={core.toggleValetMode}
                        triggerEcallTest={core.triggerEcallTest}
                        currentTheme={currentTheme}
                    />
                )}

                {/* ── 06 · AI TELEX (INGINER MECANIC TERMINAL NOTHING OS) ── */}
                {activeTab === '06' && (
                    <StationNothingAi
                        aiMessages={core.aiMessages}
                        isAiLoading={core.isAiLoading}
                        sendAiPrompt={core.sendAiPrompt}
                        currentTheme={currentTheme}
                    />
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Jog-Wheel Selector Inferior (01 .. 06) ── */}
            <View style={[styles.jogWheelContainer, { borderTopColor: currentTheme.divider, backgroundColor: currentTheme.bg, zIndex: 2 }]}>
                {[
                    { id: '01', label: isEn ? '01·PULSE' : '01·PULS' },
                    { id: '02', label: isEn ? '02·ANAT' : '02·ANAT' },
                    { id: '03', label: isEn ? '03·TRIPS' : '03·JURN' },
                    { id: '04', label: isEn ? '04·SERV' : '04·SERV' },
                    { id: '05', label: isEn ? '05·SENT' : '05·SENT' },
                    { id: '06', label: isEn ? '06·AI' : '06·AI' },
                ].map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.jogTab,
                                isActive && { backgroundColor: currentTheme.textPrimary },
                            ]}
                            onPress={() => {
                                hapticTap();
                                setActiveTab(item.id);
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                            activeOpacity={0.7}
                        >
                            {isActive && (
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FF3B00', marginBottom: 2 }} />
                            )}
                            <Text style={[styles.jogTabText, { color: isActive ? currentTheme.bg : currentTheme.textDim, fontWeight: isActive ? '900' : '600' }]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── MODAL POST-CURSĂ AUTOMAT // RECEIPT · NOT-01 ── */}
            <Modal
                visible={core.showDebriefModal}
                transparent
                animationType="fade"
                onRequestClose={core.closeTripDebrief}
            >
                <View style={styles.nothingReceiptBackdrop}>
                    <View style={[styles.nothingReceiptPaper, { backgroundColor: currentTheme.bg, borderColor: currentTheme.textPrimary }]}>
                        <Text style={[styles.receiptHead, { color: currentTheme.textDim }]}>////////////////////////////////////////</Text>
                        <Text style={[styles.receiptBrand, { color: currentTheme.accent }]}>RECEIPT // TRIP DEBRIEF · NOT-01</Text>
                        <Text style={[styles.receiptSub, { color: currentTheme.textDim }]}>NOTHING (R) TELEMETRY OS // KERNEL 3.2</Text>
                        <Text style={[styles.receiptHead, { color: currentTheme.textDim }]}>----------------------------------------</Text>

                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>DISTANȚĂ PARCURSĂ</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.km} KM</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>DURATĂ CURSĂ</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.duration}</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>VITEZĂ MAXIMĂ</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.maxSpeed} KM/H</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>CONSUM ESTIMAT</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.fuelBurnedLiters} L ({core.lastTripDebrief?.avgConsumption} L/100)</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>COST TOTAL COMBUSTIBIL</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.accent }]}>{core.lastTripDebrief?.fuelCostRon} RON</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>SCOR EFICIENȚĂ ZEN</Text>
                            <Text style={[styles.receiptVal, { color: '#00FF66' }]}>{core.lastTripDebrief?.healthScore}%</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>ENERGIE DISIPATĂ FRÂNE</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.brakeEnergyMj} MJ</Text>
                        </View>
                        <View style={styles.receiptRow}>
                            <Text style={[styles.receiptLabel, { color: currentTheme.textDim }]}>STRES ULEI ARRHENIUS</Text>
                            <Text style={[styles.receiptVal, { color: currentTheme.textPrimary }]}>{core.lastTripDebrief?.oilStressFactor}x</Text>
                        </View>

                        <Text style={[styles.receiptHead, { color: currentTheme.textDim }]}>----------------------------------------</Text>
                        <TouchableOpacity
                            style={[styles.receiptCloseBtn, { borderColor: currentTheme.textPrimary }]}
                            onPress={() => {
                                hapticTap();
                                core.closeTripDebrief();
                            }}
                        >
                            <Text style={[styles.receiptCloseText, { color: currentTheme.textPrimary }]}>[ ✕ DISMISS DEBRIEF ]</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({

    nothingSubSwitchRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    nothingSubSwitchBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nothingSubSwitchText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    tp7Frame: {
        borderWidth: 1,
        borderRadius: 4,
        padding: 12,
        marginBottom: 12,
    },
    tp7TopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    tp7RecIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tp7Led: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    tp7RecText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
    },
    tp7Counter: {
        fontFamily: MONO_FONT,
        fontSize: 14,
        fontWeight: '900',
    },
    tp7ReelsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    tp7AnomHeader: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        marginTop: 10,
        marginBottom: 6,
    },
    tp7AnomGrid: {
        flexDirection: 'row',
        gap: 6,
    },
    tp7AnomCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 3,
        padding: 6,
    },
    tp7PinTag: {
        width: 4,
        height: 20,
        borderRadius: 2,
    },
    tp7PinLabel: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    tp7PinTime: {
        fontFamily: MONO_FONT,
        fontSize: 7,
    },
    zenFrame: {
        borderWidth: 1,
        borderRadius: 4,
        padding: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    zenHeader: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        marginBottom: 10,
    },
    zenScoreBox: {
        position: 'relative',
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zenScoreCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zenScoreNum: {
        fontFamily: MONO_FONT,
        fontSize: 32,
        fontWeight: '900',
    },
    zenScorePct: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    zenVerdict: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
        marginTop: 10,
        textAlign: 'center',
    },
    zenMetricsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 12,
        width: '100%',
    },
    zenMetricCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 3,
        padding: 6,
        alignItems: 'center',
    },
    zenMetricLabel: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        marginBottom: 2,
    },
    zenMetricVal: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '900',
    },
    nothingSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    searchPrefix: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
        marginRight: 6,
    },
    nothingSearchInput: {
        flex: 1,
        fontFamily: MONO_FONT,
        fontSize: 9,
        paddingVertical: 6,
    },
    nothingDtcBox: {
        borderWidth: 1,
        borderRadius: 4,
        padding: 8,
        marginBottom: 10,
    },
    nothingDtcTitle: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '900',
        marginBottom: 4,
    },
    nothingDtcCard: {
        borderWidth: 1,
        borderRadius: 3,
        padding: 6,
        marginBottom: 6,
    },
    nothingDtcHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    nothingDtcCode: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
    },
    nothingDtcSev: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        fontWeight: '900',
    },
    nothingDtcCardTitle: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    nothingDtcDesc: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        marginTop: 2,
    },
    nothingDtcCost: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        fontWeight: '800',
        marginTop: 2,
    },
    nothingConfigCard: {
        borderWidth: 1,
        borderRadius: 4,
        padding: 8,
        marginBottom: 12,
    },
    nothingConfigTitle: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
        marginBottom: 6,
    },
    nothingConfigLabel: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        marginTop: 4,
        marginBottom: 2,
    },
    nothingConfigRow: {
        flexDirection: 'row',
        gap: 4,
        flexWrap: 'wrap',
    },
    nothingConfigBtn: {
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 3,
    },
    nothingConfigBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    nothingReceiptBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    nothingReceiptPaper: {
        width: '100%',
        maxWidth: 360,
        borderWidth: 2,
        borderRadius: 6,
        padding: 14,
    },
    receiptHead: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        textAlign: 'center',
    },
    receiptBrand: {
        fontFamily: MONO_FONT,
        fontSize: 11,
        fontWeight: '900',
        textAlign: 'center',
        marginTop: 2,
    },
    receiptSub: {
        fontFamily: MONO_FONT,
        fontSize: 7,
        textAlign: 'center',
        marginBottom: 4,
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
    },
    receiptLabel: {
        fontFamily: MONO_FONT,
        fontSize: 8,
    },
    receiptVal: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '900',
    },
    receiptCloseBtn: {
        borderWidth: 1,
        borderRadius: 4,
        paddingVertical: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    receiptCloseText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '900',
    },

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
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
        flexShrink: 1,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
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
        gap: 4,
        flexShrink: 0,
    },
    v2Button: {
        paddingHorizontal: 6,
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
        opacity: 0.40,
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
    nothingGroupCard: {
        padding: 12,
        borderRadius: 4,
        borderWidth: 1,
        marginBottom: 10,
    },
    nothingGroupTitle: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 8,
    },
    nothingSensorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
    },
    nothingSensorLabel: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '600',
    },
    nothingSensorTarget: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        marginTop: 2,
    },
    nothingSensorVal: {
        fontFamily: MONO_FONT,
        fontSize: 11,
        fontWeight: '800',
        marginRight: 8,
        fontVariant: ['tabular-nums'],
    },
    nothingStatusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: 1,
    },
    nothingStatusBadgeText: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    nothingReplayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    scrubberBg: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        marginBottom: 12,
        overflow: 'hidden',
    },
    scrubberFill: {
        height: '100%',
        borderRadius: 3,
    },
    replayMetricsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    replayMetricCol: {
        alignItems: 'center',
    },
    replayActionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    replayBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 4,
        alignItems: 'center',
    },
    replayBtnOutlined: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
    },
    replayBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '800',
    },
    exportBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
    },
    exportBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '800',
    },
    subSectionTitle: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    tripCard: {
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        marginBottom: 8,
    },
    tripCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tripTitle: {
        fontFamily: MONO_FONT,
        fontSize: 11,
        fontWeight: '700',
    },
    tripDate: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    tripCardStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    tripStatText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '600',
    },
    serviceCard: {
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        marginBottom: 8,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    serviceName: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '700',
        flex: 1,
    },
    serviceWear: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    progressBarBg: {
        height: 4,
        borderRadius: 2,
        width: '100%',
        marginBottom: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    serviceFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceKmRemaining: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    resetServiceBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 1,
    },
    resetServiceBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    docCard: {
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        marginBottom: 8,
    },
    docHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    docName: {
        fontFamily: MONO_FONT,
        fontSize: 11,
        fontWeight: '700',
    },
    docBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: 1,
    },
    docBadgeText: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '800',
    },
    docIssuer: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        marginBottom: 4,
    },
    docFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    docExpiry: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    docDays: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    sentryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sentryStatusSub: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
        marginTop: 2,
    },
    sentryToggleBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 4,
        borderWidth: 1,
    },
    sentryToggleText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    shockSimBtn: {
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 10,
    },
    shockSimText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '800',
    },
    sentryLogTitle: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 4,
    },
    sentryLogRow: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    sentryLogTime: {
        fontFamily: MONO_FONT,
        fontSize: 9,
    },
    sentryLogDesc: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        flex: 1,
    },
    gpsCoordsText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        marginBottom: 8,
    },
    mapsBtn: {
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 10,
    },
    mapsBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    parkingTimerFrame: {
        borderTopWidth: 1,
        paddingTop: 8,
    },
    parkingLabel: {
        fontFamily: MONO_FONT,
        fontSize: 8,
        letterSpacing: 1,
    },
    parkingMinutes: {
        fontFamily: MONO_FONT,
        fontSize: 14,
        fontWeight: '900',
        marginVertical: 4,
    },
    parkingBtnRow: {
        flexDirection: 'row',
        gap: 8,
    },
    addTimeBtn: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 1,
    },
    addTimeText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
    },
    ecallBtn: {
        paddingVertical: 8,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: 'center',
        marginTop: 10,
    },
    ecallBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
        color: '#FF2A2A',
    },
    aiChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    aiChipBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 1,
    },
    aiChipText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
    },
    telexTerminalBox: {
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        minHeight: 120,
        marginBottom: 10,
    },
    telexHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    telexStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    telexTitle: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    telexMsgRow: {
        marginVertical: 4,
    },
    telexSender: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    telexMsgText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        lineHeight: 14,
        marginTop: 2,
    },
    aiInputRow: {
        flexDirection: 'row',
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignItems: 'center',
    },
    aiTextInput: {
        flex: 1,
        fontFamily: MONO_FONT,
        fontSize: 10,
        paddingVertical: 4,
    },
    aiSendBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 3,
    },
    aiSendBtnText: {
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: '800',
    },
    jogWheelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    jogTab: {
        paddingHorizontal: 6,
        paddingVertical: 5,
        borderRadius: 4,
    },
    jogTabText: {
        fontFamily: MONO_FONT,
        fontSize: 10,
        fontWeight: '700',
    },
});
