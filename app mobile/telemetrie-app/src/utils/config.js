import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getServerUrl = () => {
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
