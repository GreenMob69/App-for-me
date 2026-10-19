import { Vibration, Platform } from 'react-native';

/**
 * Motor Haptic Ultra-Fiabil pentru Telemetrie Auto & Comutatoare Bord.
 * Utilizează Vibration nativ din React Native — zero dependențe externe, 100% compatibil Expo / Bare.
 */

const MIN_HAPTIC_INTERVAL_MS = 80;
let lastHapticTimestamp = 0;

// Vibrație tactilă discretă (12ms) la apăsarea comutatoarelor fizice, jog-wheel sau cardurilor
export const hapticTap = () => {
    const now = Date.now();
    if (now - lastHapticTimestamp < MIN_HAPTIC_INTERVAL_MS) return;
    lastHapticTimestamp = now;

    try {
        if (Platform.OS === 'android') {
            Vibration.vibrate(12);
        } else if (Platform.OS === 'ios') {
            Vibration.vibrate();
        }
    } catch (_) {}
};

// Dublu-puls scurt la atingerea zonei roșii (Redline / Shift Point)
export const hapticShiftAlert = () => {
    try {
        if (Platform.OS === 'android') {
            Vibration.vibrate([0, 25, 40, 25]);
        } else {
            Vibration.vibrate();
        }
    } catch (_) {}
};

// Tipar urgent de avertizare pentru alerte critice (eCall, Autoturare, Fierbere frâne, Polei)
export const hapticCriticalWarning = () => {
    try {
        if (Platform.OS === 'android') {
            Vibration.vibrate([0, 80, 60, 80]);
        } else {
            Vibration.vibrate();
        }
    } catch (_) {}
};

export default {
    hapticTap,
    hapticShiftAlert,
    hapticCriticalWarning,
};
