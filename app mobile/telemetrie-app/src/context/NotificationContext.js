import React, { createContext, useState, useCallback, useEffect, useRef, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateNotifications, extractLastSeenState } from '../engine/NotificationEngine';

const STORAGE_KEY   = '@notifications_v1';
const LAST_SEEN_KEY = '@notif_last_seen_v1';
const MAX_NOTIFS    = 100;
const STALE_MS      = 30 * 24 * 60 * 60 * 1000; // 30 days

export const NotificationContext = createContext({
    notifications:    [],
    unreadCount:      0,
    syncFromSummary:  () => {},
    markRead:         () => {},
    markAllRead:      () => {},
    clearAll:         () => {},
    getByCategory:    () => [],
});

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const lastSeenRef = useRef({});
    const persistedRef = useRef(false);

    const unreadCount = notifications.filter(n => !n.read).length;

    // ── Persist ──────────────────────────────────────────────────────────────
    const persist = useCallback(async (notifs) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
        } catch {}
    }, []);

    // ── Load from storage on mount ───────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const [raw, rawLastSeen] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY),
                    AsyncStorage.getItem(LAST_SEEN_KEY),
                ]);
                if (raw) {
                    const loaded = JSON.parse(raw);
                    // Prune stale read notifications older than STALE_MS
                    const cutoff  = Date.now() - STALE_MS;
                    const pruned  = loaded.filter(n => !n.read || n.timestamp > cutoff);
                    setNotifications(pruned);
                }
                if (rawLastSeen) {
                    lastSeenRef.current = JSON.parse(rawLastSeen);
                }
            } catch {}
            persistedRef.current = true;
        };
        load();
    }, []);

    // ── Sync from twin summary data (called by screens after their fetches) ──
    const syncFromSummary = useCallback(async (summaryData) => {
        if (!summaryData) return;

        const newNotifs = generateNotifications(summaryData, lastSeenRef.current);
        if (newNotifs.length === 0) return;

        setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const fresh       = newNotifs.filter(n => !existingIds.has(n.id));
            if (fresh.length === 0) return prev;
            const merged = [...fresh, ...prev].slice(0, MAX_NOTIFS);
            persist(merged);
            return merged;
        });

        const newLastSeen = extractLastSeenState(summaryData);
        lastSeenRef.current = newLastSeen;
        try {
            await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(newLastSeen));
        } catch {}
    }, [persist]);

    // ── Mark single notification as read ────────────────────────────────────
    const markRead = useCallback((id) => {
        setNotifications(prev => {
            const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
            persist(updated);
            return updated;
        });
    }, [persist]);

    // ── Mark all as read ────────────────────────────────────────────────────
    const markAllRead = useCallback(() => {
        setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, read: true }));
            persist(updated);
            return updated;
        });
    }, [persist]);

    // ── Clear all ────────────────────────────────────────────────────────────
    const clearAll = useCallback(() => {
        setNotifications([]);
        persist([]);
    }, [persist]);

    // ── Filter by category ───────────────────────────────────────────────────
    const getByCategory = useCallback((category) => {
        if (!category || category === 'ALL') return notifications;
        return notifications.filter(n => n.category === category);
    }, [notifications]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            syncFromSummary,
            markRead,
            markAllRead,
            clearAll,
            getByCategory,
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
