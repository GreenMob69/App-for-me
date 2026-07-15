import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Setează URL-ul manual când WiFi-ul universitar blochează conexiunile directe
// (AP Isolation). Lasă null pentru detecție automată (acasă / hotspot).
// Exemplu: 'https://abc123.ngrok-free.app'  ← din comanda: npx ngrok http 3000
const MANUAL_BACKEND_URL = null;

const getServerUrl = () => {
    if (MANUAL_BACKEND_URL) {
        console.log(`[NETWORK] URL manual: ${MANUAL_BACKEND_URL}`);
        return MANUAL_BACKEND_URL;
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:3000';
    }

    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;

    if (hostUri) {
        const laptopIp = hostUri.split(':')[0];
        console.log(`[NETWORK AUTO-CONFIG] IP Laptop detectat automat: ${laptopIp}`);
        return `http://${laptopIp}:3000`;
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
};

let _serverUrl = getServerUrl();

export const SERVER_URL = _serverUrl;
export const API_BASE_URL = `${_serverUrl}/api`;

export const setCustomServerUrl = (url) => {
    _serverUrl = url;
};

export const getActiveServerUrl = () => _serverUrl;
export const getActiveApiUrl = () => `${_serverUrl}/api`;

// --- Vehicle identity (single source of truth) ---
let _vin = 'WAUZZZ4A1RN000000';

export const getVin = () => _vin;
export const setVin = (vin) => { _vin = vin; };
