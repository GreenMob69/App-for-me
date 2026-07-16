import React, { useContext, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, Modal, Platform, StatusBar } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { LiveContext } from '../context/LiveContext';
import { AlertContext } from '../context/AlertContext';
import { AppContext } from '../context/AppContext';
import { getVin } from '../utils/config';
import CircularGauge from '../components/CircularGauge';
import RecommendationCard from '../components/ui/RecommendationCard';
import { colors, typography, radii, spacing, layout } from '../theme';

const EXPERT_TABS = [
    { id: 'MOTOR',  label: 'Motor'       },
    { id: 'TEMP',   label: 'Temperaturi' },
    { id: 'AER',    label: 'Aer & Turbo' },
    { id: 'COMB',   label: 'Combustibil' },
    { id: 'LAMBDA', label: 'Lambda'      },
    { id: 'EMISII', label: 'Emisii & DPF'},
    { id: 'TRANS',  label: 'Transmisie'  },
    { id: 'ECU',    label: 'ECU & Timp'  },
];

const OSCILLOSCOPE_METRICS = [
    { id: 'rpm',        label: 'RPM',       color: colors.text.primary,    unit: 'RPM',    defaultMax: 5000  },
    { id: 'speed',      label: 'Viteză',    color: colors.status.good,     unit: 'km/h',   defaultMax: 220   },
    { id: 'map',        label: 'MAP',       color: colors.accent.default,  unit: 'kPa',    defaultMax: 250   },
    { id: 'maf',        label: 'MAF',       color: colors.status.monitor,  unit: 'g/s',    defaultMax: 150   },
    { id: 'inst_cons',  label: 'Consum',    color: colors.status.critical, unit: 'L/h',    defaultMax: 20    },
    { id: 'coolant',    label: 'Temp Apă',  color: colors.status.critical, unit: '°C',     defaultMax: 110   },
    { id: 'oil',        label: 'Temp Ulei', color: colors.status.monitor,  unit: '°C',     defaultMax: 130   },
    { id: 'ecu_volt',   label: 'Voltaj',    color: colors.status.good,     unit: 'V',      defaultMax: 16    },
    { id: 'rail_press', label: 'Rail Press',color: colors.text.secondary,  unit: 'kPa',    defaultMax: 40000 },
    { id: 'accel_g',    label: 'G-Force',   color: colors.status.critical, unit: 'G',      defaultMax: 1.5   },
];

// ─── AI Live Assistant ────────────────────────────────────────────────────────

function buildAssistantMsg(liveData, isConnected) {
    if (!isConnected) {
        return { text: 'Aștept conexiunea. Pornește vehiculul sau verifică conexiunea.', level: 'neutral' };
    }
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const rpm     = liveData.motor?.rpm ?? 0;
    const speed   = liveData.motor?.speed ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;
    const cons    = liveData.combustibil?.inst_cons ?? 0;
    const dpfRgn  = liveData.dpf?.regen_status;

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

// ─── Contextual Alert ─────────────────────────────────────────────────────────

function buildContextualAlert(liveData, latestAlert) {
    const coolant = liveData.temperaturi?.coolant ?? 0;
    const volt    = liveData.baterie?.ecu_volt ?? 0;

    if (coolant > 105) return {
        title: 'Supraîncălzire critică',
        description: 'Temperatura motorului depășește 105°C. Oprește motorul și verifică lichidul de răcire.',
        priority: 'critical',
    };
    if (coolant > 95) return {
        title: 'Temperatură motor ridicată',
        description: `Temperatura actuală: ${coolant}°C. Dacă continuă să crească, oprește motorul.`,
        priority: 'high',
    };
    if (volt > 0 && volt < 13.0) return {
        title: 'Tensiune scăzută',
        description: `Tensiunea de încărcare: ${volt.toFixed(1)}V. Posibilă problemă cu alternatorul sau bateria.`,
        priority: 'high',
    };
    if (latestAlert) return {
        title: latestAlert.tip || 'Eveniment de condus',
        description: `Eco Score: ${latestAlert.scor_curent ?? '—'}/100`,
        priority: 'medium',
    };
    return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const LiveDashboardScreen = () => {
    const { width } = useWindowDimensions();
    const { isConnected, liveData, chartVersion, getChartHistory } = useContext(LiveContext);
    const { latestAlert, alertsList, unreadCount, markAlertsAsRead } = useContext(AlertContext);
    const { viewMode, setViewMode, selectedMetric, setSelectedMetric, activeTemplate, setActiveTemplate } = useContext(AppContext);

    const [showNotificationsModal, setShowNotificationsModal] = useState(false);
    const [expertMode, setExpertMode] = useState(false);
    const [activeTab, setActiveTab] = useState('MOTOR');
    const [zoomX, setZoomX] = useState(10);
    const [autoScaleY, setAutoScaleY] = useState(true);
    const [zoomYMult, setZoomYMult] = useState(1);

    const m    = liveData.motor        || {};
    const t    = liveData.temperaturi  || {};
    const a    = liveData.aer          || {};
    const c    = liveData.combustibil  || {};
    const lam  = liveData.lambda       || {};
    const ign  = liveData.aprindere    || {};
    const em   = liveData.emisii       || {};
    const bat  = liveData.baterie      || {};
    const dpf  = liveData.dpf          || {};
    const vvt  = liveData.vvt          || {};
    const tr   = liveData.transmisie   || {};
    const pr   = liveData.presiuni     || {};
    const tim  = liveData.timp         || {};
    const meta = liveData.consum_meta  || {};
    const ecu  = liveData.ecu          || {};

    const assistantMsg = useMemo(
        () => buildAssistantMsg(liveData, isConnected),
        [liveData, isConnected],
    );

    const contextualAlert = useMemo(
        () => buildContextualAlert(liveData, latestAlert),
        [liveData, latestAlert],
    );

    // ─── Expert / Oscilloscope renderCard ────────────────────────────────────
    const renderCard = useCallback((label, val, unit, color = colors.text.primary, isLarge = false) => {
        if (activeTemplate === 'CLASSIC') {
            let min = 0; let max = 100;
            if (unit === 'RPM')                            max = 5000;
            else if (unit === 'km/h')                      max = 220;
            else if (unit === '°C')                        max = (label.includes('CAT') || label.includes('EGT')) ? 800 : 130;
            else if (unit === 'kPa')                       max = label.includes('RAIL') ? 40000 : 300;
            else if (unit === 'bar')                       max = 2.5;
            else if (unit === 'V')                         max = 16;
            else if (unit === 'g/s')                       max = 150;
            else if (unit === 'L/h' || unit === 'L/100km') max = 20;
            else if (unit === 'Nm')                        max = 400;
            else if (unit === 'mg' || unit === 'mg/crs')   max = 60;
            else if (unit === '°')                         { min = -10; max = 30; }
            const gaugeColor = color === colors.text.primary ? colors.accent.default : color;
            return (
                <CircularGauge
                    key={label}
                    label={label}
                    value={val !== undefined ? val : 0}
                    unit={unit}
                    color={gaugeColor}
                    min={min}
                    max={max}
                    size={width * 0.42}
                />
            );
        }
        return (
            <View key={label} style={[styles.card, isLarge && styles.cardLarge, { borderColor: color === colors.text.primary ? colors.border.default : color }]}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={[styles.val, styles.tabular, isLarge && styles.valLarge, { color }]}>
                    {val !== undefined ? val : 0}{' '}
                    <Text style={styles.unit}>{unit}</Text>
                </Text>
            </View>
        );
    }, [activeTemplate, width]);

    // =========================================================================
    // SIMPLE MODE — 4 KPIs + AI Assistant + Contextual Alert
    // =========================================================================
    const renderSimpleMode = () => {
        const msgColorMap = {
            critical: colors.status.critical,
            serious:  colors.status.caution,
            warning:  colors.status.monitor,
            info:     colors.accent.default,
            normal:   colors.text.secondary,
            neutral:  colors.text.tertiary,
        };
        const msgColor = msgColorMap[assistantMsg.level] || colors.text.secondary;
        const cardBorderColor = (assistantMsg.level === 'critical' || assistantMsg.level === 'serious')
            ? colors.status.critical
            : assistantMsg.level === 'warning'
            ? colors.status.monitor
            : colors.border.default;
        const cardBg = assistantMsg.level === 'critical' ? colors.tint.critical : 'transparent';

        return (
            <View style={styles.simpleContainer}>
                <View style={styles.kpiRow}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>VITEZĂ</Text>
                        <Text style={[styles.kpiValue, styles.tabular]}>{m.speed ?? 0}</Text>
                        <Text style={styles.kpiUnit}>km/h</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>TURAȚIE</Text>
                        <Text style={[styles.kpiValue, styles.tabular]}>{m.rpm ?? 0}</Text>
                        <Text style={styles.kpiUnit}>RPM</Text>
                    </View>
                </View>
                <View style={[styles.kpiRow, styles.kpiRowMt]}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>TEMP. MOTOR</Text>
                        <Text style={[
                            styles.kpiValue, styles.tabular,
                            (t.coolant ?? 0) > 95 && { color: colors.status.critical },
                        ]}>{t.coolant ?? 0}</Text>
                        <Text style={styles.kpiUnit}>°C</Text>
                    </View>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiLabel}>CONSUM</Text>
                        <Text style={[styles.kpiValue, styles.tabular]}>{c.inst_cons ?? 0}</Text>
                        <Text style={styles.kpiUnit}>L/h</Text>
                    </View>
                </View>

                <View style={[styles.assistantCard, { borderColor: cardBorderColor, backgroundColor: cardBg }]}>
                    <Text style={[styles.assistantText, { color: msgColor }]}>{assistantMsg.text}</Text>
                </View>

                {contextualAlert ? (
                    <RecommendationCard
                        title={contextualAlert.title}
                        description={contextualAlert.description}
                        priority={contextualAlert.priority}
                        style={styles.alertCard}
                    />
                ) : null}

                <View style={styles.bottomRow}>
                    <View style={styles.infoChip}>
                        <Text style={styles.infoChipLabel}>TREAPTĂ</Text>
                        <Text style={[styles.infoChipValue, { color: colors.accent.default }]}>{tr.gear || 'N'}</Text>
                    </View>
                    <View style={styles.infoChip}>
                        <Text style={styles.infoChipLabel}>ECO SCORE</Text>
                        <Text style={[
                            styles.infoChipValue, styles.tabular,
                            { color: (liveData.scor_eco ?? 100) >= 80 ? colors.status.good : colors.status.monitor },
                        ]}>
                            {liveData.scor_eco ?? 100}
                            <Text style={{ fontSize: typography.sizes.caption, color: colors.text.secondary }}>/100</Text>
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    // =========================================================================
    // EXPERT MODE — 8 categorii PID
    // =========================================================================
    const renderExpertView = () => (
        <View style={{ flex: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                {EXPERT_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.chip, activeTab === tab.id && styles.chipActive]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Text style={[styles.chipText, activeTab === tab.id && { color: colors.text.primary }]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
            <View style={styles.grid}>
                {activeTab === 'MOTOR' && [
                    renderCard("RPM",            m.rpm || 0,             "RPM"),
                    renderCard("Viteză",          m.speed || 0,           "km/h",    colors.status.good),
                    renderCard("Sarcină",         m.load || 0,            "%"),
                    renderCard("Clapetă",         m.throttle_pos || 0,    "%",       colors.accent.default),
                    renderCard("Pedală D",        m.pedal_d || 0,         "%",       colors.status.monitor),
                    renderCard("Cuplu Motor",     m.torque_engine || 0,   "Nm",      colors.status.good),
                    renderCard("Cuplu Cerut",     m.torque_driver || 0,   "Nm",      colors.status.monitor),
                    renderCard("Cuplu Fricțiune", m.torque_friction || 0, "Nm",      colors.status.critical),
                ]}
                {activeTab === 'TEMP' && [
                    renderCard("Lichid Răcire",     t.coolant || 0,   "°C", (t.coolant || 0) > 95 ? colors.status.critical : colors.accent.default),
                    renderCard("Aer Admisie (IAT)", t.iat || 0,      "°C", colors.accent.default),
                    renderCard("Ambient",           t.ambient || 0,   "°C", colors.text.secondary),
                    renderCard("Ulei Motor",        t.oil || 0,       "°C", colors.status.monitor),
                    renderCard("Catalizator B1S1",  t.cat_b1s1 || 0,  "°C", colors.status.critical),
                    renderCard("Catalizator B1S2",  t.cat_b1s2 || 0,  "°C", colors.status.critical),
                ]}
                {activeTab === 'AER' && [
                    renderCard("MAF (Debit Aer)", a.maf || 0,          "g/s", colors.status.monitor),
                    renderCard("MAP (Presiune)",  a.map || 101,        "kPa", colors.accent.default),
                    renderCard("Barometric",      a.baro || 101,       "kPa", colors.text.secondary),
                    renderCard("Boost Turbo",     a.boost_turbo || 0,  "bar", colors.status.good),
                    renderCard("Boost Comandat",  a.boost_cmd || 0,    "bar", colors.status.monitor),
                    renderCard("Boost Efectiv",   a.boost_actual || 0, "bar", colors.status.good, true),
                ]}
                {activeTab === 'COMB' && [
                    renderCard("Nivel Combustibil", c.level || 0,      "%",       colors.status.good),
                    renderCard("Presiune Rail",     c.rail_press || 0, "kPa",     colors.status.monitor),
                    renderCard("Timing Injecție",   c.inj_timing || 0, "°",       colors.status.critical),
                    renderCard("Cantitate Inj.",    c.inj_qty || 0,    "mg/crs",  colors.status.good),
                    renderCard("Consum Instant",    c.inst_cons || 0,  "L/h"),
                    renderCard("Consum Mediu",      c.avg_cons || 0,   "L/100km", colors.status.good),
                    renderCard("Fuel Trim SFT",     c.sft_b1 || 0,     "%",       colors.text.secondary),
                    renderCard("Fuel Trim LFT",     c.lft_b1 || 0,     "%",       colors.text.secondary),
                ]}
                {activeTab === 'LAMBDA' && [
                    renderCard("O2 B1S1",         lam.o2_b1s1 || 0,    "V", colors.accent.default),
                    renderCard("O2 B1S2",         lam.o2_b1s2 || 0,    "V", colors.text.secondary),
                    renderCard("Wideband B1S1",   lam.wb_b1s1 || 0,    "λ", colors.status.good),
                    renderCard("Lambda Comandat", lam.cmd_lambda || 0, "λ"),
                    renderCard("Avans Aprindere", ign.timing_adv || 0, "°", colors.status.monitor),
                    renderCard("Knock Retard",    ign.knock_retard || 0,"°", colors.status.good),
                ]}
                {activeTab === 'EMISII' && [
                    renderCard("EGR Comandat",      em.egr_cmd || 0,         "%",  colors.accent.default),
                    renderCard("EGR Eroare",        em.egr_error || 0,       "%",  colors.status.good),
                    renderCard("DPF Presiune Dif.", dpf.diff_press || 0,    "kPa", colors.status.monitor),
                    renderCard("DPF Funingine",     dpf.soot_load || 0,     "g",   colors.status.critical),
                    renderCard("DPF Regenerare",    dpf.regen_status || "OFF", "-", colors.status.good),
                    renderCard("EGT Sensor 1",      dpf.egt1 || 0,           "°C", colors.status.critical),
                    renderCard("EGT Sensor 2",      dpf.egt2 || 0,           "°C", colors.text.secondary),
                ]}
                {activeTab === 'TRANS' && [
                    renderCard("Temp. Transmisie",  tr.trans_temp || 0,     "°C",  colors.status.monitor),
                    renderCard("Treaptă Curentă",   tr.gear || 0,           "Tr.", colors.status.good),
                    renderCard("Alunecare Conv.",   tr.slip || 0,           "RPM", colors.text.secondary),
                    renderCard("Camshaft Intake",   vvt.cam_intake || 0,    "°",   colors.accent.default),
                    renderCard("Presiune Ulei",     pr.oil_press || 0,      "bar", colors.status.good),
                    renderCard("Presiune Evacuare", pr.exhaust_press || 0,  "kPa", colors.text.secondary),
                ]}
                {activeTab === 'ECU' && [
                    renderCard("Voltaj ECU",            bat.ecu_volt || 0,      "V",       colors.status.good),
                    renderCard("Voltaj Baterie",        bat.bat_volt || 0,      "V"),
                    renderCard("Timp Funcționare",      tim.run_time || 0,      "sec",     colors.accent.default),
                    renderCard("Warmups",               tim.warmups || 0,       "cicluri", colors.status.good),
                    renderCard("Dist. de la DTC Clear", meta.dist_dtc || 0,     "km",      colors.accent.default),
                    renderCard("Ore Motor",             meta.engine_hours || 0, "ore"),
                    renderCard("VIN",                   ecu.vin || getVin(),    "-",       colors.accent.default, true),
                ]}
            </View>
        </View>
    );

    // =========================================================================
    // OSCILOSCOP
    // =========================================================================
    const chartHistory = useMemo(() => getChartHistory(), [chartVersion]);

    const renderChartView = () => {
        const config = OSCILLOSCOPE_METRICS.find(metric => metric.id === selectedMetric) || OSCILLOSCOPE_METRICS[0];
        const maxPoints = Math.floor((width - 80) / zoomX);
        const slicedHistory = chartHistory.slice(-maxPoints);
        const visibleData = slicedHistory.map(item => ({
            value: Number(item[config.id]) || 0,
            label: item.label || '',
            secunda: item.secunda || 0,
        }));

        let maxValue = config.defaultMax * zoomYMult;
        let stepValue = Math.round(maxValue / 4);
        if (autoScaleY && visibleData.length > 0) {
            const maxInSlice = Math.max(...visibleData.map(i => i.value), 5);
            maxValue = Math.ceil(maxInSlice * 1.15);
            stepValue = Math.ceil(maxValue / 4);
        }

        return (
            <View style={styles.chartContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
                    {OSCILLOSCOPE_METRICS.map(metric => (
                        <TouchableOpacity
                            key={metric.id}
                            style={[styles.chip, selectedMetric === metric.id && { backgroundColor: metric.color, borderColor: metric.color }]}
                            onPress={() => setSelectedMetric(metric.id)}
                        >
                            <Text style={[styles.chipText, selectedMetric === metric.id && { color: '#FFFFFF' }]}>{metric.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.zoomRow}>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(prev => Math.max(prev - 3, 2))}>
                        <Text style={styles.zoomBtnText}>X-</Text>
                    </TouchableOpacity>
                    <Text style={styles.zoomLabel}>{zoomX}px</Text>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomX(prev => Math.min(prev + 3, 40))}>
                        <Text style={styles.zoomBtnText}>X+</Text>
                    </TouchableOpacity>
                    <View style={{ width: spacing[5] }} />
                    <TouchableOpacity
                        style={[styles.zoomBtn, autoScaleY && { backgroundColor: colors.status.good, borderColor: colors.status.good }]}
                        onPress={() => setAutoScaleY(true)}
                    >
                        <Text style={[styles.zoomBtnText, autoScaleY && { color: '#FFFFFF' }]}>Auto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.min(p + 0.2, 3)); }}>
                        <Text style={styles.zoomBtnText}>Y-</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomBtn} onPress={() => { setAutoScaleY(false); setZoomYMult(p => Math.max(p - 0.2, 0.2)); }}>
                        <Text style={styles.zoomBtnText}>Y+</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.chartWrapper}>
                    <Text style={styles.chartTitle}>{config.label} ({config.unit}) — ultim. {visibleData.length}s</Text>
                    <LineChart
                        data={visibleData}
                        width={width - 80}
                        height={200}
                        color={config.color}
                        thickness={2.5}
                        dataPointsColor={config.color}
                        dataPointsRadius={1}
                        maxValue={maxValue}
                        stepValue={stepValue}
                        noOfSections={4}
                        spacing={zoomX}
                        yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro }}
                        xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1 }}
                        rulesColor={colors.border.default}
                        rulesType="solid"
                        initialSpacing={10}
                        endSpacing={10}
                        isAnimated={false}
                        pointerConfig={{
                            pointerStripHeight: 200,
                            pointerStripColor: 'rgba(139, 148, 158, 0.4)',
                            pointerStripWidth: 2,
                            pointerColor: config.color,
                            radius: 4,
                            pointerLabelWidth: 100,
                            pointerLabelHeight: 40,
                            activatePointersOnLongPress: false,
                            autoAdjustPointerLabelPosition: true,
                            pointerLabelComponent: items => {
                                if (!items || !items[0]) return null;
                                return (
                                    <View style={styles.crosshairBadge}>
                                        <Text style={styles.crosshairValue}>
                                            {items[0].value}{' '}
                                            <Text style={{ fontSize: typography.sizes.micro - 1, color: config.color }}>{config.unit}</Text>
                                        </Text>
                                        <Text style={styles.crosshairTime}>{items[0].secunda || '0'}s</Text>
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
    return (
        <View style={styles.mainContainer}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Driving</Text>
                    <Text style={styles.subtitle}>Audi A6 C4 · Live</Text>
                </View>
                <View style={styles.headerActions}>
                    {expertMode && (
                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => setActiveTemplate(activeTemplate === 'DIGITAL' ? 'CLASSIC' : 'DIGITAL')}
                        >
                            <Text style={styles.iconBtnText}>{activeTemplate === 'DIGITAL' ? 'G' : 'D'}</Text>
                        </TouchableOpacity>
                    )}
                    {viewMode === 'COCKPIT' && (
                        <TouchableOpacity
                            style={[styles.iconBtn, expertMode && styles.iconBtnActive]}
                            onPress={() => setExpertMode(v => !v)}
                        >
                            <Text style={[styles.iconBtnText, expertMode && { color: '#FFFFFF' }]}>EXP</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => { markAlertsAsRead(); setShowNotificationsModal(true); }}
                    >
                        <Text style={styles.iconBtnText}>N</Text>
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{unreadCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]}>
                        <Text style={[styles.statusText, { color: isConnected ? colors.status.good : colors.status.critical }]}>
                            {isConnected ? 'ON' : 'OFF'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.viewToggle}>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'COCKPIT' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('COCKPIT')}
                >
                    <Text style={[styles.toggleText, viewMode === 'COCKPIT' && styles.toggleTextActive]}>
                        {expertMode ? 'Expert' : 'Simplu'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'CHART' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('CHART')}
                >
                    <Text style={[styles.toggleText, viewMode === 'CHART' && styles.toggleTextActive]}>Osciloscop</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: spacing[12] + 2 }}>
                {viewMode === 'COCKPIT'
                    ? (expertMode ? renderExpertView() : renderSimpleMode())
                    : renderChartView()
                }
            </ScrollView>

            <Modal
                visible={showNotificationsModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowNotificationsModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Alerte Sesiune</Text>
                            <TouchableOpacity onPress={() => setShowNotificationsModal(false)} style={styles.closeBtn}>
                                <Text style={{ color: colors.text.primary, fontWeight: typography.weights.bold }}>X</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {alertsList.length === 0 ? (
                                <Text style={{ color: colors.status.good, textAlign: 'center', padding: spacing[5] }}>Nicio alertă.</Text>
                            ) : (
                                alertsList.map(alt => (
                                    <View key={alt.id} style={styles.alertItem}>
                                        <Text style={{ color: colors.status.critical, fontWeight: typography.weights.bold }}>{alt.tip}</Text>
                                        <Text style={{ color: colors.text.primary, fontSize: typography.sizes.label2 }}>Scor: {alt.scor_curent}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    scroll: { flex: 1, paddingHorizontal: layout.screenPaddingH },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    title: { fontSize: typography.sizes.title3, fontWeight: typography.weights.bold, color: colors.text.primary },
    subtitle: { fontSize: typography.sizes.caption, color: colors.text.secondary, marginTop: spacing[1] - 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    iconBtn: {
        height: 32,
        paddingHorizontal: spacing[2] + 2,
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 32,
    },
    iconBtnActive: {
        backgroundColor: colors.accent.default,
        borderColor: colors.accent.border,
    },
    iconBtnText: { color: colors.text.secondary, fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },
    badge: {
        position: 'absolute', top: -4, right: -4,
        backgroundColor: colors.status.critical,
        width: 16, height: 16,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: typography.sizes.micro - 1, fontWeight: typography.weights.heavy },
    statusDot: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radii.full, borderWidth: 1 },
    statusOnline: { backgroundColor: colors.tint.good, borderColor: colors.status.good },
    statusOffline: { backgroundColor: colors.tint.critical, borderColor: colors.status.critical },
    statusText: { fontSize: typography.sizes.micro, fontWeight: typography.weights.bold },

    // ── View Toggle ───────────────────────────────────────────────────────────
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1],
        borderRadius: radii.sm,
        marginHorizontal: layout.screenPaddingH,
        marginTop: spacing[2] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    toggleBtn: { flex: 1, paddingVertical: spacing[2] + 2, alignItems: 'center', borderRadius: radii.xs },
    toggleBtnActive: { backgroundColor: colors.bg[2], borderColor: colors.border.default, borderWidth: 1 },
    toggleText: { color: colors.text.secondary, fontWeight: typography.weights.bold, fontSize: typography.sizes.label2 },
    toggleTextActive: { color: colors.text.primary },

    // ── Simple Mode ───────────────────────────────────────────────────────────
    simpleContainer: { paddingTop: spacing[4] },
    kpiRow: { flexDirection: 'row', justifyContent: 'space-between' },
    kpiRowMt: { marginTop: spacing[3] },
    kpiCard: {
        width: '48.5%',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100,
    },
    kpiLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        marginBottom: spacing[1],
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: typography.sizes.hero,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
    },
    kpiUnit: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
    assistantCard: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border.default,
        marginTop: spacing[4],
        marginBottom: spacing[3],
        alignItems: 'center',
    },
    assistantText: {
        fontSize: typography.sizes.body,
        color: colors.text.secondary,
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: typography.sizes.body * 1.5,
    },
    alertCard: { marginBottom: spacing[3] },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing[3],
    },
    infoChip: {
        flex: 1,
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
    },
    infoChipLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        marginBottom: spacing[1],
        textTransform: 'uppercase',
    },
    infoChipValue: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
    },

    // ── Expert Mode ───────────────────────────────────────────────────────────
    chip: {
        backgroundColor: colors.bg[1],
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginRight: spacing[2],
    },
    chipActive: { backgroundColor: colors.accent.default, borderColor: colors.accent.border },
    chipText: { color: colors.text.secondary, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: {
        backgroundColor: colors.bg[1],
        width: '48%',
        padding: spacing[3] + 2,
        borderRadius: radii.md,
        marginBottom: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLarge: { width: '100%', paddingVertical: spacing[4] + 2 },
    cardLabel: {
        fontSize: typography.sizes.micro - 1,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        marginBottom: spacing[1] + 2,
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    val: { fontSize: typography.sizes.title2 + 2, fontWeight: typography.weights.heavy, color: colors.text.primary },
    valLarge: { fontSize: typography.sizes.hero, fontWeight: typography.weights.heavy },
    unit: { fontSize: typography.sizes.label2, color: colors.text.secondary, fontWeight: typography.weights.regular },
    tabular: { fontVariant: ['tabular-nums'] },

    // ── Oscilloscope ──────────────────────────────────────────────────────────
    chartContainer: {
        backgroundColor: colors.bg[1],
        padding: spacing[4],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], marginBottom: spacing[3] },
    zoomBtn: {
        width: 36, height: 28,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    zoomBtnText: { color: colors.text.secondary, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold },
    zoomLabel: { color: colors.accent.default, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, width: 30, textAlign: 'center' },
    chartWrapper: { alignItems: 'center' },
    chartTitle: {
        color: colors.text.primary,
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        alignSelf: 'flex-start',
        marginBottom: spacing[2],
    },
    crosshairBadge: {
        height: 40, width: 100,
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent.border,
    },
    crosshairValue: { color: colors.text.primary, fontSize: typography.sizes.label1, fontWeight: typography.weights.heavy },
    crosshairTime: { color: colors.text.secondary, fontSize: typography.sizes.micro - 1, marginTop: spacing[1] - 2 },

    // ── Modal ─────────────────────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing[5] },
    modalContent: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[4],
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        paddingBottom: spacing[3],
        marginBottom: spacing[3],
    },
    modalTitle: { color: colors.text.primary, fontSize: typography.sizes.title3, fontWeight: typography.weights.bold },
    closeBtn: {
        backgroundColor: colors.bg[2],
        width: 30, height: 30,
        borderRadius: radii.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    alertItem: {
        backgroundColor: colors.bg[2],
        borderLeftWidth: 4,
        borderLeftColor: colors.status.critical,
        padding: spacing[3],
        borderRadius: radii.xs,
        marginBottom: spacing[2] + 2,
    },
});

export default LiveDashboardScreen;
