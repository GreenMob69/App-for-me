import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    StatusBar,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const insets = useSafeAreaInsets();
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stare Tap-to-Maximize: null = 6 micro-monitoare; 1..6 = monitor mărit
    const [expandedPanel, setExpandedPanel] = useState(null);

    // Mod de sesiune: 'RACE' | 'QUAL' | 'PIT'
    const [sessionMode, setSessionMode] = useState('RACE');

    // Buffer glisant 25 puncte pentru osciloscopul live
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

    // Alimentare osciloscop la fiecare pachet
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
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }]}>
            <StatusBar barStyle="light-content" backgroundColor="#030508" translucent />

            {/* ── 1. ANTET CURAT CU SPAȚIERE SIGURĂ ȘI BUTOANE MARI ── */}
            <View style={styles.header}>
                <View style={styles.brandGroup}>
                    <View style={styles.cyberTag}>
                        <Text style={styles.cyberTagText}>F1-DECK</Text>
                    </View>
                    <View style={[styles.liveDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.modelText} numberOfLines={1}>
                        {activeVehicle?.model ? activeVehicle.model.toUpperCase() : 'TELEMETRIE WEC'}
                    </Text>
                </View>

                {/* Butoane Tactile Clare cu Zona Minima de 44px */}
                <View style={styles.actionsGroup}>
                    <TouchableOpacity
                        style={[styles.actionBtn, { borderColor: '#00F0FF', backgroundColor: '#00F0FF1A' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={[styles.actionBtnText, { color: '#00F0FF' }]}>🎮 DEMO</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Text style={styles.actionBtnText}>⮌ CLASIC</Text>
                    </TouchableOpacity>

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
                </View>
            </View>

            {/* ── 2. Bara F1 Shift Lights & Comutator Sesiune ── */}
            <View style={styles.shiftLightRow}>
                <TouchableOpacity
                    style={styles.sessionModePill}
                    onPress={() => {
                        hapticTap();
                        setSessionMode(prev => prev === 'RACE' ? 'QUAL' : prev === 'QUAL' ? 'PIT' : 'RACE');
                    }}
                >
                    <Text style={styles.sessionModeText}>{sessionMode}</Text>
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

            {/* ── 3. CORPUL CENTRAL: GRILĂ 6 MONITOARE SAU MONITOR MĂRIT ── */}
            <View style={styles.viewportLockedContent}>
                {expandedPanel === null ? (
                    <View style={styles.monitorsGrid}>
                        {/* ── M1: NUCLEU VITEZĂ, TREAPTĂ & G-RADAR ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M1 // TELEMETRY NUCLEUS</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(1)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m1Body}>
                                <View style={styles.gearBox}>
                                    <Text style={styles.gearNumber}>{gear}</Text>
                                    <Text style={styles.gearLabel}>TREAPTĂ</Text>
                                </View>
                                <View style={styles.speedBox}>
                                    <Text style={styles.speedNumber}>{speed}</Text>
                                    <Text style={styles.speedLabel}>KM/H · {rpm} RPM</Text>
                                </View>
                                <View style={styles.miniRadar}>
                                    <Svg width={42} height={42} viewBox="0 0 42 42">
                                        <Circle cx="21" cy="21" r="18" fill="none" stroke="#16263D" strokeWidth="1" />
                                        <Circle cx="21" cy="21" r="9" fill="none" stroke="#0D1A2D" strokeWidth="1" />
                                        <Line x1="3" y1="21" x2="39" y2="21" stroke="#16263D" strokeWidth="0.8" />
                                        <Line x1="21" y1="3" x2="21" y2="39" stroke="#16263D" strokeWidth="0.8" />
                                        <Circle
                                            cx={21 + (gForceLat * 9)}
                                            cy={21 - (gForceLong * 9)}
                                            r="3.5"
                                            fill="#00F0FF"
                                        />
                                    </Svg>
                                    <Text style={styles.radarLabel}>{gForceLat}G</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── M2: OSCILOSCOP DUAL-CHANNEL (BOOST VS RPM) ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M2 // OSCILLOSCOPE</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(2)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.oscilloscopeContainer}>
                                <Svg width={SCREEN_WIDTH * 0.42} height={56} viewBox="0 0 160 56">
                                    <Line x1="0" y1="28" x2="160" y2="28" stroke="#112233" strokeDasharray="3, 3" />
                                    {oscilloscopeHistory.length > 1 && (
                                        <Polyline
                                            fill="none"
                                            stroke="#00F0FF"
                                            strokeWidth="2"
                                            points={oscilloscopeHistory
                                                .map((pt, i) => `${i * (160 / 25)},${52 - (pt.boost * 20)}`)
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
                                                .map((pt, i) => `${i * (160 / 25)},${56 - (pt.rpm / 110)}`)
                                                .join(' ')}
                                        />
                                    )}
                                </Svg>
                                <View style={styles.scopeMetaRow}>
                                    <Text style={styles.scopeLegend1}>― BOOST {boost}b</Text>
                                    <Text style={styles.scopeLegend2}>┄ RPM {rpm}</Text>
                                </View>
                            </View>
                        </View>

                        {/* ── M3: ENGINE HEALTH HEATMAP (3x3) ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M3 // ENGINE DNA</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(3)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
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

                        {/* ── M4: SANKEY THERMAL & CHRA TURBO ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M4 // SANKEY & CHRA</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(4)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m4Body}>
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
                                    <Text style={styles.chraOk}>CHRA TURBO STABIL</Text>
                                )}
                            </View>
                        </View>

                        {/* ── M5: WEIBULL RELIABILITY & RUL ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M5 // WEIBULL RUL</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(5)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.m5Body}>
                                <Text style={styles.weibullLine}>RUL MIN: <Text style={{ color: '#00FF66', fontWeight: '900' }}>{minRulKm} KM</Text></Text>
                                <Text style={styles.weibullLine}>RISC PANĂ: <Text style={{ color: '#FFB800' }}>{breakdownRisk}%</Text></Text>
                                <Text style={styles.weibullLine}>B2B ROI: <Text style={{ color: '#00F0FF' }}>+{b2bRoi} €/AN</Text></Text>
                                <Text style={styles.weibullLine}>REV. ULEI: {weibullRul.oil} KM</Text>
                            </View>
                        </View>

                        {/* ── M6: BOSCH KALMAN & UDS LOG TERMINAL ── */}
                        <View style={styles.monitorCell}>
                            <View style={styles.monHeader}>
                                <Text style={styles.monTitle}>M6 // UDS TERMINAL</Text>
                                <TouchableOpacity
                                    style={styles.expandHit}
                                    onPress={() => togglePanel(6)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.monMaxIcon}>[ ⤢ ]</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.udsTerminal}>
                                <Text style={styles.udsLog}>[KALMAN] STEADY: {isSteadyState ? 'TRUE' : 'TRANSIENT'}</Text>
                                <Text style={styles.udsLog}>[CONF] {steadyConfidence}% EXACTITATE</Text>
                                <Text style={styles.udsLog}>[CAN-BUS] 1000ms OK</Text>
                                {criticalAlerts.length > 0 ? (
                                    <Text style={[styles.udsLog, { color: '#FF2A2A' }]} numberOfLines={1}>
                                        [ALERTA] {criticalAlerts[0].title}
                                    </Text>
                                ) : (
                                    <Text style={[styles.udsLog, { color: '#00FF66' }]}>[SISTEM] FĂRĂ ERORI</Text>
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
                                <Text style={styles.closeExpandedText}>◀ ÎNAPOI LA TOATE CELE 6 MONITOARE</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.expandedBody} showsVerticalScrollIndicator={false}>
                            {expandedPanel === 1 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>DINAMICĂ ȘI CUPLU MOTOR</Text>
                                    <Text style={styles.expandedMetricBig}>{speed} <Text style={styles.expandedMetricSub}>KM/H</Text></Text>
                                    <Text style={styles.expandedSubText}>TURAȚIE: {rpm} RPM · TREAPTA: {gear} · ACCELERAȚIE: {throttle}%</Text>
                                    <Text style={styles.expandedSubText}>FORȚĂ G LATERALĂ: {gForceLat} G · LONGITUDINALĂ: {gForceLong} G</Text>
                                </View>
                            )}

                            {expandedPanel === 2 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>OSCILOSCOP DUAL-CHANNEL PRESIUNI</Text>
                                    <Text style={styles.expandedMetricBig}>{boost} <Text style={styles.expandedMetricSub}>BAR BOOST</Text></Text>
                                    <Text style={styles.expandedSubText}>Turație motor corelată: {rpm} RPM · Temperatură antigel: {coolantTemp}°C</Text>
                                    <Text style={styles.expandedSubText}>Eșantionare continuă la 1Hz cu interpolare la 60 FPS.</Text>
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
                                    <Text style={styles.expandedCardTitle}>BALANȚĂ TERMODINAMICĂ SANKEY</Text>
                                    <Text style={styles.expandedMetricBig}>{sankey.mechanicalPct}% <Text style={styles.expandedMetricSub}>LUCRU UTIL</Text></Text>
                                    <Text style={styles.expandedSubText}>Pierderi evacuare: {sankey.exhaustHeatPct}% · Răcire și frecare: {sankey.coolingFrictionPct}%</Text>
                                    <Text style={styles.expandedSubText}>Timp răcire turbină recomandat la oprire: {chraCooldownSec} secunde.</Text>
                                </View>
                            )}

                            {expandedPanel === 5 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>FIABILITATE WEIBULL & DURATĂ DE VIAȚĂ (RUL)</Text>
                                    <Text style={styles.expandedMetricBig}>{minRulKm} <Text style={styles.expandedMetricSub}>KM PÂNĂ LA SERVICE</Text></Text>
                                    <Text style={styles.expandedSubText}>Risc pană iminentă: {breakdownRisk}% · Economii B2B: +{b2bRoi} €/an</Text>
                                    <Text style={styles.expandedSubText}>Ulei motor: {weibullRul.oil} km · Filtru DPF: {weibullRul.dpf} km · Frâne: {weibullRul.brakes} km</Text>
                                </View>
                            )}

                            {expandedPanel === 6 && (
                                <View style={styles.expandedCard}>
                                    <Text style={styles.expandedCardTitle}>LOG UDS BOSCH & FILTRU KALMAN</Text>
                                    <Text style={styles.expandedMetricBig}>{steadyConfidence}% <Text style={styles.expandedMetricSub}>ÎNCREDERE DIAGNOZĂ</Text></Text>
                                    <Text style={styles.expandedSubText}>Stare motor: {isSteadyState ? 'STABIL (STEADY STATE)' : 'TRANZITORIU (TRANSIENT)'}</Text>
                                    <Text style={styles.expandedSubText}>Filtru de debouncing Bosch la nivel industrial aplicat pe toți cei 32 de parametri.</Text>
                                </View>
                            )}
                        </ScrollView>
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
        paddingBottom: 8,
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
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
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
    actionBtn: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1E3654',
        backgroundColor: '#0A1424',
    },
    actionBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    stylePickerBtn: {
        backgroundColor: '#FFB800',
        borderColor: '#FFB800',
    },
    stylePickerText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#030508',
        fontWeight: '900',
    },
    shiftLightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
        backgroundColor: '#060B12',
    },
    sessionModePill: {
        backgroundColor: '#0A1628',
        borderWidth: 1,
        borderColor: '#FFB800',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
    },
    sessionModeText: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        color: '#FFB800',
    },
    ledsTrack: {
        flex: 1,
        flexDirection: 'row',
        gap: 3,
    },
    shiftLed: {
        flex: 1,
        height: 5,
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
        width: '49%',
        height: '32%',
        backgroundColor: '#080D16',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#16263D',
        padding: 6,
        justifyContent: 'space-between',
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
    expandHit: {
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    monMaxIcon: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#00F0FF',
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
        backgroundColor: '#0D1A2D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
        borderWidth: 1,
        borderColor: '#1E3654',
    },
    gearNumber: {
        fontFamily: MONO,
        fontSize: 22,
        fontWeight: '900',
        color: '#00FF66',
    },
    gearLabel: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#8CA0BA',
        fontWeight: '700',
    },
    speedBox: {
        alignItems: 'center',
    },
    speedNumber: {
        fontFamily: MONO,
        fontSize: 28,
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
    scopeMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 2,
    },
    scopeLegend1: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#00F0FF',
        fontWeight: '700',
    },
    scopeLegend2: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#FFB800',
        fontWeight: '700',
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
        height: 8,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
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
        color: '#8CA0BA',
        fontVariant: ['tabular-nums'],
    },
    chraAlert: {
        fontFamily: MONO,
        fontSize: 7,
        color: '#FF2A2A',
        fontWeight: '800',
        marginTop: 2,
    },
    chraOk: {
        fontFamily: MONO,
        fontSize: 6,
        color: '#00FF66',
        marginTop: 2,
    },
    m5Body: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    weibullLine: {
        fontFamily: MONO,
        fontSize: 7,
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
        fontSize: 6,
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
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#16263D',
        paddingBottom: 8,
    },
    expandedTitle: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '900',
        color: '#00F0FF',
        letterSpacing: 1,
        marginBottom: 8,
    },
    closeExpandedBtn: {
        backgroundColor: '#00F0FF',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 4,
        alignItems: 'center',
    },
    closeExpandedText: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#030508',
        fontWeight: '900',
    },
    expandedBody: {
        flex: 1,
    },
    expandedCard: {
        backgroundColor: '#0A1424',
        borderRadius: 6,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1E3654',
    },
    expandedCardTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '800',
        color: '#8CA0BA',
        marginBottom: 8,
    },
    expandedMetricBig: {
        fontFamily: MONO,
        fontSize: 36,
        fontWeight: '900',
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
        marginBottom: 8,
    },
    expandedMetricSub: {
        fontSize: 14,
        color: '#00F0FF',
        fontWeight: '700',
    },
    expandedSubText: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 6,
        lineHeight: 16,
    },
});
