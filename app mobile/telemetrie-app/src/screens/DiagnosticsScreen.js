import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import api from '../services/api';

// ============================================================================
// 1. ENCICLOPEDIA DE DIAGNOZĂ & TRADUCERI PENTRU OAMENI SIMPLI (HMI DICTIONARY)
// ============================================================================
const DICTIONAR_EXPLICATIV = [
    {
        id: "P0101",
        tip: "COD EROARE (DTC)",
        titlu_tehnic: "Senzor MAF (Debitul de aer) - Semnal în afara limitelor",
        explicatie_simpla: "Senzorul care funcționează ca «nasul» motorului nu mai măsoară corect cât aer intră. Mașina poate scoate fum, consumă mai multă motorină sau nu mai trage cum trebuie.",
        actiune_recomandata: "Verifică mufa senzorului de pe tubulatura de filtru sau curăță debitmetrul cu spray special.",
        cuvinte_cheie: ["maf", "aer", "debitmetru", "trage", "fum", "consum", "p0101", "sensor", "filtru"]
    },
    {
        id: "P0234",
        tip: "COD EROARE (DTC)",
        titlu_tehnic: "Turbosuflantă - Condiție de suprapresiune (Overboost)",
        explicatie_simpla: "Turbina bagă mai mult aer comprimat decât îi cere calculatorul motorului. Pentru siguranță, mașina ar putea intra în «Limpt Mode» (taie puterea ca să nu spargă motorul).",
        actiune_recomandata: "Verifică electrovalva N75, furtunașele de vacuum sau geometria variabilă a turbinei (se poate fi calaminat/blocat).",
        cuvinte_cheie: ["turbo", "turbina", "presiune", "overboost", "p0234", "n75", "vacuum", "putere", "limp"]
    },
    {
        id: "17586",
        tip: "COD VAG K-LINE",
        titlu_tehnic: "Senzor temperatură lichid răcire G62 - Semnal intermitent",
        explicatie_simpla: "Senzorul care citește cât de cald este motorul dă rateuri. Calculatorul crede că motorul e ba rece, ba fierbinte, motiv pentru care pornește greu dimineața sau ține turația ridicată la relanti.",
        actiune_recomandata: "Senzorul G62 (verde/albastru) este ieftin și ușor de schimbat. Verifică și nivelul antigelului.",
        cuvinte_cheie: ["g62", "temperatura", "apa", "antigel", "pornire", "relanti", "racire", "17586", "senzor"]
    },
    {
        id: "PID_0x10",
        tip: "SENZOR LIVE",
        titlu_tehnic: "Debitul Masic de Aer (MAF - Mass Air Flow)",
        explicatie_simpla: "Măsoară în grame pe secundă (g/s) exact cât aer respiră motorul. La un 2.5 TDI la relanti trebuie să ai jur de 5-7 g/s, iar în accelerație maximă peste 110 g/s.",
        actiune_recomandata: "Dacă valoarea rămâne blocată la 0 sau nu crește când calci accelerația, debitmetrul este defect.",
        cuvinte_cheie: ["maf", "aer", "debit", "grame", "admisie", "pid", "0x10"]
    },
    {
        id: "PID_0x0B",
        tip: "SENZOR LIVE",
        titlu_tehnic: "Presiunea în Galeria de Admisie (MAP / Boost)",
        explicatie_simpla: "Arată presiunea pe care o produce turbina, măsurată în kilopascali (kPa). 100 kPa înseamnă presiunea normală a aerului de afară. Tot ce trece de 100 este «boost-ul» dat de turbină!",
        actiune_recomandata: "În sarcină maximă, la Audi 2.5 TDI, valoarea trebuie să ajungă spre 200-210 kPa (adică o presiune efectivă de ~1.1 bar).",
        cuvinte_cheie: ["map", "turbo", "boost", "presiune", "admisie", "bar", "kpa", "0x0b"]
    },
    {
        id: "PID_0x42",
        tip: "SISTEM ELECTRIC",
        titlu_tehnic: "Tensiunea Modulului ECU & Alternator (Voltaj)",
        explicatie_simpla: "Este «tensiunea arterială» a mașinii. Cu motorul oprit, bateria trebuie să aibă ~12.5V. Când pornești motorul, alternatorul preia controlul și trebuie să încarce între 13.8V și 14.4V.",
        actiune_recomandata: "Dacă vezi sub 13.5V cu motorul mergând, alternatorul (sau cureaua lui) are probleme. Riști să rămâi fără baterie în mers!",
        cuvinte_cheie: ["baterie", "alternator", "voltaj", "curent", "tensiune", "incarcare", "0x42", "ecu"]
    },
    {
        id: "TERM_15_30",
        tip: "CONCEPT VAG",
        titlu_tehnic: "Terminal 15 (Contact) vs. Terminal 30 (Baterie Directă)",
        explicatie_simpla: "În limba electricienilor auto: «Terminalul 30» este firul care are curent permanent direct din baterie (pentru ceas, închidere centralizată). «Terminalul 15» primește curent DOAR după ce răsucești cheia în contact pentru pornire.",
        actiune_recomandata: "Când faci diagnoză, Terminalul 15 trebuie să fie absolut ON (cheia pusă pe poziția 2).",
        cuvinte_cheie: ["terminal", "contact", "cheie", "curent", "15", "30", "ignition", "baterie"]
    },
    {
        id: "VP37",
        tip: "MECANICĂ AUDI",
        titlu_tehnic: "Pompa de Injecție Rotativă Bosch VP37 (140 CP)",
        explicatie_simpla: "Inima motorului tău 2.5 TDI AEL! Nu este Common Rail, ci o pompă mecanică controlată electronic. Ea distribuie motorina către cele 5 injectoare la o presiune uriașă.",
        actiune_recomandata: "Dacă mașina pornește greu la cald sau tremură, de multe ori trebuie reglat «avansul mecanic» al acestei pompe din curea.",
        cuvinte_cheie: ["pompa", "injectie", "vp37", "bosch", "motorina", "diesel", "avans", "injectoare", "tdi"]
    }
];

// ============================================================================
// 2. ALGORITM DE FUZZY SEARCH (TOLERANȚĂ LA GREȘELI DE SCRIERE - TIP GOOGLE)
// ============================================================================
// Calculează distanța Levenshtein (câte litere trebuie modificate ca un cuvânt să devină celălalt)
const calculeazaDistantaLevenshtein = (str1 = "", str2 = "") => {
    const a = str1.toLowerCase().trim();
    const b = str2.toLowerCase().trim();
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // Înlocuire literă (ex: debImetru -> debItmetru)
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // Ștergere sau adăugare literă
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const DiagnosticsScreen = () => {
    const [diagData, setDiagData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);

    // Stare pentru motorul de căutare Google-Like
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDiagnostics = async () => {
        setLoading(true);
        try {
            const res = await api.get('/vehicul/WAUZZZ4A1RN000000/diagnoza');
            setDiagData(res.data);
        } catch (error) {
            console.error('[DIAG EROARE] Nu s-a putut contacta ECU:', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDiagnostics();
    }, []);

    // Funcția care filtrează și sortează inteligent rezultatele după relevanță
    const rezultateCautare = useMemo(() => {
        if (!searchQuery || searchQuery.trim() === '') {
            return DICTIONAR_EXPLICATIV; // Dacă nu cauți nimic, arată toată enciclopedia
        }

        const query = searchQuery.toLowerCase().trim();
        const termeni = query.split(' '); // Împărțim căutarea pe cuvinte

        return DICTIONAR_EXPLICATIV.map(item => {
            let scor = 0;

            // 1. Potrivire exactă sau parțială (Substring) pe ID, Titlu sau Explicație
            if (item.id.toLowerCase().includes(query)) scor += 100;
            if (item.titlu_tehnic.toLowerCase().includes(query)) scor += 50;
            if (item.explicatie_simpla.toLowerCase().includes(query)) scor += 30;

            // 2. Potrivire Fuzzy Levenshtein pe cuvinte cheie (Tolerează greșeli de scriere!)
            item.cuvinte_cheie.forEach(kw => {
                termeni.forEach(termen => {
                    if (kw.includes(termen)) {
                        scor += 40; // Potrivire parțială pe cuvânt cheie
                    } else {
                        const distanta = calculeazaDistantaLevenshtein(kw, termen);
                        // Dacă ai greșit 1 sau maxim 2 litere (ex: "trubo" în loc de "turbo" -> distanță 1)
                        if (distanta === 1) scor += 25;
                        if (distanta === 2 && termen.length > 4) scor += 15;
                    }
                });
            });

            return { ...item, scor };
        })
        .filter(item => item.scor > 0) // Păstrăm doar ce are măcar o potrivire
        .sort((a, b) => b.scor - a.scor); // Cele mai relevante apar primele!
    }, [searchQuery]);

    const handleClearDTC = async () => {
        Alert.alert(
            "Confirmare Ștergere ECU",
            "Ești sigur că vrei să ștergi memoria de erori și să stingi martorul Check Engine din bord?",
            [
                { text: "Anulează", style: "cancel" },
                {
                    text: "Șterge Erorile",
                    style: "destructive",
                    onPress: async () => {
                        setClearing(true);
                        try {
                            await api.post('/vehicul/WAUZZZ4A1RN000000/stergere-erori');
                            await fetchDiagnostics();
                            Alert.alert("Succes!", "Erorile au fost șterse din calculatorul motorului.");
                        } catch (error) {
                            Alert.alert("Eroare", "Comanda de resetare a eșuat.");
                        } finally {
                            setClearing(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading || !diagData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#da3633" />
                <Text style={{ color: '#8b949e', marginTop: 15 }}>Se interoghează magistrala de date ECU...</Text>
            </View>
        );
    }

    const { sistem_electric, coduri_dtc } = diagData;

    return (
        <View style={styles.mainContainer}>
            {/* 1. BARA DE CĂUTARE INTELIGENTĂ (GOOGLE-LIKE FUZZY SEARCH) */}
            <View style={styles.searchBarContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Caută inteligent: ex 'debimetru', 'trubo', 'bateri', 'P0101'..."
                    placeholderTextColor="#8b949e"
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* ANTET DIAGNOZĂ */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Diagnoză ECU & Explicații</Text>
                        <Text style={styles.subtitle}>Audi A6 C4 • Traducere HMI pe Înțelesul Tău</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchDiagnostics}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🔄 SCAN NOU</Text>
                    </TouchableOpacity>
                </View>

                {/* ==================================================================== */}
                {/* CONDIȚIE: DACĂ UTILIZATORUL CAUTĂ CEVA, AFIȘĂM REZULTATELE INTELIGENTE */}
                {/* ==================================================================== */}
                {searchQuery.trim() !== '' ? (
                    <View style={styles.searchResultsSection}>
                        <View style={styles.searchHeaderRow}>
                            <Text style={styles.sectionTitle}>
                                🎯 REZULTATE CĂUTARE INTELIGENTĂ ({rezultateCautare.length})
                            </Text>
                            <Text style={{ color: '#58a6ff', fontSize: 10 }}>Alimentat de Fuzzy Levenshtein</Text>
                        </View>

                        {rezultateCautare.length === 0 ? (
                            <View style={styles.emptySearch}>
                                <Text style={{ fontSize: 30 }}>🤔</Text>
                                <Text style={{ color: '#c9d1d9', fontWeight: 'bold', marginTop: 8 }}>
                                    Niciun rezultat găsit pentru „{searchQuery}”
                                </Text>
                                <Text style={{ color: '#8b949e', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                                    Încearcă termeni mai simpli precum: aer, turbo, frana, curent, baterie sau un cod de eroare.
                                </Text>
                            </View>
                        ) : (
                            rezultateCautare.map((item, idx) => (
                                <View key={idx} style={styles.dictionaryCard}>
                                    <View style={styles.dictTopRow}>
                                        <Text style={styles.dictId}>{item.id}</Text>
                                        <View style={styles.dictBadge}>
                                            <Text style={styles.dictBadgeText}>{item.tip}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.dictTitle}>{item.titlu_tehnic}</Text>

                                    {/* EXPLICAȚIA PENTRU OMUL SIMPLU */}
                                    <View style={styles.simpleExplanationBox}>
                                        <Text style={styles.simpleLabel}>💬 PE ÎNȚELESUL TĂU:</Text>
                                        <Text style={styles.simpleText}>{item.explicatie_simpla}</Text>
                                    </View>

                                    <View style={styles.actionBox}>
                                        <Text style={styles.actionLabel}>🛠️ RECOMANDARE TEHNICĂ:</Text>
                                        <Text style={styles.actionText}>{item.actiune_recomandata}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                ) : (
                    /* ==================================================================== */
                    /* DACĂ CĂUTAREA E GOALĂ, AFIȘĂM PANOURILE DE DIAGNOZĂ LIVE ALE MAȘINII   */
                    /* ==================================================================== */
                    <View>
                        {/* SECȚIUNEA 1: SĂNĂTATE ELECTRICĂ EXPLICATĂ SIMPLU */}
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>⚡ SISTEM ELECTRIC & ALTERNATOR (EXPLICAT)</Text>
                            <View style={styles.sohGrid}>
                                <View style={styles.sohItem}>
                                    <Text style={styles.sohLabel}>VOLTAJ CONTACT</Text>
                                    <Text style={styles.sohValue}>{sistem_electric.voltaj_curent} <Text style={styles.unit}>V</Text></Text>
                                </View>
                                <View style={styles.sohItem}>
                                    <Text style={styles.sohLabel}>SĂNĂTATE (SOH)</Text>
                                    <Text style={[styles.sohValue, { color: '#3fb950' }]}>{sistem_electric.baterie_soh_pct}%</Text>
                                </View>
                                <View style={styles.sohItem}>
                                    <Text style={styles.sohLabel}>STATUS ALTERNATOR</Text>
                                    <Text style={[styles.sohStatus, sistem_electric.stare_alternator === 'OPTIM' ? { color: '#3fb950' } : { color: '#da3633' }]}>
                                        {sistem_electric.stare_alternator === 'OPTIM' ? '● ÎNCĂRCARE NORMALĂ' : '▲ VERIFICĂ PUNTEA'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.simpleExplanationBox}>
                                <Text style={styles.simpleLabel}>💡 CE ÎNSEAMNĂ ASTA PENTRU TINE:</Text>
                                <Text style={styles.simpleText}>
                                    {sistem_electric.voltaj_curent >= 13.8 
                                        ? "Totul funcționează perfect! Alternatorul încarcă bateria eficient, iar pornirile pe timp de iarnă vor fi sigure."
                                        : "Tensiunea este puțin cam joasă. Cureaua alternatorului ar putea fi slăbită sau bateria începe să îmbătrânească."}
                                </Text>
                            </View>
                        </View>

                        {/* SECȚIUNEA 2: CODURI EROARE (DTC) CU TRADUCERE ÎN LIMBAJ NORMAL */}
                        <View style={styles.dtcSection}>
                            <Text style={styles.sectionTitle}>
                                🛡️ CODURI EROARE ECU: <Text style={{ color: coduri_dtc.length > 0 ? '#da3633' : '#3fb950' }}>{coduri_dtc.length} ACTIVE</Text>
                            </Text>

                            {coduri_dtc.length === 0 ? (
                                <View style={styles.cleanState}>
                                    <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
                                    <Text style={styles.cleanTitle}>Niciun Cod de Eroare Detectat</Text>
                                    <Text style={styles.cleanSubtitle}>Sistemele electronice ale motorului 2.5 TDI funcționează în parametri optimi.</Text>
                                </View>
                            ) : (
                                coduri_dtc.map((item, index) => {
                                    // Căutăm traducerea în dicționarul nostru explicativ
                                    const traducere = DICTIONAR_EXPLICATIV.find(d => d.id === item.cod) || {
                                        explicatie_simpla: "Eroare electronică înregistrată de calculatorul de bord. Necesită verificare cu interfața de diagnoză.",
                                        actiune_recomandata: "Consulați manualul tehnic al Audi sau verificați mufa senzorului aferent."
                                    };

                                    return (
                                        <View key={index} style={[styles.dtcCard, item.severitate === 'CRITICAL' ? styles.borderCritical : styles.borderWarning]}>
                                            <View style={styles.dtcTopRow}>
                                                <Text style={styles.dtcCode}>{item.cod}</Text>
                                                <View style={[styles.badge, item.severitate === 'CRITICAL' ? styles.badgeCritical : styles.badgeWarning]}>
                                                    <Text style={styles.badgeText}>{item.modul}</Text>
                                                </View>
                                            </View>

                                            <Text style={styles.dtcDesc}>{item.descriere}</Text>

                                            {/* TRADUCEREA PENTRU ȘOFER */}
                                            <View style={styles.simpleExplanationBox}>
                                                <Text style={styles.simpleLabel}>💬 TRADUCERE PE ÎNȚELESUL TĂU:</Text>
                                                <Text style={styles.simpleText}>{traducere.explicatie_simpla}</Text>
                                            </View>

                                            <View style={styles.actionBox}>
                                                <Text style={styles.actionLabel}>🛠️ CE TREBUIE SĂ FACI:</Text>
                                                <Text style={styles.actionText}>{traducere.actiune_recomandata}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* BUTON CLEAR MIL */}
                        {coduri_dtc.length > 0 && (
                            <TouchableOpacity style={[styles.clearBtn, clearing && { opacity: 0.5 }]} onPress={handleClearDTC} disabled={clearing}>
                                <Text style={styles.clearBtnText}>
                                    {clearing ? "⏳ SE ȘTERG ERORILE DIN ECU..." : "🗑️ ȘTERGE ERORILE & STINGE CHECK ENGINE"}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* SECȚIUNEA 3: GHID / ENCICLOPEDIE RAPIDĂ */}
                        <View style={[styles.card, { marginTop: 25 }]}>
                            <Text style={styles.sectionTitle}>📚 BAZĂ DE CUNOȘTINȚE VAG & OBD-II</Text>
                            <Text style={{ color: '#8b949e', fontSize: 12, marginBottom: 15 }}>
                                Ai o nelămurire despre un termen tehnic? Folosește bara de căutare de sus sau răsfoiește concepte cheie mai jos:
                            </Text>

                            {DICTIONAR_EXPLICATIV.slice(3).map((item, idx) => (
                                <View key={idx} style={styles.miniDictRow}>
                                    <Text style={styles.miniDictId}>{item.id}: <Text style={{color: '#c9d1d9', fontWeight: 'normal'}}>{item.titlu_tehnic}</Text></Text>
                                    <Text style={styles.miniDictSimple}>💬 {item.explicatie_simpla}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0d1117' },
    scrollContainer: { flex: 1, paddingHorizontal: 16 },

    // BARA DE CĂUTARE GOOGLE-LIKE
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22', margin: 16, marginBottom: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#58a6ff', shadowColor: '#58a6ff', shadowOffset: {width:0, height:2}, shadowOpacity:0.2, elevation:4 },
    searchIcon: { fontSize: 18, marginRight: 10 },
    searchInput: { flex: 1, color: '#ffffff', fontSize: 14, paddingVertical: 12, fontWeight: 'bold' },
    clearSearchBtn: { padding: 6, backgroundColor: '#21262d', borderRadius: 15, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#21262d', paddingBottom: 15 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
    subtitle: { fontSize: 13, color: '#8b949e', marginTop: 2 },
    refreshBtn: { backgroundColor: '#21262d', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#30363d' },

    sectionTitle: { fontSize: 12, color: '#8b949e', fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
    
    card: { backgroundColor: '#161b22', borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#30363d' },
    sohGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 15 },
    sohItem: { alignItems: 'center', flex: 1 },
    sohLabel: { fontSize: 10, color: '#8b949e', fontWeight: 'bold', marginBottom: 4 },
    sohValue: { fontSize: 22, fontWeight: '900', color: '#ffffff' },
    sohStatus: { fontSize: 10, fontWeight: 'bold', marginTop: 6 },
    unit: { fontSize: 13, color: '#58a6ff', fontWeight: 'normal' },

    dtcSection: { marginBottom: 20 },
    dtcCard: { backgroundColor: '#161b22', borderRadius: 8, padding: 16, marginBottom: 15, borderWidth: 1, borderLeftWidth: 5 },
    borderCritical: { borderColor: '#30363d', borderLeftColor: '#da3633', backgroundColor: 'rgba(218, 54, 51, 0.05)' },
    borderWarning: { borderColor: '#30363d', borderLeftColor: '#d29922' },
    dtcTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    dtcCode: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: 1 },
    dtcDesc: { fontSize: 13, color: '#c9d1d9', lineHeight: 18, fontWeight: 'bold' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    badgeCritical: { backgroundColor: '#3b2322' },
    badgeWarning: { backgroundColor: '#342a1d' },
    badgeText: { fontSize: 10, fontWeight: 'bold', color: '#ff7b72' },

    // BOX-URILE PENTRU OAMENI SIMPLI
    simpleExplanationBox: { backgroundColor: 'rgba(88, 166, 255, 0.08)', borderRadius: 6, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(88, 166, 255, 0.2)' },
    simpleLabel: { color: '#58a6ff', fontSize: 10, fontWeight: '900', marginBottom: 4 },
    simpleText: { color: '#ffffff', fontSize: 12, lineHeight: 18 },

    actionBox: { backgroundColor: 'rgba(63, 185, 80, 0.08)', borderRadius: 6, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(63, 185, 80, 0.2)' },
    actionLabel: { color: '#3fb950', fontSize: 10, fontWeight: '900', marginBottom: 4 },
    actionText: { color: '#c9d1d9', fontSize: 12, lineHeight: 18 },

    cleanState: { backgroundColor: '#161b22', borderRadius: 10, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#238636' },
    cleanTitle: { fontSize: 18, fontWeight: 'bold', color: '#3fb950', marginBottom: 6 },
    cleanSubtitle: { fontSize: 13, color: '#8b949e', textAlign: 'center', lineHeight: 20 },

    clearBtn: { backgroundColor: '#da3633', paddingVertical: 16, borderRadius: 8, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, marginBottom: 15 },
    clearBtnText: { color: '#ffffff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

    // REZULTATE CĂUTARE
    searchResultsSection: { marginTop: 5 },
    searchHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    emptySearch: { padding: 40, alignItems: 'center', backgroundColor: '#161b22', borderRadius: 10, borderWidth: 1, borderColor: '#30363d' },
    dictionaryCard: { backgroundColor: '#161b22', borderRadius: 10, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#58a6ff', shadowColor: '#58a6ff', shadowOffset: {width:0, height:3}, shadowOpacity:0.15, elevation:4 },
    dictTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    dictId: { color: '#58a6ff', fontWeight: '900', fontSize: 16 },
    dictBadge: { backgroundColor: '#21262d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#30363d' },
    dictBadgeText: { color: '#8b949e', fontSize: 9, fontWeight: 'bold' },
    dictTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },

    miniDictRow: { borderBottomWidth: 1, borderBottomColor: '#21262d', paddingVertical: 10 },
    miniDictId: { color: '#58a6ff', fontWeight: 'bold', fontSize: 12 },
    miniDictSimple: { color: '#8b949e', fontSize: 11, marginTop: 4, lineHeight: 16 }
});

export default DiagnosticsScreen;