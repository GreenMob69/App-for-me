import React, { createContext, useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socket';
import { AppContext } from './AppContext';

export const LiveContext = createContext();

const RING_BUFFER_SIZE = 600;

export const LiveProvider = ({ children }) => {
    const [isConnected,    setIsConnected]    = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [liveData,       setLiveData]       = useState({});
    const { navigationRef, setTripReport } = useContext(AppContext);

    // Ring buffer: fixed-size array + write index, avoids array copy every second
    const bufferRef = useRef(new Array(RING_BUFFER_SIZE).fill(null));
    const writeIndexRef = useRef(0);
    const countRef = useRef(0);
    const [chartVersion, setChartVersion] = useState(0);

    // Lifecycle & throttling refs
    const appStateRef = useRef(AppState.currentState);
    const lastUiUpdateRef = useRef(0);
    const lastCacheSaveRef = useRef(0);
    const lastPacketTimeRef = useRef(Date.now());
    const wasSimOrMovingRef = useRef(false);

    // Cache offline la pornire (Stale-While-Revalidate)
    useEffect(() => {
        AsyncStorage.getItem('@cached_last_telemetry').then((cached) => {
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed && typeof parsed === 'object') {
                        setLiveData((prev) => (Object.keys(prev).length === 0 ? parsed : prev));
                    }
                } catch (_) {}
            }
        }).catch(() => {});
    }, []);

    // Monitorizare stare aplicatie (Background / Foreground / Waze)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            appStateRef.current = nextAppState;
        });
        return () => subscription?.remove?.();
    }, []);

    const getChartHistory = useCallback(() => {
        const buf = bufferRef.current;
        const count = countRef.current;
        if (count === 0) return [];
        if (count < RING_BUFFER_SIZE) {
            return buf.slice(0, count);
        }
        const start = writeIndexRef.current;
        return [...buf.slice(start), ...buf.slice(0, start)];
    }, []);

    const clearChartHistory = useCallback(() => {
        bufferRef.current = new Array(RING_BUFFER_SIZE).fill(null);
        writeIndexRef.current = 0;
        countRef.current = 0;
        setChartVersion(v => v + 1);
    }, []);

    useEffect(() => {
        const socket = socketService.connect();

        const onConnect    = () => { setIsConnected(true);  setIsReconnecting(false); };
        const onDisconnect = () => { setIsConnected(false); setIsReconnecting(true);  };
        const onReconnect  = () => { setIsConnected(true);  setIsReconnecting(false); };
        const onReconnectFailed = () => setIsReconnecting(false);

        const zeroizeLiveData = () => {
            setLiveData(prev => ({
                ...prev,
                stare_motor: 'OPRIRE',
                simulator_running: false,
                viteza_kmh: 0,
                rpm: 0,
                gear: 'P',
                sarcina_pct: 0,
                throttle: 0,
                boost_bar: 0,
                torque_nm: 0,
                consum_lh: 0,
                dinamica: { ...(prev?.dinamica || {}), viteza: 0, turatie: 0, acceleratie: 0, treapta_viteza: 'P' },
                motor: { ...(prev?.motor || {}), speed: 0, rpm: 0, load: 0, throttle_pos: 0, accel_g: 0, torque_actual: 0, treapta_viteza: 'P' },
                aer: { ...(prev?.aer || {}), boost_actual: 0, map: 101, maf: 0 },
                combustibil: { ...(prev?.combustibil || {}), inst_cons: 0, rail_press_bar: 0 },
                transmisie: { ...(prev?.transmisie || {}), gear: 'P', slip: 0 },
                accelerometru: { ...(prev?.accelerometru || {}), accel_x: 0, accel_y: 0, accel_z: 1.0 },
                virtual: {
                    ...(prev?.virtual || {}),
                    powerHp: 0,
                    saeCorrectedPowerHp: 0,
                    torqueNm: 0,
                    gForceLateral: 0,
                    gForceLongitudinal: 0,
                    brakeFluidTempC: 85,
                    roadGripStatus: 'NORMAL',
                    mountainBrakeFadeRisk: false,
                    dieselRunawayRisk: false,
                }
            }));
        };

        const onSimulatorStatus = (statusData) => {
            if (statusData && statusData.running === false) {
                wasSimOrMovingRef.current = false;
                zeroizeLiveData();
            }
        };

        const onTelemetrie = (data) => {
            lastPacketTimeRef.current = Date.now();
            const isStop = data?.stare_motor === 'OPRIRE' || data?.simulator_running === false;
            if (isStop) {
                wasSimOrMovingRef.current = false;
                zeroizeLiveData();
                return;
            }
            if (data?.stare_motor === 'MERS' || (data?.motor?.speed > 0 || data?.motor?.rpm > 500)) {
                wasSimOrMovingRef.current = true;
            }
            const now = Date.now();
            const isForeground = appStateRef.current === 'active';

            // Verificare flag-uri de avarie / pericol critic pentru șofer
            const v = data?.virtual || {};
            const isCriticalAlert = Boolean(
                v.roadGripStatus === 'BLACK_ICE_GRIP_LOSS_WARNING' ||
                v.roadGripStatus === 'HYDROPLANING_OR_WET_SLIP_WARNING' ||
                v.driverFatigueStatus === 'DRIVER_FATIGUE_TAKE_BREAK_ALERT' ||
                v.mountainBrakeFadeRisk ||
                v.dieselRunawayRisk ||
                v.headFatigueStatus === 'COLD_THERMAL_SHOCK_HEAD_RISK' ||
                v.cabinExhaustHazardAlert ||
                v.waterPumpHeadGasketStatus === 'WATER_PUMP_IMPELLER_OR_HEAD_GASKET_RISK' ||
                v.parasiticDrainStatus === 'PARASITIC_BATTERY_DRAIN_DETECTED' ||
                (data?.temperaturi?.coolant && data.temperaturi.coolant > 105) ||
                data?.eveniment_motor === 'AVARIE' ||
                data?.eveniment_motor === 'ACCIDENT'
            );

            // În background (ex: Waze activ), înghețăm randarea React la 1 cadru la 10s,
            // DAR dacă apare o alertă critică de viață, o lăsăm să treacă instant!
            if (isForeground || isCriticalAlert || (now - lastUiUpdateRef.current >= 10000)) {
                setLiveData(data);
                lastUiUpdateRef.current = now;
            }

            // Salvare cache local periodic (20 secunde)
            if (now - lastCacheSaveRef.current >= 20000) {
                lastCacheSaveRef.current = now;
                AsyncStorage.setItem('@cached_last_telemetry', JSON.stringify(data)).catch(() => {});
            }

            const idx = writeIndexRef.current;
            const totalCount = countRef.current;

            bufferRef.current[idx] = {
                secunda: totalCount,
                label: totalCount % 10 === 0 ? `${totalCount}s` : '',
                ...(data.motor || {}),
                ...(data.temperaturi || {}),
                ...(data.aer || {}),
                ...(data.combustibil || {}),
                ...(data.lambda || {}),
                ...(data.aprindere || {}),
                ...(data.emisii || {}),
                ...(data.baterie || {}),
                ...(data.dpf || {}),
                ...(data.vvt || {}),
                ...(data.transmisie || {}),
                ...(data.presiuni || {}),
                ...(data.virtual || {}),
            };

            writeIndexRef.current = (idx + 1) % RING_BUFFER_SIZE;
            countRef.current = totalCount + 1;
            if (isForeground) {
                setChartVersion(v => v + 1);
            }
        };

        const onStatusTrip = (data) => {
            if (data.status === 'STOP' && data.report) {
                setTripReport(data.report);
                clearChartHistory();
                if (navigationRef.current) {
                    navigationRef.current.navigate('TripReport', { report: data.report });
                }
            }
        };

        socket.on('connect',           onConnect);
        socket.on('disconnect',        onDisconnect);
        socket.on('reconnect',         onReconnect);
        socket.on('reconnect_failed',  onReconnectFailed);
        socket.on('telemetrie_live',   onTelemetrie);
        socket.on('status_trip',       onStatusTrip);
        socket.on('simulator_status',  onSimulatorStatus);

        // 4.5s Inactivity Watchdog to prevent freeze if packets stop abruptly
        const watchdogTimer = setInterval(() => {
            if (wasSimOrMovingRef.current && (Date.now() - lastPacketTimeRef.current >= 4500)) {
                wasSimOrMovingRef.current = false;
                zeroizeLiveData();
            }
        }, 1000);

        return () => {
            socket.off('connect',          onConnect);
            socket.off('disconnect',       onDisconnect);
            socket.off('reconnect',        onReconnect);
            socket.off('reconnect_failed', onReconnectFailed);
            socket.off('telemetrie_live',  onTelemetrie);
            socket.off('status_trip',      onStatusTrip);
            socket.off('simulator_status',  onSimulatorStatus);
            clearInterval(watchdogTimer);
        };
    }, []);

    const value = useMemo(() => ({
        isConnected,
        isReconnecting,
        liveData,
        chartVersion,
        getChartHistory,
        clearChartHistory,
    }), [isConnected, isReconnecting, liveData, chartVersion, getChartHistory, clearChartHistory]);

    return (
        <LiveContext.Provider value={value}>
            {children}
        </LiveContext.Provider>
    );
};

export const useLive = () => useContext(LiveContext) || {};
export default LiveContext;
