import React, { useEffect, useRef, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { LiveContext } from '../../context/LiveContext';
import { AppContext } from '../../context/AppContext';
import { colors, typography, radii, spacing } from '../../theme';

/**
 * DriveModeBanner — Inline Dynamic Banner
 * -------------------------------------------------------------
 * Apare fluid între titlul mașinii și sumar atunci când motorul este pornit
 * (MERS / PORNIRE / RPM > 400), afișând viteza, turația și puterea în timp real,
 * oferind acces rapid la ecranul de telemetrie Live.
 */
export default function DriveModeBanner({ navigation }) {
    const { isConnected, liveData } = useContext(LiveContext);
    const { navigationRef } = useContext(AppContext);

    const rpm = liveData?.motor?.rpm ?? 0;
    const speed = liveData?.motor?.speed ?? 0;
    const powerHp = liveData?.virtual?.powerHp ?? 0;
    const isEngineActive = isConnected && (rpm > 400 || liveData?.stare_motor === 'MERS' || liveData?.stare_motor === 'PORNIRE');

    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isEngineActive) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // Pulsing emerald indicator
            const pulseLoop = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.35, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
                ])
            );
            pulseLoop.start();

            return () => pulseLoop.stop();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isEngineActive]);

    const handlePress = () => {
        if (navigation?.navigate) {
            navigation.navigate('Live');
        } else if (navigationRef?.current?.navigate) {
            navigationRef.current.navigate('Live');
        }
    };

    if (!isEngineActive) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <TouchableOpacity
                style={styles.pill}
                activeOpacity={0.88}
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel="Cursă activă, deschide telemetria live"
            >
                <View style={styles.leftSection}>
                    <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
                    <View style={styles.textWrap}>
                        <Text style={styles.title}>MOTOR PORNIT · CURSĂ ÎN TIMP REAL</Text>
                        <Text style={styles.sub}>
                            <Text style={styles.num}>{speed}</Text> km/h   ·   <Text style={styles.num}>{rpm}</Text> RPM{powerHp > 0 ? `   ·   ${powerHp} CP` : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionBtn}>
                    <Text style={styles.actionText}>LIVE ❯</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: spacing[3],
    },
    pill: {
        width: '100%',
        backgroundColor: colors.bg[1],
        borderColor: 'rgba(16, 185, 129, 0.45)',
        borderWidth: 1.5,
        borderRadius: radii.md,
        paddingVertical: spacing[2] + 2,
        paddingHorizontal: spacing[3],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: colors.status.good,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2] + 2,
        flex: 1,
    },
    pulseDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.status.good,
        shadowColor: colors.status.good,
        shadowRadius: 6,
        shadowOpacity: 0.8,
    },
    textWrap: {
        flex: 1,
    },
    title: {
        color: colors.status.good,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    sub: {
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        marginTop: 2,
    },
    num: {
        color: colors.text.primary,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    actionBtn: {
        backgroundColor: 'rgba(16, 185, 129, 0.16)',
        paddingHorizontal: spacing[2] + 4,
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.status.good,
        marginLeft: spacing[2],
    },
    actionText: {
        color: colors.status.good,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
});
