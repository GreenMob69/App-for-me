import { io } from 'socket.io-client';
import { getActiveServerUrl } from '../utils/config';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        if (!this.socket) {
            const url = getActiveServerUrl();
            console.log(`[MOBIL -> WS] Conectare la: ${url}`);

            this.socket = io(url, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10
            });

            this.socket.on('connect', () => {
                console.log('[MOBIL -> WS] Conectat.');
            });

            this.socket.on('disconnect', () => {
                console.log('[MOBIL -> WS] Deconectat.');
            });
        }
        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

export default new SocketService();