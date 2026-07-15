import React, { useContext, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Platform, StatusBar } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { LiveContext } from '../context/LiveContext';
import { AlertContext } from '../context/AlertContext';
import { AppContext } from '../context/AppContext';
import { getVin } from '../utils/config';
import CircularGauge from '../components/CircularGauge';

const { width } = Dimensions.get('window');

const ESSENTIAL_KPIS = [
    { id: 'speed', label: 'Viteză', unit: 'km/h', color: '#3fb950', max: 220, extract: (d) => d.motor?.speed || 0 },
    { id: 'rpm', label: 'Turație', unit: 'RPM', color: '#ffffff', max: 5000, extract: (d) => d.motor?.rpm || 0 },
    { id: 'inst_cons', label: 'Consum', unit: 'L/h', color: '#d29922', max: 20, extract: (d) => d.combustibil?.inst_cons || 0 },
    { id: 'coolant', label: 'Temp. Apă', unit: '°C', color: '#58a6ff', max: 120, extract: (d) => d.temperaturi?.coolant || 0 },
    { id: 'boost_actual', label: 'Boost', unit: 'bar', color: '#3fb950', max: 2.5, extract: (d) => d.aer?.boost_actual || 0 },
    { id: 'ecu_volt', label: 'Voltaj', unit: 'V', color: '#7ee787', max: 16, extract: (d) => d.baterie?.ecu_volt || 0 },
];

const EXPERT_TABS = [
    { id: 'MOTOR', label: 'Motor' },
    { id: 'TEMP', label: 'Temperaturi' },
    { id: 'AER', label: 'Aer & Turbo' },
    { id: 'COMB', label: 'Combustibil' },
    { id: 'LAMBDA', label: 'Lambda' },
    { id: 'EMISII', label: 'Emisii & DPF' },
    { id: 'TRANS', label: 'Transmisie' },
    { id: 'ECU', label: 'ECU & Timp' },
];

const OSCILLOSCOPE_METRICS = [
    { id: 'rpm', label: 'RPM', color: '#ffffff', unit: 'RPM', defaultMax: 5000 },
    { id: 'speed', label: 'Viteză', color: '#3fb950', unit: 'km/h', defaultMax: 220 },
    { id: 'map', label: 'MAP', color: '#58a6ff', unit: 'kPa', defaultMax: 250 },
    { id: 'maf', label: 'MAF', color: '#d29922', unit: 'g/s', defaultMax: 150 },
    { id: 'inst_cons', label: 'Consum', color: '#f85149', unit: 'L/h', defaultMax: 20 },
    { id: 'coolant', label: 'Temp Apă', color: '#da3633', unit: '°C', defaultMax: 110 },
    { id: 'oil', label: 'Temp Ulei', color: '#d29922', unit: '°C', defaultMax: 130 },
    { id: 'ecu_volt', label: 'Voltaj', color: '#3fb950', unit: 'V', defaultMax: 16 },
    { id: 'rail_press', label: 'Rail Press', color: '#8b949e', unit: 'kPa', defaultMax: 40000 },
    { id: 'accel_g', label: 'G-Force', color: '#f85149', unit: 'G', defaultMax: 1.5 },
];

const LiveDashboardScreen = () => {
    const { isConnected, liveData, chartVersion, getChartHistory } = useContext(LiveContext);
    const { latestAlert, alertsList, unreadCount, markAlertsAsRead } = useContext(AlertContext);
    const { viewMode, setViewMode, selectedMetric, setSelectedMetric, activeTemplate, setActiveTemplate } = useContext(AppContext);

    const [showNotificationsModal, setShowNotificationsModal] = useState(false);
    const [expertMode, setExpertMode] = useState(false);
    const [activeTab, setActiveTab] = useState('MOTOR');
    const [zoomX, setZoomX] = useState(10);
    const [autoScaleY, setAutoScaleY] = useState(true);
    const [zoomYMult, setZoomYMult] = useState(1);

    const m = liveData.motor || {}; const t = liveData.temperaturi || {}; const a = liveData.aer || {};
    const c = liveData.combustibil || {}; const lam = liveData.lambda || {}; const ign = liveData.aprindere || {};
    const em = liveData.emisii || {}; const bat = liveData.baterie || {}; const dpf = liveData.dpf || {};
    const vvt = liveData.vvt || {}; const tr = liveData.transmisie || {}; const pr = liveData.presiuni || {};
    const tim = liveData.timp || {}; const meta = liveData.consum_meta || {}; const ecu = liveData.ecu || {};

    const renderCard = useCallback((label, val, unit, color = "#ffffff", isLarge = false) => {
        if (activeTemplate === 'CLASSIC') {
            let min = 0; let max = 100;
            if (unit === 'RPM') max = 5000;
            else if (unit === 'km/h') max = 220;
            else if (unit === '°C') max = (label.includes('CAT') || label.includes('EGT')) ? 800 : 130;
            else if (unit === 'kPa') max = label.includes('RAIL') ? 40000 : 300;
            else if (unit === 'bar') max = 2.5;
            else if (unit === 'V') max = 16;
            else if (unit === 'g/s') max = 150;
            else if (unit === 'L/h' || unit === 'L/100km') max = 20;
            else if (unit === 'Nm') max = 400;
            else if (unit === 'mg' || unit === 'mg/crs') max = 60;
            else if (unit === '°') { min = -10; max = 30; }
            const gaugeColor = color === "#ffffff" ? "#58a6ff" : color;
            return <CircularGauge key={label} label={label} value={val !== undefined ? val : 0} unit={unit} color={gaugeColor} min={min} max={max} size={width * 0.42} />;
        }
        return (
            <View key={label} style={[styles.card, isLarge && styles.cardLarge, { borderColor: color === "#ffffff" ? "#30363d" : color }]}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={[styles.val, isLarge && styles.valLarge, { color }]}>{val !== undefined ? val : 0} <Text style={styles.unit}>{unit}</Text></Text>
            </View>
        );
    }, [activeTemplate]);

    // =========================================================================
    // DEFAULT VIEW — 6 KPI-uri esențiale
    // =========================================================================
    const renderEssentialView = () => (
        <View style={styles.essentialGrid}>
            {ESSENTIAL_KPIS.map(kpi => (
                <CircularGauge
                    key={kpi.id}
                    label={kpi.label}
                    value={kpi.extract(liveData)}
                    unit={kpi.unit}
                    color={kpi.color}
                    min={0}
                    max={kpi.max}
                    size={width * 0.42}
                />
            ))}
            <View style={styles.ecoCard}>
                <Text style={styles.ecoLabel}>Eco Score</Text>
                <Text style={[styles.ecoValue, { color: (liveData.scor_eco || 100) >= 80 ? '#3fb950' : '#d29922' }]}>
                    {liveData.scor_eco || 100}
                </Text>
                <Text style={styles.ecoUnit}>/ 100</Text>
            </View>
            <View style={styles.ecoCard}>
                <Text style={styles.ecoLabel}>Treaptă</Text>
                <Text style={[styles.ecoValue, { color: '#58a6ff' }]}>{tr.gear || 'N'}</Text>
                <Text style={styles.ecoUnit}>gear</Text>
            </View>
        </View>
    );

    // =========================================================================
    // EXPERT MODE — toate categoriile
    // =========================================================================
    const renderExpertView = () => (
        <View style={{ flex: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {EXPERT_TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.chip, activeTab === tab.id && styles.chipActive]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Text style={[styles.chipText, activeTab === tab.id && { color: '#fff' }]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.grid}>
                {activeTab === 'MOTOR' && [
                    renderCard("RPM", m.rpm || 0, "RPM"),
                    renderCard("Viteză", m.speed || 0, "km/h", "#3fb950"),
                    renderCard("Sarcină", m.load || 0, "%"),
                    renderCard("Clapetă", m.throttle_pos || 0, "%", "#58a6ff"),
                    renderCard("Pedală D", m.pedal_d || 0, "%", "#d29922"),
                    renderCard("Cuplu Motor", m.torque_engine || 0, "Nm", "#3fb950"),
                    renderCard("Cuplu Cerut", m.torque_driver || 0, "Nm", "#d29922"),
                    renderCard("Cuplu Fricțiune", m.torque_friction || 0, "Nm", "#f85149"),
                ]}
                {activeTab === 'TEMP' && [
                    renderCard("Lichid Răcire", t.coolant || 0, "°C", (t.coolant || 0) > 95 ? "#f85149" : "#58a6ff"),
                    renderCard("Aer Admisie (IAT)", t.iat || 0, "°C", "#58a6ff"),
                    renderCard("Ambient", t.ambient || 0, "°C", "#8b949e"),
                    renderCard("Ulei Motor", t.oil || 0, "°C", "#d29922"),
                    renderCard("Catalizator B1S1", t.cat_b1s1 || 0, "°C", "#f85149"),
                    renderCard("Catalizator B1S2", t.cat_b1s2 || 0, "°C", "#f85149"),
                ]}
                {activeTab === 'AER' && [
                    renderCard("MAF (Debit Aer)", a.maf || 0, "g/s", "#d29922"),
                    renderCard("MAP (Presiune)", a.map || 101, "kPa", "#58a6ff"),
                    renderCard("Barometric", a.baro || 101, "kPa", "#8b949e"),
                    renderCard("Boost Turbo", a.boost_turbo || 0, "bar", "#3fb950"),
                    renderCard("Boost Comandat", a.boost_cmd || 0, "bar", "#d29922"),
                    renderCard("Boost Efectiv", a.boost_actual || 0, "bar", "#3fb950", true),
                ]}
                {activeTab === 'COMB' && [
                    renderCard("Nivel Combustibil", c.level || 0, "%", "#3fb950"),
                    renderCard("Presiune Rail", c.rail_press || 0, "kPa", "#d29922"),
                    renderCard("Timing Injecție", c.inj_timing || 0, "°", "#f85149"),
                    renderCard("Cantitate Inj.", c.inj_qty || 0, "mg/crs", "#3fb950"),
                    renderCard("Consum Instant", c.inst_cons || 0, "L/h"),
                    renderCard("Consum Mediu", c.avg_cons || 0, "L/100km", "#3fb950"),
                    renderCard("Fuel Trim SFT", c.sft_b1 || 0, "%", "#8b949e"),
                    renderCard("Fuel Trim LFT", c.lft_b1 || 0, "%", "#8b949e"),
                ]}
                {activeTab === 'LAMBDA' && [
                    renderCard("O2 B1S1", lam.o2_b1s1 || 0, "V", "#58a6ff"),
                    renderCard("O2 B1S2", lam.o2_b1s2 || 0, "V", "#8b949e"),
                    renderCard("Wideband B1S1", lam.wb_b1s1 || 0, "λ", "#3fb950"),
                    renderCard("Lambda Comandat", lam.cmd_lambda || 0, "λ"),
                    renderCard("Avans Aprindere", ign.timing_adv || 0, "°", "#d29922"),
                    renderCard("Knock Retard", ign.knock_retard || 0, "°", "#3fb950"),
                ]}
                {activeTab === 'EMISII' && [
                    renderCard("EGR Comandat", em.egr_cmd || 0, "%", "#58a6ff"),
                    renderCard("EGR Eroare", em.egr_error || 0, "%", "#3fb950"),
                    renderCard("DPF Presiune Dif.", dpf.diff_press || 0, "kPa", "#d29922"),
                    renderCard("DPF Funingine", dpf.soot_load || 0, "g", "#f85149"),
                    renderCard("DPF Regenerare", dpf.regen_status || "OFF", "-", "#3fb950"),
                    renderCard("EGT Sensor 1", dpf.egt1 || 0, "°C", "#f85149"),
                    renderCard("EGT Sensor 2", dpf.egt2 || 0, "°C", "#8b949e"),
                ]}
                {activeTab === 'TRANS' && [
                    renderCard("Temp. Transmisie", tr.trans_temp || 0, "°C", "#d29922"),
                    renderCard("Treaptă Curentă", tr.gear || 0, "Tr.", "#3fb950"),
                    renderCard("Alunecare Conv.", tr.slip || 0, "RPM", "#8b949e"),
                    renderCard("Camshaft Intake", vvt.cam_intake || 0, "°", "#58a6ff"),
                    renderCard("Presiune Ulei", pr.oil_press || 0, "bar", "#3fb950"),
                    renderCard("Presiune Evacuare", pr.exhaust_press || 0, "kPa", "#8b949e"),
                ]}
                {activeTab === 'ECU' && [
                    renderCard("Voltaj ECU", bat.ecu_volt || 0, "V", "#3fb950"),
                    renderCard("Voltaj Baterie", bat.bat_volt || 0, "V"),
                    renderCard("Timp Funcționare", tim.run_time || 0, "sec", "#58a6ff"),
                    renderCard("Warmups", tim.warmups || 0, "cicluri", "#3fb950"),
                    renderCard("Dist. de la DTC Clear", meta.dist_dtc || 0, "km", "#58a6ff"),
                    renderCard("Ore Motor", meta.engine_hours || 0, "ore"),
                    renderCard("VIN", ecu.vin || getVin(), "-", "#58a6ff", true),
                ]}
            </View>
        </View>
    );

    // =========================================================================
    // OSCILOSCOP — limitat la ultimele 60 puncte (1 minut vizibil)
    // =========================================================================
    const chartHistory = useMemo(() => getChartHistory(), [chartVersion]);

    const renderChartView = () => {
        const config = OSCILLOSCOPE_METRICS.find(m => m.id === selectedMetric) || OSCILLOSCOPE_METRICS[0];
        const maxPoints = Math.floor((width - 80) / zoomX);
        const slicedHistory = chartHistory.slice(-maxPoints);
        const visibleData = slicedHistory.map(item => ({
            value: Number(item[config.id]) || 0,
            label: item.label || '',
            secunda: item.secunda || 0
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {OSCILLOSCOPE_METRICS.map(metric => (
                        <TouchableOpacity
                            key={metric.id}
                            style={[styles.chip, selectedMetric === metric.id && { backgroundColor: metric.color, borderColor: metric.color }]}
                            onPress={() => setSelectedMetric(metric.id)}
                        >
                            <Text style={[styles.chipText, selectedMetric === metric.id && { color: '#000' }]}>{metric.label}</Text>
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
                    <View style={{ width: 20 }} />
                    <TouchableOpacity style={[styles.zoomBtn, autoScaleY && { backgroundColor: '#238636', borderColor: '#238636' }]} onPress={() => setAutoScaleY(true)}>
                        <Text style={[styles.zoomBtnText, autoScaleY && { color: '#fff' }]}>Auto</Text>
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
                        data={visibleData} width={width - 80} height={200} color={config.color} thickness={2.5}
                        dataPointsColor={config.color} dataPointsRadius={1} maxValue={maxValue} stepValue={stepValue}
                        noOfSections={4} spacing={zoomX} yAxisTextStyle={{ color: '#8b949e', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: '#8b949e', fontSize: 9 }} rulesColor="#21262d" rulesType="solid"
                        initialSpacing={10} endSpacing={10} isAnimated={false}
                        pointerConfig={{
                            pointerStripHeight: 200, pointerStripColor: 'rgba(139, 148, 158, 0.4)', pointerStripWidth: 2,
                            pointerColor: config.color, radius: 4, pointerLabelWidth: 100, pointerLabelHeight: 40,
                            activatePointersOnLongPress: false, autoAdjustPointerLabelPosition: true,
                            pointerLabelComponent: items => {
                                if (!items || !items[0]) return null;
                                return (
                                    <View style={styles.crosshairBadge}>
                                        <Text style={styles.crosshairValue}>{items[0].value} <Text style={{ fontSize: 9, color: config.color }}>{config.unit}</Text></Text>
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

    return (
        <View style={styles.mainContainer}>
            {/* Alert toast */}
            {latestAlert && (
                <View style={styles.floatingToast}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.toastTitle}>Frânare bruscă ({latestAlert.g}G)</Text>
                        <Text style={styles.toastDesc}>Eco Score: {latestAlert.scor_curent}/100</Text>
                    </View>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Live</Text>
                    <Text style={styles.subtitle}>Audi A6 C4 · 2.5 TDI</Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setActiveTemplate(activeTemplate === 'DIGITAL' ? 'CLASSIC' : 'DIGITAL')}>
                        <Text style={styles.iconBtnText}>{activeTemplate === 'DIGITAL' ? 'G' : 'D'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.iconBtn} onPress={() => { markAlertsAsRead(); setShowNotificationsModal(true); }}>
                        <Text style={styles.iconBtnText}>N</Text>
                        {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
                    </TouchableOpacity>

                    <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]}>
                        <Text style={[styles.statusText, { color: isConnected ? '#3fb950' : '#f85149' }]}>
                            {isConnected ? 'ON' : 'OFF'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* View toggle */}
            <View style={styles.viewToggle}>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'COCKPIT' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('COCKPIT')}
                >
                    <Text style={[styles.toggleText, viewMode === 'COCKPIT' && styles.toggleTextActive]}>
                        {expertMode ? 'Expert' : 'Esențial'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleBtn, viewMode === 'CHART' && styles.toggleBtnActive]}
                    onPress={() => setViewMode('CHART')}
                >
                    <Text style={[styles.toggleText, viewMode === 'CHART' && styles.toggleTextActive]}>Osciloscop</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 50 }}>
                {/* Expert mode toggle (inside scroll, only in COCKPIT) */}
                {viewMode === 'COCKPIT' && (
                    <TouchableOpacity
                        style={[styles.expertToggle, expertMode && styles.expertToggleActive]}
                        onPress={() => setExpertMode(!expertMode)}
                    >
                        <Text style={[styles.expertToggleText, expertMode && { color: '#ffffff' }]}>
                            {expertMode ? 'Mod Simplu' : 'Mod Expert (90+ PID)'}
                        </Text>
                    </TouchableOpacity>
                )}
                {viewMode === 'COCKPIT'
                    ? (expertMode ? renderExpertView() : renderEssentialView())
                    : renderChartView()
                }
            </ScrollView>

            {/* Notifications modal */}
            <Modal visible={showNotificationsModal} transparent animationType="slide" onRequestClose={() => setShowNotificationsModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Alerte Sesiune</Text>
                            <TouchableOpacity onPress={() => setShowNotificationsModal(false)} style={styles.closeBtn}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>X</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {alertsList.length === 0 ? (
                                <Text style={{ color: '#3fb950', textAlign: 'center', padding: 20 }}>Nicio alertă.</Text>
                            ) : (
                                alertsList.map((alt) => (
                                    <View key={alt.id} style={styles.alertItem}>
                                        <Text style={{ color: '#ff7b72', fontWeight: '700' }}>{alt.tip}</Text>
                                        <Text style={{ color: '#c9d1d9', fontSize: 12 }}>Scor: {alt.scor_curent}</Text>
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
    mainContainer: { flex: 1, backgroundColor: '#0d1117', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44 },
    scroll: { flex: 1, paddingHorizontal: 16 },
    floatingToast: {
        position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 12 : 48,
        left: 16, right: 16, backgroundColor: '#3b2322', borderWidth: 1, borderColor: '#f85149',
        borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', zIndex: 1000,
    },
    toastTitle: { color: '#ff7b72', fontWeight: '800', fontSize: 13 },
    toastDesc: { color: '#c9d1d9', fontSize: 11, marginTop: 2 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#21262d',
    },
    title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    subtitle: { fontSize: 11, color: '#8b949e', marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: { width: 32, height: 32, backgroundColor: '#161b22', borderRadius: 16, borderWidth: 1, borderColor: '#30363d', justifyContent: 'center', alignItems: 'center' },
    iconBtnText: { color: '#8b949e', fontSize: 12, fontWeight: '700' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#da3633', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
    statusDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    statusOnline: { backgroundColor: '#122d1e', borderColor: '#238636' },
    statusOffline: { backgroundColor: '#3b2322', borderColor: '#da3633' },
    statusText: { fontSize: 10, fontWeight: '700' },
    viewToggle: {
        flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 8,
        marginHorizontal: 16, marginTop: 10, borderWidth: 1, borderColor: '#30363d',
    },
    toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1 },
    toggleText: { color: '#8b949e', fontWeight: '700', fontSize: 12 },
    toggleTextActive: { color: '#ffffff' },
    expertToggle: {
        marginBottom: 12, paddingVertical: 8, alignItems: 'center',
        backgroundColor: '#161b22', borderRadius: 6, borderWidth: 1, borderColor: '#30363d',
    },
    expertToggleActive: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
    expertToggleText: { color: '#8b949e', fontSize: 11, fontWeight: '700' },
    essentialGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 10 },
    ecoCard: {
        width: '48%', backgroundColor: '#161b22', borderRadius: 10, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: '#30363d', alignItems: 'center', justifyContent: 'center',
    },
    ecoLabel: { fontSize: 10, color: '#8b949e', fontWeight: '700', marginBottom: 4 },
    ecoValue: { fontSize: 32, fontWeight: '900' },
    ecoUnit: { fontSize: 11, color: '#8b949e' },
    chip: { backgroundColor: '#161b22', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#30363d', marginRight: 8 },
    chipActive: { backgroundColor: '#1f6feb', borderColor: '#58a6ff' },
    chipText: { color: '#8b949e', fontSize: 11, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { backgroundColor: '#161b22', width: '48%', padding: 14, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#30363d', alignItems: 'center', justifyContent: 'center' },
    cardLarge: { width: '100%', paddingVertical: 18 },
    cardLabel: { fontSize: 9, color: '#8b949e', fontWeight: '700', marginBottom: 6, textAlign: 'center', textTransform: 'uppercase' },
    val: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
    valLarge: { fontSize: 32, fontWeight: '900' },
    unit: { fontSize: 12, color: '#8b949e', fontWeight: 'normal' },
    chartContainer: { backgroundColor: '#161b22', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#30363d' },
    zoomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
    zoomBtn: { width: 36, height: 28, backgroundColor: '#21262d', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
    zoomBtnText: { color: '#8b949e', fontSize: 10, fontWeight: '700' },
    zoomLabel: { color: '#58a6ff', fontSize: 11, fontWeight: '700', width: 30, textAlign: 'center' },
    chartWrapper: { alignItems: 'center' },
    chartTitle: { color: '#fff', fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8 },
    crosshairBadge: { height: 40, width: 100, backgroundColor: '#21262d', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#58a6ff' },
    crosshairValue: { color: '#fff', fontSize: 13, fontWeight: '900' },
    crosshairTime: { color: '#8b949e', fontSize: 9, marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1, borderColor: '#30363d', padding: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#21262d', paddingBottom: 12, marginBottom: 12 },
    modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    closeBtn: { backgroundColor: '#21262d', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    alertItem: { backgroundColor: '#21262d', borderLeftWidth: 4, borderLeftColor: '#f85149', padding: 12, borderRadius: 6, marginBottom: 10 },
});

export default LiveDashboardScreen;
