import React, { createContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMPLATES } from '../theme/templates';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplateState] = useState('MOTORSPORT');
    const [oledBlackMode, setOledBlackModeState] = useState(false);
    const [tripReport, setTripReport] = useState(null);
    const [uiParadigm, setUiParadigmState] = useState('CLASSIC_V2');
    const [showExperiencePicker, setShowExperiencePicker] = useState(false);
    const [skipLauncherPrompt, setSkipLauncherPromptState] = useState(false);
    const [showSimulatorModal, setShowSimulatorModal] = useState(false);
    const navigationRef = useRef(null);

    // Încarcă șablonul, modul OLED și paradigma vizuală din AsyncStorage la pornire
    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem('@cockpit_template'),
            AsyncStorage.getItem('@oled_black_mode'),
            AsyncStorage.getItem('@ui_paradigm_mode'),
            AsyncStorage.getItem('@ui_paradigm_skip_prompt'),
        ]).then(([savedTpl, savedOled, savedParadigm, savedSkipPrompt]) => {
            if (savedTpl && TEMPLATES[savedTpl]) {
                setActiveTemplateState(savedTpl);
            }
            if (savedOled !== null) {
                setOledBlackModeState(savedOled === 'true');
            }
            if (savedParadigm) {
                setUiParadigmState(savedParadigm);
            }
            const skip = savedSkipPrompt === 'true';
            setSkipLauncherPromptState(skip);
            // Dacă utilizatorul nu a bifat "Nu mai afișa la pornire", afișăm selectorul la primul boot
            if (!skip && !savedParadigm) {
                setShowExperiencePicker(true);
            }
        }).catch(() => {});
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
        showExperiencePicker, setShowExperiencePicker,
        openExperiencePicker, closeExperiencePicker,
        skipLauncherPrompt, setSkipLauncherPrompt,
        showSimulatorModal, setShowSimulatorModal,
        openSimulatorModal, closeSimulatorModal,
        tripReport, setTripReport, dismissTripReport,
        navigationRef, setNavigationRef,
    }), [
        viewMode, selectedMetric, activeTemplate, setActiveTemplate, currentTemplate,
        oledBlackMode, setOledBlackMode,
        uiParadigm, setUiParadigm,
        showExperiencePicker, openExperiencePicker, closeExperiencePicker,
        skipLauncherPrompt, setSkipLauncherPrompt,
        showSimulatorModal, openSimulatorModal, closeSimulatorModal,
        tripReport, dismissTripReport, setNavigationRef
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
        showExperiencePicker: Boolean(context?.showExperiencePicker),
        openExperiencePicker: context?.openExperiencePicker || (() => {}),
        closeExperiencePicker: context?.closeExperiencePicker || (() => {}),
        skipLauncherPrompt: Boolean(context?.skipLauncherPrompt),
        setSkipLauncherPrompt: context?.setSkipLauncherPrompt || (() => {}),
        showSimulatorModal: Boolean(context?.showSimulatorModal),
        openSimulatorModal: context?.openSimulatorModal || (() => {}),
        closeSimulatorModal: context?.closeSimulatorModal || (() => {}),
    };
};

