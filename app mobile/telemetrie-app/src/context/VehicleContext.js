import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { setVin, setVehicleLabel, setFuelType } from '../utils/config';

const VehicleContext = createContext(null);

export const VehicleProvider = ({ children }) => {
    const [activeVin,     setActiveVin]         = useState(null);
    const [activeVehicle, setActiveVehicleState] = useState(null);
    const [vehicles,      setVehicles]           = useState([]);
    const [vehicleLabel,  setVehicleLabelState]  = useState('');
    const [fuelType,      setFuelTypeState]      = useState('DIESEL');
    const [ready,         setReady]              = useState(false);

    const applyVehicle = useCallback((vin, list) => {
        const v = list.find(r => r.vin === vin) || list[0] || null;
        if (!v) return;
        setActiveVehicleState(v);
        const parts = [v.model, v.variant, v.year ? String(v.year) : null].filter(Boolean);
        const label = parts.join(' · ') || v.vin || vin || '';
        setVehicleLabelState(label);
        setVehicleLabel(label);
        if (v.tip_combustibil) {
            const ft = v.tip_combustibil.toUpperCase();
            setFuelTypeState(ft);
            setFuelType(ft);
        }
    }, []);

    const loadVehicles = useCallback(async (vin) => {
        try {
            const res = await api.get('/vehicule/list', { timeout: 6000 });
            if (Array.isArray(res.data) && res.data.length > 0) {
                setVehicles(res.data);
                applyVehicle(vin, res.data);
            }
        } catch {}
    }, [applyVehicle]);

    useEffect(() => {
        const init = async () => {
            try {
                const stored = await AsyncStorage.getItem('@active_vin');
                if (stored) {
                    setActiveVin(stored);
                    setVin(stored);
                    await loadVehicles(stored);
                }
            } catch {}
            setReady(true);
        };
        init();
    }, [loadVehicles]);

    const switchVehicle = useCallback(async (vin) => {
        if (!vin || vin === activeVin) return;
        setActiveVin(vin);
        setVin(vin);
        await AsyncStorage.setItem('@active_vin', vin);
        const found = vehicles.find(v => v.vin === vin);
        if (found?.id) await AsyncStorage.setItem('@vehicle_id', String(found.id));
        await loadVehicles(vin);
    }, [activeVin, vehicles, loadVehicles]);

    const refreshVehicles = useCallback(async () => {
        if (activeVin) await loadVehicles(activeVin);
    }, [activeVin, loadVehicles]);

    return (
        <VehicleContext.Provider value={{
            activeVin,
            activeVehicle,
            vehicles,
            vehicleLabel,
            fuelType,
            ready,
            switchVehicle,
            refreshVehicles,
        }}>
            {children}
        </VehicleContext.Provider>
    );
};

export const useVehicle = () => useContext(VehicleContext);
export default VehicleContext;
