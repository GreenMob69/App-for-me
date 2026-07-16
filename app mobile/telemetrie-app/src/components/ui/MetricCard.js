/**
 * MetricCard — card compact pentru o singură metrică cu trend.
 *
 * Responsabilitate: afișează date numerice cu context: eticheta,
 * valoarea, unitatea, trendul față de referință și status semantic.
 * Dimensiunile 'sm' și 'md' sunt optimizate pentru grid-uri.
 *
 * @prop {string|number} value      valoarea curentă (required)
 * @prop {string}   label           eticheta metricii (required)
 * @prop {string}   unit            unitatea (ex: 'km/h', 'L', '°C')
 * @prop {number}   trend           delta față de perioadă anterioară (opțional)
 * @prop {boolean}  trendInverse    când true, trend negativ = bun (ex: consum)
 * @prop {string}   trendLabel      context pentru trend (ex: 'față de ieri')
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'}  status
 * @prop {string|ReactNode}  icon
 * @prop {'sm'|'md'|'lg'}   size
 * @prop {function} onPress
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';

const STATUS_COLOR = {
    optimal:  colors.status.optimal,
    good:     colors.status.good,
    monitor:  colors.status.monitor,
    caution:  colors.status.caution,
    critical: colors.status.critical,
    neutral:  colors.text.secondary,
};

const MetricCard = React.memo(({
    value,
    label,
    unit,
    trend,
    trendInverse = false,
    trendLabel,
    status = 'neutral',
    icon,
    size = 'md',
    onPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;
    const valueColor = STATUS_COLOR[status] || colors.text.primary;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 0.97, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 1, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const getTrendColor = () => {
        if (trend === undefined || trend === null) return colors.text.tertiary;
        const isPositive = trendInverse ? trend < 0 : trend > 0;
        const isNegative = trendInverse ? trend > 0 : trend < 0;
        if (isPositive) return colors.status.good;
        if (isNegative) return colors.status.caution;
        return colors.text.tertiary;
    };

    const getTrendArrow = () => {
        if (trend === undefined || trend === null || trend === 0) return '—';
        return trend > 0 ? '↑' : '↓';
    };

    if (loading) {
        return (
            <View style={[styles.card, styles[`card_${size}`], style]}>
                <Skeleton variant="text" height={typography.sizes.caption} width={60} />
                <Skeleton variant="text" height={typography.sizes[SIZE_VALUE_FONT[size]]} width={80} style={styles.loadingGap} />
                <Skeleton variant="text" height={typography.sizes.caption} width={50} />
            </View>
        );
    }

    const trendColor = getTrendColor();

    const content = (
        <Animated.View style={[styles.card, styles[`card_${size}`], { transform: [{ scale: pressScale }] }, style]}>
            <View style={styles.topRow}>
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
                {icon ? (
                    typeof icon === 'string'
                        ? <Text style={[styles.icon, styles[`icon_${size}`]]}>{icon}</Text>
                        : icon
                ) : null}
            </View>

            <View style={styles.valueRow}>
                <Text style={[styles.value, styles[`value_${size}`], { color: valueColor }, styles.tabular]}>
                    {value ?? '--'}
                </Text>
                {unit ? (
                    <Text style={[styles.unit, styles[`unit_${size}`], { color: valueColor }]}>{unit}</Text>
                ) : null}
            </View>

            {trend !== undefined && trend !== null ? (
                <View style={styles.trendRow}>
                    <Text style={[styles.trendArrow, { color: trendColor }]}>{getTrendArrow()}</Text>
                    <Text style={[styles.trendValue, { color: trendColor }]}>
                        {Math.abs(trend).toFixed(1)}%
                    </Text>
                    {trendLabel ? (
                        <Text style={styles.trendLabel} numberOfLines={1}>{trendLabel}</Text>
                    ) : null}
                </View>
            ) : null}
        </Animated.View>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value} ${unit || ''}`}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return content;
});

MetricCard.displayName = 'MetricCard';

const SIZE_VALUE_FONT = { sm: 'body1', md: 'title2', lg: 'title1' };

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
    },

    card_sm: { padding: spacing[3] },
    card_md: { padding: layout.cardPadding },
    card_lg: { padding: layout.cardPadding + spacing[1] },

    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    label: {
        flex: 1,
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    icon: { includeFontPadding: false },
    icon_sm: { fontSize: typography.sizes.body2 },
    icon_md: { fontSize: typography.sizes.body1 },
    icon_lg: { fontSize: typography.sizes.title3 },

    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    value: {
        fontWeight: typography.weights.heavy,
    },
    value_sm: { fontSize: typography.sizes.body1, lineHeight: typography.lineHeights.body1 },
    value_md: { fontSize: typography.sizes.title2, lineHeight: typography.lineHeights.title2 },
    value_lg: { fontSize: typography.sizes.title1, lineHeight: typography.lineHeights.title1 },

    unit: {
        fontWeight: typography.weights.semibold,
        marginLeft: spacing[1] - 1,
        marginBottom: 1,
    },
    unit_sm: { fontSize: typography.sizes.caption },
    unit_md: { fontSize: typography.sizes.label1 },
    unit_lg: { fontSize: typography.sizes.body1 },

    tabular: { fontVariant: ['tabular-nums'] },

    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing[1] + 2,
        gap: spacing[1] - 1,
    },
    trendArrow: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
    },
    trendValue: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },
    trendLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        flexShrink: 1,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingGap: { marginVertical: spacing[2] },
});

export default MetricCard;
