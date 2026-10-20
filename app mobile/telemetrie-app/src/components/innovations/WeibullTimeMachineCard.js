'use strict';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { hapticTap } from '../../services/hapticFeedback';
import { safeNum } from '../../utils/safeMath';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function WeibullTimeMachineCard({
    variant = 'classic', // 'classic' | 'nothing' | 'audi'
    appLang = 'RO',
    baseMaintenanceItems = null,
    telemetry = null,
    onOpenGuide = null,
}) {
    const isRu = appLang === 'RU';
    const isEn = appLang === 'EN';

    const [deltaKm, setDeltaKm] = useState(0); // 0 | 10000 | 25000 | 50000

    const items = useMemo(() => {
        const raw = baseMaintenanceItems || [
            { id: 'oil', nameRo: 'Ulei & Filtru (Arrhenius)', nameEn: 'Oil & Filter (Arrhenius)', nameRu: 'Масло и фильтр (Arrhenius)', currentKm: 11600, totalKm: 15000, costEur: 95 },
            { id: 'turbo', nameRo: 'Miez Turbină CHRA', nameEn: 'Turbo Core CHRA', nameRu: 'Картридж турбины CHRA', currentKm: 18500, totalKm: 25000, costEur: 240 },
            { id: 'brakes', nameRo: 'Plăcuțe & Discuri Frână', nameEn: 'Brake Pads & Rotors', nameRu: 'Тормозные колодки и диски', currentKm: 21600, totalKm: 40000, costEur: 140 },
            { id: 'battery', nameRo: 'Baterie Plumb-Acid (CBM)', nameEn: 'Lead-Acid Battery (CBM)', nameRu: 'АКБ (Свинцово-кислотный)', currentKm: 48000, totalKm: 60000, costEur: 110 },
            { id: 'dpf', nameRo: 'Filtru Particule DPF', nameEn: 'DPF Soot & Ash Filter', nameRu: 'Сажевый фильтр DPF', currentKm: 46500, totalKm: 60000, costEur: 180 },
        ];

        return raw.map(it => {
            const simulatedCurrent = it.currentKm + deltaKm;
            const remaining = Math.max(0, it.totalKm - simulatedCurrent);
            const wearPct = Math.min(100, Math.round((simulatedCurrent / it.totalKm) * 100));
            const status = wearPct >= 100 ? 'CRIT' : wearPct >= 80 ? 'WARN' : 'OK';
            const name = isRu ? it.nameRu : isEn ? it.nameEn : it.nameRo;
            return {
                ...it,
                simulatedCurrent,
                remaining,
                wearPct,
                status,
                name,
            };
        }).sort((a, b) => a.remaining - b.remaining);
    }, [baseMaintenanceItems, deltaKm, isRu, isEn]);

    const totalBudgetEur = useMemo(() => {
        return items
            .filter(it => it.wearPct >= 85)
            .reduce((sum, it) => sum + (it.costEur || 100), 0);
    }, [items]);

    const failingFirst = items[0];

    // Stiluri per paradigmă
    const isNothing = variant === 'nothing';
    const isAudi = variant === 'audi';

    const accentColor = isNothing ? '#FF3B00' : isAudi ? '#FF8800' : '#00E5FF';
    const cardBg = isNothing ? '#000000' : isAudi ? '#080302' : '#0B1320';
    const borderColor = isNothing ? '#222222' : isAudi ? '#2A0E08' : '#1E293B';

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: accentColor }]}>
                        ⏳ {isRu ? 'МАШИНА ВРЕМЕНИ WEIBULL R(t)' : isEn ? 'WEIBULL TIME-MACHINE R(t)' : 'MAȘINA TIMPULUI WEIBULL R(t)'}
                    </Text>
                    <Text style={styles.sub}>
                        {isRu ? 'ПРОГНОЗ ИЗНОСА И ПРЕВЕНТИВНЫЙ БЮДЖЕТ' : isEn ? 'PREDICTIVE WEAR & PREVENTIVE BUDGET' : 'SIMULARE UZURĂ PREVENTIVĂ'}
                    </Text>
                </View>
                <View style={[styles.budgetBadge, { borderColor: accentColor }]}>
                    <Text style={[styles.budgetText, { color: accentColor }]}>
                        {totalBudgetEur > 0 ? `+${totalBudgetEur} €` : '0 €'}
                    </Text>
                </View>
            </View>

            {/* Selector Trepte Kilometraj: [ AZI | +10k | +25k | +50k ] */}
            <View style={styles.sliderPillsRow}>
                {[
                    { label: isRu ? 'СЕГОДНЯ' : isEn ? 'TODAY' : 'AZI', val: 0 },
                    { label: '+10.000 km', val: 10000 },
                    { label: '+25.000 km', val: 25000 },
                    { label: '+50.000 km', val: 50000 },
                ].map(step => {
                    const isSelected = deltaKm === step.val;
                    return (
                        <TouchableOpacity
                            key={step.val}
                            style={[
                                styles.stepPill,
                                isSelected && { backgroundColor: `${accentColor}26`, borderColor: accentColor }
                            ]}
                            onPress={() => {
                                hapticTap();
                                setDeltaKm(step.val);
                            }}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.stepPillText, isSelected && { color: accentColor, fontWeight: '900' }]} numberOfLines={1}>
                                {step.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Alertă Componentă cu risc iminent */}
            {failingFirst && (
                <View style={[styles.failingBanner, { borderColor: failingFirst.status === 'CRIT' ? '#EF4444' : '#F59E0B' }]}>
                    <Text style={styles.failingIcon}>{failingFirst.status === 'CRIT' ? '🚨' : '⚠️'}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.failingTitle} numberOfLines={1}>
                            {isRu ? 'Первая замена: ' : isEn ? 'Next Due: ' : 'Următoarea piesă: '}
                            {failingFirst.name}
                        </Text>
                        <Text style={styles.failingSub}>
                            {failingFirst.remaining === 0
                                ? (isRu ? 'СРОЧНО ТРЕБУЕТ ТО!' : isEn ? 'DUE NOW!' : 'EXPIRAT!')
                                : `${failingFirst.remaining} ${isRu ? 'км остатка' : isEn ? 'km remaining' : 'km rămași'}`}
                        </Text>
                    </View>
                    <Text style={[styles.wearTag, { color: failingFirst.status === 'CRIT' ? '#EF4444' : '#F59E0B' }]}>
                        {failingFirst.wearPct}%
                    </Text>
                </View>
            )}

            {/* Listă 3 piese esențiale cu bare de progres */}
            <View style={styles.itemsList}>
                {items.slice(0, 3).map(it => {
                    const barColor = it.status === 'CRIT' ? '#EF4444' : it.status === 'WARN' ? '#F59E0B' : '#10B981';
                    return (
                        <TouchableOpacity
                            key={it.id}
                            style={styles.itemRow}
                            onPress={() => onOpenGuide?.(it.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.itemMeta}>
                                <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                                <Text style={[styles.itemRemaining, { color: barColor }]}>
                                    {it.remaining} km
                                </Text>
                            </View>
                            <View style={styles.track}>
                                <View style={[styles.bar, { width: `${it.wearPct}%`, backgroundColor: barColor }]} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginVertical: 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sub: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#64748B',
        marginTop: 1,
    },
    budgetBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: '#0F172A',
    },
    budgetText: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '900',
    },
    sliderPillsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10,
    },
    stepPill: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#1E293B',
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepPillText: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#94A3B8',
    },
    failingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        marginBottom: 8,
    },
    failingIcon: {
        fontSize: 14,
    },
    failingTitle: {
        fontSize: 10,
        fontFamily: MONO,
        color: '#F1F5F9',
        fontWeight: '800',
    },
    failingSub: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#94A3B8',
        marginTop: 1,
    },
    wearTag: {
        fontSize: 12,
        fontFamily: MONO,
        fontWeight: '900',
    },
    itemsList: {
        gap: 6,
    },
    itemRow: {
        gap: 3,
    },
    itemMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 9,
        fontFamily: MONO,
        color: '#CBD5E1',
        flex: 1,
    },
    itemRemaining: {
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: '800',
    },
    track: {
        height: 4,
        backgroundColor: '#1E293B',
        borderRadius: 2,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 2,
    },
});
