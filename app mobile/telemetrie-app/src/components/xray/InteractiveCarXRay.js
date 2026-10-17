'use strict';

/**
 * InteractiveCarXRay.js — Arhitectură Hibridă 1 + 3 (Digital Twin 3D Cutaway + Module Explodate CAD)
 *
 * 1. Sus (Varianta 1): Mașina completă în perspectivă 3/4 cutaway cu cablaj electric (Wiring Harness)
 *    și 8 noduri luminoase cu detalii direct la suprafață (92% Motor, 88% Turbo, etc.).
 * 2. Mijloc: Selector orizontal fluid de componente (fără butoane care se suprapun sau se rup).
 * 3. Jos (Varianta 3): Card Modular Explodat de mari dimensiuni cu ilustrație tehnică CAD a piesei,
 *    plajă de toleranță grafică OEM și buton direct către Inginerul AI.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
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
    PERSPECTIVE_PINS,
} from './xrayConstants';
import PerspectiveCarSvg from './PerspectiveCarSvg';
import ExplodedModuleCard from './ExplodedModuleCard';

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

    // Telemetrie combinată: structură completă din rawLiveData + interpolare netedă din numeric
    const combinedTelemetry = useMemo(() => ({
        ...(rawLiveData || {}),
        ...(liveData?.numeric || {}),
        motor: {
            ...(rawLiveData?.motor || {}),
            ...(liveData?.numeric?.rpm != null ? { rpm: liveData.numeric.rpm } : {}),
            ...(liveData?.numeric?.speed != null ? { speed: liveData.numeric.speed } : {}),
            ...(liveData?.numeric?.load != null ? { load: liveData.numeric.load } : {}),
        },
        aer: {
            ...(rawLiveData?.aer || {}),
            ...(liveData?.numeric?.boost != null ? { boost_actual: liveData.numeric.boost, boost_bar: liveData.numeric.boost } : {}),
        },
        temperaturi: {
            ...(rawLiveData?.temperaturi || {}),
            ...(liveData?.numeric?.coolant != null ? { temp_apa_c: liveData.numeric.coolant, coolant: liveData.numeric.coolant } : {}),
        },
        turbo: {
            ...(rawLiveData?.turbo || {}),
            ...(liveData?.numeric?.boost != null ? { boost_bar: liveData.numeric.boost } : {}),
        },
    }), [rawLiveData, liveData?.numeric]);

    // Topologie activă (detectată sau selectată)
    const detectedTopology = useMemo(() => detectVehicleTopology(activeVehicle || vehicleLabel), [activeVehicle, vehicleLabel]);
    const [topology, setTopology] = useState(detectedTopology);

    // Componenta activă pentru cardul explodat (implicit: motorul)
    const [selectedPin, setSelectedPin] = useState(PERSPECTIVE_PINS[0]);

    // Mod vizual activ: 'studio' (3D Studio Fotorealist - Opțiunea B) | 'hologram' (Hologramă CAD - Opțiunea C)
    const [visualMode, setVisualMode] = useState('studio');

    // Stare Modal Scanner
    const [isScannerOpen, setIsScannerOpen] = useState(mode === 'full');

    const scrollRef = useRef(null);

    useEffect(() => {
        setTopology(detectedTopology);
    }, [detectedTopology]);

    let hookNav = null;
    try {
        hookNav = useNavigation();
    } catch (_) {}
    const activeNav = navigation || hookNav;

    const handleAskAI = useCallback((comp) => {
        if (!comp) return;
        setIsScannerOpen(false);
        const nav = getRootNavigation(activeNav) || activeNav;
        const promptText = comp.aiPrompt || `Analizează starea componentei ${comp.name} și parametrii săi de funcționare.`;
        if (nav?.navigate) {
            nav.navigate('AIExpert', { initialPrompt: promptText });
        }
    }, [activeNav]);

    // Ciclare topologie la atingerea indicatorului
    const handleCycleTopology = useCallback(() => {
        const keys = Object.keys(TOPOLOGIES);
        const currIdx = keys.indexOf(topology);
        const nextKey = keys[(currIdx + 1) % keys.length];
        setTopology(nextKey);
    }, [topology]);

    // Selectare piesă de pe mașină sau din carusel
    const handleSelectComponent = useCallback((pin) => {
        setSelectedPin(pin);
        if (onSelectSubsystem) {
            onSelectSubsystem(pin.subsystem, { key: pin.subsystem, name: pin.name });
        }
    }, [onSelectSubsystem]);

    // ── GRILĂ TEHNICĂ 2x4 SUB MAȘINĂ (CELE 8 SUBSISTEME) ──
    const renderSubsystemGrid = (isModal = false) => (
        <View style={styles.grid2x4}>
            {PERSPECTIVE_PINS.map((pin, index) => {
                const isSelected = selectedPin?.id === pin.id;
                const pinNum = pin.num || (index + 1);
                const reading = pin.getReading ? pin.getReading(combinedTelemetry) : { val: 'Nominal' };

                return (
                    <TouchableOpacity
                        key={pin.id}
                        activeOpacity={0.75}
                        style={[
                            styles.gridCell,
                            {
                                backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.12)' : (tpl.cardBg || colors.bg[1]),
                                borderColor: isSelected ? tpl.accent : (tpl.border || colors.border.default),
                            },
                            isSelected && styles.gridCellSelected,
                        ]}
                        onPress={() => {
                            handleSelectComponent(pin);
                            if (!isModal && mode === 'preview') {
                                setIsScannerOpen(true);
                            }
                        }}
                    >
                        <View style={styles.gridCellTop}>
                            <View style={[styles.gridCellBadge, isSelected && { backgroundColor: tpl.accent }]}>
                                <Text style={[styles.gridCellBadgeText, isSelected && { color: '#05070e' }]}>
                                    {pinNum}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.gridCellName,
                                    { color: isSelected ? tpl.accent : (tpl.text || '#eef0f8') }
                                ]}
                                numberOfLines={1}
                            >
                                {pin.code}
                            </Text>
                            <View style={[styles.gridCellDot, { backgroundColor: isSelected ? tpl.accent : '#10b981' }]} />
                        </View>
                        <Text
                            style={[
                                styles.gridCellVal,
                                { color: isSelected ? '#FFFFFF' : (tpl.textSecondary || '#8b96b5') }
                            ]}
                            numberOfLines={1}
                        >
                            {reading.val}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 1: PREVIEW PE STATUS SCREEN (Curat, Elegant & Interactiv)
    // ─────────────────────────────────────────────────────────────────────────
    if (mode === 'preview' && !isScannerOpen) {
        return (
            <View style={[styles.container, style]}>
                {/* Header Titlu & Vehicul */}
                <View style={styles.headerRow}>
                    <View style={styles.headerTag}>
                        <Text style={styles.headerTagText}>🔬 DIGITAL TWIN 3D</Text>
                    </View>
                    <Text
                        style={styles.headerTopologyText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {TOPOLOGIES[topology]?.shortLabel || 'Universal'}{vehicleLabel ? ` · ${vehicleLabel}` : ''}
                    </Text>
                </View>

                {/* Switcher Mod Vizual (Opțiunea B: 3D Studio vs. Opțiunea C: Hologramă CAD) */}
                <View style={styles.visualModeSwitchWrap}>
                    <TouchableOpacity
                        style={[
                            styles.visualModePill,
                            visualMode === 'studio' && [styles.visualModePillActive, { borderColor: tpl.accent, backgroundColor: 'rgba(0, 240, 255, 0.12)' }]
                        ]}
                        onPress={() => setVisualMode('studio')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.visualModeText, visualMode === 'studio' && { color: tpl.accent, fontWeight: 'bold' }]}>
                            📸 3D STUDIO FOTOREALIST
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.visualModePill,
                            visualMode === 'hologram' && [styles.visualModePillActive, { borderColor: tpl.accent, backgroundColor: 'rgba(0, 240, 255, 0.12)' }]
                        ]}
                        onPress={() => setVisualMode('hologram')}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.visualModeText, visualMode === 'hologram' && { color: tpl.accent, fontWeight: 'bold' }]}>
                            🧬 HOLOGRAMĂ CAD
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Vector Canvas 3D cu Siluetă Top-Down Simetrică */}
                <View style={styles.previewCanvasWrap}>
                    <PerspectiveCarSvg
                        visualMode={visualMode}
                        liveData={combinedTelemetry}
                        selectedPinId={selectedPin?.id}
                        onSelectPin={(pin) => {
                            handleSelectComponent(pin);
                            setIsScannerOpen(true);
                        }}
                    />
                </View>

                {/* Grilă Tehnică 2x4 Sub Mașină */}
                {renderSubsystemGrid(false)}

                {/* Buton Deschidere Scanner */}
                <TouchableOpacity
                    style={[styles.openScannerBtn, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}
                    onPress={() => setIsScannerOpen(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Deschide Scannerul Anatomic 3D"
                >
                    <Text style={[styles.openScannerBtnText, { color: tpl.accent }]}>
                        🔍 Deschide Scannerul Anatomic & Module Explodate ❯
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 2: MODAL COMPLET DE INSPECȚIE (Hibrid 1 + 3: 3D Cutaway + Module Explodate)
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <Modal
            visible={isScannerOpen}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setIsScannerOpen(false)}
        >
            <View style={[styles.modalRoot, { backgroundColor: tpl.bg }]}>
                {/* ── Top Bar ── */}
                <View style={[styles.modalHeader, { borderBottomColor: tpl.border }]}>
                    <View style={styles.modalHeaderLeft}>
                        <Text style={styles.modalTitle}>🔬 SCANNER ANATOMIC 3D</Text>
                        <Text style={styles.modalSub}>{vehicleLabel || 'Vehicul Universal · CAD Telemetrie'}</Text>
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

                <ScrollView
                    ref={scrollRef}
                    style={styles.modalScroll}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Comenzi Superioare: Topologie + Switcher Mod Vizual ── */}
                    <View style={styles.modalControlRow}>
                        <TouchableOpacity
                            style={[styles.topologyChip, { borderColor: tpl.border }]}
                            onPress={handleCycleTopology}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.topologyChipLabel}>Topologie:</Text>
                            <Text style={[styles.topologyChipValue, { color: tpl.accent }]}>
                                {TOPOLOGIES[topology]?.shortLabel || TOPOLOGIES[topology]?.label} ▾
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.modalModeSwitchWrap}>
                            <TouchableOpacity
                                style={[
                                    styles.modalModePill,
                                    visualMode === 'studio' && [styles.modalModePillActive, { borderColor: tpl.accent, backgroundColor: 'rgba(0, 240, 255, 0.14)' }]
                                ]}
                                onPress={() => setVisualMode('studio')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalModeText, visualMode === 'studio' && { color: tpl.accent, fontWeight: 'bold' }]}>
                                    📸 3D STUDIO
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalModePill,
                                    visualMode === 'hologram' && [styles.modalModePillActive, { borderColor: tpl.accent, backgroundColor: 'rgba(0, 240, 255, 0.14)' }]
                                ]}
                                onPress={() => setVisualMode('hologram')}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.modalModeText, visualMode === 'hologram' && { color: tpl.accent, fontWeight: 'bold' }]}>
                                    🧬 HOLO CAD
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── SECTIUNEA 1 (VARIANTA 1): Digital Twin 3D Cutaway cu Puncte Interactive ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <PerspectiveCarSvg
                            visualMode={visualMode}
                            liveData={combinedTelemetry}
                            selectedPinId={selectedPin?.id}
                            onSelectPin={handleSelectComponent}
                        />
                    </View>

                    {/* ── SECTIUNEA 2: Grilă Tehnică 2x4 Sub Mașină (Cele 8 Subsisteme) ── */}
                    <View style={styles.selectorSection}>
                        <Text style={styles.selectorHeading}>ALEGE MODULUL PENTRU INSPECȚIE EXPLODATĂ (2x4 SUBSISTEME):</Text>
                        {renderSubsystemGrid(true)}
                    </View>

                    {/* ── SECTIUNEA 3 (VARIANTA 3): Card Modular Explodat cu Ilustrație CAD Mare ── */}
                    {selectedPin ? (
                        <ExplodedModuleCard
                            component={selectedPin}
                            liveData={combinedTelemetry}
                            theme={tpl}
                            onAskAI={handleAskAI}
                        />
                    ) : null}
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
        color: colors.text.secondary,
        fontSize: typography.sizes.caption,
        flex: 1,
        textAlign: 'right',
        marginLeft: spacing[2],
    },
    visualModeSwitchWrap: {
        flexDirection: 'row',
        backgroundColor: colors.bg[2] || '#0d1527',
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: 3,
        marginBottom: spacing[2],
    },
    visualModePill: {
        flex: 1,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    visualModePillActive: {
        shadowColor: '#00f0ff',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    visualModeText: {
        fontSize: 10,
        fontWeight: typography.weights.medium,
        color: colors.text.secondary,
        letterSpacing: 0.3,
    },
    previewCanvasWrap: {
        position: 'relative',
        width: '100%',
        minHeight: 235,
        alignItems: 'center',
        justifyContent: 'center',
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
        color: colors.text.secondary,
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

    // Modal Upper Controls
    modalControlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    topologyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: spacing[3],
        gap: 6,
    },
    topologyChipLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    topologyChipValue: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    modalModeSwitchWrap: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1] || '#0d1527',
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: 2,
    },
    modalModePill: {
        paddingVertical: 5,
        paddingHorizontal: spacing[2],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    modalModePillActive: {},
    modalModeText: {
        fontSize: 10,
        fontWeight: typography.weights.medium,
        color: colors.text.secondary,
        letterSpacing: 0.2,
    },

    // Canvas Card (Varianta 1)
    canvasCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[2],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },

    // Selector Section & 2x4 Subsystems Grid
    selectorSection: {
        marginTop: spacing[3],
        marginBottom: spacing[1],
    },
    selectorHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.6,
        marginBottom: spacing[2],
    },
    grid2x4: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: spacing[2],
        marginVertical: spacing[1],
    },
    gridCell: {
        width: '48.5%',
        borderRadius: radii.md,
        borderWidth: 1,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[2],
    },
    gridCellSelected: {
        shadowColor: '#00f0ff',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
        elevation: 3,
    },
    gridCellTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 3,
    },
    gridCellBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridCellBadgeText: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        color: '#eef0f8',
    },
    gridCellName: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        flex: 1,
    },
    gridCellDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    gridCellVal: {
        fontSize: 12,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
        marginLeft: 24,
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
