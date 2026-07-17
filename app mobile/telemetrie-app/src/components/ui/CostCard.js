/**
 * CostCard — card pentru afișarea costurilor cu detaliere opțională.
 *
 * Responsabilitate: prezintă un cost principal cu trend față de
 * perioadă anterioară și un breakdown detaliat pe categorii.
 * Optimizat pentru date de cost lunar/anual.
 *
 * @prop {string}   title           titlul costului (required)
 * @prop {number}   amount          suma principală (required)
 * @prop {string}   currency        moneda (default 'RON')
 * @prop {string}   period          perioada (ex: 'Ianuarie 2025', 'Ultimele 30 zile')
 * @prop {number}   trend           variația procentuală față de perioada anterioară
 * @prop {boolean}  trendInverse    true → trend pozitiv este rău (costuri mai mari)
 * @prop {Array<{label: string, amount: number, icon?: string}>}  breakdown
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';
import Divider from './Divider';
import PropTypes from 'prop-types';

const CostCard = React.memo(({
    title,
    amount,
    currency = 'RON',
    period,
    trend,
    trendInverse = true,
    breakdown,
    loading = false,
    style,
}) => {
    const [expanded, setExpanded] = useState(false);
    const mountOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(mountOpacity, {
            toValue:         1,
            duration:        motion.duration.normal,
            delay:           80,
            useNativeDriver: true,
        }).start();
    }, []);

    const handleToggle = useCallback(() => {
        if (breakdown && breakdown.length > 0) setExpanded(prev => !prev);
    }, [breakdown]);

    const getTrendColor = () => {
        if (trend === undefined || trend === null) return colors.text.tertiary;
        const isBad = trendInverse ? trend > 0 : trend < 0;
        if (isBad) return colors.status.caution;
        if (trend === 0) return colors.text.tertiary;
        return colors.status.good;
    };

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <Skeleton variant="text" height={typography.sizes.label1} width={120} />
                <Skeleton variant="text" height={typography.sizes.hero} width={160} style={styles.loadingGap} />
                <Skeleton variant="text" height={typography.sizes.caption} width={80} />
            </View>
        );
    }

    const trendColor = getTrendColor();
    const trendArrow = trend === undefined || trend === null || trend === 0 ? '—'
        : trend > 0 ? '↑' : '↓';
    const hasBreakdown = breakdown && breakdown.length > 0;

    return (
        <Animated.View style={[styles.card, { opacity: mountOpacity }, style]}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                {period ? <Text style={styles.period}>{period}</Text> : null}
            </View>

            <View style={styles.amountRow}>
                <Text
                    style={[styles.amount, styles.tabular]}
                    accessibilityLabel={`${amount.toLocaleString()} ${currency}`}
                >
                    {amount.toLocaleString()}
                </Text>
                <Text style={styles.currency}>{currency}</Text>
            </View>

            {trend !== undefined && trend !== null ? (
                <View style={styles.trendRow}>
                    <Text style={[styles.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
                    <Text style={[styles.trendPct, { color: trendColor }]}>
                        {Math.abs(trend).toFixed(1)}%
                    </Text>
                    <Text style={styles.trendContext}>față de perioada anterioară</Text>
                </View>
            ) : null}

            {hasBreakdown ? (
                <>
                    <Divider strength="subtle" spacing={spacing[3]} />
                    <TouchableOpacity
                        style={styles.breakdownToggle}
                        onPress={handleToggle}
                        accessibilityRole="button"
                        accessibilityLabel={expanded ? 'Ascunde detalii costuri' : 'Arată detalii costuri'}
                        accessibilityState={{ expanded }}
                    >
                        <Text style={styles.breakdownToggleLabel}>
                            {expanded ? 'Ascunde detalii' : 'Detalii pe categorii'}
                        </Text>
                        <Text style={styles.breakdownToggleArrow} accessibilityElementsHidden>
                            {expanded ? '▲' : '▼'}
                        </Text>
                    </TouchableOpacity>

                    {expanded ? (
                        <View style={styles.breakdownList}>
                            {breakdown.map((item, idx) => (
                                <View key={idx} style={styles.breakdownRow}>
                                    <View style={styles.breakdownLeft}>
                                        {item.icon ? (
                                            <Text style={styles.breakdownIcon} accessibilityElementsHidden>
                                                {item.icon}
                                            </Text>
                                        ) : null}
                                        <Text style={styles.breakdownLabel}>{item.label}</Text>
                                    </View>
                                    <Text style={[styles.breakdownAmount, styles.tabular]}>
                                        {item.amount.toLocaleString()} {currency}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </>
            ) : null}
        </Animated.View>
    );
});

CostCard.displayName = 'CostCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    title: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    period: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },

    amountRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing[1] + 1,
    },
    amount: {
        fontSize: typography.sizes.hero,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.hero,
    },
    currency: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    tabular: { fontVariant: ['tabular-nums'] },

    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1],
        marginTop: spacing[2],
    },
    trendArrow: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    trendPct: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
    trendContext: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },

    // ── Breakdown ─────────────────────────────────────────────────────────
    breakdownToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[1],
        minHeight: 36,
    },
    breakdownToggleLabel: {
        fontSize: typography.sizes.label2,
        color: colors.accent.default,
        fontWeight: typography.weights.medium,
    },
    breakdownToggleArrow: {
        fontSize: typography.sizes.micro,
        color: colors.accent.default,
    },

    breakdownList: { marginTop: spacing[2] },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing[1] + 2,
    },
    breakdownLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    breakdownIcon: { fontSize: typography.sizes.body2 },
    breakdownLabel: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
    },
    breakdownAmount: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.medium,
        color: colors.text.primary,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingGap: { marginVertical: spacing[2] },
});

export default CostCard;

CostCard.propTypes = {
    title: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    currency: PropTypes.string,
    period: PropTypes.string,
    trend: PropTypes.number,
    trendInverse: PropTypes.bool,
    breakdown: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, amount: PropTypes.number, icon: PropTypes.string })),
    loading: PropTypes.bool,
    style: PropTypes.object,
};
