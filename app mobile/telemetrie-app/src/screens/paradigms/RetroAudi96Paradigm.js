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
} from 'react-native';
import { useSafeInsets } from '../../hooks/useSafeInsets';
import Svg, { Rect, Path, Circle, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert } from '../../services/hapticFeedback';
import { audioGong } from '../../services/audioGongService';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETRO_FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.RETRO_AUDI_96];

// ─── 8. Stepped Tachometer Bitmask Vector Optimization (Single Path SVG) ────
function AudiTachometerBargraph({ rpm = 800, maxRpm = 6500, width = SCREEN_WIDTH - 40, brightness = 1.0, phosphorTrailRpm = 800 }) {
    const totalBlocks = 25;
    const clampedRpm = Math.min(Math.max(rpm, 0), maxRpm);
    const activeBlocksCount = Math.round((clampedRpm / maxRpm) * totalBlocks);
    const trailBlocksCount = Math.round((Math.min(Math.max(phosphorTrailRpm, 0), maxRpm) / maxRpm) * totalBlocks);

    const blockWidth = Math.max((width - 60) / totalBlocks, 6);
    const blockGap = 2.5;

    // Build unified path strings using bitwise index iteration (Zero DOM reconciliation overhead)
    let activePathD = '';
    let trailPathD = '';
    let inactivePathD = '';

    for (let i = 0; i < totalBlocks; i++) {
        const x = i * (blockWidth + blockGap) + 10;
        const blockHeight = 12 + Math.floor((i / totalBlocks) * 16);
        const y = 34 - blockHeight;
        const rectD = `M ${x} ${y} h ${blockWidth} v ${blockHeight} h -${blockWidth} Z `;

        if (i < activeBlocksCount) {
            activePathD += rectD;
        } else if (i < trailBlocksCount) {
            trailPathD += rectD; // 1. Phosphor Decay Trail
        } else {
            inactivePathD += rectD;
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
}

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
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stări locale
    const [bcModeIndex, setBcModeIndex] = useState(0);
    const [dimmerLevel, setDimmerLevel] = useState(1.0); // 1.0 = zi / 0.6 = noapte
    const [tripKmOffset, setTripKmOffset] = useState(247.4);
    const [autocheckState, setAutocheckState] = useState('OK'); // 'BREMSE' -> 'OELDRUCK' -> 'OK'
    const [showVagTester, setShowVagTester] = useState(false); // 9. VAG 1551/1552 Heritage Scanner
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

    // ─── 5. Planckian Color Temperature Shift (Tag / Nacht Rheostat) ──────────
    const clusterAccentColor = dimmerLevel === 1.0 ? '#FF6600' : '#CC3300';
    const clusterDimColor = dimmerLevel === 1.0 ? '#882200' : '#551100';

    return (
        <View style={[
            styles.container,
            { paddingTop: Math.max(insets.top, 24) },
            { transform: [{ translateY: idleJitterY }] }, // 2. 5-Cylinder Micro-Jitter
        ]}>
            <StatusBar barStyle="light-content" backgroundColor="#050200" translucent />

            {/* ── 1. Top Bar Audi VDO & Rheostat ── */}
            <View style={styles.topBar}>
                <View style={styles.audiBadgeRow}>
                    <Text style={[styles.audiRingsText, { color: clusterAccentColor, opacity: dimmerLevel }]}>OOOO</Text>
                    <Text style={[styles.clusterTitle, { color: clusterAccentColor, opacity: dimmerLevel }]}>
                        AUDI A6 C4 // DIGIFIZ VDO
                    </Text>
                </View>

                {/* Acțiuni & Rheostat */}
                <View style={styles.headerActions}>
                    {/* 9. VAG 1551 Scan Tool Drawer Button */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: '#00F0FF', backgroundColor: '#00F0FF12' }]}
                        onPress={() => {
                            hapticTap();
                            setShowVagTester(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: '#00F0FF' }]}>📟 VAG 1551</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: clusterAccentColor, backgroundColor: '#FF880018' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: clusterAccentColor }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    {/* 5. Dimmer Tag/Nacht Rheostat */}
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: clusterAccentColor }]}
                        onPress={() => {
                            hapticTap();
                            setDimmerLevel(dimmerLevel === 1.0 ? 0.6 : 1.0);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: clusterAccentColor }]}>
                            {dimmerLevel === 1.0 ? '☀️ TAG' : '🌙 NACHT'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.v2Button}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.v2ButtonText}>⮌ V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.stylePickerButton, { backgroundColor: clusterAccentColor }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.stylePickerText}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── 2. Panoul Central VFD Cluster ── */}
            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.mainScrollContent}
                showsVerticalScrollIndicator={false}
            >
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
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#260B05',
    },
    audiBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    audiRingsText: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
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
        gap: 6,
    },
    v2Button: {
        paddingHorizontal: 8,
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
});
