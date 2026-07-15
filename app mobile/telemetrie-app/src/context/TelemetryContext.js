import React, { createContext, useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';

export const TelemetryContext = createContext();

export const TelemetryProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');

    // Tema vizuală
    const [activeTemplate, setActiveTemplate] = useState('DIGITAL');

    // Starea curentă live
    const [liveData, setLiveData] = useState({});

    // Istoric grafice: ACUM VA STOCA TOT OBIECTUL DE DATE, NU DOAR 3 PARAMETRI
    const [chartHistory, setChartHistory] = useState([]);

    const [latestAlert, setLatestAlert] = useState(null);
    const [alertsList, setAlertsList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Trip Report — populated on trip STOP
    const [tripReport, setTripReport] = useState(null);
    const navigationRef = useRef(null);

    const setNavigationRef = (ref) => {
        navigationRef.current = ref;
    };

    const dismissTripReport = () => {
        setTripReport(null);
    };

    const markAlertsAsRead = () => {
        setUnreadCount(0);
    };

    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('telemetrie_live', (data) => {
            setLiveData(data);

            setChartHistory(prevHistory => {
                const nextSec = prevHistory.length;

                const flatData = {
                    secunda: nextSec,
                    label: nextSec % 10 === 0 ? `${nextSec}s` : '',
                    ...(data.motor || {}),
                    ...(data.temperaturi || {}),
                    ...(data.aer || {}),
                    ...(data.combustibil || {}),
                    ...(data.lambda || {}),
                    ...(data.aprindere || {}),
                    ...(data.emisii || {}),
                    ...(data.baterie || {}),
                    ...(data.dpf || {}),
                    ...(data.vvt || {}),
                    ...(data.transmisie || {}),
                    ...(data.presiuni || {}),
                };

                const nouIstoric = [...prevHistory, flatData];
                if (nouIstoric.length > 600) return nouIstoric.slice(-600);
                return nouIstoric;
            });
        });

        socket.on('status_trip', (data) => {
            if (data.status === 'STOP' && data.report) {
                setTripReport(data.report);
                setChartHistory([]);
                if (navigationRef.current) {
                    navigationRef.current.navigate('TripReport', { report: data.report });
                }
            }
        });

        socket.on('alerta_live', (alerta) => {
            const nouaAlerta = {
                ...alerta, id: Date.now(),
                timp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            setAlertsList(prev => [nouaAlerta, ...prev]);
            setUnreadCount(prev => prev + 1);
            setLatestAlert(nouaAlerta);
            setTimeout(() => {
                setLatestAlert(current => current?.id === nouaAlerta.id ? null : current);
            }, 4000);
        });

        return () => {
            socket.off('telemetrie_live');
            socket.off('status_trip');
            socket.off('alerta_live');
        };
    }, []);

    return (
        <TelemetryContext.Provider value={{
            isConnected, viewMode, setViewMode, selectedMetric, setSelectedMetric,
            activeTemplate, setActiveTemplate,
            liveData, chartHistory, latestAlert, alertsList, unreadCount, markAlertsAsRead,
            tripReport, dismissTripReport, setNavigationRef
        }}>
            {children}
        </TelemetryContext.Provider>
    );
};