import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getActiveServerUrl, setCustomServerUrl, getVin } from '../utils/config';
import api from '../services/api';
import socketService from '../services/socket';
import { colors, typography, radii, spacing, layout } from '../theme';

const SettingsScreen = () => {
    const navigation = useNavigation();
    const [fuelPrice, setFuelPrice] = useState('24.50');
    const [manualIp, setManualIp] = useState(getActiveServerUrl());
    const [isSaving, setIsSaving] = useState(false);
    const [stats, setStats] = useState({ total_km: 0, total_combustibil: 0 });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedPrice = await AsyncStorage.getItem('@fuel_price');
                if (savedPrice) setFuelPrice(savedPrice);
                const res = await api.get(`/vehicul/${getVin()}/statistici`);
                if (res.data) setStats(res.data);
            } catch (error) {}
        };
        loadSettings();
    }, []);

    const handleSavePrice = async () => {
        setIsSaving(true);
        try {
            await AsyncStorage.setItem('@fuel_price', fuelPrice);
            Alert.alert("Salvat", `Prețul motorinei: ${fuelPrice} RON/L`);
        } catch (error) {
            Alert.alert("Eroare", "Nu s-a putut salva.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveIp = () => {
        Alert.alert(
            "Schimbare IP",
            `Dorești să forțezi conexiunea către ${manualIp}?`,
            [
                { text: "Anulează", style: "cancel" },
                { text: "Aplică", onPress: async () => {
                    try {
                        const url = manualIp.trim();
                        await AsyncStorage.setItem('@custom_server_url', url);
                        setCustomServerUrl(url);
                        api.defaults.baseURL = `${url}/api`;
                        socketService.disconnect();
                        socketService.socket = null;
                        socketService.connect();
                        Alert.alert("Aplicat", `Conexiune redirecționată către ${url}. API și WebSocket reconectate.`);
                    } catch (e) {
                        Alert.alert("Eroare", "Nu s-a putut aplica IP-ul.");
                    }
                }}
            ]
        );
    };

    const handleResetDB = () => {
        Alert.alert(
            "Resetare Date",
            "Aceasta va șterge toate cursele și analizele din baza de date locală. Operația este ireversibilă.",
            [
                { text: "Anulează", style: "cancel" },
                { text: "Resetează", style: "destructive", onPress: () => Alert.alert("Info", "Funcționalitate în dezvoltare.") }
            ]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing[10] }}>
            <View style={styles.header}>
                <Text style={styles.title}>Setări</Text>
                <Text style={styles.subtitle}>Configurare & Profil Vehicul</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profil Vehicul</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Model</Text>
                    <Text style={styles.value}>Audi A6 C4 · 2.5 TDI (140 CP)</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>VIN</Text>
                    <Text style={[styles.value, styles.vinValue]}>{getVin()}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Rezervor</Text>
                    <Text style={styles.value}>80 L (Diesel)</Text>
                </View>
                <View style={[styles.row, styles.rowLast]}>
                    <Text style={styles.label}>Injecție</Text>
                    <Text style={styles.value}>VP37 Bosch · Euro 2</Text>
                </View>
                <TouchableOpacity
                    style={styles.profileBtn}
                    onPress={() => navigation.navigate('VehicleProfile')}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide dosarul complet al vehiculului"
                >
                    <Text style={styles.profileBtnText}>Deschide dosarul complet →</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Economie</Text>
                <Text style={styles.desc}>Prețul per litru este folosit pentru calculul costurilor per cursă.</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={fuelPrice}
                        onChangeText={setFuelPrice}
                        keyboardType="numeric"
                        placeholder="24.50"
                        placeholderTextColor={colors.text.disabled}
                    />
                    <Text style={styles.inputUnit}>RON/L</Text>
                    <TouchableOpacity
                        style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
                        onPress={handleSavePrice}
                        disabled={isSaving}
                        accessibilityRole="button"
                        accessibilityLabel={isSaving ? 'Se salvează prețul motorinei' : 'Salvează prețul motorinei'}
                        accessibilityState={{ disabled: isSaving }}
                    >
                        <Text style={styles.saveBtnText}>Salvează</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.costSummary}>
                    <Text style={styles.costText}>Total rulat: {(stats.total_km || 0).toFixed(0)} km</Text>
                    <Text style={styles.costText}>Combustibil consumat: {(stats.total_combustibil || 0).toFixed(1)} L</Text>
                    <Text style={styles.costHighlight}>
                        Cost estimat: {((stats.total_combustibil || 0) * parseFloat(fuelPrice || 0)).toFixed(0)} RON
                    </Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Conexiune Server</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Auto-detecție</Text>
                    <Text style={styles.activeText}>Activă</Text>
                </View>
                <View style={[styles.row, styles.rowLast]}>
                    <Text style={styles.label}>Adresă curentă</Text>
                    <Text style={[styles.value, styles.valueSmall]}>{getActiveServerUrl()}</Text>
                </View>
                <Text style={styles.desc}>Suprascriere manuală (doar în caz de probleme cu rețeaua):</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, styles.inputSmall]}
                        value={manualIp}
                        onChangeText={setManualIp}
                        placeholder="http://192.168.1.X:3000"
                        placeholderTextColor={colors.text.disabled}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        style={styles.ipBtn}
                        onPress={handleSaveIp}
                        accessibilityRole="button"
                        accessibilityLabel="Aplică adresa serverului"
                    >
                        <Text style={styles.ipBtnText}>Aplică</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.card, styles.dangerCard]}>
                <Text style={[styles.sectionTitle, styles.dangerTitle]}>Zona Periculoasă</Text>
                <TouchableOpacity
                    style={styles.dangerBtn}
                    onPress={handleResetDB}
                    accessibilityRole="button"
                    accessibilityLabel="Resetează baza de date"
                    accessibilityHint="Operație ireversibilă — șterge toate cursele și analizele"
                >
                    <Text style={styles.dangerBtnText}>Resetează Baza de Date</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    header: {
        marginBottom: spacing[4],
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    title: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        marginBottom: spacing[3] + 2,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    sectionTitle: {
        fontSize: typography.sizes.label2,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        marginBottom: spacing[2] + 2,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    desc: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label2 + 1,
        marginBottom: spacing[2] + 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    profileBtn: {
        marginTop: spacing[3],
        paddingVertical: spacing[2] + 2,
        paddingHorizontal: spacing[3],
        backgroundColor: colors.accent.default,
        borderRadius: radii.md,
        alignItems: 'center',
    },
    profileBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
    },
    label: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
    },
    value: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    valueSmall: {
        fontSize: typography.sizes.caption,
    },
    vinValue: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: colors.accent.default,
    },
    activeText: {
        fontSize: typography.sizes.label2,
        color: colors.status.good,
        fontWeight: typography.weights.bold,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    input: {
        flex: 1,
        backgroundColor: colors.bg[0],
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: radii.xs,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2] + 2,
        color: colors.text.primary,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
    },
    inputSmall: {
        fontSize: typography.sizes.label2,
    },
    inputUnit: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
    saveBtn: {
        backgroundColor: colors.status.good,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.xs,
    },
    saveBtnDisabled: {
        opacity: 0.5,
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
    ipBtn: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    ipBtnText: {
        color: colors.accent.default,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
    costSummary: {
        marginTop: spacing[3],
        backgroundColor: colors.bg[0],
        borderRadius: radii.xs,
        padding: spacing[2] + 2,
    },
    costText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.label2,
        marginBottom: spacing[1] - 1,
    },
    costHighlight: {
        color: colors.status.monitor,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
    dangerCard: {
        borderColor: colors.status.critical,
    },
    dangerTitle: {
        color: colors.status.critical,
    },
    dangerBtn: {
        backgroundColor: colors.tint.critical,
        borderWidth: 1,
        borderColor: colors.status.critical,
        paddingVertical: spacing[3],
        borderRadius: radii.xs,
        alignItems: 'center',
    },
    dangerBtnText: {
        color: colors.status.critical,
        fontWeight: typography.weights.bold,
        fontSize: typography.sizes.label2,
    },
});

export default SettingsScreen;
