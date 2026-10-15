import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import socketService from '../services/socket';

/**
 * Apelează `callback` automat când:
 *   1. aplicația revine în prim-plan după ce a fost în background/inactivă
 *   2. socket-ul se reconectează la server după o pierdere de conexiune
 *
 * Nu se apelează la mount-ul inițial — doar la tranziții ulterioare.
 */
export function useRefreshOnOnline(callback) {
    const callbackRef = useRef(callback);

    // Păstrează referința callback-ului la zi fără a re-rula efectul
    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        let prevState = AppState.currentState;

        const appStateSub = AppState.addEventListener('change', (nextState) => {
            const wasBackground = prevState === 'background' || prevState === 'inactive';
            if (wasBackground && nextState === 'active') {
                callbackRef.current?.();
            }
            prevState = nextState;
        });

        // Socket-ul e creat de LiveContext înainte ca orice screen să mounteze,
        // deci socketService.socket există deja la primul useEffect al screen-ului.
        const socket = socketService.socket;
        const handleConnect = () => callbackRef.current?.();
        socket?.on('connect', handleConnect);

        return () => {
            appStateSub.remove();
            socket?.off('connect', handleConnect);
        };
    }, []);
}
