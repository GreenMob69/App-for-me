import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMPLATES } from '../theme/templates';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplateState] = useState('MOTORSPORT');
    const [oledBlackMode, setOledBlackModeState] = useState(false);
    const [tripReport, setTripReport] = useState(null);
    const navigationRef = useRef(null);

    // Încarcă șablonul și starea modului OLED din AsyncStorage la pornire
    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem('@cockpit_template'),
            AsyncStorage.getItem('@oled_black_mode'),
        ]).then(([savedTpl, savedOled]) => {
            if (savedTpl && TEMPLATES[savedTpl]) {
                setActiveTemplateState(savedTpl);
            }
            if (savedOled !== null) {
                setOledBlackModeState(savedOled === 'true');
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

    const baseTemplate = TEMPLATES[activeTemplate] || TEMPLATES.MOTORSPORT;
    const currentTemplate = oledBlackMode ? {
        ...baseTemplate,
        bg: '#000000',
        cardBg: '#05070c',
        border: '#181b26',
        isOledBlack: true,
    } : baseTemplate;

    const setNavigationRef = useCallback((ref) => {
        navigationRef.current = ref;
    }, []);

    const dismissTripReport = useCallback(() => {
        setTripReport(null);
    }, []);

    return (
        <AppContext.Provider value={{
            viewMode, setViewMode,
            selectedMetric, setSelectedMetric,
            activeTemplate, setActiveTemplate, currentTemplate,
            oledBlackMode, setOledBlackMode, isOledBlack: oledBlackMode,
            tripReport, setTripReport, dismissTripReport,
            navigationRef, setNavigationRef,
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useThemeTemplate = () => {
    const context = React.useContext(AppContext);
    return context?.currentTemplate || TEMPLATES.MOTORSPORT;
};

