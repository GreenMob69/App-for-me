'use strict';

/**
 * InteractiveCarXRay.js — Scanner Anatomic & Digital Twin Interactiv (Drawing-First)
 *
 * 1. Fără aglomerație de butoane: Un singur comutator curat [ 🚗 Vedere 3D | 🔧 Zoom Motor ].
 * 2. Interacțiune directă pe desen: Piese și senzori cu cip-uri cu detalii la suprafață.
 * 3. Inspecție instantanee: La atingerea oricărei piese, cardul de jos afișează toleranța OEM și diagnoza.
 */

import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
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
    SENSORS_BY_CATEGORY,
} from './xrayConstants';
import PerspectiveCarSvg from './PerspectiveCarSvg';
import EngineBaySvg from './EngineBaySvg';
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

    // Topologie activă (detectată sau comutată)
    const detectedTopology = useMemo(() => detectVehicleTopology(activeVehicle || vehicleLabel), [activeVehicle, vehicleLabel]);
    const [topology, setTopology] = useState(detectedTopology);

    // Unghi activ: '3D_VIEW' (Ansamblu) sau 'ENGINE_BAY' (Zoom Motor)
    const [activeView, setActiveView] = useState('3D_VIEW');

    // Componenta selectată pentru inspecție (inițial prima piesă: motorul)
    const [selectedComponent, setSelectedComponent] = useState(PERSPECTIVE_PINS[0]);

    // Stare Modal Scanner
    const [isScannerOpen, setIsScannerOpen] = useState(mode === 'full');

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

    // Comută rapid prin cele 4 topologii la atingerea chip-ului de arhitectură
    const handleCycleTopology = useCallback(() => {
        const keys = Object.keys(TOPOLOGIES);
        const currIdx = keys.indexOf(topology);
        const nextKey = keys[(currIdx + 1) % keys.length];
        setTopology(nextKey);
    }, [topology]);

    // Senzorii din compartimentul motor pentru vederea 'ENGINE_BAY'
    const engineBaySensors = useMemo(() => {
        return [
            ...(SENSORS_BY_CATEGORY.AIR_BOOST || []),
            ...(SENSORS_BY_CATEGORY.FUEL_ING || []),
            ...(SENSORS_BY_CATEGORY.COOLING_ELEC || []),
        ];
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 1: PREVIEW PE STATUS SCREEN (Ultra Curat & Elegant)
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
                        selectedPinId={selectedComponent?.id}
                        onSelectPin={(pin) => {
                            setSelectedComponent(pin);
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
                        🔍 Deschide Scannerul Anatomic 3D (Inspecție Piese) ❯
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VEDERE 2: MODAL COMPLET DE INSPECȚIE (Direct pe Desen, Fără Butoane Îngrămădite)
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

                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                    {/* ── 1. Selector Curat: Un Singur Segmented Control (Fără Suprapuneri!) ── */}
                    <View style={styles.viewSegmentedWrap}>
                        <TouchableOpacity
                            style={[
                                styles.viewSegmentBtn,
                                activeView === '3D_VIEW' && { backgroundColor: tpl.accent }
                            ]}
                            onPress={() => setActiveView('3D_VIEW')}
                        >
                            <Text style={[styles.viewSegmentText, activeView === '3D_VIEW' && styles.viewSegmentTextActive]}>
                                🚗 VEDERE 3D ANSAMBLU
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.viewSegmentBtn,
                                activeView === 'ENGINE_BAY' && { backgroundColor: tpl.accent }
                            ]}
                            onPress={() => setActiveView('ENGINE_BAY')}
                        >
                            <Text style={[styles.viewSegmentText, activeView === 'ENGINE_BAY' && styles.viewSegmentTextActive]}>
                                🔧 ZOOM MOTOR & SENZORI
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── 2. Indicator Arhitectură Șasiu (Compact, Un Singur Chip) ── */}
                    <TouchableOpacity
                        style={[styles.topologyChip, { borderColor: tpl.border }]}
                        onPress={handleCycleTopology}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.topologyChipLabel}>Arhitectură activă:</Text>
                        <Text style={[styles.topologyChipValue, { color: tpl.accent }]}>
                            {TOPOLOGIES[topology]?.label} ▾
                        </Text>
                        <Text style={styles.topologyChipHint}>(Atinge pt. a schimba)</Text>
                    </TouchableOpacity>

                    {/* ── 3. Schema CAD Interactivă cu Detalii la Suprafață ── */}
                    <View style={[styles.canvasCard, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                        {activeView === '3D_VIEW' ? (
                            <PerspectiveCarSvg
                                liveData={liveData}
                                selectedPinId={selectedComponent?.id}
                                onSelectPin={(pin) => {
                                    setSelectedComponent(pin);
                                    if (onSelectSubsystem) {
                                        onSelectSubsystem(pin.subsystem, { key: pin.subsystem, name: pin.name });
                                    }
                                }}
                            />
                        ) : (
                            <EngineBaySvg
                                topology={topology}
                                subCategory="AIR_BOOST"
                                activeSensors={engineBaySensors}
                                selectedSensorId={selectedComponent?.id}
                                onSelectSensor={(s) => {
                                    setSelectedComponent(s);
                                    if (onSelectSubsystem) {
                                        onSelectSubsystem(s.subsystem, { key: s.subsystem, name: s.name });
                                    }
                                }}
                            />
                        )}
                    </View>

                    {/* ── 4. Notă de Interacțiune pe Desen ── */}
                    <View style={styles.interactionHintRow}>
                        <Text style={styles.interactionHintText}>
                            👆 Atinge direct orice piesă de pe mașină pentru analiză și diagnoză detaliată.
                        </Text>
                    </View>

                    {/* ── 5. Card Detaliat de Inspecție & Plajă de Toleranță OEM ── */}
                    {selectedComponent ? (
                        <ComponentCard
                            component={selectedComponent}
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

    // Segmented Control (Curat & Fără Suprapunere)
    viewSegmentedWrap: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: 3,
        marginBottom: spacing[2],
    },
    viewSegmentBtn: {
        flex: 1,
        paddingVertical: 9,
        borderRadius: radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewSegmentText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
    },
    viewSegmentTextActive: {
        color: '#FFFFFF',
        fontWeight: typography.weights.bold,
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

    // Canvas Card
    canvasCard: {
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[2],
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    interactionHintRow: {
        marginTop: spacing[2],
        paddingHorizontal: spacing[2],
        alignItems: 'center',
    },
    interactionHintText: {
        fontSize: typography.sizes.micro,
        color: colors.text.tertiary,
        textAlign: 'center',
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
