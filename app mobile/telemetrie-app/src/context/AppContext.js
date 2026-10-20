import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMPLATES } from '../theme/templates';
import api from '../services/api';
import { getMechanicGuide } from '../utils/physicalMechanicGuide';
import { setVoiceLanguage } from '../services/voiceAlertService';

export const AppContext = createContext();

export const AUTOPILOT_STEPS = [
    {
        scenario: 'normal',
        cameraPreset: 'OVERVIEW',
        selectedPart: null,
        subsystem: null,
        mechanicGuideId: null,
                titleRo: '🟢 CROAZIERĂ NORMALĂ OPTIMĂ (100% NOMINAL)',
        titleEn: '🟢 NOMINAL HIGHWAY CRUISE (100% NOMINAL)',
        titleRu: '🟢 НОМИНАЛЬНЫЙ ТРАССОВЫЙ РЕЖИМ (100% НОРМА)',
        narrativeRo: 'Viteză 88 km/h, 2100 RPM. Eficiență termică motor 36.5%, amestec stoichiometric lambda optim. Nicio anomalie prezentă.',
        narrativeEn: 'Cruising at 88 km/h, 2100 RPM. Engine thermal efficiency 36.5%, optimal lambda stoichiometry. Zero anomalies detected.',
        narrativeRu: 'Скорость 88 км/ч, 2100 об/мин. Тепловой КПД ДВС 36.5%, оптимальная стехиометрия смеси lambda. Ошибок и сбоев нет.',
    },
    {
        scenario: 'fault_turbo',
        cameraPreset: 'ENGINE_BAY',
        selectedPart: 'turbo',
        subsystem: 'turbo',
        mechanicGuideId: 'INTERCOOLER_BOOST_LEAK',
                titleRo: '🌪️ DETECȚIE BOOST LEAK / FURTUN FISURAT',
        titleEn: '🌪️ BOOST LEAK DETECTED / CRACKED INTERCOOLER HOSE',
        titleRu: '🌪️ УТЕЧКА НАДДУВА / ТРЕЩИНА ПАТРУБКА',
        narrativeRo: 'Presiunea MAP a scăzut la 140 kPa (sub comanda de 215 kPa). Algoritmul a identificat pierdere pe traseul intercooler și a prevenit supraturarea turbinei.',
        narrativeEn: 'MAP pressure dropped to 140 kPa (below 215 kPa cmd). Observer detected boost leak and prevented turbo overspeed failure.',
        narrativeRu: 'Давление во впуске упало до 140 кПа (ниже команды 215 кПа). Наблюдатель зафиксировал утечку и предотвратил разрушение турбины.',
    },
    {
        scenario: 'mountain_brakes',
        cameraPreset: 'CHASSIS_BRAKES',
        selectedPart: 'brakes',
        subsystem: 'brakes',
        mechanicGuideId: 'BRAKE_CALIPER_OR_BEARING_DRAG',
                titleRo: '⛰️ COBORÂRE MUNTE / PREVENȚIE FIERBERE LICHID FRÂNĂ',
        titleEn: '⛰️ MOUNTAIN DESCENT / BRAKE FLUID BOILING PREVENTION',
        titleRu: '⛰️ СПУСК С ГОРЫ / РИСК ЗАКИПАНИЯ ТОРМОЗОВ',
        narrativeRo: 'Pantă -7.5%, temp lichid frână: 162°C! Sistemul activează alerta de Brake Fade și recomandă comutarea în frână de motor treapta a 3-a.',
        narrativeEn: 'Steep grade -7.5%, fluid temp: 162°C! System triggered Brake Fade hazard, advising engine braking downshift to 3rd gear.',
        narrativeRu: 'Уклон -7.5%, температура жидкости: 162°C! Система активировала предупреждение о перегреве и советует торможение двигателем на 3-й передаче.',
    },
    {
        scenario: 'dpf_regen',
        cameraPreset: 'OVERVIEW',
        selectedPart: 'dpf',
        subsystem: 'dpf',
        mechanicGuideId: null,
                titleRo: '🔥 REGENERARE ACTIVĂ DPF ÎN CURS (625°C)',
        titleEn: '🔥 ACTIVE DPF SOOT REGENERATION (625°C)',
        titleRu: '🔥 АКТИВНАЯ РЕГЕНЕРАЦИЯ САЖЕВОГО ФИЛЬТРА (625°C)',
        narrativeRo: 'Post-injecție activă pentru arderea funinginii. Gazele de evacuare au atins 625°C. Protocolul notifică șoferul să nu oprească motorul timp de 3 minute.',
        narrativeEn: 'Post-injection burning soot. Exhaust EGT reached 625°C. System advises keeping engine running for 3 mins to finish cycle.',
        narrativeRu: 'Идет послевпрыск для выжигания сажи. Температура выхлопа достигла 625°C. Рекомендуется не глушить мотор в течение 3 минут.',
    },
    {
        scenario: 'black_ice',
        cameraPreset: 'HIGHWAY_CHASE',
        selectedPart: 'suspension',
        subsystem: 'suspension',
        mechanicGuideId: 'LOW_TIRE_PRESSURE_DETECTED',
                titleRo: '❄️ PIERDERE ADERENȚĂ / ALERTĂ POLEI (BLACK ICE)',
        titleEn: '❄️ GRIP LOSS / BLACK ICE SLIP WARNING',
        titleRu: '❄️ ПОТЕРЯ СЦЕПЛЕНИЯ / ГОЛОЛЁД (BLACK ICE)',
        narrativeRo: 'Diferență viteză roți motrice de 8 km/h la 0°C. Sistemul a identificat polei pe carosabil și a amortizat comanda accelerației pentru a preveni derapajul.',
        narrativeEn: '8 km/h wheel slip delta at 0°C. System identified black ice patch and damped throttle mapping to prevent spin-out.',
        narrativeRu: 'Разница скорости ведущих колес 8 км/ч при 0°C. Система распознала ледяной участок и сгладила реакцию на газ для защиты от заноса.',
    },
];

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplateState] = useState('MOTORSPORT');
    const [oledBlackMode, setOledBlackModeState] = useState(false);
    const [tripReport, setTripReport] = useState(null);
    const [uiParadigm, setUiParadigmState] = useState('CLASSIC_V2');
    const [appLang, setAppLangState] = useState('RO');
    const [showExperiencePicker, setShowExperiencePicker] = useState(false);
    const [skipLauncherPrompt, setSkipLauncherPromptState] = useState(false);
    const [showSimulatorModal, setShowSimulatorModal] = useState(false);
    const navigationRef = useRef(null);

    // ── AUTO-PILOT SHOWCASE STATE ────────────────────────────────────────────
    const [isAutoPilotActive, setIsAutoPilotActive] = useState(false);
    const [autoPilotStepIndex, setAutoPilotStepIndex] = useState(0);
    const [autoPilotCountdown, setAutoPilotCountdown] = useState(15);
    const autoPilotTimerRef = useRef(null);
    const autoPilotIntervalRef = useRef(null);

    // ── GHID MECANIC FIZIC MODAL STATE ───────────────────────────────────────
    const [mechanicModalState, setMechanicModalState] = useState({
        visible: false,
        guide: null,
    });

    // Încarcă setările persistate din AsyncStorage
    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem('@cockpit_template'),
            AsyncStorage.getItem('@oled_black_mode'),
            AsyncStorage.getItem('@ui_paradigm_mode'),
            AsyncStorage.getItem('@ui_paradigm_skip_prompt'),
            AsyncStorage.getItem('@app_language'),
            AsyncStorage.getItem('@app_lang'),
        ]).then(([savedTpl, savedOled, savedParadigm, savedSkipPrompt, savedLangFull, savedLangShort]) => {
            const savedLang = savedLangFull || savedLangShort;
            if (savedTpl && TEMPLATES[savedTpl]) {
                setActiveTemplateState(savedTpl);
            }
            if (savedOled !== null) {
                setOledBlackModeState(savedOled === 'true');
            }
            if (savedParadigm === 'F1_CYBERDECK' || savedParadigm === 'SPATIAL_CANVAS') {
                setUiParadigmState('CLASSIC_V2');
                AsyncStorage.setItem('@ui_paradigm_mode', 'CLASSIC_V2').catch(() => {});
            } else if (savedParadigm) {
                setUiParadigmState(savedParadigm);
            }
            if (savedLang === 'RO' || savedLang === 'EN' || savedLang === 'RU') {
                setAppLangState(savedLang);
                setVoiceLanguage(savedLang);
            }
            const skip = savedSkipPrompt === 'true';
            setSkipLauncherPromptState(skip);
            if (!skip && !savedParadigm) {
                setShowExperiencePicker(true);
            }
        }).catch(() => {});
    }, []);

    // ── AUTO-PILOT SHOWCASE ENGINE ────────────────────────────────────────────
    const executeAutoPilotStep = useCallback(async (index) => {
        const step = AUTOPILOT_STEPS[index % AUTOPILOT_STEPS.length];
        try {
            await api.post('/simulator/start', {
                scenario: step.scenario,
                durationSec: 180,
            });
        } catch (err) {
            console.warn('[AUTOPILOT START ERROR]', err?.message);
        }
    }, []);

    const stopAutoPilot = useCallback(async () => {
        setIsAutoPilotActive(false);
        if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
        if (autoPilotIntervalRef.current) clearInterval(autoPilotIntervalRef.current);
        try {
            await api.post('/simulator/stop');
        } catch (_) {}
    }, []);

    const startAutoPilot = useCallback(() => {
        setIsAutoPilotActive(true);
        setAutoPilotStepIndex(0);
        setAutoPilotCountdown(15);
        executeAutoPilotStep(0);

        if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
        if (autoPilotIntervalRef.current) clearInterval(autoPilotIntervalRef.current);

        let currentStep = 0;
        let secondsLeft = 15;

        // Ticker de secunde pentru afișaj dinamic în banner
        autoPilotTimerRef.current = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                secondsLeft = 15;
                currentStep = (currentStep + 1) % AUTOPILOT_STEPS.length;
                setAutoPilotStepIndex(currentStep);
                executeAutoPilotStep(currentStep);
            }
            setAutoPilotCountdown(secondsLeft);
        }, 1000);
    }, [executeAutoPilotStep]);

    const toggleAutoPilot = useCallback(() => {
        if (isAutoPilotActive) {
            stopAutoPilot();
        } else {
            startAutoPilot();
        }
    }, [isAutoPilotActive, startAutoPilot, stopAutoPilot]);

    // Curățare la unmount
    useEffect(() => {
        return () => {
            if (autoPilotTimerRef.current) clearInterval(autoPilotTimerRef.current);
            if (autoPilotIntervalRef.current) clearInterval(autoPilotIntervalRef.current);
        };
    }, []);

    // Datele pasului curent de Auto-Pilot
    const currentAutoPilotData = useMemo(() => {
        const step = AUTOPILOT_STEPS[autoPilotStepIndex % AUTOPILOT_STEPS.length];
        return {
            ...step,
            active: isAutoPilotActive,
            stepIndex: autoPilotStepIndex,
            secondsRemaining: autoPilotCountdown,
        };
    }, [isAutoPilotActive, autoPilotStepIndex, autoPilotCountdown]);

    // ── GHID MECANIC FIZIC HELPERS ───────────────────────────────────────────
    const openMechanicGuide = useCallback((keyOrDtc) => {
        const guide = getMechanicGuide(keyOrDtc);
        if (guide) {
            setMechanicModalState({ visible: true, guide });
        }
    }, []);

    const closeMechanicGuide = useCallback(() => {
        setMechanicModalState(prev => ({ ...prev, visible: false }));
    }, []);

    const setActiveTemplate = useCallback(async (tplId) => {
        if (!TEMPLATES[tplId]) return;
        setActiveTemplateState(tplId);
        try {
            await AsyncStorage.setItem('@cockpit_template', tplId);
        } catch {}
    }, []);

    const setOledBlackMode = useCallback(async (val) => {
        setOledBlackModeState(val);
        try {
            await AsyncStorage.setItem('@oled_black_mode', String(val));
        } catch {}
    }, []);

    const setUiParadigm = useCallback(async (paradigm) => {
        setUiParadigmState(paradigm);
        try {
            await AsyncStorage.setItem('@ui_paradigm_mode', paradigm);
        } catch {}
    }, []);

    const setAppLang = useCallback(async (lang) => {
        const next = (lang === 'EN' || lang === 'RU') ? lang : 'RO';
        setAppLangState(next);
        setVoiceLanguage(next);
        try {
            await AsyncStorage.setItem('@app_language', next);
            await AsyncStorage.setItem('@app_lang', next);
        } catch {}
    }, []);

    const toggleAppLang = useCallback(() => {
        setAppLangState((prev) => {
            const next = prev === 'RO' ? 'EN' : prev === 'EN' ? 'RU' : 'RO';
            AsyncStorage.setItem('@app_language', next).catch(() => {});
            AsyncStorage.setItem('@app_lang', next).catch(() => {});
            setVoiceLanguage(next);
            return next;
        });
    }, []);

    const setSkipLauncherPrompt = useCallback(async (val) => {
        setSkipLauncherPromptState(val);
        try {
            await AsyncStorage.setItem('@ui_paradigm_skip_prompt', String(val));
        } catch {}
    }, []);

    const openExperiencePicker = useCallback(() => {
        setShowExperiencePicker(true);
    }, []);

    const closeExperiencePicker = useCallback(() => {
        setShowExperiencePicker(false);
    }, []);

    const openSimulatorModal = useCallback(() => {
        setShowSimulatorModal(true);
    }, []);

    const closeSimulatorModal = useCallback(() => {
        setShowSimulatorModal(false);
    }, []);

    const baseTemplate = TEMPLATES[activeTemplate] || TEMPLATES.MOTORSPORT;
    const currentTemplate = useMemo(() => (oledBlackMode ? {
        ...baseTemplate,
        bg: '#000000',
        cardBg: '#05070c',
        border: '#181b26',
        isOledBlack: true,
    } : baseTemplate), [baseTemplate, oledBlackMode]);

    const setNavigationRef = useCallback((ref) => {
        navigationRef.current = ref;
    }, []);

    const dismissTripReport = useCallback(() => {
        setTripReport(null);
    }, []);

    const value = useMemo(() => ({
        viewMode, setViewMode,
        selectedMetric, setSelectedMetric,
        activeTemplate, setActiveTemplate, currentTemplate,
        oledBlackMode, setOledBlackMode, isOledBlack: oledBlackMode,
        uiParadigm, setUiParadigm,
        appLang, setAppLang, toggleAppLang,
        showExperiencePicker, setShowExperiencePicker,
        openExperiencePicker, closeExperiencePicker,
        skipLauncherPrompt, setSkipLauncherPrompt,
        showSimulatorModal, setShowSimulatorModal,
        openSimulatorModal, closeSimulatorModal,
        tripReport, setTripReport, dismissTripReport,
        navigationRef, setNavigationRef,
        // Auto-Pilot Showcase
        isAutoPilotActive,
        autoPilotStepIndex,
        autoPilotCountdown,
        autoPilotData: currentAutoPilotData,
        startAutoPilot,
        stopAutoPilot,
        toggleAutoPilot,
        // Ghid Mecanic Fizic
        mechanicModalState,
        openMechanicGuide,
        closeMechanicGuide,
    }), [
        viewMode, selectedMetric, activeTemplate, setActiveTemplate, currentTemplate,
        oledBlackMode, setOledBlackMode,
        uiParadigm, setUiParadigm,
        appLang, setAppLang, toggleAppLang,
        showExperiencePicker, openExperiencePicker, closeExperiencePicker,
        skipLauncherPrompt, setSkipLauncherPrompt,
        showSimulatorModal, openSimulatorModal, closeSimulatorModal,
        tripReport, dismissTripReport, setNavigationRef,
        isAutoPilotActive, autoPilotStepIndex, autoPilotCountdown, currentAutoPilotData,
        startAutoPilot, stopAutoPilot, toggleAutoPilot,
        mechanicModalState, openMechanicGuide, closeMechanicGuide
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useThemeTemplate = () => {
    const context = React.useContext(AppContext);
    return context?.currentTemplate || TEMPLATES.MOTORSPORT;
};

export const useUiParadigm = () => {
    const context = React.useContext(AppContext);
    return {
        uiParadigm: context?.uiParadigm || 'CLASSIC_V2',
        setUiParadigm: context?.setUiParadigm || (() => {}),
        appLang: context?.appLang || 'RO',
        setAppLang: context?.setAppLang || (() => {}),
        toggleAppLang: context?.toggleAppLang || (() => {}),
        showExperiencePicker: Boolean(context?.showExperiencePicker),
        openExperiencePicker: context?.openExperiencePicker || (() => {}),
        closeExperiencePicker: context?.closeExperiencePicker || (() => {}),
        skipLauncherPrompt: Boolean(context?.skipLauncherPrompt),
        setSkipLauncherPrompt: context?.setSkipLauncherPrompt || (() => {}),
        showSimulatorModal: Boolean(context?.showSimulatorModal),
        openSimulatorModal: context?.openSimulatorModal || (() => {}),
        closeSimulatorModal: context?.closeSimulatorModal || (() => {}),
        // Auto-Pilot
        isAutoPilotActive: Boolean(context?.isAutoPilotActive),
        autoPilotData: context?.autoPilotData,
        startAutoPilot: context?.startAutoPilot || (() => {}),
        stopAutoPilot: context?.stopAutoPilot || (() => {}),
        toggleAutoPilot: context?.toggleAutoPilot || (() => {}),
        // Ghid Mecanic
        openMechanicGuide: context?.openMechanicGuide || (() => {}),
    };
};

export const useAppLang = () => {
    const context = React.useContext(AppContext);
    return {
        appLang: context?.appLang || 'RO',
        setAppLang: context?.setAppLang || (() => {}),
        toggleAppLang: context?.toggleAppLang || (() => {}),
    };
};
