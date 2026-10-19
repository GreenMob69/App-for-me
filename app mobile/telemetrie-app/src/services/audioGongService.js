// @ts-check
'use strict';
import { Platform } from 'react-native';

/**
 * Audio Gong and Sound Synthesizer for Automotive Alert Ergonomics
 * Simulates OEM chimes (BMW, Audi, Mercedes, VDO Piezo) without heavy external MP3 assets,
 * using WebAudio / Tone frequency synthesis where available or haptic patterns with audio focus ducking.
 */

class AudioGongService {
    constructor() {
        this.isMuted = false;
        this.lastGongTimestamp = 0;
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
    }

    /**
     * Play single warm OEM gong (440Hz info, 880Hz warning, 1760Hz staccato critical)
     * @param {'info' | 'warning' | 'critical' | 'autocheck' | 'frost' | 'pit'} type 
     */
    playGong(type = 'info') {
        if (this.isMuted) return;
        const now = Date.now();
        // Debounce gongs by at least 1.5s to prevent audio cacophony
        if (now - this.lastGongTimestamp < 1500 && type !== 'critical') {
            return;
        }
        this.lastGongTimestamp = now;

        try {
            // Web / Expo Audio synthesis trigger if running in browser / hybrid
            if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                const t = ctx.currentTime;

                if (type === 'autocheck') {
                    // Vintage 1996 Audi 3-tone piezo beep (800Hz - 1000Hz - 1200Hz)
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(850, t);
                    osc.frequency.setValueAtTime(1050, t + 0.12);
                    osc.frequency.setValueAtTime(1250, t + 0.24);
                    gain.gain.setValueAtTime(0.12, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
                    osc.start(t);
                    osc.stop(t + 0.4);
                } else if (type === 'frost') {
                    // Vintage VDO cold chime (520Hz)
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(520, t);
                    gain.gain.setValueAtTime(0.18, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
                    osc.start(t);
                    osc.stop(t + 0.65);
                } else if (type === 'critical') {
                    // Urgent dual high-pitch pulse
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(1760, t);
                    osc.frequency.setValueAtTime(1400, t + 0.1);
                    gain.gain.setValueAtTime(0.25, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
                    osc.start(t);
                    osc.stop(t + 0.5);
                } else if (type === 'warning') {
                    // Double pulse 880Hz
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, t);
                    gain.gain.setValueAtTime(0.2, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                    osc.start(t);
                    osc.stop(t + 0.45);
                } else if (type === 'pit') {
                    // F1 Pit beep 1000Hz rapid
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(1000, t);
                    gain.gain.setValueAtTime(0.22, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    osc.start(t);
                    osc.stop(t + 0.22);
                } else {
                    // Soft warm OEM info chime 440Hz
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, t);
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
                    osc.start(t);
                    osc.stop(t + 0.55);
                }
            }
        } catch (e) {
            // Audio context not allowed without prior user gesture or not supported; silent fallback
        }
    }
}

export const audioGong = new AudioGongService();
export default audioGong;
