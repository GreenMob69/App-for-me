'use strict';
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, typography, spacing, radii, useThemeTemplate } from '../theme';

const LockScreen = ({ onUnlock }) => {
    const tpl = useThemeTemplate();
    const [hasHardware, setHasHardware] = useState(false);
    const [isEnrolled,  setIsEnrolled]  = useState(false);
    const [checking,    setChecking]    = useState(true);
    const [error,       setError]       = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [hw, enrolled] = await Promise.all([
                    LocalAuthentication.hasHardwareAsync(),
                    LocalAuthentication.isEnrolledAsync(),
                ]);
                setHasHardware(hw);
                setIsEnrolled(enrolled);
                setChecking(false);
                // Declanșează prompt automat la montare
                if (hw && enrolled) triggerAuth(hw && enrolled);
            } catch {
                setChecking(false);
            }
        })();
    }, []);

    const triggerAuth = useCallback(async (canUseBio = true) => {
        setError(null);
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage:          'Verifică identitatea pentru a accesa datele vehiculului',
                fallbackLabel:          'Folosește PIN-ul dispozitivului',
                cancelLabel:            'Anulează',
                disableDeviceFallback:  false,
            });
            if (result.success) {
                onUnlock();
            } else if (result.error === 'user_cancel' || result.error === 'system_cancel') {
                // Nu afișa eroare la anulare voluntară
            } else {
                setError('Autentificare eșuată. Încearcă din nou.');
            }
        } catch {
            setError('Biometricele nu sunt disponibile pe acest dispozitiv.');
        }
    }, [onUnlock]);

    const handlePress = useCallback(() => triggerAuth(hasHardware && isEnrolled), [triggerAuth, hasHardware, isEnrolled]);

    if (checking) {
        return (
            <View style={[styles.container, { backgroundColor: tpl.bg }]}>
                <ActivityIndicator size="large" color={tpl.accent} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: tpl.bg }]}>
            <View style={[styles.iconWrap, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                <Text style={styles.icon}>🔒</Text>
            </View>

            <Text style={styles.title}>Aplicație blocată</Text>
            <Text style={styles.subtitle}>
                {hasHardware && isEnrolled
                    ? 'Folosește amprenta sau Face ID pentru a accesa datele vehiculului.'
                    : 'Confirmă identitatea cu PIN-ul sau parola dispozitivului.'}
            </Text>

            {!!error && (
                <View style={styles.errorWrap}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <TouchableOpacity style={[styles.btn, { backgroundColor: tpl.accent }]} onPress={handlePress} activeOpacity={0.8}>
                <Text style={styles.btnText}>
                    {hasHardware && isEnrolled ? '🔓  Deblochează' : 'Autentifică-te'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
                {hasHardware && isEnrolled
                    ? 'Sau folosește PIN-ul / parola dispozitivului ca alternativă.'
                    : 'Setează o amprentă în setările telefonului pentru autentificare mai rapidă.'}
            </Text>
        </View>
    );
};

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 44;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
        paddingTop: PT,
    },
    iconWrap: {
        width: 80,
        height: 80,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing[5],
    },
    icon:  { fontSize: 36 },
    title: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: spacing[2],
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing[6],
        maxWidth: 300,
    },
    errorWrap: {
        backgroundColor: colors.tint?.critical || 'rgba(255,59,48,0.12)',
        borderWidth: 1,
        borderColor: colors.status.critical,
        borderRadius: radii.xs,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2],
        marginBottom: spacing[4],
    },
    errorText: {
        fontSize: typography.sizes.label2,
        color: colors.status.critical,
        textAlign: 'center',
    },
    btn: {
        backgroundColor: colors.accent.default,
        paddingHorizontal: spacing[8],
        paddingVertical: spacing[4],
        borderRadius: radii.full,
        marginBottom: spacing[4],
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
    },
    hint: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 280,
    },
});

export default LockScreen;
