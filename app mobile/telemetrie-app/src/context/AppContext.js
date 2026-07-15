import React, { createContext, useState, useRef, useCallback } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplate] = useState('DIGITAL');
    const [tripReport, setTripReport] = useState(null);
    const navigationRef = useRef(null);

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
            activeTemplate, setActiveTemplate,
            tripReport, setTripReport, dismissTripReport,
            navigationRef, setNavigationRef,
        }}>
            {children}
        </AppContext.Provider>
    );
};
