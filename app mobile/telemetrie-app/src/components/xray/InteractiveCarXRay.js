'use strict';

/**
 * InteractiveCarXRay.js — Scanner Anatomic & Digital Twin cu Ierarhie Logică de Zone
 *
 * Structură progresivă (Progressive Disclosure):
 * - Level 1 (Vedere Generală): Siluetă curată CAD pe cele 3 compartimente principale.
 * - Level 2 (Zone Concentrate): Sub Capotă, Șasiu & Tren Rulare, Frâne & Dinamică.
 * - Level 3 (Sub-Categorii): Maxim 2-3 componente per schemă, fără aglomerație sau coliziuni.
 * - Topologii Reale: Schimbarea arhitecturii (Transversal / Longitudinal / BEV) modifică real desenul tehnic!
 */

import React, { useState, useRef, useEffect, useContext, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    Platform,
    StatusBar,
} from 'react-native';
import { colors, typography, radii, spacing, layout, useThemeTemplate } from '../../theme';
import { LiveContext } from '../../context/LiveContext';
import { useVehicle } from '../../context/VehicleContext';
import { useSmoothedTelemetry } from '../../hooks/useSmoothedTelemetry';
import { getRootNavigation } from '../../utils/navigation';
import { useNavigation } from '@react-navigation/native';
import PropTypes from 'prop-types';

import {
    TOPOLOGIES,
    detectVehicleTopology,
    ZONES,
    ZONE_SUBCATEGORIES,
    SENSORS_BY_CATEGORY,
} from './xrayConstants';
import ChassisOverviewSvg from './ChassisOverviewSvg';
import EngineBaySvg from './EngineBaySvg';
import UnderbodySvg from './UnderbodySvg';
import ComponentCard from './ComponentCard';

const InteractiveCarXRay = ({
    mode = 'preview',
    subsystems = {},
    selectedKey = null,
    onSelectSubsystem,
    navigation,
    style,
}) => {
    const tpl = useThemeTemplate();
    const { activeVehicle, vehicleLabel } = useVehicle();
    const { liveData: rawLiveData } = useContext(LiveContext) || {};
    const liveData = useSmoothedTelemetry(rawLiveData || {});

    // Topologie activă (detectată sau selectată manual)
    const detectedTopology = useMemo(() => detectVehicleTopology(activeVehicle || vehicleLabel), [activeVehicle, vehicleLabel]);
    const [topology, setTopology] = useState(detectedTopology);

    // Zonă activă în Scanner: 'OVERVIEW' | 'ENGINE_BAY' | 'UNDERBODY' | 'WHEELS_BRAKES'
    const [activeZone, setActiveZone] = useState('OVERVIEW');

    // Sub-categorie activă per zonă
    const [activeSubCategory, setActiveSubCategory] = useState('AIR_BOOST');

    // Componenta / Senzorul selectat pentru inspecție
    const [selectedComponent, setSelectedComponent] = useState(null);

    // Stare Modal Scanner
    const [isScannerOpen, setIsScannerOpen] = useState(mode === 'full');

    // Sincronizează topologia când se schimbă vehiculul
    useEffect(() => {
        setTopology(detectedTopology);
    }, [detectedTopology]);

    // Resetează sub-categoria când se schimbă zona
    const handleZoneChange = useCallback((zoneId) => {
        setActiveZone(zoneId);
        const subCats = ZONE_SUBCATEGORIES[zoneId];
        if (subCats && subCats.length > 0) {
            setActiveSubCategory(subCats[0].id);
            const firstSensor = SENSORS_BY_CATEGORY[subCats[0].id]?.[0] || null;
            setSelectedComponent(firstSensor);
        } else {
            setSelectedComponent(null);
        }
    }, []);

    // Schimbă sub-categoria curentă
    const handleSubCategoryChange = useCallback((subCatId) => {
        setActiveSubCategory(subCatId);
        const firstSensor = SENSORS_BY_CATEGORY[subCatId]?.[0] || null;
        setSelectedComponent(firstSensor);
    }, []);

    let hookNav = null;
    try {
        hookNav = useNavigation();
    } catch (_) {}
    const activeNav = navigation || hookNav;

    const handleAskAI = useCallback((comp) => {
        if (!comp) return;
        setIsScannerOpen(false);
        const rootNav = getRootNavigation(activeNav);
        const promptText = comp.aiPrompt || `Analizează starea componentei ${comp.name} și parametrii săi de funcționare.`;
        if (rootNav) {
            rootNav.navigate('Vehicul', {
                screen: 'AIExpert',
                params: { initialPrompt: promptText },
            });
        }
    }, [activeNav]);

    // Senzorii din sub-categoria curentă (maxim 2-3 piese!)
    const currentSensors = useMemo(() => {
        return SENSORS_BY_CATEGORY[activeSubCategory] || [];
    }, [activeSubCategory]);

    // Noduri pentru ecranul principal (Preview Glance)
    const previewNodes = useMemo(() => {
        return [
            { x: 160, y: 50,  score: subsystems.racire?.score ?? 94, label: 'RĂCIRE' },
            { x: 160, y: 105, score: subsystems.motor?.score ?? 92,  label: 'MOTOR' },
            { x: 160, y: 185, score: subsystems.transmisie?.score ?? 90, label: 'CUTIE' },
            { x: 160, y: 265, score: subsystems.dpf?.score ?? 91,    label: 'DPF' },
        ];
    }, [subsystems]);

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 1: MODUL PREVIEW (Pe StatusScreen — Ultra Curat, Fără Linii Agasante)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'preview' && !isScannerOpen) {
        return (
            <View style={[styles.container, style]}>
                {/* ── Technical Header Title ── */}
                <View style={styles.headerRow}>
                    <View style={styles.headerTag}>
                        <Text style={styles.headerTagText}>🔬 DIGITAL TWIN X-RAY</Text>
                    </View>
                    <Text
                        style={styles.headerTopologyText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {TOPOLOGIES[topology]?.shortLabel || 'Universal'}{vehicleLabel ? ` · ${vehicleLabel}` : ''}
                    </Text>
                </View>

                {/* ── Vector Schematic Canvas (Clean, fără laser) ── */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsScannerOpen(true)}
                    style={styles.previewCanvasWrap}
                >
                    <ChassisOverviewSvg
                        topology={topology}
                        height={280}
                        activeZone="OVERVIEW"
                    />

                    {/* Minimalist % Badges next to nodes */}
                    {previewNodes.map((item, idx) => {
                        const col = item.score >= 90 ? colors.status.optimal : item.score >= 75 ? colors.status.good : colors.status.caution;
                        const leftPct = (item.x / 320) * 100;
                        const topPct  = (item.y / 440) * 100;

                        return (
                            <View
                                key={idx}
                                style={[styles.minimalBadgeWrap, { left: `${leftPct}%`, top: `${topPct}%` }]}
                                pointerEvents="none"
                            >
                                <View style={[styles.minimalBadge, { borderColor: col, backgroundColor: 'rgba(8, 12, 22, 0.94)' }]}>
                                    <Text style={[styles.minimalBadgeScore, { color: col }]}>{item.score}%</Text>
                                </View>
                            </View>
                        );
                    })}
                </TouchableOpacity>

                {/* ── Action Bar: Deschide Scannerul Anatomic 360° ── */}
                <TouchableOpacity
                    style={[styles.openScannerBtn, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}
                    onPress={() => setIsScannerOpen(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide Scannerul Anatomic"
                >
                    <Text style={[styles.openScannerBtnText, { color: tpl.accent }]}>
                        🔍 Deschide Scannerul Anatomic pe Zone ❯
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 2: MODUL SCANNER COMPLET (Modal cu Ierarhie & Fără Clutter)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Modal
            visible={isScannerOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setIsScannerOpen(false)}
        >
            <View style={[styles.modalRoot, { backgroundColor: tpl.bg }]}>
                {/* ── Top Bar cu Închidere și Titlu ── */}
                <View style={[styles.modalHeader, { borderBottomColor: tpl.border }]}>
                    <View style={styles.modalHeaderLeft}>
                        <Text style={styles.modalTitle}>🔬 SCANNER ANATOMIC</Text>
                        <Text style={styles.modalSub}>{vehicleLabel || 'Vehicul Universal · Diagnoză CAD'}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.closeBtn, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}
                        onPress={() => setIsScannerOpen(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Închide Scanner"
                    >
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                    {/* ── 1. Selector Topologie Universală ── */}
                    <View style={styles.topologySection}>
                        <Text style={styles.sectionHeading}>ARHITECTURĂ ȘASIU:</Text>
                        <View style={styles.topologyPillRow}>
                            {Object.values(TOPOLOGIES).map(t => (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        styles.topologyPill,
                                        topology === t.id && { backgroundColor: tpl.accent, borderColor: tpl.accent }
                                    ]}
                                    onPress={() => setTopology(t.id)}
                                >
                                    <Text style={[styles.topologyPillText, topology === t.id && styles.topologyPillTextActive]}>
                                        {t.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.topologyDesc}>{TOPOLOGIES[topology]?.desc}</Text>
                    </View>

                    {/* ── 2. Selector Zone Anatomice Principale (Macro-Nivel) ── */}
                    <View style={styles.zoneNav}>
                        <Text style={styles.sectionHeading}>ALEGE ZONA PENTRU INSPECȚIE:</Text>
                        <View style={styles.zoneTabsRow}>
                            {ZONES.map(z => {
                                const isCurrent = activeZone === z.id;
                                return (
                                    <TouchableOpacity
                                        key={z.id}
                                        style={[
                                            styles.zoneTab,
                                            isCurrent && { backgroundColor: tpl.cardBg, borderColor: tpl.accent, borderWidth: 1.5 }
                                        ]}
                                        onPress={() => handleZoneChange(z.id)}
                                    >
                                        <Text style={styles.zoneTabIcon}>{z.icon}</Text>
                                        <Text style={[styles.zoneTabLabel, isCurrent && { color: tpl.accent, fontWeight: '700' }]}>
                                            {z.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* ── 3. Sub-Categorii Logice (Dacă suntem într-o zonă specifică) ── */}
                    {activeZone !== 'OVERVIEW' && ZONE_SUBCATEGORIES[activeZone] && (
                        <View style={styles.subCategorySection}>
                            <Text style={styles.subCategoryHeading}>SISTEME DETALIATE (FĂRĂ AGLOMERAȚIE):</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCategoryScroll}>
                                {ZONE_SUBCATEGORIES[activeZone].map(sc => {
                                    const isSelected = activeSubCategory === sc.id;
                                    return (
                                        <TouchableOpacity
                                            key={sc.id}
                                            style={[
                                                styles.subCategoryChip,
                                                isSelected && { backgroundColor: tpl.accent, borderColor: tpl.accent }
                                            ]}
                                            onPress={() => handleSubCategoryChange(sc.id)}
                                        >
                                            <Text style={[styles.subCategoryChipText, isSelected && styles.subCategoryChipTextActive]}>
                                                {sc.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* ── 4. Schema CAD Tehnică (Curată & Fără Linii Agasante) ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        {activeZone === 'OVERVIEW' && (
                            <View style={styles.canvasContainer}>
                                <ChassisOverviewSvg
                                    topology={topology}
                                    height={320}
                                    activeZone={activeZone}
                                />
                                <View style={styles.overviewPromptOverlay}>
                                    <Text style={styles.overviewPromptTitle}>💡 Privire de Ansamblu CAD</Text>
                                    <Text style={styles.overviewPromptDesc}>
                                        Selectează o zonă din bara de sus (Sub Capotă, Șasiu sau Frâne) pentru a pătrunde în detalii.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {activeZone === 'ENGINE_BAY' && (
                            <View style={styles.canvasContainer}>
                                <EngineBaySvg
                                    topology={topology}
                                    subCategory={activeSubCategory}
                                    activeSensors={currentSensors}
                                    selectedSensorId={selectedComponent?.id}
                                    onSelectSensor={(s) => setSelectedComponent(s)}
                                />
                            </View>
                        )}

                        {(activeZone === 'UNDERBODY' || activeZone === 'WHEELS_BRAKES') && (
                            <View style={styles.canvasContainer}>
                                <UnderbodySvg
                                    topology={topology}
                                    subCategory={activeSubCategory}
                                    activeSensors={currentSensors}
                                    selectedSensorId={selectedComponent?.id}
                                    onSelectSensor={(s) => setSelectedComponent(s)}
                                />
                            </View>
                        )}
                    </View>

                    {/* ── 5. Selector Componente Active din Sub-Categorie ── */}
                    {activeZone !== 'OVERVIEW' && currentSensors.length > 0 && (
                        <View style={styles.sensorRowSelector}>
                            <Text style={styles.sensorRowLabel}>PIESE & SENZORI IDENTIFICAȚI:</Text>
                            <View style={styles.sensorPillList}>
                                {currentSensors.map(sensor => {
                                    const isSelected = selectedComponent?.id === sensor.id;
                                    const reading = sensor.getReading ? sensor.getReading(liveData) : { val: 'Nominal' };

                                    return (
                                        <TouchableOpacity
                                            key={sensor.id}
                                            style={[
                                                styles.sensorChip,
                                                isSelected && { borderColor: tpl.accent, backgroundColor: 'rgba(77, 142, 245, 0.16)' }
                                            ]}
                                            onPress={() => setSelectedComponent(sensor)}
                                        >
                                            <View style={styles.sensorChipDot} />
                                            <Text style={styles.sensorChipCode}>{sensor.code}:</Text>
                                            <Text style={[styles.sensorChipVal, isSelected && { color: tpl.accent, fontWeight: 'bold' }]}>
                                                {reading.val}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ── 6. Card Detaliat de Inspecție & Toleranță OEM ── */}
                    {selectedComponent ? (
                        <ComponentCard
                            component={selectedComponent}
                            liveData={liveData}
                            theme={tpl}
                            onAskAI={handleAskAI}
                        />
                    ) : (
                        activeZone !== 'OVERVIEW' && (
                            <View style={[styles.emptyPromptBox, { borderColor: tpl.border }]}>
                                <Text style={styles.emptyPromptText}>
                                    👆 Atinge orice piesă din lista de mai sus pentru a vizualiza toleranța tehnică și valorile din telemetrie.
                                </Text>
                            </View>
                        )
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// STILURI
// ─────────────────────────────────────────────────────────────────────────────

const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3],
        marginVertical: spacing[2],
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
        paddingHorizontal: spacing[1],
    },
    headerTag: {
        backgroundColor: 'rgba(77, 142, 245, 0.12)',
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: 'rgba(77, 142, 245, 0.3)',
    },
    headerTagText: {
        color: colors.accent.default,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
    },
    headerTopologyText: {
        color: colors.text.tertiary,
        fontSize: typography.sizes.caption,
        flex: 1,
        textAlign: 'right',
        marginLeft: spacing[2],
    },
    previewCanvasWrap: {
        position: 'relative',
        width: '100%',
        height: 280,
        alignItems: 'center',
        justifyContent: 'center',
    },
    minimalBadgeWrap: {
        position: 'absolute',
        transform: [{ translateX: -14 }, { translateY: -14 }],
    },
    minimalBadge: {
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: radii.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    minimalBadgeScore: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    openScannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        marginTop: spacing[2],
    },
    openScannerBtnText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },

    // ── MODAL ──
    modalRoot: {
        flex: 1,
        paddingTop: PT,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
    },
    modalHeaderLeft: {
        flex: 1,
    },
    modalTitle: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    modalSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: typography.weights.bold,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[3],
        paddingBottom: spacing[10],
    },

    // Topologie
    topologySection: {
        marginBottom: spacing[3],
    },
    sectionHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.8,
        marginBottom: spacing[2],
    },
    topologyPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    topologyPill: {
        paddingVertical: 6,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
    },
    topologyPillText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },
    topologyPillTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
    },
    topologyDesc: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontStyle: 'italic',
        marginTop: 2,
    },

    // Zone Nav
    zoneNav: {
        marginBottom: spacing[3],
    },
    zoneTabsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    zoneTab: {
        flex: 1,
        minWidth: '45%',
        paddingVertical: 10,
        paddingHorizontal: spacing[2],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    zoneTabIcon: {
        fontSize: 16,
    },
    zoneTabLabel: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        textAlign: 'center',
    },

    // Sub-Categories
    subCategorySection: {
        marginBottom: spacing[3],
    },
    subCategoryHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        marginBottom: spacing[2],
    },
    subCategoryScroll: {
        gap: spacing[2],
        paddingRight: spacing[2],
    },
    subCategoryChip: {
        paddingVertical: 7,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
    },
    subCategoryChipText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },
    subCategoryChipTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
    },

    // Canvas Card
    canvasCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    canvasContainer: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    overviewPromptOverlay: {
        marginTop: spacing[2],
        padding: spacing[2],
        alignItems: 'center',
    },
    overviewPromptTitle: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    overviewPromptDesc: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
        textAlign: 'center',
    },

    // Sensor Row Selector
    sensorRowSelector: {
        marginTop: spacing[3],
    },
    sensorRowLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        marginBottom: spacing[2],
    },
    sensorPillList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
    },
    sensorChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
        gap: 6,
    },
    sensorChipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    sensorChipCode: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    sensorChipVal: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
    },

    emptyPromptBox: {
        marginTop: spacing[3],
        padding: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyPromptText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 18,
    },
});

export default InteractiveCarXRay;

InteractiveCarXRay.propTypes = {
    mode: PropTypes.oneOf(['preview', 'full']),
    subsystems: PropTypes.object,
    selectedKey: PropTypes.string,
    onSelectSubsystem: PropTypes.func,
    navigation: PropTypes.object,
    style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};
