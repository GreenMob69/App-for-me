import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import api from './api';
import { getVin, getActiveServerUrl } from '../utils/config';

// ─── Vehicle Profile helpers ──────────────────────────────────────────────────

async function getVehicleId() {
    const id = await AsyncStorage.getItem('@vehicle_id');
    if (!id) throw new Error('Vehicle ID not found. Complete onboarding first.');
    return id;
}

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

// ─── Vehicle Profile API ──────────────────────────────────────────────────────

export async function fetchProfileSummary() {
    const vehicleId = await getVehicleId();
    const response = await api.get(`/vehicles/${vehicleId}/profile-summary`);
    return response.data;
}

export async function fetchCostDashboard(year) {
    const vehicleId = await getVehicleId();
    const response = await api.get(`/vehicles/${vehicleId}/costs`, { params: { year } });
    return response.data;
}

export async function fetchVehicleSummary() {
    const vehicleId = await getVehicleId();
    const response  = await api.get(`/vehicles/${vehicleId}/summary`);
    return response.data;
}

export async function exportPDFReport() {
    const vehicleId = await getVehicleId();
    const url = `${getActiveServerUrl()}/api/vehicles/${vehicleId}/report/pdf`;
    await Linking.openURL(url);
    return url;
}

export async function fetchDocuments() {
    const vehicleId = await getVehicleId();
    const response = await api.get(`/vehicles/${vehicleId}/documents`);
    return response.data;
}

export async function fetchMaintenanceData() {
    const currentYear = new Date().getFullYear();
    const [profile, costs, health] = await Promise.allSettled([
        fetchProfileSummary(),
        fetchCostDashboard(currentYear),
        fetchHealthStatus(),
    ]);
    return {
        profile: profile.status === 'fulfilled' ? profile.value : null,
        costs:   costs.status === 'fulfilled'   ? costs.value   : null,
        health:  health.status === 'fulfilled'  ? health.value  : null,
    };
}
