import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import api from '../services/api';

const VehicleOnboardingScreen = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const [vin, setVin] = useState('');
    const [decoded, setDecoded] = useState(null);
    const [mileage, setMileage] = useState('');
    const [fuelType, setFuelType] = useState('DIESEL');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDecodeVin = async () => {
        if (vin.length < 17) {
            setError('VIN-ul trebuie să aibă 17 caractere');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/vin/decode/${vin.toUpperCase()}`);
            if (res.data.valid) {
                setDecoded(res.data);
                setStep(2);
            } else {
                setError(res.data.error || 'VIN invalid');
            }
        } catch (err) {
            setError('Nu s-a putut verifica VIN-ul');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            const body = {
                vin: vin.toUpperCase(),
                fuel_type: fuelType,
            };
            if (mileage) body.purchase_mileage_km = parseInt(mileage);
            if (decoded) {
                if (decoded.make) body.make = decoded.make;
                if (decoded.model) body.model = decoded.model;
                if (decoded.variant) body.variant = decoded.variant;
                if (decoded.year) body.year = decoded.year;
            }
            const res = await api.post('/vehicles', body);
            onComplete(res.data);
        } catch (err) {
            if (err.response?.status === 409) {
                // Vehicle already exists, fetch it
                try {
                    const existing = await api.get(`/vehicles/vin/${vin.toUpperCase()}`);
                    onComplete(existing.data);
                } catch (e) {
                    setError('Vehiculul există deja dar nu a putut fi încărcat');
                }
            } else {
                setError('Nu s-a putut crea profilul');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        setLoading(true);
        try {
            const body = {
                vin: 'WAUZZZ4A1RN000000',
                make: 'Necunoscut',
                model: 'Necunoscut',
                fuel_type: 'DIESEL',
            };
            const res = await api.post('/vehicles', body);
            onComplete(res.data);
        } catch (err) {
            if (err.response?.status === 409) {
                try {
                    const existing = await api.get('/vehicles/vin/WAUZZZ4A1RN000000');
                    onComplete(existing.data);
                } catch (e) {
                    onComplete({ id: 1, vin: 'WAUZZZ4A1RN000000' });
                }
            } else {
                onComplete({ id: 1, vin: 'WAUZZZ4A1RN000000' });
            }
        } finally {
            setLoading(false);
        }
    };

    const FUEL_OPTIONS = ['DIESEL', 'BENZINA', 'GPL', 'HYBRID', 'ELECTRIC'];

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>Vehicle Profile</Text>
                    <Text style={styles.subtitle}>Configurare rapidă</Text>
                </View>

                {step === 1 && (
                    <View style={styles.card}>
                        <Text style={styles.stepTitle}>Introdu VIN-ul mașinii</Text>
                        <Text style={styles.stepDesc}>
                            Îl găsești pe certificatul de înmatriculare sau pe eticheta de pe bord (colț stânga-jos al parbrizului).
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="ex: WAUZZZ4A1RN000000"
                            placeholderTextColor="#484f58"
                            value={vin}
                            onChangeText={(t) => { setVin(t.toUpperCase()); setError(null); }}
                            maxLength={17}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />

                        <Text style={styles.counter}>{vin.length}/17</Text>

                        {error && <Text style={styles.error}>{error}</Text>}

                        <TouchableOpacity
                            style={[styles.btn, vin.length < 17 && styles.btnDisabled]}
                            onPress={handleDecodeVin}
                            disabled={vin.length < 17 || loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={styles.btnText}>Continuă</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={loading}>
                            <Text style={styles.skipText}>Configurez mai târziu</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View style={styles.card}>
                        {/* Decoded info */}
                        {decoded && decoded.make && (
                            <View style={styles.decodedCard}>
                                <Text style={styles.decodedMake}>
                                    {decoded.make} {decoded.model || ''}
                                </Text>
                                {decoded.variant && (
                                    <Text style={styles.decodedVariant}>{decoded.variant}</Text>
                                )}
                                {decoded.year && (
                                    <Text style={styles.decodedYear}>{decoded.year} • {decoded.country || ''}</Text>
                                )}
                            </View>
                        )}

                        <Text style={styles.stepTitle}>Completează rapid</Text>

                        {/* Fuel type */}
                        <Text style={styles.label}>Combustibil</Text>
                        <View style={styles.fuelRow}>
                            {FUEL_OPTIONS.map(f => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.fuelChip, fuelType === f && styles.fuelChipActive]}
                                    onPress={() => setFuelType(f)}
                                >
                                    <Text style={[styles.fuelChipText, fuelType === f && styles.fuelChipTextActive]}>
                                        {f === 'BENZINA' ? 'Benzină' : f === 'HYBRID' ? 'Hybrid' : f === 'ELECTRIC' ? 'Electric' : f}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Mileage */}
                        <Text style={styles.label}>Kilometraj actual (opțional)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ex: 147200"
                            placeholderTextColor="#484f58"
                            value={mileage}
                            onChangeText={setMileage}
                            keyboardType="numeric"
                        />

                        {error && <Text style={styles.error}>{error}</Text>}

                        <TouchableOpacity
                            style={styles.btn}
                            onPress={handleCreate}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={styles.btnText}>Finalizează</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(1)}>
                            <Text style={styles.skipText}>Înapoi</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Step indicator */}
                <View style={styles.dots}>
                    <View style={[styles.dot, step === 1 && styles.dotActive]} />
                    <View style={[styles.dot, step === 2 && styles.dotActive]} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        fontSize: 28,
        fontWeight: '700',
        color: '#e6edf3',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#8b949e',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#161b22',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    stepTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e6edf3',
        marginBottom: 8,
    },
    stepDesc: {
        fontSize: 13,
        color: '#8b949e',
        lineHeight: 18,
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#0d1117',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#30363d',
        padding: 14,
        fontSize: 16,
        color: '#e6edf3',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 1,
    },
    counter: {
        textAlign: 'right',
        color: '#484f58',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 12,
    },
    error: {
        color: '#f85149',
        fontSize: 13,
        marginBottom: 12,
        textAlign: 'center',
    },
    btn: {
        backgroundColor: '#238636',
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    btnDisabled: {
        backgroundColor: '#1a3a1a',
        opacity: 0.6,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    skipBtn: {
        padding: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    skipText: {
        color: '#8b949e',
        fontSize: 14,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#30363d',
    },
    dotActive: {
        backgroundColor: '#58a6ff',
    },
    decodedCard: {
        backgroundColor: '#0d1117',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#238636',
        alignItems: 'center',
    },
    decodedMake: {
        fontSize: 20,
        fontWeight: '700',
        color: '#e6edf3',
    },
    decodedVariant: {
        fontSize: 14,
        color: '#8b949e',
        marginTop: 2,
    },
    decodedYear: {
        fontSize: 13,
        color: '#58a6ff',
        marginTop: 4,
    },
    label: {
        fontSize: 13,
        color: '#8b949e',
        marginBottom: 8,
        marginTop: 16,
    },
    fuelRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    fuelChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#30363d',
        backgroundColor: '#0d1117',
    },
    fuelChipActive: {
        borderColor: '#58a6ff',
        backgroundColor: '#0c2d6b',
    },
    fuelChipText: {
        color: '#8b949e',
        fontSize: 13,
        fontWeight: '500',
    },
    fuelChipTextActive: {
        color: '#58a6ff',
    },
});

export default VehicleOnboardingScreen;
