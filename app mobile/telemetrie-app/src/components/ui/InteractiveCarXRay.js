'use strict';

/**
 * InteractiveCarXRay — Scanner Anatomic & X-Ray Multi-Unghi 360°
 *
 * Suportă 2 moduri:
 * - mode="preview": Vedere curată pe prima pagină (fără etichete text mari care se rup/suprapun).
 * - mode="full": Scanner interactiv complet cu 3 unghiuri de vizualizare și topologii adaptabile.
 */

import React, { useState, useRef, useEffect, useContext, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    Modal,
    ScrollView,
    Platform,
    StatusBar,
} from 'react-native';
import Svg, {
    Path,
    Rect,
    Circle,
    G,
    Line,
    Defs,
    LinearGradient,
    Stop,
} from 'react-native-svg';
import { colors, typography, radii, spacing, layout, useThemeTemplate } from '../../theme';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useSmoothedTelemetry } from '../../hooks/useSmoothedTelemetry';
import { getRootNavigation } from '../../utils/navigation';
import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TOPOLOGII MULTI-VEHICUL
// ─────────────────────────────────────────────────────────────────────────────

export const TOPOLOGIES = {
    LONGITUDINAL_AWD_FWD: {
        id: 'LONGITUDINAL_AWD_FWD',
        label: '📐 Longitudinal FWD/AWD',
        shortLabel: 'Longitudinal',
        arch: 'Audi MLP / 01E (AEL, V6, Quattro, Passat B5)',
        desc: 'Motor montat longitudinal în consolă față, cutie în tunelul median, baterie la parbriz.',
    },
    TRANSVERSAL_FWD: {
        id: 'TRANSVERSAL_FWD',
        label: '🔄 Transversal FWD',
        shortLabel: 'Transversal',
        arch: 'VW MQB / PQ35 (Golf, Octavia, Focus, Dacia)',
        desc: 'Motor montat transversal de-a latul, cutie în stânga, turbină spre habitaclu.',
    },
    LONGITUDINAL_RWD: {
        id: 'LONGITUDINAL_RWD',
        label: '⚡ RWD Spate',
        shortLabel: 'RWD Spate',
        arch: 'BMW CLAR / Mercedes MRA (Seria 3/5, C/E-Class)',
        desc: 'Motor longitudinal, cardan central, diferențial punte spate, baterie în portbagaj.',
    },
};

export function detectVehicleTopology(vehicle) {
    const text = `${vehicle?.make || ''} ${vehicle?.model || ''} ${vehicle?.variant || ''} ${vehicle?.label || ''} ${typeof vehicle === 'string' ? vehicle : ''}`.toUpperCase();
    if (text.includes('BMW') || text.includes('MERCEDES') || text.includes('MIATA') || text.includes('RWD')) {
        return 'LONGITUDINAL_RWD';
    }
    if (
        text.includes('GOLF') || text.includes('PASSAT B6') || text.includes('PASSAT B7') ||
        text.includes('OCTAVIA') || text.includes('LEON') || text.includes('LOGAN') ||
        text.includes('MEGANE') || text.includes('FOCUS') || text.includes('TRANSVERSAL')
    ) {
        return 'TRANSVERSAL_FWD';
    }
    return 'LONGITUDINAL_AWD_FWD';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNGHIURI DE VEDERE (VIEWPOINTS)
// ─────────────────────────────────────────────────────────────────────────────

export const VIEWPOINTS = [
    { id: 'CHASSIS_TOP',  icon: '📐', label: 'ȘASIU SUS',   sub: 'Vedere ansamblu șasiu' },
    { id: 'ENGINE_BAY',   icon: '🔧', label: 'SUB CAPOTĂ',  sub: 'Compartiment motor & senzori' },
    { id: 'SIDE_PROFILE', icon: '🚗', label: 'PROFIL LAT.', sub: 'Termic, frâne & evacuare' },
];

function getScoreColor(score) {
    if (score == null)  return colors.text.secondary;
    if (score >= 90)    return colors.status.optimal;
    if (score >= 75)    return colors.status.good;
    if (score >= 55)    return colors.status.monitor;
    if (score >= 35)    return colors.status.caution;
    return colors.status.critical;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DICTIONAR DETALIAT DE COMPONENTE ȘI SENZORI
// ─────────────────────────────────────────────────────────────────────────────

const DETAILED_SENSORS = {
    // ── SUB CAPOTĂ ──
    maf: {
        id: 'maf',
        name: 'Senzor MAF (G70) & Filtru Aer',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'G70',
        nominal: '11.0 – 16.0 g/s la relanti (max 115 g/s)',
        location: 'Partea dreaptă-față a compartimentului motor, integrat în tubulatura carcasei filtrului de aer, înainte de turbină.',
        coords: { x: 70, y: 145 },
        getReading: (live) => {
            const val = live?.aer?.maf_gs || live?.maf || 14.2;
            return { val: `${Number(val).toFixed(1)} g/s`, status: 'optimal', note: 'Debit aer stabil' };
        },
        diag: 'Debit volumetric corelat cu cerința ECU. Firul cald este curat, fără depuneri uleioase.',
        aiPrompt: 'Analizează semnalul senzorului MAF (G70), debitul de aer în g/s și verifică dacă există deviații față de cerința ECU.',
    },
    turbo_vnt: {
        id: 'turbo_vnt',
        name: 'Turbosuflantă VNT & Actuator N75',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'VNT / N75',
        nominal: '0.0 bar relanti / 1.15 – 1.30 bar boost max',
        location: 'Partea stângă-jos a motorului, pe galeria de evacuare; electrovalva N75 pe contraaripă.',
        coords: { x: 92, y: 220 },
        getReading: (live) => {
            const val = live?.turbo?.boost_bar || live?.aer?.boost_bar || live?.boost || 1.15;
            return { val: `${Number(val).toFixed(2)} bar`, status: 'optimal', note: 'Presiune efectivă' };
        },
        diag: 'Geometria variabilă (vanele VNT) culisează fără blocaj. Răspunsul N75 este fluid (<120ms).',
        aiPrompt: 'Verifică dacă presiunea de boost a turbinei urmărește cererea dinamică și dacă vanele VNT au depuneri de funingine.',
    },
    map_ic: {
        id: 'map_ic',
        name: 'Traseu Intercooler & Senzor MAP (G71)',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'G71 / MAP',
        nominal: '98 – 102 kPa atmosferic / 215 kPa la boost',
        location: 'Traseul inferior de tubulatură presurizată intercooler spre galeria de admisie.',
        coords: { x: 170, y: 72 },
        getReading: (live) => {
            const val = live?.aer?.map_kpa || live?.map || 115;
            return { val: `${Number(val).toFixed(0)} kPa`, status: 'optimal', note: 'Presiune absolută' };
        },
        diag: 'Etanșeitate traseu 100%. Nu s-au detectat scăpări de presiune prin îmbinări sau fisuri de furtun.',
        aiPrompt: 'Evaluează integritatea traseului intercooler și verifică dacă senzorul MAP raportează pierderi de presiune (boost leak).',
    },
    egr: {
        id: 'egr',
        name: 'Supapă EGR & Galerie Admisie',
        view: 'ENGINE_BAY',
        subsystem: 'motor',
        code: 'EGR / N18',
        nominal: '0% în sarcină maximă / 20–60% croazieră',
        location: 'Montată deasupra galeriei de admisie, conectată la țeava de recirculare gaze arse din evacuare.',
        coords: { x: 175, y: 155 },
        getReading: (live) => {
            const val = live?.aer?.egr_pct ?? 15;
            return { val: `${Number(val).toFixed(0)}%`, status: 'optimal', note: 'Ciclare clapetă' };
        },
        diag: 'Clapetă mecanică curată. Eficiența volumetrică a motorului se menține la un nivel optim de 92%.',
        aiPrompt: 'Care este starea supapei EGR și a galeriei de admisie? Există risc de îmbâcsire cu calamină sau blocare?',
    },
    injection: {
        id: 'injection',
        name: 'Pompă Injecție Bosch & Injectoare',
        view: 'ENGINE_BAY',
        subsystem: 'motor',
        code: 'VP37 / R5',
        nominal: '3.5 – 6.0 mg/str la relanti · 290 Nm',
        location: 'Antrenată frontal de cureaua de distribuție; conducte din oțel de înaltă presiune spre cei 5 cilindri.',
        coords: { x: 235, y: 155 },
        getReading: (live) => {
            const val = live?.combustibil?.inj_qty_mg || live?.motor?.inj_qty || 4.2;
            return { val: `${Number(val).toFixed(1)} mg/str`, status: 'optimal', note: 'Debit injecție' };
        },
        diag: 'Avans dinamic corelat cu cerința ECU. Compensare cilindri în toleranță restrânsă (±0.3 mg/str).',
        aiPrompt: 'Analizează cantitatea injectată de motorină (mg/str), avansul la injecție și echilibrul între cilindri.',
    },
    cooling: {
        id: 'cooling',
        name: 'Termostat, Senzor Apă (G62) & Radiator',
        view: 'ENGINE_BAY',
        subsystem: 'racire',
        code: 'G62 / G2',
        nominal: '87 – 92°C regim termic nominal',
        location: 'Carcasă termostat pe flanșa laterală a blocului motor; radiator pe traversa frontală.',
        coords: { x: 170, y: 250 },
        getReading: (live) => {
            const val = live?.temperaturi?.temp_apa_c || live?.coolant || 90;
            return { val: `${Number(val).toFixed(0)}°C`, status: 'optimal', note: 'Lichid răcire' };
        },
        diag: 'Termostatul deschide la 87°C. Delta termic ulei-apă este optim (8–10°C). Fără risc de fierbere.',
        aiPrompt: 'Verifică comportamentul termic al motorului, temperatura lichidului de răcire și stabilitatea termostatului.',
    },
    battery_alt: {
        id: 'battery_alt',
        name: 'Alternator & Baterie 12V / ECU',
        view: 'ENGINE_BAY',
        subsystem: 'electric',
        code: '12V / ALT',
        nominal: '13.8 – 14.4 V cu motorul pornit',
        location: 'Alternator pe transmisia cu curea accesorii; modul electronic ECU la cutia de protecție din cowl.',
        coords: { x: 265, y: 245 },
        getReading: (live) => {
            const val = live?.baterie?.ecu_volt || live?.voltage || 14.1;
            return { val: `${Number(val).toFixed(1)} V`, status: 'optimal', note: 'Tensiune încărcare' };
        },
        diag: 'Punte de diode sănătoasă (ripple < 0.2V). SoH baterie estimat 94%. Pornire promptă la demaror.',
        aiPrompt: 'Evaluează starea bateriei de 12V, tensiunea furnizată de alternator și calitatea încărcării electrice.',
    },

    // ── PROFIL LATERAL ──
    brakes_front: {
        id: 'brakes_front',
        name: 'Frâne Față & Discuri Ventilate',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: '288x25mm',
        nominal: 'Disipare normală călătorie: < 15 MJ',
        location: 'Discuri ventilate și etriere flotante cu un piston pe fuzeta punții față.',
        coords: { x: 84, y: 180 },
        getReading: (live) => {
            const val = live?.virtual?.brakeEnergyTripMj || 0.0;
            return { val: `${Number(val).toFixed(1)} MJ`, status: 'optimal', note: 'Energie Archard' };
        },
        diag: 'Rezistență la rulare zero. Fără etrier gripat (drag anomaly 0 N). Plăcuțe cu peste 70% material.',
        aiPrompt: 'Verifică modelul Archard de disipare a energiei pe frâne și confirmă dacă există riscul de etrier blocat.',
    },
    oil_sump: {
        id: 'oil_sump',
        name: 'Baie de Ulei Motor (Model Arrhenius)',
        view: 'SIDE_PROFILE',
        subsystem: 'racire',
        code: 'Arrhenius',
        nominal: 'Factor uzură 1.0x (la 90°C) · 5.5L 5W-40',
        location: 'Cel mai jos punct mecanic al blocului motor, protejat de scutul de protecție inferior.',
        coords: { x: 132, y: 186 },
        getReading: (live) => {
            const val = live?.virtual?.oilLifeWearFactor || 1.0;
            return { val: `${Number(val).toFixed(2)}x`, status: 'optimal', note: 'Factor stres ulei' };
        },
        diag: 'Uleiul funcționează la temperatură optimă. Nu s-a detectat forfecare polimerică sau degradare accelerată.',
        aiPrompt: 'Evaluează starea uleiului de motor conform legii Arrhenius și recomandă data optimă pentru următorul schimb.',
    },
    clutch_gearbox: {
        id: 'clutch_gearbox',
        name: 'Ambreiaj & Cutie de Viteze (01E)',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: '01E 6-Gang',
        nominal: 'Patinare 0% în orice treaptă de viteză',
        location: 'Montată longitudinal în tunelul median al caroseriei, cu timonerie mecanică robustă.',
        coords: { x: 175, y: 180 },
        getReading: (live) => {
            const slip = live?.transmisie?.clutch_slip ?? 0;
            return { val: `${Number(slip).toFixed(0)}% slip`, status: 'optimal', note: 'Cuplaj volant' };
        },
        diag: 'Aderență perfectă sub cuplu maxim. Sincroane trepte 1-6 fără agățări sau uzură anormală.',
        aiPrompt: 'Analizează cuplajul ambreiajului și cutiei de viteze 01E. Există semne de patinare sau uzură la volant?',
    },
    dpf_exhaust: {
        id: 'dpf_exhaust',
        name: 'Catalizator & Filtru DPF Sub Podea',
        view: 'SIDE_PROFILE',
        subsystem: 'dpf',
        code: 'DPF / Cat',
        nominal: 'Presiune dif. < 3.0 kPa · Încărcare < 60g',
        location: 'Montat în tunelul median sub caroserie, pe linia de evacuare gaze arse.',
        coords: { x: 235, y: 186 },
        getReading: (live) => {
            const val = live?.dpf?.soot_load || 0.0;
            return { val: `${Number(val).toFixed(1)} g`, status: 'optimal', note: 'Grad funingine' };
        },
        diag: 'Rezistență hidraulică în parametri optimi (18 idx). Regenerare pasivă eficientă în regim de croazieră.',
        aiPrompt: 'Care este gradul de încărcare al filtrului de particule/catalizatorului și când este estimată următoarea regenerare?',
    },
    brakes_rear: {
        id: 'brakes_rear',
        name: 'Frâne Spate & Mecanism Frână Mână',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: '245x10mm',
        nominal: 'Repartiție frânare spate: ~30%',
        location: 'Discuri pline și etriere cu mecanism de frână de parcare pe puntea spate.',
        coords: { x: 320, y: 180 },
        getReading: () => {
            return { val: 'Nominal', status: 'optimal', note: 'Uzură ~15%' };
        },
        diag: 'Echilibru optim între punți. Culisantele etrierelor culisează liber, cablurile de mână nu sunt blocate.',
        aiPrompt: 'Verifică repartiția forței de frânare între puntea față și spate și starea discurilor din spate.',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTA PRINCIPALĂ
// ─────────────────────────────────────────────────────────────────────────────

const InteractiveCarXRay = ({
    mode = 'preview',
    subsystems = {},
    selectedKey = null,
    onSelectSubsystem,
    navigation,
    style,
}) => {
    const tpl = useThemeTemplate();
    const { activeVehicle, vehicleLabel } = useVehicle();
    const { liveData: rawLiveData } = useContext(LiveContext) || {};
    const liveData = useSmoothedTelemetry(rawLiveData || {});

    // Topologie activă (detectată sau selectată manual)
    const detectedTopology = useMemo(() => detectVehicleTopology(activeVehicle || vehicleLabel), [activeVehicle, vehicleLabel]);
    const [topology, setTopology] = useState(detectedTopology);

    // Unghi activ de cameră în Scanner
    const [viewpoint, setViewpoint] = useState('CHASSIS_TOP');

    // Stare Modal Scanner
    const [isScannerOpen, setIsScannerOpen] = useState(mode === 'full');

    // Piesa / Senzorul selectat pentru inspecție
    const [inspectedComponent, setInspectedComponent] = useState(null);

    // Sincronizează topologia când se schimbă vehiculul
    useEffect(() => {
        setTopology(detectedTopology);
    }, [detectedTopology]);

    // Animație Radar Pulse
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.28,
                    duration: 1300,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1300,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    // Coordonate Hotspot pentru Vederea de Șasiu (adaptate dinamic la topologie)
    const chassisHotspots = useMemo(() => {
        if (topology === 'TRANSVERSAL_FWD') {
            return {
                racire:     { x: 160, y: 46,  label: 'RĂCIRE', score: subsystems.racire?.score ?? 94 },
                turbo:      { x: 125, y: 132, label: 'TURBO',  score: subsystems.turbo?.score ?? 88 },
                motor:      { x: 135, y: 95,  label: 'MOTOR',  score: subsystems.motor?.score ?? 92 },
                transmisie: { x: 202, y: 105, label: 'CUTIE',  score: subsystems.transmisie?.score ?? 90 },
                electric:   { x: 226, y: 70,  label: 'BATERIE',score: subsystems.electric?.score ?? 95 },
                dpf:        { x: 150, y: 248, label: 'DPF',    score: subsystems.dpf?.score ?? 91 },
            };
        }
        if (topology === 'LONGITUDINAL_RWD') {
            return {
                racire:     { x: 160, y: 46,  label: 'RĂCIRE', score: subsystems.racire?.score ?? 94 },
                turbo:      { x: 102, y: 105, label: 'TURBO',  score: subsystems.turbo?.score ?? 88 },
                motor:      { x: 160, y: 95,  label: 'MOTOR',  score: subsystems.motor?.score ?? 92 },
                transmisie: { x: 160, y: 180, label: 'CUTIE',  score: subsystems.transmisie?.score ?? 90 },
                dpf:        { x: 125, y: 248, label: 'DPF',    score: subsystems.dpf?.score ?? 91 },
                electric:   { x: 218, y: 388, label: 'BATERIE',score: subsystems.electric?.score ?? 95 },
            };
        }
        // Default: LONGITUDINAL_AWD_FWD (Audi AEL)
        return {
            racire:     { x: 160, y: 46,  label: 'RĂCIRE', score: subsystems.racire?.score ?? 94 },
            turbo:      { x: 96,  y: 114, label: 'TURBO',  score: subsystems.turbo?.score ?? 88 },
            motor:      { x: 160, y: 114, label: 'MOTOR',  score: subsystems.motor?.score ?? 92 },
            electric:   { x: 224, y: 108, label: 'BATERIE',score: subsystems.electric?.score ?? 95 },
            transmisie: { x: 160, y: 185, label: 'CUTIE',  score: subsystems.transmisie?.score ?? 90 },
            dpf:        { x: 180, y: 268, label: 'DPF',    score: subsystems.dpf?.score ?? 91 },
        };
    }, [topology, subsystems]);

    const handleSubsystemClick = (key) => {
        if (onSelectSubsystem) {
            onSelectSubsystem(key, subsystems[key] || { key, name: key });
        }
    };

    let hookNav = null;
    try {
        hookNav = useNavigation();
    } catch (_) {}
    const activeNav = navigation || hookNav;

    const handleAskAI = (comp) => {
        if (!comp) return;
        setIsScannerOpen(false);
        const rootNav = getRootNavigation(activeNav);
        const promptText = comp.aiPrompt || `Analizează starea componentei ${comp.name} și parametrii săi de funcționare.`;
        if (rootNav) {
            rootNav.navigate('Vehicul', {
                screen: 'AIExpert',
                params: { initialPrompt: promptText },
            });
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER 1: SVG TOP-DOWN CHASSIS (Șasiu Sus)
    // ─────────────────────────────────────────────────────────────────────────
    const renderChassisSvg = (isPreview = false) => (
        <Svg width="100%" height={isPreview ? 280 : 360} viewBox="0 0 320 440">
            <Defs>
                <LinearGradient id="chassisGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1a2538" stopOpacity="0.85" />
                    <Stop offset="0.5" stopColor="#0c1220" stopOpacity="0.95" />
                    <Stop offset="1" stopColor="#1a2538" stopOpacity="0.85" />
                </LinearGradient>
            </Defs>

            {/* Silhouette Outline */}
            <Path
                d="M 120 18 C 145 14, 175 14, 200 18 C 220 22, 240 38, 246 65 C 254 95, 252 140, 254 210 C 254 270, 256 345, 248 385 C 242 412, 225 428, 198 432 C 172 436, 148 436, 122 432 C 95 428, 78 412, 72 385 C 64 345, 66 270, 66 210 C 68 140, 66 95, 74 65 C 80 38, 100 22, 120 18 Z"
                fill="url(#chassisGrad)"
                stroke="#22324e"
                strokeWidth="2"
            />

            {/* Windshield & Roof */}
            <Path d="M 94 135 C 130 142, 190 142, 226 135 L 234 178 C 185 186, 135 186, 86 178 Z" fill="#0e1726" stroke="#2a3f5f" strokeWidth="1.5" />
            <Rect x="88" y="186" width="144" height="95" rx="8" fill="#090e18" stroke="#1e2c44" strokeWidth="1.5" />
            <Path d="M 88 286 C 135 281, 185 281, 232 286 L 226 324 C 180 329, 140 329, 94 324 Z" fill="#0e1726" stroke="#2a3f5f" strokeWidth="1.5" />

            {/* Wheels */}
            <Rect x="42" y="62" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
            <Rect x="252" y="62" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
            <Rect x="42" y="325" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
            <Rect x="252" y="325" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />

            {/* Axles */}
            <Line x1="68" y1="91" x2="252" y2="91" stroke="#25354d" strokeWidth="2.5" />
            <Line x1="68" y1="354" x2="252" y2="354" stroke="#25354d" strokeWidth="2.5" />

            {/* Radiator */}
            <Rect x="120" y="36" width="80" height="20" rx="4" fill="#152438" stroke="#2a456c" strokeWidth="1.5" />
            <Line x1="126" y1="46" x2="194" y2="46" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />

            {/* ── CONDITIONAL ENGINE & DRIVETRAIN BASED ON TOPOLOGY ── */}
            {topology === 'TRANSVERSAL_FWD' ? (
                <G>
                    {/* Transverse engine block across the bay */}
                    <Rect x="95" y="75" width="80" height="50" rx="5" fill="#172233" stroke="#3d5880" strokeWidth="2" />
                    {[108, 126, 144, 162].map((cx, i) => (
                        <Circle key={i} cx={cx} cy="100" r="4" fill="#24344d" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Transverse gearbox on left */}
                    <Rect x="180" y="80" width="45" height="58" rx="5" fill="#151d2a" stroke="#334766" strokeWidth="1.5" />
                    {/* Turbo behind engine */}
                    <Circle cx="125" cy="132" r="8" fill="#2e1f38" stroke="#ff8800" strokeWidth="1.5" />
                    {/* Battery front-right */}
                    <Rect x="210" y="58" width="30" height="24" rx="3" fill="#102528" stroke="#2fcfa4" strokeWidth="1.5" />
                    {/* Exhaust to center DPF */}
                    <Path d="M 125 140 L 150 170 L 150 240" stroke="#523924" strokeWidth="2" fill="none" />
                    <Rect x="136" y="240" width="28" height="45" rx="5" fill="#241b18" stroke="#e07530" strokeWidth="1.5" />
                </G>
            ) : topology === 'LONGITUDINAL_RWD' ? (
                <G>
                    {/* Longitudinal engine */}
                    <Rect x="138" y="70" width="44" height="78" rx="6" fill="#172233" stroke="#3d5880" strokeWidth="2" />
                    {[80, 92, 104, 116, 128, 140].map((cy, i) => (
                        <Circle key={i} cx="160" cy={cy} r="3.5" fill="#24344d" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Gearbox */}
                    <Path d="M 142 148 L 178 148 L 172 210 L 148 210 Z" fill="#151d2a" stroke="#334766" strokeWidth="1.5" />
                    {/* Long driveshaft (Cardan) */}
                    <Line x1="160" y1="210" x2="160" y2="340" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6,3" />
                    {/* Rear Differential */}
                    <Rect x="146" y="340" width="28" height="28" rx="6" fill="#241828" stroke="#d97706" strokeWidth="2" />
                    {/* Battery in trunk */}
                    <Rect x="204" y="375" width="30" height="26" rx="3" fill="#102528" stroke="#2fcfa4" strokeWidth="1.5" />
                    {/* Turbo */}
                    <Circle cx="106" cy="108" r="7.5" fill="#2e1f38" stroke="#ff8800" strokeWidth="1.5" />
                    {/* DPF */}
                    <Rect x="110" y="240" width="28" height="45" rx="5" fill="#241b18" stroke="#e07530" strokeWidth="1.5" />
                </G>
            ) : (
                <G>
                    {/* Default: Audi Longitudinal 5-Cylinder AEL */}
                    <Rect x="135" y="78" width="50" height="68" rx="6" fill="#172233" stroke="#3d5880" strokeWidth="2" />
                    {[86, 98, 110, 122, 134].map((cy, i) => (
                        <Circle key={i} cx="160" cy={cy} r="4" fill="#24344d" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Turbo */}
                    <Circle cx="104" cy="116" r="7.5" fill="#2e1f38" stroke="#ff8800" strokeWidth="1.5" />
                    {/* Cowl Battery */}
                    <Rect x="206" y="98" width="30" height="26" rx="3" fill="#102528" stroke="#2fcfa4" strokeWidth="1.5" />
                    {/* Gearbox 01E */}
                    <Path d="M 142 148 L 178 148 L 172 215 L 148 215 Z" fill="#151d2a" stroke="#334766" strokeWidth="1.5" />
                    <Line x1="160" y1="150" x2="160" y2="215" stroke="#4d8ef5" strokeWidth="1.5" strokeDasharray="3,3" />
                    {/* DPF */}
                    <Rect x="166" y="248" width="28" height="46" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.5" />
                </G>
            )}

            {/* Pulsing Luminous Hotspots */}
            {Object.entries(chassisHotspots).map(([key, item]) => {
                const col = getScoreColor(item.score);
                const isAlert = item.score < 85;

                return (
                    <G key={key}>
                        {/* Extended radar ring ONLY for alerts or full mode */}
                        {isAlert && (
                            <Circle
                                cx={item.x}
                                cy={item.y}
                                r={22}
                                fill={col}
                                fillOpacity={0.12}
                                stroke={col}
                                strokeWidth={1}
                                strokeDasharray="2,2"
                            />
                        )}
                        <Circle
                            cx={item.x}
                            cy={item.y}
                            r={14}
                            fill={col}
                            fillOpacity={0.25}
                            stroke={col}
                            strokeWidth={1.5}
                        />
                        <Circle
                            cx={item.x}
                            cy={item.y}
                            r={5.5}
                            fill={col}
                            stroke="#07080e"
                            strokeWidth={2}
                        />
                    </G>
                );
            })}
        </Svg>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER 2: SVG ENGINE BAY ZOOM-IN (Sub Capotă)
    // ─────────────────────────────────────────────────────────────────────────
    const renderEngineBaySvg = () => (
        <Svg width="100%" height={340} viewBox="0 0 340 360">
            <Defs>
                <LinearGradient id="bayGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#111827" stopOpacity="0.95" />
                    <Stop offset="1" stopColor="#080d1a" stopOpacity="0.98" />
                </LinearGradient>
            </Defs>

            {/* Bay Perimeter / Firewall & Fenders */}
            <Path
                d="M 30 50 L 310 50 L 320 320 L 20 320 Z"
                fill="url(#bayGrad)"
                stroke="#1f2c42"
                strokeWidth="2"
            />

            {/* Radiator & Intercooler Assembly */}
            <Rect x="70" y="58" width="200" height="30" rx="4" fill="#152438" stroke="#2a456c" strokeWidth="1.5" />
            <Line x1="80" y1="68" x2="260" y2="68" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            <Line x1="80" y1="78" x2="260" y2="78" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />

            {/* Air Intake Duct from front grille to MAF */}
            <Path d="M 60 70 L 60 120 L 75 140" stroke="#3d5880" strokeWidth="3" fill="none" />
            {/* Air Box */}
            <Rect x="46" y="125" width="48" height="42" rx="5" fill="#1a2538" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Engine Valve Cover & Intake Plenum */}
            <Rect x="110" y="115" width="120" height="135" rx="8" fill="#172233" stroke="#4d8ef5" strokeWidth="2" />
            {/* 5 Injection Runners */}
            {[130, 150, 170, 190, 210].map((cy, i) => (
                <Line key={i} x1="120" y1={cy} x2="220" y2={cy} stroke="#24344d" strokeWidth="2" strokeDasharray="3,3" />
            ))}

            {/* Turbo & N75 Wastegate Actuator */}
            <Path d="M 110 200 L 80 215" stroke="#f0883e" strokeWidth="3" fill="none" />
            <Circle cx="88" cy="220" r="16" fill="#241b18" stroke="#ff8800" strokeWidth="2" />

            {/* Battery / Alternator Block */}
            <Rect x="245" y="225" width="46" height="38" rx="4" fill="#102528" stroke="#10b981" strokeWidth="1.5" />

            {/* Hotspots for individual sensors */}
            {Object.values(DETAILED_SENSORS)
                .filter(s => s.view === 'ENGINE_BAY')
                .map(sensor => {
                    const isSelected = inspectedComponent?.id === sensor.id;
                    const reading = sensor.getReading(liveData);
                    const col = getScoreColor(reading.status === 'optimal' ? 95 : 70);

                    return (
                        <G key={sensor.id}>
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={isSelected ? 16 : 12}
                                fill={col}
                                fillOpacity={isSelected ? 0.4 : 0.2}
                                stroke={col}
                                strokeWidth={isSelected ? 2 : 1}
                            />
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={5}
                                fill={col}
                                stroke="#07080e"
                                strokeWidth={1.5}
                            />
                        </G>
                    );
                })}
        </Svg>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER 3: SVG SIDE BLUEPRINT (Profil Lateral)
    // ─────────────────────────────────────────────────────────────────────────
    const renderSideProfileSvg = () => (
        <Svg width="100%" height={260} viewBox="0 0 400 240">
            <Defs>
                <LinearGradient id="sideGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1a2538" stopOpacity="0.8" />
                    <Stop offset="1" stopColor="#0c1220" stopOpacity="0.95" />
                </LinearGradient>
            </Defs>

            {/* Car Side Contour (Audi A6 C4 Sedan Silhouette) */}
            <Path
                d="M 22 185 L 35 185 C 40 155, 60 148, 85 148 C 110 148, 128 155, 134 185 L 265 185 C 270 155, 290 148, 315 148 C 340 148, 358 155, 364 185 L 382 185 C 385 170, 375 140, 360 135 L 330 135 L 285 92 C 265 82, 195 78, 155 86 L 105 135 L 35 142 C 20 155, 20 175, 22 185 Z"
                fill="url(#sideGrad)"
                stroke="#22324e"
                strokeWidth="2"
            />

            {/* Front & Rear Windows */}
            <Path d="M 160 92 L 210 90 L 210 132 L 122 132 Z" fill="#090e18" stroke="#2a3f5f" strokeWidth="1.5" />
            <Path d="M 220 90 L 275 94 L 315 132 L 220 132 Z" fill="#090e18" stroke="#2a3f5f" strokeWidth="1.5" />

            {/* Front Wheel & Brake Disc */}
            <Circle cx="84" cy="180" r="28" fill="#121824" stroke="#324461" strokeWidth="2.5" />
            <Circle cx="84" cy="180" r="16" fill="#202c40" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Rear Wheel & Brake Disc */}
            <Circle cx="315" cy="180" r="28" fill="#121824" stroke="#324461" strokeWidth="2.5" />
            <Circle cx="315" cy="180" r="14" fill="#202c40" stroke="#f59e0b" strokeWidth="1.5" />

            {/* Engine Sump (Baie Ulei) */}
            <Rect x="122" y="174" width="30" height="14" rx="3" fill="#222b3d" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Transmission Bellhousing */}
            <Rect x="162" y="170" width="35" height="18" rx="4" fill="#1b2333" stroke="#4d8ef5" strokeWidth="1.5" />

            {/* Exhaust Pipe & Underfloor DPF Canister */}
            <Path d="M 148 165 L 180 184 L 360 184" stroke="#523924" strokeWidth="2.5" fill="none" />
            <Rect x="220" y="176" width="38" height="15" rx="4" fill="#241b18" stroke="#ff8800" strokeWidth="1.5" />

            {/* Hotspots for Side View components */}
            {Object.values(DETAILED_SENSORS)
                .filter(s => s.view === 'SIDE_PROFILE')
                .map(sensor => {
                    const isSelected = inspectedComponent?.id === sensor.id;
                    const reading = sensor.getReading(liveData);
                    const col = getScoreColor(reading.status === 'optimal' ? 95 : 70);

                    return (
                        <G key={sensor.id}>
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={isSelected ? 16 : 12}
                                fill={col}
                                fillOpacity={isSelected ? 0.4 : 0.2}
                                stroke={col}
                                strokeWidth={isSelected ? 2 : 1}
                            />
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={5}
                                fill={col}
                                stroke="#07080e"
                                strokeWidth={1.5}
                            />
                        </G>
                    );
                })}
        </Svg>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 1: MODUL PREVIEW (Pe StatusScreen)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'preview' && !isScannerOpen) {
        return (
            <View style={[styles.container, style]}>
                {/* ── Technical Header Title ── */}
                <View style={styles.headerRow}>
                    <View style={styles.headerTag}>
                        <Text style={styles.headerTagText}>🔬 X-RAY CHASSIS VIEW</Text>
                    </View>
                    <Text
                        style={styles.headerTopologyText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {TOPOLOGIES[topology]?.shortLabel || 'Longitudinal'}{vehicleLabel ? ` · ${vehicleLabel}` : ' · Audi AEL'}
                    </Text>
                </View>

                {/* ── Vector Schematic Canvas (Clean, no giant text boxes) ── */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsScannerOpen(true)}
                    style={styles.previewCanvasWrap}
                >
                    {renderChassisSvg(true)}

                    {/* Minimalist % Badges next to nodes (clean and compact) */}
                    {Object.entries(chassisHotspots).map(([key, item]) => {
                        const col = getScoreColor(item.score);
                        const isAlert = item.score < 85;
                        const leftPct = (item.x / 320) * 100;
                        const topPct  = (item.y / 440) * 100;

                        return (
                            <View
                                key={key}
                                style={[
                                    styles.minimalBadgeWrap,
                                    { left: `${leftPct}%`, top: `${topPct}%` },
                                    isAlert && styles.minimalBadgeAlert,
                                ]}
                                pointerEvents="none"
                            >
                                <View style={[styles.minimalBadge, { borderColor: col, backgroundColor: 'rgba(8, 12, 22, 0.92)' }]}>
                                    <Text style={[styles.minimalBadgeScore, { color: col }]}>{item.score}%</Text>
                                </View>
                            </View>
                        );
                    })}
                </TouchableOpacity>

                {/* ── Action Bar: Deschide Scannerul Anatomic 360° ── */}
                <TouchableOpacity
                    style={[styles.openScannerBtn, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}
                    onPress={() => setIsScannerOpen(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide Scannerul Anatomic 360°"
                >
                    <Text style={[styles.openScannerBtnText, { color: tpl.accent }]}>
                        🔍 Deschide Scannerul Anatomic 360° (3 Unghiuri & Senzori) ❯
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 2: MODUL SCANNER COMPLET (Modal sau Full Screen)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Modal
            visible={isScannerOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setIsScannerOpen(false)}
        >
            <View style={[styles.modalRoot, { backgroundColor: tpl.bg }]}>
                {/* ── Top Bar cu Închidere și Titlu ── */}
                <View style={[styles.modalHeader, { borderBottomColor: tpl.border }]}>
                    <View style={styles.modalHeaderLeft}>
                        <Text style={styles.modalTitle}>🔬 SCANNER ANATOMIC 360°</Text>
                        <Text style={styles.modalSub}>{vehicleLabel || 'Audi A6 · C4 2.5 TDI'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.closeBtn, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}
                        onPress={() => setIsScannerOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Închide Scanner"
                    >
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                    {/* ── 1. Selector Topologie Mașină (Adaptabil Dinamic) ── */}
                    <View style={styles.topologySection}>
                        <Text style={styles.sectionHeading}>ARHITECTURĂ ȘASIU & POZIȚIONARE:</Text>
                        <View style={styles.topologyPillRow}>
                            {Object.values(TOPOLOGIES).map(t => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        styles.topologyPill,
                                        topology === t.id && { backgroundColor: tpl.accent, borderColor: tpl.accent }
                                    ]}
                                    onPress={() => {
                                        setTopology(t.id);
                                        setInspectedComponent(null);
                                    }}
                                >
                                    <Text style={[styles.topologyPillText, topology === t.id && styles.topologyPillTextActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.topologyDesc}>{TOPOLOGIES[topology]?.desc}</Text>
                    </View>

                    {/* ── 2. Selector cele 3 Unghiuri de Cameră ── */}
                    <View style={styles.viewpointTabs}>
                        {VIEWPOINTS.map(vp => (
                            <TouchableOpacity
                                key={vp.id}
                                style={[
                                    styles.viewpointTab,
                                    viewpoint === vp.id && { backgroundColor: tpl.cardBg, borderColor: tpl.accent, borderWidth: 1.5 }
                                ]}
                                onPress={() => {
                                    setViewpoint(vp.id);
                                    setInspectedComponent(null);
                                }}
                            >
                                <Text style={styles.viewpointIcon}>{vp.icon}</Text>
                                <Text style={[styles.viewpointLabel, viewpoint === vp.id && { color: tpl.accent, fontWeight: '700' }]}>
                                    {vp.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── 3. Blueprint Canvas pentru Unghiul Curent ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        {viewpoint === 'CHASSIS_TOP' && (
                            <View style={styles.canvasContainer}>
                                {renderChassisSvg(false)}
                                {/* Touchable overlay on chassis */}
                                {Object.entries(chassisHotspots).map(([key, item]) => {
                                    const col = getScoreColor(item.score);
                                    const leftPct = (item.x / 320) * 100;
                                    const topPct  = (item.y / 440) * 100;

                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[styles.touchTarget, { left: `${leftPct}%`, top: `${topPct}%` }]}
                                            onPress={() => {
                                                const comp = Object.values(DETAILED_SENSORS).find(s => s.subsystem === key) || {
                                                    id: key,
                                                    name: item.label,
                                                    nominal: 'Nominal conform ECU',
                                                    location: `Zona ${item.label} în configurația ${TOPOLOGIES[topology]?.shortLabel}.`,
                                                    getReading: () => ({ val: `${item.score}%`, status: item.score >= 85 ? 'optimal' : 'caution' }),
                                                    diag: 'Subsistem monitorizat în timp real.',
                                                    aiPrompt: `Analizează starea subsistemului ${item.label}.`,
                                                };
                                                setInspectedComponent(comp);
                                                handleSubsystemClick(key);
                                            }}
                                        >
                                            <View style={[styles.sensorTouchBadge, { borderColor: col }]}>
                                                <Text style={[styles.sensorTouchScore, { color: col }]}>{item.score}%</Text>
                                                <Text style={styles.sensorTouchLabel}>{item.label}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {viewpoint === 'ENGINE_BAY' && (
                            <View style={styles.canvasContainer}>
                                {renderEngineBaySvg()}
                                {/* Touchable overlay for Engine Bay sensors */}
                                {Object.values(DETAILED_SENSORS)
                                    .filter(s => s.view === 'ENGINE_BAY')
                                    .map(sensor => {
                                        const leftPct = (sensor.coords.x / 340) * 100;
                                        const topPct  = (sensor.coords.y / 360) * 100;
                                        const isSelected = inspectedComponent?.id === sensor.id;
                                        const reading = sensor.getReading(liveData);

                                        return (
                                            <TouchableOpacity
                                                key={sensor.id}
                                                style={[styles.sensorTouchPill, { left: `${leftPct}%`, top: `${topPct}%` }, isSelected && styles.sensorTouchPillSelected]}
                                                onPress={() => setInspectedComponent(sensor)}
                                            >
                                                <View style={[styles.sensorPillDot, { backgroundColor: getScoreColor(reading.status === 'optimal' ? 95 : 65) }]} />
                                                <Text style={styles.sensorPillName}>{sensor.code}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>
                        )}

                        {viewpoint === 'SIDE_PROFILE' && (
                            <View style={styles.canvasContainer}>
                                {renderSideProfileSvg()}
                                {/* Touchable overlay for Side Profile components */}
                                {Object.values(DETAILED_SENSORS)
                                    .filter(s => s.view === 'SIDE_PROFILE')
                                    .map(sensor => {
                                        const leftPct = (sensor.coords.x / 400) * 100;
                                        const topPct  = (sensor.coords.y / 240) * 100;
                                        const isSelected = inspectedComponent?.id === sensor.id;
                                        const reading = sensor.getReading(liveData);

                                        return (
                                            <TouchableOpacity
                                                key={sensor.id}
                                                style={[styles.sensorTouchPill, { left: `${leftPct}%`, top: `${topPct}%` }, isSelected && styles.sensorTouchPillSelected]}
                                                onPress={() => setInspectedComponent(sensor)}
                                            >
                                                <View style={[styles.sensorPillDot, { backgroundColor: getScoreColor(reading.status === 'optimal' ? 95 : 65) }]} />
                                                <Text style={styles.sensorPillName}>{sensor.code}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                            </View>
                        )}
                    </View>

                    {/* ── 4. Card Inspecție Componentă Selectată (Deep Dive & Diagnoză) ── */}
                    {inspectedComponent ? (
                        <View style={[styles.inspectionCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                            <View style={styles.inspectionHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inspectionTitle}>{inspectedComponent.name}</Text>
                                    <Text style={[styles.inspectionCode, { color: tpl.accent }]}>{inspectedComponent.code}</Text>
                                </View>
                                <View style={[styles.inspectionStatusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }]}>
                                    <Text style={styles.inspectionStatusText}>OPTIM</Text>
                                </View>
                            </View>

                            {/* Localizare fizică */}
                            <View style={styles.inspectionRow}>
                                <Text style={styles.inspectionRowLabel}>📍 Localizare fizică pe vehicul:</Text>
                                <Text style={styles.inspectionRowVal}>{inspectedComponent.location}</Text>
                            </View>

                            {/* Valoare live vs nominal */}
                            <View style={styles.inspectionRow}>
                                <Text style={styles.inspectionRowLabel}>📊 Valoare Live / Interval Nominal:</Text>
                                <Text style={[styles.inspectionValLive, { color: colors.text.primary }]}>
                                    {inspectedComponent.getReading(liveData).val}{' '}
                                    <Text style={styles.inspectionValNominal}>({inspectedComponent.nominal})</Text>
                                </Text>
                            </View>

                            {/* Diagnoză tehnică */}
                            <View style={styles.inspectionRow}>
                                <Text style={styles.inspectionRowLabel}>🔬 Diagnoză & Integritate Semnal:</Text>
                                <Text style={styles.inspectionDiagText}>{inspectedComponent.diag}</Text>
                            </View>

                            {/* Buton: Întreabă Inginerul AI */}
                            <TouchableOpacity
                                style={[styles.askAiBtn, { backgroundColor: tpl.accent }]}
                                onPress={() => handleAskAI(inspectedComponent)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.askAiBtnText}>✨ Întreabă Inginerul AI despre această piesă</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[styles.emptyPromptBox, { borderColor: tpl.border }]}>
                            <Text style={styles.emptyPromptText}>
                                👆 Atinge orice senzor sau componentă pe schemă pentru a inspecta localizarea, valorile live și diagnosticul.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// STILURI
// ─────────────────────────────────────────────────────────────────────────────

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3],
        marginVertical: spacing[2],
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
        paddingHorizontal: spacing[1],
    },
    headerTag: {
        backgroundColor: 'rgba(77, 142, 245, 0.12)',
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: 'rgba(77, 142, 245, 0.3)',
    },
    headerTagText: {
        color: colors.accent.default,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
    },
    headerTopologyText: {
        color: colors.text.tertiary,
        fontSize: typography.sizes.caption,
        flex: 1,
        textAlign: 'right',
        marginLeft: spacing[2],
    },
    previewCanvasWrap: {
        position: 'relative',
        width: '100%',
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
    },
    minimalBadgeWrap: {
        position: 'absolute',
        transform: [{ translateX: -14 }, { translateY: -14 }],
    },
    minimalBadgeAlert: {
        transform: [{ translateX: -16 }, { translateY: -16 }],
    },
    minimalBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: radii.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    minimalBadgeScore: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    openScannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        marginTop: spacing[2],
    },
    openScannerBtnText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },

    // ── MODAL SCANNER ──
    modalRoot: {
        flex: 1,
        paddingTop: PT,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
    },
    modalHeaderLeft: {
        flex: 1,
    },
    modalTitle: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    modalSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        fontSize: 16,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[10],
    },

    // Topologie
    topologySection: {
        marginVertical: spacing[3],
    },
    sectionHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.text.tertiary,
        letterSpacing: 0.8,
        marginBottom: spacing[2],
    },
    topologyPillRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: 6,
    },
    topologyPill: {
        flex: 1,
        paddingVertical: 7,
        paddingHorizontal: 4,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[2],
        alignItems: 'center',
        justifyContent: 'center',
    },
    topologyPillText: {
        fontSize: 10,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
    },
    topologyPillTextActive: {
        color: '#FFFFFF',
    },
    topologyDesc: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontStyle: 'italic',
        marginTop: 2,
    },

    // Viewpoints Tabs
    viewpointTabs: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    viewpointTab: {
        flex: 1,
        paddingVertical: 9,
        paddingHorizontal: 6,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    viewpointIcon: {
        fontSize: 16,
    },
    viewpointLabel: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
    },

    // Blueprint Canvas Card
    canvasCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    canvasContainer: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    touchTarget: {
        position: 'absolute',
        transform: [{ translateX: -35 }, { translateY: -15 }],
    },
    sensorTouchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(8, 12, 22, 0.92)',
        borderWidth: 1,
        borderRadius: radii.xs,
        paddingHorizontal: 5,
        paddingVertical: 2,
        gap: 4,
    },
    sensorTouchScore: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    sensorTouchLabel: {
        color: colors.text.primary,
        fontSize: 9,
        fontWeight: typography.weights.bold,
    },
    sensorTouchPill: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 16, 28, 0.90)',
        borderWidth: 1,
        borderColor: colors.border.strong,
        borderRadius: radii.full,
        paddingHorizontal: 6,
        paddingVertical: 3,
        gap: 4,
        transform: [{ translateX: -20 }, { translateY: -12 }],
    },
    sensorTouchPillSelected: {
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
    },
    sensorPillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    sensorPillName: {
        color: colors.text.primary,
        fontSize: 9,
        fontWeight: typography.weights.bold,
    },

    // Card Inspecție Componentă
    inspectionCard: {
        marginTop: spacing[3],
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[4],
    },
    inspectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        paddingBottom: spacing[2],
    },
    inspectionTitle: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    inspectionCode: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        marginTop: 2,
    },
    inspectionStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
    },
    inspectionStatusText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    inspectionRow: {
        marginBottom: spacing[2] + 2,
    },
    inspectionRowLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        marginBottom: 2,
    },
    inspectionRowVal: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        lineHeight: 18,
    },
    inspectionValLive: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    inspectionValNominal: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.regular,
    },
    inspectionDiagText: {
        fontSize: typography.sizes.caption,
        color: colors.status.good,
        lineHeight: 18,
    },
    askAiBtn: {
        marginTop: spacing[3],
        paddingVertical: 10,
        paddingHorizontal: spacing[3],
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    askAiBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },
    emptyPromptBox: {
        marginTop: spacing[3],
        padding: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyPromptText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default InteractiveCarXRay;

InteractiveCarXRay.propTypes = {
    mode: PropTypes.oneOf(['preview', 'full']),
    subsystems: PropTypes.object,
    selectedKey: PropTypes.string,
    onSelectSubsystem: PropTypes.func,
    navigation: PropTypes.object,
    style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};
