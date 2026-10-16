'use strict';

/**
 * ExplodedModuleCard.js — Card Modular Explodat cu Ilustrație CAD Mare și Plajă de Toleranță (Varianta 3)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, radii, spacing } from '../../theme';
import ExplodedComponentSvg from './ExplodedComponentSvg';

const ExplodedModuleCard = ({
    component,
    liveData = {},
    theme = {},
    onAskAI,
}) => {
    if (!component) return null;

    const reading = component.getReading ? component.getReading(liveData) : { val: 'Nominal', status: 'optimal' };

    // Calculează poziția acului pe plaja de toleranță OEM
    let needlePct = '55%';
    if (component.nominalMin != null && component.nominalMax != null && reading.rawNum != null) {
        const range = component.nominalMax - component.nominalMin;
        if (range > 0) {
            const raw = Math.max(component.nominalMin, Math.min(component.nominalMax, reading.rawNum));
            const pct = Math.round(((raw - component.nominalMin) / range) * 100);
            needlePct = `${pct}%`;
        }
    }

    return (
        <View style={[styles.card, { backgroundColor: theme.cardBg || colors.bg[1], borderColor: theme.border || colors.border.default }]}>
            {/* Header: Nume piesă & Cod OEM */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{component.name}</Text>
                    <Text style={[styles.code, { color: theme.accent || colors.accent.default }]}>
                        {component.code}
                    </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981' }]}>
                    <Text style={styles.statusBadgeText}>OPTIM</Text>
                </View>
            </View>

            {/* Ilustrație Explodată CAD Mare (Varianta 3) */}
            <View style={styles.illustrationWrap}>
                <ExplodedComponentSvg
                    componentId={component.id}
                    height={165}
                    accentColor={theme.accent || colors.accent.default}
                />
            </View>

            {/* Plajă de Toleranță Grafică OEM */}
            <View style={styles.toleranceBox}>
                <View style={styles.toleranceHeader}>
                    <Text style={styles.toleranceLabel}>PLAJĂ DE TOLERANȚĂ OEM:</Text>
                    <Text style={styles.toleranceState}>● ÎN PARAMETRI NOMINALI</Text>
                </View>
                <View style={styles.barTrack}>
                    <View style={styles.zoneLow} />
                    <View style={styles.zoneOptimal} />
                    <View style={styles.zoneHigh} />
                    <View style={[styles.needle, { left: needlePct }]} />
                </View>
                <View style={styles.legendRow}>
                    <Text style={styles.legendText}>MIN</Text>
                    <Text style={[styles.legendText, { color: '#10b981', fontWeight: 'bold' }]}>NOMINAL</Text>
                    <Text style={styles.legendText}>MAX</Text>
                </View>
            </View>

            {/* Valoare Live vs Nominală */}
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📊 Valoare Live / Interval Nominal:</Text>
                <Text style={[styles.liveVal, { color: colors.text.primary }]}>
                    {reading.val}{' '}
                    <Text style={styles.nominalVal}>({component.nominal})</Text>
                </Text>
            </View>

            {/* Localizare fizică */}
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 Localizare fizică pe vehicul:</Text>
                <Text style={styles.infoVal}>{component.location}</Text>
            </View>

            {/* Diagnoză tehnică de semnal */}
            <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🔬 Diagnoză & Integritate Semnal:</Text>
                <Text style={styles.diagText}>{component.diag}</Text>
            </View>

            {/* Buton: Întreabă Inginerul AI */}
            <TouchableOpacity
                style={[styles.aiBtn, { backgroundColor: theme.accent || colors.accent.default }]}
                onPress={() => onAskAI && onAskAI(component)}
                activeOpacity={0.8}
            >
                <Text style={styles.aiBtnText}>✨ Întreabă Inginerul AI despre această piesă</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        marginTop: spacing[3],
        borderRadius: radii.lg,
        borderWidth: 1,
        padding: spacing[4],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        paddingBottom: spacing[2],
    },
    title: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    code: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
    },
    statusBadgeText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    illustrationWrap: {
        width: '100%',
        backgroundColor: 'rgba(8, 14, 24, 0.75)',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.2)',
        paddingVertical: spacing[2],
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing[2],
    },
    toleranceBox: {
        backgroundColor: 'rgba(10, 16, 28, 0.65)',
        borderRadius: radii.md,
        padding: spacing[3],
        marginBottom: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    toleranceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
    },
    toleranceLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.6,
    },
    toleranceState: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: '#10b981',
    },
    barTrack: {
        height: 6,
        borderRadius: 3,
        flexDirection: 'row',
        position: 'relative',
        overflow: 'visible',
        marginVertical: 4,
    },
    zoneLow: {
        flex: 1,
        backgroundColor: '#3b82f6',
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
    },
    zoneOptimal: {
        flex: 2,
        backgroundColor: '#10b981',
    },
    zoneHigh: {
        flex: 1,
        backgroundColor: '#ef4444',
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    needle: {
        position: 'absolute',
        top: -4,
        width: 4,
        height: 14,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        elevation: 4,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 3,
    },
    legendText: {
        fontSize: 8,
        color: colors.text.tertiary,
        fontWeight: typography.weights.semibold,
    },
    infoRow: {
        marginBottom: spacing[2] + 2,
    },
    infoLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        marginBottom: 2,
    },
    infoVal: {
        fontSize: typography.sizes.caption,
        color: colors.text.primary,
        lineHeight: 18,
    },
    liveVal: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    nominalVal: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.regular,
    },
    diagText: {
        fontSize: typography.sizes.caption,
        color: colors.status.good,
        lineHeight: 18,
    },
    aiBtn: {
        marginTop: spacing[3],
        paddingVertical: 10,
        paddingHorizontal: spacing[3],
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },
});

export default React.memo(ExplodedModuleCard);
