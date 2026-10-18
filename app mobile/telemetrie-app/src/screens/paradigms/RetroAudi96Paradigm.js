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
} from 'react-native';
import Svg, { Rect, Path, Circle, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETRO_FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.RETRO_AUDI_96];

// 25-block stepped diagonal LED tachometer with phosphor persistence
function AudiTachometerBargraph({ rpm = 800, maxRpm = 6500, width = SCREEN_WIDTH - 40, brightness = 1.0 }) {
    const totalBlocks = 25;
    const clampedRpm = Math.min(Math.max(rpm, 0), maxRpm);
    const activeBlocksCount = Math.round((clampedRpm / maxRpm) * totalBlocks);

    const blockWidth = Math.max((width - 60) / totalBlocks, 6);
    const blockGap = 2.5;

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
                    <LinearGradient id="amberGlow" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#FFB300" stopOpacity={brightness} />
                        <Stop offset="1" stopColor="#FF6600" stopOpacity={brightness} />
                    </LinearGradient>
                </Defs>

                {Array.from({ length: totalBlocks }).map((_, i) => {
                    const isActive = i < activeBlocksCount;
                    const x = i * (blockWidth + blockGap) + 10;
                    const blockHeight = 12 + Math.floor((i / totalBlocks) * 16);
                    const y = 34 - blockHeight;

                    // Color zones: Green (0-14), Amber (15-20), Red (21-24)
                    let activeColor = '#00FF66';
                    let inactiveColor = '#072412';
                    if (i >= 15 && i < 21) {
                        activeColor = '#FF8800';
                        inactiveColor = '#241407';
                    } else if (i >= 21) {
                        activeColor = '#FF3300';
                        inactiveColor = '#260805';
                    }

                    return (
                        <Rect
                            key={i}
                            x={x}
                            y={y}
                            width={blockWidth}
                            height={blockHeight}
                            rx={1.5}
                            fill={isActive ? activeColor : inactiveColor}
                            opacity={isActive ? brightness : 0.4}
                            stroke={isActive ? (i >= 21 ? '#FF6644' : '#FFAA33') : '#120502'}
                            strokeWidth={isActive ? 0.8 : 0.5}
                        />
                    );
                })}

                <Line x1="10" y1="36" x2={width - 20} y2="36" stroke="#4A180C" strokeWidth="1" />
                <SvgText x="12" y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>0</SvgText>
                <SvgText x={width * 0.3} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>2</SvgText>
                <SvgText x={width * 0.58} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>4</SvgText>
                <SvgText x={width * 0.82} y="32" fill="#FF4422" fontSize="7" fontFamily={RETRO_FONT}>6</SvgText>
            </Svg>
        </View>
    );
}

// Vertical LED Segment Column with Ghost Segments
function VerticalLedColumn({ label, value, unit, min, max, warnThreshold, critThreshold, color = '#FF8800', brightness = 1.0 }) {
    const totalSegments = 10;
    const val = Number(value) || 0;
    const ratio = Math.min(Math.max((val - min) / (max - min), 0), 1);
    const litCount = Math.round(ratio * totalSegments);

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
                    return (
                        <View
                            key={i}
                            style={[
                                styles.verticalSegment,
                                {
                                    backgroundColor: isLit ? activeColor : 'rgba(255, 136, 0, 0.07)',
                                    borderColor: isLit ? activeColor : '#2A0E08',
                                    opacity: isLit ? brightness : 0.6,
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
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stări locale
    const [bcModeIndex, setBcModeIndex] = useState(0);
    const [showDiagPanel, setShowDiagPanel] = useState(false);
    const [dimmerLevel, setDimmerLevel] = useState(1.0); // 1.0 = zi / 0.6 = noapte
    const [tripKmOffset, setTripKmOffset] = useState(247.4);
    const [autocheckState, setAutocheckState] = useState('OK'); // 'BREMSE' -> 'OELDRUCK' -> 'OK'

    // Simulare Autocheck la montare
    useEffect(() => {
        const timer1 = setTimeout(() => setAutocheckState('BREMSE'), 1200);
        const timer2 = setTimeout(() => setAutocheckState('OELDRUCK'), 2400);
        const timer3 = setTimeout(() => setAutocheckState('OK'), 3600);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

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
        exhaustTemp,
        batteryVoltage,
        batterySoH,
        fuelLevel,
        fuelRate,
        fuelBurnedLiters,
        brakeFluidTemp,
        brakeEnergyTrip,
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

    // Odometru mecanic total & trip
    const totalKm = 348912;
    const currentTripKm = Number((tripKmOffset + (speed > 0 ? 0.1 : 0)).toFixed(1));

    // Bordcomputer modes (Audi Autocheck)
    const bcModes = [
        { label: 'MOMENTANVERBRAUCH', value: `${fuelRate}`, unit: 'L/100KM' },
        { label: 'DURCHSCHNITTSVERBR.', value: '6.4', unit: 'L/100KM' },
        { label: 'REICHWEITE', value: `${Math.round((fuelLevel / 100) * 850)}`, unit: 'KM' },
        { label: 'FAHRZEIT // REISEZEIT', value: '01:42', unit: 'H:M' },
        { label: 'AUSSENTEMPERATUR', value: '+14.5', unit: '°C' },
    ];
    const currentBc = bcModes[bcModeIndex % bcModes.length];

    // Detecție polei sub 3°C
    const isIceRisk = telemetry.criticalAlerts.some(a => a.id === 'BLACK_ICE');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#050200" />

            {/* ── 1. Top Bar Audi VDO & Rheostat ── */}
            <View style={styles.topBar}>
                <View style={styles.audiBadgeRow}>
                    <Text style={[styles.audiRingsText, { opacity: dimmerLevel }]}>OOOO</Text>
                    <Text style={[styles.clusterTitle, { opacity: dimmerLevel }]}>
                        AUDI A6 C4 // DIGIFIZ VDO
                    </Text>
                </View>

                {/* Acțiuni & Rheostat */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.v2Button, { borderColor: '#FF8800', backgroundColor: '#FF880018' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.v2ButtonText, { color: '#FF8800' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    {/* Dimmer Tag/Nacht */}
                    <TouchableOpacity
                        style={styles.v2Button}
                        onPress={() => {
                            hapticTap();
                            setDimmerLevel(dimmerLevel === 1.0 ? 0.6 : 1.0);
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.v2ButtonText}>
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
                        style={styles.stylePickerButton}
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
                {/* 2.1 Turometru VFD Stepped */}
                <AudiTachometerBargraph rpm={rpm} maxRpm={6000} brightness={dimmerLevel} />

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
                        <Text style={[styles.speedVfdText, { opacity: dimmerLevel }]}>
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

                {/* 2.3 Odometru Mecanic cu Tamburi & Ceas Quartz */}
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

                    {/* Ceas Quartz & Termometru */}
                    <View style={styles.clockRow}>
                        <Text style={styles.quartzClockText}>ZEIT: {currentTime}</Text>
                        <View style={styles.tempIceRow}>
                            {isIceRisk && <Text style={styles.iceFlakeIcon}>❄️</Text>}
                            <Text style={styles.tempIceText}>AUSSEN: +14°C</Text>
                        </View>
                    </View>
                </View>

                {/* 2.4 Audi Autocheck System Screen */}
                <View style={styles.autocheckScreen}>
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
                            : `SYSTEMTEST LAUFEND: ${autocheckState} WIRD GEPRÜFT...`}
                    </Text>
                </View>

                {/* 2.5 Coloane Verticale LED VFD (Antigel, Ulei, Boost, Rezervor) */}
                <View style={styles.columnsRow}>
                    <VerticalLedColumn
                        label="KÜHLMITTEL"
                        value={coolantTemp}
                        unit="°C"
                        min={50}
                        max={120}
                        warnThreshold={100}
                        critThreshold={108}
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
                        brightness={dimmerLevel}
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
                        <Text style={styles.bcValue}>{currentBc.value}</Text>
                        <Text style={styles.bcUnit}>{currentBc.unit}</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
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
        borderBottomColor: '#2A0E04',
    },
    audiBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    audiRingsText: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        fontWeight: '900',
        color: '#FF8800',
        letterSpacing: -1,
        marginRight: 8,
    },
    clusterTitle: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        fontWeight: '700',
        color: '#FF941A',
        letterSpacing: 1,
        flexShrink: 1,
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
        borderColor: '#4A1C08',
        backgroundColor: '#150A02',
    },
    v2ButtonText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#FF8800',
        fontWeight: '700',
    },
    stylePickerButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: '#FF8800',
    },
    stylePickerText: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#050200',
        fontWeight: '900',
    },
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    tachoWrapper: {
        backgroundColor: '#100602',
        borderRadius: 6,
        padding: 10,
        borderWidth: 1,
        borderColor: '#2A0E04',
        marginBottom: 12,
    },
    tachoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tachoLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#CC6600',
        letterSpacing: 1,
    },
    tachoValue: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        color: '#FF941A',
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    tachoUnit: {
        fontSize: 9,
        color: '#884400',
    },
    speedClusterFrame: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0E0502',
        borderRadius: 8,
        padding: 16,
        borderWidth: 2,
        borderColor: '#381604',
        marginBottom: 12,
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
        backgroundColor: '#1F0B04',
        borderWidth: 2,
        borderColor: '#542008',
        marginBottom: 4,
    },
    pushPinText: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884400',
        fontWeight: '700',
    },
    speedDisplayCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    speedGhost: {
        position: 'absolute',
        fontFamily: RETRO_FONT,
        fontSize: 76,
        fontWeight: '900',
        color: '#FF8800',
        letterSpacing: 2,
    },
    speedVfdText: {
        fontFamily: RETRO_FONT,
        fontSize: 76,
        fontWeight: '900',
        color: '#FF8800',
        letterSpacing: 2,
        textShadowColor: '#FFAA33',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
        fontVariant: ['tabular-nums'],
    },
    speedUnitVfd: {
        fontFamily: RETRO_FONT,
        fontSize: 14,
        color: '#CC6600',
        fontWeight: '700',
        marginTop: -6,
    },
    odometerFrame: {
        backgroundColor: '#0A0301',
        borderRadius: 6,
        padding: 10,
        borderWidth: 1,
        borderColor: '#240C04',
        marginBottom: 12,
    },
    odometerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    odoLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884400',
        fontWeight: '700',
    },
    drumRollBox: {
        backgroundColor: '#000000',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#381604',
    },
    drumRollText: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 1,
        fontVariant: ['tabular-nums'],
    },
    clockRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#1A0802',
    },
    quartzClockText: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FF8800',
        fontVariant: ['tabular-nums'],
    },
    tempIceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iceFlakeIcon: {
        fontSize: 10,
    },
    tempIceText: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        color: '#FFAA00',
        fontVariant: ['tabular-nums'],
    },
    autocheckScreen: {
        backgroundColor: '#120502',
        borderRadius: 6,
        padding: 10,
        borderWidth: 1,
        borderColor: '#3A1406',
        marginBottom: 12,
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
        color: '#CC6600',
        fontWeight: '700',
    },
    autocheckBadge: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        fontWeight: '900',
    },
    autocheckSub: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#884400',
    },
    columnsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 6,
    },
    verticalCol: {
        flex: 1,
        backgroundColor: '#0D0401',
        borderRadius: 4,
        padding: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#240C04',
    },
    verticalColLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 7,
        color: '#884400',
        fontWeight: '700',
        marginBottom: 6,
    },
    verticalBarFrame: {
        width: 14,
        height: 60,
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    verticalSegment: {
        width: 14,
        height: 4,
        borderRadius: 1,
        borderWidth: 0.5,
    },
    verticalColValue: {
        fontFamily: RETRO_FONT,
        fontSize: 10,
        fontWeight: '800',
        color: '#FF8800',
        fontVariant: ['tabular-nums'],
    },
    verticalColUnit: {
        fontSize: 7,
        color: '#884400',
    },
    bordcomputerBox: {
        backgroundColor: '#140602',
        borderRadius: 6,
        padding: 12,
        borderWidth: 1,
        borderColor: '#381604',
    },
    bcHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    bcLabel: {
        fontFamily: RETRO_FONT,
        fontSize: 9,
        color: '#CC6600',
        fontWeight: '700',
    },
    bcHint: {
        fontFamily: RETRO_FONT,
        fontSize: 8,
        color: '#884400',
    },
    bcValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
    },
    bcValue: {
        fontFamily: RETRO_FONT,
        fontSize: 28,
        fontWeight: '900',
        color: '#FF8800',
        fontVariant: ['tabular-nums'],
    },
    bcUnit: {
        fontFamily: RETRO_FONT,
        fontSize: 12,
        color: '#FFAA33',
        fontWeight: '700',
    },
});
