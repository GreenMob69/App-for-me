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

    // Topologie activă (detectată sau selectată)
    const detectedTopology = useMemo(() => detectVehicleTopology(activeVehicle || vehicleLabel), [activeVehicle, vehicleLabel]);
    const [topology, setTopology] = useState(detectedTopology);

    // Componenta activă pentru cardul explodat (implicit: motorul)
    const [selectedPin, setSelectedPin] = useState(PERSPECTIVE_PINS[0]);

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
        const rootNav = getRootNavigation(activeNav);
        const promptText = comp.aiPrompt || `Analizează starea componentei ${comp.name} și parametrii săi de funcționare.`;
        if (rootNav) {
            rootNav.navigate('Vehicul', {
                screen: 'AIExpert',
                params: { initialPrompt: promptText },
            });
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

                {/* Vector Canvas 3D cu Detalii la Suprafață */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsScannerOpen(true)}
                    style={styles.previewCanvasWrap}
                >
                    <PerspectiveCarSvg
                        liveData={liveData}
                        selectedPinId={selectedPin?.id}
                        onSelectPin={(pin) => {
                            handleSelectComponent(pin);
                            setIsScannerOpen(true);
                        }}
                    />
                </TouchableOpacity>

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
                    {/* ── Indicator Arhitectură Șasiu (Compact, Un Singur Chip) ── */}
                    <TouchableOpacity
                        style={[styles.topologyChip, { borderColor: tpl.border }]}
                        onPress={handleCycleTopology}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.topologyChipLabel}>Arhitectură:</Text>
                        <Text style={[styles.topologyChipValue, { color: tpl.accent }]}>
                            {TOPOLOGIES[topology]?.label} ▾
                        </Text>
                        <Text style={styles.topologyChipHint}>(Atinge pt. schimbare)</Text>
                    </TouchableOpacity>

                    {/* ── SECTIUNEA 1 (VARIANTA 1): Digital Twin 3D Cutaway cu Puncte Interactive ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        <PerspectiveCarSvg
                            liveData={liveData}
                            selectedPinId={selectedPin?.id}
                            onSelectPin={handleSelectComponent}
                        />
                    </View>

                    {/* ── SECTIUNEA 2: Rând de Selectare Rapidă a Pieselor (Fără Wrap / Fără Suprapuneri) ── */}
                    <View style={styles.selectorSection}>
                        <Text style={styles.selectorHeading}>ALEGE MODULUL PENTRU INSPECȚIE EXPLODATĂ:</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.selectorScroll}
                        >
                            {PERSPECTIVE_PINS.map(pin => {
                                const isSelected = selectedPin?.id === pin.id;
                                const reading = pin.getReading ? pin.getReading(liveData) : { val: 'Nominal' };

                                return (
                                    <TouchableOpacity
                                        key={pin.id}
                                        style={[
                                            styles.moduleChip,
                                            isSelected && { borderColor: tpl.accent, backgroundColor: 'rgba(77, 142, 245, 0.16)' },
                                        ]}
                                        onPress={() => handleSelectComponent(pin)}
                                    >
                                        <View style={[styles.moduleChipDot, { backgroundColor: isSelected ? tpl.accent : '#10b981' }]} />
                                        <Text style={[styles.moduleChipCode, isSelected && { color: tpl.accent }]}>
                                            {pin.code}
                                        </Text>
                                        <Text style={styles.moduleChipVal}>{reading.val}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* ── SECTIUNEA 3 (VARIANTA 3): Card Modular Explodat cu Ilustrație CAD Mare ── */}
                    {selectedPin ? (
                        <ExplodedModuleCard
                            component={selectedPin}
                            liveData={liveData}
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
        color: colors.text.tertiary,
        fontSize: typography.sizes.caption,
        flex: 1,
        textAlign: 'right',
        marginLeft: spacing[2],
    },
    previewCanvasWrap: {
        position: 'relative',
        width: '100%',
        minHeight: 280,
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

    // Topology Indicator Chip
    topologyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: spacing[3],
        marginBottom: spacing[3],
        gap: 6,
    },
    topologyChipLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },
    topologyChipValue: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    topologyChipHint: {
        fontSize: 10,
        color: colors.text.tertiary,
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

    // Selector Section
    selectorSection: {
        marginTop: spacing[3],
        marginBottom: spacing[1],
    },
    selectorHeading: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.6,
        marginBottom: spacing[2],
    },
    selectorScroll: {
        gap: spacing[2],
        paddingRight: spacing[2],
    },
    moduleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[1],
        gap: 5,
    },
    moduleChipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    moduleChipCode: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
    },
    moduleChipVal: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
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
