/**
 * MaintenanceCard — card pentru task de mentenanță sau service.
 *
 * Responsabilitate: prezintă un item de mentenanță cu deadline dublu
 * (km + dată), statusul și costul estimat. Suportă stările upcoming,
 * overdue și done cu tratament vizual distinct.
 *
 * @prop {string}   title           denumirea lucrării (required)
 * @prop {string}   subtitle        subsistemul sau componentul vizat
 * @prop {number}   dueKm           km la care e programat (ex: 245000)
 * @prop {string}   dueDate         data limită formatată
 * @prop {number}   estimatedCost   costul estimat în moneda dată
 * @prop {string}   currency        simbolul monedei (default 'RON')
 * @prop {'upcoming'|'overdue'|'done'}  status
 * @prop {'low'|'normal'|'high'}  urgency
 * @prop {function} onPress
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const STATUS_STYLES = {
    upcoming: { border: colors.accent.border,    tint: colors.accent.muted,    text: colors.accent.default, label: 'Programat' },
    overdue:  { border: colors.status.critical,  tint: colors.tint.critical,   text: colors.status.critical, label: 'Depășit' },
    done:     { border: colors.border.default,   tint: 'transparent',          text: colors.status.good,    label: 'Efectuat' },
};

const URGENCY_COLOR = {
    low:    colors.text.tertiary,
    normal: colors.status.monitor,
    high:   colors.status.critical,
};

const MaintenanceCard = React.memo(({
    title,
    subtitle,
    dueKm,
    dueDate,
    estimatedCost,
    currency = 'RON',
    status = 'upcoming',
    urgency = 'normal',
    onPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;
    const sStyle = STATUS_STYLES[status] || STATUS_STYLES.upcoming;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 0.98, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 1, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <Skeleton variant="text" height={typography.sizes.body2} width="70%" />
                <View style={styles.loadingMeta}>
                    <Skeleton variant="text" height={typography.sizes.caption} width={80} />
                    <Skeleton variant="text" height={typography.sizes.caption} width={80} />
                    <Skeleton variant="text" height={typography.sizes.caption} width={60} />
                </View>
            </View>
        );
    }

    const inner = (
        <Animated.View
            style={[
                styles.card,
                { borderColor: sStyle.border, backgroundColor: sStyle.tint },
                status === 'done' && styles.cardDone,
                { transform: [{ scale: pressScale }] },
                style,
            ]}
        >
            <View style={styles.topRow}>
                <View style={styles.titleGroup}>
                    <Text style={[styles.title, status === 'done' && styles.titleDone]} numberOfLines={2}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                    ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sStyle.tint, borderColor: sStyle.border }]}>
                    <Text style={[styles.statusLabel, { color: sStyle.text }]}>{sStyle.label}</Text>
                </View>
            </View>

            <View style={styles.metaRow}>
                {dueKm ? (
                    <View style={styles.metaItem}>
                        <Text style={styles.metaIcon}>🗺</Text>
                        <Text style={[styles.metaText, styles.tabular]}>{dueKm.toLocaleString()} km</Text>
                    </View>
                ) : null}
                {dueDate ? (
                    <View style={styles.metaItem}>
                        <Text style={styles.metaIcon}>📅</Text>
                        <Text style={styles.metaText}>{dueDate}</Text>
                    </View>
                ) : null}
                {urgency !== 'low' ? (
                    <View style={styles.metaItem}>
                        <View style={[styles.urgencyDot, { backgroundColor: URGENCY_COLOR[urgency] }]} />
                        <Text style={[styles.metaText, { color: URGENCY_COLOR[urgency] }]}>
                            {urgency === 'high' ? 'Urgent' : 'Atenție'}
                        </Text>
                    </View>
                ) : null}
            </View>

            {estimatedCost !== undefined && estimatedCost !== null ? (
                <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Cost estimat</Text>
                    <Text style={[styles.costValue, styles.tabular]}>
                        {estimatedCost.toLocaleString()} {currency}
                    </Text>
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
                accessibilityLabel={title}
            >
                {inner}
            </TouchableOpacity>
        );
    }

    return inner;
});

MaintenanceCard.displayName = 'MaintenanceCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
    },
    cardDone: { opacity: 0.7 },

    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    titleGroup: { flex: 1 },
    title: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
    },
    titleDone: {
        textDecorationLine: 'line-through',
        color: colors.text.tertiary,
    },
    subtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: spacing[1] - 2,
    },

    statusBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
        borderWidth: 1,
        flexShrink: 0,
    },
    statusLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3],
        marginBottom: spacing[2],
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1],
    },
    metaIcon: { fontSize: typography.sizes.caption },
    metaText: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },
    urgencyDot: {
        width: 6,
        height: 6,
        borderRadius: radii.full,
    },
    tabular: { fontVariant: ['tabular-nums'] },

    costRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
        marginTop: spacing[1],
    },
    costLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },
    costValue: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingMeta: {
        flexDirection: 'row',
        gap: spacing[3],
        marginTop: spacing[3],
    },
});

export default MaintenanceCard;

MaintenanceCard.propTypes = {
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    dueKm: PropTypes.number,
    dueDate: PropTypes.string,
    estimatedCost: PropTypes.number,
    currency: PropTypes.string,
    status: PropTypes.string,
    urgency: PropTypes.string,
    onPress: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
