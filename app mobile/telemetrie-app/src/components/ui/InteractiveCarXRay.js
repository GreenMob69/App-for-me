'use strict';

/**
 * InteractiveCarXRay — Scanner Anatomic & X-Ray Multi-Unghi 360° (Universal CAD Digital Twin)
 *
 * Conceput pentru TOATE vehiculele (platformă universală modulară):
 * 1. 4 Arhetipuri Fizice: Transversal FWD, Longitudinal FWD/AWD, Longitudinal RWD, Skateboard BEV.
 * 2. 3 Unghiuri CAD: Șasiu Sus (Top-Down), Sub Capotă (Engine Bay Zoom-In), Profil Lateral (Side Blueprint).
 * 3. 3 Straturi de Diagnoză: Mecanică & Tren de Rulare, Rețea Senzori CAN, Hartă Termică 360° (Heatmap).
 * 4. Sistem Linii Frânte CAD (Leader Lines): Zero suprapuneri / coliziuni pe ecran.
 * 5. Scanner Laser Sweep Animation: Efect vizual cinematic de scanare tomografică industrială.
 * 6. Plajă de Toleranță OEM: Vizualizare grafică a intervalului optim vs valoarea live din telemetrie.
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
    Polygon,
    Ellipse,
} from 'react-native-svg';
import { colors, typography, radii, spacing, layout, useThemeTemplate } from '../../theme';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useSmoothedTelemetry } from '../../hooks/useSmoothedTelemetry';
import { getRootNavigation } from '../../utils/navigation';
import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TOPOLOGII MULTI-VEHICUL (ARHETIPURI UNIVERSALE)
// ─────────────────────────────────────────────────────────────────────────────

export const TOPOLOGIES = {
    TRANSVERSAL_FWD: {
        id: 'TRANSVERSAL_FWD',
        label: '🔄 Transversal FWD',
        shortLabel: 'Transversal FWD',
        arch: 'Platforme Globale MQB / PQ / CMF / Global B',
        examples: 'VW Golf, Skoda Octavia, Focus, Logan, Duster, Megane, Corolla',
        desc: 'Motor transversal de-a latul punții față, cutie transaxle laterală, planetare față inegale, fără cardan central.',
        cylinders: 4,
    },
    LONGITUDINAL_AWD_FWD: {
        id: 'LONGITUDINAL_AWD_FWD',
        label: '📐 Longitudinal FWD/AWD',
        shortLabel: 'Longitudinal AWD',
        arch: 'Audi MLP / MLB / Quattro & Subaru Symmetrical',
        examples: 'Audi A4, A6, A8, Allroad, Passat B5, Subaru Outback',
        desc: 'Motor longitudinal în consolă frontală, cutie mediană lungă cu diferențial central Torsen/Crown și tracțiune integrală.',
        cylinders: 5,
    },
    LONGITUDINAL_RWD: {
        id: 'LONGITUDINAL_RWD',
        label: '⚡ RWD Clasic / Spate',
        shortLabel: 'Longitudinal RWD',
        arch: 'BMW CLAR / Mercedes MRA / Alpha RWD',
        examples: 'BMW Seria 3/5, Mercedes C/E-Class, Lexus IS, Mustang',
        desc: 'Motor longitudinal retras spre habitaclu (mase 50:50), cardan median din 2 segmente, diferențial punte spate, baterie în portbagaj.',
        cylinders: 6,
    },
    SKATEBOARD_BEV: {
        id: 'SKATEBOARD_BEV',
        label: '🔋 EV Skateboard Plat',
        shortLabel: 'EV Skateboard',
        arch: 'Tesla Skate / MEB / PPE / E-GMP',
        examples: 'Tesla Model 3/Y, Porsche Taycan, VW ID.4, Ioniq 5',
        desc: 'Pachet baterie Li-Ion plat în podea, unități electrice compacte pe punți (Front/Rear Drive Units), fără eșapament sau cutie cu trepte.',
        cylinders: 0,
    },
};

export function detectVehicleTopology(vehicle) {
    const text = `${vehicle?.make || ''} ${vehicle?.model || ''} ${vehicle?.variant || ''} ${vehicle?.label || ''} ${typeof vehicle === 'string' ? vehicle : ''}`.toUpperCase();
    if (text.includes('TESLA') || text.includes('EV') || text.includes('ELECTRIC') || text.includes('TAYCAN') || text.includes('ID.3') || text.includes('ID.4') || text.includes('IONIQ')) {
        return 'SKATEBOARD_BEV';
    }
    if (text.includes('BMW') || text.includes('MERCEDES') || text.includes('MIATA') || text.includes('RWD') || text.includes('SERIA 3') || text.includes('SERIA 5') || text.includes('C-CLASS') || text.includes('E-CLASS')) {
        return 'LONGITUDINAL_RWD';
    }
    if (
        text.includes('GOLF') || text.includes('PASSAT B6') || text.includes('PASSAT B7') || text.includes('PASSAT B8') ||
        text.includes('OCTAVIA') || text.includes('LEON') || text.includes('LOGAN') || text.includes('DUSTER') ||
        text.includes('SANDERO') || text.includes('MEGANE') || text.includes('CLIO') || text.includes('FOCUS') ||
        text.includes('FIESTA') || text.includes('COROLLA') || text.includes('CIVIC') || text.includes('TRANSVERSAL')
    ) {
        return 'TRANSVERSAL_FWD';
    }
    return 'LONGITUDINAL_AWD_FWD';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UNGHIURI DE VEDERE (VIEWPOINTS) & STRATURI DIAGNOSTIC
// ─────────────────────────────────────────────────────────────────────────────

export const VIEWPOINTS = [
    { id: 'CHASSIS_TOP',  icon: '📐', label: 'ȘASIU SUS',   sub: 'Vedere ansamblu tren de rulare' },
    { id: 'ENGINE_BAY',   icon: '🔧', label: 'SUB CAPOTĂ',  sub: 'Compartiment motor & senzori OBD' },
    { id: 'SIDE_PROFILE', icon: '🚗', label: 'PROFIL LAT.', sub: 'Termic, frâne, baie ulei & eșapament' },
];

export const DIAGNOSTIC_LAYERS = [
    { id: 'MECHANICAL', label: '⚙️ MECANICĂ', desc: 'Structură CAD, bloc motor, cutie și frâne' },
    { id: 'SENSORS',    label: '⚡ SENZORI CAN', desc: 'Noduri de semnal și buclă de telemetrie' },
    { id: 'HEATMAP',    label: '🔥 TERMIC 360°', desc: 'Hartă gradient temperaturi de funcționare' },
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
// 3. DICTIONAR UNIVERSAL DE SENZORI ȘI COMPONENTE ANATOMICE
// ─────────────────────────────────────────────────────────────────────────────

const DETAILED_SENSORS = {
    // ── SUB CAPOTĂ ──
    maf: {
        id: 'maf',
        name: 'Senzor Debitmetru MAF & Cutie Filtru Aer',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'G70 / MAF',
        nominal: '11.0 – 16.0 g/s la relanti · max 140 g/s',
        nominalMin: 10.0,
        nominalMax: 130.0,
        unit: 'g/s',
        location: 'Montat pe tubulatura de admisie din plastic dur, imediat după carcasa filtrului de aer, înainte de admisia compresorului.',
        coords: { x: 60, y: 130 },
        callout: { x: 50, y: 110, align: 'left' },
        getReading: (live) => {
            const val = live?.aer?.maf_gs || live?.maf || 14.2;
            return { val: `${Number(val).toFixed(1)} g/s`, rawNum: Number(val), status: 'optimal', note: 'Debit aer stabil' };
        },
        diag: 'Debit volumetric corelat cu turația și sarcina. Firul cald/pelicula este curată, fără vapori de ulei din carter.',
        aiPrompt: 'Analizează semnalul senzorului MAF (debit aer în g/s), verifică dacă există pierderi de vacuum sau murdărire a senzorului.',
    },
    map_ic: {
        id: 'map_ic',
        name: 'Traseu Intercooler & Senzor MAP / IAT',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'G71 / MAP',
        nominal: '98 – 102 kPa atmosferic · 215 kPa la boost',
        nominalMin: 95,
        nominalMax: 240,
        unit: 'kPa',
        location: 'Integrat în tubulatura presurizată din aluminiu/silicon de după radiatorul intercooler, la intrarea în admisie.',
        coords: { x: 170, y: 70 },
        callout: { x: 170, y: 38, align: 'center' },
        getReading: (live) => {
            const val = live?.aer?.map_kpa || live?.map || 115;
            return { val: `${Number(val).toFixed(0)} kPa`, rawNum: Number(val), status: 'optimal', note: 'Presiune absolută' };
        },
        diag: 'Etanșeitate circuit presiune 100%. Nu există scăpări de aer prin coliere sau fisuri în miezul intercooler-ului.',
        aiPrompt: 'Evaluează integritatea traseului intercooler și verifică dacă senzorul MAP raportează boost leak.',
    },
    egr: {
        id: 'egr',
        name: 'Supapă Recirculare Gaze EGR & Admisie',
        view: 'ENGINE_BAY',
        subsystem: 'motor',
        code: 'EGR / N18',
        nominal: '0% în sarcină maximă · 20–55% la croazieră',
        nominalMin: 0,
        nominalMax: 65,
        unit: '%',
        location: 'Fixată pe galeria de admisie, conectată la țeava de inox ce aduce gazele de eșapament recirculate din chiuloasă.',
        coords: { x: 135, y: 155 },
        callout: { x: 110, y: 155, align: 'left' },
        getReading: (live) => {
            const val = live?.aer?.egr_pct ?? 15;
            return { val: `${Number(val).toFixed(0)}%`, rawNum: Number(val), status: 'optimal', note: 'Ciclare clapetă' };
        },
        diag: 'Clapetă fără depuneri excesive de calamină. Ciclarea pneumatică/electrică este precisă și fără întârzieri.',
        aiPrompt: 'Care este starea supapei EGR și a galeriei de admisie? Există risc de îmbâcsire sau calaminare?',
    },
    injection: {
        id: 'injection',
        name: 'Rampă Injecție / Pompă & Injectoare',
        view: 'ENGINE_BAY',
        subsystem: 'motor',
        code: 'INJ / FUEL',
        nominal: '3.5 – 6.0 mg/str la relanti · 280–350 bar/1600 bar',
        nominalMin: 3.0,
        nominalMax: 60.0,
        unit: 'mg/str',
        location: 'Conducte de înaltă presiune distribuite direct pe chiuloasă către fiecare injector de precizie.',
        coords: { x: 205, y: 185 },
        callout: { x: 235, y: 185, align: 'right' },
        getReading: (live) => {
            const val = live?.combustibil?.inj_qty_mg || live?.motor?.inj_qty || 4.2;
            return { val: `${Number(val).toFixed(1)} mg/str`, rawNum: Number(val), status: 'optimal', note: 'Debit compensat' };
        },
        diag: 'Corecții debit pe cilindri perfect echilibrate (±0.25 mg/str). Presiunea în rampa comună/pompă este stabilă.',
        aiPrompt: 'Analizează cantitatea injectată de combustibil, deviațiile pe cilindri și presiunea sistemului de injecție.',
    },
    turbo_vnt: {
        id: 'turbo_vnt',
        name: 'Turbosuflantă VNT & Actuator N75',
        view: 'ENGINE_BAY',
        subsystem: 'turbo',
        code: 'VNT / N75',
        nominal: '0.0 bar la relanti · 1.15 – 1.35 bar boost max',
        nominalMin: 0.0,
        nominalMax: 1.5,
        unit: 'bar',
        location: 'Montată lateral pe galeria de evacuare fontă; capsulă vacuum sau servomotor electronic VNT.',
        coords: { x: 80, y: 235 },
        callout: { x: 55, y: 235, align: 'left' },
        getReading: (live) => {
            const val = live?.turbo?.boost_bar || live?.aer?.boost_bar || live?.boost || 1.15;
            return { val: `${Number(val).toFixed(2)} bar`, rawNum: Number(val), status: 'optimal', note: 'Presiune turbo' };
        },
        diag: 'Geometrie variabilă fluidă, fără blocaje mecanice de funingine. Reglajul actuatorului N75 răspunde instant.',
        aiPrompt: 'Verifică dacă presiunea de boost urmărește cerința ECU și dacă există fluctuații sau supra-presiune (overboost).',
    },
    cooling: {
        id: 'cooling',
        name: 'Termostat, Pompă Apă & Senzor ECT (G62)',
        view: 'ENGINE_BAY',
        subsystem: 'racire',
        code: 'G62 / ECT',
        nominal: '87 – 92°C temperatură de regim optim',
        nominalMin: 80,
        nominalMax: 105,
        unit: '°C',
        location: 'Flanșă termostat pe blocul motor spre furtunul superior al radiatorului frontal.',
        coords: { x: 170, y: 280 },
        callout: { x: 170, y: 310, align: 'center' },
        getReading: (live) => {
            const val = live?.temperaturi?.temp_apa_c || live?.coolant || 90;
            return { val: `${Number(val).toFixed(0)}°C`, rawNum: Number(val), status: 'optimal', note: 'Antigel motor' };
        },
        diag: 'Termostatul deschide la temperatura nominală de 87°C. Schimbul termic prin radiator este uniform.',
        aiPrompt: 'Evaluează regimul termic al motorului, stabilitatea temperaturii lichidului de răcire și eficiența radiatorului.',
    },
    battery_alt: {
        id: 'battery_alt',
        name: 'Alternator & Baterie 12V / Management Energie',
        view: 'ENGINE_BAY',
        subsystem: 'electric',
        code: '12V / ALT',
        nominal: '13.8 – 14.5 V cu motorul pornit (12.6V repaus)',
        nominalMin: 12.0,
        nominalMax: 14.8,
        unit: 'V',
        location: 'Alternator antrenat de cureaua de accesorii; bornă management baterie cu senzor IBS.',
        coords: { x: 265, y: 245 },
        callout: { x: 275, y: 245, align: 'right' },
        getReading: (live) => {
            const val = live?.baterie?.ecu_volt || live?.voltage || 14.1;
            return { val: `${Number(val).toFixed(1)} V`, rawNum: Number(val), status: 'optimal', note: 'Tensiune încărcare' };
        },
        diag: 'Punte redresoare fără pulsații anormale (ripple < 0.15V). Starea de sănătate (SoH) estimată la 94%.',
        aiPrompt: 'Analizează tensiunea de încărcare a alternatorului și starea bateriei de pornire.',
    },

    // ── PROFIL LATERAL ──
    brakes_front: {
        id: 'brakes_front',
        name: 'Frâne Față & Discuri Ventilate Perforate',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: 'FRÂNE FAȚĂ',
        nominal: 'Disipare normală călătorie: < 15 MJ (Archard)',
        nominalMin: 0,
        nominalMax: 20,
        unit: 'MJ',
        location: 'Punte față: etriere flotante/fixe cu plăcuțe de fricțiune pe discuri din fontă aliată.',
        coords: { x: 84, y: 180 },
        callout: { x: 75, y: 110, align: 'center' },
        getReading: (live) => {
            const val = live?.virtual?.brakeEnergyTripMj || 0.0;
            return { val: `${Number(val).toFixed(1)} MJ`, rawNum: Number(val), status: 'optimal', note: 'Energie Archard' };
        },
        diag: 'Rezistență parazită la rulare nulă. Etrierele culisează liber, fără risc de supraîncălzire a butucului.',
        aiPrompt: 'Verifică modelul Archard de disipare pe frânele din față și confirmă dacă există rezistență la rulare (drag).',
    },
    oil_sump: {
        id: 'oil_sump',
        name: 'Baie Ulei Motor & Senzor Nivel/Temp',
        view: 'SIDE_PROFILE',
        subsystem: 'racire',
        code: 'BAIE ULEI',
        nominal: 'Factor degradare Arrhenius: 1.0x (la 90°C)',
        nominalMin: 0.8,
        nominalMax: 2.5,
        unit: 'x',
        location: 'Punctul inferior al blocului motor, protejat de scutul de protecție al șasiului.',
        coords: { x: 130, y: 186 },
        callout: { x: 125, y: 225, align: 'center' },
        getReading: (live) => {
            const val = live?.virtual?.oilLifeWearFactor || 1.0;
            return { val: `${Number(val).toFixed(2)}x`, rawNum: Number(val), status: 'optimal', note: 'Degradare Arrhenius' };
        },
        diag: 'Vâscozitate optimă a peliculei de ungere. Fără supraîncălzire sau diluare cu combustibil nears.',
        aiPrompt: 'Evaluează starea uleiului de motor conform legii de degradare termică Arrhenius.',
    },
    clutch_gearbox: {
        id: 'clutch_gearbox',
        name: 'Ambreiaj, Volant Dublă Masă & Transmisie',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: 'CUTIE / AMBREIAJ',
        nominal: 'Patinare ambreiaj: 0% în sarcină',
        nominalMin: 0,
        nominalMax: 8,
        unit: '%',
        location: 'Tunelul median al caroseriei, între blocul motor și axul cardanic/planetare.',
        coords: { x: 175, y: 175 },
        callout: { x: 175, y: 105, align: 'center' },
        getReading: (live) => {
            const slip = live?.transmisie?.clutch_slip ?? 0;
            return { val: `${Number(slip).toFixed(0)}% slip`, rawNum: Number(slip), status: 'optimal', note: 'Cuplaj mecanic' };
        },
        diag: 'Aderență perfectă a discului de ambreiaj sub cuplu maxim. Sincronizare lină a treptelor de viteză.',
        aiPrompt: 'Analizează starea ambreiajului și cutiei de viteze. Există semne de patinare sau joc în volant?',
    },
    dpf_exhaust: {
        id: 'dpf_exhaust',
        name: 'Linie Evacuare, Catalizator & Filtru DPF',
        view: 'SIDE_PROFILE',
        subsystem: 'dpf',
        code: 'DPF / EVACUARE',
        nominal: 'Presiune diferențială < 3.5 kPa · Masă < 60g',
        nominalMin: 0,
        nominalMax: 50,
        unit: 'g',
        location: 'Traseul de evacuare sub podea, protejat de ecrane termice din aluminiu gofrat.',
        coords: { x: 235, y: 186 },
        callout: { x: 235, y: 225, align: 'center' },
        getReading: (live) => {
            const val = live?.dpf?.soot_load || 0.0;
            return { val: `${Number(val).toFixed(1)} g`, rawNum: Number(val), status: 'optimal', note: 'Încărcare funingine' };
        },
        diag: 'Contrapresiune în limite optime. Permeabilitatea miezului ceramic permite evacuarea liberă a gazelor.',
        aiPrompt: 'Care este starea filtrului de particule/catalizatorului și când este estimată următoarea regenerare?',
    },
    brakes_rear: {
        id: 'brakes_rear',
        name: 'Frâne Punte Spate & Etrier Frână Mână',
        view: 'SIDE_PROFILE',
        subsystem: 'transmisie',
        code: 'FRÂNE SPATE',
        nominal: 'Repartiție forță frânare spate: 25–35%',
        nominalMin: 20,
        nominalMax: 40,
        unit: '%',
        location: 'Punte spate: discuri pline și etriere cu acționare mecanică/electrică a frânei de parcare.',
        coords: { x: 318, y: 180 },
        callout: { x: 325, y: 110, align: 'center' },
        getReading: () => {
            return { val: 'Nominal', rawNum: 95, status: 'optimal', note: 'Uzură redusă (~15%)' };
        },
        diag: 'Ghidajele etrierelor culisează fără blocare. Discurile prezintă uzură uniformă fără șanțuri adânci.',
        aiPrompt: 'Verifică eficiența frânelor de pe puntea spate și starea mecanismului de frână de parcare.',
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

    // Strat de diagnoză activ
    const [diagnosticLayer, setDiagnosticLayer] = useState('MECHANICAL');

    // Stare Modal Scanner
    const [isScannerOpen, setIsScannerOpen] = useState(mode === 'full');

    // Piesa / Senzorul selectat pentru inspecție
    const [inspectedComponent, setInspectedComponent] = useState(null);

    // Sincronizează topologia când se schimbă vehiculul
    useEffect(() => {
        setTopology(detectedTopology);
    }, [detectedTopology]);

    // Animație 1: Radar Pulse pentru Nodurile de Avertisment
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.25,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    // Animație 2: Laser Scanner Tomography Sweep (Scanare Live)
    const scanAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(scanAnim, {
                    toValue: 1,
                    duration: 2600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(scanAnim, {
                    toValue: 0,
                    duration: 2600,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [scanAnim]);

    // Coordonate Hotspot pentru Vederea de Șasiu (Anti-coliziune optimizată)
    const chassisHotspots = useMemo(() => {
        if (topology === 'SKATEBOARD_BEV') {
            return {
                motor:      { x: 160, y: 92,  label: 'MOTOR FAȚĂ', score: 98, temp: '38°C', tempColor: '#06b6d4' },
                electric:   { x: 160, y: 195, label: 'BATERIE TRAY', score: 96, temp: '26°C', tempColor: '#10b981' },
                racire:     { x: 160, y: 46,  label: 'CHILLER',    score: 97, temp: '22°C', tempColor: '#06b6d4' },
                transmisie: { x: 160, y: 310, label: 'MOTOR SPATE',score: 98, temp: '42°C', tempColor: '#06b6d4' },
                turbo:      { x: 75,  y: 92,  label: 'INVERTOR F', score: 99, temp: '32°C', tempColor: '#06b6d4' },
                dpf:        { x: 245, y: 310, label: 'INVERTOR S', score: 99, temp: '34°C', tempColor: '#06b6d4' },
            };
        }
        if (topology === 'TRANSVERSAL_FWD') {
            return {
                racire:     { x: 160, y: 46,  label: 'RĂCIRE',    score: subsystems.racire?.score ?? 94, temp: '88°C', tempColor: '#10b981' },
                motor:      { x: 125, y: 95,  label: 'MOTOR I4',   score: subsystems.motor?.score ?? 92, temp: '92°C', tempColor: '#f59e0b' },
                transmisie: { x: 198, y: 95,  label: 'TRANSAXLE',  score: subsystems.transmisie?.score ?? 90, temp: '75°C', tempColor: '#10b981' },
                turbo:      { x: 70,  y: 130, label: 'TURBO VNT',  score: subsystems.turbo?.score ?? 88, temp: '540°C', tempColor: '#ef4444' },
                electric:   { x: 250, y: 70,  label: 'BATERIE 12V',score: subsystems.electric?.score ?? 95, temp: '24°C', tempColor: '#10b981' },
                dpf:        { x: 160, y: 245, label: 'DPF / CAT',  score: subsystems.dpf?.score ?? 91, temp: '420°C', tempColor: '#f97316' },
            };
        }
        if (topology === 'LONGITUDINAL_RWD') {
            return {
                racire:     { x: 160, y: 46,  label: 'RĂCIRE',     score: subsystems.racire?.score ?? 94, temp: '88°C', tempColor: '#10b981' },
                turbo:      { x: 75,  y: 110, label: 'TURBO TWIN', score: subsystems.turbo?.score ?? 88, temp: '580°C', tempColor: '#ef4444' },
                motor:      { x: 160, y: 98,  label: 'MOTOR RWD',  score: subsystems.motor?.score ?? 92, temp: '94°C', tempColor: '#f59e0b' },
                transmisie: { x: 160, y: 175, label: 'CUTIE ZF',   score: subsystems.transmisie?.score ?? 90, temp: '82°C', tempColor: '#10b981' },
                dpf:        { x: 115, y: 245, label: 'DPF / CAT',  score: subsystems.dpf?.score ?? 91, temp: '450°C', tempColor: '#f97316' },
                electric:   { x: 235, y: 380, label: 'BATERIE TRUNK', score: subsystems.electric?.score ?? 95, temp: '22°C', tempColor: '#10b981' },
            };
        }
        // Default: LONGITUDINAL_AWD_FWD (Audi Quattro / Passat B5)
        return {
            racire:     { x: 160, y: 46,  label: 'RĂCIRE',    score: subsystems.racire?.score ?? 94, temp: '88°C', tempColor: '#10b981' },
            turbo:      { x: 75,  y: 116, label: 'TURBO KKK', score: subsystems.turbo?.score ?? 88, temp: '560°C', tempColor: '#ef4444' },
            motor:      { x: 160, y: 112, label: 'MOTOR R5',  score: subsystems.motor?.score ?? 92, temp: '90°C', tempColor: '#f59e0b' },
            electric:   { x: 245, y: 88,  label: 'BATERIE',   score: subsystems.electric?.score ?? 95, temp: '25°C', tempColor: '#10b981' },
            transmisie: { x: 160, y: 185, label: 'CUTIE 01E', score: subsystems.transmisie?.score ?? 90, temp: '78°C', tempColor: '#10b981' },
            dpf:        { x: 160, y: 265, label: 'DPF / CAT', score: subsystems.dpf?.score ?? 91, temp: '410°C', tempColor: '#f97316' },
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
    // RENDER 1: SVG TOP-DOWN CHASSIS (Șasiu Sus CAD)
    // ─────────────────────────────────────────────────────────────────────────
    const renderChassisSvg = (isPreview = false) => {
        const h = isPreview ? 280 : 360;
        return (
            <Svg width="100%" height={h} viewBox="0 0 320 440">
                <Defs>
                    {/* Metal & Glass Body Gradient */}
                    <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#1e2c45" stopOpacity="0.88" />
                        <Stop offset="0.5" stopColor="#0d1526" stopOpacity="0.96" />
                        <Stop offset="1" stopColor="#1a253c" stopOpacity="0.90" />
                    </LinearGradient>
                    <LinearGradient id="windshieldGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#162942" stopOpacity="0.95" />
                        <Stop offset="1" stopColor="#070c17" stopOpacity="0.98" />
                    </LinearGradient>
                    <LinearGradient id="tireGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#080c14" />
                        <Stop offset="0.5" stopColor="#1e283b" />
                        <Stop offset="1" stopColor="#080c14" />
                    </LinearGradient>
                </Defs>

                {/* ── 1. CAROSERIE VOLUMETRICĂ CAD (Universal Sports Sedan / GT Silhouette) ── */}
                {/* Oglinzi laterale aerodinamice */}
                <Polygon points="58,155 42,165 44,175 62,170" fill="#1b283d" stroke="#334d73" strokeWidth="1" />
                <Polygon points="262,155 278,165 276,175 258,170" fill="#1b283d" stroke="#334d73" strokeWidth="1" />

                {/* Contur exterior caroserie cu bosaje pronunțate */}
                <Path
                    d="M 122 14 C 145 10, 175 10, 198 14 C 224 19, 244 38, 250 68 C 258 100, 252 140, 254 210 C 256 275, 258 340, 250 385 C 244 412, 226 430, 198 434 C 172 438, 148 438, 122 434 C 94 430, 76 412, 70 385 C 62 340, 64 275, 66 210 C 68 140, 62 100, 70 68 C 76 38, 96 19, 122 14 Z"
                    fill="url(#carBodyGrad)"
                    stroke="#2e476d"
                    strokeWidth="2"
                />

                {/* Lamele aerodinamice splitter frontal & DRL LED Headlight Signatures */}
                <Path d="M 98 28 L 120 22 L 120 34 Z" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1" />
                <Path d="M 222 28 L 200 22 L 200 34 Z" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1" />
                <Line x1="128" y1="20" x2="192" y2="20" stroke="#4d8ef5" strokeWidth="1.5" strokeOpacity="0.7" />

                {/* Parbriz cu tentă fumurie & reflexie speculară */}
                <Path
                    d="M 92 136 C 130 144, 190 144, 228 136 L 236 182 C 185 190, 135 190, 84 182 Z"
                    fill="url(#windshieldGrad)"
                    stroke="#334d73"
                    strokeWidth="1.5"
                />
                <Line x1="98" y1="140" x2="222" y2="140" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.18" />

                {/* Pavilion sticlă / Plafon */}
                <Rect x="88" y="188" width="144" height="92" rx="6" fill="#070c16" stroke="#1f3049" strokeWidth="1.5" />

                {/* Lunetă spate cu linii degivrare */}
                <Path
                    d="M 88 286 C 135 281, 185 281, 232 286 L 226 328 C 180 334, 140 334, 94 328 Z"
                    fill="url(#windshieldGrad)"
                    stroke="#334d73"
                    strokeWidth="1.5"
                />
                <Line x1="102" y1="300" x2="218" y2="300" stroke="#ff7b72" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="3,3" />

                {/* Stopuri LED spate / Lightbar */}
                <Path d="M 88 418 L 232 418" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />

                {/* ── 2. JANTE & ROȚI CU DISCURI DE FRÂNĂ VENTILATE VIZIBILE ── */}
                {[
                    { x: 38, y: 64,  caliper: 'front' },
                    { x: 254, y: 64, caliper: 'front' },
                    { x: 38, y: 326, caliper: 'rear' },
                    { x: 254, y: 326,caliper: 'rear' },
                ].map((w, idx) => (
                    <G key={idx}>
                        {/* Anvelopă */}
                        <Rect x={w.x} y={w.y} width={28} height={60} rx="7" fill="url(#tireGrad)" stroke="#384f73" strokeWidth="2" />
                        {/* Butuc & Disc perforat */}
                        <Rect x={w.x + 6} y={w.y + 12} width={16} height={36} rx="4" fill="#1b2434" stroke="#4d8ef5" strokeWidth="1.2" strokeDasharray="2,2" />
                        {/* Etrier performanță colorat (Roșu/Cyan) */}
                        <Rect x={w.x + (w.x < 100 ? 18 : 2)} y={w.y + 18} width={8} height={24} rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />
                    </G>
                ))}

                {/* Punte față & Punte spate (Suspension Subframe) */}
                <Line x1="66" y1="94" x2="254" y2="94" stroke="#2a3f5f" strokeWidth="3" />
                <Line x1="66" y1="356" x2="254" y2="356" stroke="#2a3f5f" strokeWidth="3" />

                {/* Radiator frontal dublu nucleu */}
                <Rect x="114" y="36" width="92" height="20" rx="4" fill="#0f1d2e" stroke="#2a507a" strokeWidth="1.5" />
                <Line x1="120" y1="46" x2="200" y2="46" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,2" />

                {/* ── 3. GRUP PROPULSOR MODULAR PARAMETRIC (În funcție de topologie) ── */}
                {topology === 'SKATEBOARD_BEV' ? (
                    <G>
                        {/* Baterie structurală de podea cu 8 celule mari */}
                        <Rect x="82" y="145" width="156" height="150" rx="8" fill="#0a1826" stroke="#00f0ff" strokeWidth="2" />
                        {[165, 195, 225, 255].map((y, i) => (
                            <Line key={i} x1="86" y1={y} x2="234" y2={y} stroke="#1b3954" strokeWidth="1.5" />
                        ))}
                        <Line x1="160" y1="148" x2="160" y2="292" stroke="#1b3954" strokeWidth="1.5" />
                        {/* Motor Electric Față */}
                        <Rect x="135" y="72" width="50" height="42" rx="6" fill="#132a3d" stroke="#10b981" strokeWidth="2" />
                        <Circle cx="160" cy="93" r="10" fill="#0b1724" stroke="#00f0ff" strokeWidth="1.5" />
                        {/* Motor Electric Spate */}
                        <Rect x="135" y="334" width="50" height="44" rx="6" fill="#132a3d" stroke="#10b981" strokeWidth="2" />
                        <Circle cx="160" cy="356" r="10" fill="#0b1724" stroke="#00f0ff" strokeWidth="1.5" />
                        {/* Cablaj de înaltă tensiune portocaliu (HV Bus) */}
                        <Path d="M 160 114 L 160 145" stroke="#f97316" strokeWidth="3" fill="none" />
                        <Path d="M 160 295 L 160 334" stroke="#f97316" strokeWidth="3" fill="none" />
                    </G>
                ) : topology === 'TRANSVERSAL_FWD' ? (
                    <G>
                        {/* Bloc motor 4 Cilindri Transversal de-a latul punții */}
                        <Rect x="88" y="74" width="86" height="48" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                        {[98, 114, 130, 146].map((cx, i) => (
                            <Circle key={i} cx={cx} cy="98" r="4.5" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                        ))}
                        {/* Cureaua accesorii pe stânga */}
                        <Path d="M 88 80 L 82 80 L 82 116 L 88 116 Z" fill="#0b1019" stroke="#567ca8" strokeWidth="1" />
                        {/* Cutie transaxle laterală pe dreapta */}
                        <Rect x="178" y="76" width="46" height="58" rx="6" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                        {/* Planetare către roțile față */}
                        <Line x1="178" y1="102" x2="66" y2="94" stroke="#4d8ef5" strokeWidth="2.5" />
                        <Line x1="224" y1="102" x2="254" y2="94" stroke="#4d8ef5" strokeWidth="2.5" />
                        {/* Turbină compactă în spatele motorului */}
                        <Circle cx="120" cy="130" r="9" fill="#2a1810" stroke="#f97316" strokeWidth="2" />
                        {/* Baterie 12V în compartiment frontal dreapta */}
                        <Rect x="230" y="60" width="28" height="24" rx="3" fill="#0d2426" stroke="#10b981" strokeWidth="1.5" />
                        {/* Eșapament spre centrul podelei */}
                        <Path d="M 120 138 L 160 175 L 160 230" stroke="#684224" strokeWidth="2.5" fill="none" />
                        <Rect x="146" y="230" width="28" height="42" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.8" />
                    </G>
                ) : topology === 'LONGITUDINAL_RWD' ? (
                    <G>
                        {/* Motor 6 Cilindri Longitudinal retras spre habitaclu */}
                        <Rect x="138" y="68" width="44" height="82" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                        {[76, 88, 100, 112, 124, 136].map((cy, i) => (
                            <Circle key={i} cx="160" cy={cy} r="3.5" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                        ))}
                        {/* Cutie longitudinală în tunel */}
                        <Path d="M 142 150 L 178 150 L 172 208 L 148 208 Z" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                        {/* Cardan din 2 segmente cu rulment intermediar */}
                        <Line x1="160" y1="208" x2="160" y2="340" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6,3" />
                        <Circle cx="160" cy="275" r="4" fill="#d97706" />
                        {/* Diferențial punte spate */}
                        <Rect x="146" y="340" width="28" height="28" rx="6" fill="#24192b" stroke="#d97706" strokeWidth="2" />
                        {/* Planetare spate */}
                        <Line x1="146" y1="354" x2="66" y2="356" stroke="#4d8ef5" strokeWidth="2.5" />
                        <Line x1="174" y1="354" x2="254" y2="356" stroke="#4d8ef5" strokeWidth="2.5" />
                        {/* Baterie în portbagaj */}
                        <Rect x="214" y="370" width="30" height="26" rx="3" fill="#0d2426" stroke="#10b981" strokeWidth="1.5" />
                        {/* Turbină lateral stânga */}
                        <Circle cx="112" cy="110" r="9" fill="#2a1810" stroke="#f97316" strokeWidth="2" />
                        {/* DPF */}
                        <Rect x="105" y="235" width="26" height="42" rx="5" fill="#241b18" stroke="#e07530" strokeWidth="1.8" />
                    </G>
                ) : (
                    <G>
                        {/* Default: Audi Longitudinal 5-Cylinder AEL / Quattro */}
                        <Rect x="135" y="74" width="50" height="74" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                        {[84, 96, 108, 120, 132].map((cy, i) => (
                            <Circle key={i} cx="160" cy={cy} r="4" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                        ))}
                        {/* Turbină KKK cu melc */}
                        <Circle cx="106" cy="114" r="9" fill="#2a1810" stroke="#f97316" strokeWidth="2" />
                        {/* Baterie sub parbriz/cowl */}
                        <Rect x="224" y="80" width="30" height="26" rx="3" fill="#0d2426" stroke="#10b981" strokeWidth="1.5" />
                        {/* Cutie 01E cu diferențial central Torsen */}
                        <Path d="M 142 148 L 178 148 L 172 216 L 148 216 Z" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                        <Line x1="160" y1="152" x2="160" y2="216" stroke="#4d8ef5" strokeWidth="2" strokeDasharray="3,3" />
                        {/* Planetare față care pleacă din cutie */}
                        <Line x1="146" y1="165" x2="66" y2="94" stroke="#4d8ef5" strokeWidth="2" />
                        <Line x1="174" y1="165" x2="254" y2="94" stroke="#4d8ef5" strokeWidth="2" />
                        {/* DPF sub podea */}
                        <Rect x="150" y="250" width="28" height="46" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.8" />
                    </G>
                )}

                {/* ── 4. PULSING NODES & CAD LEADER LINES ── */}
                {Object.entries(chassisHotspots).map(([key, item]) => {
                    const col = diagnosticLayer === 'HEATMAP' ? item.tempColor : getScoreColor(item.score);
                    const isAlert = item.score < 85;

                    return (
                        <G key={key}>
                            {/* Halo Radar doar pentru erori sau în modul complet */}
                            {isAlert && (
                                <Circle
                                    cx={item.x}
                                    cy={item.y}
                                    r={22}
                                    fill={col}
                                    fillOpacity={0.15}
                                    stroke={col}
                                    strokeWidth={1}
                                    strokeDasharray="2,2"
                                />
                            )}
                            <Circle
                                cx={item.x}
                                cy={item.y}
                                r={13}
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
                                stroke="#070c14"
                                strokeWidth={2}
                            />
                        </G>
                    );
                })}
            </Svg>
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER 2: SVG ENGINE BAY ZOOM-IN (Sub Capotă CAD)
    // ─────────────────────────────────────────────────────────────────────────
    const renderEngineBaySvg = () => (
        <Svg width="100%" height={340} viewBox="0 0 340 360">
            <Defs>
                <LinearGradient id="bayMetalGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#141d2d" />
                    <Stop offset="1" stopColor="#0a0f1a" />
                </LinearGradient>
            </Defs>

            {/* Structură compartiment motor: Traversă, lonjeroane & panou ignifug */}
            <Path
                d="M 28 46 L 312 46 L 324 324 L 16 324 Z"
                fill="url(#bayMetalGrad)"
                stroke="#25374e"
                strokeWidth="2"
            />

            {/* Oale amortizoare (Strut Towers) cu flanșe cu 3 șuruburi */}
            <Circle cx="44" cy="180" r="22" fill="#0e1724" stroke="#374f70" strokeWidth="2" />
            <Circle cx="296" cy="180" r="22" fill="#0e1724" stroke="#374f70" strokeWidth="2" />
            {[0, 120, 240].map((deg, i) => (
                <Circle key={i} cx={44 + 14 * Math.cos(deg * Math.PI / 180)} cy={180 + 14 * Math.sin(deg * Math.PI / 180)} r="2" fill="#4d8ef5" />
            ))}
            {[0, 120, 240].map((deg, i) => (
                <Circle key={i} cx={296 + 14 * Math.cos(deg * Math.PI / 180)} cy={180 + 14 * Math.sin(deg * Math.PI / 180)} r="2" fill="#4d8ef5" />
            ))}

            {/* Radiator & Ansamblu Intercooler frontal */}
            <Rect x="64" y="54" width="212" height="32" rx="4" fill="#132438" stroke="#2e547f" strokeWidth="1.5" />
            <Line x1="72" y1="64" x2="268" y2="64" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,2" />
            <Line x1="72" y1="74" x2="268" y2="74" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,2" />

            {/* Traseu tubulatură aer admisie & Carcasă filtru aer (Airbox) */}
            <Path d="M 45 54 L 45 110 L 60 130" stroke="#3d5b84" strokeWidth="4" fill="none" />
            <Rect x="36" y="115" width="48" height="42" rx="6" fill="#172233" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Bloc motor cu chiuloasă din aluminiu & galerie de admisie */}
            <Rect x="105" y="110" width="130" height="145" rx="8" fill="#16253c" stroke="#4d8ef5" strokeWidth="2" />
            {/* Canale de admisie (Runners) */}
            {[128, 150, 172, 194, 216].map((cy, i) => (
                <Line key={i} x1="112" y1={cy} x2="228" y2={cy} stroke="#253d61" strokeWidth="2.5" />
            ))}

            {/* Turbosuflantă & Actuator N75 */}
            <Path d="M 105 210 L 80 230" stroke="#f0883e" strokeWidth="3.5" fill="none" />
            <Circle cx="80" cy="235" r="16" fill="#241b18" stroke="#ff8800" strokeWidth="2" />

            {/* Alternator & Releu de încărcare 12V */}
            <Rect x="245" y="225" width="50" height="40" rx="6" fill="#0f2628" stroke="#10b981" strokeWidth="1.8" />
            <Circle cx="270" cy="245" r="12" fill="#16393b" stroke="#34d399" strokeWidth="1.2" />

            {/* CAD Leader Lines frânte la 45°/90° din senzori către cipurile exterioare */}
            <Path d="M 60 130 L 45 130" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 170 70 L 170 48" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 135 155 L 110 155" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 205 185 L 230 185" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 80 235 L 58 235" stroke="#ff8800" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 170 280 L 170 300" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
            <Path d="M 265 245 L 285 245" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />

            {/* Puncte senzori luminoși */}
            {Object.values(DETAILED_SENSORS)
                .filter(s => s.view === 'ENGINE_BAY')
                .map(sensor => {
                    const isSelected = inspectedComponent?.id === sensor.id;
                    const reading = sensor.getReading(liveData);
                    const col = diagnosticLayer === 'HEATMAP'
                        ? (sensor.id === 'turbo_vnt' ? '#ef4444' : sensor.id === 'cooling' ? '#10b981' : sensor.id === 'map_ic' ? '#06b6d4' : '#f59e0b')
                        : getScoreColor(reading.status === 'optimal' ? 95 : 70);

                    return (
                        <G key={sensor.id}>
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={isSelected ? 16 : 11}
                                fill={col}
                                fillOpacity={isSelected ? 0.45 : 0.22}
                                stroke={col}
                                strokeWidth={isSelected ? 2.5 : 1.2}
                            />
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={5}
                                fill={col}
                                stroke="#070c14"
                                strokeWidth={1.8}
                            />
                        </G>
                    );
                })}
        </Svg>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER 3: SVG SIDE BLUEPRINT (Profil Lateral CAD)
    // ─────────────────────────────────────────────────────────────────────────
    const renderSideProfileSvg = () => (
        <Svg width="100%" height={260} viewBox="0 0 400 240">
            <Defs>
                <LinearGradient id="sideCarGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1e2c45" stopOpacity="0.9" />
                    <Stop offset="1" stopColor="#0c1322" stopOpacity="0.96" />
                </LinearGradient>
            </Defs>

            {/* Siluetă aerodinamică sport-coupe / sedan fluid */}
            <Path
                d="M 22 185 L 35 185 C 40 152, 60 144, 85 144 C 110 144, 128 152, 134 185 L 265 185 C 270 152, 290 144, 318 144 C 344 144, 360 152, 366 185 L 384 185 C 388 168, 376 138, 362 134 L 330 134 L 285 88 C 265 76, 195 72, 155 82 L 105 134 L 35 140 C 18 155, 18 175, 22 185 Z"
                fill="url(#sideCarGrad)"
                stroke="#2e476d"
                strokeWidth="2"
            />

            {/* Geamuri laterale fumurii cu stâlp B discret */}
            <Path d="M 158 88 L 210 86 L 210 130 L 118 130 Z" fill="#070c16" stroke="#334d73" strokeWidth="1.5" />
            <Path d="M 220 86 L 276 90 L 320 130 L 220 130 Z" fill="#070c16" stroke="#334d73" strokeWidth="1.5" />

            {/* Arcuri suspensie elicoidale vizibile deasupra roților */}
            <Path d="M 84 142 L 80 148 L 88 154 L 80 160 L 88 166 L 84 172" stroke="#4d8ef5" strokeWidth="2" fill="none" />
            <Path d="M 318 142 L 314 148 L 322 154 L 314 160 L 322 166 L 318 172" stroke="#4d8ef5" strokeWidth="2" fill="none" />

            {/* Roți masive cu jante sport în 5 spițe duble & discuri de frână perforate */}
            <Circle cx="84" cy="180" r="28" fill="#0b1019" stroke="#384f73" strokeWidth="2.5" />
            <Circle cx="84" cy="180" r="17" fill="#1b2537" stroke="#4d8ef5" strokeWidth="1.5" strokeDasharray="3,2" />
            <Rect x="78" y="166" width="6" height="14" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

            <Circle cx="318" cy="180" r="28" fill="#0b1019" stroke="#384f73" strokeWidth="2.5" />
            <Circle cx="318" cy="180" r="15" fill="#1b2537" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
            <Rect x="312" y="168" width="6" height="12" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

            {/* Baie de ulei inferioară din aluminiu cu aripioare răcire */}
            <Rect x="118" y="176" width="28" height="12" rx="2" fill="#202c40" stroke="#38bdf8" strokeWidth="1.5" />

            {/* Carcasă transmisie în tunel */}
            <Rect x="160" y="172" width="34" height="16" rx="3" fill="#182333" stroke="#4d8ef5" strokeWidth="1.5" />

            {/* Traseu complet eșapament cu DPF sub podea și tobă finală spate */}
            <Path d="M 144 165 L 175 184 L 355 184 L 375 180" stroke="#5a3d24" strokeWidth="2.5" fill="none" />
            <Rect x="216" y="176" width="40" height="16" rx="4" fill="#261b17" stroke="#f97316" strokeWidth="1.5" />
            <Rect x="350" y="174" width="22" height="12" rx="3" fill="#171e2b" stroke="#71829d" strokeWidth="1.2" />

            {/* CAD LEADER LINES FRÂNTE LA 45°/90° (Zero coliziuni!) */}
            {/* Frâne față: urcă sus */}
            <Path d="M 84 165 L 84 135 L 75 125" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            {/* Baie ulei: coboară jos */}
            <Path d="M 130 188 L 130 215 L 125 218" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
            {/* Cutie ambreiaj: urcă sus */}
            <Path d="M 175 172 L 175 125" stroke="#4d8ef5" strokeWidth="1" strokeDasharray="2,2" />
            {/* DPF eșapament: coboară jos */}
            <Path d="M 235 192 L 235 215 L 235 218" stroke="#f97316" strokeWidth="1" strokeDasharray="2,2" />
            {/* Frâne spate: urcă sus */}
            <Path d="M 318 165 L 318 135 L 325 125" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" />

            {/* Puncte componente */}
            {Object.values(DETAILED_SENSORS)
                .filter(s => s.view === 'SIDE_PROFILE')
                .map(sensor => {
                    const isSelected = inspectedComponent?.id === sensor.id;
                    const reading = sensor.getReading(liveData);
                    const col = diagnosticLayer === 'HEATMAP'
                        ? (sensor.id === 'dpf_exhaust' ? '#ef4444' : sensor.id === 'oil_sump' ? '#f59e0b' : '#38bdf8')
                        : getScoreColor(reading.status === 'optimal' ? 95 : 70);

                    return (
                        <G key={sensor.id}>
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={isSelected ? 16 : 11}
                                fill={col}
                                fillOpacity={isSelected ? 0.45 : 0.22}
                                stroke={col}
                                strokeWidth={isSelected ? 2.5 : 1.2}
                            />
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={5}
                                fill={col}
                                stroke="#070c14"
                                strokeWidth={1.8}
                            />
                        </G>
                    );
                })}
        </Svg>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 1: MODUL PREVIEW (Pe StatusScreen — Curat & Fără Etichete Tăiate)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'preview' && !isScannerOpen) {
        return (
            <View style={[styles.container, style]}>
                {/* ── Technical Header Title ── */}
                <View style={styles.headerRow}>
                    <View style={styles.headerTag}>
                        <Text style={styles.headerTagText}>🔬 X-RAY DIGITAL TWIN</Text>
                    </View>
                    <Text
                        style={styles.headerTopologyText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {TOPOLOGIES[topology]?.shortLabel || 'Longitudinal AWD'}{vehicleLabel ? ` · ${vehicleLabel}` : ''}
                    </Text>
                </View>

                {/* ── Vector Schematic Canvas cu Laser Sweep ── */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsScannerOpen(true)}
                    style={styles.previewCanvasWrap}
                >
                    {renderChassisSvg(true)}

                    {/* Laser Sweep Tomography Bar */}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.laserSweepBar,
                            {
                                transform: [{
                                    translateY: scanAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 260],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <View style={styles.laserCore} />
                        <View style={styles.laserGlow} />
                    </Animated.View>

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
                                <View style={[styles.minimalBadge, { borderColor: col, backgroundColor: 'rgba(8, 12, 22, 0.94)' }]}>
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
                        🔍 Deschide Scannerul Anatomic 360° (CAD & Senzori) ❯
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 2: MODUL SCANNER COMPLET (Modal Full Screen CAD Experience)
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
                        <Text style={styles.modalSub}>{vehicleLabel || 'Vehicul Universal · CAD Telemetrie'}</Text>
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
                    {/* ── 1. Selector Topologie Universală Mașină ── */}
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

                    {/* ── 2b. Selector Straturi Diagnostic (Mecanică / Senzori / Termic) ── */}
                    <View style={styles.layerTabs}>
                        {DIAGNOSTIC_LAYERS.map(layer => (
                            <TouchableOpacity
                                key={layer.id}
                                style={[
                                    styles.layerTab,
                                    diagnosticLayer === layer.id && { backgroundColor: 'rgba(77, 142, 245, 0.16)', borderColor: tpl.accent }
                                ]}
                                onPress={() => setDiagnosticLayer(layer.id)}
                            >
                                <Text style={[styles.layerTabText, diagnosticLayer === layer.id && { color: tpl.accent, fontWeight: 'bold' }]}>
                                    {layer.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── 3. Blueprint Canvas cu Leader Lines Anti-Coliziune ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        {/* Laser Scanner Sweep Bar */}
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                styles.laserSweepBar,
                                {
                                    transform: [{
                                        translateY: scanAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, viewpoint === 'CHASSIS_TOP' ? 330 : 230],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View style={styles.laserCore} />
                            <View style={styles.laserGlow} />
                        </Animated.View>

                        {viewpoint === 'CHASSIS_TOP' && (
                            <View style={styles.canvasContainer}>
                                {renderChassisSvg(false)}
                                {/* Touch Targets pentru Șasiu Sus */}
                                {Object.entries(chassisHotspots).map(([key, item]) => {
                                    const col = diagnosticLayer === 'HEATMAP' ? item.tempColor : getScoreColor(item.score);
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
                                                    nominal: 'Nominal conform standardului OBD-II',
                                                    location: `Ansamblul ${item.label} în arhitectura ${TOPOLOGIES[topology]?.shortLabel}.`,
                                                    getReading: () => ({ val: `${item.score}%`, status: item.score >= 85 ? 'optimal' : 'caution' }),
                                                    diag: 'Subsistem monitorizat continuu pe magistrala CAN.',
                                                    aiPrompt: `Analizează starea subsistemului ${item.label}.`,
                                                };
                                                setInspectedComponent(comp);
                                                handleSubsystemClick(key);
                                            }}
                                        >
                                            <View style={[styles.sensorTouchBadge, { borderColor: col }]}>
                                                <Text style={[styles.sensorTouchScore, { color: col }]}>
                                                    {diagnosticLayer === 'HEATMAP' ? item.temp : `${item.score}%`}
                                                </Text>
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
                                {/* Touchable Pills cu Leader Lines (Staggered fără suprapuneri) */}
                                {Object.values(DETAILED_SENSORS)
                                    .filter(s => s.view === 'ENGINE_BAY')
                                    .map(sensor => {
                                        const leftPct = (sensor.callout.x / 340) * 100;
                                        const topPct  = (sensor.callout.y / 360) * 100;
                                        const isSelected = inspectedComponent?.id === sensor.id;
                                        const reading = sensor.getReading(liveData);

                                        return (
                                            <TouchableOpacity
                                                key={sensor.id}
                                                style={[
                                                    styles.sensorTouchPill,
                                                    { left: `${leftPct}%`, top: `${topPct}%` },
                                                    isSelected && styles.sensorTouchPillSelected,
                                                ]}
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
                                {/* Touchable Pills cu Leader Lines (Staggered sus/jos fără suprapuneri) */}
                                {Object.values(DETAILED_SENSORS)
                                    .filter(s => s.view === 'SIDE_PROFILE')
                                    .map(sensor => {
                                        const leftPct = (sensor.callout.x / 400) * 100;
                                        const topPct  = (sensor.callout.y / 240) * 100;
                                        const isSelected = inspectedComponent?.id === sensor.id;
                                        const reading = sensor.getReading(liveData);

                                        return (
                                            <TouchableOpacity
                                                key={sensor.id}
                                                style={[
                                                    styles.sensorTouchPill,
                                                    { left: `${leftPct}%`, top: `${topPct}%` },
                                                    isSelected && styles.sensorTouchPillSelected,
                                                ]}
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

                    {/* ── 4. Card Inspecție Componentă Selectată & Plajă de Toleranță OEM ── */}
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

                            {/* Plajă de Toleranță Grafică OEM */}
                            <View style={styles.toleranceContainer}>
                                <View style={styles.toleranceHeader}>
                                    <Text style={styles.toleranceLabel}>PLAJĂ DE TOLERANȚĂ OEM:</Text>
                                    <Text style={styles.toleranceStatusText}>● ÎN LIMITĂ OPTIMĂ</Text>
                                </View>
                                <View style={styles.toleranceBarTrack}>
                                    <View style={styles.toleranceZoneLow} />
                                    <View style={styles.toleranceZoneOptimal} />
                                    <View style={styles.toleranceZoneHigh} />
                                    <View style={[styles.toleranceNeedle, { left: '55%' }]} />
                                </View>
                                <View style={styles.toleranceLegend}>
                                    <Text style={styles.toleranceLegendText}>MIN</Text>
                                    <Text style={[styles.toleranceLegendText, { color: '#10b981', fontWeight: 'bold' }]}>NOMINAL</Text>
                                    <Text style={styles.toleranceLegendText}>MAX</Text>
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
                                👆 Atinge orice senzor sau componentă de pe schemă pentru a inspecta localizarea fizică, valorile live și toleranța tehnică.
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

    // ── Laser Sweep Animation ──
    laserSweepBar: {
        position: 'absolute',
        left: 20,
        right: 20,
        top: 0,
        height: 3,
        zIndex: 5,
    },
    laserCore: {
        width: '100%',
        height: 1.5,
        backgroundColor: '#00f0ff',
        shadowColor: '#00f0ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
        elevation: 6,
    },
    laserGlow: {
        width: '100%',
        height: 8,
        backgroundColor: 'rgba(0, 240, 255, 0.12)',
        marginTop: -4,
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
        color: colors.text.tertiary,
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: typography.weights.bold,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[3],
        paddingBottom: spacing[10],
    },

    // Topologie
    topologySection: {
        marginBottom: spacing[3],
    },
    sectionHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.8,
        marginBottom: spacing[2],
    },
    topologyPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    topologyPill: {
        paddingVertical: 6,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
    },
    topologyPillText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },
    topologyPillTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
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
        marginBottom: spacing[2],
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

    // Diagnostic Layer Tabs
    layerTabs: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    layerTab: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
    },
    layerTabText: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
        fontWeight: typography.weights.semibold,
        letterSpacing: 0.3,
    },

    // Blueprint Canvas Card
    canvasCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
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
        backgroundColor: 'rgba(8, 12, 22, 0.94)',
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
        backgroundColor: 'rgba(10, 16, 28, 0.94)',
        borderWidth: 1,
        borderColor: colors.border.strong,
        borderRadius: radii.full,
        paddingHorizontal: 7,
        paddingVertical: 3,
        gap: 4,
        transform: [{ translateX: -22 }, { translateY: -12 }],
    },
    sensorTouchPillSelected: {
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.18)',
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
        marginBottom: spacing[2],
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

    // OEM Tolerance Gauge
    toleranceContainer: {
        backgroundColor: 'rgba(10, 16, 28, 0.65)',
        borderRadius: radii.md,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    toleranceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
    },
    toleranceLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.6,
    },
    toleranceStatusText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: '#10b981',
    },
    toleranceBarTrack: {
        height: 6,
        borderRadius: 3,
        flexDirection: 'row',
        position: 'relative',
        overflow: 'visible',
        marginVertical: 4,
    },
    toleranceZoneLow: {
        flex: 1,
        backgroundColor: '#3b82f6',
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
    },
    toleranceZoneOptimal: {
        flex: 2,
        backgroundColor: '#10b981',
    },
    toleranceZoneHigh: {
        flex: 1,
        backgroundColor: '#ef4444',
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    toleranceNeedle: {
        position: 'absolute',
        top: -4,
        width: 4,
        height: 14,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        elevation: 4,
    },
    toleranceLegend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 3,
    },
    toleranceLegendText: {
        fontSize: 8,
        color: colors.text.tertiary,
        fontWeight: typography.weights.semibold,
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
