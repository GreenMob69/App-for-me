'use strict';
import React, { createContext, useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SecurityContext = createContext();

const STORAGE_ENABLED = '@security_enabled';
const STORAGE_TIMEOUT = '@security_timeout';

export const SecurityProvider = ({ children }) => {
    const [securityEnabled, setSecurityEnabled] = useState(false);
    const [lockTimeout,     setLockTimeout]     = useState(0);   // secunde: 0=imediat, 60, 300
    const [isLocked,        setIsLocked]         = useState(false);
    const [ready,           setReady]            = useState(false);

    const lastBackgroundAt = useRef(null);
    const appStateRef      = useRef(AppState.currentState);

    // ── Încarcă setările salvate ─────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [enabled, savedTimeout] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_ENABLED),
                    AsyncStorage.getItem(STORAGE_TIMEOUT),
                ]);
                const isEnabled = enabled === 'true';
                setSecurityEnabled(isEnabled);
                if (savedTimeout !== null) setLockTimeout(parseInt(savedTimeout, 10));
                if (isEnabled) setIsLocked(true);
            } catch {}
            setReady(true);
        })();
    }, []);

    // ── Monitorizează foreground/background ──────────────────────────────
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            const prev = appStateRef.current;
            appStateRef.current = next;

            if (prev === 'active' && next !== 'active') {
                lastBackgroundAt.current = Date.now();
            }

            if (next === 'active' && securityEnabled) {
                const elapsed = lastBackgroundAt.current
                    ? (Date.now() - lastBackgroundAt.current) / 1000
                    : Infinity;
                if (elapsed >= lockTimeout) {
                    setIsLocked(true);
                }
            }
        });
        return () => sub.remove();
    }, [securityEnabled, lockTimeout]);

    const unlockApp = useCallback(() => setIsLocked(false), []);
    const lockApp   = useCallback(() => {
        if (securityEnabled) setIsLocked(true);
    }, [securityEnabled]);

    const saveSettings = useCallback(async (enabled, newTimeout) => {
        setSecurityEnabled(enabled);
        setLockTimeout(newTimeout);
        if (!enabled) setIsLocked(false);
        await Promise.all([
            AsyncStorage.setItem(STORAGE_ENABLED, String(enabled)),
            AsyncStorage.setItem(STORAGE_TIMEOUT,  String(newTimeout)),
        ]);
    }, []);

    const value = useMemo(() => ({
        isLocked, securityEnabled, lockTimeout,
        unlockApp, lockApp, saveSettings, ready,
    }), [isLocked, securityEnabled, lockTimeout, unlockApp, lockApp, saveSettings, ready]);

    return (
        <SecurityContext.Provider value={value}>
            {children}
        </SecurityContext.Provider>
    );
};
