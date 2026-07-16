import React, { createContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import socketService from '../services/socket';

export const AlertContext = createContext();

// ── Notification handler — must be set at module level (outside component)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,   // v57: replaces deprecated shouldShowAlert
        shouldShowList:   true,
        shouldPlaySound:  false,
        shouldSetBadge:   false,
    }),
});

// ── Which alert types deserve a push notification
const CRITICAL_TIPS = new Set(['DTC', 'DTC_DETECTAT', 'MOTOR_STARE', 'SUPRAINCARCARE']);
const shouldNotify = (alerta) =>
    alerta?.severitate === 'CRITICAL' ||
    CRITICAL_TIPS.has(alerta?.tip?.toUpperCase?.());

// ── Android channel setup (required before getExpoPushTokenAsync on API 33+)
const CHANNEL_ID = 'telemetrie_alerte';
async function ensureAndroidChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name:       'Alerte vehicul',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF4444',
    });
}

// ── Request permissions — returns true if granted
async function requestNotifPermissions() {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
    return status === 'granted';
}

async function sendLocalNotification(alerta) {
    try {
        const enabled = await AsyncStorage.getItem('@notifs_enabled');
        if (enabled === 'false') return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: alerta.tip
                    ? `Alertă vehicul — ${alerta.tip.replace(/_/g, ' ')}`
                    : 'Alertă vehicul',
                body: alerta.descriere || 'A apărut o problemă nouă.',
                data: { alertId: alerta.id },
                // Android channel
                ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
            },
            trigger: null, // immediate
        });
    } catch {}
}

export const AlertProvider = ({ children }) => {
    const [latestAlert,   setLatestAlert]   = useState(null);
    const [alertsList,    setAlertsList]    = useState([]);
    const [unreadCount,   setUnreadCount]   = useState(0);
    const [notifsGranted, setNotifsGranted] = useState(false);

    const alertTimerRef = useRef(null);

    // Request permissions and set up Android channel once on mount
    useEffect(() => {
        (async () => {
            await ensureAndroidChannel();
            const granted = await requestNotifPermissions().catch(() => false);
            setNotifsGranted(granted);
        })();
    }, []);

    const markAlertsAsRead = () => setUnreadCount(0);

    useEffect(() => {
        const socket = socketService.connect();

        const onAlerta = (alerta) => {
            const nouaAlerta = {
                ...alerta,
                id:   Date.now(),
                timp: new Date().toLocaleTimeString('ro-RO', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                }),
            };

            setAlertsList(prev => [nouaAlerta, ...prev]);
            setUnreadCount(prev => prev + 1);
            setLatestAlert(nouaAlerta);

            if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
            alertTimerRef.current = setTimeout(() => {
                setLatestAlert(current => current?.id === nouaAlerta.id ? null : current);
                alertTimerRef.current = null;
            }, 4000);

            // Push notification for DTC / critical alerts
            if (notifsGranted && shouldNotify(alerta)) {
                sendLocalNotification(nouaAlerta);
            }
        };

        socket.on('alerta_live', onAlerta);

        return () => {
            socket.off('alerta_live', onAlerta);
            if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        };
    }, [notifsGranted]);

    return (
        <AlertContext.Provider value={{
            latestAlert,
            alertsList,
            unreadCount,
            markAlertsAsRead,
            notifsGranted,
        }}>
            {children}
        </AlertContext.Provider>
    );
};
