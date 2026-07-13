import React, { createContext, useState, useEffect } from 'react';
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

    const markAlertsAsRead = () => {
        setUnreadCount(0);
    };

    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('telemetrie_live', (data) => {
            setLiveData(data);

            // AICI ESTE MAGIA: Salvăm o "fotografie" completă a tuturor senzorilor în fiecare secundă
            setChartHistory(prevHistory => {
                const nextSec = prevHistory.length;
                
                // Creăm un obiect plat (flat) cu toți parametrii din toate categoriile
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
                // Păstrăm ultimele 600 de secunde (10 minute) în RAM pentru fluiditate maximă
                if (nouIstoric.length > 600) return nouIstoric.slice(-600);
                return nouIstoric;
            });
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
            socket.off('alerta_live');
        };
    }, []);

    return (
        <TelemetryContext.Provider value={{
            isConnected, viewMode, setViewMode, selectedMetric, setSelectedMetric,
            activeTemplate, setActiveTemplate, 
            liveData, chartHistory, latestAlert, alertsList, unreadCount, markAlertsAsRead
        }}>
            {children}
        </TelemetryContext.Provider>
    );
};