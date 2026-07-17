/**
 * RecommendationCard — card pentru recomandare acționabilă.
 *
 * Responsabilitate: prezintă o recomandare cu prioritate, descriere
 * și un buton de acțiune. Suportă dismiss. Animație de fade-in la mount.
 *
 * @prop {string}   title           titlul recomandării (required)
 * @prop {string}   description     descriere detaliată
 * @prop {'low'|'medium'|'high'|'critical'}  priority  (default: 'medium')
 * @prop {string|ReactNode}  icon   icon reprezentativ
 * @prop {{ label: string, onPress: function }}  action  buton CTA
 * @prop {function} onDismiss       callback la apăsare X; dacă lipsește, nu apare X
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const PRIORITY_STYLES = {
    low: {
        border:  colors.border.default,
        tint:    'transparent',
        badge:   colors.text.tertiary,
        badgeBg: 'transparent',
        label:   'Info',
    },
    medium: {
        border:  colors.accent.border,
        tint:    colors.accent.muted,
        badge:   colors.accent.default,
        badgeBg: colors.accent.muted,
        label:   'Recomandat',
    },
    high: {
        border:  colors.status.monitor,
        tint:    colors.tint.monitor,
        badge:   colors.status.monitor,
        badgeBg: colors.tint.monitor,
        label:   'Important',
    },
    critical: {
        border:  colors.status.critical,
        tint:    colors.tint.critical,
        badge:   colors.status.critical,
        badgeBg: colors.tint.critical,
        label:   'Urgent',
    },
};

const RecommendationCard = React.memo(({
    title,
    description,
    priority = 'medium',
    icon,
    action,
    onDismiss,
    loading = false,
    style,
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: motion.duration.normal,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    const handleDismissPress = useCallback(() => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: motion.duration.fast,
            useNativeDriver: true,
        }).start(() => onDismiss?.());
    }, [fadeAnim, onDismiss]);

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingRow}>
                    <Skeleton variant="circle" height={36} width={36} />
                    <View style={styles.loadingText}>
                        <Skeleton variant="text" height={typography.sizes.body2} width="70%" />
                        <Skeleton variant="text" height={typography.sizes.caption} width="90%" style={styles.loadingGap} />
                        <Skeleton variant="text" height={typography.sizes.caption} width="60%" />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <Animated.View
            style={[
                styles.card,
                { borderColor: pStyle.border, backgroundColor: pStyle.tint },
                { opacity: fadeAnim },
                style,
            ]}
        >
            <View style={styles.header}>
                {icon ? (
                    <View style={[styles.iconWrap, { borderColor: pStyle.border, backgroundColor: pStyle.badgeBg }]}>
                        {typeof icon === 'string'
                            ? <Text style={styles.iconText}>{icon}</Text>
                            : icon}
                    </View>
                ) : null}

                <View style={styles.headerText}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={2}>{title}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: pStyle.badgeBg }]}>
                            <Text style={[styles.priorityLabel, { color: pStyle.badge }]}>
                                {pStyle.label}
                            </Text>
                        </View>
                    </View>
                    {description ? (
                        <Text style={styles.description}>{description}</Text>
                    ) : null}
                </View>

                {onDismiss ? (
                    <TouchableOpacity
                        style={styles.dismissBtn}
                        onPress={handleDismissPress}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Închide recomandarea"
                        accessibilityRole="button"
                    >
                        <Text style={styles.dismissIcon}>✕</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {action ? (
                <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: pStyle.border }]}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                >
                    <Text style={[styles.actionLabel, { color: pStyle.badge }]}>{action.label}</Text>
                </TouchableOpacity>
            ) : null}
        </Animated.View>
    );
});

RecommendationCard.displayName = 'RecommendationCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
        overflow: 'hidden',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing[3],
        flexShrink: 0,
    },
    iconText: { fontSize: typography.sizes.body1 },

    headerText: { flex: 1 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing[2],
        marginBottom: spacing[1] + 2,
    },
    title: {
        flex: 1,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    priorityBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
        flexShrink: 0,
    },
    priorityLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    description: {
        fontSize: typography.sizes.body2 - 1,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
    },

    dismissBtn: {
        marginLeft: spacing[2],
        padding: spacing[1],
    },
    dismissIcon: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },

    actionBtn: {
        marginTop: spacing[3],
        paddingVertical: spacing[2],
        borderTopWidth: 1,
        alignItems: 'center',
    },
    actionLabel: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingRow: { flexDirection: 'row', gap: spacing[3] },
    loadingText: { flex: 1 },
    loadingGap: { marginVertical: spacing[1] },
});

export default RecommendationCard;

RecommendationCard.propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    priority: PropTypes.string,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    action: PropTypes.shape({ label: PropTypes.string, onPress: PropTypes.func }),
    onDismiss: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
