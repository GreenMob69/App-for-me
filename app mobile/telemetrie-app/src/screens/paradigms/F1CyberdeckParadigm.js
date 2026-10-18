import React, { useState, useContext, useMemo, useEffect } from 'react';
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
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';
import { hapticTap, hapticShiftAlert } from '../../services/hapticFeedback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function F1CyberdeckParadigm() {
    const { liveData, isConnected } = useContext(LiveContext);
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker, openSimulatorModal } = useUiParadigm();

    // Stare Tap-to-Maximize: null = 6 micro-monitoare; 1..6 = monitor mărit
    const [expandedPanel, setExpandedPanel] = useState(null);

    // Buffer glisant 30 puncte pentru osciloscopul live
    const [oscilloscopeHistory, setOscilloscopeHistory] = useState([]);

    // Extragere telemetrie brută & calculată
    const speed = Math.round(Number(liveData?.viteza_kmh ?? liveData?.motor?.speed ?? 0));
    const rpm = Math.round(Number(liveData?.turatie_rpm ?? liveData?.motor?.rpm ?? 0));
    const load = Math.round(Number(liveData?.sarcina_motor_pct ?? liveData?.motor?.load ?? 0));
    const boost = Number(liveData?.presiune_turbo_bar ?? liveData?.aer?.boost_actual ?? 0).toFixed(2);
    const mapAct = Math.round(Number(liveData?.aer?.map ?? 101));
    const mapCmd = Math.round(Number(liveData?.aer?.map_cmd ?? 101));
    const maf = Number(liveData?.aer?.maf ?? 12.5).toFixed(1);
    const gear = liveData?.transmisie?.gear || liveData?.motor?.treapta_viteza || (speed > 0 ? (speed < 20 ? 1 : speed < 40 ? 2 : speed < 65 ? 3 : speed < 95 ? 4 : 5) : 'N');
    const torque = Math.round(Number(liveData?.motor?.torque_actual ?? liveData?.fizica?.cuplu_nm ?? 180));
    const powerHp = Math.round(Number(liveData?.fizica?.saeCorrectedPowerHp ?? liveData?.putere_motor_kw ? (liveData.putere_motor_kw * 1.36) : 95));

    // Forțe G
    const accelX = Number(liveData?.accelerometru?.accel_x ?? liveData?.motor?.accel_g ?? 0.05);
    const accelY = Number(liveData?.accelerometru?.accel_y ?? 0.02);

    // Fizică 32 Modele
    const v = liveData?.virtual || {};
    const f = liveData?.fizica || {};
    const turboCoreTemp = Math.round(Number(v.turboCoreTempC ?? f.turbo_core_temp_c ?? 240));
    const icEfficiency = Math.round(Number(v.intercoolerEfficiencyPct ?? f.intercooler_eff_pct ?? 82));
    const coolingCond = Number(v.coolingConductanceKwPerK ?? 0.42).toFixed(2);
    const bsfc = Math.round(Number(v.bsfcGPerKwh ?? f.bsfc_g_kwh ?? 215));
    const ve = Math.round(Number(v.volumetricEfficiencyPct ?? f.ve_pct ?? 86));
    const afr = Number(v.afrActual ?? 17.2).toFixed(1);
    const lambda = Number(v.lambda ?? 1.18).toFixed(2);

    // Weibull & RUL
    const minRulKm = Math.round(Number(v.minRemainingKm ?? 3660));
    const weakestComp = String(v.weakestComponent || 'ULEI MOTOR').toUpperCase();
    const roadsideRisk = Math.round(Number(v.roadsideBreakdownRiskPct ?? 22));

    // Stare Kalman & UDS
    const isSteady = Boolean(v.isSteadyState ?? true);
    const confPct = Math.round(Number(v.diagnosticConfidencePct ?? 94));
    const roadGrip = String(v.roadGripStatus || 'ADERE_OPTIMA').replace(/_/g, ' ');
    const fatigue = Math.round(Number(v.driverFatigueScore ?? 88));
    const idleIndex = Math.round(Number(v.idleStabilityIndex ?? 9));

    // Alimentare osciloscop la fiecare pachet
    useEffect(() => {
        setOscilloscopeHistory((prev) => {
            const next = [
                ...prev,
                { mapAct, mapCmd, rpm, maf: parseFloat(maf) },
            ];
            return next.slice(-30);
        });
        if (rpm >= 4500) {
            hapticShiftAlert();
        }
    }, [liveData?.timestamp, mapAct, rpm]);

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
                        <Text style={styles.cyberTagText}>F1-DECK // WEC 2026</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00FF66' : '#FF2A2A' }]} />
                    <Text style={styles.vehicleVin}>
                        {activeVehicle?.vin ? activeVehicle.vin.slice(-8) : 'TELEMETRIE'}
                    </Text>
                </View>

                {/* Butoane Acțiuni Rapide */}
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.btnAction, { borderColor: '#00F0FF' }]}
                        onPress={() => {
                            hapticTap();
                            openSimulatorModal();
                        }}
                    >
                        <Text style={[styles.btnActionText, { color: '#00F0FF' }]}>🎮 SIMULATOR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btnAction, { borderColor: '#FFB800' }]}
                        onPress={() => {
                            hapticTap();
                            openExperiencePicker();
                        }}
                    >
                        <Text style={[styles.btnActionText, { color: '#FFB800' }]}>🎨 STIL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.btnAction}
                        onPress={() => {
                            hapticTap();
                            setUiParadigm('CLASSIC_V2');
                        }}
                    >
                        <Text style={styles.btnActionText}>⮌ V2</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Corpul Principal Zero-Scroll (sau Monitor Mărit) ── */}
            <View style={styles.viewportBody}>
                {/* ── MONITOR 1: NUCLEU F1 & G-FORCE RADAR ── */}
                {(expandedPanel === null || expandedPanel === 1) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 1 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(1)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M1 // NUCLEU CURSĂ & G-FORCE</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 1 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Bara 15-LED Shift Lights */}
                        <View style={styles.shiftLightBar}>
                            {shiftLights.map((l, idx) => (
                                <View
                                    key={idx}
                                    style={[
                                        styles.shiftLed,
                                        { backgroundColor: l.active ? l.color : '#0B1524', borderColor: l.color },
                                    ]}
                                />
                            ))}
                        </View>

                        <View style={styles.m1ContentRow}>
                            {/* Treaptă & Viteză */}
                            <View style={styles.m1Left}>
                                <Text style={styles.gearHuge}>{gear}</Text>
                                <Text style={styles.speedSub}>{speed} <Text style={styles.unitSmall}>KM/H</Text></Text>
                                <Text style={styles.rpmSub}>{rpm} <Text style={styles.unitSmall}>RPM</Text></Text>
                            </View>

                            {/* Putere SAE & Cuplu */}
                            <View style={styles.m1Center}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>PUTERE SAE</Text>
                                    <Text style={styles.statValueCyan}>{powerHp} <Text style={styles.unitSmall}>CP</Text></Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>CUPLU AX</Text>
                                    <Text style={styles.statValueLime}>{torque} <Text style={styles.unitSmall}>NM</Text></Text>
                                </View>
                            </View>

                            {/* G-Force Target Radar SVG */}
                            <View style={styles.m1Right}>
                                <Svg width={72} height={72} viewBox="0 0 72 72">
                                    <Circle cx={36} cy={36} r={32} stroke="#1A2D4A" strokeWidth={1} fill="none" />
                                    <Circle cx={36} cy={36} r={20} stroke="#1A2D4A" strokeWidth={1} fill="none" strokeDasharray="3,3" />
                                    <Line x1={36} y1={4} x2={36} y2={68} stroke="#1A2D4A" strokeWidth={1} />
                                    <Line x1={4} y1={36} x2={68} y2={36} stroke="#1A2D4A" strokeWidth={1} />
                                    {/* Punct G-Force dinamic */}
                                    <Circle
                                        cx={Math.max(6, Math.min(66, 36 + accelY * 26))}
                                        cy={Math.max(6, Math.min(66, 36 - accelX * 26))}
                                        r={5}
                                        fill="#00F0FF"
                                        stroke="#FFFFFF"
                                        strokeWidth={1.5}
                                    />
                                </Svg>
                                <Text style={styles.gForceText}>
                                    {accelX.toFixed(2)}G | {accelY.toFixed(2)}G
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── MONITOR 2: OSCILOSCOP DUAL-CHANNEL LIVE (SVG) ── */}
                {(expandedPanel === null || expandedPanel === 2) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 2 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(2)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M2 // OSCILOSCOP DUAL MAP/MAF</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 2 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Indicatori canal */}
                        <View style={styles.legendRow}>
                            <Text style={[styles.legendItem, { color: '#00F0FF' }]}>■ MAP {mapAct} kPa</Text>
                            <Text style={[styles.legendItem, { color: '#FFB800' }]}>■ CMD {mapCmd} kPa</Text>
                            <Text style={[styles.legendItem, { color: '#00FF66' }]}>■ MAF {maf} g/s</Text>
                        </View>

                        {/* Grafic Vectorial SVG */}
                        <View style={styles.scopeSvgWrap}>
                            <Svg width="100%" height={expandedPanel === 2 ? 180 : 54} viewBox="0 0 100 40" preserveAspectRatio="none">
                                <Defs>
                                    <LinearGradient id="scopeGrid" x1="0" y1="0" x2="0" y2="1">
                                        <Stop offset="0" stopColor="#0B1A2E" stopOpacity="0.8" />
                                        <Stop offset="1" stopColor="#050C17" stopOpacity="0.2" />
                                    </LinearGradient>
                                </Defs>
                                <Line x1="0" y1="10" x2="100" y2="10" stroke="#12243D" strokeWidth="0.5" strokeDasharray="2,2" />
                                <Line x1="0" y1="20" x2="100" y2="20" stroke="#12243D" strokeWidth="0.5" strokeDasharray="2,2" />
                                <Line x1="0" y1="30" x2="100" y2="30" stroke="#12243D" strokeWidth="0.5" strokeDasharray="2,2" />

                                {oscilloscopeHistory.length > 1 && (
                                    <>
                                        {/* Curba MAP actual */}
                                        <Polyline
                                            fill="none"
                                            stroke="#00F0FF"
                                            strokeWidth="1.6"
                                            points={oscilloscopeHistory
                                                .map((pt, i) => {
                                                    const x = (i / (oscilloscopeHistory.length - 1)) * 100;
                                                    const y = 38 - Math.min(34, Math.max(2, ((pt.mapAct - 90) / 160) * 36));
                                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                                })
                                                .join(' ')}
                                        />
                                        {/* Curba MAP comandat */}
                                        <Polyline
                                            fill="none"
                                            stroke="#FFB800"
                                            strokeWidth="1.2"
                                            strokeDasharray="2,1"
                                            points={oscilloscopeHistory
                                                .map((pt, i) => {
                                                    const x = (i / (oscilloscopeHistory.length - 1)) * 100;
                                                    const y = 38 - Math.min(34, Math.max(2, ((pt.mapCmd - 90) / 160) * 36));
                                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                                })
                                                .join(' ')}
                                        />
                                    </>
                                )}
                            </Svg>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── MONITOR 3: MATRICEA 3x3 ENGINE DNA ── */}
                {(expandedPanel === null || expandedPanel === 3) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 3 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(3)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M3 // ENGINE DNA (RPM × SARCINĂ)</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 3 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Matricea 3x3 */}
                        <View style={styles.dnaGrid}>
                            {[
                                { rLabel: 'H-RPM', rpmZone: 2 },
                                { rLabel: 'M-RPM', rpmZone: 1 },
                                { rLabel: 'L-RPM', rpmZone: 0 },
                            ].map((row) => (
                                <View key={row.rLabel} style={styles.dnaRow}>
                                    {[0, 1, 2].map((loadZone) => {
                                        const curRpmZone = rpm < 1800 ? 0 : rpm < 3200 ? 1 : 2;
                                        const curLoadZone = load < 30 ? 0 : load < 70 ? 1 : 2;
                                        const isCellActive = curRpmZone === row.rpmZone && curLoadZone === loadZone;

                                        return (
                                            <View
                                                key={loadZone}
                                                style={[
                                                    styles.dnaCell,
                                                    isCellActive && styles.dnaCellActive,
                                                ]}
                                            >
                                                <Text style={[styles.dnaCellText, isCellActive && styles.dnaCellTextActive]}>
                                                    {isCellActive ? '● ON' : '·'}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>

                        {/* Valori cheie BSFC, VE, AFR, Lambda */}
                        <View style={styles.dnaStatsRow}>
                            <Text style={styles.dnaStat}>BSFC: <Text style={{ color: '#00F0FF' }}>{bsfc} g</Text></Text>
                            <Text style={styles.dnaStat}>VE: <Text style={{ color: '#00FF66' }}>{ve}%</Text></Text>
                            <Text style={styles.dnaStat}>AFR: <Text style={{ color: '#FFB800' }}>{afr}</Text></Text>
                            <Text style={styles.dnaStat}>λ: <Text style={{ color: '#FFFFFF' }}>{lambda}</Text></Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── MONITOR 4: BILANȚ SANKEY & TURBO CHRA ── */}
                {(expandedPanel === null || expandedPanel === 4) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 4 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(4)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M4 // BILANȚ SANKEY & TURBO CHRA</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 4 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Tri-Segmented Sankey Bar */}
                        <View style={styles.sankeyBar}>
                            <View style={[styles.sankeySeg, { flex: 36, backgroundColor: '#00FF66' }]} />
                            <View style={[styles.sankeySeg, { flex: 18, backgroundColor: '#FF2A2A' }]} />
                            <View style={[styles.sankeySeg, { flex: 46, backgroundColor: '#00F0FF' }]} />
                        </View>
                        <View style={styles.sankeyLabels}>
                            <Text style={[styles.sankeyLbl, { color: '#00FF66' }]}>36% MECANIC</Text>
                            <Text style={[styles.sankeyLbl, { color: '#FF2A2A' }]}>18% EVACUARE</Text>
                            <Text style={[styles.sankeyLbl, { color: '#00F0FF' }]}>46% RĂCIRE</Text>
                        </View>

                        {/* Turbo CHRA & Intercooler */}
                        <View style={styles.m4BottomRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>T_CHRA MIEZ</Text>
                                <Text style={[styles.statValue, turboCoreTemp > 280 && { color: '#FF2A2A' }]}>
                                    {turboCoreTemp}°C
                                </Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>EFICIENȚĂ IC</Text>
                                <Text style={styles.statValueCyan}>{icEfficiency}%</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>CONDUCTANȚĂ</Text>
                                <Text style={styles.statValueLime}>{coolingCond} kW/K</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── MONITOR 5: RADAR SUPRAVIEȚUIRE WEIBULL & RUL ── */}
                {(expandedPanel === null || expandedPanel === 5) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 5 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(5)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M5 // SUPRAVIEȚUIRE WEIBULL & RUL</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 5 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Bare RUL Componente */}
                        <View style={styles.rulList}>
                            {[
                                { name: 'ULEI', km: minRulKm, color: '#FFB800', pct: 45 },
                                { name: 'DPF', km: 58000, color: '#00FF66', pct: 85 },
                                { name: 'TURBO', km: 25000, color: '#00F0FF', pct: 60 },
                                { name: 'FRÂNE', km: 18000, color: '#FF8800', pct: 50 },
                            ].map((c) => (
                                <View key={c.name} style={styles.rulItem}>
                                    <Text style={styles.rulName}>{c.name}</Text>
                                    <View style={styles.rulTrack}>
                                        <View style={[styles.rulFill, { width: `${c.pct}%`, backgroundColor: c.color }]} />
                                    </View>
                                    <Text style={styles.rulKm}>{c.km} km</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.m5Footer}>
                            <Text style={styles.m5Risk}>
                                RISC PANĂ: <Text style={{ color: roadsideRisk > 30 ? '#FF2A2A' : '#00FF66' }}>{roadsideRisk}%</Text>
                            </Text>
                            <Text style={styles.m5Weakest}>CRITIC: {weakestComp}</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* ── MONITOR 6: TERMINAL LIVE BOSCH UDS & KALMAN ── */}
                {(expandedPanel === null || expandedPanel === 6) && (
                    <TouchableOpacity
                        style={[
                            styles.monitorCard,
                            expandedPanel === 6 ? styles.monitorExpanded : styles.gridItem,
                        ]}
                        onPress={() => togglePanel(6)}
                        activeOpacity={0.9}
                    >
                        <View style={styles.cornerTL} />
                        <View style={styles.cornerBR} />
                        <View style={styles.cardHeaderRow}>
                            <Text style={styles.panelTitle}>M6 // TERMINAL BOSCH UDS & KALMAN</Text>
                            <Text style={styles.tapHint}>{expandedPanel === 6 ? '▼ RESTRÂNGE' : '▲ MĂREȘTE'}</Text>
                        </View>

                        {/* Terminal Log Console */}
                        <View style={styles.terminalBox}>
                            <Text style={styles.terminalLine}>
                                <Text style={styles.tCyan}>[STATE] </Text>{isSteady ? 'STEADY-STATE // LOCKED' : 'TRANSIENT // ADAPTING'}
                            </Text>
                            <Text style={styles.terminalLine}>
                                <Text style={styles.tLime}>[CONF] </Text>{confPct}% KALMAN ESTIMATION
                            </Text>
                            <Text style={styles.terminalLine}>
                                <Text style={styles.tAmber}>[GRIP] </Text>{roadGrip}
                            </Text>
                            <Text style={styles.terminalLine}>
                                <Text style={styles.tWhite}>[FATIGUE] </Text>SCOR ATENȚIE: {fatigue}/100
                            </Text>
                            <Text style={styles.terminalLine}>
                                <Text style={styles.tCyan}>[IDLE-STAB] </Text>INDEX {idleIndex}/10 (DMF OK)
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#030508',
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#101B2B',
        backgroundColor: '#050912',
    },
    brandGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cyberTag: {
        backgroundColor: '#00F0FF18',
        borderWidth: 1,
        borderColor: '#00F0FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 2,
    },
    cyberTagText: {
        color: '#00F0FF',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginLeft: 2,
    },
    vehicleVin: {
        color: '#657795',
        fontSize: 9,
        fontFamily: MONO,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    btnAction: {
        borderWidth: 1,
        borderColor: '#1E2D44',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 3,
        backgroundColor: '#0A121F',
    },
    btnActionText: {
        color: '#8CA0BA',
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    viewportBody: {
        flex: 1,
        padding: 6,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignContent: 'space-between',
    },
    gridItem: {
        width: (SCREEN_WIDTH - 18) / 2,
        height: '32.2%',
        marginBottom: 6,
    },
    monitorExpanded: {
        width: '100%',
        height: '100%',
        zIndex: 10,
    },
    monitorCard: {
        backgroundColor: '#080D16',
        borderWidth: 1.2,
        borderColor: '#16263D',
        borderRadius: 4,
        padding: 8,
        justifyContent: 'space-between',
        position: 'relative',
    },
    cornerTL: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: 5,
        height: 5,
        borderTopWidth: 1.5,
        borderLeftWidth: 1.5,
        borderColor: '#00F0FF',
    },
    cornerBR: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 5,
        height: 5,
        borderBottomWidth: 1.5,
        borderRightWidth: 1.5,
        borderColor: '#00F0FF',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.8,
        borderBottomColor: '#122033',
        paddingBottom: 3,
    },
    panelTitle: {
        color: '#A0B3CC',
        fontSize: 8.5,
        fontFamily: MONO,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    tapHint: {
        color: '#4B5F7A',
        fontSize: 7.5,
        fontFamily: MONO,
    },
    shiftLightBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    shiftLed: {
        flex: 1,
        height: 4,
        marginHorizontal: 1,
        borderRadius: 1,
        borderWidth: 0.5,
    },
    m1ContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    m1Left: {
        alignItems: 'flex-start',
    },
    gearHuge: {
        color: '#00F0FF',
        fontSize: 32,
        fontFamily: MONO,
        fontWeight: '900',
        lineHeight: 34,
    },
    speedSub: {
        color: '#FFFFFF',
        fontSize: 13,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    rpmSub: {
        color: '#00FF66',
        fontSize: 10,
        fontFamily: MONO,
    },
    unitSmall: {
        fontSize: 7.5,
        color: '#657795',
    },
    m1Center: {
        justifyContent: 'center',
        gap: 4,
    },
    statBox: {
        alignItems: 'flex-start',
    },
    statLabel: {
        color: '#556985',
        fontSize: 7,
        fontFamily: MONO,
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    statValueCyan: {
        color: '#00F0FF',
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    statValueLime: {
        color: '#00FF66',
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    m1Right: {
        alignItems: 'center',
    },
    gForceText: {
        color: '#00F0FF',
        fontSize: 8,
        fontFamily: MONO,
        marginTop: 2,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 2,
    },
    legendItem: {
        fontSize: 7.5,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    scopeSvgWrap: {
        backgroundColor: '#050A12',
        borderWidth: 0.8,
        borderColor: '#132136',
        borderRadius: 2,
        padding: 2,
        overflow: 'hidden',
    },
    dnaGrid: {
        marginVertical: 2,
        gap: 2,
    },
    dnaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 2,
    },
    dnaCell: {
        flex: 1,
        height: 14,
        backgroundColor: '#060B14',
        borderWidth: 0.6,
        borderColor: '#132238',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dnaCellActive: {
        backgroundColor: '#00F0FF22',
        borderColor: '#00F0FF',
    },
    dnaCellText: {
        color: '#283B54',
        fontSize: 8,
        fontFamily: MONO,
    },
    dnaCellTextActive: {
        color: '#00F0FF',
        fontWeight: 'bold',
    },
    dnaStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 0.6,
        borderTopColor: '#122033',
        paddingTop: 3,
    },
    dnaStat: {
        color: '#657795',
        fontSize: 7.5,
        fontFamily: MONO,
    },
    sankeyBar: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 2,
        overflow: 'hidden',
        marginVertical: 4,
    },
    sankeySeg: {
        height: '100%',
    },
    sankeyLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    sankeyLbl: {
        fontSize: 7,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    m4BottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rulList: {
        gap: 2,
        marginVertical: 2,
    },
    rulItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    rulName: {
        color: '#7185A0',
        fontSize: 7,
        fontFamily: MONO,
        width: 32,
    },
    rulTrack: {
        flex: 1,
        height: 4,
        backgroundColor: '#0C1624',
        borderRadius: 1,
        overflow: 'hidden',
    },
    rulFill: {
        height: '100%',
    },
    rulKm: {
        color: '#A0B3CC',
        fontSize: 7,
        fontFamily: MONO,
        width: 44,
        textAlign: 'right',
    },
    m5Footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 0.6,
        borderTopColor: '#122033',
        paddingTop: 3,
    },
    m5Risk: {
        color: '#657795',
        fontSize: 7.5,
        fontFamily: MONO,
    },
    m5Weakest: {
        color: '#FFB800',
        fontSize: 7.5,
        fontFamily: MONO,
        fontWeight: 'bold',
    },
    terminalBox: {
        backgroundColor: '#020407',
        borderWidth: 0.8,
        borderColor: '#101B2B',
        borderRadius: 2,
        padding: 4,
        gap: 2,
    },
    terminalLine: {
        color: '#90A3BE',
        fontSize: 7.5,
        fontFamily: MONO,
    },
    tCyan: { color: '#00F0FF', fontWeight: 'bold' },
    tLime: { color: '#00FF66', fontWeight: 'bold' },
    tAmber: { color: '#FFB800', fontWeight: 'bold' },
    tWhite: { color: '#FFFFFF', fontWeight: 'bold' },
});
