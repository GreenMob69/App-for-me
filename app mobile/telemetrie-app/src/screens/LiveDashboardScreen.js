import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Platform, StatusBar } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { TelemetryContext } from '../context/TelemetryContext';
import CircularGauge from '../components/CircularGauge';

const { width } = Dimensions.get('window');

// LISTA COMPLETĂ DE SENZORI PENTRU OSCILOSCOP
const OSCILLOSCOPE_METRICS = [
    { id: 'rpm', label: 'RPM Motor', color: '#ffffff', unit: 'RPM', defaultMax: 5000 },
    { id: 'speed', label: 'Viteză', color: '#3fb950', unit: 'km/h', defaultMax: 220 },
    { id: 'map', label: 'Turbo (MAP)', color: '#58a6ff', unit: 'kPa', defaultMax: 250 },
    { id: 'maf', label: 'Aer (MAF)', color: '#d29922', unit: 'g/s', defaultMax: 150 },
    { id: 'inst_cons', label: 'Consum L/h', color: '#f85149', unit: 'L/h', defaultMax: 20 },
    { id: 'rail_press', label: 'Presiune Rampă', color: '#8b949e', unit: 'kPa', defaultMax: 40000 },
    { id: 'coolant', label: 'Temp Apă', color: '#da3633', unit: '°C', defaultMax: 110 },
    { id: 'oil', label: 'Temp Ulei', color: '#d29922', unit: '°C', defaultMax: 130 },
    { id: 'ecu_volt', label: 'Voltaj ECU', color: '#3fb950', unit: 'V', defaultMax: 16 },
    { id: 'accel_g', label: 'Forță G', color: '#f85149', unit: 'G', defaultMax: 1.5 },
];

const LiveDashboardScreen = () => {
    const {
        isConnected, viewMode, setViewMode, 
        selectedMetric, setSelectedMetric,
        liveData, chartHistory, latestAlert, alertsList, unreadCount, markAlertsAsRead,
        activeTemplate, setActiveTemplate 
    } = useContext(TelemetryContext);

    const [showNotificationsModal, setShowNotificationsModal] = useState(false);
    const [activeTab, setActiveTab] = useState('REZUMAT'); 

    // CONTROALE DE ZOOM (X și Y) PENTRU OSCILOSCOP
    const [zoomX, setZoomX] = useState(10); 
    const [zoomYMult, setZoomYMult] = useState(1); 
    const [autoScaleY, setAutoScaleY] = useState(true);

    const handleZoomInX = () => setZoomX(prev => Math.min(prev + 5, 40));
    const handleZoomOutX = () => setZoomX(prev => Math.max(prev - 5, 2));
    const handleZoomInY = () => { setAutoScaleY(false); setZoomYMult(prev => Math.max(prev - 0.2, 0.2)); };
    const handleZoomOutY = () => { setAutoScaleY(false); setZoomYMult(prev => Math.min(prev + 0.2, 3)); };

    const handleOpenNotifications = () => { markAlertsAsRead(); setShowNotificationsModal(true); };

    // Extragere completă din obiectul complex JSON
    const m = liveData.motor || {}; const t = liveData.temperaturi || {}; const a = liveData.aer || {};
    const c = liveData.combustibil || {}; const lam = liveData.lambda || {}; const ign = liveData.aprindere || {};
    const em = liveData.emisii || {}; const bat = liveData.baterie || {}; const dpf = liveData.dpf || {};
    const vvt = liveData.vvt || {}; const tr = liveData.transmisie || {}; const pr = liveData.presiuni || {};
    const tim = liveData.timp || {}; const meta = liveData.consum_meta || {}; const ext = liveData.senzori_extra || {};
    const dtc = liveData.dtc || {}; const ecu = liveData.ecu || {};

    const renderCard = (label, val, unit, color = "#ffffff", sub = null, isLarge = false) => {
        if (activeTemplate === 'CLASSIC') {
            let min = 0; let max = 100;
            if (unit === 'RPM') max = 5000;
            else if (unit === 'km/h') max = 220;
            else if (unit === '°C') max = (label.includes('CAT') || label.includes('EXHAUST')) ? 800 : 130;
            else if (unit === 'kPa') max = label.includes('RAIL') ? 40000 : 300;
            else if (unit === 'bar') max = 2.5;
            else if (unit === 'V') max = 16;
            else if (unit === 'g/s') max = 150;
            else if (unit === 'L/h' || unit === 'L/100km') max = 20;
            else if (unit === 'Nm') max = 400;
            else if (unit === 'mg' || unit === 'mg/crs') max = 60;
            else if (unit === '°') { min = -10; max = 30; }
            else if (unit === 'λ') max = 2;
            else if (unit === 'km') max = 500000;
            else if (unit === 'sec' || unit === 'ore') max = 10000;
            
            const gaugeColor = color === "#ffffff" ? "#58a6ff" : color;
            return <CircularGauge key={label} label={label} value={val !== undefined ? val : 0} unit={unit} color={gaugeColor} min={min} max={max} size={width * 0.42} />;
        }
        return (
            <View key={label} style={[styles.card, isLarge && styles.cardLarge, { borderColor: color === "#ffffff" ? "#30363d" : color }]}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={[styles.val, isLarge && styles.valLarge, { color: color }]}>{val !== undefined ? val : 0} <Text style={styles.unit}>{unit}</Text></Text>
                {sub && <Text style={styles.cardSub}>{sub}</Text>}
            </View>
        );
    };

    // =========================================================================
    // MODUL COCKPIT (CU TOATE CELE 9 CATEGORII ȘI 90+ PARAMETRI)
    // =========================================================================
    const renderCockpitView = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.filterSection}>
                <Text style={styles.filterTitle}>⚙️ SELECTEAZĂ GRUPUL DE PARAMETRI SAE J1979 & UDS:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {[
                        { id: 'REZUMAT', label: '🌐 REZUMAT ECU (KPI)' },
                        { id: 'MOTOR', label: '🏎️ MOTOR & CUPLU (19 PID)' },
                        { id: 'TEMP', label: '🌡️ TEMPERATURI (8 PID)' },
                        { id: 'AER', label: '🌀 AER & TURBO (8 PID)' },
                        { id: 'COMB', label: '⛽ COMBUSTIBIL & INJECȚIE (14 PID)' },
                        { id: 'LAMBDA', label: '⚡ LAMBDA & APRINDERE (12 PID)' },
                        { id: 'EMISII', label: '🛡️ EMISII & DPF (15 PID)' },
                        { id: 'TRANS', label: '⚙️ TRANSMISIE, VVT & PRESIUNI (10 PID)' },
                        { id: 'ECU', label: '⏱️ TIMP, ORE & HARDWARE ECU (12 PID)' }
                    ].map((tab) => (
                        <TouchableOpacity key={tab.id} style={[styles.chip, activeTab === tab.id && styles.chipActive]} onPress={() => setActiveTab(tab.id)}>
                            <Text style={[styles.chipText, activeTab === tab.id && { color: '#fff' }]}>{tab.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.grid}>
                {activeTab === 'REZUMAT' && [
                    renderCard("VITEZĂ VEHICUL (0x0D)", m.speed || 0, "km/h", "#3fb950", `Treaptă curentă: Tr. ${tr.gear || 1}`, true),
                    renderCard("TURAȚIE MOTOR (0x0C)", m.rpm || 0, "RPM", "#fff", "Plajă optimă Diesel"),
                    renderCard("SARCINĂ MOTOR (0x04)", m.load || 0, "%", "#fff", "Efort de tracțiune"),
                    renderCard("PRESIUNE TURBO (MAP)", a.map || 101, "kPa", "#58a6ff", `Boost efectiv: ${a.boost_actual || 0} bar`),
                    renderCard("DEBIT AER ADMISIE (MAF)", a.maf || 0, "g/s", "#d29922", "SAE J1979 PID 0x10"),
                    renderCard("CONSUM COMBUSTIBIL", c.inst_cons || 0, (m.speed || 0) > 3 ? "L/100km" : "L/h", "#d29922", "Calcul stoechiometric"),
                    renderCard("TEMP. LICHID RĂCIRE", t.coolant || 35, "°C", (t.coolant || 35) > 95 ? "#da3633" : "#fff", "PID 0x05"),
                    renderCard("SCOR ECO-DRIVING", liveData.scor_eco || 100, "pct", "#3fb950", "Algoritm G-Force"),
                    renderCard("VOLTAJ ECU & ALTERNATOR", bat.ecu_volt || 14.1, "V", "#3fb950", "Terminal 30 / 15", true)
                ]}

                {activeTab === 'MOTOR' && [
                    renderCard("TURAȚIE MOTOR (RPM)", m.rpm || 0, "RPM", "#fff", "0x0C"),
                    renderCard("VITEZĂ VEHICUL", m.speed || 0, "km/h", "#3fb950", "0x0D"),
                    renderCard("SARCINĂ MOTOR (LOAD)", m.load || 0, "%", "#fff", "0x04"),
                    renderCard("SARCINĂ CALCULATĂ", m.calc_load || 0, "%", "#8b949e"),
                    renderCard("SARCINĂ ABSOLUTĂ", m.abs_load || 0, "%", "#8b949e", "0x43"),
                    renderCard("POZIȚIE CLAPETĂ (THR)", m.throttle_pos || 0, "%", "#58a6ff", "0x11"),
                    renderCard("THR POS ABSOLUTE B", m.abs_throttle_b || 0, "%", "#8b949e"),
                    renderCard("THR POS ABSOLUTE C", m.abs_throttle_c || 0, "%", "#8b949e"),
                    renderCard("PEDAL POSITION D", m.pedal_d || 0, "%", "#d29922"),
                    renderCard("PEDAL POSITION E", m.pedal_e || 0, "%", "#8b949e"),
                    renderCard("PEDAL POSITION F", m.pedal_f || 0, "%", "#8b949e"),
                    renderCard("RELATIVE THROTTLE POS", m.rel_throttle || 0, "%", "#8b949e"),
                    renderCard("COMMANDED THROTTLE ACT", m.commanded_throttle || 0, "%", "#58a6ff"),
                    renderCard("IDLE CONTROL POSITION", m.idle_pos || 0, "%", "#8b949e"),
                    renderCard("ENGINE TORQUE", m.torque_engine || 0, "Nm", "#3fb950"),
                    renderCard("DRIVER DEMAND TORQUE", m.torque_driver || 0, "Nm", "#d29922"),
                    renderCard("ACTUAL ENGINE TORQUE", m.torque_actual || 0, "Nm", "#3fb950", "VAG OEM"),
                    renderCard("ENGINE FRICTION TORQUE", m.torque_friction || 0, "Nm", "#f85149")
                ]}

                {activeTab === 'TEMP' && [
                    renderCard("COOLANT TEMP (G62)", t.coolant || 35, "°C", "#fff", "0x05"),
                    renderCard("INTAKE AIR TEMP (IAT)", t.iat || 25, "°C", "#58a6ff", "0x0F"),
                    renderCard("AMBIENT AIR TEMP", t.ambient || 18, "°C", "#8b949e", "0x46"),
                    renderCard("ENGINE OIL TEMP", t.oil || 20, "°C", "#d29922", "0x5C / VAG"),
                    renderCard("CATALYST TEMP B1S1", t.cat_b1s1 || 150, "°C", "#f85149", "0x3C"),
                    renderCard("CATALYST TEMP B1S2", t.cat_b1s2 || 140, "°C", "#f85149", "0x3E"),
                    renderCard("CATALYST TEMP B2S1", t.cat_b2s1 || 145, "°C", "#8b949e"),
                    renderCard("CATALYST TEMP B2S2", t.cat_b2s2 || 135, "°C", "#8b949e")
                ]}

                {activeTab === 'AER' && [
                    renderCard("MAF AIR FLOW", a.maf || 0, "g/s", "#d29922", "0x10"),
                    renderCard("MAP PRESSURE", a.map || 101, "kPa", "#58a6ff", "0x0B"),
                    renderCard("BAROMETRIC PRESSURE", a.baro || 101, "kPa", "#8b949e", "0x33"),
                    renderCard("INTAKE MANIFOLD PRESS", a.intake_press || 101, "kPa", "#8b949e"),
                    renderCard("INTAKE VACUUM", a.vacuum || 15, "kPa", "#58a6ff"),
                    renderCard("TURBO BOOST PRESSURE", a.boost_turbo || 0, "bar", "#3fb950"),
                    renderCard("COMMANDED BOOST", a.boost_cmd || 0, "bar", "#d29922", "VAG Target"),
                    renderCard("ACTUAL BOOST DELIVERED", a.boost_actual || 0, "bar", "#3fb950", "VAG Actual", true)
                ]}

                {activeTab === 'COMB' && [
                    renderCard("FUEL LEVEL", c.level || 75, "%", "#3fb950", "0x2F"),
                    renderCard("FUEL PRESSURE", c.press || 350, "kPa", "#8b949e", "0x0A"),
                    renderCard("FUEL RAIL PRESSURE", c.rail_press || 35000, "kPa", "#d29922", "0x23 / Diesel"),
                    renderCard("FUEL RAIL GAUGE PRESS", c.rail_gauge || 34900, "kPa", "#8b949e"),
                    renderCard("COMMANDED FUEL PRESS", c.cmd_press || 35000, "kPa", "#58a6ff"),
                    renderCard("FUEL INJECTION TIMING", c.inj_timing || 2.5, "°", "#f85149", "0x5D Avans"),
                    renderCard("INJECTION QUANTITY", c.inj_qty || 6.5, "mg/crs", "#3fb950", "VP37 Bosch"),
                    renderCard("ENGINE FUEL RATE", c.fuel_rate || 0.8, "L/h", "#d29922", "0x5E"),
                    renderCard("INSTANT CONSUMPTION", c.inst_cons || 0.8, "L/h", "#fff"),
                    renderCard("AVERAGE CONSUMPTION", c.avg_cons || 6.8, "L/100km", "#3fb950"),
                    renderCard("FUEL TRIM SFT B1", c.sft_b1 || 0, "%", "#8b949e", "0x06"),
                    renderCard("FUEL TRIM LFT B1", c.lft_b1 || 1.2, "%", "#8b949e", "0x07"),
                    renderCard("FUEL TRIM SFT B2", c.sft_b2 || 0, "%", "#8b949e", "0x08"),
                    renderCard("FUEL TRIM LFT B2", c.lft_b2 || 1.1, "%", "#8b949e", "0x09")
                ]}

                {activeTab === 'LAMBDA' && [
                    renderCard("O2 SENSOR B1S1", lam.o2_b1s1 || 0.85, "V", "#58a6ff", "0x14"),
                    renderCard("O2 SENSOR B1S2", lam.o2_b1s2 || 0.75, "V", "#8b949e", "0x15"),
                    renderCard("O2 SENSOR B2S1", lam.o2_b2s1 || 0.84, "V", "#8b949e"),
                    renderCard("O2 SENSOR B2S2", lam.o2_b2s2 || 0.74, "V", "#8b949e"),
                    renderCard("WIDEBAND LAMBDA B1S1", lam.wb_b1s1 || 1.01, "λ", "#3fb950", "0x24"),
                    renderCard("WIDEBAND LAMBDA B1S2", lam.wb_b1s2 || 1.00, "λ", "#8b949e"),
                    renderCard("WIDEBAND LAMBDA B2S1", lam.wb_b2s1 || 1.01, "λ", "#8b949e"),
                    renderCard("WIDEBAND LAMBDA B2S2", lam.wb_b2s2 || 1.00, "λ", "#8b949e"),
                    renderCard("COMMANDED LAMBDA", lam.cmd_lambda || 1.00, "λ", "#fff"),
                    renderCard("TIMING ADVANCE", ign.timing_adv || 6.5, "°", "#d29922", "0x0E"),
                    renderCard("IGNITION TIMING", ign.ign_timing || 6.0, "°", "#8b949e"),
                    renderCard("KNOCK RETARD", ign.knock_retard || 0.0, "°", "#3fb950", "Detonație zero")
                ]}

                {activeTab === 'EMISII' && [
                    renderCard("EGR COMMANDED", em.egr_cmd || 15, "%", "#58a6ff", "0x2C"),
                    renderCard("EGR ERROR", em.egr_error || 0.5, "%", "#3fb950", "0x2D"),
                    renderCard("EVAP VAPOR PRESS", em.evap_press || -1.2, "Pa", "#8b949e", "0x32"),
                    renderCard("EVAP PURGE", em.evap_purge || 12.0, "%", "#8b949e"),
                    renderCard("SECONDARY AIR STATUS", em.sec_air || "OFF", "-", "#8b949e", "0x12"),
                    renderCard("CATALYST MONITOR", em.cat_mon || "PASSED", "-", "#3fb950"),
                    renderCard("MISFIRE MONITOR", em.misfire_mon || "PASSED", "-", "#3fb950"),
                    renderCard("OBD READINESS", em.readiness || "READY", "-", "#3fb950", "Mod $01"),
                    renderCard("DPF DIFF PRESSURE", dpf.diff_press || 4.2, "kPa", "#d29922", "Senzor presiune filtru"),
                    renderCard("DPF SOOT LOAD", dpf.soot_load || 12.4, "g", "#f85149", "Încărcare funingine"),
                    renderCard("DPF REGENERATION", dpf.regen_status || "OFF", "-", "#3fb950", "Status activare"),
                    renderCard("EXHAUST GAS TEMP 1", dpf.egt1 || 150, "°C", "#f85149", "EGT Sensor 1"),
                    renderCard("EXHAUST GAS TEMP 2", dpf.egt2 || 135, "°C", "#8b949e", "EGT Sensor 2"),
                    renderCard("EXHAUST GAS TEMP 3", dpf.egt3 || 120, "°C", "#8b949e"),
                    renderCard("EXHAUST GAS TEMP 4", dpf.egt4 || 105, "°C", "#8b949e")
                ]}

                {activeTab === 'TRANS' && [
                    renderCard("TRANSMISSION TEMP", tr.trans_temp || 45, "°C", "#d29922", "ATF Temp VAG"),
                    renderCard("CURRENT GEAR", tr.gear || 1, "Tr.", "#3fb950", "TCU / Algoritmic"),
                    renderCard("TORQUE CONV SLIP", tr.slip || 15, "RPM", "#8b949e", "Alunecare convertizor"),
                    renderCard("INTAKE CAMSHAFT POS", vvt.cam_intake || 12.0, "°", "#58a6ff", "VVT Bank 1"),
                    renderCard("EXHAUST CAMSHAFT POS", vvt.cam_exhaust || -8.0, "°", "#8b949e", "VVT Bank 2"),
                    renderCard("COMMANDED VVT", vvt.cmd_vvt || 12.0, "°", "#fff"),
                    renderCard("ABSOLUTE FUEL PRESS", pr.abs_fuel || 450, "kPa", "#8b949e"),
                    renderCard("ENGINE OIL PRESSURE", pr.oil_press || 2.5, "bar", "#3fb950", "Senzor presiune ulei"),
                    renderCard("EXHAUST PRESSURE", pr.exhaust_press || 115, "kPa", "#8b949e"),
                    renderCard("INTAKE PRESS (ALT)", pr.intake_press_alt || 101, "kPa", "#8b949e")
                ]}

                {activeTab === 'ECU' && [
                    renderCard("CONTROL MODULE VOLT", bat.ecu_volt || 14.1, "V", "#3fb950", "0x42 / Terminal 30"),
                    renderCard("BATTERY VOLTAGE", bat.bat_volt || 12.6, "V", "#fff", "Tensiune pură"),
                    renderCard("ENGINE RUN TIME", tim.run_time || 0, "sec", "#58a6ff", "0x1F"),
                    renderCard("TIME SINCE START", tim.time_start || 0, "sec", "#8b949e"),
                    renderCard("TIME SINCE DTC CLEAR", tim.time_dtc_cleared || 142000, "sec", "#8b949e"),
                    renderCard("WARM-UPS SINCE CLEAR", tim.warmups || 42, "cicluri", "#3fb950", "0x30"),
                    renderCard("DIST SINCE MIL ON", meta.dist_mil || 0, "km", "#3fb950", "0x21"),
                    renderCard("DIST SINCE DTC CLEAR", meta.dist_dtc || 1420, "km", "#58a6ff", "0x31"),
                    renderCard("TOTAL FUEL USED", meta.fuel_used || 1.2, "L", "#d29922", "Acumulat sesiune"),
                    renderCard("TOTAL ENGINE HOURS", meta.engine_hours || 4120.5, "ore", "#fff", "Contor ore motor"),
                    renderCard("TOTAL IDLE HOURS", meta.idle_hours || 412.0, "ore", "#8b949e", "Gestație la relanti"),
                    renderCard("VIN (SERIE ȘASIU)", ecu.vin || "WAUZZZ4A1RN000000", "-", "#58a6ff", `Cal ID: ${ecu.cal_id || 'EDC15'}`, true),
                    renderCard("METADATE SOFTWARE ECU", ecu.name || "BOSCH EDC15M+", "-", "#fff", `Soft: ${ecu.soft_ver || 'v1.0'} | Proto: ${ecu.protocol || 'K-Line'}`, true)
                ]}
            </View>
        </View>
    );

    // =========================================================================
    // OSCILOSCOP AVANSAT CU REGLAJ X/Y ȘI ISTORIC
    // =========================================================================
    const getChartConfiguration = () => {
        const config = OSCILLOSCOPE_METRICS.find(m => m.id === selectedMetric) || OSCILLOSCOPE_METRICS[0];
        
        const visibleData = chartHistory.map(item => ({
            value: Number(item[config.id]) || 0,
            label: item.label || '',
            secunda: item.secunda || 0
        }));

        let maxValue = config.defaultMax * zoomYMult;
        let stepValue = Math.round(maxValue / 4);

        if (autoScaleY && visibleData.length > 0) {
            const maxInSlice = Math.max(...visibleData.map(item => item.value), 5);
            maxValue = Math.ceil(maxInSlice * 1.15);
            stepValue = Math.ceil(maxValue / 4);
        }

        return { ...config, visibleData, spacing: zoomX, maxValue, stepValue };
    };

    const renderChartView = () => {
        const config = getChartConfiguration();

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.filterTitle}>1. SELECTEAZĂ SENZORUL DE INPSECȚIE:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, marginBottom: 15, paddingBottom: 5}}>
                    {OSCILLOSCOPE_METRICS.map((metric) => (
                        <TouchableOpacity 
                            key={metric.id} 
                            style={[styles.chip, selectedMetric === metric.id && { backgroundColor: metric.color, borderColor: metric.color }]} 
                            onPress={() => setSelectedMetric(metric.id)}
                        >
                            <Text style={[styles.chipText, selectedMetric === metric.id && { color: '#000' }]}>{metric.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.filterTitle}>2. CONTROALE OSCILOSCOP (ZOOM X/Y):</Text>
                <View style={styles.zoomPanelRow}>
                    <View style={styles.zoomControlGroup}>
                        <Text style={styles.zoomLabel}>ZOOM X (TIMP)</Text>
                        <View style={styles.zoomButtons}>
                            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOutX}><Text style={styles.zoomBtnText}>-</Text></TouchableOpacity>
                            <Text style={styles.zoomValue}>{zoomX}px</Text>
                            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomInX}><Text style={styles.zoomBtnText}>+</Text></TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.zoomControlGroup}>
                        <Text style={styles.zoomLabel}>ZOOM Y (AMPLITUDINE)</Text>
                        <View style={styles.zoomButtons}>
                            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOutY}><Text style={styles.zoomBtnText}>-</Text></TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.zoomAutoBtn, autoScaleY && {backgroundColor: '#3fb950', borderColor: '#3fb950'}]} 
                                onPress={() => setAutoScaleY(true)}
                            >
                                <Text style={{fontSize: 9, color: autoScaleY ? '#000' : '#8b949e', fontWeight: 'bold'}}>AUTO</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomInY}><Text style={styles.zoomBtnText}>+</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.chartWrapper}>
                    <Text style={styles.chartTitle}>{config.label} ({config.unit})</Text>
                    <LineChart
                        data={config.visibleData} width={width - 80} height={200} color={config.color} thickness={2.5}
                        dataPointsColor={config.color} dataPointsRadius={1} maxValue={config.maxValue} stepValue={config.stepValue}
                        noOfSections={4} spacing={config.spacing} yAxisTextStyle={{ color: '#8b949e', fontSize: 10 }} xAxisLabelTextStyle={{ color: '#8b949e', fontSize: 9 }}
                        rulesColor="#21262d" rulesType="solid" initialSpacing={10} endSpacing={10} isAnimated={false} 
                        scrollable={true} showScrollIndicator={true}
                        pointerConfig={{
                            pointerStripHeight: 200, pointerStripColor: 'rgba(139, 148, 158, 0.4)', pointerStripWidth: 2, pointerColor: config.color, radius: 4,
                            pointerLabelWidth: 100, pointerLabelHeight: 40, activatePointersOnLongPress: false, autoAdjustPointerLabelPosition: true,
                            pointerLabelComponent: items => {
                                if (!items || !items[0]) return null;
                                return (
                                    <View style={styles.crosshairBadge}>
                                        <Text style={styles.crosshairValue}>{items[0].value} <Text style={{fontSize: 9, color: config.color}}>{config.unit}</Text></Text>
                                        <Text style={styles.crosshairTime}>Timp: {items[0].secunda || '0'}s</Text>
                                    </View>
                                );
                            },
                        }}
                    />
                </View>
                <Text style={styles.chartHint}>💡 Glisează stânga-dreapta pe grafic pentru a explora întregul istoric al călătoriei.</Text>
            </View>
        );
    };

    return (
        <View style={styles.mainContainer}>
            {latestAlert && (
                <View style={styles.floatingToast}>
                    <Text style={styles.toastIcon}>⚠️</Text>
                    <View style={{flex: 1}}>
                        <Text style={styles.toastTitle}>FRÂNARE BRUSCĂ ({latestAlert.g}G)</Text>
                        <Text style={styles.toastDesc}>Scor Eco: {latestAlert.scor_curent}/100 pct</Text>
                    </View>
                </View>
            )}

            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.title} numberOfLines={1}>A6 2.5 TDI</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>Terminal Diagnoză & Osciloscop</Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.bellBtn} onPress={() => setActiveTemplate(activeTemplate === 'DIGITAL' ? 'CLASSIC' : 'DIGITAL')}>
                        <Text style={{fontSize: 16}}>{activeTemplate === 'DIGITAL' ? '⏱️' : '🔢'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.bellBtn} onPress={handleOpenNotifications}>
                        <Text style={{fontSize: 16}}>🔔</Text>
                        {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
                    </TouchableOpacity>

                    <View style={[styles.statusBadge, isConnected ? styles.statusOnline : styles.statusOffline]}>
                        <Text style={[styles.statusText, isConnected ? {color: '#3fb950'} : {color: '#f85149'}]}>
                            {isConnected ? '● ONLINE' : '○ OFFLINE'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.viewToggleContainer}>
                <TouchableOpacity style={[styles.toggleBtn, viewMode === 'COCKPIT' && styles.toggleBtnActive]} onPress={() => setViewMode('COCKPIT')}>
                    <Text style={[styles.toggleText, viewMode === 'COCKPIT' && styles.toggleTextActive]}>🏁 MOD COCKPIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, viewMode === 'CHART' && styles.toggleBtnActive]} onPress={() => setViewMode('CHART')}>
                    <Text style={[styles.toggleText, viewMode === 'CHART' && styles.toggleTextActive]}>📈 MOD OSCILOSCOP</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 50 }}>
                {viewMode === 'COCKPIT' ? renderCockpitView() : renderChartView()}
            </ScrollView>

            <Modal visible={showNotificationsModal} transparent={true} animationType="slide" onRequestClose={() => setShowNotificationsModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔔 Istoric Alerte Sesiune</Text>
                            <TouchableOpacity onPress={() => setShowNotificationsModal(false)} style={styles.closeBtn}>
                                <Text style={{color: '#fff', fontWeight: 'bold'}}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{maxHeight: 400}}>
                            {alertsList.length === 0 ? (
                                <Text style={{color: '#3fb950', textAlign: 'center'}}>Nicio alertă înregistrată.</Text>
                            ) : (
                                alertsList.map((alt) => (
                                    <View key={alt.id} style={styles.modalAlertItem}>
                                        <Text style={{color: '#ff7b72', fontWeight: 'bold'}}>{alt.tip}</Text>
                                        <Text style={{color: '#c9d1d9', fontSize: 12}}>Scor afectat: {alt.scor_curent}</Text>
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
    mainContainer: { flex: 1, backgroundColor: '#0d1117', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 30 },
    scrollContainer: { flex: 1, paddingHorizontal: 16 },
    floatingToast: { position: 'absolute', top: 55, left: 20, right: 20, backgroundColor: '#3b2322', borderWidth: 1, borderColor: '#f85149', borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', zIndex: 1000 },
    toastIcon: { fontSize: 24 }, toastTitle: { color: '#ff7b72', fontWeight: '900', fontSize: 13 }, toastDesc: { color: '#c9d1d9', fontSize: 11, marginTop: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    headerTitleContainer: { flex: 1, paddingRight: 10 }, title: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' }, subtitle: { fontSize: 10, color: '#8b949e', marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bellBtn: { padding: 6, backgroundColor: '#161b22', borderRadius: 20, borderWidth: 1, borderColor: '#30363d', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#da3633', width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 }, statusOnline: { backgroundColor: '#122d1e', borderColor: '#238636' }, statusOffline: { backgroundColor: '#3b2322', borderColor: '#da3633' }, statusText: { fontSize: 10, fontWeight: 'bold' },
    viewToggleContainer: { flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 8, marginHorizontal: 16, marginVertical: 12, p: 4, borderWidth: 1, borderColor: '#30363d' },
    toggleBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 6 }, toggleBtnActive: { backgroundColor: '#21262d', borderColor: '#8b949e', borderWidth: 1 }, toggleText: { color: '#8b949e', fontWeight: 'bold', fontSize: 12 }, toggleTextActive: { color: '#ffffff' },
    filterSection: { marginBottom: 15 }, filterTitle: { fontSize: 10, color: '#8b949e', fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
    filterScroll: { gap: 8, paddingBottom: 4 }, chip: { backgroundColor: '#161b22', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#30363d' }, chipActive: { backgroundColor: '#1f6feb', borderColor: '#58a6ff' }, chipText: { color: '#8b949e', fontSize: 11, fontWeight: '900' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { backgroundColor: '#161b22', width: '48%', padding: 14, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#30363d', alignItems: 'center', justifyContent: 'center' },
    cardLarge: { width: '100%', paddingVertical: 18 }, cardLabel: { fontSize: 9, color: '#8b949e', fontWeight: 'bold', marginBottom: 6, textAlign: 'center' }, val: { fontSize: 22, fontWeight: '800', color: '#ffffff' }, valLarge: { fontSize: 36, fontWeight: '900', color: '#ffffff' }, unit: { fontSize: 12, color: '#8b949e', fontWeight: 'normal' }, cardSub: { fontSize: 9, color: '#8b949e', marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
    
    chartContainer: { backgroundColor: '#161b22', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#30363d', marginBottom: 20 },
    zoomPanelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#0d1117', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#21262d' },
    zoomControlGroup: { flex: 1, alignItems: 'center' },
    zoomLabel: { fontSize: 9, color: '#8b949e', fontWeight: 'bold', marginBottom: 6 },
    zoomButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    zoomBtn: { width: 30, height: 30, backgroundColor: '#21262d', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
    zoomBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: -2 },
    zoomValue: { color: '#58a6ff', fontSize: 11, fontWeight: 'bold', width: 30, textAlign: 'center' },
    zoomAutoBtn: { paddingHorizontal: 8, height: 30, backgroundColor: '#21262d', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#30363d' },
    chartWrapper: { alignItems: 'center', marginTop: 5 },
    chartTitle: { color: '#fff', fontSize: 12, fontWeight: 'bold', alignSelf: 'flex-start', marginBottom: 10 },
    chartHint: { fontSize: 10, color: '#8b949e', fontStyle: 'italic', textAlign: 'center', marginTop: 15 },
    crosshairBadge: { height: 40, width: 100, backgroundColor: '#21262d', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#58a6ff' }, crosshairValue: { color: '#fff', fontSize: 13, fontWeight: '900' }, crosshairTime: { color: '#8b949e', fontSize: 9, marginTop: 2 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }, modalContent: { backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1, borderColor: '#30363d', padding: 16 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#21262d', paddingBottom: 12, marginBottom: 12 }, modalTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' }, closeBtn: { backgroundColor: '#21262d', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, modalAlertItem: { backgroundColor: '#21262d', borderLeftWidth: 4, borderLeftColor: '#f85149', padding: 12, borderRadius: 6, marginBottom: 10 }
});

export default LiveDashboardScreen;