import api from './api';
import { getVin } from '../utils/config';

export async function fetchHealthStatus() {
    const response = await api.get(`/vehicul/${getVin()}/health`);
    return response.data;
}

export async function fetchTrends(limit = 20) {
    const response = await api.get(`/vehicul/${getVin()}/tendinte`, { params: { limit } });
    return response.data;
}

export async function fetchFullStatus() {
    const [health, trends] = await Promise.allSettled([
        fetchHealthStatus(),
        fetchTrends(),
    ]);

    return {
        health: health.status === 'fulfilled' ? health.value : null,
        trends: trends.status === 'fulfilled' ? trends.value : null,
    };
}
