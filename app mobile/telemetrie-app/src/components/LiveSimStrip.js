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

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function LiveSimStrip() {
    const {
        openSimulatorModal,
        appLang,
        isAutoPilotActive,
        toggleAutoPilot,
        stopAutoPilot,
        autoPilotData,
        openMechanicGuide,
    } = useContext(AppContext) || {};

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
            // Offline
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
        if (!simStatus.running && !isAutoPilotActive) return;
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
    }, [simStatus.running, isAutoPilotActive]);

    const handleStop = async () => {
        hapticTap();
        setStopping(true);
        try {
            if (isAutoPilotActive && stopAutoPilot) {
                await stopAutoPilot();
            } else {
                await api.post('/simulator/stop');
            }
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

    const handleToggleAutoPilot = () => {
        hapticTap();
        if (toggleAutoPilot) toggleAutoPilot();
    };

    const handleOpenGuide = () => {
        hapticTap();
        if (autoPilotData?.mechanicGuideId && openMechanicGuide) {
            openMechanicGuide(autoPilotData.mechanicGuideId);
        }
    };

    if (!simStatus.running && !isAutoPilotActive) return null;

    // ── VIZUALIZARE DEDICATĂ CÂND ESTE ACTIV MODUL AUTO-PILOT SHOWCASE ──────
    if (isAutoPilotActive) {
        const apTitle = isEn ? autoPilotData?.titleEn : autoPilotData?.titleRo;
        const apNarrative = isEn ? autoPilotData?.narrativeEn : autoPilotData?.narrativeRo;

        return (
            <View style={styles.container}>
                <View style={[styles.inner, styles.innerAutoPilot]}>
                    {/* Top Row: Auto-Pilot Status & Action buttons */}
                    <View style={styles.autoPilotTopRow}>
                        <View style={styles.autoPilotTagWrap}>
                            <Animated.View style={[styles.pulseDot, styles.pulseDotAuto, { opacity: pulseAnim }]} />
                            <Text style={styles.autoPilotBadgeText}>
                                🤖 AUTO-PILOT ({autoPilotData?.secondsRemaining}s)
                            </Text>
                            <Text style={styles.stepCounterText}>
                                [{((autoPilotData?.stepIndex || 0) + 1)}/5]
                            </Text>
                        </View>

                        <View style={styles.actionGroup}>
                            {autoPilotData?.mechanicGuideId && (
                                <TouchableOpacity
                                    style={styles.guideQuickBtn}
                                    activeOpacity={0.7}
                                    onPress={handleOpenGuide}
                                >
                                    <Text style={styles.guideQuickBtnText}>
                                        {isEn ? '🔧 GUIDE' : '🔧 GHID'}
                                    </Text>
                                </TouchableOpacity>
                            )}

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

                    {/* Middle Row: Title & Anomaly description */}
                    <Text style={styles.autoPilotTitle} numberOfLines={1}>
                        {apTitle}
                    </Text>
                    <Text style={styles.autoPilotNarrative} numberOfLines={2}>
                        {apNarrative}
                    </Text>

                    {/* Bottom Telemetry Ticker */}
                    <View style={styles.autoPilotTelemetryBar}>
                        <Text style={styles.metricText}>
                            <Text style={styles.highlightVal}>{telemetry.speed}</Text> KM/H  ·  
                            <Text style={styles.highlightVal}> {telemetry.rpm}</Text> RPM  ·  
                            <Text style={styles.highlightVal}> {telemetry.gear}</Text>  ·  
                            <Text style={styles.subtleVal}>{telemetry.boost} bar</Text>
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    // ── VIZUALIZARE STANDARD SIMULARE LIVE CU BUTON AUTO-PILOT ───────────────
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
                    {/* Buton Prominent 🤖 AUTO-PILOT */}
                    <TouchableOpacity
                        style={styles.autoPilotBtn}
                        activeOpacity={0.7}
                        onPress={handleToggleAutoPilot}
                    >
                        <Text style={styles.autoPilotBtnText}>
                            🤖 AUTO
                        </Text>
                    </TouchableOpacity>

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
        left: 10,
        right: 10,
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
    innerAutoPilot: {
        flexDirection: 'column',
        alignItems: 'stretch',
        backgroundColor: '#0D1424FC',
        borderColor: '#B026FF88',
        shadowColor: '#B026FF',
        shadowRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        gap: 4,
    },
    autoPilotTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    autoPilotTagWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    autoPilotBadgeText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#D8B4FE',
        letterSpacing: 0.8,
    },
    stepCounterText: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#A855F7',
        fontWeight: '700',
    },
    autoPilotTitle: {
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.4,
    },
    autoPilotNarrative: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#CBD5E1',
        lineHeight: 14,
        marginTop: 1,
    },
    autoPilotTelemetryBar: {
        marginTop: 3,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
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
    pulseDotAuto: {
        backgroundColor: '#B026FF',
        shadowColor: '#B026FF',
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
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#00FF66',
        letterSpacing: 0.8,
    },
    scenarioBadge: {
        fontFamily: MONO,
        fontSize: 9,
        color: '#00F0FF',
        backgroundColor: '#00F0FF18',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
        overflow: 'hidden',
    },
    metricText: {
        fontFamily: MONO,
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
    autoPilotBtn: {
        backgroundColor: '#B026FF24',
        borderWidth: 1,
        borderColor: '#B026FFAA',
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 7,
    },
    autoPilotBtnText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#D8B4FE',
    },
    guideQuickBtn: {
        backgroundColor: '#FFB80020',
        borderWidth: 1,
        borderColor: '#FFB80099',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 7,
    },
    guideQuickBtnText: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#FFB800',
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
        fontFamily: MONO,
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
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '800',
        color: '#FF4D4D',
    },
});
