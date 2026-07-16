import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Alert, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getActiveServerUrl, setCustomServerUrl, getVin } from '../utils/config';
import api from '../services/api';
import socketService from '../services/socket';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Connection Status ────────────────────────────────────────────────────────

const STATUS_COLORS = {
    checking: colors.text.disabled,
    online:   colors.status.good,
    offline:  colors.status.critical,
    slow:     colors.status.monitor,
};

const STATUS_LABELS = {
    checking: 'Se verifică...',
    online:   'Online',
    offline:  'Offline',
    slow:     'Lent',
};

// ─────────────────────────────────────────────────────────────────────────────

const SettingsScreen = () => {
    const navigation = useNavigation();
    const [fuelPrice,    setFuelPrice]    = useState('24.50');
    const [manualIp,     setManualIp]     = useState(getActiveServerUrl());
    const [isSaving,     setIsSaving]     = useState(false);
    const [stats,        setStats]        = useState(null);
    const [connStatus,   setConnStatus]   = useState('checking');
    const [pingMs,       setPingMs]       = useState(null);
    const pingRef = useRef(null);

    const checkConnection = useCallback(async () => {
        setConnStatus('checking');
        const start = Date.now();
        try {
            await api.get('/ping', { timeout: 4000 });
            const ms = Date.now() - start;
            setPingMs(ms);
            setConnStatus(ms > 1500 ? 'slow' : 'online');
        } catch {
            setPingMs(null);
            setConnStatus('offline');
        }
    }, []);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedPrice = await AsyncStorage.getItem('@fuel_price');
                if (savedPrice) setFuelPrice(savedPrice);
                const res = await api.get(`/vehicul/${getVin()}/statistici`);
                if (res.data) setStats(res.data);
            } catch {}
        };

        loadSettings();
        checkConnection();

        // Refresh connection every 15s while screen is visible
        pingRef.current = setInterval(checkConnection, 15000);
        return () => clearInterval(pingRef.current);
    }, [checkConnection]);

    const handleSavePrice = async () => {
        setIsSaving(true);
        try {
            await AsyncStorage.setItem('@fuel_price', fuelPrice);
            Alert.alert('Salvat', `Prețul motorinei: ${fuelPrice} RON/L`);
        } catch {
            Alert.alert('Eroare', 'Nu s-a putut salva.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveIp = () => {
        Alert.alert(
            'Schimbare IP',
            `Dorești să forțezi conexiunea către ${manualIp}?`,
            [
                { text: 'Anulează', style: 'cancel' },
                {
                    text: 'Aplică', onPress: async () => {
                        try {
                            const url = manualIp.trim();
                            await AsyncStorage.setItem('@custom_server_url', url);
                            setCustomServerUrl(url);
                            api.defaults.baseURL = `${url}/api`;
                            socketService.disconnect();
                            socketService.socket = null;
                            socketService.connect();
                            setConnStatus('checking');
                            setTimeout(checkConnection, 500);
                            Alert.alert('Aplicat', `Conexiune redirecționată către ${url}.`);
                        } catch {
                            Alert.alert('Eroare', 'Nu s-a putut aplica IP-ul.');
                        }
                    },
                },
            ]
        );
    };

    const handleResetDB = () => {
        Alert.alert(
            'Resetare Date',
            'Aceasta va șterge toate cursele și analizele din baza de date locală. Operația este ireversibilă.',
            [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Resetează', style: 'destructive', onPress: () => Alert.alert('Info', 'Funcționalitate în dezvoltare.') },
            ]
        );
    };

    const connColor = STATUS_COLORS[connStatus];
    const connLabel = STATUS_LABELS[connStatus];
    const totalCost = ((stats?.total_combustibil || 0) * parseFloat(fuelPrice || 0));

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: spacing[10] }}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Setări</Text>
                <Text style={styles.subtitle}>Configurare & Profil Vehicul</Text>
            </View>

            {/* ── Profil Vehicul ─────────────────────────────────────────── */}
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

            {/* ── Statistici generale ────────────────────────────────────── */}
            <View style={styles.card}>
                <Text style={styles.sectionTitle}>Statistici cumulate</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                        <Text style={styles.statValue}>
                            {Math.round(stats?.total_km || 0).toLocaleString('ro-RO')}
                        </Text>
                        <Text style={styles.statLabel}>km total</Text>
                    </View>
                    <View style={[styles.statCell, styles.statCellBorder]}>
                        <Text style={styles.statValue}>
                            {(stats?.total_combustibil || 0).toFixed(1)}
                        </Text>
                        <Text style={styles.statLabel}>litri consum</Text>
                    </View>
                    <View style={[styles.statCell, styles.statCellBorder]}>
                        <Text style={[styles.statValue, { color: colors.status.monitor }]}>
                            {totalCost.toFixed(0)}
                        </Text>
                        <Text style={styles.statLabel}>RON cost est.</Text>
                    </View>
                </View>
                {(stats?.total_calatorii > 0 || stats?.scor_mediu > 0) && (
                    <View style={styles.statFooter}>
                        <Text style={styles.statFooterText}>
                            {stats.total_calatorii > 0 ? `${stats.total_calatorii} curse` : ''}
                            {stats.total_calatorii > 0 && stats.scor_mediu > 0 ? '  ·  ' : ''}
                            {stats.scor_mediu > 0 ? `eco mediu ${Math.round(stats.scor_mediu)}/100` : ''}
                            {stats.total_km > 0 && stats.total_combustibil > 0
                                ? `  ·  ${((stats.total_combustibil / stats.total_km) * 100).toFixed(1)} L/100km`
                                : ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* ── Economie ───────────────────────────────────────────────── */}
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
                        accessibilityLabel={isSaving ? 'Se salvează' : 'Salvează prețul motorinei'}
                        accessibilityState={{ disabled: isSaving }}
                    >
                        <Text style={styles.saveBtnText}>{isSaving ? '...' : 'Salvează'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Conexiune Server ───────────────────────────────────────── */}
            <View style={styles.card}>
                <View style={styles.connHeader}>
                    <Text style={styles.sectionTitle}>Conexiune Server</Text>
                    <TouchableOpacity
                        onPress={checkConnection}
                        style={styles.refreshBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Reîmprospătează statusul conexiunii"
                    >
                        <Text style={styles.refreshBtnText}>↺ Verifică</Text>
                    </TouchableOpacity>
                </View>

                {/* Live status badge */}
                <View style={[styles.connBadge, { borderColor: connColor }]}>
                    <View style={[styles.connDot, { backgroundColor: connColor }]} />
                    <Text style={[styles.connBadgeLabel, { color: connColor }]}>{connLabel}</Text>
                    {pingMs != null && (
                        <Text style={styles.connPing}>{pingMs} ms</Text>
                    )}
                </View>

                <View style={styles.row}>
                    <Text style={styles.label}>Auto-detecție</Text>
                    <Text style={styles.activeText}>Activă</Text>
                </View>
                <View style={[styles.row, styles.rowLast]}>
                    <Text style={styles.label}>Adresă curentă</Text>
                    <Text style={[styles.value, styles.valueSmall]}>{getActiveServerUrl()}</Text>
                </View>

                <Text style={[styles.desc, { marginTop: spacing[2] + 2 }]}>
                    Suprascriere manuală (doar în caz de probleme cu rețeaua):
                </Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, styles.inputSmall]}
                        value={manualIp}
                        onChangeText={setManualIp}
                        placeholder="http://192.168.1.X:3000"
                        placeholderTextColor={colors.text.disabled}
                        autoCapitalize="none"
                        autoCorrect={false}
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

            {/* ── Zona Periculoasă ───────────────────────────────────────── */}
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
        lineHeight: typography.lineHeights?.label2 + 1 || 18,
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
    rowLast: { borderBottomWidth: 0 },
    label: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
    },
    value: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    valueSmall: { fontSize: typography.sizes.caption },
    vinValue: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: colors.accent.default,
    },
    activeText: {
        fontSize: typography.sizes.label2,
        color: colors.status.good,
        fontWeight: typography.weights.bold,
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

    // ── Stats grid ────────────────────────────────────────────────────────────
    statsGrid: {
        flexDirection: 'row',
        backgroundColor: colors.bg[0],
        borderRadius: radii.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    statCell: {
        flex: 1,
        paddingVertical: spacing[3] + 2,
        alignItems: 'center',
    },
    statCellBorder: {
        borderLeftWidth: 1,
        borderLeftColor: colors.border.subtle,
    },
    statValue: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
    statLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
        textAlign: 'center',
    },
    statFooter: {
        marginTop: spacing[2] + 2,
        paddingTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    statFooterText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        textAlign: 'center',
    },

    // ── Input ─────────────────────────────────────────────────────────────────
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
    inputSmall: { fontSize: typography.sizes.label2 },
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
        minWidth: 80,
        alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
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

    // ── Connection ────────────────────────────────────────────────────────────
    connHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2] + 2,
    },
    connBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        borderWidth: 1,
        marginBottom: spacing[3],
        gap: spacing[1] + 1,
    },
    connDot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
    },
    connBadgeLabel: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
    },
    connPing: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginLeft: spacing[1],
    },
    refreshBtn: {
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.xs,
        backgroundColor: colors.bg[2],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    refreshBtnText: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },

    // ── Danger ────────────────────────────────────────────────────────────────
    dangerCard: { borderColor: colors.status.critical },
    dangerTitle: { color: colors.status.critical },
    dangerBtn: {
        backgroundColor: colors.tint?.critical || 'rgba(255,59,48,0.1)',
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
