import React, { useState, useEffect, useRef, useContext } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import api from '../services/api';
import { AppContext } from '../context/AppContext';
import { hapticTap, hapticCriticalWarning } from '../services/hapticFeedback';
import { colors, typography, spacing, radii } from '../theme';

const SCENARIOS = [
    {
        id: 'normal',
        title: '🟢 Croazieră Normală (100% Optim)',
        desc: 'Motor cald, 88 km/h, 2100 RPM, boost 1.15 bar, eficiență optimă TDI.',
        accent: '#00FF66',
        isEmergency: false,
    },
    {
        id: 'fault_turbo',
        title: '🌪️ Furtun Intercooler Fisurat (Boost Leak)',
        desc: 'Presiunea MAP scade sub comandă. Activează codul P0299 Underboost.',
        accent: '#FFB800',
        isEmergency: false,
    },
    {
        id: 'mountain_brakes',
        title: '⛰️ Coborâre Munte & Fierbere Frâne',
        desc: 'Pantă -7.5%, frânare repetată, discuri la 380°C, fierbere lichid de frână.',
        accent: '#FF8800',
        isEmergency: true,
    },
    {
        id: 'black_ice',
        title: '❄️ Polei pe Carosabil (Black Ice Slip)',
        desc: 'Pierdere aderență la 68 km/h, derapaj lateral și patinare roți motrice.',
        accent: '#00F0FF',
        isEmergency: true,
    },
    {
        id: 'dpf_regen',
        title: '🔥 Regenerare Activă DPF (625°C)',
        desc: 'Post-injecție activată, temperatură evacuare 625°C, ardere particule.',
        accent: '#FF4422',
        isEmergency: false,
    },
    {
        id: 'diesel_runaway',
        title: '🚨 Urgență: Autoturare Diesel pe Ulei',
        desc: 'Turație urcă necontrolat la 5000+ RPM. Declanșează protocolul de calare.',
        accent: '#FF2A2A',
        isEmergency: true,
    },
    {
        id: 'worn_injectors',
        title: '🛢️ Injectoare Colmatate & Dezechilibru',
        desc: 'Dezechilibru debit cilindru 1, ralanti instabil, cod P0263.',
        accent: '#B026FF',
        isEmergency: false,
    },
];

export default function CloudSimulatorModal({ visible, onClose }) {
    const [running, setRunning] = useState(false);
    const [currentScenario, setCurrentScenario] = useState('idle');
    const [elapsedSec, setElapsedSec] = useState(0);
    const [durationSec, setDurationSec] = useState(180);
    const [loading, setLoading] = useState(false);
    const pollRef = useRef(null);
    const { isAutoPilotActive, toggleAutoPilot, autoPilotData } = useContext(AppContext) || {};

    const checkStatus = async () => {
        try {
            const res = await api.get('/simulator/status', { timeout: 3000 });
            if (res.data) {
                setRunning(res.data.running);
                setCurrentScenario(res.data.scenario);
                setElapsedSec(res.data.elapsedSec || 0);
                if (res.data.durationSec) setDurationSec(res.data.durationSec);
            }
        } catch (_) {}
    };

    useEffect(() => {
        if (visible) {
            checkStatus();
            pollRef.current = setInterval(checkStatus, 1500);
        } else {
            if (pollRef.current) clearInterval(pollRef.current);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [visible]);

    const handleStart = async (scenario) => {
        if (scenario.isEmergency) {
            hapticCriticalWarning();
        } else {
            hapticTap();
        }
        setLoading(true);
        try {
            const res = await api.post('/simulator/start', {
                scenario: scenario.id,
                durationSec: 180,
            });
            if (res.data?.success) {
                setRunning(true);
                setCurrentScenario(scenario.id);
                setElapsedSec(0);
            }
        } catch (err) {
            Alert.alert('Eroare Conexiune', 'Serverul nu a răspuns la comanda de pornire a simulării.');
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        hapticTap();
        setLoading(true);
        try {
            await api.post('/simulator/stop');
            setRunning(false);
            setCurrentScenario('idle');
            setElapsedSec(0);
            Alert.alert('Simulare Încheiată', 'Contactul a fost oprit. Cursa a fost finalizată și salvată în baza de date SQLite.');
        } catch (err) {
            Alert.alert('Eroare', 'Nu s-a putut opri simularea.');
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    const progressPct = Math.min(Math.round((elapsedSec / durationSec) * 100), 100);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalBox}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.superTitle}>TELECOMANDĂ LIVE // SERVER CLOUD</Text>
                            <Text style={styles.mainTitle}>Generator Scenarii & Fizică</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => {
                                hapticTap();
                                onClose();
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Status Bar */}
                    <View style={[styles.statusBar, running ? styles.statusRunning : styles.statusIdle]}>
                        <View style={styles.statusDotRow}>
                            <View style={[styles.dot, { backgroundColor: running ? '#00FF66' : '#FFB800' }]} />
                            <Text style={styles.statusLabel}>
                                {running ? `SIMULARE ACTIVĂ: ${currentScenario.toUpperCase()}` : 'SIMULATOR OPRIT // AȘTEPTARE COMANDĂ'}
                            </Text>
                        </View>
                        {running && (
                            <Text style={styles.timerText}>
                                {elapsedSec}s / {durationSec}s ({progressPct}%)
                            </Text>
                        )}
                    </View>

                    {/* Progress Track */}
                    {running && (
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                        </View>
                    )}

                    <Text style={styles.introDesc}>
                        Apasă pe oricare dintre scenariile de mai jos pentru a genera telemetrie live la 1 Hz direct pe server. Poți observa reacția fizică pe oricare dintre cele 5 stiluri de bord:
                    </Text>

                    {/* AUTO-PILOT SHOWCASE HERO CARD */}
                    <TouchableOpacity
                        style={[
                            styles.autoPilotHeroCard,
                            isAutoPilotActive && styles.autoPilotHeroCardActive,
                        ]}
                        onPress={() => {
                            hapticTap();
                            toggleAutoPilot?.();
                        }}
                        activeOpacity={0.8}
                    >
                        <View style={styles.autoPilotHeroHeader}>
                            <Text style={styles.autoPilotHeroBadge}>
                                {isAutoPilotActive ? `🤖 AUTO-PILOT ACTIV (${autoPilotData?.secondsRemaining}s)` : '🤖 MOD AUTO-PILOT SHOWCASE'}
                            </Text>
                            <View style={[styles.autoPilotStatusDot, isAutoPilotActive && styles.autoPilotStatusDotActive]} />
                        </View>
                        <Text style={styles.autoPilotHeroTitle}>
                            {isAutoPilotActive ? 'Demonstrație Activă (Regie Automată)' : 'Demonstrație 100% Autonomă (Zero-Touch)'}
                        </Text>
                        <Text style={styles.autoPilotHeroDesc}>
                            Comută automat la fiecare 15 secunde prin scenariile cheie, orientează camera 3D și evidențiază anomaliile fără să atingi ecranul.
                        </Text>
                    </TouchableOpacity>

                    {/* List of Scenarios */}
                    <ScrollView
                        style={styles.scrollList}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {SCENARIOS.map((sc) => {
                            const isCurrent = running && currentScenario === sc.id;
                            return (
                                <TouchableOpacity
                                    key={sc.id}
                                    style={[
                                        styles.scenarioCard,
                                        { borderColor: isCurrent ? sc.accent : '#1A2333' },
                                        isCurrent && { backgroundColor: `${sc.accent}15` },
                                    ]}
                                    onPress={() => handleStart(sc)}
                                    activeOpacity={0.75}
                                    disabled={loading}
                                >
                                    <View style={styles.cardHeader}>
                                        <Text style={[styles.cardTitle, isCurrent && { color: sc.accent }]}>
                                            {sc.title}
                                        </Text>
                                        {isCurrent && (
                                            <View style={[styles.activePill, { backgroundColor: sc.accent }]}>
                                                <Text style={styles.activePillText}>ACTIV</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.cardDesc}>{sc.desc}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Bottom Action Footer */}
                    <View style={styles.footer}>
                        {running ? (
                            <TouchableOpacity
                                style={styles.stopBtn}
                                onPress={handleStop}
                                activeOpacity={0.8}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.stopBtnText}>⏹️ OPREȘTE CONTACTUL & SALVEAZĂ CURSA</Text>
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.closeDoneBtn}
                                onPress={() => {
                                    hapticTap();
                                    onClose();
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.closeDoneBtnText}>ÎNCHIDE TELECOMANDA</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[3],
    },
    modalBox: {
        width: '100%',
        maxHeight: '92%',
        backgroundColor: '#070A10',
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: '#182438',
        padding: spacing[4],
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
    },
    superTitle: {
        color: '#00F0FF',
        fontSize: 10,
        fontWeight: typography.weights.bold,
        letterSpacing: 1.5,
    },
    mainTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.3,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#121A28',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#22324D',
    },
    closeBtnText: {
        color: '#8A99B5',
        fontSize: 13,
        fontWeight: 'bold',
    },
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radii.sm,
        borderWidth: 1,
        marginBottom: 4,
    },
    statusRunning: {
        backgroundColor: '#00FF6615',
        borderColor: '#00FF6655',
    },
    statusIdle: {
        backgroundColor: '#FFB80012',
        borderColor: '#FFB80044',
    },
    statusDotRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        marginRight: 8,
    },
    statusLabel: {
        color: '#E2E8F0',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    timerText: {
        color: '#00FF66',
        fontSize: 10,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    progressTrack: {
        width: '100%',
        height: 3,
        backgroundColor: '#101726',
        borderRadius: 1.5,
        marginBottom: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#00FF66',
    },
    introDesc: {
        color: '#7E8B9F',
        fontSize: 11,
        lineHeight: 15,
        marginBottom: 12,
    },
    scrollList: {
        maxHeight: 340,
    },
    scrollContent: {
        gap: 8,
        paddingBottom: 8,
    },
    scenarioCard: {
        backgroundColor: '#0B111C',
        borderRadius: radii.md,
        borderWidth: 1.2,
        padding: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        flex: 1,
    },
    activePill: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 3,
        marginLeft: 6,
    },
    activePillText: {
        color: '#000000',
        fontSize: 8,
        fontWeight: '900',
    },
    cardDesc: {
        color: '#718096',
        fontSize: 10.5,
        lineHeight: 14,
    },
    autoPilotHeroCard: {
        backgroundColor: '#161930',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#B026FF66',
    },
    autoPilotHeroCardActive: {
        backgroundColor: '#26123D',
        borderColor: '#B026FF',
        shadowColor: '#B026FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    autoPilotHeroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    autoPilotHeroBadge: {
        color: '#D8B4FE',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.6,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    autoPilotStatusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#6B7280',
    },
    autoPilotStatusDotActive: {
        backgroundColor: '#B026FF',
        shadowColor: '#B026FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
    },
    autoPilotHeroTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    autoPilotHeroDesc: {
        color: '#94A3B8',
        fontSize: 10.5,
        lineHeight: 14,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#162235',
        paddingTop: 12,
        marginTop: 8,
    },
    stopBtn: {
        backgroundColor: '#FF2A2A',
        borderRadius: radii.md,
        paddingVertical: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    closeDoneBtn: {
        backgroundColor: '#16243A',
        borderRadius: radii.md,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#243756',
    },
    closeDoneBtnText: {
        color: '#A0AEC0',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});
