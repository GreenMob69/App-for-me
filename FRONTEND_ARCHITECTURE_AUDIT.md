# RAPORT DE ARHITECTURĂ FRONT-END & UI/UX AUDIT
**Proiect:** Telemetrie Licență — Audi A6 C4 2.5 TDI (AEL)  
**Destinație:** Echipa de Dezvoltare Front-End & UI/UX Architect  
**Data generării:** 16 Octombrie 2026  
**Fișier:** `FRONTEND_ARCHITECTURE_AUDIT.md`  

---

## CUPRINS
1. [Sistemul de Teme & Șabloane (`src/theme/index.js` și `src/context/AppContext.js`)](#1-sistemul-de-teme--șabloane)
2. [Structura Vizuală & JSX din `LiveDashboardScreen.js`](#2-structura-vizuală--jsx-din-livedashboardscreenjs)
3. [Structura Vizuală & JSX din `StatusScreen.js` și `VehicleHealthScreen.js`](#3-structura-vizuală--jsx-din-statusscreenjs-și-vehiclehealthscreenjs)
4. [Navigația și Bara de Tab-uri (`App.js`)](#4-navigația-și-bara-de-tab-uri-appjs)
5. [Inventarul Componentelor Reutilizabile & Ceasuri SVG (`src/components/`)](#5-inventarul-componentelor-reutilizabile--ceasuri-svg)
6. [Ghid de Implementare pentru Noul Redesign de Cockpit](#6-ghid-de-implementare-pentru-noul-redesign-de-cockpit)

---

## 1. SISTEMUL DE TEME & ȘABLOANE

Toate ecranele și componentele din aplicație sunt guvernate de sistemul centralizat de design tokens din `src/theme/index.js` și de starea reactivă din `src/context/AppContext.js`.

### 1.1. Codul Complet din `src/theme/index.js`

```javascript
/**
 * theme/index.js — sistem de design tokens
 *
 * Sursa unică de adevăr pentru toate valorile vizuale din aplicație.
 * Niciun fișier din aplicație nu conține valori hardcodate de culori,
 * spațiere, tipografie, raze sau umbre — toate importă din acest fișier.
 *
 * Paleta: "Instrument" — cool blue-black, accent electric blue, semantic status colors.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CULORI
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
    // Suprafețe (6 niveluri, de la cel mai întunecat la cel mai ridicat)
    bg: {
        0: '#07080e',   // fundal principal ecran
        1: '#0c0e17',   // suprafață card
        2: '#121520',   // suprafață ridicată (input, row selected)
        3: '#191d2b',   // modal, bottom sheet
        4: '#212638',   // hover / pressed state
        5: '#2a2f45',   // tooltip, popover
    },

    // Borduri (3 niveluri)
    border: {
        subtle:  '#15192a',
        default: '#1f2438',
        strong:  '#2e3555',
    },

    // Text (5 niveluri)
    text: {
        primary:   '#eef0f8',
        secondary: '#8b96b5',
        tertiary:  '#525d7a',
        disabled:  '#31384f',
        inverse:   '#07080e',
    },

    // Accent principal
    accent: {
        default: '#4d8ef5',
        hover:   '#6aa3ff',
        muted:   'rgba(77,142,245,0.10)',
        border:  'rgba(77,142,245,0.25)',
    },

    // Culori semantice status vehicul
    status: {
        optimal:  '#2fcfa4',   // 90-100 — stare optimă (teal)
        good:     '#34d172',   // 75-89  — bun, fără acțiune (verde)
        monitor:  '#f0c04a',   // 55-74  — urmărire recomandată (amber)
        caution:  '#f0883e',   // 35-54  — atenție necesară (portocaliu)
        critical: '#f06464',   // 0-34   — acțiune imediată (coral-roșu)
        neutral:  '#8b96b5',   // neutru / monitorizare
    },

    // Fonduri tinted la 8% opacitate (pentru carduri cu status)
    tint: {
        optimal:  'rgba(47,207,164,0.08)',
        good:     'rgba(52,209,114,0.08)',
        monitor:  'rgba(240,192,74,0.08)',
        caution:  'rgba(240,136,62,0.08)',
        critical: 'rgba(240,100,100,0.08)',
        accent:   'rgba(77,142,245,0.08)',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// SPAȚIERE (grid de 4px)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
    0:  0,
    1:  4,
    2:  8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    8:  32,
    10: 40,
    12: 48,
    16: 64,
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — constante fixe
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
    screenPaddingH:  16,   // padding orizontal orice ecran
    cardPadding:     16,   // padding intern card
    cardPaddingV:    14,   // padding vertical intern card
    sectionGap:      12,   // spațiu între carduri consecutive
    sectionTitleGap:  8,   // spațiu între titlu secțiune și primul card
    interSectionGap: 28,   // spațiu între secțiuni diferite
    tabBarHeight:    58,
    headerHeight:    52,
};

// ─────────────────────────────────────────────────────────────────────────────
// RAZE (border radius)
// ─────────────────────────────────────────────────────────────────────────────

export const radii = {
    xs:   4,
    sm:   8,
    md:   12,   // card standard, input, button
    lg:   16,
    xl:   22,   // card hero, panel principal
    full: 999,  // pill, avatar, progress bar
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOGRAFIE
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
    sizes: {
        display: 52,   // hero gauge (health score principal)
        hero:    36,   // numere mari live dashboard
        title1:  24,   // titlu ecran, modal header
        title2:  20,   // card header primar
        title3:  17,   // subsecțiune, card title secundar
        body1:   15,   // text principal
        body2:   14,   // text card, detalii
        label1:  13,   // labels interactive, butoane
        label2:  12,   // text secundar, descrieri
        caption: 11,   // unități, timestamps, metadata
        micro:   10,   // section headers (UPPERCASE)
    },
    lineHeights: {
        display: 56,
        hero:    40,
        title1:  30,
        title2:  26,
        title3:  22,
        body1:   22,
        body2:   20,
        label1:  18,
        label2:  16,
        caption: 14,
        micro:   13,
    },
    weights: {
        regular:  '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
        heavy:    '800',
    },
    // Toate valorile numerice care se schimbă folosesc tabular-nums
    tabularNums: ['tabular-nums'],
};

// ─────────────────────────────────────────────────────────────────────────────
// MOTION
// ─────────────────────────────────────────────────────────────────────────────

export const motion = {
    duration: {
        instant:  0,    // fără tranziție
        fast:   120,    // micro-interacțiuni (button press, toggle)
        normal: 400,    // animații de intrare standard (fade, slide)
        slow:   600,    // tranziții complexe (card reveal, panel)
        reveal: 800,    // animații principale (gauge arc, health score)
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONIȚE
// ─────────────────────────────────────────────────────────────────────────────

export const icons = {
    sizes: {
        xs:  14,
        sm:  18,
        md:  22,
        lg:  28,
        xl:  40,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ȘABLOANE / DESIGN TEMPLATES COCKPIT
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATES = {
    MOTORSPORT: {
        id: 'MOTORSPORT',
        name: 'Motorsport Pro',
        subtitle: 'Porsche GT3 & AiM Race Telemetry',
        badge: 'RACE',
        accent: '#00f0ff',
        accentSecondary: '#ffb800',
        bg: '#05070e',
        cardBg: '#0b0f1a',
        border: '#162238',
        speedColor: '#00f0ff',
        rpmColor: '#ffb800',
        tagBg: 'rgba(0, 240, 255, 0.12)',
    },
    AUDI_RS: {
        id: 'AUDI_RS',
        name: 'Audi Sport RS',
        subtitle: 'Audi Virtual Cockpit Performance',
        badge: 'RS',
        accent: '#ff2a2a',
        accentSecondary: '#ffffff',
        bg: '#08080a',
        cardBg: '#121318',
        border: '#2a1a1c',
        speedColor: '#ffffff',
        rpmColor: '#ff2a2a',
        tagBg: 'rgba(255, 42, 42, 0.12)',
    },
    TESLA_MINIMAL: {
        id: 'TESLA_MINIMAL',
        name: 'Minimal Clean',
        subtitle: 'Tesla OS Clean & Aerodinamic',
        badge: 'CLEAN',
        accent: '#38bdf8',
        accentSecondary: '#10b981',
        bg: '#08090d',
        cardBg: '#0f1219',
        border: '#1a202c',
        speedColor: '#f8fafc',
        rpmColor: '#38bdf8',
        tagBg: 'rgba(56, 189, 248, 0.12)',
    },
    NIGHT_HUD: {
        id: 'NIGHT_HUD',
        name: 'Night Stealth HUD',
        subtitle: 'OLED Black & Proiecție Parbriz',
        badge: 'HUD',
        accent: '#ff453a',
        accentSecondary: '#ff9f0a',
        bg: '#000000',
        cardBg: '#080808',
        border: '#2a1010',
        speedColor: '#ff453a',
        rpmColor: '#ff453a',
        tagBg: 'rgba(255, 69, 58, 0.15)',
        isHud: true,
    },
};
```

---

### 1.2. Managementul Șabloanelor în `src/context/AppContext.js`

```javascript
import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TEMPLATES } from '../theme';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [viewMode, setViewMode] = useState('COCKPIT');
    const [selectedMetric, setSelectedMetric] = useState('RPM');
    const [activeTemplate, setActiveTemplateState] = useState('MOTORSPORT');
    const [tripReport, setTripReport] = useState(null);
    const navigationRef = useRef(null);

    // Încarcă șablonul salvat din AsyncStorage la pornire
    useEffect(() => {
        AsyncStorage.getItem('@cockpit_template').then(saved => {
            if (saved && TEMPLATES[saved]) {
                setActiveTemplateState(saved);
            }
        }).catch(() => {});
    }, []);

    const setActiveTemplate = useCallback(async (tplId) => {
        if (!TEMPLATES[tplId]) return;
        setActiveTemplateState(tplId);
        try {
            await AsyncStorage.setItem('@cockpit_template', tplId);
        } catch {}
    }, []);

    // Helper reactiv accesibil în toate componentele
    const currentTemplate = TEMPLATES[activeTemplate] || TEMPLATES.MOTORSPORT;

    const setNavigationRef = useCallback((ref) => {
        navigationRef.current = ref;
    }, []);

    const dismissTripReport = useCallback(() => {
        setTripReport(null);
    }, []);

    return (
        <AppContext.Provider value={{
            viewMode, setViewMode,
            selectedMetric, setSelectedMetric,
            activeTemplate, setActiveTemplate, currentTemplate,
            tripReport, setTripReport, dismissTripReport,
            navigationRef, setNavigationRef,
        }}>
            {children}
        </AppContext.Provider>
    );
};
```

---

## 2. STRUCTURA VIZUALĂ & JSX DIN `LiveDashboardScreen.js`

Ecranul `LiveDashboardScreen.js` este inima experienței în timp real. Dispune de telemetrie smooth la 60 FPS (folosind `useSmoothedTelemetry`), comutare de mod voluntar (🚗 RAPID vs ⚡ PRO) și 3 sub-tab-uri interne.

### 2.1. Top-Level Return JSX

```jsx
return (
    <View style={[styles.root, { backgroundColor: tpl.bg }]}>
        {/* ── Top Bar: Conexiune, Mod Rapid/Pro, Oglindă HUD, Notificări ── */}
        <View style={styles.topBar}>
            <View style={[styles.connPill, { borderColor: connColor }]}>
                <View style={[styles.connDot, { backgroundColor: connColor }]} />
                <Text style={[styles.connLabel, { color: connColor }]}>{connLabel}</Text>
            </View>

            {/* Persona Switch: Rapid vs Pro Telemetrie (Complet voluntar) */}
            <TouchableOpacity
                style={[styles.modeTogglePill, proMode ? styles.modeTogglePro : styles.modeToggleDriver]}
                onPress={() => {
                    const next = !proMode;
                    setProMode(next);
                    if (!next && tab === 'PARAMS') setTab('LIVE');
                }}
            >
                <Text style={[styles.modeToggleText, proMode ? styles.modeToggleTextPro : styles.modeToggleTextDriver]}>
                    {proMode ? '⚡ PRO' : '🚗 RAPID'}
                </Text>
            </TouchableOpacity>

            {/* Comutator oglindire parbriz pentru șablonul HUD */}
            {tpl.isHud && (
                <TouchableOpacity
                    style={[styles.hudToggleBtn, isHudMirrored && styles.hudToggleBtnActive]}
                    onPress={() => setIsHudMirrored(!isHudMirrored)}
                >
                    <Text style={[styles.hudToggleText, isHudMirrored && styles.hudToggleTextActive]}>
                        {isHudMirrored ? '🪞 MIRROR ON' : '🪞 HUD'}
                    </Text>
                </TouchableOpacity>
            )}

            <Text style={styles.vehicleName} numberOfLines={1}>
                {getVehicleLabel() || 'Dashboard'}
            </Text>

            <TouchableOpacity style={styles.alertBtn} onPress={() => setShowAlerts(true)}>
                <Text style={styles.alertBtnIcon}>🔔</Text>
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>

        {/* ── Offline Banner ── */}
        {!isConnected && (
            <View style={[styles.offlineBanner, isReconnecting && styles.offlineBannerSync]}>
                <Text style={styles.offlineText}>
                    {isReconnecting ? '⟳  Reconectare la server...' : '⊘  Date înghețate — fără conexiune'}
                </Text>
            </View>
        )}

        {/* ── Conținut Principal Scrollabil ── */}
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {tab === 'LIVE'   && renderLive()}
            {tab === 'PARAMS' && renderParams()}
            {tab === 'SCOPE'  && renderScope()}
        </ScrollView>

        {/* ── Tab Bar Intern (Bord Șofer/Pro, Parametri, Grafic) ── */}
        <View style={styles.tabBar}>
            {[
                { id: 'LIVE',   label: proMode ? 'Bord Pro' : 'Bord Șofer' },
                ...(proMode ? [{ id: 'PARAMS', label: 'Parametri' }] : []),
                { id: 'SCOPE',  label: 'Grafic' },
            ].map(t => (
                <TouchableOpacity
                    key={t.id}
                    style={styles.tabItem}
                    onPress={() => setTab(t.id)}
                >
                    <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
                    {tab === t.id && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
            ))}
        </View>

        {/* ── Modal Alerte Sesiune ── */}
        <Modal visible={showAlerts} transparent animationType="slide">
            ...
        </Modal>
    </View>
);
```

---

### 2.2. Structura Vizuală a Tab-ului `LIVE` (`renderLive()`)

```jsx
const renderLive = () => {
    return (
        <View style={[styles.liveContainer, isHudMirrored && styles.hudMirrored]}>
            {/* 1. SPEED HERO: Cifra principală de viteză */}
            <View style={styles.speedHero}>
                <Text style={[styles.speedNum, { color: tpl.speedColor }]}>{speed}</Text>
                <Text style={styles.speedUnit}>km/h</Text>
            </View>

            {/* 2. TUROMETRU & BARA DE RPM CU REDLINE DINAMIC */}
            <View style={styles.rpmSection}>
                <Text style={[styles.rpmNum, { color: rpmColor }]}>
                    {typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm}
                </Text>
                <View style={styles.rpmTrack}>
                    <View style={[styles.redlineMarker, { left: `${redlinePct}%` }]} />
                    <View style={[styles.rpmFill, { width: rpmPct, backgroundColor: rpmColor }]} />
                </View>
                <Text style={styles.rpmLabel}>RPM</Text>
            </View>

            {/* 3. BADGE MOTOR RECE / ÎN ÎNCĂLZIRE */}
            {tempBadgeText && (
                <View style={[styles.coldBadge, engineTempStatus === 'cold' ? styles.coldBadgeActive : styles.warmingBadgeActive]}>
                    <Text style={[styles.coldBadgeText, { color: engineTempStatus === 'cold' ? '#5AC8FA' : colors.status.monitor }]}>
                        {tempBadgeText}
                    </Text>
                </View>
            )}

            {/* 4. DPF REGEN BANNER */}
            {(dpf.regen_status === 'ACTIVE' || dpf.regen_status === 'ON') && (
                <View style={styles.dpfBanner}>
                    <Text style={styles.dpfText}>♻  Regenerare DPF — drum lung recomandat</Text>
                </View>
            )}

            {/* 5. VIRTUAL DYNO & ECU GLASS CARD (Exclusiv Mod Pro) */}
            {proMode && (
                <>
                    <View style={[styles.dynoCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <View style={styles.dynoHeader}>
                            <View style={styles.dynoTag}>
                                <Text style={styles.dynoTagText}>⚡ VIRTUAL DYNO (ECU MATH)</Text>
                            </View>
                            {v.smokeRisk ? (
                                <View style={[styles.dynoTag, { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: colors.status.critical }]}>
                                    <Text style={[styles.dynoTagText, { color: colors.status.critical }]}>⚠ RISC FUM NEGRU</Text>
                                </View>
                            ) : (
                                <View style={[styles.dynoTag, { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: colors.status.good }]}>
                                    <Text style={[styles.dynoTagText, { color: colors.status.good }]}>✓ LIMITĂ FUM OK</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.dynoGrid}>
                            {/* Putere CP */}
                            <View style={styles.dynoCell}>
                                <Text style={styles.dynoLabel}>PUTERE REALĂ</Text>
                                <Text style={styles.dynoValue}>{powerHp} <Text style={styles.dynoUnit}>CP</Text></Text>
                                <View style={styles.dynoMiniBar}>
                                    <View style={[styles.dynoMiniFill, { width: `${Math.min((powerHp / 140) * 100, 100)}%`, backgroundColor: colors.status.good }]} />
                                </View>
                            </View>

                            {/* Cuplu Nm */}
                            <View style={styles.dynoCell}>
                                <Text style={styles.dynoLabel}>CUPLU MOTOR</Text>
                                <Text style={styles.dynoValue}>{torqueNm} <Text style={styles.dynoUnit}>Nm</Text></Text>
                                <View style={styles.dynoMiniBar}>
                                    <View style={[styles.dynoMiniFill, { width: `${Math.min((torqueNm / 300) * 100, 100)}%`, backgroundColor: colors.accent.default }]} />
                                </View>
                            </View>

                            {/* Volumetric Efficiency */}
                            <View style={styles.dynoCell}>
                                <Text style={styles.dynoLabel}>EFICIENȚĂ VOLUMETRICĂ</Text>
                                <Text style={styles.dynoValue}>{vePct}%</Text>
                                <Text style={styles.dynoSub}>{vePct >= 80 ? 'Admisie optimă' : 'Restricție debit'}</Text>
                            </View>

                            {/* Lambda / AFR */}
                            <View style={styles.dynoCell}>
                                <Text style={styles.dynoLabel}>LAMBDA / AFR</Text>
                                <Text style={styles.dynoValue}>λ {typeof lambda === 'number' ? lambda.toFixed(2) : lambda}</Text>
                                <Text style={styles.dynoSub}>{typeof afr === 'number' ? `${afr.toFixed(1)}:1 AFR` : 'AFR'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* DUAL BOOST INDICATOR: TARGET vs ACTUAL */}
                    <View style={[styles.boostCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <View style={styles.boostHeader}>
                            <Text style={styles.boostTitle}>TURBO BOOST (COMANDAT vs EFECTIV)</Text>
                            <Text style={[styles.boostDelta, { color: Math.abs(boost - targetBoost) > 0.3 ? colors.status.caution : colors.status.good }]}>
                                Δ {((boost - targetBoost) > 0 ? '+' : '') + (boost - targetBoost).toFixed(2)} bar
                            </Text>
                        </View>
                        <View style={styles.boostBarsWrap}>
                            <View style={styles.boostBarRow}>
                                <Text style={styles.boostBarLbl}>Cmd</Text>
                                <View style={styles.boostBarTrack}>
                                    <View style={[styles.boostBarFill, { width: `${Math.min((targetBoost / 2.5) * 100, 100)}%`, backgroundColor: colors.status.monitor }]} />
                                </View>
                                <Text style={styles.boostBarVal}>{targetBoost.toFixed(2)} bar</Text>
                            </View>
                            <View style={styles.boostBarRow}>
                                <Text style={styles.boostBarLbl}>Act</Text>
                                <View style={styles.boostBarTrack}>
                                    <View style={[styles.boostBarFill, { width: `${Math.min((boost / 2.5) * 100, 100)}%`, backgroundColor: boostColor }]} />
                                </View>
                                <Text style={styles.boostBarVal}>{boost.toFixed(2)} bar</Text>
                            </View>
                        </View>
                    </View>

                    {/* SENSOR FUSION & VIRTUAL OBSERVERS */}
                    <View style={[styles.observersCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <View style={styles.dynoHeader}>
                            <View style={[styles.dynoTag, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
                                <Text style={[styles.dynoTagText, { color: colors.accent.default }]}>🔬 SENSOR FUSION & OBSERVERS</Text>
                            </View>
                            <Text style={styles.observerSubtitle}>Inginerie Empirică VAG</Text>
                        </View>

                        <View style={styles.observerGrid}>
                            <View style={styles.observerCell}>
                                <Text style={styles.observerLabel}>BSFC (EFICIENȚĂ)</Text>
                                <Text style={styles.observerVal}>{v.bsfcGPerKwh ? `${v.bsfcGPerKwh}` : '—'} <Text style={styles.observerUnit}>g/kWh</Text></Text>
                            </View>
                            <View style={styles.observerCell}>
                                <Text style={styles.observerLabel}>UZURĂ ULEI (ARRHENIUS)</Text>
                                <Text style={styles.observerVal}>{v.oilLifeWearFactor ? `${v.oilLifeWearFactor}×` : '1.0×'}</Text>
                            </View>
                            <View style={styles.observerCell}>
                                <Text style={styles.observerLabel}>SĂNĂTATE BATERIE (SoH)</Text>
                                <Text style={[styles.observerVal, { color: (v.batterySoHPct || 95) < 70 ? colors.status.critical : colors.status.good }]}>
                                    {v.batterySoHPct ?? 95}%
                                </Text>
                            </View>
                            <View style={styles.observerCell}>
                                <Text style={styles.observerLabel}>ENERGIE FRÂNE (TRIP)</Text>
                                <Text style={styles.observerVal}>{v.brakeEnergyTripMj ? `${v.brakeEnergyTripMj}` : '0.0'} <Text style={styles.observerUnit}>MJ</Text></Text>
                            </View>
                        </View>
                    </View>
                </>
            )}

            {/* 6. GRID METRICI STANDARD (2×3 TILE-URI) */}
            <View style={styles.tileGrid}>
                <MetricTile tileW={tileW} label="TEMP"    value={cool}                  unit="°C"  color={coolColor}  highlight={cool > 95} />
                <MetricTile tileW={tileW} label="BOOST"   value={boost}                 unit="bar" color={boostColor} highlight={boost > 1.8} />
                <MetricTile tileW={tileW} label="VOLTAJ"  value={volt > 0 ? volt : '—'} unit={volt > 0 ? 'V' : ''} color={voltColor} />
                <MetricTile tileW={tileW} label="CONSUM"  value={cons}                  unit="L/h" color={consColor} />
                <MetricTile tileW={tileW} label="ECO"     value={eco}                   unit="/100" color={ecoColor} highlight />
                <MetricTile tileW={tileW} label="TREAPTĂ" value={gear ?? 'N'}            unit=""    color={colors.accent.default} />
            </View>

            {/* 7. ASISTENT AI & ALERTE CONTEXTUALE */}
            <View style={[styles.aiCard, { borderLeftColor: aiColor }]}>
                <Text style={[styles.aiText, { color: aiColor }]}>{assistantMsg.text}</Text>
            </View>
            {contextualAlert && (
                <RecommendationCard
                    title={contextualAlert.title}
                    description={contextualAlert.description}
                    priority={contextualAlert.priority}
                    style={{ marginTop: spacing[2] }}
                />
            )}
        </View>
    );
};
```

---

## 3. STRUCTURA VIZUALĂ & JSX DIN `StatusScreen.js` ȘI `VehicleHealthScreen.js`

### 3.1. `StatusScreen.js` (Răspunsul la întrebarea "Pot pleca liniștit?")

Ecranul folosește conceptul de **Progressive Disclosure**: utilizatorul primește întâi un răspuns clar în limbaj natural, iar parametrii tehnici avansați sunt explorați la atingere prin ferestre modal/sheet.

```jsx
return (
    <Animated.View style={[styles.container, screenFadeStyle]}>
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* 0. VEHICLE IDENTITY BAR (Avatar, Denumire, Căutare, Notificări, Setări) */}
            <View style={styles.identityStrip}>
                <VehicleAvatar status={drive.status} fuelType={fuelType} size="sm" showBadge={false} />
                <View style={styles.identityInfo}>
                    <Text style={styles.identityModel}>{vehicleLabel || activeVin.slice(-6)}</Text>
                    <Text style={styles.identityVin}>{activeVin.slice(-6)}</Text>
                </View>
                <TouchableOpacity onPress={openSearch} style={styles.headerIconBtn}><Text>🔍</Text></TouchableOpacity>
                <TouchableOpacity onPress={openNotifications} style={styles.headerIconBtn}><Text>🔔</Text></TouchableOpacity>
                <TouchableOpacity onPress={openSettings} style={styles.headerIconBtn}><Text>⚙️</Text></TouchableOpacity>
            </View>

            {/* 0a. DRIVE MODE BANNER (Detectează automat când motorul este pornit) */}
            <DriveModeBanner navigation={navigation} />

            {/* 0b. DASHBOARD SUMMARY STRIP (4 indicatori rapizi) */}
            <View style={styles.summaryStrip}>
                <View style={styles.summaryItem}><Text style={styles.summaryNum}>OK</Text><Text style={styles.summaryLabel}>VEHICUL</Text></View>
                <View style={styles.summaryItem}><Text style={styles.summaryNum}>{observations.length}</Text><Text style={styles.summaryLabel}>PROBLEME</Text></View>
                <View style={styles.summaryItem}><Text style={styles.summaryNum}>{upcoming.length}</Text><Text style={styles.summaryLabel}>MENTENANȚĂ</Text></View>
                <View style={styles.summaryItem}><Text style={styles.summaryNum}>{unreadCount}</Text><Text style={styles.summaryLabel}>NOTIFICĂRI</Text></View>
            </View>

            {/* 1. HERO CARD — Răspunsul Direct: "POT PLECA CU MAȘINA?" */}
            <HeroCard
                title="POT PLECA CU MAȘINA?"
                value={drive.answer}
                description={heroDescription}
                status={drive.status}
                icon={drive.icon}
                style={styles.hero}
            />

            {/* 2. X-RAY SUBSISTEME (Carusel Orizontal cu PEEK interactiv) */}
            <View style={styles.section}>
                <SectionHeader title="STARE SUBSISTEME (PEEK DIRECȚIONAT)" size="sm" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subsystemRow}>
                    {Object.entries(SUBSYSTEM_PEEK_DATA).map(([key, item]) => (
                        <TouchableOpacity
                            key={key}
                            style={styles.subsystemChip}
                            onPress={() => setSelectedSubsystem(item)}
                        >
                            <View style={styles.subsystemChipTop}>
                                <View style={[styles.subsystemDot, { backgroundColor: item.status === 'optimal' ? colors.status.good : colors.status.caution }]} />
                                <Text style={styles.subsystemScore}>{item.score}%</Text>
                            </View>
                            <Text style={styles.subsystemName}>{item.name}</Text>
                            <Text style={styles.subsystemPeekAction}>Atinge pt. detalii ›</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* 3. RECOMANDAREA PRINCIPALĂ */}
            {hasObs && primaryObs && (
                <RecommendationCard
                    title={primaryObs.title}
                    description={buildPrimaryDescription(primaryObs)}
                    priority={SEVERITY_TO_PRIORITY[primaryObs.severity]}
                    action={buildPrimaryAction(primaryObs)}
                />
            )}

            {/* 4. PREDICȚII SECUNDARE (Carduri expandabile) */}
            {visiblePreds.map((obs, i) => (
                <PredictionCard key={i} title={obs.title} prediction={obs.evidence} />
            ))}

            {/* 5. CE SE APROPIE (Mentenanță) */}
            {upcoming.map((item, i) => (
                <MaintenanceCard key={i} title={item.component} dueDate={item.timeframe} />
            ))}
        </ScrollView>

        {/* 9. BOTTOM SHEET PEEK (Cu suport complet PanResponder de swipe down) */}
        <BottomSheet
            visible={!!selectedSubsystem}
            onClose={() => setSelectedSubsystem(null)}
            title={selectedSubsystem?.name}
        >
            {selectedSubsystem && (
                <View style={styles.sheetContent}>
                    <StatusBadge label={`Scor: ${selectedSubsystem.score}/100`} status={selectedSubsystem.status} />
                    <Text style={styles.sheetDesc}>{selectedSubsystem.desc}</Text>
                    <View style={styles.sheetMetricsGrid}>
                        {selectedSubsystem.metrics.map((m, idx) => (
                            <View key={idx} style={styles.sheetMetricBox}>
                                <Text style={styles.sheetMetricLbl}>{m.label}</Text>
                                <Text style={styles.sheetMetricVal}>{m.val}</Text>
                            </View>
                        ))}
                    </View>
                    <Button
                        label="Vezi diagnoza completă (Deep Dive) ❯"
                        variant="primary"
                        onPress={() => {
                            const sys = selectedSubsystem.key;
                            setSelectedSubsystem(null);
                            navigation?.navigate('SubsystemDetail', { system: sys, vin: activeVin });
                        }}
                    />
                </View>
            )}
        </BottomSheet>
    </Animated.View>
);
```

---

### 3.2. `VehicleHealthScreen.js` (Scor de Sănătate & Diagnostic AI Avansat)

```jsx
return (
    <ScrollView style={styles.container}>
        {/* 1. HEALTH GAUGE CENTRAL (Arc SVG Semicircular 0-100%) */}
        <View style={styles.gaugeWrap}>
            <HealthGauge
                score={overallHealth}
                label="SĂNĂTATE"
                subtitle={gaugeSubtitle}
                size="lg"
                animate
            />
        </View>

        {/* 2. METRIC CARDS PENTRU CELE 4 PILOANE PRINCIPALE */}
        <View style={styles.metricsRow}>
            <MetricCard label="Motor" value={scores.engine} unit="/100" />
            <MetricCard label="Combustibil" value={scores.fuel} unit="/100" />
            <MetricCard label="Stil condus" value={scores.driving} unit="/100" />
            <MetricCard label="Siguranță" value={scores.safety} unit="/100" />
        </View>

        {/* 3. TREND SCOR ECO (8 SĂPTĂMÂNI) */}
        <View style={styles.trendBars}>
            {trendData.map((w, i) => (
                <View key={i} style={styles.trendBarWrap}>
                    <View style={[styles.trendBarFill, { height: (w.avg_eco / 100) * 72 }]} />
                    <Text style={styles.trendBarWeek}>S{i + 1}</Text>
                </View>
            ))}
        </View>

        {/* 4. CAUSAL CHAIN DIAGRAM (Lanț Cauză -> Efect -> Simptom) */}
        <CausalChainCard
            title="PROPAGARE DEFECT (AI REASONING)"
            confidence={85}
            rootCause={{ title: 'Scurgere vacuum / uzură VNT', detail: 'Circuit electrovalvă N75' }}
            intermediateEffect={{ title: 'Turbo Lag / deviație presiune', detail: 'Delta >250 mbar' }}
            observedSymptom={{ title: 'Putere redusă și fum', detail: 'Limitare cuplu ECU' }}
            onAskAI={() => navigation.navigate('AIExpert')}
        />
    </ScrollView>
);
```

---

## 4. NAVIGAȚIA ȘI BARA DE TAB-URI (`App.js`)

Aplicația folosește `@react-navigation/bottom-tabs` și `@react-navigation/native-stack` cu integrare `SecurityGate` pentru protecție biometrică/PIN.

```javascript
// App.js — Configurație TabNavigator & RootStack

function TabNavigator() {
    const { unreadCount } = useContext(NotificationContext);

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.bg[1],
                    borderTopColor: colors.border.default,
                    paddingBottom: spacing[1],
                    height: layout.tabBarHeight, // 58px
                },
                tabBarActiveTintColor:   colors.accent.default,
                tabBarInactiveTintColor: colors.text.secondary,
                tabBarLabelStyle: {
                    fontSize:    typography.sizes.caption,
                    fontWeight:  typography.weights.bold,
                },
            }}
        >
            {/* Tab 1: STARE (Stare generală, Hero card, Peek subsisteme) */}
            <Tab.Screen
                name="Stare"
                component={StatusStackScreen}
                options={{
                    tabBarLabel: 'STARE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={color} />
                    ),
                    tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: colors.status.critical,
                        fontSize: 9,
                        minWidth: 16,
                        height: 16,
                    },
                }}
            />

            {/* Tab 2: LIVE (Cockpit digital, osciloscop, senzori virtuali) */}
            <Tab.Screen
                name="Live"
                options={{
                    tabBarLabel: 'LIVE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><LiveDashboardScreen /></ErrorBoundary>}
            </Tab.Screen>

            {/* Tab 3: CURSE (Istoric călătorii, export CSV, detalii călătorie) */}
            <Tab.Screen
                name="Istoric"
                options={{
                    tabBarLabel: 'CURSE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'car' : 'car-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><TripHistoryScreen /></ErrorBoundary>}
            </Tab.Screen>

            {/* Tab 4: VEHICUL (Hub central: mentenanță, profil, documente, diagnoză) */}
            <Tab.Screen
                name="Vehicul"
                options={{
                    tabBarLabel: 'VEHICUL',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'construct' : 'construct-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><VehicleHubScreen /></ErrorBoundary>}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

function AppNavigator() {
    return (
        <NavigationContainer ref={navigationRef}>
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
                <RootStack.Screen name="MainTabs" component={TabNavigator} />
                <RootStack.Screen
                    name="TripReport"
                    component={TripReportScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <RootStack.Screen
                    name="TripDetail"
                    component={TripDetailScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="Notifications"
                    component={NotificationScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <RootStack.Screen
                    name="GlobalSearch"
                    options={{ animation: 'fade' }}
                >
                    {() => <ErrorBoundary><GlobalSearchScreen /></ErrorBoundary>}
                </RootStack.Screen>
                <RootStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
                <RootStack.Screen name="AIExpert" component={AIExpertScreen} options={{ animation: 'slide_from_right' }} />
                <RootStack.Screen name="UIPlayground" component={UIPlaygroundScreen} options={{ animation: 'slide_from_right' }} />
            </RootStack.Navigator>
        </NavigationContainer>
    );
}
```

---

## 5. INVENTARUL COMPONENTELOR REUTILIZABILE & CEASURI SVG

### 5.1. Fișierele din `src/components/`

| Fișier | Descriere |
|---|---|
| `src/components/CircularGauge.js` | Ceas circular SVG complet (360° cu offset arc) |
| `src/components/HealthGauge.js` | Arc SVG semicircular pentru scor sănătate |
| `src/components/ErrorBoundary.js` | Boundary de crash-resilience |
| `src/components/StatusHeader.js` | Header de status vehicul |
| `src/components/SubsystemCard.js` | Card subsistem auto |
| `src/components/UpcomingTimeline.js` | Timeline mentenanță |
| `src/components/UrgentBanner.js` | Banner alerte roșii |

### 5.2. Componente din `src/components/ui/` (Design System UI)

1. `BottomSheet.js` — Fereastră modal glisantă cu gesturi PanResponder (drag-down to dismiss).
2. `Button.js` — Buton acționabil (5 variante: primary, secondary, ghost, danger, success).
3. `IconButton.js` — Buton compact cu iconiță și badge numeric.
4. `Card.js` — Container universal cu variante (`default`, `outlined`, `filled`, `elevated`).
5. `HeroCard.js` — Card principal cu valoare mare și icon semantic.
6. `MetricCard.js` — Card compact 2×2 cu trend procentual.
7. `HealthGauge.js` — Indicator SVG arc animat (π → 2π).
8. `RecommendationCard.js` — Recomandare tehnică cu prioritate și buton CTA.
9. `PredictionCard.js` — Card predicție AI cu probabilitate și orizont km.
10. `CausalChainCard.js` — Diagramă cauză-efect-simptom pe 3 noduri.
11. `TimelineCard.js` — Element de cronologie verticală conectată.
12. `MaintenanceCard.js` — Sarcină de service cu dublu termen (km și dată).
13. `DriveModeBanner.js` — Banner dinamic când viteza sau turația este activă.
14. `StatusBadge.js` — Pill indicator de stare (`optimal`, `good`, `monitor`, `caution`, `critical`).
15. `Skeleton.js` — Placeholder pulsatoriu de încărcare pentru reducerea perceived lag.
16. `SearchBar.js` — Bară de căutare cu buton de curățare instant.
17. `Input.js` — Câmp de text cu focus vizual și validare erori.
18. `EmptyState.js` — Stare vidă prietenoasă cu acțiune de reîncercare.
19. `Divider.js` — Separator orizontal sau vertical.
20. `VehicleAvatar.js` — Avatar vehicul cu indicator combustibil și stare.
21. `CostCard.js` — Card cost financiar cu breakdown expandabil.
22. `DocumentCard.js` — Card fișiere (ITP, RCA, facturi).
23. `MilestoneCard.js` — Card aniversar / target kilometric.
24. `WorkshopCard.js` — Card service auto cu distanță și buton de apelare directă.

---

### 5.3. Codul Complet al Componentei `CircularGauge.js`

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography, spacing } from '../theme';
import PropTypes from 'prop-types';

const CircularGauge = ({ label, value, unit, min = 0, max = 100, color = colors.accent.default, size = 130 }) => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const safeValue = Math.min(Math.max(Number(value) || 0, min), max);
    const percent = ((safeValue - min) / (max - min)) * 100;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <View style={styles.container}>
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Svg width={size} height={size} style={{ position: 'absolute' }}>
                    {/* Track de fundal */}
                    <Circle
                        stroke={colors.border.strong}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    {/* Arc Progresiv */}
                    <Circle
                        stroke={color}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        originX={size / 2}
                        originY={size / 2}
                    />
                </Svg>
                <Text style={[styles.valText, { color }, styles.tabular]} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                </Text>
                <Text style={styles.unitText}>{unit}</Text>
            </View>
            <Text style={styles.labelText}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: spacing[2] + 2,
        width: '48%',
    },
    valText: {
        fontSize: typography.sizes.hero - 8,
        fontWeight: typography.weights.heavy,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    unitText: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: -2,
    },
    labelText: {
        fontSize: typography.sizes.micro,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        marginTop: spacing[2] + 2,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default CircularGauge;
```

---

### 5.4. Codul Complet al Componentei `src/components/ui/HealthGauge.js`

```javascript
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, spacing, motion } from '../../theme';
import { getHealthColor } from '../../utils/statusUtils';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const SIZES = {
    sm: { total: 120, stroke: 8  },
    md: { total: 180, stroke: 12 },
    lg: { total: 240, stroke: 16 },
    xl: { total: 300, stroke: 20 },
};

const VALUE_FONT = {
    sm: typography.sizes.title2,
    md: typography.sizes.hero,
    lg: typography.sizes.display,
    xl: typography.sizes.display,
};

// Semicircle arc: π → 2π (left through bottom to right)
const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const HealthGauge = React.memo(({
    score,
    label,
    subtitle,
    size = 'md',
    animate = true,
    loading = false,
    style,
}) => {
    const { total, stroke } = SIZES[size];
    const [displayScore, setDisplayScore] = useState(animate ? 0 : (score ?? 0));
    const animScore = useRef(new Animated.Value(animate ? 0 : (score ?? 0))).current;

    useEffect(() => {
        if (score === null || score === undefined) return;
        if (!animate) {
            setDisplayScore(score);
            return;
        }

        animScore.setValue(0);
        const listenerId = animScore.addListener(({ value }) => setDisplayScore(value));
        Animated.timing(animScore, {
            toValue: score,
            duration: motion.duration.reveal,
            useNativeDriver: false, // SVG nu suportă native driver în React Native
        }).start();
        return () => animScore.removeListener(listenerId);
    }, [score, animate, animScore]);

    if (loading) {
        return (
            <View style={[styles.container, style]}>
                <Skeleton variant="circle" height={total * 0.6} width={total} />
                <Skeleton variant="text" height={typography.sizes.body2} width={80} style={styles.loadingLabel} />
            </View>
        );
    }

    const radius = (total - stroke) / 2 - spacing[2];
    const cx = total / 2;
    const cy = total / 2 + spacing[2];
    const svgHeight = total * 0.6;

    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const progressAngle = startAngle + (displayScore / 100) * Math.PI;

    const trackPath = describeArc(cx, cy, radius, startAngle, endAngle);
    const fillPath  = displayScore > 0
        ? describeArc(cx, cy, radius, startAngle, progressAngle)
        : '';

    const color = getHealthColor(score ?? 0);
    const displayValue = score !== null && score !== undefined ? Math.round(displayScore) : '--';

    return (
        <View style={[styles.container, style]}>
            <View style={{ width: total, height: svgHeight, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Svg width={total} height={svgHeight} style={styles.svg}>
                    <Path
                        d={trackPath}
                        stroke={colors.border.strong}
                        strokeWidth={stroke}
                        fill="none"
                        strokeLinecap="round"
                    />
                    {fillPath ? (
                        <Path
                            d={fillPath}
                            stroke={color}
                            strokeWidth={stroke}
                            fill="none"
                            strokeLinecap="round"
                        />
                    ) : null}
                </Svg>

                <View style={styles.scoreRow}>
                    <Text style={[styles.scoreValue, { fontSize: VALUE_FONT[size], color }, styles.tabular]}>
                        {displayValue}
                    </Text>
                    {typeof displayValue === 'number' && (
                        <Text style={[styles.scoreUnit, { color }]}>%</Text>
                    )}
                </View>
            </View>

            {label ? (
                <Text style={[styles.label, styles[`label_${size}`]]}>{label.toUpperCase()}</Text>
            ) : null}
            {subtitle ? (
                <Text style={[styles.subtitle, { color }]}>{subtitle}</Text>
            ) : null}
        </View>
    );
});

HealthGauge.displayName = 'HealthGauge';

const styles = StyleSheet.create({
    container: { alignItems: 'center' },
    svg: { position: 'absolute', top: 0 },
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing[1] },
    scoreValue: { fontWeight: typography.weights.heavy },
    scoreUnit: { fontSize: typography.sizes.title2, fontWeight: typography.weights.bold, marginLeft: 2 },
    tabular: { fontVariant: ['tabular-nums'] },
    label: {
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.8,
        marginTop: spacing[2],
    },
    label_sm: { fontSize: typography.sizes.micro },
    label_md: { fontSize: typography.sizes.caption },
    label_lg: { fontSize: typography.sizes.label1 },
    label_xl: { fontSize: typography.sizes.title3 },
    subtitle: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.medium,
        marginTop: spacing[1],
        textAlign: 'center',
    },
    loadingLabel: { marginTop: spacing[3], alignSelf: 'center' },
});

export default HealthGauge;
```

---

## 6. GHID DE IMPLEMENTARE PENTRU NOUL REDESIGN DE COCKPIT

Pe baza auditului de mai sus, pentru ca cele 4 șabloane să modifice **geometria ecranului** și nu doar culorile:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DIRECȚIILE DE ARHITECTURĂ LAYOUT                    │
├────────────────────────────────────────────────────────────────────────┤
│ 1. MOTORSPORT (Porsche GT3 / AiM):                                     │
│    • Turometru circular masiv în centrul ecranului (300px)             │
│    • Vitezometrul digital este plasat direct în centrul turometrului   │
│    • Ceasuri gemene stânga/dreapta: Boost (bar) și Putere (CP)         │
│                                                                        │
│ 2. AUDI SPORT RS (Virtual Cockpit):                                    │
│    • Bară unghiulară orizontală / Boomerang Hockey-Stick în partea de  │
│      sus a ecranului pentru RPM (de la stânga la dreapta spre roșu)   │
│    • Viteză afișată masiv în colțul din dreapta jos                   │
│    • Indicator separat de treaptă de viteză mare (Tr. 1-6 / R)        │
│                                                                        │
│ 3. MINIMAL CLEAN (Tesla OS):                                           │
│    • Layout aerisit, centrat pe cifre tipografice mari și clare       │
│    • Bara orizontală de transfer de energie / consum instant           │
│    • Minimalizează zgomotul vizual, evidențiind doar autonomia și starea│
│                                                                        │
│ 4. NIGHT STEALTH HUD (Proiecție Parbriz):                              │
│    • Fundal 100% negru (#000000) pentru ecrane OLED                   │
│    • Buton de oglindire orizontală (scaleX: -1)                        │
│    • Doar 2 elemente vizibile: Viteză masivă și alertă critică de turație│
└────────────────────────────────────────────────────────────────────────┘
```

---
*Raport redactat și verificat direct pe codul din branch-ul `v2-next-gen`.*
