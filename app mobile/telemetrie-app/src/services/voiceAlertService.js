import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    ENABLED: '@voice_alert_enabled',
    MODE:    '@voice_alert_mode',     // 'ALL' | 'CRITICAL_ONLY' | 'OFF'
    HAPTICS: '@voice_alert_haptics',  // 'true' | 'false'
};

// Memorie cache în sesiune
let currentSettings = {
    enabled: true,
    mode: 'CRITICAL_ONLY', // Implicit recomandat pentru siguranță la volan
    haptics: true,
};

let isInitialized = false;
let currentVoiceLang = 'RO';

export const setVoiceLanguage = (lang) => {
    currentVoiceLang = lang || 'RO';
};
const lastSpokenMap = new Map();
const COOLDOWN_MS = 15000; // 15 secunde minim între repetarea aceleiași alerte

export const initVoiceAlertService = async () => {
    if (isInitialized) return currentSettings;
    try {
        const [savedEnabled, savedMode, savedHaptics] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.ENABLED),
            AsyncStorage.getItem(STORAGE_KEYS.MODE),
            AsyncStorage.getItem(STORAGE_KEYS.HAPTICS),
        ]);

        if (savedEnabled !== null) currentSettings.enabled = savedEnabled === 'true';
        if (savedMode !== null) currentSettings.mode = savedMode;
        if (savedHaptics !== null) currentSettings.haptics = savedHaptics === 'true';

        isInitialized = true;
    } catch (e) {
        console.warn('[VOICE_SERVICE] Eroare la încărcare setări vocale:', e.message);
    }
    return currentSettings;
};

export const getVoiceSettings = () => ({ ...currentSettings });

export const updateVoiceSettings = async (partial) => {
    currentSettings = { ...currentSettings, ...partial };
    try {
        if (partial.enabled !== undefined) {
            await AsyncStorage.setItem(STORAGE_KEYS.ENABLED, String(partial.enabled));
        }
        if (partial.mode !== undefined) {
            await AsyncStorage.setItem(STORAGE_KEYS.MODE, String(partial.mode));
        }
        if (partial.haptics !== undefined) {
            await AsyncStorage.setItem(STORAGE_KEYS.HAPTICS, String(partial.haptics));
        }
    } catch (e) {
        console.warn('[VOICE_SERVICE] Eroare la salvare setări vocale:', e.message);
    }
    return { ...currentSettings };
};

export const triggerHapticAlert = (priority = 'normal') => {
    if (!currentSettings.haptics) return;
    try {
        if (priority === 'critical') {
            if (Platform.OS === 'ios' && Haptics?.notificationAsync) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            } else {
                Vibration.vibrate([0, 250, 100, 250, 100, 400]);
            }
        } else if (priority === 'serious' || priority === 'warning') {
            if (Platform.OS === 'ios' && Haptics?.notificationAsync) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            } else {
                Vibration.vibrate([0, 200, 100, 200]);
            }
        } else {
            if (Platform.OS === 'ios' && Haptics?.impactAsync) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            } else {
                Vibration.vibrate(100);
            }
        }
    } catch (err) {
        // Fallback silențios dacă dispozitivul nu suportă vibrații
    }
};

/**
 * Rostește o alertă pe difuzorul dispozitivului cu filtrare de mod și debouncing
 * @param {string} rawText Textul sau avertizarea de rostit
 * @param {'critical' | 'serious' | 'warning' | 'info' | 'normal'} priority Nivelul de severitate
 * @param {string} alertKey Identificator unic pentru cooldown (ex: 'BLACK_ICE', 'RUNAWAY')
 */

const SPOKEN_TRANSLATIONS = {
    RO: {
        BLACK_ICE: 'Atenție! Risc de polei și pierdere aderență!',
        COOLANT: 'Atenție! Temperatura lichidului de răcire a depășit limita admisă!',
        BRAKE_FADE: 'Pericol! Risc de fierbere lichid frână și fading termic!',
        RUNAWAY: 'Pericol critic! Autoturare motor identificată!',
        CRASH: 'Alertă de urgență! Impact sever detectat!',
        BATTERY: 'Avertizare: tensiune scăzută pe circuitul electric!',
    },
    EN: {
        BLACK_ICE: 'Warning! Black ice risk and road grip loss detected!',
        COOLANT: 'Warning! Engine coolant temperature exceeds safe limit!',
        BRAKE_FADE: 'Danger! Brake fluid boiling hazard and thermal fade risk!',
        RUNAWAY: 'Critical hazard! Diesel engine runaway condition detected!',
        CRASH: 'Emergency alert! Severe vehicle collision detected!',
        BATTERY: 'Warning: low electrical system voltage detected!',
    },
    RU: {
        BLACK_ICE: 'Внимание! Опасность гололеда и потеря сцепления с трассой!',
        COOLANT: 'Внимание! Перегрев охлаждающей жидкости двигателя!',
        BRAKE_FADE: 'Опасность! Риск закипания тормозной жидкости и перегрев тормозов!',
        RUNAWAY: 'Критическая опасность! Зафиксирован разнос дизельного мотора!',
        CRASH: 'Экстренное предупреждение! Зафиксирован сильный удар или столкновение!',
        BATTERY: 'Внимание: низкое напряжение бортовой сети!',
    }
};

export const speakAlert = (rawText, priority = 'normal', alertKey = '', lang = null) => {
    if (!rawText) return;
    if (!currentSettings.enabled || currentSettings.mode === 'OFF') return;

    // Filtrare mod: dacă este 'CRITICAL_ONLY', acceptă doar alerte critice sau serioase
    const isCritical = priority === 'critical' || priority === 'serious';
    if (currentSettings.mode === 'CRITICAL_ONLY' && !isCritical) {
        return;
    }

    // Cooldown anti-spam pe aceeași alertă
    const key = alertKey || rawText.slice(0, 30);
    const now = Date.now();
    const lastSpoken = lastSpokenMap.get(key) || 0;
    if (now - lastSpoken < COOLDOWN_MS) {
        return;
    }
    lastSpokenMap.set(key, now);

    // Curățare caractere emoji sau formatări din text pentru citire naturală
    const cleanText = rawText
        .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // elimină emoji
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanText) return;

    // Declanșează vibrație corelată
    triggerHapticAlert(priority);

    try {
        Speech.stop(); // Oprește vorbirea anterioară dacă era în curs
        const activeLang = lang || currentVoiceLang || 'RO';
        const ttsLocale = activeLang === 'RU' ? 'ru-RU' : activeLang === 'EN' ? 'en-US' : 'ro-RO';
        const localizedText = (key && SPOKEN_TRANSLATIONS[activeLang]?.[key]) || cleanText;

        Speech.speak(localizedText, {
            language: ttsLocale,
            pitch: 1.05,
            rate: 0.95,
            onDone: () => {},
            onError: (err) => {
                console.warn('[VOICE_SERVICE] Speech error:', err);
            }
        });
    } catch (err) {
        console.warn('[VOICE_SERVICE] Eroare la apel Speech.speak:', err.message);
    }
};

export const stopSpeech = () => {
    try {
        Speech.stop();
    } catch {}
};

export const testVoiceAlert = (mode = 'CRITICAL') => {
    triggerHapticAlert('critical');
    const sample = mode === 'CRITICAL'
        ? 'Atenție! Test sistem avertizare critică. Risc pierdere aderență pe carosabil.'
        : 'Sistemul de sinteză vocală funcționează la parametrii optimi.';
    try {
        Speech.stop();
        Speech.speak(sample, { language: 'ro-RO', pitch: 1.05, rate: 0.95 });
    } catch (err) {
        console.warn('[VOICE_SERVICE] Test speech error:', err.message);
    }
};

// Auto-inițializare la import
initVoiceAlertService();
