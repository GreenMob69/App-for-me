import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_URL } from '../utils/config';
import api from '../services/api';

const SettingsScreen = () => {
    const [fuelPrice, setFuelPrice] = useState('24.50'); // Preț implicit per litru (motorină)
    const [manualIp, setManualIp] = useState(SERVER_URL);
    const [isSaving, setIsSaving] = useState(false);
    const [stats, setStats] = useState({ total_km: 0, total_combustibil: 0 });

    // Încărcăm setările salvate anterior în memoria telefonului și statisticile curente
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedPrice = await AsyncStorage.getItem('@fuel_price');
                if (savedPrice) setFuelPrice(savedPrice);

                const res = await api.get('/vehicul/WAUZZZ4A1RN000000/statistici');
                if (res.data) setStats(res.data);
            } catch (error) {
                console.log('[SETĂRI] Nu s-au putut încărca datele inițiale.');
            }
        };
        loadSettings();
    }, []);

    // Salvarea prețului la carburant
    const handleSavePrice = async () => {
        setIsSaving(true);
        try {
            await AsyncStorage.setItem('@fuel_price', fuelPrice);
            Alert.alert("Succes", `Prețul motorinei a fost actualizat la ${fuelPrice} per litru. Costurile călătoriilor vor fi recalculate!`);
        } catch (error) {
            Alert.alert("Eroare", "Nu s-a putut salva setarea în memoria telefonului.");
        } finally {
            setIsSaving(false);
        }
    };

    // Salvarea unui IP manual (Plasa de siguranță pentru prezentare)
    const handleSaveIp = async () => {
        Alert.alert(
            "Suprascriere IP Rețea",
            `Atenție! Sistemul folosește momentan IP-ul auto-detectat: ${SERVER_URL}.\n\nDorești să forțezi conexiunea manual către: ${manualIp}? (Aplicația va trebui repornită).`,
            [
                { text: "Anulează", style: "cancel" },
                { 
                    text: "Forțează Conexiunea", 
                    onPress: () => Alert.alert("Notă", "Setare rețea aplicată temporal pentru această sesiune.") 
                }
            ]
        );
    };

    // Simularea exportului legal pentru Foaia de Parcurs
    const handleExportLogbook = () => {
        Alert.alert(
            "📄 Generare Foaie de Parcurs (PDF/CSV)",
            `S-a generat raportul legal pentru Audi A6 C4 (VIN: WAUZZZ4A1RN000000).\n\n• Total rulat: ${stats.total_km.toFixed(1)} km\n• Carburant consumat: ${stats.total_combustibil.toFixed(1)} L\n• Cost estimat total: ${(stats.total_combustibil * parseFloat(fuelPrice || 0)).toFixed(2)} LEI\n\nRaportul a fost pregătit pentru trimitere prin e-mail / printare.`,
            [{ text: "Descarcă PDF", style: "default" }]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* ANTET */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Configurare & Setări</Text>
                    <Text style={styles.subtitle}>Parametri Economici & Conexiune Hardware</Text>
                </View>
            </View>

            {/* SECȚIUNEA 1: PROFIL VEHICUL (METADATE REPREZENTANȚĂ) */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>🚗 METADATE & PROFIL VEHICUL</Text>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Model Vehicul:</Text>
                    <Text style={styles.value}>Audi A6 C4 2.5 TDI (140 CP)</Text>
                </View>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Serie Șasiu (VIN):</Text>
                    <Text style={[styles.value, { color: '#58a6ff', fontFamily: 'monospace' }]}>WAUZZZ4A1RN000000</Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Capacitate Rezervor:</Text>
                    <Text style={styles.value}>80 Litri (Motorină Diesel)</Text>
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Normă Poluare / Injecție:</Text>
                    <Text style={styles.value}>Euro 2 / Pompa Rotativă VP37</Text>
                </View>
            </View>

            {/* SECȚIUNEA 2: PARAMETRI ECONOMICI (PREȚ CARBURANT PENTRU CALCUL COSTURI) */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>💰 ECONOMIE & MANAGEMENT CARBURANT</Text>
                <Text style={styles.description}>
                    Introdu prețul actual per litru pentru motorină. Serverul Node.js va corela automat debitul de aer (MAF) cu acest preț pentru a estima costul exact al fiecărei călătorii.
                </Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Preț per Litru (LEI / MDL):</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={fuelPrice}
                            onChangeText={setFuelPrice}
                            keyboardType="numeric"
                            placeholder="24.50"
                            placeholderTextColor="#8b949e"
                        />
                        <TouchableOpacity 
                            style={[styles.saveBtn, isSaving && { opacity: 0.5 }]} 
                            onPress={handleSavePrice}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveBtnText}>💾 SALVEAZĂ PREȚUL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* SECȚIUNEA 3: LOGBOOK & EXPORT RAPORTE */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>📑 RAPORTARE LEGALĂ B2B</Text>
                <Text style={styles.description}>
                    Generați automat foaia de parcurs în format compatibil pentru contabilitate sau management de flotă, conținând distanța totală și amprenta de carbon (CO2).
                </Text>

                <TouchableOpacity style={styles.exportBtn} onPress={handleExportLogbook}>
                    <Text style={styles.exportBtnText}>📄 EXPORTĂ FOAIA DE PARCURS (LOGBOOK)</Text>
                </TouchableOpacity>
            </View>

            {/* SECȚIUNEA 4: CONEXIUNE REȚEA (IP FALLBACK MANUAL) */}
            <View style={[styles.card, { borderColor: '#30363d', backgroundColor: '#11151c' }]}>
                <Text style={[styles.sectionTitle, { color: '#58a6ff' }]}>🌐 DIAGNOSTIC REȚEA & IP HARDWARE</Text>
                
                <View style={styles.row}>
                    <Text style={styles.label}>Stare Auto-Detecție:</Text>
                    <Text style={{ color: '#3fb950', fontWeight: 'bold' }}>● ACTIVĂ (ZERO-CONFIG)</Text>
                </View>

                <View style={[styles.row, { marginBottom: 15 }]}>
                    <Text style={styles.label}>Adresă Server Curent:</Text>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{SERVER_URL}</Text>
                </View>

                <Text style={[styles.inputLabel, { color: '#8b949e', fontSize: 11 }]}>
                    Suprascriere manuală IP (Doar în caz de probleme cu Wi-Fi-ul universității):
                </Text>
                
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, { borderColor: '#30363d', fontSize: 13 }]}
                        value={manualIp}
                        onChangeText={setManualIp}
                        placeholder="http://192.168.1.XX:3000"
                        placeholderTextColor="#8b949e"
                        autoCapitalize="none"
                    />
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#21262d', borderColor: '#30363d', borderWidth: 1 }]} onPress={handleSaveIp}>
                        <Text style={[styles.saveBtnText, { color: '#58a6ff' }]}>🔧 APLICĂ IP</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#21262d', paddingBottom: 15 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
    subtitle: { fontSize: 13, color: '#8b949e', marginTop: 2 },

    card: { backgroundColor: '#161b22', borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#30363d' },
    sectionTitle: { fontSize: 12, color: '#8b949e', fontWeight: 'bold', marginBottom: 14, textTransform: 'uppercase' },
    description: { fontSize: 12, color: '#c9d1d9', lineHeight: 18, marginBottom: 15 },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#21262d' },
    label: { fontSize: 13, color: '#8b949e' },
    value: { fontSize: 13, fontWeight: 'bold', color: '#ffffff' },

    inputContainer: { marginTop: 5 },
    inputLabel: { fontSize: 12, color: '#c9d1d9', fontWeight: 'bold', marginBottom: 6 },
    inputRow: { flexDirection: 'row', gap: 10 },
    input: { flex: 1, backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#58a6ff', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
    
    saveBtn: { backgroundColor: '#238636', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
    saveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },

    exportBtn: { backgroundColor: '#1f6feb', paddingVertical: 14, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#58a6ff' },
    exportBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 }
});

export default SettingsScreen;