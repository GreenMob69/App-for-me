import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
    Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import api from '../services/api';
import { DEFAULT_VIN } from '../utils/config';
import { colors, typography, radii, spacing, motion } from '../theme';

const STEPS = ['Bun venit', 'VIN', 'Confirmare'];

const FUEL_OPTIONS = [
    { key: 'DIESEL',   label: 'Diesel' },
    { key: 'BENZINA',  label: 'Benzină' },
    { key: 'GPL',      label: 'GPL' },
    { key: 'HYBRID',   label: 'Hybrid' },
    { key: 'ELECTRIC', label: 'Electric' },
];

const VehicleOnboardingScreen = ({ onComplete }) => {
    const [step,      setStep]      = useState(0); // 0 = welcome, 1 = VIN, 2 = confirmare
    const [vin,       setVin]       = useState('');
    const [decoded,   setDecoded]   = useState(null);
    const [mileage,   setMileage]   = useState('');
    const [fuelType,  setFuelType]  = useState('DIESEL');
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState(null);

    // ── Animații ──────────────────────────────────────────────────────────────
    const contentOpacity  = useRef(new Animated.Value(1)).current;
    const contentSlideY   = useRef(new Animated.Value(0)).current;
    const progressAnim    = useRef(new Animated.Value(0)).current;

    // Progres 0→1 per pas
    const STEP_PROGRESS = { 0: 0, 1: 0.33, 2: 0.66, 3: 1 };

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: STEP_PROGRESS[step] ?? 0,
            duration: motion.duration.normal,
            useNativeDriver: false, // animații de lățime nu suportă native driver
        }).start();
    }, [step]);

    const progressWidth = progressAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: ['0%', '100%'],
    });

    const goToStep = (nextStep) => {
        Animated.parallel([
            Animated.timing(contentOpacity, { toValue: 0, duration: motion.duration.fast, useNativeDriver: true }),
            Animated.timing(contentSlideY,  { toValue: -10, duration: motion.duration.fast, useNativeDriver: true }),
        ]).start(() => {
            setStep(nextStep);
            contentSlideY.setValue(10);
            Animated.parallel([
                Animated.timing(contentOpacity, { toValue: 1, duration: motion.duration.normal, useNativeDriver: true }),
                Animated.timing(contentSlideY,  { toValue: 0, duration: motion.duration.normal, useNativeDriver: true }),
            ]).start();
        });
    };

    // ── API calls ─────────────────────────────────────────────────────────────
    const handleDecodeVin = async () => {
        if (vin.length < 17) { setError('VIN-ul trebuie să aibă 17 caractere'); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/vin/decode/${vin.toUpperCase()}`);
            if (res.data.valid) { setDecoded(res.data); goToStep(2); }
            else setError(res.data.error || 'VIN invalid');
        } catch { setError('Nu s-a putut verifica VIN-ul'); }
        finally  { setLoading(false); }
    };

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            const body = { vin: vin.toUpperCase(), fuel_type: fuelType };
            if (mileage) body.purchase_mileage_km = parseInt(mileage, 10);
            if (decoded) {
                if (decoded.make)    body.make    = decoded.make;
                if (decoded.model)   body.model   = decoded.model;
                if (decoded.variant) body.variant = decoded.variant;
                if (decoded.year)    body.year    = decoded.year;
            }
            const res = await api.post('/vehicles', body);
            onComplete(res.data);
        } catch (err) {
            if (err.response?.status === 409) {
                try {
                    const ex = await api.get(`/vehicles/vin/${vin.toUpperCase()}`);
                    onComplete(ex.data);
                } catch { setError('Vehiculul există deja dar nu a putut fi încărcat'); }
            } else setError('Nu s-a putut crea profilul vehiculului');
        }
        finally { setLoading(false); }
    };

    const handleSkip = () => {
        Alert.alert(
            'Continuă fără configurare?',
            `Aplicația va folosi un VIN generic (${DEFAULT_VIN.slice(-6)}). Unele funcții (comparații, profilul vehiculului) vor fi limitate până când adaugi un vehicul real.`,
            [
                { text: 'Înapoi', style: 'cancel' },
                { text: 'Continuă', style: 'destructive', onPress: doSkip },
            ]
        );
    };

    const doSkip = async () => {
        setLoading(true);
        try {
            const body = { vin: DEFAULT_VIN, make: 'Necunoscut', model: 'Necunoscut', fuel_type: 'DIESEL' };
            const res = await api.post('/vehicles', body);
            onComplete(res.data);
        } catch (err) {
            if (err.response?.status === 409) {
                try {
                    const ex = await api.get(`/vehicles/vin/${DEFAULT_VIN}`);
                    onComplete(ex.data);
                } catch { onComplete({ id: 1, vin: DEFAULT_VIN }); }
            } else onComplete({ id: 1, vin: DEFAULT_VIN });
        }
        finally { setLoading(false); }
    };



    // ── Render ────────────────────────────────────────────────────────────────
    const contentStyle = {
        opacity:   contentOpacity,
        transform: [{ translateY: contentSlideY }],
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* ── Progress bar ─────────────────────────────────────────────── */}
            <View style={styles.progressTrack} accessibilityElementsHidden>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Step labels ──────────────────────────────────────────── */}
                <View style={styles.stepLabels} accessibilityElementsHidden>
                    {STEPS.map((s, i) => (
                        <Text key={s} style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>
                            {i < step ? '✓ ' : ''}{s}
                        </Text>
                    ))}
                </View>

                {/* ── Animated content wrapper ─────────────────────────────── */}
                <Animated.View style={contentStyle}>

                    {/* ── STEP 0: BUN VENIT ──────────────────────────────── */}
                    {step === 0 && (
                        <View style={styles.card}>
                            <View style={styles.heroIcon}>
                                <Text style={styles.heroEmoji}>🚗</Text>
                            </View>
                            <Text style={styles.heroTitle}>
                                Vehiculul tău,{'\n'}sub control
                            </Text>
                            <Text style={styles.heroDesc}>
                                Monitorizare în timp real, predicții defecțiuni și jurnal complet. Conectează-ți mașina în câteva secunde.
                            </Text>

                            <TouchableOpacity
                                style={styles.btn}
                                onPress={() => goToStep(1)}
                                accessibilityRole="button"
                                accessibilityLabel="Configurează vehiculul"
                            >
                                <Text style={styles.btnText}>Configurează vehiculul →</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={handleSkip}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel="Configurez mai târziu"
                                accessibilityState={{ disabled: loading }}
                            >
                                <Text style={styles.skipText}>
                                    {loading ? 'Se configurează...' : 'Configurez mai târziu'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── STEP 1: VIN ────────────────────────────────────── */}
                    {step === 1 && (
                        <View style={styles.card}>
                            <Text style={styles.stepTitle}>Introdu codul VIN</Text>
                            <Text style={styles.stepDesc}>
                                Îl găsești pe certificatul de înmatriculare sau pe bord — colț stânga-jos al parbrizului.
                            </Text>

                            <TextInput
                                style={styles.input}
                                placeholder="ex: WAUZZZ4A1RN000000"
                                placeholderTextColor={colors.text.disabled}
                                value={vin}
                                onChangeText={(v) => { setVin(v.toUpperCase()); setError(null); }}
                                maxLength={17}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                accessibilityLabel="Cod VIN vehicul"
                                accessibilityHint="17 caractere alfanumerice"
                            />

                            <View style={styles.counterRow}>
                                <Text style={[styles.counter, vin.length === 17 && styles.counterDone]}>
                                    {vin.length}/17
                                </Text>
                                {vin.length === 17 && (
                                    <Text style={styles.checkmark} accessibilityElementsHidden>✓</Text>
                                )}
                            </View>

                            {error ? (
                                <Text style={styles.error} accessibilityRole="alert">{error}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.btn, (vin.length < 17 || loading) && styles.btnDisabled]}
                                onPress={handleDecodeVin}
                                disabled={vin.length < 17 || loading}
                                accessibilityRole="button"
                                accessibilityLabel="Continuă cu verificarea VIN"
                                accessibilityState={{ disabled: vin.length < 17 || loading }}
                            >
                                <Text style={styles.btnText}>
                                    {loading ? 'Se verifică...' : 'Continuă'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => goToStep(0)}
                                accessibilityRole="button"
                                accessibilityLabel="Înapoi la ecranul de bun venit"
                            >
                                <Text style={styles.skipText}>← Înapoi</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ── STEP 2: CONFIRMARE ─────────────────────────────── */}
                    {step === 2 && (
                        <View style={styles.card}>
                            {/* Vehicul decodat */}
                            {decoded ? (
                                <View
                                    style={styles.decodedCard}
                                    accessibilityRole="none"
                                    accessibilityLabel={`Vehicul identificat: ${decoded.make} ${decoded.model || ''} ${decoded.year || ''}`}
                                >
                                    <View style={styles.decodedBadge}>
                                        <Text style={styles.decodedBadgeText}>✓</Text>
                                    </View>
                                    <Text style={styles.decodedMake}>
                                        {decoded.make} {decoded.model || ''}
                                    </Text>
                                    {decoded.variant ? (
                                        <Text style={styles.decodedVariant}>{decoded.variant}</Text>
                                    ) : null}
                                    {decoded.year ? (
                                        <Text style={styles.decodedYear}>
                                            {decoded.year} · {decoded.country || 'Europa'}
                                        </Text>
                                    ) : null}
                                    <Text style={styles.decodedVin}>{vin}</Text>
                                </View>
                            ) : null}

                            <Text style={styles.stepTitle}>Completează rapid</Text>

                            <Text style={styles.label}>Combustibil</Text>
                            <View style={styles.fuelRow} accessibilityRole="radiogroup">
                                {FUEL_OPTIONS.map(f => (
                                    <TouchableOpacity
                                        key={f.key}
                                        style={[styles.fuelChip, fuelType === f.key && styles.fuelChipActive]}
                                        onPress={() => setFuelType(f.key)}
                                        accessibilityRole="radio"
                                        accessibilityLabel={f.label}
                                        accessibilityState={{ checked: fuelType === f.key }}
                                    >
                                        <Text style={[styles.fuelChipText, fuelType === f.key && styles.fuelChipTextActive]}>
                                            {f.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Kilometraj actual (opțional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="ex: 147200"
                                placeholderTextColor={colors.text.disabled}
                                value={mileage}
                                onChangeText={setMileage}
                                keyboardType="numeric"
                                accessibilityLabel="Kilometraj actual al vehiculului"
                                accessibilityHint="Opțional, valoare în kilometri"
                            />

                            {error ? (
                                <Text style={styles.error} accessibilityRole="alert">{error}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.btn, loading && styles.btnDisabled]}
                                onPress={handleCreate}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel="Finalizează configurarea vehiculului"
                                accessibilityState={{ disabled: loading }}
                            >
                                <Text style={styles.btnText}>
                                    {loading ? 'Se creează profilul...' : 'Finalizează ✓'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.skipBtn}
                                onPress={() => goToStep(1)}
                                accessibilityRole="button"
                                accessibilityLabel="Înapoi la introducerea VIN"
                            >
                                <Text style={styles.skipText}>← Înapoi</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {/* ── Step dots ────────────────────────────────────────────── */}
                <View style={styles.dots} accessibilityElementsHidden>
                    {STEPS.map((_, i) => (
                        <View key={i} style={[styles.dot, i <= step && styles.dotActive, i === step && styles.dotCurrent]} />
                    ))}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

// ─── Stiluri ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },

    // ── Progress bar ──────────────────────────────────────────────────────────
    progressTrack: {
        height: 3,
        backgroundColor: colors.border.default,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    progressFill: {
        height: 3,
        backgroundColor: colors.accent.default,
        borderRadius: radii.full,
    },

    // ── Scroll ────────────────────────────────────────────────────────────────
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing[6],
        paddingTop: spacing[8],
    },

    // ── Step labels ───────────────────────────────────────────────────────────
    stepLabels: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing[5],
        marginBottom: spacing[6],
    },
    stepLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    stepLabelActive: {
        color: colors.accent.default,
    },

    // ── Card ──────────────────────────────────────────────────────────────────
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.xl,
        padding: spacing[6],
        borderWidth: 1,
        borderColor: colors.border.default,
    },

    // ── Hero (step 0) ─────────────────────────────────────────────────────────
    heroIcon: {
        alignItems: 'center',
        marginBottom: spacing[5],
    },
    heroEmoji: {
        fontSize: 60,
        lineHeight: 72,
    },
    heroTitle: {
        fontSize: typography.sizes.title1,
        fontWeight: '700',
        color: colors.text.primary,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: spacing[4],
        lineHeight: typography.lineHeights.title1,
    },
    heroDesc: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: typography.lineHeights.body2,
        marginBottom: spacing[6],
    },

    // ── Step header (pași 1, 2) ───────────────────────────────────────────────
    stepTitle: {
        fontSize: typography.sizes.title2,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing[2],
    },
    stepDesc: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label1,
        marginBottom: spacing[5],
    },

    // ── Input ─────────────────────────────────────────────────────────────────
    input: {
        backgroundColor: colors.bg[0],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3] + 2,
        fontSize: typography.sizes.body1,
        color: colors.text.primary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 1,
    },
    counterRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing[1],
        marginTop: spacing[1],
        marginBottom: spacing[3],
    },
    counter: {
        color: colors.text.disabled,
        fontSize: typography.sizes.label2,
    },
    counterDone: {
        color: colors.status.good,
    },
    checkmark: {
        fontSize: typography.sizes.label1,
        color: colors.status.good,
        fontWeight: '700',
    },
    error: {
        color: colors.status.critical,
        fontSize: typography.sizes.label1,
        marginBottom: spacing[3],
        textAlign: 'center',
    },

    // ── Butoane ───────────────────────────────────────────────────────────────
    btn: {
        backgroundColor: colors.accent.default,
        borderRadius: radii.md,
        paddingVertical: spacing[3] + 2,
        alignItems: 'center',
        marginTop: spacing[2],
        minHeight: 48,
        justifyContent: 'center',
    },
    btnDisabled: {
        opacity: 0.4,
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.body1,
        fontWeight: '600',
    },
    skipBtn: {
        paddingVertical: spacing[3] + 2,
        alignItems: 'center',
        marginTop: spacing[1],
        minHeight: 44,
        justifyContent: 'center',
    },
    skipText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.body2,
    },

    // ── Card vehicul decodat (step 2) ─────────────────────────────────────────
    decodedCard: {
        backgroundColor: colors.tint.good,
        borderRadius: radii.md,
        padding: spacing[4],
        marginBottom: spacing[5],
        borderWidth: 1,
        borderColor: colors.status.good,
        alignItems: 'center',
    },
    decodedBadge: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        backgroundColor: colors.status.good,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    decodedBadgeText: {
        fontSize: typography.sizes.label1,
        color: colors.bg[0],
        fontWeight: '700',
    },
    decodedMake: {
        fontSize: typography.sizes.title2,
        fontWeight: '700',
        color: colors.text.primary,
    },
    decodedVariant: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        marginTop: 2,
    },
    decodedYear: {
        fontSize: typography.sizes.label1,
        color: colors.accent.default,
        marginTop: spacing[1],
    },
    decodedVin: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 0.5,
        marginTop: spacing[2],
    },

    // ── Combustibil chips ─────────────────────────────────────────────────────
    label: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        marginBottom: spacing[2],
        marginTop: spacing[4],
    },
    fuelRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    fuelChip: {
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2],
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[0],
        minHeight: 36,
        justifyContent: 'center',
    },
    fuelChipActive: {
        borderColor: colors.accent.default,
        backgroundColor: colors.accent.muted,
    },
    fuelChipText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label1,
        fontWeight: '500',
    },
    fuelChipTextActive: {
        color: colors.accent.default,
        fontWeight: '600',
    },

    // ── Step dots ─────────────────────────────────────────────────────────────
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing[6],
        gap: spacing[2],
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
        backgroundColor: colors.border.default,
    },
    dotActive: {
        backgroundColor: colors.accent.muted,
        borderWidth: 1,
        borderColor: colors.accent.default,
    },
    dotCurrent: {
        backgroundColor: colors.accent.default,
        width: 24,
    },
});

export default VehicleOnboardingScreen;
