import React, { useState, useContext, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import Svg, { Rect, Path, Circle, Line, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useUiParadigm } from '../../context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RETRO_FONT = Platform.OS === 'ios' ? 'Courier' : 'monospace';

// 25-block stepped diagonal LED tachometer
function AudiTachometerBargraph({ rpm = 800, maxRpm = 6500, width = SCREEN_WIDTH - 40 }) {
    const totalBlocks = 25;
    const clampedRpm = Math.min(Math.max(rpm, 0), maxRpm);
    const activeBlocksCount = Math.round((clampedRpm / maxRpm) * totalBlocks);

    const blockWidth = Math.max((width - 60) / totalBlocks, 6);
    const blockGap = 2.5;

    return (
        <View style={styles.tachoWrapper}>
            <View style={styles.tachoHeader}>
                <Text style={styles.tachoLabel}>DREHZAHL // x1000 min⁻¹</Text>
                <Text style={styles.tachoValue}>{(rpm / 1000).toFixed(1)} <Text style={styles.tachoUnit}>RPM</Text></Text>
            </View>

            <Svg width={width} height={38} viewBox={`0 0 ${width} 38`}>
                <Defs>
                    <LinearGradient id="amberGlow" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#FFB300" stopOpacity="1" />
                        <Stop offset="1" stopColor="#FF6600" stopOpacity="1" />
                    </LinearGradient>
                </Defs>

                {Array.from({ length: totalBlocks }).map((_, i) => {
                    const isActive = i < activeBlocksCount;
                    const x = i * (blockWidth + blockGap) + 10;
                    // Stepped diagonal height (taller as RPM increases)
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
                            stroke={isActive ? (i >= 21 ? '#FF6644' : '#FFAA33') : '#120502'}
                            strokeWidth={isActive ? 0.8 : 0.5}
                        />
                    );
                })}

                {/* Scale markers */}
                <Line x1="10" y1="36" x2={width - 20} y2="36" stroke="#4A180C" strokeWidth="1" />
                <SvgText x="12" y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>0</SvgText>
                <SvgText x={width * 0.3} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>2</SvgText>
                <SvgText x={width * 0.58} y="32" fill="#884422" fontSize="7" fontFamily={RETRO_FONT}>4</SvgText>
                <SvgText x={width * 0.82} y="32" fill="#FF4422" fontSize="7" fontFamily={RETRO_FONT}>6</SvgText>
            </Svg>
        </View>
    );
}

// Vertical LED Segment Column (Coolant, Oil, Boost)
function VerticalLedColumn({ label, value, unit, min, max, warnThreshold, critThreshold, color = '#FF8800' }) {
    const totalSegments = 10;
    const val = Number(value) || 0;
    const ratio = Math.min(Math.max((val - min) / (max - min), 0), 1);
    const litCount = Math.round(ratio * totalSegments);

    const isCrit = critThreshold && val >= critThreshold;
    const isWarn = warnThreshold && val >= warnThreshold;
    const activeColor = isCrit ? '#FF3300' : isWarn ? '#FFAA00' : color;

    return (
        <View style={styles.verticalCol}>
            <Text style={styles.verticalColLabel}>{label}</Text>
            <View style={styles.verticalBarFrame}>
                {Array.from({ length: totalSegments }).map((_, i) => {
                    const segIndex = totalSegments - 1 - i; // top is max
                    const isLit = segIndex < litCount;
                    return (
                        <View
                            key={i}
                            style={[
                                styles.verticalSegment,
                                {
                                    backgroundColor: isLit ? activeColor : '#170603',
                                    borderColor: isLit ? activeColor : '#2A0E08',
                                },
                            ]}
                        />
                    );
                })}
            </View>
            <Text style={[styles.verticalColValue, isCrit && { color: '#FF3300' }]}>
                {val} <Text style={styles.verticalColUnit}>{unit}</Text>
            </Text>
        </View>
    );
}

export default function RetroAudi96Paradigm() {
    const { liveData, isConnected } = useContext(LiveContext);
    const { activeVehicle } = useVehicle();
    const { setUiParadigm, openExperiencePicker } = useUiParadigm();

    // Stare bordcomputer cycler (Bordcomputer Modus)
    const [bcModeIndex, setBcModeIndex] = useState(0);
    const [showDiagPanel, setShowDiagPanel] = useState(false);

    // Date telemetrie extrase
    const speed = Math.round(Number(liveData?.viteza_kmh ?? liveData?.viteza ?? 0));
    const rpm = Math.round(Number(liveData?.turatie_rpm ?? liveData?.turatie ?? 0));
    const boost = Number(liveData?.presiune_turbo_bar ?? liveData?.turbo_boost_bar ?? 0).toFixed(2);
    const coolant = Math.round(Number(liveData?.temperatura_antigel ?? liveData?.temp_antigel ?? 0));
    const oilTemp = Math.round(Number(liveData?.temperatura_ulei ?? liveData?.temp_ulei ?? 0));
    const voltage = Number(liveData?.tensiune_baterie ?? liveData?.tensiune ?? 0).toFixed(1);
    const consumption = Number(liveData?.consum_instant ?? liveData?.consum_l_100km ?? 0).toFixed(1);
    const tripKm = Number(liveData?.distanta_km ?? 14.8).toFixed(1);
    const totalOdo = activeVehicle?.odometru_calibrat_km
        ? Math.round(activeVehicle.odometru_calibrat_km + Number(liveData?.distanta_km || 0))
        : 248312;

    // Modele fizice
    const fizica = liveData?.fizica || {};
    const oilWear = Math.round(Number(fizica?.uzura_ulei_pct ?? 18));
    const brakeTemp = Math.round(Number(fizica?.temp_frane_c ?? 110));
    const batterySoh = Math.round(Number(fizica?.baterie_soh_pct ?? 94));

    // Moduri Bordcomputer 1996
    const bcModes = [
        { label: 'MOMENTANVERBRAUCH', val: `${consumption} L/100`, hint: 'Consum Instantaneu' },
        { label: 'REICHWEITE', val: `${Math.round(480 - Number(tripKm) * 0.8)} KM`, hint: 'Autonomie Estimat' },
        { label: 'FAHRZEIT', val: '00:24 H', hint: 'Timp Sesiune' },
        { label: 'D-GESCHWINDIGKEIT', val: `${Math.max(speed - 6, 42)} KM/H`, hint: 'Viteză Medie' },
        { label: 'BATTERIESPANNUNG', val: `${voltage} V`, hint: 'Tensiune Rețea' },
    ];

    const currentBc = bcModes[bcModeIndex % bcModes.length];

    // Detecție atenționare Auto-Check System
    const autoCheckStatus = useMemo(() => {
        if (!isConnected) return { ok: false, sym: '⚡', text: 'KEIN SIGNAL', de: 'Conexiune întreruptă' };
        if (fizica?.turbo_surge_risc) return { ok: false, sym: '▲', text: 'LADEDRUCK', de: 'Risc Turbo Surge' };
        if (fizica?.black_ice_risc) return { ok: false, sym: '❄', text: 'GLATTEIS', de: 'Atenție Polei 0°C' };
        if (coolant > 105) return { ok: false, sym: '♨', text: 'KÜHLMITTEL', de: 'Temperatură Antigel Ridicată' };
        if (oilTemp > 130) return { ok: false, sym: '🛢', text: 'ÖLDRUCK', de: 'Temperatură Ulei Critică' };
        if (voltage < 12.0 && voltage > 0) return { ok: false, sym: '⚡', text: 'GENERATOR', de: 'Alternator / Baterie Slabă' };
        return { ok: true, sym: 'OK', text: 'SYSTEM OK', de: 'Toate sistemele nominale' };
    }, [isConnected, fizica, coolant, oilTemp, voltage]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#080302" />

            {/* ── Bezel Header Superior ── */}
            <View style={styles.bezelHeader}>
                <View style={styles.audiLogoRow}>
                    {/* Emblemă 4 Inele Audi stilizate */}
                    <Svg width={48} height={16} viewBox="0 0 48 16">
                        <Circle cx="8" cy="8" r="6" fill="none" stroke="#FF8800" strokeWidth="1.2" />
                        <Circle cx="18" cy="8" r="6" fill="none" stroke="#FF8800" strokeWidth="1.2" />
                        <Circle cx="28" cy="8" r="6" fill="none" stroke="#FF8800" strokeWidth="1.2" />
                        <Circle cx="38" cy="8" r="6" fill="none" stroke="#FF8800" strokeWidth="1.2" />
                    </Svg>
                    <Text style={styles.audiHeaderText}>DIGIFIZ VFD // C4 1996</Text>
                </View>

                {/* Acțiuni de salvare / schimbare stil */}
                <View style={styles.headerBtnGroup}>
                    <TouchableOpacity
                        style={styles.bezelBtnV2}
                        onPress={() => setUiParadigm('CLASSIC_V2')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.bezelBtnV2Text}>⮌ CLASIC V2</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.bezelBtnStyle}
                        onPress={openExperiencePicker}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.bezelBtnStyleText}>[ 🎨 STIL ]</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Instrument Cluster Principal (Bord Digifiz) ── */}
                <View style={styles.clusterFrame}>
                    {/* 1. Turometru LED în 25 blocuri în trepte */}
                    <AudiTachometerBargraph rpm={rpm} maxRpm={6500} width={SCREEN_WIDTH - 48} />

                    {/* 2. Zona centrală VFD: Vitezometru + Auto-Check Matrix */}
                    <View style={styles.centerVfdRow}>
                        {/* Coloana Stânga: Vitezometru 7-Segment + Odometre */}
                        <View style={styles.speedModule}>
                            <Text style={styles.moduleSub}>GESCHWINDIGKEIT</Text>
                            <View style={styles.speedDigitalRow}>
                                <Text style={styles.speedDigital}>{speed}</Text>
                                <Text style={styles.speedUnitText}>km/h</Text>
                            </View>

                            <View style={styles.odometerBox}>
                                <Text style={styles.odoText}>
                                    ODO: {totalOdo.toLocaleString('de-DE')} km
                                </Text>
                                <Text style={styles.tripText}>
                                    TRIP: {tripKm} km
                                </Text>
                            </View>
                        </View>

                        {/* Coloana Dreapta: Audi Auto-Check System Matrix */}
                        <View style={styles.autoCheckModule}>
                            <Text style={styles.moduleSub}>AUTO-CHECK SYSTEM</Text>
                            <View style={[
                                styles.autoCheckScreen,
                                !autoCheckStatus.ok && styles.autoCheckScreenAlert,
                            ]}>
                                <View style={[
                                    styles.autoCheckCircle,
                                    !autoCheckStatus.ok && { borderColor: '#FF3300' },
                                ]}>
                                    <Text style={[
                                        styles.autoCheckSym,
                                        !autoCheckStatus.ok && { color: '#FF3300' },
                                    ]}>
                                        {autoCheckStatus.sym}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.autoCheckText,
                                    !autoCheckStatus.ok && { color: '#FF3300' },
                                ]}>
                                    {autoCheckStatus.text}
                                </Text>
                                <Text style={styles.autoCheckSub}>{autoCheckStatus.de}</Text>
                            </View>
                        </View>
                    </View>

                    {/* 3. Coloane Segmentate Verticale (Kühlmittel, Öltemp, Ladedruck) */}
                    <View style={styles.verticalIndicatorsRow}>
                        <VerticalLedColumn
                            label="KÜHLMITTEL"
                            value={coolant}
                            unit="°C"
                            min={40}
                            max={120}
                            warnThreshold={95}
                            critThreshold={105}
                            color="#00FF66"
                        />
                        <VerticalLedColumn
                            label="ÖLTEMPERATUR"
                            value={oilTemp > 0 ? oilTemp : 90}
                            unit="°C"
                            min={60}
                            max={150}
                            warnThreshold={120}
                            critThreshold={135}
                            color="#FF8800"
                        />
                        <VerticalLedColumn
                            label="LADEDRUCK"
                            value={boost}
                            unit="BAR"
                            min={0.0}
                            max={2.5}
                            warnThreshold={1.8}
                            critThreshold={2.2}
                            color="#FF8800"
                        />
                    </View>
                </View>

                {/* ── Bordcomputer 1996 Display Central ── */}
                <View style={styles.bordcomputerFrame}>
                    <View style={styles.bcHeader}>
                        <Text style={styles.bcTitle}>BORDCOMPUTER // C4</Text>
                        <Text style={styles.bcSubHint}>{currentBc.hint}</Text>
                    </View>
                    <View style={styles.bcScreen}>
                        <Text style={styles.bcLabel}>{currentBc.label}</Text>
                        <Text style={styles.bcValue}>{currentBc.val}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.bcCycleBtn}
                        onPress={() => setBcModeIndex(prev => prev + 1)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.bcCycleBtnText}>SCHALTE PARAMETER (COMUTĂ DATE) ➜</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Panou Diagnostic Avansat (Opțional la comutator) ── */}
                {showDiagPanel && (
                    <View style={styles.diagPanel}>
                        <Text style={styles.diagTitle}>// DIAGNOSE & PHYSIK-SPEICHER (32 OBS.)</Text>
                        <View style={styles.diagRow}>
                            <Text style={styles.diagKey}>ÖLVERSCHLEISS (UZURĂ ULEI):</Text>
                            <Text style={styles.diagVal}>{oilWear}%</Text>
                        </View>
                        <View style={styles.diagRow}>
                            <Text style={styles.diagKey}>BREMSE-TEMPERATUR (FRÂNE):</Text>
                            <Text style={styles.diagVal}>{brakeTemp}°C</Text>
                        </View>
                        <View style={styles.diagRow}>
                            <Text style={styles.diagKey}>BATTERIE-ZUSTAND (SOH):</Text>
                            <Text style={styles.diagVal}>{batterySoh}%</Text>
                        </View>
                        <View style={styles.diagRow}>
                            <Text style={styles.diagKey}>TURBO-SICHERHEIT (SURGE):</Text>
                            <Text style={[styles.diagVal, { color: fizica?.turbo_surge_risc ? '#FF3300' : '#00FF66' }]}>
                                {fizica?.turbo_surge_risc ? 'RISC' : 'SICHER'}
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── 5 Tactile 3D Rocker Switches (Bottom Console 1996) ── */}
            <View style={styles.bottomConsole}>
                <TouchableOpacity
                    style={styles.rockerSwitch}
                    onPress={() => setBcModeIndex(prev => prev + 1)}
                    activeOpacity={0.75}
                >
                    <View style={styles.rockerIllumination} />
                    <Text style={styles.rockerText}>AUTO-CHECK</Text>
                    <Text style={styles.rockerSub}>MODE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.rockerSwitch}
                    onPress={() => setBcModeIndex(prev => prev + 1)}
                    activeOpacity={0.75}
                >
                    <View style={styles.rockerIllumination} />
                    <Text style={styles.rockerText}>BORDCOMP.</Text>
                    <Text style={styles.rockerSub}>WECHSEL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.rockerSwitch}
                    onPress={() => setShowDiagPanel(prev => !prev)}
                    activeOpacity={0.75}
                >
                    <View style={[styles.rockerIllumination, showDiagPanel && { backgroundColor: '#00FF66' }]} />
                    <Text style={styles.rockerText}>DIAGNOSE</Text>
                    <Text style={styles.rockerSub}>{showDiagPanel ? 'OFF' : 'ON'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.rockerSwitch}
                    onPress={openExperiencePicker}
                    activeOpacity={0.75}
                >
                    <View style={[styles.rockerIllumination, { backgroundColor: '#FF8800' }]} />
                    <Text style={styles.rockerText}>🎨 STIL</Text>
                    <Text style={styles.rockerSub}>PARADIGMĂ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.rockerSwitch, styles.rockerSwitchExit]}
                    onPress={() => setUiParadigm('CLASSIC_V2')}
                    activeOpacity={0.75}
                >
                    <View style={[styles.rockerIllumination, { backgroundColor: '#00E5FF' }]} />
                    <Text style={[styles.rockerText, { color: '#00E5FF' }]}>V2 CLASIC</Text>
                    <Text style={styles.rockerSub}>RESTORE</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#080302',
        paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 20,
    },
    bezelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#140603',
        borderBottomWidth: 2,
        borderBottomColor: '#2A0E08',
    },
    audiLogoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    audiHeaderText: {
        color: '#FF8800',
        fontSize: 11,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    headerBtnGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bezelBtnV2: {
        backgroundColor: '#1E0A05',
        borderWidth: 1,
        borderColor: '#4A180C',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
    },
    bezelBtnV2Text: {
        color: '#A08070',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    bezelBtnStyle: {
        backgroundColor: '#FF880020',
        borderWidth: 1,
        borderColor: '#FF8800',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 3,
    },
    bezelBtnStyleText: {
        color: '#FF8800',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    clusterFrame: {
        backgroundColor: '#100402',
        borderWidth: 2,
        borderColor: '#38130B',
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
        shadowColor: '#FF6600',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    tachoWrapper: {
        marginBottom: 14,
    },
    tachoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        paddingHorizontal: 4,
    },
    tachoLabel: {
        color: '#AA4422',
        fontSize: 9,
        fontFamily: RETRO_FONT,
        letterSpacing: 1,
    },
    tachoValue: {
        color: '#FF8800',
        fontSize: 12,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    tachoUnit: {
        color: '#884422',
        fontSize: 9,
    },
    centerVfdRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    speedModule: {
        flex: 1.1,
        backgroundColor: '#180704',
        borderWidth: 1,
        borderColor: '#38130B',
        borderRadius: 6,
        padding: 10,
        alignItems: 'center',
    },
    moduleSub: {
        color: '#AA4422',
        fontSize: 8,
        fontFamily: RETRO_FONT,
        letterSpacing: 1,
        marginBottom: 4,
    },
    speedDigitalRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 4,
    },
    speedDigital: {
        color: '#FF8800',
        fontSize: 54,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: -1,
    },
    speedUnitText: {
        color: '#AA4422',
        fontSize: 12,
        fontFamily: RETRO_FONT,
        marginLeft: 4,
    },
    odometerBox: {
        borderTopWidth: 1,
        borderTopColor: '#2A0E08',
        paddingTop: 6,
        marginTop: 4,
        width: '100%',
        alignItems: 'center',
    },
    odoText: {
        color: '#FF8800',
        fontSize: 9,
        fontFamily: RETRO_FONT,
    },
    tripText: {
        color: '#AA5533',
        fontSize: 9,
        fontFamily: RETRO_FONT,
        marginTop: 2,
    },
    autoCheckModule: {
        flex: 1,
        backgroundColor: '#180704',
        borderWidth: 1,
        borderColor: '#38130B',
        borderRadius: 6,
        padding: 10,
        alignItems: 'center',
    },
    autoCheckScreen: {
        flex: 1,
        width: '100%',
        backgroundColor: '#0A0301',
        borderWidth: 1,
        borderColor: '#FF8800',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        marginTop: 4,
    },
    autoCheckScreenAlert: {
        borderColor: '#FF3300',
        backgroundColor: '#200502',
    },
    autoCheckCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#FF8800',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    autoCheckSym: {
        color: '#FF8800',
        fontSize: 12,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    autoCheckText: {
        color: '#FF8800',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    autoCheckSub: {
        color: '#884422',
        fontSize: 8,
        fontFamily: RETRO_FONT,
        textAlign: 'center',
        marginTop: 2,
        paddingHorizontal: 4,
    },
    verticalIndicatorsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#150503',
        borderWidth: 1,
        borderColor: '#2D0F08',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    verticalCol: {
        alignItems: 'center',
        width: 72,
    },
    verticalColLabel: {
        color: '#884422',
        fontSize: 7.5,
        fontFamily: RETRO_FONT,
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    verticalBarFrame: {
        width: 22,
        height: 72,
        backgroundColor: '#0A0301',
        borderWidth: 1,
        borderColor: '#260B05',
        borderRadius: 3,
        padding: 2,
        justifyContent: 'space-between',
    },
    verticalSegment: {
        width: '100%',
        height: 5,
        borderRadius: 1,
        borderWidth: 0.5,
    },
    verticalColValue: {
        color: '#FF8800',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        marginTop: 6,
    },
    verticalColUnit: {
        color: '#884422',
        fontSize: 8,
    },
    bordcomputerFrame: {
        backgroundColor: '#120503',
        borderWidth: 1.5,
        borderColor: '#38130B',
        borderRadius: 8,
        padding: 12,
        marginBottom: 14,
    },
    bcHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    bcTitle: {
        color: '#FF8800',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    bcSubHint: {
        color: '#884422',
        fontSize: 9,
        fontFamily: RETRO_FONT,
    },
    bcScreen: {
        backgroundColor: '#0A0301',
        borderWidth: 1,
        borderColor: '#FF8800',
        borderRadius: 4,
        padding: 12,
        alignItems: 'center',
    },
    bcLabel: {
        color: '#884422',
        fontSize: 9,
        fontFamily: RETRO_FONT,
        letterSpacing: 1,
        marginBottom: 4,
    },
    bcValue: {
        color: '#FF8800',
        fontSize: 24,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    bcCycleBtn: {
        marginTop: 8,
        paddingVertical: 6,
        alignItems: 'center',
        backgroundColor: '#1C0804',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#3A1208',
    },
    bcCycleBtnText: {
        color: '#FF8800',
        fontSize: 9,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    diagPanel: {
        backgroundColor: '#150603',
        borderWidth: 1,
        borderColor: '#4A180C',
        borderRadius: 6,
        padding: 12,
        marginBottom: 14,
    },
    diagTitle: {
        color: '#FF8800',
        fontSize: 9,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    diagRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#260B05',
    },
    diagKey: {
        color: '#884422',
        fontSize: 9,
        fontFamily: RETRO_FONT,
    },
    diagVal: {
        color: '#FF8800',
        fontSize: 10,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    bottomConsole: {
        flexDirection: 'row',
        backgroundColor: '#0D0402',
        borderTopWidth: 2,
        borderTopColor: '#2A0E08',
        paddingVertical: 8,
        paddingHorizontal: 4,
        gap: 4,
    },
    rockerSwitch: {
        flex: 1,
        backgroundColor: '#1A0805',
        borderWidth: 1.5,
        borderColor: '#3D150B',
        borderRadius: 4,
        paddingVertical: 6,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 3,
    },
    rockerSwitchExit: {
        borderColor: '#00E5FF44',
    },
    rockerIllumination: {
        width: 10,
        height: 3,
        backgroundColor: '#FF3300',
        borderRadius: 1,
        marginBottom: 4,
    },
    rockerText: {
        color: '#E0A080',
        fontSize: 8.5,
        fontFamily: RETRO_FONT,
        fontWeight: 'bold',
    },
    rockerSub: {
        color: '#6E3220',
        fontSize: 6.5,
        fontFamily: RETRO_FONT,
        marginTop: 2,
    },
});
