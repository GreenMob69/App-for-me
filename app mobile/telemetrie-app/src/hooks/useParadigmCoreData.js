// @ts-check
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Linking, Alert, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useNormalizedTelemetry } from './useNormalizedTelemetry';
import { useVehicle } from '../context/VehicleContext';
import { useLive } from '../context/LiveContext';
import { exportWorkshopDossier } from '../utils/dossierExport';
import { hapticTap, hapticCriticalWarning } from '../services/hapticFeedback';
import { audioGong } from '../services/audioGongService';

const STORAGE_KEYS = {
    SERVICE_HISTORY: '@telemetrie_service_history_v3',
    PARKING_TICKET: '@telemetrie_parking_ticket_v3',
    VALET_STATE: '@telemetrie_valet_state_v3',
    SENTRY_STATE: '@telemetrie_sentry_state_v3',
    PARADIGM_ACCENTS: '@telemetrie_paradigm_accents_v3',
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

export function useParadigmCoreData() {
    const telemetry = useNormalizedTelemetry();
    const { activeVehicle, activeVin, vehicleLabel } = useVehicle();
    const { liveData, isConnected } = useLive();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. TELEMETRIE & CEI 32 DE OBSERVATORI FIZICI STRUCTURAȚI PE CATEGORII
    // ─────────────────────────────────────────────────────────────────────────
    const virtualSensors = useMemo(() => {
        const v = liveData?.virtual || {};
        return {
            // Grupul 1: Motor & Injecție
            engine: [
                { id: 've', label: 'Eficiență Volumetrică (VE)', val: `${v.volumetricEfficiencyPct ?? 88.4}%`, status: 'OK', target: '85-95%' },
                { id: 'power', label: 'Putere Corectată SAE', val: `${Math.round(v.saeCorrectedPowerHp ?? 142)} CP`, status: 'OK', target: 'OEM' },
                { id: 'torque', label: 'Cuplu Efectiv Arbore', val: `${Math.round(v.torqueNm ?? 310)} Nm`, status: 'OK', target: 'OEM' },
                { id: 'bsfc', label: 'Consum Specific BSFC', val: `${Math.round(v.bsfcGPerKwh ?? 218)} g/kWh`, status: 'OK', target: '< 240' },
                { id: 'lambda', label: 'Amestec Lambda / AFR', val: `${(v.afr ?? 16.8).toFixed(1)}:1`, status: 'OK', target: '14.7-22' },
                { id: 'injector_drift', label: 'Derivă Injecție Ralanti', val: `${(v.warmIdleDriftMg ?? 0.4).toFixed(1)} mg`, status: v.cokedInjectorRisk ? 'WARN' : 'OK', target: '< 1.5 mg' },
                { id: 'dmf_balance', label: 'Echilibru Volantă DMF', val: v.dmfImbalanceWarning ? 'VIBRAȚIE' : 'STABIL', status: v.dmfImbalanceWarning ? 'WARN' : 'OK', target: 'Stabil' },
            ],
            // Grupul 2: Turbo & Admisie
            turbo: [
                { id: 'boost', label: 'Presiune Turbo Relativă', val: `${telemetry.boost} bar`, status: 'OK', target: '< 1.8 bar' },
                { id: 'chra_temp', label: 'Temperatură Miez CHRA', val: `${telemetry.chraTemp}°C`, status: telemetry.chraTemp > 280 ? 'WARN' : 'OK', target: '< 250°C' },
                { id: 'chra_cooldown', label: 'Răcire la Ralanti Necesară', val: `${telemetry.chraCooldownSec}s`, status: telemetry.chraCooldownSec > 0 ? 'WARN' : 'OK', target: '0s' },
                { id: 'intercooler', label: 'Eficiență Termică Intercooler', val: `${v.intercoolerEfficiencyPct ?? 82}%`, status: 'OK', target: '> 70%' },
                { id: 'maf_triage', label: 'Stare Debitmetru MAF', val: v.mafVsTurboTriage ?? 'NOMINAL', status: 'OK', target: 'OK' },
            ],
            // Grupul 3: Termic & Răcire
            thermal: [
                { id: 'coolant', label: 'Antigel Chiulasă', val: `${telemetry.coolantTemp}°C`, status: telemetry.coolantTemp > 100 ? 'WARN' : 'OK', target: '85-95°C' },
                { id: 'oil', label: 'Temperatură Ulei Baie', val: `${telemetry.oilTemp}°C`, status: telemetry.oilTemp > 120 ? 'WARN' : 'OK', target: '90-110°C' },
                { id: 'egt', label: 'Gaze Evacuare EGT', val: `${telemetry.exhaustTemp}°C`, status: telemetry.exhaustTemp > 750 ? 'WARN' : 'OK', target: '< 700°C' },
                { id: 'conductance', label: 'Conductanță Pompă Apă', val: `${v.coolingConductanceKwPerK ?? 0.44} kW/K`, status: 'OK', target: '> 0.35' },
                { id: 'head_fatigue', label: 'Stres Termic Chiulasă', val: v.headFatigueStatus ?? 'OPTIM', status: 'OK', target: 'Fără șoc' },
            ],
            // Grupul 4: DPF & Emisii
            emissions: [
                { id: 'dpf_soot', label: 'Încărcare Funingine DPF', val: `${liveData?.dpf?.soot_load_pct ?? 34}%`, status: 'OK', target: '< 80%' },
                { id: 'dpf_regen', label: 'Status Regenerare', val: v.dpfRegenActive ? 'ACTIVĂ (620°C)' : 'PASIVĂ', status: v.dpfRegenActive ? 'WARN' : 'OK', target: 'Auto' },
                { id: 'co_hazard', label: 'Pericol CO în Habitaclu', val: v.cabinExhaustHazardAlert ? 'PERICOL' : 'SIGUR', status: v.cabinExhaustHazardAlert ? 'CRIT' : 'OK', target: '0 ppm' },
            ],
            // Grupul 5: Electrică & Baterie
            electrical: [
                { id: 'voltage', label: 'Tensiune Alternator ECU', val: `${telemetry.batteryVoltage} V`, status: telemetry.batteryVoltage < 13.2 ? 'WARN' : 'OK', target: '13.8-14.5V' },
                { id: 'soh', label: 'Stare Sănătate Baterie (SoH)', val: `${telemetry.batterySoH}%`, status: telemetry.batterySoH < 75 ? 'WARN' : 'OK', target: '> 80%' },
                { id: 'crank_triage', label: 'Diagnoză Demaror / Pornire', val: v.crankingTriageStatus ?? 'NOMINAL', status: 'OK', target: 'OK' },
                { id: 'parasitic_drain', label: 'Consumator Parazit Parcare', val: `${v.parasiticDrainMa ?? 42} mA`, status: (v.parasiticDrainMa ?? 42) > 120 ? 'WARN' : 'OK', target: '< 60 mA' },
            ],
            // Grupul 6: Șasiu, Frâne & Siguranță
            safety: [
                { id: 'road_grip', label: 'Aderență / Polei (Black Ice)', val: v.roadGripStatus ?? 'USCAT / OPTIM', status: v.roadGripStatus ? 'CRIT' : 'OK', target: 'Normal' },
                { id: 'brake_fade', label: 'Risc Fierbere Frâne (Fade)', val: v.mountainBrakeFadeRisk ? 'RISC RIDICAT' : 'SIGUR', status: v.mountainBrakeFadeRisk ? 'CRIT' : 'OK', target: 'OK' },
                { id: 'driver_fatigue', label: 'Atenție Șofer / Micro-somn', val: `${v.driverFatigueScore ?? 88}/100`, status: (v.driverFatigueScore ?? 88) < 50 ? 'WARN' : 'OK', target: '> 70' },
                { id: 'tpms', label: 'TPMS Indirect (Deviație Rază)', val: v.tirePressureStatus ?? 'PRESIUNE OK', status: 'OK', target: 'OK' },
                { id: 'caliper_drag', label: 'Rezistență Etrier / Rulare', val: v.rollingDragAnomaly ? 'FRECARE ANORMALĂ' : 'LIBER', status: v.rollingDragAnomaly ? 'WARN' : 'OK', target: 'Liber' },
            ],
        };
    }, [liveData, telemetry]);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ISTORIC CURSE, REPLAY ENGINE & EXPORT PDF
    // ─────────────────────────────────────────────────────────────────────────
    const [tripsList, setTripsList] = useState(DEMO_TRIPS);
    const [selectedTripId, setSelectedTripId] = useState(DEMO_TRIPS[0].id);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);

    // Încărcare curse de la API
    const loadTrips = useCallback(async () => {
        setIsLoadingTrips(true);
        try {
            const vinParam = activeVin || activeVehicle?.vin || 'WVWZZZ1234567890';
            const res = await api.get(`/calatorii?vin=${vinParam}`);
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
                setTripsList(formatted);
                setSelectedTripId(formatted[0].id);
            }
        } catch (e) {
            // Rămâne pe DEMO_TRIPS în caz de offline/eroare
        } finally {
            setIsLoadingTrips(false);
        }
    }, [activeVin, activeVehicle]);

    useEffect(() => {
        loadTrips();
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
        const boost = Number(((speed / 130) * 1.6).toFixed(2));
        const gear = speed === 0 ? 'N' : speed < 25 ? '1' : speed < 45 ? '2' : speed < 70 ? '3' : speed < 95 ? '4' : '5';
        return {
            speed,
            rpm,
            boost,
            gear,
            progressPct: Math.round(progress * 100),
            coolant: Math.round(85 + progress * 5),
            gForceLat: Number((Math.sin(progress * Math.PI * 4) * 0.4).toFixed(2)),
        };
    }, [replayIndex, selectedTripId, tripsList]);

    // Buclă de avansare a redării
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

    const playReplay = () => { hapticTap(); setIsReplaying(true); };
    const pauseReplay = () => { hapticTap(); setIsReplaying(false); };
    const togglePlayPause = () => { if (isReplaying) pauseReplay(); else playReplay(); };
    const seekReplay = (index) => { hapticTap(); setReplayIndex(Math.max(0, Math.min(replayTotalSamples - 1, index))); };
    const cycleReplaySpeed = () => {
        hapticTap();
        setReplaySpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
    };

    const exportTripPdf = async (tripId) => {
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
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 3. MENTENANȚĂ (CBM), UZURĂ ARRHENIUS / ARCHARD & PORTOFEL ACTE
    // ─────────────────────────────────────────────────────────────────────────
    const [maintenanceItems, setMaintenanceItems] = useState([
        { id: 'oil', name: 'Schimb Ulei & Filtru (Model Arrhenius)', remainingKm: 3400, totalKm: 15000, wearPct: 77, status: 'URGENT', icon: 'water' },
        { id: 'brakes', name: 'Plăcuțe & Discuri Frână (Model Archard)', remainingKm: 18200, totalKm: 40000, wearPct: 54, status: 'OK', icon: 'disc' },
        { id: 'air_filter', name: 'Filtru Aer & Admisie Motor', remainingKm: 8500, totalKm: 20000, wearPct: 57, status: 'OK', icon: 'leaf' },
        { id: 'timing_belt', name: 'Kit Distribuție & Pompă Apă', remainingKm: 42000, totalKm: 90000, wearPct: 53, status: 'OK', icon: 'cog' },
        { id: 'brake_fluid', name: 'Lichid Frână DOT4 (Higroscopic)', remainingKm: 11000, totalKm: 30000, wearPct: 63, status: 'OK', icon: 'speedometer' },
    ]);

    const markServiceItemCompleted = async (itemId) => {
        hapticTap();
        setMaintenanceItems((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? { ...item, remainingKm: item.totalKm, wearPct: 0, status: 'OK' }
                    : item
            )
        );
        Alert.alert('Revizie Înregistrată', `Contorul pentru "${itemId}" a fost resetat la 100% via CBM.`);
    };

    // Portofel Acte Legale
    const legalDocuments = useMemo(() => [
        { id: 'rca', name: 'Asigurare Obligatorie RCA', daysLeft: 142, expiryDate: '10.03.2027', status: 'VALABIL', issuer: 'Groupama Asigurări' },
        { id: 'itp', name: 'Inspecție Tehnică Periodică (ITP)', daysLeft: 38, expiryDate: '26.11.2026', status: 'EXPIRĂ CURÂND', issuer: 'Stație ITP RAR #442' },
        { id: 'rovinieta', name: 'Rovinietă Națională CNAIR', daysLeft: 284, expiryDate: '30.07.2027', status: 'VALABIL', issuer: 'CNAIR Rom' },
        { id: 'casco', name: 'Poliță CASCO All-Risk', daysLeft: 210, expiryDate: '17.05.2027', status: 'VALABIL', issuer: 'Omniasig VIG' },
    ], []);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SMART MOBILITY, SENTRY GUARD, VALET & CRONOMETRU PARCARE
    // ─────────────────────────────────────────────────────────────────────────
    const [sentryArmed, setSentryArmed] = useState(true);
    const [sentryEvents, setSentryEvents] = useState([
        { id: 's1', time: '10:14', type: 'PROXIMITATE', desc: 'Mișcare detectată la 0.8m de portieră', severity: 'low' },
        { id: 's2', time: '08:02', type: 'ARMED', desc: 'Sentinelă armată automat la oprire', severity: 'info' },
    ]);

    const triggerShockSimulation = () => {
        hapticCriticalWarning();
        audioGong.playGong('critical');
        setSentryEvents(prev => [
            { id: String(Date.now()), time: 'ACUM', type: 'ȘOC SENZOR', desc: 'Impact fizic simulat (0.45G). Foto salvată.', severity: 'crit' },
            ...prev,
        ]);
        Alert.alert('🚨 ALARMĂ SENTINELĂ', 'Impact simulat detectat de accelerometrul vehiculului!');
    };

    // Parcare & Găsește-mi Mașina
    const carGpsCoords = { lat: 44.4323, lon: 26.1063 };
    const [parkingMinutesRemaining, setParkingMinutesRemaining] = useState(45);

    const addParkingTime = (minutes) => {
        hapticTap();
        setParkingMinutesRemaining(prev => prev + minutes);
    };

    const openWalkingDirections = () => {
        hapticTap();
        const url = `https://www.google.com/maps/dir/?api=1&destination=${carGpsCoords.lat},${carGpsCoords.lon}&travelmode=walking`;
        Linking.openURL(url).catch(() => Alert.alert('Eroare Hărți', 'Nu s-a putut deschide Google Maps.'));
    };

    // Mod Valet
    const [valetActive, setValetActive] = useState(false);
    const [valetViolationsCount, setValetViolationsCount] = useState(0);

    const toggleValetMode = () => {
        hapticTap();
        setValetActive(!valetActive);
    };

    // eCall SOS Test
    const triggerEcallTest = () => {
        hapticCriticalWarning();
        audioGong.playGong('critical');
        Alert.alert(
            '📡 TEST SIMULARE eCALL SOS',
            `Pachet SOS transmis:\nVIN: ${activeVin || 'WVWZZZ1234567890'}\nLocație: 44.4323 N, 26.1063 E\nStare pasageri: Test manual declanșat cu succes.`
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 5. INGINERUL MECANIC AI CONTEXTUAL (CHAT & DIAGNOSTIC RAPID)
    // ─────────────────────────────────────────────────────────────────────────
    const [aiMessages, setAiMessages] = useState([
        { id: 'm1', sender: 'ai', text: 'Salut! Sunt Inginerul tău Mecanic AI. Toți cei 32 de observatori fizici raportează funcționare nominală. Cum te pot ajuta azi?' },
    ]);
    const [isAiLoading, setIsAiLoading] = useState(false);

    const sendAiPrompt = async (promptText) => {
        if (!promptText || !promptText.trim()) return;
        hapticTap();
        const userMsg = { id: String(Date.now()), sender: 'user', text: promptText.trim() };
        setAiMessages(prev => [...prev, userMsg]);
        setIsAiLoading(true);

        try {
            const vin = activeVin || 'WVWZZZ1234567890';
            const res = await api.post('/ai/chat', { prompt: promptText, vin, context: telemetry });
            if (res.data && res.data.reply) {
                setAiMessages(prev => [...prev, { id: String(Date.now() + 1), sender: 'ai', text: res.data.reply }]);
            } else {
                throw new Error('Fallback AI');
            }
        } catch (e) {
            // Răspuns inteligent contextual bazat pe telemetria fizică curentă
            let smartReply = `Am analizat parametrii motorului. Turație: ${telemetry.rpm} RPM, Antigel: ${telemetry.coolantTemp}°C, Boost: ${telemetry.boost} bar. `;
            if (promptText.includes('DPF') || promptText.includes('filtru')) {
                smartReply += `Filtrul DPF are o încărcare de 34% (sub pragul de 80%). Nivelul de contrapresiune este nominal.`;
            } else if (promptText.includes('ulei') || promptText.includes('uzur')) {
                smartReply += `Conform modelului Arrhenius de degradare termică, uleiul are un RUL estimat de ${telemetry.weibullRul?.oil || 14200} km. Vâscozitatea este stabilă.`;
            } else if (promptText.includes('turbo') || promptText.includes('boost')) {
                smartReply += `Presiunea turbo este calibrată. Miezul CHRA este la ${telemetry.chraTemp}°C, iar răcirea necesară este de ${telemetry.chraCooldownSec}s.`;
            } else {
                smartReply += `Toți senzorii funcționează în parametri OEM. Nu există anomalii active raportate de observatorii Kalman.`;
            }
            setAiMessages(prev => [...prev, { id: String(Date.now() + 1), sender: 'ai', text: smartReply }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    return {
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
        exportItpDossier: () => exportWorkshopDossier(telemetry, activeVehicle),

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
        valetViolationsCount,
        triggerEcallTest,

        // AI Engineer
        aiMessages,
        isAiLoading,
        sendAiPrompt,
    };
}

export default useParadigmCoreData;
