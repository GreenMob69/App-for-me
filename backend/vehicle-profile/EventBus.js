/**
 * EventBus — Mecanism simplu de Domain Events
 *
 * Publish/Subscribe in-process. Fără dependențe externe.
 * Fiecare modul poate:
 *   - emit(eventType, payload) — publică un eveniment
 *   - on(eventType, handler) — se abonează la un tip de eveniment
 *   - on('*', handler) — se abonează la TOATE evenimentele
 *
 * Evenimentele sunt sincrone (handlerii se execută imediat).
 * Timeline listener-ul persistă fiecare eveniment în DB.
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.wildcardListeners = [];
    }

    on(eventType, handler) {
        if (eventType === '*') {
            this.wildcardListeners.push(handler);
            return;
        }
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(handler);
    }

    off(eventType, handler) {
        if (eventType === '*') {
            this.wildcardListeners = this.wildcardListeners.filter(h => h !== handler);
            return;
        }
        if (!this.listeners.has(eventType)) return;
        const handlers = this.listeners.get(eventType).filter(h => h !== handler);
        this.listeners.set(eventType, handlers);
    }

    emit(eventType, payload) {
        const event = {
            type: eventType,
            timestamp: Math.floor(Date.now() / 1000),
            ...payload,
        };

        // Specific listeners
        const handlers = this.listeners.get(eventType) || [];
        handlers.forEach(handler => {
            try { handler(event); } catch (err) {
                console.error(`[EVENT BUS] Error in handler for ${eventType}:`, err.message);
            }
        });

        // Wildcard listeners
        this.wildcardListeners.forEach(handler => {
            try { handler(event); } catch (err) {
                console.error(`[EVENT BUS] Error in wildcard handler:`, err.message);
            }
        });
    }
}

// Singleton — toate modulele partajeaza aceeasi instanta
const vehicleEventBus = new EventBus();

module.exports = { vehicleEventBus, EventBus };
