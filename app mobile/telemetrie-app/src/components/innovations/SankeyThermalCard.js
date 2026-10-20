'use strict';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function SankeyThermalCard({
    variant = 'classic', // 'classic' | 'nothing' | 'audi'
    appLang = 'RO',
    sankeyData = null,
    telemetry = null,
}) {
    const isRu = appLang === 'RU';
    const isEn = appLang === 'EN';

    const isNothing = variant === 'nothing';
    const isAudi = variant === 'audi';

    const accentColor = isNothing ? '#FF3B00' : isAudi ? '#FF8800' : '#00E5FF';
    const cardBg = isNothing ? '#000000' : isAudi ? '#080302' : '#0B1320';
    const borderColor = isNothing ? '#222222' : isAudi ? '#2A0E08' : '#1E293B';

    const mechPct = sankeyData?.mechanicalPct || 38;
    const exhaustPct = sankeyData?.exhaustHeatPct || 35;
    const coolPct = sankeyData?.coolingFrictionPct || 27;

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: accentColor }]}>
                    🔥 {isRu ? 'ТЕПЛОВОЙ БАЛАНС САНКИ' : isEn ? 'SANKEY THERMAL BALANCE' : 'BILANȚ TERMIC SANKEY'}
                </Text>
                <Text style={styles.efficiencyBadge}>
                    η = {mechPct}%
                </Text>
            </View>

            {/* Segmented / continuous balance bar */}
            <View style={styles.barFrame}>
                <View style={[styles.seg, { flex: mechPct, backgroundColor: '#10B981' }]} />
                <View style={[styles.seg, { flex: exhaustPct, backgroundColor: '#F59E0B' }]} />
                <View style={[styles.seg, { flex: coolPct, backgroundColor: '#EF4444' }]} />
            </View>

            {/* Readout labels */}
            <View style={styles.labelsRow}>
                <View style={styles.labelCol}>
                    <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.labelText} numberOfLines={1}>
                        {isRu ? 'МЕХАНИКА' : isEn ? 'MECHANICAL' : 'MECANIC'} ({mechPct}%)
                    </Text>
                </View>
                <View style={styles.labelCol}>
                    <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.labelText} numberOfLines={1}>
                        {isRu ? 'ВЫХЛОП' : isEn ? 'EXHAUST' : 'EVACUARE'} ({exhaustPct}%)
                    </Text>
                </View>
                <View style={styles.labelCol}>
                    <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                    <Text style={styles.labelText} numberOfLines={1}>
                        {isRu ? 'ОХЛАЖДЕНИЕ' : isEn ? 'COOLING' : 'RĂCIRE'} ({coolPct}%)
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        marginVertical: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    efficiencyBadge: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#10B981',
    },
    barFrame: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        gap: 2,
        backgroundColor: '#1E293B',
        marginBottom: 6,
    },
    seg: {
        height: '100%',
        borderRadius: 2,
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    labelCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    labelText: {
        fontSize: 7.5,
        fontFamily: MONO,
        color: '#94A3B8',
    },
});
