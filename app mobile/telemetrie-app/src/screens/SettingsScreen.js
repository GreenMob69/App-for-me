import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, Alert, Switch, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useContext } from 'react';
import { SecurityContext } from '../context/SecurityContext';
import { AppContext } from '../context/AppContext';
import { getActiveServerUrl, setCustomServerUrl } from '../utils/config';
import { useVehicle } from '../context/VehicleContext';
import { Linking } from 'react-native';
import api from '../services/api';
import socketService from '../services/socket';
import { colors, typography, radii, spacing, layout, TEMPLATES } from '../theme';
import { CockpitVisualPreview } from '../components/ui';

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

// ─── VIN validation ───────────────────────────────────────────────────────────

const VIN_TRANS = {
    A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,
    J:1,K:2,L:3,M:4,N:5,P:7,R:9,
    S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,
};
const VIN_WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

const getVinStatus = (raw) => {
    if (!raw) return { ok: false, level: 'idle', msg: '' };
    const v = raw.toUpperCase();
    if (v.length < 17) return { ok: false, level: 'neutral', msg: `${v.length}/17 caractere` };
    if (v.length > 17) return { ok: false, level: 'bad', msg: 'Prea lung (max 17 caractere)' };
    if (/[IOQ]/.test(v)) return { ok: false, level: 'bad', msg: 'Conține litere interzise (I, O, Q)' };
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return { ok: false, level: 'bad', msg: 'Caractere invalide detectate' };
    let sum = 0;
    for (let i = 0; i < 17; i++) {
        const c = v[i];
        const val = c >= '0' && c <= '9' ? parseInt(c) : VIN_TRANS[c];
        sum += (val || 0) * VIN_WEIGHTS[i];
    }
    const rem = sum % 11;
    const expected = rem === 10 ? 'X' : String(rem);
    if (v[8] !== expected) return { ok: false, level: 'warn', msg: `Cifra de control greșită (așteptat: ${expected})` };
    return { ok: true, level: 'ok', msg: 'VIN valid' };
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

const TIMEOUT_OPTIONS = [
    { label: 'Imediat',  value: 0   },
    { label: '1 minut',  value: 60  },
    { label: '5 minute', value: 300 },
];

const SettingsScreen = () => {
    const navigation = useNavigation();
    const { securityEnabled, lockTimeout, saveSettings } = useContext(SecurityContext);
    const { activeVin, activeVehicle, vehicles, switchVehicle, refreshVehicles } = useVehicle();
    const { activeTemplate, setActiveTemplate } = useContext(AppContext);

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

    // ── Alert thresholds
    const [thresholds, setThresholds]   = useState(DEFAULT_THRESHOLDS);
    const [editingKey, setEditingKey]   = useState(null);
    const [editVal,    setEditVal]      = useState('');
    const [thrSaved,   setThrSaved]     = useState(false);

    // ── Notifications toggle (stored, read by AlertContext)
    const [notifsEnabled, setNotifsEnabled] = useState(true);

    // ── Vehicle profile inline editing
    const [editTankCap,   setEditTankCap]   = useState(false);
    const [tankCapVal,    setTankCapVal]    = useState('');
    const [editOdo,       setEditOdo]       = useState(false);
    const [odoVal,        setOdoVal]        = useState('');
    const [savingVehicle, setSavingVehicle] = useState(false);
    const [editVin,       setEditVin]       = useState(false);
    const [vinInputVal,   setVinInputVal]   = useState('');
    const [savingVin,     setSavingVin]     = useState(false);

    // ── Realimentare
    const [refuels,         setRefuels]         = useState([]);
    const [showRefuelForm,  setShowRefuelForm]   = useState(false);
    const [refuelLitri,     setRefuelLitri]      = useState('');
    const [refuelPret,      setRefuelPret]       = useState('');
    const [refuelKm,        setRefuelKm]         = useState('');
    const [savingRefuel,    setSavingRefuel]      = useState(false);

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

            if (activeVin) {
                try {
                    const [statsRes, refuelsRes] = await Promise.all([
                        api.get(`/vehicul/${activeVin}/statistici`),
                        api.get(`/vehicul/${activeVin}/realimentari?limit=5`),
                    ]);
                    if (statsRes.data) setStats(statsRes.data);
                    if (Array.isArray(refuelsRes.data)) setRefuels(refuelsRes.data);
                } catch {}
            }
        };

        load();
        checkConnection();
        pingRef.current = setInterval(checkConnection, 15000);
        return () => clearInterval(pingRef.current);
    }, [checkConnection, activeVin]);

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
        await switchVehicle(vin);
        try {
            const res = await api.get(`/vehicul/${vin}/statistici`);
            if (res.data) setStats(res.data);
        } catch {}
    };

    const handleSaveVin = async () => {
        const v = vinInputVal.toUpperCase().trim();
        const status = getVinStatus(v);
        if (!status.ok) return;
        setSavingVin(true);
        try {
            await switchVehicle(v);
            try {
                const sRes = await api.get(`/vehicul/${v}/statistici`);
                if (sRes.data) setStats(sRes.data);
            } catch {}
            setEditVin(false);
            Alert.alert('Salvat', `VIN activat: ${v}`);
        } catch {
            Alert.alert('Eroare', 'Nu s-a putut salva VIN-ul.');
        } finally {
            setSavingVin(false);
        }
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

    const handleSaveRefuel = async () => {
        const litri = parseFloat(refuelLitri);
        if (!litri || litri <= 0) return Alert.alert('Eroare', 'Introdu un volum valid (litri).');
        setSavingRefuel(true);
        try {
            await api.post(`/vehicul/${activeVin}/realimentare`, {
                litri,
                pret_pe_litru: parseFloat(refuelPret || 0),
                odometru_km:   parseFloat(refuelKm || 0),
            });
            const res = await api.get(`/vehicul/${activeVin}/realimentari?limit=5`);
            if (Array.isArray(res.data)) setRefuels(res.data);
            setRefuelLitri(''); setRefuelPret(''); setRefuelKm('');
            setShowRefuelForm(false);
            Alert.alert('Salvat', `${litri} L adăugate în istoric.`);
        } catch { Alert.alert('Eroare', 'Nu s-a putut salva realimentarea.'); }
        finally { setSavingRefuel(false); }
    };

    const handleSaveVehicleField = async (field, rawVal) => {
        const num = parseFloat(rawVal);
        if (isNaN(num) || num < 0) return;
        setSavingVehicle(true);
        try {
            await api.patch(`/vehicul/${activeVin}/profil`, { [field]: num });
            await refreshVehicles();
        } catch {
            Alert.alert('Eroare', 'Nu s-a putut salva.');
        } finally {
            setSavingVehicle(false);
        }
    };

    const handleResetThresholds = async () => {
        setThresholds({ ...DEFAULT_THRESHOLDS });
        try {
            await AsyncStorage.setItem('@alert_thresholds', JSON.stringify(DEFAULT_THRESHOLDS));
            setThrSaved(true);
            setTimeout(() => setThrSaved(false), 2000);
        } catch {}
    };

    const handleExportJSON = async () => {
        const url = `${getActiveServerUrl()}/api/export?vin=${activeVin}`;
        try { await Linking.openURL(url); }
        catch { Alert.alert('Eroare', 'Nu s-a putut deschide exportul.'); }
    };

    // ─── Derived ──────────────────────────────────────────────────────────────

    const connColor = STATUS_COLORS[connStatus];
    const connLabel = STATUS_LABELS[connStatus];
    const totalCost = (stats?.total_combustibil || 0) * parseFloat(fuelPrice || 0);
    const avgCons   = stats?.total_km > 0 && stats?.total_combustibil > 0
        ? ((stats.total_combustibil / stats.total_km) * 100).toFixed(1)
        : null;

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                    {navigation?.canGoBack() && (
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => navigation.goBack()}
                            accessibilityRole="button"
                            accessibilityLabel="Înapoi"
                        >
                            <Text style={styles.backBtnText}>←</Text>
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Setări</Text>
                        <Text style={styles.subtitle}>Configurare · Vehicul · Preferințe</Text>
                    </View>
                </View>
            </View>

            {/* ── Profil Vehicul ─────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Profil Vehicul</SectionTitle>
                <Row label="Model" value={activeVehicle?.model || '—'} />

                {/* VIN — editabil cu validare */}
                {editVin ? (
                    <View style={styles.vinEditContainer}>
                        <View style={styles.vinInputRow}>
                            <TextInput
                                style={styles.vinInput}
                                value={vinInputVal}
                                onChangeText={t => setVinInputVal(
                                    t.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(0, 17)
                                )}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={17}
                                placeholder="ex: WAUZZZ4A1RN000000"
                                placeholderTextColor={colors.text.disabled}
                                autoFocus
                            />
                            <Text style={styles.vinCounter}>{vinInputVal.length}/17</Text>
                        </View>
                        {vinInputVal.length > 0 && (() => {
                            const s = getVinStatus(vinInputVal);
                            const color = s.level === 'ok'      ? colors.status.good
                                        : s.level === 'warn'    ? colors.status.monitor
                                        : s.level === 'bad'     ? colors.status.critical
                                        : colors.text.secondary;
                            return <Text style={[styles.vinStatusMsg, { color }]}>{s.msg}</Text>;
                        })()}
                        <View style={styles.vinBtnRow}>
                            <TouchableOpacity style={styles.outlineSmBtn} onPress={() => setEditVin(false)}>
                                <Text style={styles.outlineSmBtnText}>Anulează</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.solidBtn, (!getVinStatus(vinInputVal).ok || savingVin) && styles.solidBtnDisabled]}
                                onPress={handleSaveVin}
                                disabled={!getVinStatus(vinInputVal).ok || savingVin}
                            >
                                <Text style={styles.solidBtnText}>{savingVin ? '...' : 'Salvează'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => { setVinInputVal(activeVehicle?.vin || activeVin || ''); setEditVin(true); }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.rowLabel}>VIN</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={[styles.rowValue, { fontSize: typography.sizes.caption }]}>
                                {activeVehicle?.vin || activeVin || 'Introdu ✎'}
                            </Text>
                            <Text style={styles.editHint}>✎</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Rezervor — editabil */}
                {editTankCap ? (
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>Rezervor</Text>
                        <View style={styles.thrEditRow}>
                            <TextInput
                                style={styles.thrInput}
                                value={tankCapVal}
                                onChangeText={setTankCapVal}
                                keyboardType="numeric"
                                autoFocus
                                onBlur={async () => {
                                    await handleSaveVehicleField('capacitate_rezervor_l', tankCapVal);
                                    setEditTankCap(false);
                                }}
                            />
                            <Text style={styles.thrUnit}>L</Text>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => { setTankCapVal(String(activeVehicle?.capacitate_rezervor_l || 80)); setEditTankCap(true); }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.rowLabel}>Rezervor</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={styles.rowValue}>{activeVehicle?.capacitate_rezervor_l || 80} L</Text>
                            <Text style={styles.editHint}>✎</Text>
                        </View>
                    </TouchableOpacity>
                )}

                <Row label="Combustibil" value={activeVehicle?.tip_combustibil
                    ? activeVehicle.tip_combustibil.charAt(0).toUpperCase() + activeVehicle.tip_combustibil.slice(1)
                    : 'Diesel'} />

                {/* Odometru calibrat — editabil */}
                {editOdo ? (
                    <View style={[styles.row, styles.rowLast]}>
                        <Text style={styles.rowLabel}>Odometru calibrat</Text>
                        <View style={styles.thrEditRow}>
                            <TextInput
                                style={[styles.thrInput, { width: 90 }]}
                                value={odoVal}
                                onChangeText={setOdoVal}
                                keyboardType="numeric"
                                autoFocus
                                onBlur={async () => {
                                    await handleSaveVehicleField('odometru_calibrat_km', odoVal);
                                    setEditOdo(false);
                                }}
                            />
                            <Text style={styles.thrUnit}>km</Text>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.row, styles.rowLast]}
                        onPress={() => { setOdoVal(String(activeVehicle?.odometru_calibrat_km > 0 ? activeVehicle.odometru_calibrat_km : '')); setEditOdo(true); }}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.rowLabel}>Odometru calibrat</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={activeVehicle?.odometru_calibrat_km > 0 ? styles.rowValue : styles.editHintMain}>
                                {activeVehicle?.odometru_calibrat_km > 0
                                    ? `${activeVehicle.odometru_calibrat_km.toLocaleString('ro-RO')} km`
                                    : 'Introdu ✎'}
                            </Text>
                            {activeVehicle?.odometru_calibrat_km > 0 && <Text style={styles.editHint}>✎</Text>}
                        </View>
                    </TouchableOpacity>
                )}

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

            {/* ── Șabloane Cockpit & Design HMI ─────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Șabloane Cockpit (Design Templates)</SectionTitle>
                <Text style={styles.desc}>
                    Alege stilul vizual și structura preferată pentru bord, inspirate de cele mai bune interfețe din motorsport și mașini electrice:
                </Text>

                <View style={styles.templateGrid}>
                    {Object.values(TEMPLATES).map(tpl => {
                        const isSelected = activeTemplate === tpl.id;
                        return (
                            <TouchableOpacity
                                key={tpl.id}
                                style={[
                                    styles.templateCard,
                                    { borderColor: isSelected ? tpl.accent : colors.border.default },
                                    isSelected && styles.templateCardSelected,
                                ]}
                                onPress={() => setActiveTemplate(tpl.id)}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={`Alege șablonul ${tpl.name}`}
                            >
                                <CockpitVisualPreview
                                    templateId={tpl.id}
                                    isSelected={isSelected}
                                    width={138}
                                    height={68}
                                />
                                <View style={styles.templateHeader}>
                                    <View style={[styles.templateColorDot, { backgroundColor: tpl.accent }]} />
                                    <View style={[styles.templateBadge, { backgroundColor: tpl.tagBg }]}>
                                        <Text style={[styles.templateBadgeText, { color: tpl.accent }]}>{tpl.badge}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.templateName, isSelected && { color: tpl.accent }]}>{tpl.name}</Text>
                                <Text style={styles.templateSub}>{tpl.subtitle}</Text>
                                {isSelected && (
                                    <View style={[styles.templateActiveIndicator, { backgroundColor: tpl.accent }]}>
                                        <Text style={styles.templateActiveText}>✓ ACTIV</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

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
                <TouchableOpacity style={styles.resetThreshBtn} onPress={handleResetThresholds}>
                    <Text style={styles.resetThreshText}>Resetează la valorile implicite</Text>
                </TouchableOpacity>
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

            {/* ── Securitate ─────────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Securitate</SectionTitle>
                <Text style={styles.desc}>
                    Protejează accesul la datele vehiculului cu amprentă, Face ID sau PIN-ul telefonului.
                </Text>
                <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Blocare biometrică</Text>
                        <Text style={styles.switchDesc}>
                            Cere autentificare la deschiderea aplicației.
                        </Text>
                    </View>
                    <Switch
                        value={securityEnabled}
                        onValueChange={(v) => saveSettings(v, lockTimeout)}
                        trackColor={{ false: colors.border.default, true: colors.accent.default }}
                        thumbColor={securityEnabled ? '#FFFFFF' : colors.text.secondary}
                    />
                </View>
                {securityEnabled && (
                    <View style={{ marginTop: spacing[3] }}>
                        <Text style={[styles.desc, { marginBottom: spacing[2] }]}>
                            Blochează după:
                        </Text>
                        <View style={styles.timeoutRow}>
                            {TIMEOUT_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                        styles.timeoutBtn,
                                        lockTimeout === opt.value && styles.timeoutBtnActive,
                                    ]}
                                    onPress={() => saveSettings(true, opt.value)}
                                >
                                    <Text style={[
                                        styles.timeoutBtnText,
                                        lockTimeout === opt.value && styles.timeoutBtnTextActive,
                                    ]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
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

            {/* ── Realimentare ───────────────────────────────────────────── */}
            <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                    <SectionTitle>Realimentare</SectionTitle>
                    <TouchableOpacity
                        style={styles.outlineSmBtn}
                        onPress={() => setShowRefuelForm(v => !v)}
                    >
                        <Text style={styles.outlineSmBtnText}>{showRefuelForm ? '✕ Anulează' : '+ Adaugă'}</Text>
                    </TouchableOpacity>
                </View>

                {showRefuelForm && (
                    <View style={styles.refuelForm}>
                        <View style={styles.refuelRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Litri *"
                                placeholderTextColor={colors.text.disabled}
                                keyboardType="decimal-pad"
                                value={refuelLitri}
                                onChangeText={setRefuelLitri}
                            />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="RON/L"
                                placeholderTextColor={colors.text.disabled}
                                keyboardType="decimal-pad"
                                value={refuelPret}
                                onChangeText={setRefuelPret}
                            />
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Km odometru"
                                placeholderTextColor={colors.text.disabled}
                                keyboardType="decimal-pad"
                                value={refuelKm}
                                onChangeText={setRefuelKm}
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.outlineBtn, savingRefuel && { opacity: 0.5 }]}
                            onPress={handleSaveRefuel}
                            disabled={savingRefuel}
                        >
                            <Text style={styles.outlineBtnText}>
                                {savingRefuel ? 'Se salvează...' : 'Salvează'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {refuels.length > 0 ? refuels.map((r, i) => (
                    <View key={r.id} style={[styles.row, i === refuels.length - 1 && styles.rowLast]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowLabel}>
                                {new Date(r.timestamp).toLocaleDateString('ro-RO')}
                                {r.odometru_km > 0 ? `  ·  ${r.odometru_km.toLocaleString()} km` : ''}
                            </Text>
                            {r.consum_real_100km && (
                                <Text style={styles.refuelConsum}>
                                    Consum real: {r.consum_real_100km} L/100km
                                </Text>
                            )}
                        </View>
                        <Text style={styles.rowValue}>
                            {r.litri} L
                            {r.pret_pe_litru > 0 ? `  ·  ${(r.litri * r.pret_pe_litru).toFixed(0)} RON` : ''}
                        </Text>
                    </View>
                )) : (
                    <Text style={[styles.desc, { marginTop: spacing[2] }]}>
                        Niciun istoric realimentare. Adaugă prima înregistrare.
                    </Text>
                )}
            </View>

            {/* ── Export date ────────────────────────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Export Date</SectionTitle>
                <Text style={styles.desc}>
                    Descarcă toate cursele și analizele ca fișier JSON.
                    Util pentru analiză în Python, Excel sau MATLAB.
                </Text>
                <TouchableOpacity style={styles.outlineBtn} onPress={handleExportJSON}>
                    <Text style={styles.outlineBtnText}>Export JSON complet →</Text>
                </TouchableOpacity>
            </View>

            {/* ── Opțiuni Dezvoltator / Proiect ─────────────────────────── */}
            <View style={styles.card}>
                <SectionTitle>Opțiuni Dezvoltator</SectionTitle>
                <Text style={styles.desc}>
                    Acces la biblioteca completă de componente UI și playground pentru testarea elementelor grafice ale aplicației.
                </Text>
                <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => navigation.navigate('UIPlayground')}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide UI Playground"
                >
                    <Text style={styles.outlineBtnText}>🎨 Biblioteca Componente UI (Playground) →</Text>
                </TouchableOpacity>
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
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backBtnText: {
        color: colors.text.primary,
        fontSize: typography.sizes.body,
        fontWeight: typography.weights.bold,
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
    templateGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: spacing[2],
        marginBottom: spacing[1],
    },
    templateCard: {
        width: '48.5%',
        backgroundColor: colors.bg[0],
        borderRadius: radii.md,
        padding: spacing[2] + 2,
        borderWidth: 1.5,
        marginBottom: spacing[3],
        alignItems: 'center',
    },
    templateCardSelected: {
        backgroundColor: colors.bg[2],
    },
    templateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginTop: 2,
        marginBottom: 4,
    },
    templateColorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    templateBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
    },
    templateBadgeText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    templateName: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: 2,
        textAlign: 'center',
        width: '100%',
    },
    templateSub: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        marginBottom: spacing[2],
        textAlign: 'center',
        width: '100%',
    },
    templateActiveIndicator: {
        alignSelf: 'center',
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 2,
        borderRadius: radii.xs,
    },
    templateActiveText: {
        color: '#000000',
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
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

    // ── Refuel ────────────────────────────────────────────────────────────────
    refuelForm: {
        marginTop: spacing[3],
        gap: spacing[2],
    },
    refuelRow: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    refuelConsum: {
        fontSize: typography.sizes.caption,
        color: colors.status.good,
        marginTop: 2,
    },

    // ── Editable vehicle fields ───────────────────────────────────────────────
    editHint: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        opacity: 0.7,
    },
    editHintMain: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.accent.default,
    },

    // ── VIN editor ────────────────────────────────────────────────────────────
    vinEditContainer: {
        paddingVertical: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing[2],
    },
    vinInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    vinInput: {
        flex: 1,
        backgroundColor: colors.bg[0],
        borderWidth: 1,
        borderColor: colors.accent.default,
        borderRadius: radii.xs,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2] + 2,
        color: colors.text.primary,
        fontSize: typography.sizes.label2,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: typography.weights.bold,
        letterSpacing: 1.5,
    },
    vinCounter: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        minWidth: 36,
        textAlign: 'right',
    },
    vinStatusMsg: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },
    vinBtnRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing[2],
        marginTop: spacing[1],
    },

    // ── Reset thresholds ──────────────────────────────────────────────────────
    resetThreshBtn: {
        marginTop: spacing[3],
        paddingVertical: spacing[1] + 2,
        alignItems: 'center',
    },
    resetThreshText: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        textDecorationLine: 'underline',
    },

    // ── Security timeout ──────────────────────────────────────────────────────
    timeoutRow: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    timeoutBtn: {
        flex: 1,
        paddingVertical: spacing[2] + 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        backgroundColor: colors.bg[0],
    },
    timeoutBtnActive: {
        borderColor: colors.accent.default,
        backgroundColor: colors.accent.default + '18',
    },
    timeoutBtnText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    timeoutBtnTextActive: {
        color: colors.accent.default,
    },

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
