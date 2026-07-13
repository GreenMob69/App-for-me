import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getServerUrl = () => {
    // 1. Când deschizi aplicația în browser (pe Web prin tasta 'w')
    if (Platform.OS === 'web') {
        return 'http://localhost:3000';
    }

    // 2. Extragere magică pentru Telefon Fizic (Android / iOS via Expo Go):
    // Constants.expoConfig.hostUri ne dă automat adresa de forma "192.168.1.15:8081"
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    
    if (hostUri) {
        // Tăiem portul 8081 al Expo și păstrăm doar IP-ul pur al laptopului tău
        const laptopIp = hostUri.split(':')[0];
        console.log(`[NETWORK AUTO-CONFIG] IP Laptop detectat automat: ${laptopIp}`);
        return `http://${laptopIp}:3000`;
    }

    // 3. Fallback de siguranță pentru Emulatorul Android clasic pe laptop
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
};

// Exportăm URL-urile gata calculate pentru WebSockets și API REST
export const SERVER_URL = getServerUrl();
export const API_BASE_URL = `${SERVER_URL}/api`;