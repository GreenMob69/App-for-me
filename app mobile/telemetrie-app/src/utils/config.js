import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getAutoServerUrl = () => {
    if (Platform.OS === 'web') return 'http://localhost:3000';

    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (hostUri) {
        const laptopIp = hostUri.split(':')[0];
        console.log(`[NETWORK AUTO-CONFIG] IP Laptop detectat automat: ${laptopIp}`);
        return `http://${laptopIp}:3000`;
    }

    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
};

// Prioritate: Settings (AsyncStorage) > auto-detecție Metro > fallback emulator
// Se inițializează cu auto-detecție; App.js suprascrie cu valoarea din AsyncStorage la pornire.
let _serverUrl = getAutoServerUrl();

export const SERVER_URL = _serverUrl;
export const API_BASE_URL = `${_serverUrl}/api`;

export const setCustomServerUrl = (url) => {
    _serverUrl = url;
};

export const getActiveServerUrl = () => _serverUrl;
export const getActiveApiUrl = () => `${_serverUrl}/api`;

// --- Vehicle identity (single source of truth) ---
export const DEFAULT_VIN = 'WAUZZZ4A1RN000000';
let _vin = DEFAULT_VIN;

export const getVin   = () => _vin;
export const setVin   = (vin) => { _vin = vin; };

// --- Vehicle display label (loaded at startup from /vehicule/list) ---
// Format: "Audi A6 C4" sau "Audi A6 C4 · 2.5 TDI" dacă există engine_code
let _vehicleLabel = '';

export const getVehicleLabel = () => _vehicleLabel;
export const setVehicleLabel = (label) => { _vehicleLabel = label; };

// --- Vehicle fuel type (loaded at startup) ---
let _fuelType = 'DIESEL';

export const getFuelType   = () => _fuelType;
export const setFuelType   = (type) => { _fuelType = (type || 'diesel').toUpperCase(); };
