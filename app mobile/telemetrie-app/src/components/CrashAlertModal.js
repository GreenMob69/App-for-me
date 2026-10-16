import React, { useState, useEffect, useRef } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    Linking, Platform, Animated, Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import socketService from '../services/socket';
import api from '../services/api';
import { colors, typography, radii, spacing } from '../theme';

export default function CrashAlertModal() {
    const [visible, setVisible] = useState(false);
    const [alertData, setAlertData] = useState(null);
    const [countdown, setCountdown] = useState(30);
    const [emergencyContact, setEmergencyContact] = useState(null);
    const [sosSent, setSosSent] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef(null);

    // Conectare Socket.IO pentru recepționarea coliziunilor în timp real
    useEffect(() => {
        const socket = socketService.connect();

        const handleCrash = (data) => {
            console.warn('[eCall] ALERTĂ ACCIDENT RECEPȚIONATĂ:', data);
            setAlertData(data);
            setCountdown(30);
            setSosSent(false);
            setVisible(true);

            // Vibrație de alertă
            try {
                Vibration.vibrate([0, 500, 200, 500, 200, 800]);
            } catch (_) {}

            // Încărcare contact urgență din baza de date
            if (data?.vin) {
                api.get(`/vehicul/${data.vin}/sos/contacte`)
                    .then(res => setEmergencyContact(res.data))
                    .catch(() => {});
            }
        };

        socket.on('alerta_accident', handleCrash);

        return () => {
            socket.off('alerta_accident', handleCrash);
        };
    }, []);

    // Animație pulsație de urgență
    useEffect(() => {
        if (!visible) return;

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.08,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        return () => pulse.stop();
    }, [visible]);

    // Numărătoare inversă 30 secunde
    useEffect(() => {
        if (!visible) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTriggerSos();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [visible, emergencyContact, alertData]);

    const handleDismiss = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setVisible(false);
        setAlertData(null);
    };

    const handleTriggerSos = async () => {
        setSosSent(true);
        if (timerRef.current) clearInterval(timerRef.current);

        const phone = emergencyContact?.telefon || '';
        const lat = alertData?.lat ?? 44.4323;
        const lon = alertData?.lon ?? 26.1063;
        const forceG = alertData?.forceG ?? 3.0;
        const speed = alertData?.speed ?? 0;
        const vin = alertData?.vin ?? 'VEHICUL';

        const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
        const defaultMsg = `🚨 ALERTĂ SOS AUTOMATĂ eCall!\nS-a detectat o coliziune violentă (${forceG}G la ${speed} km/h).\nLocație GPS: ${lat}, ${lon}\nGoogle Maps: ${mapsUrl}\nVehicul VIN: ${vin}`;
        const textMessage = `${emergencyContact?.mesajPersonalizat || defaultMsg}\n${mapsUrl}`;

        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        const smsUrl = Platform.OS === 'ios'
            ? `sms:${cleanPhone}&body=${encodeURIComponent(textMessage)}`
            : `sms:${cleanPhone}?body=${encodeURIComponent(textMessage)}`;

        try {
            const canOpen = await Linking.canOpenURL(smsUrl);
            if (canOpen) {
                await Linking.openURL(smsUrl);
            } else {
                // Fallback la browser / Google Maps
                Linking.openURL(mapsUrl);
            }
        } catch (e) {
            console.error('[eCall] Eroare deschidere SMS:', e);
        }
    };

    if (!visible || !alertData) return null;

    const lat = alertData.lat ?? 44.4323;
    const lon = alertData.lon ?? 26.1063;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={handleDismiss}
        >
            <View style={styles.overlay}>
                <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
                    {/* Header Urgență */}
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="warning" size={36} color="#ffffff" />
                        </View>
                        <Text style={styles.title}>IMPACT VIOLENT DETECTAT</Text>
                        <Text style={styles.subtitle}>Sistem Automat de Salvare eCall</Text>
                    </View>

                    {/* Parametri impact */}
                    <View style={styles.statsCard}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>FORȚĂ IMPACT</Text>
                            <Text style={[styles.statValue, { color: colors.status.critical }]}>
                                {alertData.forceG} G
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>VITEZĂ IMPACT</Text>
                            <Text style={styles.statValue}>
                                {alertData.speed} km/h
                            </Text>
                        </View>
                    </View>

                    {/* Coordonate GPS */}
                    <View style={styles.gpsRow}>
                        <Ionicons name="location" size={16} color={colors.accent.default} />
                        <Text style={styles.gpsText} numberOfLines={1}>
                            GPS: {lat.toFixed(5)}, {lon.toFixed(5)}
                        </Text>
                    </View>

                    {/* Countdown */}
                    <View style={styles.countdownContainer}>
                        <Text style={styles.countdownNumber}>{countdown}</Text>
                        <Text style={styles.countdownLabel}>
                            secunde până la transmiterea automată SOS
                        </Text>
                    </View>

                    {/* Destinatar alertă */}
                    <Text style={styles.contactNotice}>
                        Contact Urgență: {emergencyContact?.nume || 'Familie'} ({emergencyContact?.telefon || 'Nespecificat'})
                    </Text>

                    {/* Butoane de acțiune */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={handleDismiss}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
                            <Text style={styles.cancelBtnText}>SUNT BINE! ANULEAZĂ</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.sosBtn}
                            onPress={handleTriggerSos}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call" size={20} color="#ffffff" />
                            <Text style={styles.sosBtnText}>
                                {sosSent ? 'SOS TRANSMIS' : 'TRIMITE SOS ACUM'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing[4],
    },
    container: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#160809',
        borderColor: '#f04343',
        borderWidth: 2,
        borderRadius: radii.xl,
        padding: spacing[5],
        alignItems: 'center',
        shadowColor: '#f04343',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 18,
        elevation: 15,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    iconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#d32f2f',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    title: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: 0.8,
    },
    subtitle: {
        fontSize: typography.sizes.caption,
        color: '#ff8a80',
        fontWeight: typography.weights.bold,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginVertical: spacing[2],
        borderWidth: 1,
        borderColor: 'rgba(240,67,67,0.3)',
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.sizes.tiny,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
    },
    statValue: {
        fontSize: typography.sizes.title1,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    gpsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginVertical: spacing[2],
    },
    gpsText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    countdownContainer: {
        alignItems: 'center',
        marginVertical: spacing[3],
    },
    countdownNumber: {
        fontSize: 48,
        fontWeight: typography.weights.heavy,
        color: '#ff5252',
        lineHeight: 52,
    },
    countdownLabel: {
        fontSize: typography.sizes.small,
        color: '#ffcdd2',
        textAlign: 'center',
        marginTop: 2,
    },
    contactNotice: {
        fontSize: typography.sizes.tiny,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing[4],
    },
    actions: {
        width: '100%',
        gap: spacing[2],
    },
    cancelBtn: {
        backgroundColor: '#2e7d32',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        paddingVertical: spacing[3],
        borderRadius: radii.md,
    },
    cancelBtnText: {
        color: '#ffffff',
        fontSize: typography.sizes.callout,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    sosBtn: {
        backgroundColor: '#d32f2f',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        paddingVertical: spacing[3],
        borderRadius: radii.md,
    },
    sosBtnText: {
        color: '#ffffff',
        fontSize: typography.sizes.callout,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
    },
});
