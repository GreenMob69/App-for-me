import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import socketService from '../services/socket';
import { AppContext } from './AppContext';

export const LiveContext = createContext();

const RING_BUFFER_SIZE = 600;

export const LiveProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [liveData, setLiveData] = useState({});
    const { navigationRef, setTripReport } = useContext(AppContext);

    // Ring buffer: fixed-size array + write index, avoids array copy every second
    const bufferRef = useRef(new Array(RING_BUFFER_SIZE).fill(null));
    const writeIndexRef = useRef(0);
    const countRef = useRef(0);
    const [chartVersion, setChartVersion] = useState(0);

    const getChartHistory = () => {
        const buf = bufferRef.current;
        const count = countRef.current;
        if (count === 0) return [];
        if (count < RING_BUFFER_SIZE) {
            return buf.slice(0, count);
        }
        const start = writeIndexRef.current;
        return [...buf.slice(start), ...buf.slice(0, start)];
    };

    const clearChartHistory = () => {
        bufferRef.current = new Array(RING_BUFFER_SIZE).fill(null);
        writeIndexRef.current = 0;
        countRef.current = 0;
        setChartVersion(v => v + 1);
    };

    useEffect(() => {
        const socket = socketService.connect();

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        const onTelemetrie = (data) => {
            setLiveData(data);

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
            };

            writeIndexRef.current = (idx + 1) % RING_BUFFER_SIZE;
            countRef.current = totalCount + 1;
            setChartVersion(v => v + 1);
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

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('telemetrie_live', onTelemetrie);
        socket.on('status_trip', onStatusTrip);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('telemetrie_live', onTelemetrie);
            socket.off('status_trip', onStatusTrip);
        };
    }, []);

    return (
        <LiveContext.Provider value={{
            isConnected,
            liveData,
            chartVersion,
            getChartHistory,
        }}>
            {children}
        </LiveContext.Provider>
    );
};
