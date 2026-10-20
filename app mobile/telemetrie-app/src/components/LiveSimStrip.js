import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Platform,
} from 'react-native';
import api from '../services/api';
import { AppContext } from '../context/AppContext';
import { useNormalizedTelemetry } from '../hooks/useNormalizedTelemetry';
import { hapticTap } from '../services/hapticFeedback';

const SCENARIO_NAMES = {
    normal: 'Croazieră Optimă',
    fault_turbo: 'Boost Leak (Turbină)',
    mountain_brakes: 'Coborâre Munte (Frâne)',
    black_ice: 'Polei (Black Ice)',
    dpf_regen: 'Regenerare DPF',
    diesel_runaway: 'Pericol Runaway',
    worn_injectors: 'Injectoare Uzate',
};

export default function LiveSimStrip() {
    const { openSimulatorModal, appLang } = useContext(AppContext) || {};
    const telemetry = useNormalizedTelemetry();
    const [simStatus, setSimStatus] = useState({ running: false, scenario: 'idle', elapsedSec: 0 });
    const [stopping, setStopping] = useState(false);
    const pulseAnim = useRef(new Animated.Value(0.4)).current;
    const pollIntervalRef = useRef(null);

    const isEn = appLang === 'EN';

    const checkSimulator = async () => {
        try {
            const res = await api.get('/simulator/status', { timeout: 2500 });
            if (res.data) {
                setSimStatus({
                    running: Boolean(res.data.running),
                    scenario: res.data.scenario || 'idle',
                    elapsedSec: res.data.elapsedSec || 0,
                });
            }
        } catch (_) {
            // Offline or server not responding
        }
    };

    useEffect(() => {
        checkSimulator();
        pollIntervalRef.current = setInterval(checkSimulator, 3000);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    // Pulsing LED effect
    useEffect(() => {
        if (!simStatus.running) return;
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.0,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.3,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [simStatus.running]);

    const handleStop = async () => {
        hapticTap();
        setStopping(true);
        try {
            await api.post('/simulator/stop');
            setSimStatus(prev => ({ ...prev, running: false }));
        } catch (err) {
            console.warn('[SIM STRIP STOP ERROR]', err?.message);
        } finally {
            setStopping(false);
        }
    };

    const handleOpenModal = () => {
        hapticTap();
        if (openSimulatorModal) openSimulatorModal();
    };

    if (!simStatus.running) return null;

    const scenarioLabel = SCENARIO_NAMES[simStatus.scenario] || simStatus.scenario.toUpperCase();

    return (
        <View style={styles.container}>
            <View style={styles.inner}>
                {/* Left: Pulsing Status Dot & Speed/RPM */}
                <TouchableOpacity
                    style={styles.telemetryGroup}
                    activeOpacity={0.7}
                    onPress={handleOpenModal}
                >
                    <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
                    <View style={styles.textWrap}>
                        <View style={styles.titleRow}>
                            <Text style={styles.titleText}>
                                {isEn ? 'LIVE SIMULATION' : 'SIMULARE LIVE'}
                            </Text>
                            <Text style={styles.scenarioBadge}>
                                {scenarioLabel}
                            </Text>
                        </View>
                        <Text style={styles.metricText}>
                            <Text style={styles.highlightVal}>{telemetry.speed}</Text> KM/H  ·  
                            <Text style={styles.highlightVal}> {telemetry.rpm}</Text> RPM  ·  
                            <Text style={styles.highlightVal}> {telemetry.gear}</Text>  ·  
                            <Text style={styles.subtleVal}>{telemetry.boost} bar</Text>
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Right: Quick Action Buttons */}
                <View style={styles.actionGroup}>
                    <TouchableOpacity
                        style={styles.changeBtn}
                        activeOpacity={0.7}
                        onPress={handleOpenModal}
                    >
                        <Text style={styles.changeBtnText}>
                            {isEn ? 'SCENARIO' : 'SCENARIU'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.stopBtn, stopping && styles.stopBtnDisabled]}
                        activeOpacity={0.7}
                        disabled={stopping}
                        onPress={handleStop}
                    >
                        <Text style={styles.stopBtnText}>
                            {stopping ? '...' : (isEn ? 'STOP' : 'OPREȘTE')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 44 : 28,
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 10,
    },
    inner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0A101DFA',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#00F0FF44',
        paddingVertical: 7,
        paddingHorizontal: 10,
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    telemetryGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00FF66',
        marginRight: 8,
        shadowColor: '#00FF66',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
    },
    textWrap: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    titleText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 10,
        fontWeight: '900',
        color: '#00FF66',
        letterSpacing: 0.8,
    },
    scenarioBadge: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 9,
        color: '#00F0FF',
        backgroundColor: '#00F0FF18',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        overflow: 'hidden',
    },
    metricText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 11,
        color: '#8E9BAE',
        marginTop: 1,
        fontWeight: '600',
    },
    highlightVal: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    subtleVal: {
        color: '#FFB800',
        fontWeight: '700',
    },
    actionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    changeBtn: {
        backgroundColor: '#162235',
        borderWidth: 1,
        borderColor: '#00F0FF55',
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 8,
    },
    changeBtnText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 10,
        fontWeight: '800',
        color: '#00F0FF',
    },
    stopBtn: {
        backgroundColor: '#FF2A2A22',
        borderWidth: 1,
        borderColor: '#FF2A2A88',
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 8,
    },
    stopBtnDisabled: {
        opacity: 0.5,
    },
    stopBtnText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 10,
        fontWeight: '800',
        color: '#FF4D4D',
    },
});
