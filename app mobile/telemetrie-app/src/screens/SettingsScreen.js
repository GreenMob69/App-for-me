import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Alert, Switch, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { getActiveServerUrl, setCustomServerUrl, getVin, setVin } from '../utils/config';
import api from '../services/api';
import socketService from '../services/socket';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Connection badge ─────────────────────────────────────────────────────────

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

// Default thresholds — can be overridden by user
const DEFAULT_THRESHOLDS = {
    coolant_warn:    95,
    coolant_crit:   105,
    voltage_warn:  13.5,
    voltage_crit:  13.0,
    cons_warn:      8.5,
    rpm_warn:      3500,
};

// ─── Row helpers ──────────────────────────────────────────────────────────────

const Row = ({ label, value, last }) => (
    <View style={[styles.row, last && styles.rowLast]}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
);

const SectionTitle = ({ children }) => (
    <Text style={styles.sectionTitle}>{children}</Text>
);

// ─── Component ────────────────────────────────────────────────────────────────

const SettingsScreen = () => {
    const navigation = useNavigation();

    // ── Connection
    const [connStatus, setConnStatus]   = useState('checking');
    const [pingMs,     setPingMs]       = useState(null);
    const pingRef = useRef(null);

    // ── Stats
    const [stats,    setStats]    = useState(null);

    // ── Fuel price
    const [fuelPrice, setFuelPrice] = useState('24.50');
    const [isSaving,  setIsSaving]  = useState(false);

    // ── Custom server
    const [manualIp, setManualIp] = useState(getActiveServerUrl());

    // ── Vehicles
    const [vehicles,  setVehicles]  = useState([]);
    const [activeVin, setActiveVin] = useState(getVin());

    // ── Alert thresholds
    const [thresholds, setThresholds]   = useState(DEFAULT_THRESHOLDS);
    const [editingKey, setEditingKey]   = useState(null);
    const [editVal,    setEditVal]      = useState('');
    const [thrSaved,   setThrSaved]     = useState(false);

    // ── Notifications toggle (stored, read by AlertContext)
    const [notifsEnabled, setNotifsEnabled] = useState(true);

    // ─── Load ─────────────────────────────────────────────────────────────────

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
        const load = async () => {
            try {
                const [savedPrice, savedIp, savedThrs, savedNotifs] = await Promise.all([
                    AsyncStorage.getItem('@fuel_price'),
                    AsyncStorage.getItem('@custom_server_url'),
                    AsyncStorage.getItem('@alert_thresholds'),
                    AsyncStorage.getItem('@notifs_enabled'),
                ]);
                if (savedPrice)  setFuelPrice(savedPrice);
                if (savedIp)     setManualIp(savedIp);
                if (savedThrs)   setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(savedThrs) });
                if (savedNotifs !== null) setNotifsEnabled(savedNotifs === 'true');
            } catch {}

            try {
                const [statsRes, vehiclesRes] = await Promise.all([
                    api.get(`/vehicul/${getVin()}/statistici`),
                    api.get('/vehicule/list', { timeout: 4000 }),
                ]);
                if (statsRes.data) setStats(statsRes.data);
                if (vehiclesRes.data && Array.isArray(vehiclesRes.data)) setVehicles(vehiclesRes.data);
            } catch {}
        };

        load();
        checkConnection();
        pingRef.current = setInterval(checkConnection, 15000);
        return () => clearInterval(pingRef.current);
    }, [checkConnection]);

    // ─── Actions ──────────────────────────────────────────────────────────────

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
        Alert.alert('Schimbare server', `Conectare la: ${manualIp}?`, [
            { text: 'Anulează', style: 'cancel' },
            { text: 'Aplică', onPress: async () => {
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
                    Alert.alert('Aplicat', `Server: ${url}`);
                } catch { Alert.alert('Eroare', 'Nu s-a putut aplica.'); }
            }},
        ]);
    };

    const handleSwitchVehicle = async (vin) => {
        if (vin === activeVin) return;
        setVin(vin);
        setActiveVin(vin);
        await AsyncStorage.setItem('@active_vin', vin);
        try {
            const res = await api.get(`/vehicul/${vin}/statistici`);
            if (res.data) setStats(res.data);
        } catch {}
    };

    const handleSaveThresholds = async () => {
        try {
            await AsyncStorage.setItem('@alert_thresholds', JSON.stringify(thresholds));
            setThrSaved(true);
            setTimeout(() => setThrSaved(false), 2000);
        } catch { Alert.alert('Eroare', 'Nu s-a putut salva.'); }
    };

    const handleResetDB = () => {
        Alert.alert(
            'Resetare bază de date',
            'Va șterge TOATE cursele, analizele și datele de telemetrie. Ireversibil.',
            [
                { text: 'Anulează', style: 'cancel' },
                { text: 'Resetează', style: 'destructive', onPress: async () => {
                    try {
                        await api.post('/admin/reset-db');
                        Alert.alert('Gata', 'Baza de date a fost resetată.');
                        setStats(null);
                    } catch {
                        Alert.alert('Eroare', 'Nu s-a putut reseta. Verifică serverul.');
                    }
                }},
            ]
        );
    };

    // ─── Derived ──────────────────────────────────────────────────────────────

    const connColor = STATUS_COLORS[connStatus];
    const connLabel = STATUS_LABELS[connStatus];
    const totalCost = (stats?.total_combustibil || 0) * parseFloat(fuelPrice || 0);
    const avgCons   = stats?.total_km > 0 && stats?.total_combustibil > 0
        ? ((stats.total_combustibil / stats.total_km) * 100).toFixed(1)
        : null;

    const activeVehicle = vehicles.find(v => v.vin === activeVin) || null;

    const THRESHOLD_FIELDS = [
        { key: 'coolant_warn',  label: 'Temp. răcire avertizare', unit: '°C',  min: 70,  max: 110 },
        { key: 'coolant_crit',  label: 'Temp. răcire critică',    unit: '°C',  min: 80,  max: 120 },
        { key: 'voltage_warn',  label: 'Voltaj avertizare',       unit: 'V',   min: 12.0,max: 15.0 },
        { key: 'voltage_crit',  label: 'Voltaj critic',           unit: 'V',   min: 11.0,max: 14.5 },
        { key: 'cons_warn',     label: 'Consum avertizare',       unit: 'L/h', min: 3,   max: 30   },
        { key: 'rpm_warn',      label: 'Turație avertizare',      unit: 'RPM', min: 2000,max: 5000 },
    ];

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: spacing[12] }}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <View style={styles.header}>
                <Text style={styles.title}>Setări</Text>
                <Text style={styles.subtitle}>Configurare · Vehicul · Preferințe</Text>
            </View>

            {/* ── Profil Vehicul ─────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Profil Vehicul</SectionTitle>
                <Row label="Model"   value={activeVehicle?.model || 'Audi A6 C4 2.5 TDI'} />
                <Row label="VIN"     value={activeVehicle?.vin   || activeVin} />
                <Row label="Rezervor" value={activeVehicle?.capacitate_rezervor_l
                    ? `${activeVehicle.capacitate_rezervor_l} L`
                    : '80 L'} />
                <Row label="Combustibil" value={activeVehicle?.tip_combustibil
                    ? activeVehicle.tip_combustibil.charAt(0).toUpperCase() + activeVehicle.tip_combustibil.slice(1)
                    : 'Diesel'} last />
                <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => navigation.navigate('VehicleProfile')}
                    accessibilityRole="button"
                >
                    <Text style={styles.outlineBtnText}>Deschide dosarul complet →</Text>
                </TouchableOpacity>
            </View>

            {/* ── Statistici ─────────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Statistici cumulate</SectionTitle>
                <View style={styles.statsGrid}>
                    <View style={styles.statCell}>
                        <Text style={styles.statValue}>{Math.round(stats?.total_km || 0).toLocaleString('ro-RO')}</Text>
                        <Text style={styles.statLabel}>km total</Text>
                    </View>
                    <View style={[styles.statCell, styles.statCellBorder]}>
                        <Text style={styles.statValue}>{(stats?.total_combustibil || 0).toFixed(1)}</Text>
                        <Text style={styles.statLabel}>litri consum</Text>
                    </View>
                    <View style={[styles.statCell, styles.statCellBorder]}>
                        <Text style={[styles.statValue, { color: colors.status.monitor }]}>{totalCost.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>RON cost est.</Text>
                    </View>
                </View>
                {(stats?.total_calatorii > 0 || stats?.scor_mediu > 0) && (
                    <View style={styles.statFooter}>
                        <Text style={styles.statFooterText}>
                            {stats?.total_calatorii > 0 ? `${stats.total_calatorii} curse` : ''}
                            {stats?.scor_mediu > 0 ? `  ·  eco mediu ${Math.round(stats.scor_mediu)}/100` : ''}
                            {avgCons ? `  ·  ${avgCons} L/100km` : ''}
                        </Text>
                    </View>
                )}
            </View>

            {/* ── Vehicule înregistrate ──────────────────────────────────── */}
            {vehicles.length > 1 && (
                <View style={styles.card}>
                    <SectionTitle>Vehicule înregistrate</SectionTitle>
                    <Text style={styles.desc}>Apasă „Activează" pentru a schimba vehiculul monitorizat.</Text>
                    {vehicles.map((v, i) => {
                        const isActive = v.vin === activeVin;
                        return (
                            <View key={v.vin} style={[styles.vehicleRow, i === vehicles.length - 1 && styles.rowLast]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.vehicleModel}>{v.model || 'Vehicul'}</Text>
                                    <Text style={styles.vehicleVin}>{v.vin}</Text>
                                </View>
                                {isActive ? (
                                    <View style={styles.activePill}><Text style={styles.activePillText}>Activ</Text></View>
                                ) : (
                                    <TouchableOpacity style={styles.switchBtn} onPress={() => handleSwitchVehicle(v.vin)}>
                                        <Text style={styles.switchBtnText}>Activează</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* ── Economie ───────────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Economie</SectionTitle>
                <Text style={styles.desc}>Prețul per litru pentru calculul costurilor per cursă.</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        value={fuelPrice}
                        onChangeText={setFuelPrice}
                        keyboardType="numeric"
                        placeholder="24.50"
                        placeholderTextColor={colors.text.disabled}
                        accessibilityLabel="Preț motorină RON per litru"
                    />
                    <Text style={styles.inputUnit}>RON/L</Text>
                    <TouchableOpacity
                        style={[styles.solidBtn, isSaving && styles.solidBtnDisabled]}
                        onPress={handleSavePrice}
                        disabled={isSaving}
                    >
                        <Text style={styles.solidBtnText}>{isSaving ? '...' : 'Salvează'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Praguri de alertă ──────────────────────────────────────── */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <SectionTitle>Praguri de alertă</SectionTitle>
                    <TouchableOpacity
                        style={[styles.solidBtn, thrSaved && { backgroundColor: colors.status.good }]}
                        onPress={handleSaveThresholds}
                    >
                        <Text style={styles.solidBtnText}>{thrSaved ? '✓ Salvat' : 'Salvează'}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.desc}>
                    Valorile de mai jos controlează când aplicația afișează avertizări și alerte critice în ecranul Live.
                </Text>
                {THRESHOLD_FIELDS.map((f, i) => (
                    <View key={f.key} style={[styles.thrRow, i === THRESHOLD_FIELDS.length - 1 && styles.rowLast]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.thrLabel}>{f.label}</Text>
                            <Text style={styles.thrRange}>min {f.min} · max {f.max} {f.unit}</Text>
                        </View>
                        {editingKey === f.key ? (
                            <View style={styles.thrEditRow}>
                                <TextInput
                                    style={styles.thrInput}
                                    value={editVal}
                                    onChangeText={setEditVal}
                                    keyboardType="numeric"
                                    autoFocus
                                    onBlur={() => {
                                        const n = parseFloat(editVal);
                                        if (!isNaN(n) && n >= f.min && n <= f.max) {
                                            setThresholds(prev => ({ ...prev, [f.key]: n }));
                                        }
                                        setEditingKey(null);
                                    }}
                                    accessibilityLabel={`Prag ${f.label}`}
                                />
                                <Text style={styles.thrUnit}>{f.unit}</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.thrValueBtn}
                                onPress={() => { setEditingKey(f.key); setEditVal(String(thresholds[f.key])); }}
                            >
                                <Text style={styles.thrValue}>{thresholds[f.key]}</Text>
                                <Text style={styles.thrUnit}>{f.unit}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </View>

            {/* ── Notificări ─────────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Notificări</SectionTitle>
                <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Alerte critice (DTC, supraîncălzire)</Text>
                        <Text style={styles.switchDesc}>
                            Notificare nativă când apar coduri DTC sau depășiri critice de prag.
                        </Text>
                    </View>
                    <Switch
                        value={notifsEnabled}
                        onValueChange={async (v) => {
                            setNotifsEnabled(v);
                            await AsyncStorage.setItem('@notifs_enabled', String(v));
                        }}
                        trackColor={{ false: colors.border.default, true: colors.accent.default }}
                        thumbColor={notifsEnabled ? '#FFFFFF' : colors.text.secondary}
                    />
                </View>
            </View>

            {/* ── Conexiune Server ───────────────────────────────────────── */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <SectionTitle>Conexiune Server</SectionTitle>
                    <TouchableOpacity style={styles.outlineSmBtn} onPress={checkConnection}>
                        <Text style={styles.outlineSmBtnText}>↺ Verifică</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.connBadge, { borderColor: connColor }]}>
                    <View style={[styles.connDot, { backgroundColor: connColor }]} />
                    <Text style={[styles.connBadgeLabel, { color: connColor }]}>{connLabel}</Text>
                    {pingMs != null && <Text style={styles.connPing}>{pingMs} ms</Text>}
                </View>

                <Row label="Auto-detecție" value="Activă" />
                <Row label="Adresă curentă" value={getActiveServerUrl()} last />

                <Text style={[styles.desc, { marginTop: spacing[3] }]}>Suprascriere manuală:</Text>
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
                    <TouchableOpacity style={styles.outlineBtn2} onPress={handleSaveIp}>
                        <Text style={styles.outlineBtn2Text}>Aplică</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Zona Periculoasă ───────────────────────────────────────── */}
            <View style={[styles.card, styles.dangerCard]}>
                <SectionTitle style={{ color: colors.status.critical }}>Zona Periculoasă</SectionTitle>
                <Text style={styles.desc}>
                    Șterge toate cursele, analizele și datele de telemetrie din baza de date.
                    Profilul vehiculului și setările rămân intacte.
                </Text>
                <TouchableOpacity style={styles.dangerBtn} onPress={handleResetDB}>
                    <Text style={styles.dangerBtnText}>Resetează Baza de Date</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: PT,
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
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2] + 2,
    },

    sectionTitle: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: spacing[2] + 2,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    desc: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        lineHeight: 18,
        marginBottom: spacing[2] + 2,
    },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[2] + 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLabel: { fontSize: typography.sizes.label2, color: colors.text.secondary },
    rowValue: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        maxWidth: '60%',
        textAlign: 'right',
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
    statCellBorder: { borderLeftWidth: 1, borderLeftColor: colors.border.subtle },
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

    // ── Vehicle switcher ──────────────────────────────────────────────────────
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    vehicleModel: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    vehicleVin: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        marginTop: 2,
    },
    activePill: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.full,
        backgroundColor: colors.status.good,
    },
    activePillText: { color: '#FFFFFF', fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },
    switchBtn: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.accent.default,
    },
    switchBtnText: { color: colors.accent.default, fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },

    // ── Input ─────────────────────────────────────────────────────────────────
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
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
    inputUnit: { color: colors.text.secondary, fontSize: typography.sizes.label2, fontWeight: typography.weights.semibold },

    // ── Threshold editor ──────────────────────────────────────────────────────
    thrRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[2] + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    thrLabel: { fontSize: typography.sizes.label2, color: colors.text.primary },
    thrRange: { fontSize: typography.sizes.micro, color: colors.text.tertiary, marginTop: 2 },
    thrEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
    thrInput: {
        width: 70,
        backgroundColor: colors.bg[0],
        borderWidth: 1,
        borderColor: colors.accent.default,
        borderRadius: radii.xs,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1] + 2,
        color: colors.text.primary,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        textAlign: 'center',
    },
    thrValueBtn: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    thrValue: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.accent.default,
        fontVariant: ['tabular-nums'],
    },
    thrUnit: { fontSize: typography.sizes.caption, color: colors.text.secondary },

    // ── Notifications switch ──────────────────────────────────────────────────
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    switchLabel: { fontSize: typography.sizes.label1, fontWeight: typography.weights.semibold, color: colors.text.primary, marginBottom: 2 },
    switchDesc: { fontSize: typography.sizes.caption, color: colors.text.secondary },

    // ── Connection ────────────────────────────────────────────────────────────
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
    connDot: { width: 8, height: 8, borderRadius: radii.full },
    connBadgeLabel: { fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },
    connPing: { fontSize: typography.sizes.caption, color: colors.text.secondary, marginLeft: spacing[1] },

    // ── Buttons ───────────────────────────────────────────────────────────────
    solidBtn: {
        backgroundColor: colors.accent.default,
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2],
        borderRadius: radii.xs,
        alignItems: 'center',
        minWidth: 80,
    },
    solidBtnDisabled: { opacity: 0.5 },
    solidBtnText: { color: '#FFFFFF', fontWeight: typography.weights.bold, fontSize: typography.sizes.label2 },

    outlineBtn: {
        marginTop: spacing[3],
        paddingVertical: spacing[2] + 2,
        borderWidth: 1,
        borderColor: colors.accent.default,
        borderRadius: radii.xs,
        alignItems: 'center',
    },
    outlineBtnText: { color: colors.accent.default, fontSize: typography.sizes.label2, fontWeight: typography.weights.bold },

    outlineSmBtn: {
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.xs,
        backgroundColor: colors.bg[2],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    outlineSmBtnText: { fontSize: typography.sizes.caption, color: colors.accent.default, fontWeight: typography.weights.semibold },

    outlineBtn2: {
        backgroundColor: colors.bg[2],
        paddingHorizontal: spacing[3] + 2,
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    outlineBtn2Text: { color: colors.accent.default, fontWeight: typography.weights.bold, fontSize: typography.sizes.label2 },

    // ── Danger ────────────────────────────────────────────────────────────────
    dangerCard: { borderColor: colors.status.critical },
    dangerBtn: {
        marginTop: spacing[2],
        backgroundColor: colors.tint?.critical || 'rgba(255,59,48,0.12)',
        borderWidth: 1,
        borderColor: colors.status.critical,
        paddingVertical: spacing[3],
        borderRadius: radii.xs,
        alignItems: 'center',
    },
    dangerBtnText: { color: colors.status.critical, fontWeight: typography.weights.bold, fontSize: typography.sizes.label2 },
});

export default SettingsScreen;
