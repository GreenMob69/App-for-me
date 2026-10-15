import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMPLATES } from '../theme';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplateState] = useState('MOTORSPORT');
    const [tripReport, setTripReport] = useState(null);
    const navigationRef = useRef(null);

    // Încarcă șablonul salvat din AsyncStorage la pornire
    useEffect(() => {
        AsyncStorage.getItem('@cockpit_template').then(saved => {
            if (saved && TEMPLATES[saved]) {
                setActiveTemplateState(saved);
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

    const currentTemplate = TEMPLATES[activeTemplate] || TEMPLATES.MOTORSPORT;

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
            tripReport, setTripReport, dismissTripReport,
            navigationRef, setNavigationRef,
        }}>
            {children}
        </AppContext.Provider>
    );
};
