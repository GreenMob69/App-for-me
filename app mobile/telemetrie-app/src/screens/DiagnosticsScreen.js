import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Platform, StatusBar } from 'react-native';
import api from '../services/api';

const DICTIONAR_EXPLICATIV = [
    { id: "P0101", tip: "DTC", titlu: "Senzor MAF - Semnal în afara limitelor", explicatie: "Senzorul care măsoară aerul nu funcționează corect. Mașina poate consuma mai mult sau nu mai trage.", actiune: "Verifică mufa sau curăță debitmetrul cu spray special.", cuvinte: ["maf", "aer", "debitmetru", "fum", "consum", "p0101"] },
    { id: "P0234", tip: "DTC", titlu: "Turbosuflantă - Suprapresiune (Overboost)", explicatie: "Turbina produce mai mult boost decât e normal. Mașina poate intra în Limp Mode.", actiune: "Verifică electrovalva N75, furtunașele de vacuum sau geometria variabilă.", cuvinte: ["turbo", "turbina", "presiune", "overboost", "p0234", "n75", "limp"] },
    { id: "17586", tip: "VAG", titlu: "Senzor temp. lichid răcire G62 - Intermitent", explicatie: "Senzorul de temperatură dă rateuri. Pornire greoaie dimineața, turație ridicată la relanti.", actiune: "Senzorul G62 este ieftin. Verifică și nivelul antigelului.", cuvinte: ["g62", "temperatura", "apa", "antigel", "pornire", "racire", "17586"] },
    { id: "PID 0x10", tip: "SENZOR", titlu: "Debitul Masic de Aer (MAF)", explicatie: "Măsoară în g/s cât aer intră. La relanti: 5-7 g/s, la sarcină maximă: >110 g/s.", actiune: "Dacă valoarea nu crește la accelerație, debitmetrul e defect.", cuvinte: ["maf", "aer", "debit", "grame", "admisie"] },
    { id: "PID 0x0B", tip: "SENZOR", titlu: "Presiunea Galerie Admisie (MAP / Boost)", explicatie: "100 kPa = presiune atmosferică. Peste 100 = boost de la turbo. La sarcină maximă: ~200 kPa.", actiune: "La Audi 2.5 TDI valoarea trebuie să ajungă la ~210 kPa în sarcină.", cuvinte: ["map", "turbo", "boost", "presiune", "bar", "kpa"] },
    { id: "PID 0x42", tip: "ELECTRIC", titlu: "Tensiune ECU & Alternator", explicatie: "Cu motorul oprit: ~12.5V. Cu motorul pornit: 13.8-14.4V (alternator încarcă).", actiune: "Sub 13.5V cu motorul pornit = problemă alternator sau curea.", cuvinte: ["baterie", "alternator", "voltaj", "tensiune", "incarcare"] },
    { id: "VP37", tip: "MECANIC", titlu: "Pompa de Injecție Bosch VP37", explicatie: "Inima motorului 2.5 TDI. Pompă mecanică controlată electronic, distribuie motorina la cele 5 injectoare.", actiune: "Dacă pornește greu la cald: verifică avansul mecanic din curea.", cuvinte: ["pompa", "injectie", "vp37", "bosch", "diesel", "avans", "injectoare"] },
];

const levenshtein = (a = "", b = "") => {
    const s1 = a.toLowerCase().trim(); const s2 = b.toLowerCase().trim();
    if (!s1.length) return s2.length; if (!s2.length) return s1.length;
    const mx = [];
    for (let i = 0; i <= s2.length; i++) mx[i] = [i];
    for (let j = 0; j <= s1.length; j++) mx[0][j] = j;
    for (let i = 1; i <= s2.length; i++)
        for (let j = 1; j <= s1.length; j++)
            mx[i][j] = s2[i-1] === s1[j-1] ? mx[i-1][j-1] : Math.min(mx[i-1][j-1]+1, mx[i][j-1]+1, mx[i-1][j]+1);
    return mx[s2.length][s1.length];
};

const DiagnosticsScreen = () => {
    const [diagData, setDiagData] = useState(null);
    const [intelligence, setIntelligence] = useState(null);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedDiag, setExpandedDiag] = useState(null);

    const fetchDiagnostics = async () => {
        setLoading(true);
        try {
            const [diagRes, tripsRes] = await Promise.all([
                api.get('/vehicul/WAUZZZ4A1RN000000/diagnoza'),
                api.get('/calatorii')
            ]);
            setDiagData(diagRes.data);

            const trips = tripsRes.data || [];
            if (trips.length > 0) {
                const lastTrip = trips[0];
                try {
                    const analysisRes = await api.get(`/calatorii/${lastTrip.id_calatorie}/analiza`);
                    if (analysisRes.data?.ai) {
                        setIntelligence(analysisRes.data.ai);
                    }
                } catch (e) {}
            }
        } catch (error) {
            console.error('[DIAG]', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDiagnostics(); }, []);

    const rezultateCautare = useMemo(() => {
        if (!searchQuery.trim()) return DICTIONAR_EXPLICATIV;
        const terms = searchQuery.toLowerCase().trim().split(' ');
        return DICTIONAR_EXPLICATIV.map(item => {
            let score = 0;
            if (item.id.toLowerCase().includes(searchQuery.toLowerCase())) score += 100;
            if (item.titlu.toLowerCase().includes(searchQuery.toLowerCase())) score += 50;
            item.cuvinte.forEach(kw => {
                terms.forEach(t => {
                    if (kw.includes(t)) score += 40;
                    else if (levenshtein(kw, t) <= 1) score += 25;
                    else if (levenshtein(kw, t) <= 2 && t.length > 4) score += 15;
                });
            });
            return { ...item, score };
        }).filter(i => i.score > 0).sort((a, b) => b.score - a.score);
    }, [searchQuery]);

    const handleClearDTC = () => {
        Alert.alert("Ștergere Erori", "Ștergi memoria de erori și stingi Check Engine?", [
            { text: "Anulează", style: "cancel" },
            { text: "Șterge", style: "destructive", onPress: async () => {
                setClearing(true);
                try {
                    await api.post('/vehicul/WAUZZZ4A1RN000000/stergere-erori');
                    await fetchDiagnostics();
                } catch (e) { Alert.alert("Eroare", "Comanda a eșuat."); }
                finally { setClearing(false); }
            }}
        ]);
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#58a6ff" />
                <Text style={{ color: '#8b949e', marginTop: 12 }}>Se interoghează ECU...</Text>
            </View>
        );
    }

    const { sistem_electric, coduri_dtc } = diagData || { sistem_electric: {}, coduri_dtc: [] };
    const aiDiagnostics = intelligence?.intelligence?.diagnostics || [];
    const aiPredictions = intelligence?.intelligence?.predictions || [];
    const aiReliability = intelligence?.intelligence?.reliability || {};

    return (
        <View style={styles.container}>
            {/* Search */}
            <View style={styles.searchBar}>
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Caută: turbo, baterie, P0101..."
                    placeholderTextColor="#484f58"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>X</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                {/* Dacă caută — arată rezultate */}
                {searchQuery.trim() !== '' ? (
                    <View>
                        <Text style={styles.sectionTitle}>Rezultate ({rezultateCautare.length})</Text>
                        {rezultateCautare.length === 0 ? (
                            <Text style={styles.emptyText}>Niciun rezultat pentru „{searchQuery}"</Text>
                        ) : (
                            rezultateCautare.map((item, idx) => (
                                <View key={idx} style={styles.dictCard}>
                                    <View style={styles.dictHeader}>
                                        <Text style={styles.dictId}>{item.id}</Text>
                                        <View style={styles.dictBadge}><Text style={styles.dictBadgeText}>{item.tip}</Text></View>
                                    </View>
                                    <Text style={styles.dictTitle}>{item.titlu}</Text>
                                    <View style={styles.explainBox}>
                                        <Text style={styles.explainText}>{item.explicatie}</Text>
                                    </View>
                                    <View style={styles.actionBox}>
                                        <Text style={styles.actionText}>{item.actiune}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    <View>
                        {/* HEADER */}
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>Diagnoză</Text>
                            <TouchableOpacity style={styles.refreshBtn} onPress={fetchDiagnostics}>
                                <Text style={styles.refreshBtnText}>Scan</Text>
                            </TouchableOpacity>
                        </View>

                        {/* DIAGNOSTICE AI REALE (din ultima cursă) */}
                        {aiDiagnostics.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Diagnostice Active</Text>
                                <Text style={styles.sectionSubtitle}>Ultima cursă analizată</Text>
                                {aiDiagnostics.map((diag, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.diagCard, { borderLeftColor: diag.confidence >= 70 ? '#f85149' : diag.confidence >= 40 ? '#d29922' : '#30363d' }]}
                                        onPress={() => setExpandedDiag(expandedDiag === idx ? null : idx)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.diagHeader}>
                                            <Text style={styles.diagName}>{diag.description || diag.ruleId}</Text>
                                            <Text style={[styles.diagConfidence, { color: diag.confidence >= 70 ? '#f85149' : '#d29922' }]}>
                                                {diag.confidence}%
                                            </Text>
                                        </View>
                                        {diag.severity && (
                                            <Text style={styles.diagSeverity}>Severitate: {diag.severity}</Text>
                                        )}
                                        {expandedDiag === idx && (
                                            <View style={styles.diagExpanded}>
                                                {diag.factors && diag.factors.length > 0 && (
                                                    <View style={styles.factorsBox}>
                                                        <Text style={styles.factorsTitle}>Factori detectați:</Text>
                                                        {diag.factors.map((f, fi) => (
                                                            <Text key={fi} style={styles.factorItem}>
                                                                {f.parameter}: {f.value} (deviere {f.deviation}%)
                                                            </Text>
                                                        ))}
                                                    </View>
                                                )}
                                                {diag.recommendation && (
                                                    <View style={styles.actionBox}>
                                                        <Text style={styles.actionText}>{diag.recommendation}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* PREDICȚII */}
                        {aiPredictions.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Predicții</Text>
                                {aiPredictions.filter(p => p.probability > 20).slice(0, 4).map((pred, idx) => (
                                    <View key={idx} style={styles.predCard}>
                                        <View style={styles.predHeader}>
                                            <Text style={styles.predComponent}>{pred.component}</Text>
                                            <Text style={[styles.predProb, { color: pred.probability >= 60 ? '#f85149' : '#d29922' }]}>
                                                {pred.probability}%
                                            </Text>
                                        </View>
                                        {pred.remainingKm && <Text style={styles.predKm}>~{pred.remainingKm} km rămași</Text>}
                                        {pred.recommendation && <Text style={styles.predRec}>{pred.recommendation}</Text>}
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* SISTEM ELECTRIC */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Sistem Electric</Text>
                            <View style={styles.electricCard}>
                                <View style={styles.electricRow}>
                                    <View style={styles.electricItem}>
                                        <Text style={styles.electricLabel}>Voltaj</Text>
                                        <Text style={styles.electricValue}>{sistem_electric.voltaj_curent || 0} V</Text>
                                    </View>
                                    <View style={styles.electricItem}>
                                        <Text style={styles.electricLabel}>Baterie SOH</Text>
                                        <Text style={[styles.electricValue, { color: '#3fb950' }]}>{sistem_electric.baterie_soh_pct || 0}%</Text>
                                    </View>
                                    <View style={styles.electricItem}>
                                        <Text style={styles.electricLabel}>Alternator</Text>
                                        <Text style={[styles.electricValue, { color: sistem_electric.stare_alternator === 'OPTIM' ? '#3fb950' : '#f85149', fontSize: 12 }]}>
                                            {sistem_electric.stare_alternator === 'OPTIM' ? 'Normal' : 'Verifică'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* DTC */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Coduri Eroare: <Text style={{ color: coduri_dtc.length > 0 ? '#f85149' : '#3fb950' }}>{coduri_dtc.length} active</Text>
                            </Text>
                            {coduri_dtc.length === 0 ? (
                                <View style={styles.cleanCard}>
                                    <Text style={styles.cleanTitle}>Niciun cod de eroare</Text>
                                    <Text style={styles.cleanText}>Sistemele electronice funcționează normal.</Text>
                                </View>
                            ) : (
                                coduri_dtc.map((item, idx) => {
                                    const trad = DICTIONAR_EXPLICATIV.find(d => d.id === item.cod);
                                    return (
                                        <View key={idx} style={[styles.dtcCard, { borderLeftColor: item.severitate === 'CRITICAL' ? '#da3633' : '#d29922' }]}>
                                            <View style={styles.dtcHeader}>
                                                <Text style={styles.dtcCode}>{item.cod}</Text>
                                                <Text style={styles.dtcModule}>{item.modul}</Text>
                                            </View>
                                            <Text style={styles.dtcDesc}>{item.descriere}</Text>
                                            {trad && (
                                                <View style={styles.explainBox}>
                                                    <Text style={styles.explainText}>{trad.explicatie}</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                            {coduri_dtc.length > 0 && (
                                <TouchableOpacity style={[styles.clearDtcBtn, clearing && { opacity: 0.5 }]} onPress={handleClearDTC} disabled={clearing}>
                                    <Text style={styles.clearDtcText}>{clearing ? "Se șterge..." : "Șterge erori & stinge Check Engine"}</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* RELIABILITY (dacă e disponibil) */}
                        {aiReliability.overallGrade && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Fiabilitate Analiză</Text>
                                <View style={styles.reliabilityCard}>
                                    <Text style={styles.reliabilityGrade}>Grad: {aiReliability.overallGrade}</Text>
                                    <Text style={styles.reliabilityText}>Scor: {aiReliability.overallScore || 0}%</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d1117', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44 },
    scroll: { flex: 1, paddingHorizontal: 16 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22',
        marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, borderRadius: 10,
        borderWidth: 1, borderColor: '#30363d',
    },
    searchInput: { flex: 1, color: '#ffffff', fontSize: 14, paddingVertical: 12, fontWeight: '600' },
    clearBtn: { padding: 6, backgroundColor: '#21262d', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    refreshBtn: { backgroundColor: '#21262d', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },
    refreshBtnText: { color: '#58a6ff', fontWeight: '700', fontSize: 12 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 12, color: '#c9d1d9', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
    sectionSubtitle: { fontSize: 11, color: '#8b949e', marginBottom: 8, marginTop: -4 },
    emptyText: { color: '#8b949e', textAlign: 'center', padding: 30 },

    // AI diagnostics
    diagCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#30363d', borderLeftWidth: 4 },
    diagHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    diagName: { fontSize: 13, fontWeight: '700', color: '#ffffff', flex: 1, paddingRight: 8 },
    diagConfidence: { fontSize: 16, fontWeight: '900' },
    diagSeverity: { fontSize: 11, color: '#8b949e', marginTop: 4 },
    diagExpanded: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#21262d', paddingTop: 10 },
    factorsBox: { marginBottom: 8 },
    factorsTitle: { fontSize: 10, color: '#8b949e', fontWeight: '700', marginBottom: 4 },
    factorItem: { fontSize: 11, color: '#c9d1d9', marginLeft: 8, marginBottom: 2 },

    // Predictions
    predCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#30363d' },
    predHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    predComponent: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
    predProb: { fontSize: 15, fontWeight: '900' },
    predKm: { fontSize: 11, color: '#8b949e', marginTop: 4 },
    predRec: { fontSize: 11, color: '#c9d1d9', marginTop: 4 },

    // Electric
    electricCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#30363d' },
    electricRow: { flexDirection: 'row', justifyContent: 'space-around' },
    electricItem: { alignItems: 'center' },
    electricLabel: { fontSize: 10, color: '#8b949e', fontWeight: '600', marginBottom: 4 },
    electricValue: { fontSize: 16, fontWeight: '800', color: '#ffffff' },

    // DTC
    cleanCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#238636' },
    cleanTitle: { fontSize: 14, fontWeight: '700', color: '#3fb950', marginBottom: 4 },
    cleanText: { fontSize: 12, color: '#8b949e' },
    dtcCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#30363d', borderLeftWidth: 4 },
    dtcHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    dtcCode: { fontSize: 16, fontWeight: '900', color: '#ffffff' },
    dtcModule: { fontSize: 10, color: '#8b949e', fontWeight: '700', backgroundColor: '#21262d', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    dtcDesc: { fontSize: 12, color: '#c9d1d9', lineHeight: 17 },
    clearDtcBtn: { backgroundColor: '#da3633', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 8 },
    clearDtcText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

    // Explain/Action boxes
    explainBox: { backgroundColor: 'rgba(88, 166, 255, 0.06)', borderRadius: 6, padding: 10, marginTop: 8, borderWidth: 1, borderColor: 'rgba(88, 166, 255, 0.15)' },
    explainText: { color: '#c9d1d9', fontSize: 12, lineHeight: 17 },
    actionBox: { backgroundColor: 'rgba(63, 185, 80, 0.06)', borderRadius: 6, padding: 10, marginTop: 6, borderWidth: 1, borderColor: 'rgba(63, 185, 80, 0.15)' },
    actionText: { color: '#c9d1d9', fontSize: 12, lineHeight: 17 },

    // Dictionary cards
    dictCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#30363d' },
    dictHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    dictId: { color: '#58a6ff', fontWeight: '800', fontSize: 14 },
    dictBadge: { backgroundColor: '#21262d', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    dictBadgeText: { color: '#8b949e', fontSize: 9, fontWeight: '700' },
    dictTitle: { color: '#ffffff', fontSize: 13, fontWeight: '600', marginBottom: 6 },

    // Reliability
    reliabilityCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#30363d', flexDirection: 'row', justifyContent: 'space-between' },
    reliabilityGrade: { color: '#3fb950', fontWeight: '700', fontSize: 14 },
    reliabilityText: { color: '#8b949e', fontSize: 13 },
});

export default DiagnosticsScreen;
