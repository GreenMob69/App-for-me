'use strict';
import React, { useContext, useState, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    useWindowDimensions, Modal, Platform, StatusBar, PanResponder,
    Animated,
} from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { LiveContext }  from '../context/LiveContext';
import { AlertContext } from '../context/AlertContext';
import { AppContext }   from '../context/AppContext';
import { getVehicleLabel } from '../utils/config';
import RecommendationCard from '../components/ui/RecommendationCard';
import { colors, typography, radii, spacing, layout } from '../theme';
import { useSmoothedTelemetry } from '../hooks/useSmoothedTelemetry';

// ─── AI assistant ─────────────────────────────────────────────────────────────

function buildAssistantMsg(liveData, isConnected) {
    if (!isConnected) return { text: 'Aștept conexiunea. Pornește vehiculul sau verifică conexiunea.', level: 'neutral' };
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const rpm     = liveData.motor?.rpm ?? 0;
    const speed   = liveData.motor?.speed ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;
    const cons    = liveData.combustibil?.inst_cons ?? 0;
    const dpfRgn  = liveData.dpf?.regen_status;

    const v       = liveData.virtual || {};
    if (v.dpfRegenActive) return { text: v.dpfRegenNotice || 'Regenerare DPF în curs! Menține motorul pornit.', level: 'warning' };
    if (v.rollingDragAnomaly) return { text: 'Rezistență anormală la rulare (posibil etrier frână blocat).', level: 'warning' };
    if (coolant > 105) return { text: 'Temperatura motorului este critică. Recomand oprirea imediată.', level: 'critical' };
    if (coolant > 95)  return { text: 'Temperatura motorului este ridicată. Dacă continuă să crească, oprește motorul.', level: 'serious' };
    if (volt > 0 && volt < 13.0) return { text: 'Tensiunea de la alternator este scăzută. Posibilă problemă electrică.', level: 'warning' };
    if (volt > 0 && volt < 13.5) return { text: 'Tensiunea alternatorului este ușor sub valoarea obișnuită.', level: 'info' };
    if (dpfRgn === 'ACTIVE' || dpfRgn === 'ON') return { text: 'Regenerare DPF activă. Drumul lung ajută la eficiența filtrului.', level: 'info' };
    if (cons > 15 && speed > 5)  return { text: 'Consum instant ridicat. Menține o viteză constantă pentru eficiență.', level: 'info' };
    if (rpm > 3800 && speed > 0) return { text: 'Turație ridicată. Schimbă la o treaptă superioară.', level: 'info' };
    if (speed === 0 && rpm > 500) return { text: 'Motor în ralanti. Temperaturi și presiuni stabile.', level: 'normal' };
    if (speed > 0 && coolant >= 75 && coolant <= 95) return { text: 'Motorul funcționează la temperatura optimă.', level: 'normal' };
    if (speed > 0) return { text: 'Motorul funcționează normal.', level: 'normal' };
    return { text: 'Nu am observat nimic neobișnuit.', level: 'normal' };
}

function buildContextualAlert(liveData, latestAlert) {
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;
    const v       = liveData.virtual || {};

    if (v.dpfRegenActive) {
        return {
            title: '🔥 Regenerare Activă DPF',
            description: v.dpfRegenNotice || 'Temperatura filtrului >550°C. Nu opri motorul în următoarele minute!',
            priority: 'high'
        };
    }
    if (v.rollingDragAnomaly) {
        return {
            title: '⚠️ Rezistență la Rulare Depășită',
            description: 'Decelerare anormală în coast-down (etrier de frână blocat sau pană de cauciuc).',
            priority: 'high'
        };
    }
    if (coolant > 105) return { title: 'Supraîncălzire critică', description: 'Temperatura motorului depășește 105°C. Oprește motorul și verifică lichidul de răcire.', priority: 'critical' };
    if (coolant > 95)  return { title: 'Temperatură motor ridicată', description: `Temperatura actuală: ${coolant}°C. Dacă continuă să crească, oprește motorul.`, priority: 'high' };
    if (volt > 0 && volt < 13.0) return { title: 'Tensiune scăzută', description: `Tensiunea de încărcare: ${volt.toFixed(1)}V. Posibilă problemă cu alternatorul sau bateria.`, priority: 'high' };
    if (latestAlert) {
        const TIP = { OVERSPEED: `Viteză excesivă${latestAlert.viteza ? ` — ${Math.round(latestAlert.viteza)} km/h` : ''}`, FRANARE_BRUSCA: 'Frânare bruscă detectată', DTC_DETECTAT: `Cod DTC: ${latestAlert.cod || ''}` };
        return { title: TIP[latestAlert.tip] || (latestAlert.tip || 'Eveniment').replace(/_/g, ' '), description: `Eco Score: ${latestAlert.scor_curent ?? '—'}/100`, priority: 'medium' };
    }
    return null;
}

// ─── Params data ──────────────────────────────────────────────────────────────

const PARAM_CATEGORIES = [
    { id: 'MOTOR',   label: 'Motor'   },
    { id: 'VIRTUAL', label: 'Virtual' },
    { id: 'TEMP',    label: 'Temp'    },
    { id: 'AER',     label: 'Aer'     },
    { id: 'COMB',    label: 'Carb'    },
    { id: 'LAMBDA',  label: 'O₂'      },
    { id: 'EMISII',  label: 'DPF'     },
    { id: 'TRANS',   label: 'Trans'   },
    { id: 'ECU',     label: 'ECU'     },
];

function buildParams(cat, d) {
    const m    = d.motor        || {};
    const tem  = d.temperaturi  || {};
    const a    = d.aer          || {};
    const c    = d.combustibil  || {};
    const lam  = d.lambda       || {};
    const ign  = d.aprindere    || {};
    const em   = d.emisii       || {};
    const bat  = d.baterie      || {};
    const dpf  = d.dpf          || {};
    const vvt  = d.vvt          || {};
    const tr   = d.transmisie   || {};
    const pr   = d.presiuni     || {};
    const tim  = d.timp         || {};
    const meta = d.consum_meta  || {};
    const v    = d.virtual      || {};

    switch (cat) {
        case 'MOTOR': return [
            { label: 'RPM',           val: m.rpm || 0,             unit: 'RPM',  max: 5000, color: colors.accent.default },
            { label: 'Viteză',        val: m.speed || 0,           unit: 'km/h', max: 220,  color: colors.status.good },
            { label: 'Sarcină',       val: m.load || 0,            unit: '%',    max: 100 },
            { label: 'Clapetă',       val: m.throttle_pos || 0,    unit: '%',    max: 100,  color: colors.accent.default },
            { label: 'Pedală',        val: m.pedal_d || 0,         unit: '%',    max: 100,  color: colors.status.monitor },
            { label: 'Cuplu Motor',   val: m.torque_engine || 0,   unit: 'Nm',   max: 400,  color: colors.status.good },
            { label: 'Cuplu Cerut',   val: m.torque_driver || 0,   unit: 'Nm',   max: 400,  color: colors.status.monitor },
            { label: 'Cuplu Frecare', val: m.torque_friction || 0, unit: 'Nm',   max: 100,  color: colors.status.critical },
        ];
        case 'VIRTUAL': return [
            { label: 'Putere Dyno',       val: v.powerHp || 0,                 unit: 'CP',    max: 150,  color: colors.status.good },
            { label: 'Cuplu Dyno',        val: v.torqueNm || 0,                unit: 'Nm',    max: 350,  color: colors.status.good },
            { label: 'Consum Spec. BSFC', val: v.bsfcGPerKwh || 0,             unit: 'g/kWh', max: 450,  color: (v.bsfcGPerKwh||0) > 300 ? colors.status.caution : colors.status.good },
            { label: 'Eficiență Volum.',  val: v.volumetricEfficiencyPct || 0, unit: '%',     max: 120,  color: colors.accent.default },
            { label: 'Lambda Virtual',    val: v.lambda ? v.lambda.toFixed(2) : 1, unit: 'λ',  max: 2,    color: colors.status.good },
            { label: 'AFR Real',          val: v.afr ? v.afr.toFixed(1) : 14.5, unit: ':1',   max: 25,   color: colors.status.monitor },
            { label: 'Uzură Ulei Index',  val: v.oilLifeWearFactor || 1,       unit: 'x',     max: 4,    color: (v.oilLifeWearFactor||1) > 2.0 ? colors.status.critical : colors.status.good },
            { label: 'Pantă Drum',        val: v.roadGradePct || 0,            unit: '%',     max: 20,   color: colors.accent.default },
            { label: 'Sănătate Baterie',  val: v.batterySoHPct || 100,         unit: '%',     max: 100,  color: (v.batterySoHPct||100) < 70 ? colors.status.caution : colors.status.good },
            { label: 'Rezistență Bat.',   val: v.batteryInternalResistanceMOhms || 0, unit: 'mΩ', max: 20, color: (v.batteryInternalResistanceMOhms||0) > 10 ? colors.status.critical : colors.status.good },
            { label: 'Disipare Frâne',    val: v.brakeEnergyTripMj || 0,       unit: 'MJ',    max: 30,   color: colors.status.monitor },
            { label: 'Recirculare EGR',   val: v.egrRatioPct || 0,             unit: '%',     max: 60,   color: colors.accent.default },
            { label: 'Pres. Rail Țintă',  val: v.railPressTargetBar || 0,      unit: 'bar',   max: 1600, color: colors.status.monitor },
            { label: 'Alunecare Ambreiaj',val: v.clutchSlipPct || 0,           unit: '%',     max: 100,  color: (v.clutchSlipPct||0) > 10 ? colors.status.critical : colors.status.good },
            { label: 'Rezistență DPF',    val: v.dpfResistanceIndex || 0,      unit: 'idx',   max: 200,  color: colors.status.monitor },
            { label: 'Delta Ulei-Apă',    val: v.deltaOilWaterC || 0,          unit: '°C',    max: 40,   color: (v.deltaOilWaterC||0) > 22 ? colors.status.caution : colors.status.good },
            { label: 'Cădere Tensiune',   val: v.voltageDropV || 0,            unit: 'V',     max: 2,    color: (v.voltageDropV||0) > 0.4 ? colors.status.caution : colors.status.good },
            { label: 'Eroare Boost',      val: v.boostErrorKpa || 0,           unit: 'kPa',   max: 100,  color: colors.accent.default },
        ];
        case 'TEMP': return [
            { label: 'Lichid Răcire', val: tem.coolant || 0,  unit: '°C', max: 110, color: (tem.coolant||0)>95 ? colors.status.critical : colors.status.good },
            { label: 'Admisie IAT',   val: tem.iat || 0,      unit: '°C', max: 80,  color: colors.accent.default },
            { label: 'Ambient',       val: tem.ambient || 0,  unit: '°C', max: 50 },
            { label: 'Ulei Motor',    val: tem.oil || 0,      unit: '°C', max: 130, color: colors.status.monitor },
            { label: 'Cat. B1S1',     val: tem.cat_b1s1 || 0, unit: '°C', max: 800, color: colors.status.critical },
            { label: 'Cat. B1S2',     val: tem.cat_b1s2 || 0, unit: '°C', max: 800, color: colors.status.critical },
        ];
        case 'AER': return [
            { label: 'MAF Debit',     val: a.maf || 0,         unit: 'g/s', max: 150, color: colors.status.monitor },
            { label: 'MAP Presiune',  val: a.map || 101,       unit: 'kPa', max: 300, color: colors.accent.default },
            { label: 'Barometric',    val: a.baro || 101,      unit: 'kPa', max: 110 },
            { label: 'Boost Cmd.',    val: a.boost_cmd || 0,   unit: 'bar', max: 2.5, color: colors.status.monitor },
            { label: 'Boost Eff.',    val: a.boost_actual || 0,unit: 'bar', max: 2.5, color: colors.status.good },
        ];
        case 'COMB': return [
            { label: 'Nivel Carb.',   val: c.level || 0,      unit: '%',       max: 100, color: colors.status.good },
            { label: 'Presiune Rail', val: c.rail_press || 0, unit: 'kPa',     max: 40000, color: colors.status.monitor },
            { label: 'Timing Inj.',   val: c.inj_timing || 0, unit: '°',       max: 30 },
            { label: 'Cant. Inj.',    val: c.inj_qty || 0,    unit: 'mg/crs',  max: 60,  color: colors.status.good },
            { label: 'Consum Inst.',  val: c.inst_cons || 0,  unit: 'L/h',     max: 20 },
            { label: 'Consum Mediu',  val: c.avg_cons || 0,   unit: 'L/100km', max: 20,  color: colors.status.good },
            { label: 'Fuel Trim SFT', val: c.sft_b1 || 0,    unit: '%',       max: 25 },
            { label: 'Fuel Trim LFT', val: c.lft_b1 || 0,    unit: '%',       max: 25 },
        ];
        case 'LAMBDA': return [
            { label: 'O2 B1S1',       val: lam.o2_b1s1 || 0,    unit: 'V', max: 1,   color: colors.accent.default },
            { label: 'O2 B1S2',       val: lam.o2_b1s2 || 0,    unit: 'V', max: 1 },
            { label: 'Wideband B1S1', val: lam.wb_b1s1 || 0,    unit: 'λ', max: 2,   color: colors.status.good },
            { label: 'Lambda Cmd.',   val: lam.cmd_lambda || 0, unit: 'λ', max: 2 },
            { label: 'Avans Aprin.',  val: ign.timing_adv || 0, unit: '°', max: 40,  color: colors.status.monitor },
            { label: 'Knock Retard',  val: ign.knock_retard||0, unit: '°', max: 10,  color: colors.status.good },
        ];
        case 'EMISII': return [
            { label: 'EGR Cmd.',      val: em.egr_cmd || 0,      unit: '%',  max: 100, color: colors.accent.default },
            { label: 'EGR Eroare',    val: em.egr_error || 0,    unit: '%',  max: 50,  color: colors.status.good },
            { label: 'DPF Presiune',  val: dpf.diff_press || 0,  unit: 'kPa',max: 10,  color: colors.status.monitor },
            { label: 'DPF Funingine', val: dpf.soot_load || 0,   unit: 'g',  max: 60,  color: colors.status.critical },
            { label: 'EGT S1',        val: dpf.egt1 || 0,        unit: '°C', max: 800, color: colors.status.critical },
            { label: 'EGT S2',        val: dpf.egt2 || 0,        unit: '°C', max: 800 },
        ];
        case 'TRANS': return [
            { label: 'Temp Trans.',   val: tr.trans_temp || 0,  unit: '°C', max: 130, color: colors.status.monitor },
            { label: 'Treaptă',       val: tr.gear || 0,        unit: 'Tr', max: 8,   color: colors.status.good },
            { label: 'Alunecare',     val: tr.slip || 0,        unit: 'RPM',max: 200 },
            { label: 'Cam. Intake',   val: vvt.cam_intake || 0, unit: '°',  max: 50,  color: colors.accent.default },
            { label: 'Pres. Ulei',    val: pr.oil_press || 0,   unit: 'bar',max: 7,   color: colors.status.good },
        ];
        case 'ECU': return [
            { label: 'Voltaj ECU',    val: bat.ecu_volt || 0,          unit: 'V',       max: 16,   color: colors.status.good },
            { label: 'Voltaj Bat.',   val: bat.bat_volt || 0,          unit: 'V',       max: 16 },
            { label: 'Timp Func.',    val: tim.run_time || 0,          unit: 'sec',     max: 3600, color: colors.accent.default },
            { label: 'Warmups',       val: tim.warmups || 0,           unit: 'cicluri', max: 100,  color: colors.status.good },
            { label: 'Dist. DTC',     val: meta.dist_dtc || 0,         unit: 'km',      max: 5000, color: colors.accent.default },
            { label: 'Ore Motor',     val: meta.engine_hours || 0,     unit: 'ore',     max: 500 },
        ];
        default: return [];
    }
}

// ─── Oscilloscope metrics ─────────────────────────────────────────────────────

const SCOPE_METRICS = [
    { id: 'rpm',       label: 'RPM',     color: colors.text.primary,    unit: 'RPM',  defaultMax: 5000 },
    { id: 'speed',     label: 'Km/h',    color: colors.status.good,     unit: 'km/h', defaultMax: 220  },
    { id: 'powerHp',   label: 'Dyno CP', color: colors.status.good,     unit: 'CP',   defaultMax: 150  },
    { id: 'map',       label: 'MAP',     color: colors.accent.default,  unit: 'kPa',  defaultMax: 250  },
    { id: 'maf',       label: 'MAF',     color: colors.status.monitor,  unit: 'g/s',  defaultMax: 150  },
    { id: 'inst_cons', label: 'Cons',    color: colors.status.critical, unit: 'L/h',  defaultMax: 20   },
    { id: 'coolant',   label: 'Temp',    color: colors.status.caution,  unit: '°C',   defaultMax: 110  },
    { id: 'ecu_volt',  label: 'Volt',    color: colors.status.good,     unit: 'V',    defaultMax: 16   },
    { id: 'accel_g',   label: 'G',       color: colors.status.critical, unit: 'G',    defaultMax: 1.5  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricTile = ({ label, value, unit, color = colors.text.primary, highlight = false, tileW }) => (
    <View style={[
        styles.tile,
        tileW && { width: tileW },
        highlight && { borderColor: color, borderWidth: 2 },
    ]}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={[styles.tileValue, { color }]} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
    </View>
);

const ParamRow = ({ label, val, unit, max = 100, color = colors.accent.default, last = false }) => {
    const pct = max > 0 ? `${Math.min(Math.max((Number(val) / max) * 100, 0), 100)}%` : '0%';
    return (
        <View style={[styles.paramRow, last && { borderBottomWidth: 0 }]}>
            <Text style={styles.paramLabel} numberOfLines={1}>{label}</Text>
            <View style={styles.paramTrack}>
                <View style={[styles.paramFill, { width: pct, backgroundColor: color }]} />
            </View>
            <Text style={[styles.paramVal, { color }]} numberOfLines={1}>
                {val}<Text style={styles.paramUnit}> {unit}</Text>
            </Text>
        </View>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const LiveDashboardScreen = () => {
    const { width } = useWindowDimensions();
    const { isConnected, isReconnecting, liveData, chartVersion, getChartHistory } = useContext(LiveContext);
    const { latestAlert, alertsList, unreadCount, markAlertsAsRead } = useContext(AlertContext);
    const { selectedMetric, setSelectedMetric } = useContext(AppContext);

    // ── 60 FPS Smoothed Telemetry ─────────────────────────────────────────────
    const { animated, numeric } = useSmoothedTelemetry(liveData);

    const [tab,        setTab]        = useState('LIVE');
    const [category,   setCategory]   = useState('MOTOR');
    const [showAlerts, setShowAlerts] = useState(false);
    const [zoomX,      setZoomX]      = useState(10);
    const [autoScaleY, setAutoScaleY] = useState(true);
    const [zoomYMult,  setZoomYMult]  = useState(1);

    // Pinch-to-zoom for oscilloscope
    const zoomXRef   = useRef(10);
    const pinchState = useRef({ startDist: 0, startZoom: 10, active: false });
    const pinchPR    = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 2,
            onMoveShouldSetPanResponder:  e => e.nativeEvent.touches.length === 2,
            onPanResponderGrant: e => {
                const t0 = e.nativeEvent.touches[0], t1 = e.nativeEvent.touches[1];
                if (!t0 || !t1) return;
                const dx = t0.pageX - t1.pageX, dy = t0.pageY - t1.pageY;
                pinchState.current = { startDist: Math.sqrt(dx*dx + dy*dy), startZoom: zoomXRef.current, active: true };
            },
            onPanResponderMove: e => {
                if (!pinchState.current.active) return;
                const t0 = e.nativeEvent.touches[0], t1 = e.nativeEvent.touches[1];
                if (!t0 || !t1) return;
                const dx = t0.pageX - t1.pageX, dy = t0.pageY - t1.pageY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (pinchState.current.startDist < 10) return;
                const newZoom = Math.max(2, Math.min(40, Math.round(pinchState.current.startZoom / (dist / pinchState.current.startDist))));
                zoomXRef.current = newZoom;
                setZoomX(newZoom);
            },
            onPanResponderRelease:   () => { pinchState.current.active = false; },
            onPanResponderTerminate: () => { pinchState.current.active = false; },
        })
    ).current;
    zoomXRef.current = zoomX;

    // Live data aliases
    const m   = liveData.motor        || {};
    const tem = liveData.temperaturi  || {};
    const a   = liveData.aer          || {};
    const c   = liveData.combustibil  || {};
    const bat = liveData.baterie      || {};
    const dpf = liveData.dpf          || {};
    const tr  = liveData.transmisie   || {};
    const v   = liveData.virtual      || {};

    const assistantMsg    = useMemo(() => buildAssistantMsg(liveData, isConnected),    [liveData, isConnected]);
    const contextualAlert = useMemo(() => buildContextualAlert(liveData, latestAlert), [liveData, latestAlert]);
    const chartHistory    = useMemo(() => getChartHistory(), [chartVersion]);
    const params          = useMemo(() => buildParams(category, liveData),             [category, liveData]);

    // Tile width: 3 per row, with gap spacing
    const tileW = Math.floor((width - layout.screenPaddingH * 2 - spacing[2] * 2) / 3);

    // ─── LIVE tab ─────────────────────────────────────────────────────────────

    const renderLive = () => {
        const rpm         = numeric.rpm ?? (m.rpm ?? 0);
        const speed       = numeric.speed ?? (m.speed ?? 0);
        const cool        = numeric.coolant ?? (tem.coolant ?? 0);
        const volt        = bat.ecu_volt ?? 0;
        const boost       = numeric.boost ?? (a.boost_actual ?? 0);
        const targetBoost = numeric.targetBoost ?? (a.boost_cmd ?? 0);
        const cons        = c.inst_cons ?? 0;
        const gear        = tr.gear;
        const eco         = liveData.scor_eco ?? 100;

        const powerHp     = numeric.powerHp ?? (v.powerHp || 0);
        const torqueNm    = (v.torqueNm && v.torqueNm > 0)
            ? v.torqueNm
            : (powerHp > 0 && rpm > 400 ? Math.round((powerHp * 7120) / rpm) : 0);
        const vePct       = v.volumetricEfficiencyPct ?? (a.maf ? Math.round((a.maf * 120 / ((rpm || 800) * 2.461 * 1.25)) * 100) : 88);
        const lambda      = v.lambda ?? 1.15;
        const afr         = v.afr ?? 16.8;

        // Redline dinamic în funcție de temperatura motorului (răcire / ulei)
        let dynamicRedline = 4500;
        let engineTempStatus = 'optimal'; // 'cold', 'warming', 'optimal'
        let tempBadgeText = null;

        const oilTemp = tem.oil;
        const coolTemp = cool;

        if ((coolTemp > 0 && coolTemp < 65) || (oilTemp != null && oilTemp > 0 && oilTemp < 60)) {
            dynamicRedline = 2500;
            engineTempStatus = 'cold';
            tempBadgeText = '❄️ Motor rece (Redline dinamic: 2500 RPM)';
        } else if (coolTemp >= 65 && coolTemp < 80) {
            dynamicRedline = 3200;
            engineTempStatus = 'warming';
            tempBadgeText = '🌡️ În încălzire (Redline dinamic: 3200 RPM)';
        } else {
            dynamicRedline = 4500;
            engineTempStatus = 'optimal';
        }

        const redlinePct = (dynamicRedline / 5000) * 100;
        const rpmPct   = `${Math.min((rpm / 5000) * 100, 100)}%`;
        const rpmColor = rpm > dynamicRedline
            ? colors.status.critical
            : rpm > (dynamicRedline - 400)
                ? colors.status.caution
                : colors.accent.default;

        const coolColor  = cool > 105 ? colors.status.critical : cool > 95 ? colors.status.caution : cool > 60 ? colors.status.good : colors.text.secondary;
        const voltColor  = volt > 0 && volt < 13.0 ? colors.status.critical : volt > 0 && volt < 13.5 ? colors.status.monitor : volt > 0 ? colors.status.good : colors.text.secondary;
        const ecoColor   = eco >= 85 ? colors.status.good : eco >= 65 ? colors.status.monitor : colors.status.caution;
        const consColor  = cons > 15 ? colors.status.caution : cons > 10 ? colors.status.monitor : colors.text.primary;
        const boostColor = boost > 1.8 ? colors.status.caution : colors.text.primary;

        const aiColorMap = { critical: colors.status.critical, serious: colors.status.caution, warning: colors.status.monitor, info: colors.accent.default, normal: colors.text.secondary, neutral: colors.text.tertiary ?? colors.text.secondary };
        const aiColor = aiColorMap[assistantMsg.level] ?? colors.text.secondary;

        return (
            <View style={styles.liveContainer}>
                {/* ── Speed hero ──────────────────────────────────── */}
                <View style={styles.speedHero}>
                    <Text style={styles.speedNum}>{speed}</Text>
                    <Text style={styles.speedUnit}>km/h</Text>
                </View>

                {/* ── RPM bar cu Redline Dinamic ─────────────────── */}
                <View style={styles.rpmSection}>
                    <Text style={[styles.rpmNum, { color: rpmColor }]}>
                        {typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm}
                    </Text>
                    <View style={styles.rpmTrack}>
                        <View style={[styles.redlineMarker, { left: `${redlinePct}%` }]} />
                        <View style={[styles.rpmFill, { width: rpmPct, backgroundColor: rpmColor }]} />
                    </View>
                    <Text style={styles.rpmLabel}>RPM</Text>
                </View>

                {/* ── Badge Motor Rece / În încălzire ────────────── */}
                {tempBadgeText && (
                    <View style={[styles.coldBadge, engineTempStatus === 'cold' ? styles.coldBadgeActive : styles.warmingBadgeActive]}>
                        <Text style={[styles.coldBadgeText, { color: engineTempStatus === 'cold' ? '#5AC8FA' : colors.status.monitor }]}>
                            {tempBadgeText}
                        </Text>
                    </View>
                )}

                {/* ── DPF regen banner ────────────────────────────── */}
                {(dpf.regen_status === 'ACTIVE' || dpf.regen_status === 'ON') && (
                    <View style={styles.dpfBanner}>
                        <Text style={styles.dpfText}>♻  Regenerare DPF — drum lung recomandat</Text>
                    </View>
                )}

                {/* ── Virtual Dyno & ECU Glass Card ──────────────── */}
                <View style={styles.dynoCard}>
                    <View style={styles.dynoHeader}>
                        <View style={styles.dynoTag}>
                            <Text style={styles.dynoTagText}>⚡ VIRTUAL DYNO (ECU MATH)</Text>
                        </View>
                        {v.smokeRisk ? (
                            <View style={[styles.dynoTag, { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: colors.status.critical }]}>
                                <Text style={[styles.dynoTagText, { color: colors.status.critical }]}>⚠ RISC FUM NEGRU</Text>
                            </View>
                        ) : (
                            <View style={[styles.dynoTag, { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: colors.status.good }]}>
                                <Text style={[styles.dynoTagText, { color: colors.status.good }]}>✓ LIMITĂ FUM OK</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.dynoGrid}>
                        {/* Putere CP */}
                        <View style={styles.dynoCell}>
                            <Text style={styles.dynoLabel}>PUTERE REALĂ</Text>
                            <Text style={styles.dynoValue}>{powerHp} <Text style={styles.dynoUnit}>CP</Text></Text>
                            <View style={styles.dynoMiniBar}>
                                <View style={[styles.dynoMiniFill, { width: `${Math.min((powerHp / 140) * 100, 100)}%`, backgroundColor: colors.status.good }]} />
                            </View>
                        </View>

                        {/* Cuplu Nm */}
                        <View style={styles.dynoCell}>
                            <Text style={styles.dynoLabel}>CUPLU MOTOR</Text>
                            <Text style={styles.dynoValue}>{torqueNm} <Text style={styles.dynoUnit}>Nm</Text></Text>
                            <View style={styles.dynoMiniBar}>
                                <View style={[styles.dynoMiniFill, { width: `${Math.min((torqueNm / 300) * 100, 100)}%`, backgroundColor: colors.accent.default }]} />
                            </View>
                        </View>

                        {/* Volumetric Efficiency */}
                        <View style={styles.dynoCell}>
                            <Text style={styles.dynoLabel}>EFICIENȚĂ VOLUMETRICĂ</Text>
                            <Text style={styles.dynoValue}>{vePct}%</Text>
                            <Text style={styles.dynoSub}>{m.load < 40 || rpm < 1600 ? 'Sarcină parțială' : (vePct >= 80 ? 'Admisie optimă' : 'Restricție debit')}</Text>
                        </View>

                        {/* Lambda / AFR */}
                        <View style={styles.dynoCell}>
                            <Text style={styles.dynoLabel}>LAMBDA / AFR</Text>
                            <Text style={styles.dynoValue}>λ {typeof lambda === 'number' ? lambda.toFixed(2) : lambda}</Text>
                            <Text style={styles.dynoSub}>{typeof afr === 'number' ? `${afr.toFixed(1)}:1 AFR` : 'AFR'}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Dual Boost Indicator (Target vs Actual) ───── */}
                <View style={styles.boostCard}>
                    <View style={styles.boostHeader}>
                        <Text style={styles.boostTitle}>TURBO BOOST (COMANDAT vs EFECTIV)</Text>
                        <Text style={[styles.boostDelta, { color: Math.abs(boost - targetBoost) > 0.3 ? colors.status.caution : colors.status.good }]}>
                            Δ {((boost - targetBoost) > 0 ? '+' : '') + (boost - targetBoost).toFixed(2)} bar
                        </Text>
                    </View>
                    <View style={styles.boostBarsWrap}>
                        <View style={styles.boostBarRow}>
                            <Text style={styles.boostBarLbl}>Cmd</Text>
                            <View style={styles.boostBarTrack}>
                                <View style={[styles.boostBarFill, { width: `${Math.min((targetBoost / 2.5) * 100, 100)}%`, backgroundColor: colors.status.monitor }]} />
                            </View>
                            <Text style={styles.boostBarVal}>{targetBoost.toFixed(2)} bar</Text>
                        </View>
                        <View style={styles.boostBarRow}>
                            <Text style={styles.boostBarLbl}>Act</Text>
                            <View style={styles.boostBarTrack}>
                                <View style={[styles.boostBarFill, { width: `${Math.min((boost / 2.5) * 100, 100)}%`, backgroundColor: boostColor }]} />
                            </View>
                            <Text style={styles.boostBarVal}>{boost.toFixed(2)} bar</Text>
                        </View>
                    </View>
                    {v.turboDiagnostic && v.turboDiagnostic !== 'NORMAL' && (
                        <View style={styles.turboDiagPill}>
                            <Text style={styles.turboDiagText}>
                                {v.turboDiagnostic === 'VNT_N75_SPIKE' ? '⚡ Spike suprapresiune VNT / electrovalvă N75' :
                                 v.turboDiagnostic === 'INTERCOOLER_BOOST_LEAK' ? '⚠ Pierdere presiune admisie / intercooler' :
                                 v.turboDiagnostic === 'TURBO_UNDERBOOST_WEAR' ? 'ℹ Subpresiune constantă — verificare geometrie' :
                                 v.turboDiagnostic}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── 2×3 metric tiles ────────────────────────────── */}
                <View style={styles.tileGrid}>
                    <MetricTile tileW={tileW} label="TEMP"    value={cool}                  unit="°C"  color={coolColor}  highlight={cool > 95} />
                    <MetricTile tileW={tileW} label="BOOST"   value={boost}                 unit="bar" color={boostColor} highlight={boost > 1.8} />
                    <MetricTile tileW={tileW} label="VOLTAJ"  value={volt > 0 ? volt : '—'} unit={volt > 0 ? 'V' : ''} color={voltColor} />
                    <MetricTile tileW={tileW} label="CONSUM"  value={cons}                  unit="L/h" color={consColor} />
                    <MetricTile tileW={tileW} label="ECO"     value={eco}                   unit="/100" color={ecoColor} highlight />
                    <MetricTile tileW={tileW} label="TREAPTĂ" value={gear ?? 'N'}            unit=""    color={colors.accent.default} />
                </View>

                {/* ── AI message ──────────────────────────────────── */}
                <View style={[styles.aiCard, { borderLeftColor: aiColor }]}>
                    <Text style={[styles.aiText, { color: aiColor }]}>{assistantMsg.text}</Text>
                </View>

                {/* ── Contextual alert ────────────────────────────── */}
                {contextualAlert && (
                    <RecommendationCard
                        title={contextualAlert.title}
                        description={contextualAlert.description}
                        priority={contextualAlert.priority}
                        style={{ marginTop: spacing[2] }}
                    />
                )}
            </View>
        );
    };

    // ─── PARAMS tab ───────────────────────────────────────────────────────────

    const renderParams = () => (
        <View style={styles.paramsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {PARAM_CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, category === cat.id && styles.chipActive]}
                        onPress={() => setCategory(cat.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: category === cat.id }}
                    >
                        <Text style={[styles.chipText, category === cat.id && styles.chipTextActive]}>
                            {cat.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={styles.paramList}>
                {params.map((p, i) => (
                    <ParamRow key={p.label} {...p} last={i === params.length - 1} />
                ))}
            </View>
        </View>
    );

    // ─── SCOPE tab ────────────────────────────────────────────────────────────

    const renderScope = () => {
        const cfg      = SCOPE_METRICS.find(s => s.id === selectedMetric) ?? SCOPE_METRICS[0];
        const maxPts   = Math.floor((width - 80) / zoomX);
        const sliced   = chartHistory.slice(-maxPts);
        const data     = sliced.map(item => ({ value: Number(item[cfg.id]) || 0, label: item.label || '', secunda: item.secunda || 0 }));

        let maxValue  = cfg.defaultMax * zoomYMult;
        let stepValue = Math.max(1, Math.round(maxValue / 4));
        if (autoScaleY && data.length > 0) {
            const peak = Math.max(...data.map(i => i.value), 1);
            maxValue  = Math.ceil(peak * 1.2);
            stepValue = Math.max(1, Math.ceil(maxValue / 4));
        }

        const chartW = width - layout.screenPaddingH * 2 - spacing[4] * 2;

        return (
            <View style={styles.scopeContainer}>
                {/* metric chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {SCOPE_METRICS.map(s => (
                        <TouchableOpacity
                            key={s.id}
                            style={[styles.chip, selectedMetric === s.id && { backgroundColor: s.color, borderColor: s.color }]}
                            onPress={() => setSelectedMetric(s.id)}
                        >
                            <Text style={[styles.chipText, selectedMetric === s.id && { color: '#FFFFFF' }]}>{s.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* zoom controls */}
                <View style={styles.zoomRow}>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(p => Math.max(p - 3, 2))}>
                        <Text style={styles.zoomBtnTxt}>X—</Text>
                    </TouchableOpacity>
                    <Text style={styles.zoomVal}>{zoomX}px</Text>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(p => Math.min(p + 3, 40))}>
                        <Text style={styles.zoomBtnTxt}>X+</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={[styles.zoomBtn, autoScaleY && { backgroundColor: colors.status.good, borderColor: colors.status.good }]}
                        onPress={() => setAutoScaleY(true)}
                    >
                        <Text style={[styles.zoomBtnTxt, autoScaleY && { color: '#FFF' }]}>Auto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.min(p + 0.2, 3)); }}>
                        <Text style={styles.zoomBtnTxt}>Y—</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.max(p - 0.2, 0.2)); }}>
                        <Text style={styles.zoomBtnTxt}>Y+</Text>
                    </TouchableOpacity>
                </View>

                {/* chart */}
                <View style={styles.chartCard} {...pinchPR.panHandlers}>
                    <Text style={styles.chartTitle}>{cfg.label} · {cfg.unit} · {data.length}s · {zoomX}px/pt</Text>
                    <LineChart
                        data={data}
                        width={chartW}
                        height={200}
                        color={cfg.color}
                        thickness={2}
                        dataPointsColor={cfg.color}
                        dataPointsRadius={1}
                        maxValue={maxValue}
                        stepValue={stepValue}
                        noOfSections={4}
                        spacing={zoomX}
                        yAxisTextStyle={{ color: colors.text.secondary, fontSize: 9 }}
                        xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: 8 }}
                        rulesColor={colors.border.default}
                        rulesType="solid"
                        initialSpacing={8}
                        endSpacing={8}
                        isAnimated={false}
                        pointerConfig={{
                            pointerStripHeight: 200,
                            pointerStripColor: 'rgba(139,148,158,0.35)',
                            pointerStripWidth: 2,
                            pointerColor: cfg.color,
                            radius: 4,
                            pointerLabelWidth: 80,
                            pointerLabelHeight: 36,
                            activatePointersOnLongPress: false,
                            autoAdjustPointerLabelPosition: true,
                            pointerLabelComponent: items => {
                                if (!items?.[0]) return null;
                                return (
                                    <View style={styles.crosshairBadge}>
                                        <Text style={styles.crosshairVal}>
                                            {items[0].value}{' '}
                                            <Text style={{ fontSize: 9, color: cfg.color }}>{cfg.unit}</Text>
                                        </Text>
                                        <Text style={styles.crosshairSec}>{items[0].secunda ?? 0}s</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                </View>
            </View>
        );
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const connColor = isConnected ? colors.status.good : isReconnecting ? colors.status.monitor : colors.status.critical;
    const connLabel = isConnected ? 'LIVE' : isReconnecting ? 'SYNC' : 'OFF';

    return (
        <View style={styles.root}>
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <View style={styles.topBar}>
                <View style={[styles.connPill, { borderColor: connColor }]}>
                    <View style={[styles.connDot, { backgroundColor: connColor }]} />
                    <Text style={[styles.connLabel, { color: connColor }]}>{connLabel}</Text>
                </View>
                <Text style={styles.vehicleName} numberOfLines={1}>
                    {getVehicleLabel() || 'Dashboard'}
                </Text>
                <TouchableOpacity style={styles.alertBtn} onPress={() => setShowAlerts(true)} accessibilityRole="button" accessibilityLabel="Alerte">
                    <Text style={styles.alertBtnIcon}>🔔</Text>
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* ── Offline / reconnecting banner ───────────────────────── */}
            {!isConnected && (
                <View style={[styles.offlineBanner, isReconnecting && styles.offlineBannerSync]}>
                    <Text style={styles.offlineText}>
                        {isReconnecting ? '⟳  Reconectare la server...' : '⊘  Date înghețate — fără conexiune'}
                    </Text>
                </View>
            )}

            {/* ── Content ─────────────────────────────────────────────── */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {tab === 'LIVE'   && renderLive()}
                {tab === 'PARAMS' && renderParams()}
                {tab === 'SCOPE'  && renderScope()}
            </ScrollView>

            {/* ── Bottom tab bar ──────────────────────────────────────── */}
            <View style={styles.tabBar}>
                {[
                    { id: 'LIVE',   label: 'Live'       },
                    { id: 'PARAMS', label: 'Parametri'  },
                    { id: 'SCOPE',  label: 'Grafic'     },
                ].map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={styles.tabItem}
                        onPress={() => setTab(t.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === t.id }}
                    >
                        <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
                        {tab === t.id && <View style={styles.tabIndicator} />}
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── Alerts modal ────────────────────────────────────────── */}
            <Modal
                visible={showAlerts}
                transparent
                animationType="slide"
                onRequestClose={() => { markAlertsAsRead(); setShowAlerts(false); }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHead}>
                            <Text style={styles.modalTitle}>Alerte Sesiune</Text>
                            <TouchableOpacity
                                onPress={() => { markAlertsAsRead(); setShowAlerts(false); }}
                                style={styles.modalClose}
                            >
                                <Text style={{ color: colors.text.primary, fontWeight: typography.weights.bold, fontSize: 16 }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {alertsList.length === 0 ? (
                                <Text style={styles.noAlerts}>Nicio alertă în această sesiune.</Text>
                            ) : alertsList.map(al => (
                                <View key={al.id} style={styles.alertRow}>
                                    <Text style={styles.alertRowTitle}>{(al.tip || 'Eveniment').replace(/_/g, ' ')}</Text>
                                    <Text style={styles.alertRowSub}>Eco Score: {al.scor_curent ?? '—'}/100</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const TAB_H = 56;

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 44,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: TAB_H + spacing[6],
    },

    // ── Top bar ──────────────────────────────────────────────────────────────
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        gap: spacing[2],
    },
    connPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: radii.full,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1],
    },
    connDot:   { width: 7, height: 7, borderRadius: 4 },
    connLabel: { fontSize: typography.sizes.micro, fontWeight: typography.weights.heavy },
    vehicleName: {
        flex: 1,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    alertBtn: { padding: spacing[1], position: 'relative' },
    alertBtnIcon: { fontSize: 22 },
    badge: {
        position: 'absolute', top: 0, right: 0,
        backgroundColor: colors.status.critical,
        minWidth: 16, height: 16,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    badgeText: { color: '#FFF', fontSize: 9, fontWeight: typography.weights.heavy },

    // ── Offline banner ───────────────────────────────────────────────────────
    offlineBanner: {
        backgroundColor: colors.tint?.critical ?? 'rgba(255,59,48,0.08)',
        borderBottomWidth: 1,
        borderBottomColor: colors.status.critical,
        paddingVertical: spacing[1] + 2,
        alignItems: 'center',
    },
    offlineBannerSync: {
        backgroundColor: colors.tint?.monitor ?? 'rgba(255,159,10,0.1)',
        borderBottomColor: colors.status.monitor,
    },
    offlineText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },

    // ── LIVE: Speed hero ─────────────────────────────────────────────────────
    liveContainer: { paddingTop: spacing[4] },
    speedHero: { alignItems: 'center', paddingBottom: spacing[1] },
    speedNum: {
        fontSize: 88,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
        lineHeight: 94,
    },
    speedUnit: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginTop: 0,
    },

    // ── LIVE: RPM bar ────────────────────────────────────────────────────────
    rpmSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginTop: spacing[3],
        marginBottom: spacing[2],
    },
    rpmNum: {
        width: 54,
        textAlign: 'right',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    rpmTrack: {
        flex: 1,
        height: 8,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
        position: 'relative',
    },
    rpmFill:  { height: '100%', borderRadius: radii.full },
    redlineMarker: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(255, 69, 58, 0.28)',
        borderLeftWidth: 2,
        borderLeftColor: colors.status.critical,
    },
    coldBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderWidth: 1,
        borderColor: colors.status.monitor,
        borderRadius: radii.xs,
        paddingVertical: 3,
        paddingHorizontal: spacing[2],
        marginBottom: spacing[3],
        alignSelf: 'center',
    },
    coldBadgeActive: {
        backgroundColor: 'rgba(90, 200, 250, 0.12)',
        borderColor: '#5AC8FA',
    },
    warmingBadgeActive: {
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderColor: colors.status.monitor,
    },
    coldBadgeText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    rpmLabel: { fontSize: typography.sizes.micro, color: colors.text.secondary, fontWeight: typography.weights.bold, width: 30 },

    // ── LIVE: DPF banner ─────────────────────────────────────────────────────
    dpfBanner: {
        backgroundColor: colors.tint?.monitor ?? 'rgba(255,159,10,0.1)',
        borderWidth: 1,
        borderColor: colors.status.monitor,
        borderRadius: radii.sm,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    dpfText: { color: colors.status.monitor, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },

    // ── LIVE: Virtual Dyno ───────────────────────────────────────────────────
    dynoCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    dynoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    dynoBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        flexWrap: 'wrap',
    },
    dynoTag: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    dynoTagText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    dynoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    dynoCell: {
        flex: 1,
        minWidth: 130,
        backgroundColor: colors.bg[0],
        borderRadius: radii.sm,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle ?? colors.bg[2],
    },
    dynoLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    dynoValue: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    dynoUnit: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    dynoMiniBar: {
        height: 3,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        marginTop: 4,
        overflow: 'hidden',
    },
    dynoMiniFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    dynoSub: {
        fontSize: 9,
        color: colors.text.secondary,
        marginTop: 2,
    },

    // ── LIVE: Dual Boost ─────────────────────────────────────────────────────
    boostCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[3],
    },
    boostHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    boostTitle: {
        fontSize: 9,
        color: colors.text.secondary,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
    },
    boostDelta: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    boostBarsWrap: {
        gap: spacing[2],
    },
    boostBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    boostBarLbl: {
        width: 32,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
    },
    boostBarTrack: {
        flex: 1,
        height: 6,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    boostBarFill: {
        height: '100%',
        borderRadius: radii.full,
    },
    boostBarVal: {
        width: 60,
        textAlign: 'right',
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    turboDiagPill: {
        marginTop: spacing[2],
        paddingVertical: spacing[1],
        paddingHorizontal: spacing[2],
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.status.monitor,
    },
    turboDiagText: {
        fontSize: 10,
        color: colors.status.monitor,
        fontWeight: typography.weights.semibold,
    },

    // ── LIVE: 2×3 tiles ──────────────────────────────────────────────────────
    tileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    tile: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 78,
    },
    tileLabel: {
        fontSize: 8,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: spacing[1],
    },
    tileValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    tileUnit: { fontSize: 9, color: colors.text.secondary, marginTop: 2 },

    // ── LIVE: AI card ────────────────────────────────────────────────────────
    aiCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3] + 2,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: colors.border.default,
        marginBottom: spacing[2],
    },
    aiText: {
        fontSize: typography.sizes.label1,
        lineHeight: typography.sizes.label1 * 1.6,
        fontStyle: 'italic',
    },

    // ── PARAMS tab ───────────────────────────────────────────────────────────
    paramsContainer: { paddingTop: spacing[2] },
    chipsRow: {
        paddingVertical: spacing[3],
        gap: spacing[2],
        paddingRight: layout.screenPaddingH,
    },
    chip: {
        backgroundColor: colors.bg[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    chipActive: { backgroundColor: colors.accent.default, borderColor: colors.accent.default },
    chipText:       { color: colors.text.secondary, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
    chipTextActive: { color: '#FFFFFF' },

    paramList: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        overflow: 'hidden',
        marginBottom: spacing[4],
    },
    paramRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2] + 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle ?? colors.bg[2],
        gap: spacing[2],
    },
    paramLabel: {
        width: 108,
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    paramTrack: {
        flex: 1,
        height: 4,
        backgroundColor: colors.bg[2],
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    paramFill:  { height: '100%', borderRadius: radii.full, opacity: 0.9 },
    paramVal: {
        width: 58,
        textAlign: 'right',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    paramUnit: { fontSize: 9, color: colors.text.secondary, fontWeight: typography.weights.regular },

    // ── SCOPE tab ────────────────────────────────────────────────────────────
    scopeContainer: { paddingTop: spacing[2] },
    zoomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    zoomBtn: {
        paddingHorizontal: spacing[2] + 2,
        height: 28,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomBtnTxt: { color: colors.text.secondary, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold },
    zoomVal: {
        color: colors.accent.default,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        minWidth: 32,
        textAlign: 'center',
    },
    chartCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
    },
    chartTitle: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        alignSelf: 'flex-start',
        marginBottom: spacing[2],
    },
    crosshairBadge: {
        height: 36, width: 80,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    crosshairVal: { color: colors.text.primary, fontSize: typography.sizes.label1, fontWeight: typography.weights.heavy },
    crosshairSec: { color: colors.text.secondary, fontSize: 8, marginTop: 1 },

    // ── Bottom tab bar ───────────────────────────────────────────────────────
    tabBar: {
        flexDirection: 'row',
        height: TAB_H,
        backgroundColor: colors.bg[1],
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
    },
    tabItem: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabLabel:       { fontSize: typography.sizes.caption, color: colors.text.secondary, fontWeight: typography.weights.semibold },
    tabLabelActive: { color: colors.accent.default, fontWeight: typography.weights.bold },
    tabIndicator: {
        position: 'absolute',
        bottom: 0,
        left: '25%',
        right: '25%',
        height: 2,
        backgroundColor: colors.accent.default,
        borderTopLeftRadius: 1,
        borderTopRightRadius: 1,
    },

    // ── Alerts modal ─────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: spacing[5] },
    modalBox: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
    },
    modalHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.bg[2],
        paddingBottom: spacing[3],
        marginBottom: spacing[3],
    },
    modalTitle: { color: colors.text.primary, fontSize: typography.sizes.title3, fontWeight: typography.weights.bold },
    modalClose: {
        backgroundColor: colors.bg[2],
        width: 30, height: 30,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noAlerts: {
        color: colors.status.good,
        textAlign: 'center',
        padding: spacing[5],
        fontSize: typography.sizes.body1,
    },
    alertRow: {
        backgroundColor: colors.bg[2],
        borderLeftWidth: 3,
        borderLeftColor: colors.status.critical,
        padding: spacing[3],
        borderRadius: radii.xs,
        marginBottom: spacing[2],
    },
    alertRowTitle: { color: colors.status.critical, fontWeight: typography.weights.bold, fontSize: typography.sizes.label1 },
    alertRowSub:   { color: colors.text.secondary,  fontSize: typography.sizes.caption,  marginTop: 2 },
});

export default LiveDashboardScreen;
