import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveServerUrl, setCustomServerUrl } from '../utils/config';
import api from '../services/api';
import socketService from '../services/socket';

const SettingsScreen = () => {
    const [fuelPrice, setFuelPrice] = useState('24.50');
    const [manualIp, setManualIp] = useState(getActiveServerUrl());
    const [isSaving, setIsSaving] = useState(false);
    const [stats, setStats] = useState({ total_km: 0, total_combustibil: 0 });

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedPrice = await AsyncStorage.getItem('@fuel_price');
                if (savedPrice) setFuelPrice(savedPrice);
                const res = await api.get('/vehicul/WAUZZZ4A1RN000000/statistici');
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
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.header}>
                <Text style={styles.title}>Setări</Text>
                <Text style={styles.subtitle}>Configurare & Profil Vehicul</Text>
            </View>

            {/* VEHICUL */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profil Vehicul</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Model</Text>
                    <Text style={styles.value}>Audi A6 C4 · 2.5 TDI (140 CP)</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>VIN</Text>
                    <Text style={[styles.value, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#58a6ff' }]}>WAUZZZ4A1RN000000</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.label}>Rezervor</Text>
                    <Text style={styles.value}>80 L (Diesel)</Text>
                </View>
                <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Text style={styles.label}>Injecție</Text>
                    <Text style={styles.value}>VP37 Bosch · Euro 2</Text>
                </View>
            </View>

            {/* PREȚ CARBURANT */}
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
                        placeholderTextColor="#484f58"
                    />
                    <Text style={styles.inputUnit}>RON/L</Text>
                    <TouchableOpacity style={[styles.saveBtn, isSaving && { opacity: 0.5 }]} onPress={handleSavePrice} disabled={isSaving}>
                        <Text style={styles.saveBtnText}>Salvează</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.costSummary}>
                    <Text style={styles.costText}>Total rulat: {(stats.total_km || 0).toFixed(0)} km</Text>
                    <Text style={styles.costText}>Combustibil consumat: {(stats.total_combustibil || 0).toFixed(1)} L</Text>
                    <Text style={[styles.costText, { color: '#d29922', fontWeight: '700' }]}>
                        Cost estimat: {((stats.total_combustibil || 0) * parseFloat(fuelPrice || 0)).toFixed(0)} RON
                    </Text>
                </View>
            </View>

            {/* CONEXIUNE */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Conexiune Server</Text>
                <View style={styles.row}>
                    <Text style={styles.label}>Auto-detecție</Text>
                    <Text style={{ color: '#3fb950', fontWeight: '700', fontSize: 12 }}>Activă</Text>
                </View>
                <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Text style={styles.label}>Adresă curentă</Text>
                    <Text style={[styles.value, { fontSize: 11 }]}>{getActiveServerUrl()}</Text>
                </View>
                <Text style={styles.desc}>Suprascriere manuală (doar în caz de probleme cu rețeaua):</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, { fontSize: 12 }]}
                        value={manualIp}
                        onChangeText={setManualIp}
                        placeholder="http://192.168.1.X:3000"
                        placeholderTextColor="#484f58"
                        autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.ipBtn} onPress={handleSaveIp}>
                        <Text style={styles.ipBtnText}>Aplică</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* PERICOL */}
            <View style={[styles.card, { borderColor: '#da3633' }]}>
                <Text style={[styles.sectionTitle, { color: '#f85149' }]}>Zona Periculoasă</Text>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleResetDB}>
                    <Text style={styles.dangerBtnText}>Resetează Baza de Date</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d1117', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44 },
    header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    subtitle: { fontSize: 11, color: '#8b949e', marginTop: 2 },
    card: { backgroundColor: '#161b22', borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#30363d' },
    sectionTitle: { fontSize: 12, color: '#c9d1d9', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
    desc: { fontSize: 12, color: '#8b949e', lineHeight: 17, marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    label: { fontSize: 13, color: '#8b949e' },
    value: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: { flex: 1, backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#30363d', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, color: '#ffffff', fontSize: 15, fontWeight: '600' },
    inputUnit: { color: '#8b949e', fontSize: 12, fontWeight: '600' },
    saveBtn: { backgroundColor: '#238636', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6 },
    saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    ipBtn: { backgroundColor: '#21262d', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },
    ipBtnText: { color: '#58a6ff', fontWeight: '700', fontSize: 12 },
    costSummary: { marginTop: 12, backgroundColor: '#0d1117', borderRadius: 6, padding: 10 },
    costText: { color: '#8b949e', fontSize: 12, marginBottom: 3 },
    dangerBtn: { backgroundColor: '#3b2322', borderWidth: 1, borderColor: '#da3633', paddingVertical: 12, borderRadius: 6, alignItems: 'center' },
    dangerBtnText: { color: '#f85149', fontWeight: '700', fontSize: 12 },
});

export default SettingsScreen;
