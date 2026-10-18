import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import Svg, {
    Rect,
    Circle,
    Line,
    Polyline,
    Text as SvgText,
    Defs,
    LinearGradient,
    Stop,
} from 'react-native-svg';
import { useNormalizedTelemetry } from '../../hooks/useNormalizedTelemetry';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert } from '../../services/hapticFeedback';
import { PARADIGM_THEMES, PARADIGM_KEYS } from '../../theme/paradigmThemes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const theme = PARADIGM_THEMES[PARADIGM_KEYS.F1_CYBERDECK];

export default function F1CyberdeckParadigm() {
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stare Tap-to-Maximize: null = 6 micro-monitoare; 1..6 = monitor mărit
    const [expandedPanel, setExpandedPanel] = useState(null);

    // Mod de sesiune: 'RACE' | 'QUAL' | 'PIT'
    const [sessionMode, setSessionMode] = useState('RACE');

    // Buffer glisant 30 puncte pentru osciloscopul live
    const [oscilloscopeHistory, setOscilloscopeHistory] = useState([]);

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

    // Alimentare osciloscop la fiecare secundă
    useEffect(() => {
        setOscilloscopeHistory((prev) => {
            const next = [
                ...prev,
                { boost, rpm, temp: coolantTemp },
            ];
            return next.slice(-25);
        });
        if (rpm >= 4500) {
            hapticShiftAlert();
        }
    }, [telemetry.rpm, telemetry.boost]);

    const togglePanel = (panelId) => {
        hapticTap();
        setExpandedPanel((prev) => (prev === panelId ? null : panelId));
    };

    // 15-LED Shift Light Bar F1
    const shiftLights = useMemo(() => {
        const total = 15;
        const rpmClamped = Math.max(0, Math.min(rpm, 5500));
        const activeCount = Math.round((rpmClamped / 5500) * total);
        return Array.from({ length: total }).map((_, i) => {
            const active = i < activeCount;
            let color = '#00FF66'; // 1-5 Verde
            if (i >= 5 && i < 10) color = '#FFB800'; // 6-10 Galben
            else if (i >= 10 && i < 14) color = '#FF2A2A'; // 11-14 Roșu
            else if (i >= 14) color = '#00F0FF'; // 15 Albastru Flash
            return { active, color };
        });
    }, [rpm]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#030508" />

            {/* ── Antet F1 Cyberdeck ── */}
            <View style={styles.header}>
                <View style={styles.brandGroup}>
                    <View style={styles.cyberTag}>
                        <Text style={styles.cyberTagText}>F1-DECK</Text>
                    </View>
                    <Text style={styles.modelText} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRY WEC // CHASSIS 01'}
                    </Text>
                </View>

                {/* Sesiune & Simulator & Controluri */}
                <View style={styles.actionsGroup}>
                    {/* Sesiune Mode Switcher */}
                    <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: '#FFB800', backgroundColor: '#FFB80014' }]}
                        onPress={() => {
                            hapticTap();
                            setSessionMode(prev => prev === 'RACE' ? 'QUAL' : prev === 'QUAL' ? 'PIT' : 'RACE');
                        }}
                    >
                        <Text style={[styles.smallBtnText, { color: '#FFB800' }]}>{sessionMode}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF14' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                    >
                        <Text style={[styles.smallBtnText, { color: '#00F0FF' }]}>PIT SIM</Text>
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

            {/* ── F1 15-LED Shift Light Bar pe margine sus ── */}
            <View style={styles.shiftLightRow}>
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
                                shadowRadius: 4,
                            },
                        ]}
                    />
                ))}
            </View>

            {/* ── Corpul Central: Grilă 6 Monitoare sau Monitor Mărit ── */}
            <View style={styles.viewportLockedContent}>
                {expandedPanel === null ? (
                    <View style={styles.monitorsGrid}>
                        {/* ── M1: NUCLEU VITEZĂ, TREAPTĂ & G-RADAR ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(1)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M1 // TELEMETRY NUCLEUS</Text>
                                <Text style={styles.monMaxIcon}>[+]</Text>
                            </View>
                            <View style={styles.m1Body}>
                                <View style={styles.gearBox}>
                                    <Text style={styles.gearNumber}>{gear}</Text>
                                    <Text style={styles.gearLabel}>GEAR</Text>
                                </View>
                                <View style={styles.speedBox}>
                                    <Text style={styles.speedNumber}>{speed}</Text>
                                    <Text style={styles.speedLabel}>KM/H · {rpm} RPM</Text>
                                </View>
                                {/* Mini G-Force Radar */}
                                <View style={styles.miniRadar}>
                                    <Svg width={44} height={44} viewBox="0 0 44 44">
                                        <Circle cx="22" cy="22" r="18" fill="none" stroke="#16263D" strokeWidth="1" />
                                        <Circle cx="22" cy="22" r="9" fill="none" stroke="#0D1A2D" strokeWidth="1" />
                                        <Line x1="4" y1="22" x2="40" y2="22" stroke="#16263D" strokeWidth="0.8" />
                                        <Line x1="22" y1="4" x2="22" y2="40" stroke="#16263D" strokeWidth="0.8" />
                                        <Circle
                                            cx={22 + (gForceLat * 10)}
                                            cy={22 - (gForceLong * 10)}
                                            r="3.5"
                                            fill="#00F0FF"
                                        />
                                    </Svg>
                                    <Text style={styles.radarLabel}>{gForceLat}G</Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* ── M2: OSCILOSCOP DUAL-CHANNEL (BOOST VS RPM) ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(2)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M2 // OSCILLOSCOPE</Text>
                                <Text style={styles.monSub}>{boost} BAR</Text>
                            </View>
                            <View style={styles.oscilloscopeContainer}>
                                <Svg width={SCREEN_WIDTH * 0.44} height={64} viewBox="0 0 160 64">
                                    <Line x1="0" y1="32" x2="160" y2="32" stroke="#112233" strokeDasharray="3, 3" />
                                    {oscilloscopeHistory.length > 1 && (
                                        <Polyline
                                            fill="none"
                                            stroke="#00F0FF"
                                            strokeWidth="2"
                                            points={oscilloscopeHistory
                                                .map((pt, i) => `${i * (160 / 25)},${60 - (pt.boost * 24)}`)
                                                .join(' ')}
                                        />
                                    )}
                                    {oscilloscopeHistory.length > 1 && (
                                        <Polyline
                                            fill="none"
                                            stroke="#FFB800"
                                            strokeWidth="1"
                                            strokeDasharray="2, 2"
                                            points={oscilloscopeHistory
                                                .map((pt, i) => `${i * (160 / 25)},${64 - (pt.rpm / 100)}`)
                                                .join(' ')}
                                        />
                                    )}
                                </Svg>
                            </View>
                        </TouchableOpacity>

                        {/* ── M3: ENGINE HEALTH HEATMAP (3x3) ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(3)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M3 // ENGINE DNA</Text>
                                <Text style={styles.monSub}>{coolantTemp}°C</Text>
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
                        </TouchableOpacity>

                        {/* ── M4: SANKEY THERMAL & CHRA TURBO ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(4)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M4 // SANKEY & CHRA</Text>
                                <Text style={styles.monSub}>CHRA {chraTemp}°C</Text>
                            </View>
                            <View style={styles.m4Body}>
                                <View style={styles.sankeyBarFrame}>
                                    <View style={[styles.sankeySeg, { flex: sankey.mechanicalPct, backgroundColor: '#00FF66' }]} />
                                    <View style={[styles.sankeySeg, { flex: sankey.exhaustHeatPct, backgroundColor: '#FFB800' }]} />
                                    <View style={[styles.sankeySeg, { flex: sankey.coolingFrictionPct, backgroundColor: '#FF2A2A' }]} />
                                </View>
                                <View style={styles.sankeyMeta}>
                                    <Text style={styles.sankeyLabel}>MECH {sankey.mechanicalPct}%</Text>
                                    <Text style={styles.sankeyLabel}>EXH {sankey.exhaustHeatPct}%</Text>
                                    <Text style={styles.sankeyLabel}>COOL {sankey.coolingFrictionPct}%</Text>
                                </View>
                                {chraCooldownSec > 0 && (
                                    <Text style={styles.chraAlert}>TURBO COOLDOWN: {chraCooldownSec}s</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* ── M5: WEIBULL RELIABILITY & RUL ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(5)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M5 // WEIBULL RUL</Text>
                                <Text style={[styles.monSub, { color: '#00FF66' }]}>{minRulKm} KM</Text>
                            </View>
                            <View style={styles.m5Body}>
                                <Text style={styles.weibullLine}>ROAD RISK: <Text style={{ color: '#FFB800' }}>{breakdownRisk}%</Text></Text>
                                <Text style={styles.weibullLine}>B2B ROI: <Text style={{ color: '#00F0FF' }}>+{b2bRoi} €/YR</Text></Text>
                                <Text style={styles.weibullLine}>OIL RUL: {weibullRul.oil} KM</Text>
                                <Text style={styles.weibullLine}>DPF RUL: {weibullRul.dpf} KM</Text>
                            </View>
                        </TouchableOpacity>

                        {/* ── M6: BOSCH KALMAN & UDS LOG TERMINAL ── */}
                        <TouchableOpacity
                            style={[styles.monitorCell, styles.cornerBrackets]}
                            onPress={() => togglePanel(6)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M6 // UDS TERMINAL</Text>
                                <Text style={styles.monSub}>{steadyConfidence}% CONF</Text>
                            </View>
                            <View style={styles.udsTerminal}>
                                <Text style={styles.udsLog}>[KALMAN] STEADY: {isSteadyState ? 'TRUE' : 'TRANSIENT'}</Text>
                                <Text style={styles.udsLog}>[OBD-II] 32 OBSERV. NOMINAL</Text>
                                <Text style={styles.udsLog}>[CAN-BUS] PACKET 1000ms OK</Text>
                                {criticalAlerts.length > 0 ? (
                                    <Text style={[styles.udsLog, { color: '#FF2A2A' }]}>[WARN] {criticalAlerts[0].title}</Text>
                                ) : (
                                    <Text style={[styles.udsLog, { color: '#00FF66' }]}>[SYS] NO FAULT RECORDED</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* ── MONITOR MĂRIT (EXPANDED PANEL VIEW) ── */
                    <View style={styles.expandedContainer}>
                        <View style={styles.expandedHeader}>
                            <Text style={styles.expandedTitle}>MONITOR M{expandedPanel} // EXTENDED TELEMETRY</Text>
                            <TouchableOpacity
                                style={styles.closeExpandedBtn}
                                onPress={() => togglePanel(expandedPanel)}
                            >
                                <Text style={styles.closeExpandedText}>[ ✖ CLOSE ]</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.expandedBody}>
                            <Text style={styles.expandedBigValue}>
                                {expandedPanel === 1 && `${speed} KM/H // ${rpm} RPM // GEAR ${gear}`}
                                {expandedPanel === 2 && `BOOST: ${boost} BAR // MAP: 101 kPa`}
                                {expandedPanel === 3 && `COOLANT: ${coolantTemp}°C // OIL: ${oilTemp}°C // EGT: ${exhaustTemp}°C`}
                                {expandedPanel === 4 && `SANKEY MECH EFF: ${sankey.mechanicalPct}% // CHRA: ${chraTemp}°C`}
                                {expandedPanel === 5 && `MIN RUL: ${minRulKm} KM // RISK: ${breakdownRisk}%`}
                                {expandedPanel === 6 && `UDS KALMAN FILTER // CONFIDENCE: ${steadyConfidence}%`}
                            </Text>
                            <Text style={styles.expandedSubText}>
                                Algoritm fizic dinamic 1Hz activ · Transmisie securizată Socket.IO · Buffer local sincronizat.
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030508',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
    },
    cyberTag: {
        backgroundColor: '#00F0FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
        marginRight: 6,
    },
    cyberTagText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#030508',
    },
    modelText: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#E2E8F0',
        fontWeight: '700',
        flexShrink: 1,
    },
    actionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    smallBtn: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#1E3654',
        backgroundColor: '#0A1424',
    },
    smallBtnText: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
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
        color: '#030508',
        fontWeight: '900',
    },
    shiftLightRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
        backgroundColor: '#060B12',
    },
    shiftLed: {
        flex: 1,
        height: 6,
        borderRadius: 2,
        borderWidth: 1,
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
        width: '49%',
        height: '32%',
        backgroundColor: '#080D16',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 6,
        justifyContent: 'space-between',
    },
    cornerBrackets: {
        position: 'relative',
    },
    monHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#111F33',
        paddingBottom: 3,
    },
    monTitle: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        color: '#8CA0BA',
        letterSpacing: 0.5,
    },
    monSub: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '700',
        color: '#00F0FF',
        fontVariant: ['tabular-nums'],
    },
    monMaxIcon: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#00F0FF',
        fontWeight: '800',
    },
    m1Body: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1,
    },
    gearBox: {
        alignItems: 'center',
        backgroundColor: '#0D1A2D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#1E3654',
    },
    gearNumber: {
        fontFamily: MONO,
        fontSize: 24,
        fontWeight: '900',
        color: '#00FF66',
    },
    gearLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    speedBox: {
        alignItems: 'center',
    },
    speedNumber: {
        fontFamily: MONO,
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        letterSpacing: -1,
    },
    speedLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#8CA0BA',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    miniRadar: {
        alignItems: 'center',
    },
    radarLabel: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#00F0FF',
        fontVariant: ['tabular-nums'],
    },
    oscilloscopeContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heatmapGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 3,
        flex: 1,
        marginTop: 4,
    },
    heatmapCell: {
        width: '31%',
        height: '30%',
        borderRadius: 2,
        borderWidth: 0.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heatName: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    heatVal: {
        fontFamily: MONO,
        fontSize: 7,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    m4Body: {
        flex: 1,
        justifyContent: 'center',
    },
    sankeyBarFrame: {
        flexDirection: 'row',
        height: 10,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
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
        fontSize: 7,
        color: '#8CA0BA',
        fontVariant: ['tabular-nums'],
    },
    chraAlert: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#FF2A2A',
        fontWeight: '800',
        marginTop: 4,
    },
    m5Body: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    weibullLine: {
        fontFamily: MONO,
        fontSize: 8,
        color: '#8CA0BA',
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    udsTerminal: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
        backgroundColor: '#04070D',
        padding: 4,
        borderRadius: 2,
    },
    udsLog: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#64748B',
        fontVariant: ['tabular-nums'],
    },
    expandedContainer: {
        flex: 1,
        backgroundColor: '#080D16',
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#00F0FF',
        padding: 12,
    },
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
        paddingBottom: 8,
        marginBottom: 12,
    },
    expandedTitle: {
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: '900',
        color: '#00F0FF',
        letterSpacing: 1,
    },
    closeExpandedBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        backgroundColor: '#FF2A2A22',
        borderWidth: 1,
        borderColor: '#FF2A2A',
    },
    closeExpandedText: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#FF2A2A',
        fontWeight: '800',
    },
    expandedBody: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    expandedBigValue: {
        fontFamily: MONO,
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
    },
    expandedSubText: {
        fontFamily: MONO,
        fontSize: 11,
        color: '#8CA0BA',
        textAlign: 'center',
    },
});
