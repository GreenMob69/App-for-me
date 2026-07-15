import React, { createContext, useState, useEffect, useRef } from 'react';
import socketService from '../services/socket';

export const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
    const [latestAlert, setLatestAlert] = useState(null);
    const [alertsList, setAlertsList] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const alertTimerRef = useRef(null);

    const markAlertsAsRead = () => {
        setUnreadCount(0);
    };

    useEffect(() => {
        const socket = socketService.connect();

        const onAlerta = (alerta) => {
            const nouaAlerta = {
                ...alerta, id: Date.now(),
                timp: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            };
            setAlertsList(prev => [nouaAlerta, ...prev]);
            setUnreadCount(prev => prev + 1);
            setLatestAlert(nouaAlerta);

            if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
            alertTimerRef.current = setTimeout(() => {
                setLatestAlert(current => current?.id === nouaAlerta.id ? null : current);
                alertTimerRef.current = null;
            }, 4000);
        };

        socket.on('alerta_live', onAlerta);

        return () => {
            socket.off('alerta_live', onAlerta);
            if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        };
    }, []);

    return (
        <AlertContext.Provider value={{
            latestAlert,
            alertsList,
            unreadCount,
            markAlertsAsRead,
        }}>
            {children}
        </AlertContext.Provider>
    );
};
