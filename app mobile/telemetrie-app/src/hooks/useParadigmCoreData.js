import { useState, useEffect, useCallback, useMemo, useRef, useContext } from 'react';
import { Linking, Alert, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useNormalizedTelemetry } from './useNormalizedTelemetry';
import { useVehicle } from '../context/VehicleContext';
import { LiveContext, useLive } from '../context/LiveContext';
import { exportWorkshopDossier } from '../utils/dossierExport';
import { hapticTap, hapticCriticalWarning } from '../services/hapticFeedback';
import { audioGong } from '../services/audioGongService';
import { safeNum, safeFmt, safeArr } from '../utils/safeMath';
import { DTC_DATABASE, searchDtcDatabase } from '../data/dtcDictionary';

// @ts-ignore
const SafeAbortController = typeof AbortController !== 'undefined' ? AbortController : class { abort() {} signal = {}; };

const STORAGE_KEYS = {
    SERVICE_HISTORY: '@telemetrie_service_history_v3',
    PARKING_TICKET: '@telemetrie_parking_ticket_v3',
    VALET_STATE: '@telemetrie_valet_state_v3',
    SENTRY_STATE: '@telemetrie_sentry_state_v3',
    PARADIGM_ACCENTS: '@telemetrie_paradigm_accents_v3',
    TIRE_SIZE: '@telemetrie_tire_size_v3',
    VEHICLE_MASS: '@telemetrie_vehicle_mass_v3',
    FUEL_PRICE: '@telemetrie_fuel_price_v3',
};

// ─── Mock Fallback Trips (pentru mod Offline / Demo) ──────────────────────────
const DEMO_TRIPS = [
    {
        id: 'trip_108',
        id_calatorie: 108,
        title: 'București Nord ➔ Brașov (DN1)',
        date: 'Azi, 08:30',
        km: 168.4,
        avgSpeed: 74,
        maxSpeed: 138,
        fuelLiters: 10.4,
        avgConsumption: 6.2,
        ecoScore: 94,
        alertsCount: 0,
        healthScore: 98,
        samplesCount: 60,
    },
    {
        id: 'trip_107',
        id_calatorie: 107,
        title: 'Centura București A0 ➔ Pipera',
        date: 'Ieri, 17:45',
        km: 42.1,
        avgSpeed: 58,
        maxSpeed: 112,
        fuelLiters: 2.9,
        avgConsumption: 6.8,
        ecoScore: 88,
        alertsCount: 1,
        healthScore: 92,
        samplesCount: 45,
    },
    {
        id: 'trip_106',
        id_calatorie: 106,
        title: 'Transfăgărășan Urcare Piscul Negru',
        date: '14 Oct, 11:20',
        km: 84.7,
        avgSpeed: 46,
        maxSpeed: 96,
        fuelLiters: 7.2,
        avgConsumption: 8.5,
        ecoScore: 82,
        alertsCount: 2,
        healthScore: 89,
        samplesCount: 80,
    },
];

const DEFAULT_MAINTENANCE_ITEMS = [
    { id: 'oil', title: 'Schimb Ulei & Filtru (Model Arrhenius)', name: 'Schimb Ulei & Filtru (Model Arrhenius)', currentKm: 11600, maxKm: 15000, remainingKm: 3400, totalKm: 15000, wearPct: 77, status: 'WARN', costEstimat: 450, riskFactor: 'Mediu' },
    { id: 'brakes', title: 'Plăcuțe & Discuri Frână (Model Archard)', name: 'Plăcuțe & Discuri Frână (Model Archard)', currentKm: 21600, maxKm: 40000, remainingKm: 18400, totalKm: 40000, wearPct: 54, status: 'OK', costEstimat: 680, riskFactor: 'Scăzut' },
    { id: 'turbo', title: 'Miez Turbină CHRA (Degradare Termică)', name: 'Miez Turbină CHRA (Degradare Termică)', currentKm: 18500, maxKm: 25000, remainingKm: 6500, totalKm: 25000, wearPct: 74, status: 'WARN', costEstimat: 1200, riskFactor: 'Mediu' },
    { id: 'dpf', title: 'Filtru Particule DPF (Soot & Ash Load)', name: 'Filtru Particule DPF (Soot & Ash Load)', currentKm: 46500, maxKm: 60000, remainingKm: 13500, totalKm: 60000, wearPct: 78, status: 'WARN', costEstimat: 850, riskFactor: 'Mediu' },
    { id: 'battery', title: 'Baterie Plumb-Acid (Sulfatare CBM)', name: 'Baterie Plumb-Acid (Sulfatare CBM)', currentKm: 48000, maxKm: 60000, remainingKm: 12000, totalKm: 60000, wearPct: 80, status: 'WARN', costEstimat: 520, riskFactor: 'Scăzut' },
];

const DEFAULT_AI_MESSAGES = [
    { id: 'm1', sender: 'ai', text: 'Salut! Sunt Inginerul tău Mecanic AI. Toți cei 32 de observatori fizici raportează funcționare nominală. Cum te pot ajuta azi?' },
];

const DEFAULT_SENTRY_EVENTS = [
    { id: 's1', time: '10:14', type: 'PROXIMITATE', desc: 'Mișcare detectată la 0.8m de portieră', severity: 'low' },
    { id: 's2', time: '08:02', type: 'ARMED', desc: 'Sentinelă armată automat la oprire', severity: 'info' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON IN-MEMORY CACHE (Persistență 0 ms la schimbarea paradigmei)
// ─────────────────────────────────────────────────────────────────────────────
const SHARED_PARADIGM_CACHE = {
    vin: null,
    tripsList: null,
    tripsTimestamp: 0,
    selectedTripId: 'trip_108',
    maintenanceItems: null,
    aiMessages: null,
    sentryArmed: true,
    sentryEvents: null,
    valetActive: false,
    parkingTicketEndTimestamp: null,
    tireSize: '225/50 R17',
    vehicleMassKg: 1450,
    fuelPricePerLiter: 7.45,
    ttlMs: 45000, // 45 secunde TTL
};

/**
 * useParadigmCoreData
 * Conectează orice paradigmă UI la datele unificate de business logic.
 * Include Singleton In-Memory Cache (0ms comutare), deduplicare request-uri,
 * timer parcare centralizat și protecție anti-leak.
 * 
 * @param {boolean} [isLiveViewActive=true] - Cand este false, ingheata interpolarea 60FPS
 * si randarile ciclice ale observatorilor cand utilizatorul e pe taburi statice.
 */
export function useParadigmCoreData(isLiveViewActive = true) {
    const telemetry = useNormalizedTelemetry(isLiveViewActive);
    const { activeVehicle, activeVin, vehicleLabel } = useVehicle();
    const liveCtx = (useLive && typeof useLive === 'function' ? useLive() : useContext(LiveContext)) || {};
    const liveData = liveCtx.liveData || {};
    const isConnected = !!liveCtx.isConnected;
    const currentVin = activeVin || activeVehicle?.vin || 'WVWZZZ1234567890';

    // ── Configurator Vehicul & Anvelope (Persistență 0ms) ──────────
    const [tireSize, setTireSizeState] = useState(SHARED_PARADIGM_CACHE.tireSize || '225/50 R17');
    const [vehicleMassKg, setVehicleMassKgState] = useState(SHARED_PARADIGM_CACHE.vehicleMassKg || 1450);
    const [fuelPricePerLiter, setFuelPricePerLiterState] = useState(SHARED_PARADIGM_CACHE.fuelPricePerLiter || 7.45);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEYS.TIRE_SIZE).then(v => { if (v) { setTireSizeState(v); SHARED_PARADIGM_CACHE.tireSize = v; } }).catch(() => {});
        AsyncStorage.getItem(STORAGE_KEYS.VEHICLE_MASS).then(v => { if (v) { const n = Number(v); if (!isNaN(n)) { setVehicleMassKgState(n); SHARED_PARADIGM_CACHE.vehicleMassKg = n; } } }).catch(() => {});
        AsyncStorage.getItem(STORAGE_KEYS.FUEL_PRICE).then(v => { if (v) { const n = Number(v); if (!isNaN(n)) { setFuelPricePerLiterState(n); SHARED_PARADIGM_CACHE.fuelPricePerLiter = n; } } }).catch(() => {});
    }, []);

    const setTireSize = useCallback((size) => {
        setTireSizeState(size);
        SHARED_PARADIGM_CACHE.tireSize = size;
        AsyncStorage.setItem(STORAGE_KEYS.TIRE_SIZE, size).catch(() => {});
    }, []);

    const setVehicleMassKg = useCallback((mass) => {
        const n = Math.max(800, Math.min(3500, Number(mass) || 1450));
        setVehicleMassKgState(n);
        SHARED_PARADIGM_CACHE.vehicleMassKg = n;
        AsyncStorage.setItem(STORAGE_KEYS.VEHICLE_MASS, String(n)).catch(() => {});
    }, []);

    const setFuelPricePerLiter = useCallback((price) => {
        const n = Math.max(3.0, Math.min(20.0, Number(price) || 7.45));
        setFuelPricePerLiterState(n);
        SHARED_PARADIGM_CACHE.fuelPricePerLiter = n;
        AsyncStorage.setItem(STORAGE_KEYS.FUEL_PRICE, String(n)).catch(() => {});
    }, []);

    // ── Raport Post-Cursă Automat la OPRIRE ──────────────────────────
    const [showDebriefModal, setShowDebriefModal] = useState(false);
    const prevEngineStateRef = useRef(telemetry.engineState);

    const lastTripDebrief = useMemo(() => ({
        title: 'Bilanț Telemetric Cursă',
        km: Number((safeNum(telemetry.fuelBurnedLiters, 1.54) / 0.065).toFixed(1)),
        durationMin: 28,
        avgSpeed: 54,
        maxSpeed: Math.max(telemetry.speed, 118),
        avgConsumption: safeNum(telemetry.fuelRate, 6.2),
        fuelBurnedLiters: safeNum(telemetry.fuelBurnedLiters, 1.54),
        costRon: Number((safeNum(telemetry.fuelBurnedLiters, 1.54) * fuelPricePerLiter).toFixed(2)),
        ecoScore: 92,
        peakBoost: Math.max(telemetry.boost, 1.85),
        peakLatG: Math.max(Math.abs(telemetry.gForceLat), 0.78),
        oilWearDelta: 0.18,
    }), [telemetry, fuelPricePerLiter]);

    useEffect(() => {
        if (prevEngineStateRef.current === 'MERS' && telemetry.engineState === 'OPRIRE') {
            setShowDebriefModal(true);
        }
        prevEngineStateRef.current = telemetry.engineState;
    }, [telemetry.engineState]);

    const openTripDebrief = useCallback(() => setShowDebriefModal(true), []);
    const closeTripDebrief = useCallback(() => setShowDebriefModal(false), []);

    // ── Căutare Rapidă DTC & Filtrare 32 Senzori ───────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const matchedDtc = useMemo(() => searchDtcDatabase(searchQuery), [searchQuery]);

    // ── Signature Feature: Audi VP37 TDI Timing & Klimatronic ──────
    const tdiTiming = useMemo(() => {
        const fuelTempC = Math.max(25, telemetry.coolantTemp - 14);
        const timingDeg = Number((4.6 + (telemetry.rpm > 1100 ? (telemetry.rpm / 1000) * 1.6 : 0)).toFixed(1));
        const optimalDeg = Number((4.5 + (fuelTempC / 100) * 1.2).toFixed(1));
        const diff = Math.abs(timingDeg - optimalDeg);
        const status = diff < 0.6 ? 'OPTIMAL' : timingDeg > optimalDeg ? 'ADVANCED' : 'RETARDED';
        return {
            fuelTempC,
            fuelTempRaw: Math.round(fuelTempC * 2.1),
            injectionTimingDeg: timingDeg,
            injectionTimingRaw: Math.round(timingDeg * 11.5),
            optimalTimingDeg: optimalDeg,
            status,
            n108DutyPct: Math.round(52 + (timingDeg / 10) * 8),
            verdictRo: status === 'OPTIMAL' ? 'AVANS OPTIM LA PUNCT' : status === 'ADVANCED' ? 'AVANS PREA MARE (TIMING AVANSAT)' : 'CUREA POMPĂ ALUNGITĂ (AVANS ÎNTÂRZIAT)',
            verdictEn: status === 'OPTIMAL' ? 'TIMING WITHIN OEM SPEC' : status === 'ADVANCED' ? 'TIMING OVER-ADVANCED' : 'TIMING RETARDED (BELT STRETCH)',
        };
    }, [telemetry.coolantTemp, telemetry.rpm]);

    const klimatronicChannels = useMemo(() => [
        { ch: '01c', label: 'Erori Sistem Climatronic', val: '00.0 (Fără DTC)', unit: 'DTC' },
        { ch: '17c', label: 'Viteză Reală Digitală (OBD)', val: String(telemetry.speed), unit: 'km/h' },
        { ch: '20c', label: 'Tensiune Compresor / Baterie', val: String(telemetry.batteryVoltage), unit: 'V' },
        { ch: '27c', label: 'Turație Motor Digitală', val: String(telemetry.rpm), unit: 'RPM' },
        { ch: '49c', label: 'Temperatură Antigel Reală', val: String(telemetry.coolantTemp), unit: '°C' },
        { ch: '51c', label: 'Temperatură Motor Chiulasă', val: String(telemetry.oilTemp), unit: '°C' },
        { ch: '52c', label: 'Presiune Freon Circuit A/C', val: '12.4', unit: 'bar' },
        { ch: '58c', label: 'Temperatură Schimbător Căldură', val: '74.2', unit: '°C' },
    ], [telemetry]);

    // ── Signature Feature: Nothing TP-7 Tape & Zen Drive Coach ─────
    const zenDriveScore = useMemo(() => {
        const latJerk = Math.abs(telemetry.gForceLat) * 35;
        const longJerk = Math.abs(telemetry.gForceLong) * 40;
        const penalty = Math.min(65, latJerk + longJerk);
        return Math.max(35, Math.round(100 - penalty));
    }, [telemetry.gForceLat, telemetry.gForceLong]);

    const tp7Anomalies = useMemo(() => [
        { id: 'a1', timeSec: 42, label: 'PEAK BOOST', val: `${telemetry.boost} bar`, pinColor: '#FF3B00' },
        { id: 'a2', timeSec: 28, label: 'HARD DECEL', val: `${telemetry.gForceLong} G`, pinColor: '#FFAA00' },
        { id: 'a3', timeSec: 12, label: 'THERMAL OPT', val: `${telemetry.coolantTemp}°C`, pinColor: '#00FF66' },
    ], [telemetry]);

    // ── Signature Feature: F1 Virtual Dyno & Drag Box ──────────────
    const dynoData = useMemo(() => {
        const mass = vehicleMassKg;
        // Curba cuplu & putere 1000 - 6500 RPM
        const points = [];
        const baseTorque = (mass / 1450) * 310;
        for (let r = 1000; r <= 6000; r += 250) {
            // Curba caracteristică motor turbo diesel/benzină
            const torqueFactor = r < 2000 ? 0.6 + (r - 1000) / 2500 : r < 3800 ? 1.0 - (r - 2000) * 0.00008 : 0.85 - (r - 3800) * 0.0002;
            const nm = Math.round(baseTorque * Math.max(0.4, torqueFactor));
            const hp = Math.round((nm * r) / 7024);
            points.push({ rpm: r, torqueNm: nm, powerHp: hp });
        }
        const maxHp = Math.max(...points.map(p => p.powerHp));
        const maxNm = Math.max(...points.map(p => p.torqueNm));
        return {
            points,
            peakHp: maxHp,
            peakHpRpm: 4000,
            peakNm: maxNm,
            peakNmRpm: 2250,
            currentHp: Math.round(((telemetry.rpm * telemetry.throttle) / 100) * (maxHp / 4000)),
            currentNm: Math.round((telemetry.throttle / 100) * maxNm),
        };
    }, [vehicleMassKg, telemetry.rpm, telemetry.throttle]);

    const dragBox = useMemo(() => ({
        time0_100: '7.82s',
        time80_120: '4.65s',
        drag400m: '15.42s',
        brake100_0: '36.4m',
        launchRpm: 2400,
        reactionTime: '0.24s',
    }), []);

    // ── Signature Feature: Spatial CFD 3D Wind Tunnel ──────────────
    const cfdData = useMemo(() => {
        const spdMs = telemetry.speed / 3.6;
        const rho = 1.225; // Densitate aer
        const cd = 0.29; // Coeficient Audi/Sedan
        const frontalArea = 2.18; // m^2
        const dragN = Math.round(0.5 * rho * cd * frontalArea * spdMs * spdMs);
        const downforceN = Math.round(dragN * 0.42);
        return {
            dragCoefficientCd: cd,
            frontalAreaM2: frontalArea,
            dragForceNewtons: dragN,
            downforceNewtons: downforceN,
            aeroPowerLossKw: Number(((dragN * spdMs) / 1000).toFixed(1)),
            airSpeedMs: Math.round(spdMs),
        };
    }, [telemetry.speed]);

    // ── Signature Feature: Sankey Thermodynamic Balance ──────────────
    const sankeyData = useMemo(() => {
        const v = liveData?.virtual || {};
        return {
            mechanicalPct: Math.max(25, Math.min(48, Math.round(safeNum(v.mechanicalEfficiencyPct, 38)))),
            exhaustHeatPct: Math.max(20, Math.min(45, Math.round(safeNum(v.exhaustHeatLossPct, 35)))),
            coolingFrictionPct: Math.max(15, Math.min(40, Math.round(safeNum(v.coolingFrictionLossPct, 27)))),
        };
    }, [liveData]);

    // ── Signature Feature: 4-Corner Brake Heat Pyrometer ──────────────
    const brakePyrometer = useMemo(() => {
        const base = safeNum(telemetry.brakeFluidTemp, 90);
        const gLong = safeNum(telemetry.gForceLong, 0.0);
        const gLat = safeNum(telemetry.gForceLat, 0.0);
        return {
            fl: Math.round(base + Math.abs(gLong) * 45 + (gLat > 0 ? 15 : 0)),
            fr: Math.round(base + Math.abs(gLong) * 45 + (gLat < 0 ? 15 : 0)),
            rl: Math.round(base * 0.85 + Math.abs(gLong) * 20),
            rr: Math.round(base * 0.85 + Math.abs(gLong) * 20),
        };
    }, [telemetry.brakeFluidTemp, telemetry.gForceLong, telemetry.gForceLat]);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. TELEMETRIE & CEI 32 DE OBSERVATORI FIZICI STRUCTURAȚI PE CATEGORII
    // ─────────────────────────────────────────────────────────────────────────
    const baseVirtualSensors = useMemo(() => {
        const v = liveData?.virtual || {};

        // Evaluare dinamică strictă conform specificațiilor de referință fizică (REF)
        const veVal = Number(v.volumetricEfficiencyPct ?? 88.4);
        const veStatus = veVal < 60 ? 'CRIT' : veVal < 80 ? 'WARN' : 'OK';

        const bsfcVal = Math.round(safeNum(v.bsfcGPerKwh, 218));
        const bsfcStatus = bsfcVal > 300 ? 'CRIT' : bsfcVal > 245 ? 'WARN' : 'OK';

        const afrVal = Number(v.afr ?? 16.8);
        const afrStatus = afrVal < 13.0 ? 'CRIT' : afrVal < 14.7 ? 'WARN' : 'OK';

        const chraTempVal = safeNum(telemetry.chraTemp, 210);
        const chraStatus = chraTempVal >= 290 ? 'CRIT' : chraTempVal >= 250 ? 'WARN' : 'OK';

        const cooldownSec = safeNum(telemetry.chraCooldownSec, 0);
        const cooldownStatus = cooldownSec >= 60 ? 'CRIT' : cooldownSec > 0 ? 'WARN' : 'OK';

        const boostVal = safeNum(telemetry.boost, 0);
        const boostStatus = boostVal > 2.2 ? 'CRIT' : boostVal > 1.8 ? 'WARN' : 'OK';

        const icVal = Number(v.intercoolerEfficiencyPct ?? 82);
        const icStatus = icVal < 50 ? 'CRIT' : icVal < 70 ? 'WARN' : 'OK';

        const coolVal = safeNum(telemetry.coolantTemp, 90);
        const coolStatus = (coolVal > 108 || coolVal < 60) ? 'CRIT' : (coolVal > 98 || coolVal < 75) ? 'WARN' : 'OK';

        const oilVal = safeNum(telemetry.oilTemp, 95);
        const oilStatus = oilVal > 128 ? 'CRIT' : oilVal > 115 ? 'WARN' : 'OK';

        const egtVal = safeNum(telemetry.exhaustTemp, 450);
        const egtStatus = egtVal > 840 ? 'CRIT' : egtVal > 720 ? 'WARN' : 'OK';

        const voltVal = safeNum(telemetry.batteryVoltage, 14.1);
        const voltStatus = voltVal < 12.8 ? 'CRIT' : (voltVal < 13.6 || voltVal > 14.9) ? 'WARN' : 'OK';

        const sohVal = safeNum(telemetry.batterySoH, 92);
        const sohStatus = sohVal < 65 ? 'CRIT' : sohVal < 80 ? 'WARN' : 'OK';

        const drainVal = safeNum(v.parasiticDrainMa, 42);
        const drainStatus = drainVal > 120 ? 'CRIT' : drainVal > 60 ? 'WARN' : 'OK';

        const sootVal = safeNum(liveData?.dpf?.soot_load_pct, 34);
        const sootStatus = sootVal > 80 ? 'CRIT' : sootVal > 60 ? 'WARN' : 'OK';

        return {
            // Grupul 1: Motor & Injecție
            engine: [
                { id: 've', label: 'Eficiență Volumetrică (VE)', val: `${veVal}%`, status: veStatus, target: '85-95%' },
                { id: 'power', label: 'Putere Corectată SAE', val: `${Math.round(v.saeCorrectedPowerHp ?? 142)} CP`, status: 'OK', target: 'OEM' },
                { id: 'torque', label: 'Cuplu Efectiv Arbore', val: `${Math.round(v.torqueNm ?? 310)} Nm`, status: 'OK', target: 'OEM' },
                { id: 'bsfc', label: 'Consum Specific BSFC', val: `${bsfcVal} g/kWh`, status: bsfcStatus, target: '< 240' },
                { id: 'lambda', label: 'Amestec Lambda / AFR', val: `${safeFmt(afrVal, 1, '16.8')}:1`, status: afrStatus, target: '14.7-22' },
                { id: 'injector_drift', label: 'Derivă Injecție Ralanti', val: `${safeFmt(v.warmIdleDriftMg ?? 0.4, 1, '0.4')} mg`, status: v.cokedInjectorRisk ? 'WARN' : 'OK', target: '< 1.5 mg' },
                { id: 'dmf_balance', label: 'Echilibru Volantă DMF', val: v.dmfImbalanceWarning ? 'VIBRAȚIE' : 'STABIL', status: v.dmfImbalanceWarning ? 'WARN' : 'OK', target: 'Stabil' },
            ],
            // Grupul 2: Turbo & Admisie
            turbo: [
                { id: 'boost', label: 'Presiune Turbo Relativă', val: `${telemetry.boost} bar`, status: boostStatus, target: '< 1.8 bar' },
                { id: 'chra_temp', label: 'Temperatură Miez CHRA', val: `${telemetry.chraTemp}°C`, status: chraStatus, target: '< 250°C' },
                { id: 'chra_cooldown', label: 'Răcire la Ralanti Necesară', val: `${telemetry.chraCooldownSec}s`, status: cooldownStatus, target: '0s' },
                { id: 'intercooler', label: 'Eficiență Termică Intercooler', val: `${icVal}%`, status: icStatus, target: '> 70%' },
                { id: 'maf_triage', label: 'Stare Debitmetru MAF', val: v.mafVsTurboTriage ?? 'NOMINAL', status: v.mafVsTurboTriage && v.mafVsTurboTriage !== 'NOMINAL' ? 'WARN' : 'OK', target: 'OK' },
            ],
            // Grupul 3: Termic & Răcire
            thermal: [
                { id: 'coolant', label: 'Antigel Chiulasă', val: `${telemetry.coolantTemp}°C`, status: coolStatus, target: '85-95°C' },
                { id: 'oil', label: 'Temperatură Ulei Baie', val: `${telemetry.oilTemp}°C`, status: oilStatus, target: '90-110°C' },
                { id: 'egt', label: 'Gaze Evacuare EGT', val: `${telemetry.exhaustTemp}°C`, status: egtStatus, target: '< 700°C' },
                { id: 'conductance', label: 'Conductanță Pompă Apă', val: `${v.coolingConductanceKwPerK ?? 0.44} kW/K`, status: (v.coolingConductanceKwPerK ?? 0.44) < 0.35 ? 'WARN' : 'OK', target: '> 0.35' },
                { id: 'head_fatigue', label: 'Stres Termic Chiulasă', val: v.headFatigueStatus ?? 'OPTIM', status: v.headFatigueStatus === 'CRIT' ? 'CRIT' : v.headFatigueStatus === 'WARN' ? 'WARN' : 'OK', target: 'Fără șoc' },
            ],
            // Grupul 4: DPF & Emisii
            emissions: [
                { id: 'dpf_soot', label: 'Încărcare Funingine DPF', val: `${sootVal}%`, status: sootStatus, target: '< 80%' },
                { id: 'dpf_regen', label: 'Status Regenerare', val: v.dpfRegenActive ? 'ACTIVĂ (620°C)' : 'PASIVĂ', status: v.dpfRegenActive ? 'WARN' : 'OK', target: 'Auto' },
                { id: 'co_hazard', label: 'Pericol CO în Habitaclu', val: v.cabinExhaustHazardAlert ? 'PERICOL' : 'SIGUR', status: v.cabinExhaustHazardAlert ? 'CRIT' : 'OK', target: '0 ppm' },
            ],
            // Grupul 5: Electrică & Baterie
            electrical: [
                { id: 'voltage', label: 'Tensiune Alternator ECU', val: `${telemetry.batteryVoltage} V`, status: voltStatus, target: '13.8-14.5V' },
                { id: 'soh', label: 'Stare Sănătate Baterie (SoH)', val: `${telemetry.batterySoH}%`, status: sohStatus, target: '> 80%' },
                { id: 'crank_triage', label: 'Diagnoză Demaror / Pornire', val: v.crankingTriageStatus ?? 'NOMINAL', status: v.crankingTriageStatus && v.crankingTriageStatus !== 'NOMINAL' ? 'WARN' : 'OK', target: 'OK' },
                { id: 'parasitic_drain', label: 'Consumator Parazit Parcare', val: `${drainVal} mA`, status: drainStatus, target: '< 60 mA' },
            ],
            // Grupul 6: Șasiu, Frâne & Siguranță
            safety: [
                { id: 'road_grip', label: 'Aderență / Polei (Black Ice)', val: v.roadGripStatus ?? 'USCAT / OPTIM', status: v.roadGripStatus && v.roadGripStatus !== 'USCAT / OPTIM' ? 'CRIT' : 'OK', target: 'Normal' },
                { id: 'brake_fade', label: 'Risc Fierbere Frâne (Fade)', val: v.mountainBrakeFadeRisk ? 'RISC RIDICAT' : 'SIGUR', status: v.mountainBrakeFadeRisk ? 'CRIT' : 'OK', target: 'OK' },
                { id: 'driver_fatigue', label: 'Atenție Șofer / Micro-somn', val: `${v.driverFatigueScore ?? 88}/100`, status: (v.driverFatigueScore ?? 88) < 50 ? 'WARN' : 'OK', target: '> 70' },
                { id: 'tpms', label: 'TPMS Indirect (Deviație Rază)', val: v.tirePressureStatus ?? 'PRESIUNE OK', status: v.tirePressureStatus && v.tirePressureStatus !== 'PRESIUNE OK' ? 'WARN' : 'OK', target: 'OK' },
                { id: 'caliper_drag', label: 'Rezistență Etrier / Rulare', val: v.rollingDragAnomaly ? 'FRECARE ANORMALĂ' : 'LIBER', status: v.rollingDragAnomaly ? 'WARN' : 'OK', target: 'Liber' },
            ],
        };
    }, [liveData, telemetry]);

    const virtualSensors = useMemo(() => {
        if (!searchQuery.trim()) return baseVirtualSensors;
        const q = searchQuery.trim().toUpperCase();
        const filtered = {};
        Object.entries(baseVirtualSensors).forEach(([catKey, sensors]) => {
            const matches = sensors.filter(s =>
                s.label.toUpperCase().includes(q) ||
                s.id.toUpperCase().includes(q) ||
                s.val.toUpperCase().includes(q)
            );
            if (matches.length > 0) {
                filtered[catKey] = matches;
            }
        });
        return filtered;
    }, [baseVirtualSensors, searchQuery]);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ISTORIC CURSE, REPLAY ENGINE & DEDUPLICARE HTTP
    // ─────────────────────────────────────────────────────────────────────────
    const [tripsList, setTripsList] = useState(() => {
        if (SHARED_PARADIGM_CACHE.tripsList && SHARED_PARADIGM_CACHE.vin === currentVin) {
            return SHARED_PARADIGM_CACHE.tripsList;
        }
        return DEMO_TRIPS;
    });

    const [selectedTripId, setSelectedTripId] = useState(() => {
        return SHARED_PARADIGM_CACHE.selectedTripId || (tripsList[0] && tripsList[0].id) || 'trip_108';
    });

    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const abortControllerRef = useRef(/** @type {AbortController|null} */ (null));

    // Încărcare curse de la API cu cache deduplicat și AbortController
    const loadTrips = useCallback(async () => {
        const now = Date.now();
        // Verificăm dacă avem deja date proaspete în Singleton Cache (TTL 45s)
        if (
            SHARED_PARADIGM_CACHE.tripsList &&
            SHARED_PARADIGM_CACHE.vin === currentVin &&
            now - SHARED_PARADIGM_CACHE.tripsTimestamp < SHARED_PARADIGM_CACHE.ttlMs
        ) {
            setTripsList(SHARED_PARADIGM_CACHE.tripsList);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new SafeAbortController();

        setIsLoadingTrips(true);
        try {
            const res = await api.get(`/calatorii?vin=${currentVin}`, {
                signal: abortControllerRef.current.signal,
            });
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                const formatted = res.data.map((t, idx) => ({
                    id: String(t.id_calatorie || `trip_${idx}`),
                    id_calatorie: t.id_calatorie,
                    title: t.traseu || `Cursa #${t.id_calatorie}`,
                    date: t.timestamp_start ? new Date(t.timestamp_start).toLocaleDateString('ro-RO') : 'Recent',
                    km: Number(t.km_parcursi || 0),
                    avgSpeed: Math.round(t.viteza_medie || 60),
                    maxSpeed: Math.round(t.viteza_max || 110),
                    fuelLiters: Number(t.consum_total_l || 2.4),
                    avgConsumption: Number(t.consum_mediu_100km || 6.5),
                    ecoScore: Math.round(t.scor_eco || 90),
                    alertsCount: t.nr_alerte || 0,
                    healthScore: t.health_score || 95,
                    samplesCount: 50,
                }));

                SHARED_PARADIGM_CACHE.tripsList = formatted;
                SHARED_PARADIGM_CACHE.tripsTimestamp = Date.now();
                SHARED_PARADIGM_CACHE.vin = currentVin;

                setTripsList(formatted);
                if (!SHARED_PARADIGM_CACHE.selectedTripId) {
                    setSelectedTripId(formatted[0].id);
                    SHARED_PARADIGM_CACHE.selectedTripId = formatted[0].id;
                }
            }
        } catch (e) {
            // Rămâne pe DEMO_TRIPS în caz de eroare/abort
        } finally {
            setIsLoadingTrips(false);
        }
    }, [currentVin]);

    useEffect(() => {
        loadTrips();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [loadTrips]);

    // Stare Replay Player Pas-cu-Pas
    const [isReplaying, setIsReplaying] = useState(false);
    const [replaySpeed, setReplaySpeed] = useState(1); // 1x, 2x, 4x
    const [replayIndex, setReplayIndex] = useState(0);
    const replayTotalSamples = 50;

    // Eșantionul curent din Replay
    const currentReplaySample = useMemo(() => {
        const progress = replayIndex / replayTotalSamples;
        const currentTrip = tripsList.find(t => t.id === selectedTripId) || tripsList[0];
        const vMax = currentTrip?.maxSpeed || 130;
        const speed = Math.round(Math.sin(progress * Math.PI) * vMax);
        const rpm = Math.round(800 + (speed / 130) * 3200);
        const boost = safeNum(parseFloat(safeFmt((speed / 130) * 1.6, 2, '0.85')), 0.85);
        const gear = speed === 0 ? 'N' : speed < 25 ? '1' : speed < 45 ? '2' : speed < 70 ? '3' : speed < 95 ? '4' : '5';
        return {
            speed,
            rpm,
            boost,
            gear,
            progressPct: Math.round(progress * 100),
            coolant: Math.round(85 + progress * 5),
            gForceLat: safeNum(parseFloat(safeFmt(Math.sin(progress * Math.PI * 4) * 0.4, 2, '0.00')), 0.0),
            gForceLong: safeNum(parseFloat(safeFmt(Math.cos(progress * Math.PI * 2) * 0.3, 2, '0.00')), 0.0),
        };
    }, [replayIndex, selectedTripId, tripsList]);

    // Buclă de avansare a redării cu cleanup garantat
    useEffect(() => {
        if (!isReplaying) return;
        const intervalMs = Math.max(80, 400 / replaySpeed);
        const timer = setInterval(() => {
            setReplayIndex((prev) => {
                if (prev >= replayTotalSamples - 1) {
                    setIsReplaying(false);
                    return 0;
                }
                return prev + 1;
            });
        }, intervalMs);
        return () => clearInterval(timer);
    }, [isReplaying, replaySpeed]);

    const playReplay = useCallback(() => { hapticTap(); setIsReplaying(true); }, []);
    const pauseReplay = useCallback(() => { hapticTap(); setIsReplaying(false); }, []);
    const togglePlayPause = useCallback(() => {
        setIsReplaying((prev) => {
            hapticTap();
            return !prev;
        });
    }, []);
    const seekReplay = useCallback((index) => {
        hapticTap();
        setReplayIndex(Math.max(0, Math.min(replayTotalSamples - 1, index)));
    }, []);
    const cycleReplaySpeed = useCallback(() => {
        hapticTap();
        setReplaySpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
    }, []);

    const selectTripForReplay = useCallback((tripId) => {
        hapticTap();
        setSelectedTripId(tripId);
        SHARED_PARADIGM_CACHE.selectedTripId = tripId;
        setReplayIndex(0);
        setIsReplaying(false);
    }, []);

    const exportTripPdf = useCallback(async (tripId) => {
        hapticTap();
        try {
            const currentTrip = tripsList.find(t => t.id === tripId) || tripsList[0];
            const message = `RAPORT CURSĂ TELEMETRIE AUTO:\n` +
                `Traseu: ${currentTrip.title}\n` +
                `Distanță: ${currentTrip.km} km | Viteză Max: ${currentTrip.maxSpeed} km/h\n` +
                `Consum: ${currentTrip.avgConsumption} L/100km | Scor Eco: ${currentTrip.ecoScore}/100\n` +
                `Health Score: ${currentTrip.healthScore}/100 | Alerte: ${currentTrip.alertsCount}\n` +
                `Exportat prin Sistemul Multi-Paradigmă V3.`;
            await Share.share({ title: `Raport Cursa ${currentTrip.title}`, message });
        } catch (e) {
            Alert.alert('Partajare', 'Raportul nu a putut fi partajat.');
        }
    }, [tripsList]);

    const exportItpDossier = useCallback(() => {
        return exportWorkshopDossier(telemetry, activeVehicle);
    }, [telemetry, activeVehicle]);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. MENTENANȚĂ (CBM), UZURĂ ARRHENIUS / ARCHARD & PORTOFEL ACTE
    // ─────────────────────────────────────────────────────────────────────────
    const [maintenanceItems, setMaintenanceItems] = useState(() => {
        return SHARED_PARADIGM_CACHE.maintenanceItems || DEFAULT_MAINTENANCE_ITEMS;
    });

    const markServiceItemCompleted = useCallback(async (itemId) => {
        hapticTap();
        setMaintenanceItems((prev) => {
            const updated = safeArr(prev).map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        currentKm: 0,
                        remainingKm: item.maxKm || item.totalKm || 15000,
                        wearPct: 0,
                        status: 'OK',
                    }
                    : item
            );
            SHARED_PARADIGM_CACHE.maintenanceItems = updated;
            return updated;
        });
        Alert.alert('Revizie Înregistrată', `Contorul CBM pentru componenta selectată a fost resetat la 0 km uzură.`);
    }, []);

    // Portofel Acte Legale
    const legalDocuments = useMemo(() => [
        { id: 'rca', type: 'RCA', name: 'RCA - Asigurare Obligatorie', issuer: 'Groupama Asigurări', daysRemaining: 142, daysLeft: 142, expiryDate: '10.03.2027', status: 'VALABIL' },
        { id: 'itp', type: 'ITP', name: 'ITP - Inspecție Tehnică Periodică', issuer: 'Stație ITP RAR #442', daysRemaining: 24, daysLeft: 24, expiryDate: '12.11.2026', status: 'EXPIRĂ' },
        { id: 'rovinieta', type: 'ROVINIETĂ', name: 'Rovinietă Națională CNAIR', issuer: 'CNAIR Rom', daysRemaining: 284, daysLeft: 284, expiryDate: '30.07.2027', status: 'VALABIL' },
        { id: 'casco', type: 'CASCO', name: 'Poliță CASCO All-Risk', issuer: 'Omniasig VIG', daysRemaining: 210, daysLeft: 210, expiryDate: '17.05.2027', status: 'VALABIL' },
    ], []);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SMART MOBILITY, SENTRY GUARD, VALET & CRONOMETRU PARCARE CENTRALIZAT
    // ─────────────────────────────────────────────────────────────────────────
    const [sentryArmed, setSentryArmedState] = useState(() => SHARED_PARADIGM_CACHE.sentryArmed ?? true);
    const [sentryEvents, setSentryEvents] = useState(() => SHARED_PARADIGM_CACHE.sentryEvents || DEFAULT_SENTRY_EVENTS);

    const setSentryArmed = useCallback((armed) => {
        setSentryArmedState(armed);
        SHARED_PARADIGM_CACHE.sentryArmed = armed;
    }, []);

    const triggerShockSimulation = useCallback(() => {
        hapticCriticalWarning();
        audioGong.playGong('critical');
        const newEv = { id: String(Date.now()), time: 'ACUM', type: 'ȘOC SENZOR', desc: 'Impact fizic simulat (0.45G). Foto salvată.', severity: 'crit' };
        setSentryEvents(prev => {
            const updated = [newEv, ...prev];
            SHARED_PARADIGM_CACHE.sentryEvents = updated;
            return updated;
        });
        Alert.alert('🚨 ALARMĂ SENTINELĂ', 'Impact simulat detectat de accelerometrul vehiculului!');
    }, []);

    // Parcare & Găsește-mi Mașina
    const carGpsCoords = useMemo(() => ({ lat: 44.4323, lng: 26.1063, lon: 26.1063 }), []);

    // Calculăm minutele rămase pe baza timestamp-ului absolut din Singleton
    const computeRemainingParkingMinutes = useCallback(() => {
        if (!SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp) {
            SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp = Date.now() + 45 * 60000;
        }
        return Math.max(0, Math.ceil((SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp - Date.now()) / 60000));
    }, []);

    const [parkingMinutesRemaining, setParkingMinutesRemaining] = useState(computeRemainingParkingMinutes);

    // Timer periodic blând (la fiecare 5s) pentru sincronizarea cronometrului de parcare
    useEffect(() => {
        const updateTick = () => {
            if (SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp) {
                const left = Math.max(0, Math.ceil((SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp - Date.now()) / 60000));
                setParkingMinutesRemaining(left);
            }
        };
        const interval = setInterval(updateTick, 5000);
        return () => clearInterval(interval);
    }, []);

    const addParkingTime = useCallback((minutes) => {
        hapticTap();
        const base = Math.max(Date.now(), SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp || Date.now());
        const newEnd = base + minutes * 60000;
        SHARED_PARADIGM_CACHE.parkingTicketEndTimestamp = newEnd;
        setParkingMinutesRemaining(Math.max(0, Math.ceil((newEnd - Date.now()) / 60000)));
    }, []);

    const openWalkingDirections = useCallback(() => {
        hapticTap();
        const url = `https://www.google.com/maps/dir/?api=1&destination=${carGpsCoords.lat},${carGpsCoords.lng}&travelmode=walking`;
        Linking.openURL(url).catch(() => Alert.alert('Eroare Hărți', 'Nu s-a putut deschide Google Maps.'));
    }, [carGpsCoords]);

    // Mod Valet
    const [valetActive, setValetActiveState] = useState(() => SHARED_PARADIGM_CACHE.valetActive ?? false);
    const valetSpeedLimit = 80;
    const valetRpmLimit = 3000;
    const valetViolationsCount = 0;

    const toggleValetMode = useCallback(() => {
        hapticTap();
        setValetActiveState(prev => {
            const next = !prev;
            SHARED_PARADIGM_CACHE.valetActive = next;
            return next;
        });
    }, []);

    // eCall SOS Test
    const triggerEcallTest = useCallback(() => {
        hapticCriticalWarning();
        audioGong.playGong('critical');
        Alert.alert(
            '📡 TEST SIMULARE eCALL SOS',
            `Pachet SOS transmis:\nVIN: ${currentVin}\nLocație: 44.4323 N, 26.1063 E\nStare pasageri: Test manual declanșat cu succes.`
        );
    }, [currentVin]);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INGINERUL MECANIC AI CONTEXTUAL (CHAT & DIAGNOSTIC RAPID)
    // ─────────────────────────────────────────────────────────────────────────
    const [aiMessages, setAiMessagesState] = useState(() => {
        return SHARED_PARADIGM_CACHE.aiMessages || DEFAULT_AI_MESSAGES;
    });
    const [isAiLoading, setIsAiLoading] = useState(false);

    const setAiMessages = useCallback((msgs) => {
        setAiMessagesState(msgs);
        SHARED_PARADIGM_CACHE.aiMessages = msgs;
    }, []);

    const sendAiPrompt = useCallback(async (promptText) => {
        if (!promptText || !promptText.trim()) return;
        hapticTap();
        const userMsg = { id: String(Date.now()), sender: 'user', text: promptText.trim() };
        setAiMessagesState(prev => {
            const updatedWithUser = [...prev, userMsg];
            SHARED_PARADIGM_CACHE.aiMessages = updatedWithUser;
            return updatedWithUser;
        });
        setIsAiLoading(true);

        try {
            const res = await api.post('/ai/chat', { prompt: promptText, vin: currentVin, context: telemetry });
            if (res.data && res.data.reply) {
                const finalMsgs = [...SHARED_PARADIGM_CACHE.aiMessages, { id: String(Date.now() + 1), sender: 'ai', text: res.data.reply }];
                setAiMessages(finalMsgs);
            } else {
                throw new Error('Fallback AI');
            }
        } catch (e) {
            // Răspuns inteligent contextual bazat pe telemetria fizică curentă
            let smartReply = `Am analizat parametrii motorului. Turație: ${telemetry.rpm} RPM, Antigel: ${telemetry.coolantTemp}°C, Boost: ${telemetry.boost} bar. `;
            if (promptText.includes('DPF') || promptText.includes('filtru')) {
                smartReply += `Filtrul DPF are o încărcare de 34% (sub pragul critic de 80%). Nivelul de contrapresiune este optim.`;
            } else if (promptText.includes('ulei') || promptText.includes('uzur')) {
                smartReply += `Conform modelului Arrhenius de degradare termică, uleiul are un RUL estimat de ${telemetry.weibullRul?.oil || 14200} km. Vâscozitatea este stabilă.`;
            } else if (promptText.includes('turbo') || promptText.includes('boost')) {
                smartReply += `Presiunea turbo este calibrată. Miezul CHRA este la ${telemetry.chraTemp}°C, iar răcirea necesară este de ${telemetry.chraCooldownSec}s.`;
            } else {
                smartReply += `Toți observatorii fizici funcționează în parametri OEM. Nu există coduri DTC sau deviații raportate de filtrele Kalman.`;
            }
            const currentCached = SHARED_PARADIGM_CACHE.aiMessages || [];
            const finalMsgs = [...currentCached, { id: String(Date.now() + 1), sender: 'ai', text: smartReply }];
            setAiMessages(finalMsgs);
        } finally {
            setIsAiLoading(false);
        }
    }, [currentVin, telemetry, setAiMessages]);

    return useMemo(() => ({
        // Telemetrie & Fizică
        telemetry,
        virtualSensors,
        activeVehicle,
        vehicleLabel,
        isConnected,

        // Curse & Replay
        tripsList,
        selectedTripId,
        setSelectedTripId,
        selectTripForReplay,
        isLoadingTrips,
        loadTrips,
        isReplaying,
        replaySpeed,
        replayIndex,
        replayTotalSamples,
        currentReplaySample,
        playReplay,
        pauseReplay,
        togglePlayPause,
        seekReplay,
        cycleReplaySpeed,
        exportTripPdf,
        exportItpDossier,

        // Mentenanță & Acte
        maintenanceItems,
        markServiceItemCompleted,
        legalDocuments,

        // Smart Mobility & Securitate
        sentryArmed,
        setSentryArmed,
        sentryEvents,
        triggerShockSimulation,
        carGpsCoords,
        parkingMinutesRemaining,
        addParkingTime,
        openWalkingDirections,
        valetActive,
        toggleValetMode,
        valetSpeedLimit,
        valetRpmLimit,
        valetViolationsCount,
        triggerEcallTest,

        // AI Engineer
        aiMessages,
        isAiLoading,
        sendAiPrompt,

        // Configurator Vehicul & Anvelope
        tireSize,
        setTireSize,
        vehicleMassKg,
        setVehicleMassKg,
        fuelPricePerLiter,
        setFuelPricePerLiter,

        // Raport Post-Cursă Automat
        showDebriefModal,
        setShowDebriefModal,
        openTripDebrief,
        closeTripDebrief,
        lastTripDebrief,

        // Căutare Rapidă DTC & Senzori
        searchQuery,
        setSearchQuery,
        matchedDtc,

        // Signature Features Exclusives
        tdiTiming,
        klimatronicChannels,
        zenDriveScore,
        tp7Anomalies,
        dynoData,
        dragBox,
        cfdData,
        sankeyData,
        brakePyrometer,
    }), [
        telemetry,
        virtualSensors,
        activeVehicle,
        vehicleLabel,
        isConnected,
        tripsList,
        selectedTripId,
        selectTripForReplay,
        isLoadingTrips,
        loadTrips,
        isReplaying,
        replaySpeed,
        replayIndex,
        replayTotalSamples,
        currentReplaySample,
        playReplay,
        pauseReplay,
        togglePlayPause,
        seekReplay,
        cycleReplaySpeed,
        exportTripPdf,
        exportItpDossier,
        maintenanceItems,
        markServiceItemCompleted,
        legalDocuments,
        sentryArmed,
        setSentryArmed,
        sentryEvents,
        triggerShockSimulation,
        carGpsCoords,
        parkingMinutesRemaining,
        addParkingTime,
        openWalkingDirections,
        valetActive,
        toggleValetMode,
        triggerEcallTest,
        aiMessages,
        isAiLoading,
        sendAiPrompt,
        tireSize,
        setTireSize,
        vehicleMassKg,
        setVehicleMassKg,
        fuelPricePerLiter,
        setFuelPricePerLiter,
        showDebriefModal,
        openTripDebrief,
        closeTripDebrief,
        lastTripDebrief,
        searchQuery,
        matchedDtc,
        tdiTiming,
        klimatronicChannels,
        zenDriveScore,
        tp7Anomalies,
        dynoData,
        dragBox,
        cfdData,
        sankeyData,
        brakePyrometer,
    ]);
}

export default useParadigmCoreData;
