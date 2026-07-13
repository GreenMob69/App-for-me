import axios from 'axios';
import { API_BASE_URL } from '../utils/config'; // <- Importăm adresa API auto-detectată!

console.log(`[MOBIL -> REST] Configurare Axios pe: ${API_BASE_URL}`);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default api;