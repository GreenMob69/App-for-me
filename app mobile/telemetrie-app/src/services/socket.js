import { io } from 'socket.io-client';
import { SERVER_URL } from '../utils/config'; // <- Importăm adresa auto-detectată!

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        if (!this.socket) {
            console.log(`[MOBIL -> WS] Încerc conectarea la: ${SERVER_URL}`);
            
            this.socket = io(SERVER_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 10
            });

            this.socket.on('connect', () => {
                console.log('[MOBIL -> WS] CONECTAT CU SUCCES la server!');
            });
            
            this.socket.on('disconnect', () => {
                console.log('[MOBIL -> WS] Deconectat de la server.');
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