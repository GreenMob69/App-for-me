import axios from 'axios';
import { API_BASE_URL } from '../utils/config';

console.log(`[MOBIL -> REST] Configurare Axios pe: ${API_BASE_URL}`);

export const API_TOKEN = 'telemetrie-dev-2024';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
    },
});

export default api;
