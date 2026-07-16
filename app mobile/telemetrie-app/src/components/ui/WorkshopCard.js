/**
 * WorkshopCard — card pentru un service auto sau atelier.
 *
 * Responsabilitate: prezintă informațiile unui service (nume, adresă,
 * rating, distanță, telefon) cu acțiuni rapide. Folosit în ecranul
 * de service centers și recomandări de workshop.
 *
 * @prop {string}   name            numele service-ului (required)
 * @prop {string}   address         adresa completă
 * @prop {number}   rating          scor 0-5 (ex: 4.3)
 * @prop {number}   reviewCount     numărul de recenzii
 * @prop {string}   distance        distanța formatată (ex: '3.2 km')
 * @prop {string}   phone           numărul de telefon
 * @prop {boolean}  certified       badge service autorizat
 * @prop {function} onPress         deschide detalii
 * @prop {function} onCallPress     apel rapid
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';

const WorkshopCard = React.memo(({
    name,
    address,
    rating,
    reviewCount,
    distance,
    phone,
    certified = false,
    onPress,
    onCallPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 0.98, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 1, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const renderStars = (r) => {
        const full = Math.floor(r);
        const half = r - full >= 0.5;
        return Array.from({ length: 5 }, (_, i) => {
            if (i < full) return '★';
            if (i === full && half) return '½';
            return '☆';
        }).join('');
    };

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingHeader}>
                    <Skeleton variant="text" height={typography.sizes.body1} width="65%" />
                    <Skeleton variant="rect" height={20} width={40} style={styles.loadingBadge} />
                </View>
                <Skeleton variant="text" height={typography.sizes.caption} width="80%" style={styles.loadingGap} />
                <View style={styles.loadingMeta}>
                    <Skeleton variant="text" height={typography.sizes.label2} width={70} />
                    <Skeleton variant="text" height={typography.sizes.label2} width={50} />
                </View>
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : 'none'}
            accessibilityLabel={`${name}${address ? ', ' + address : ''}`}
        >
            <Animated.View style={[styles.card, { transform: [{ scale: pressScale }] }, style]}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <View style={styles.badges}>
                        {certified && (
                            <View style={styles.certBadge}>
                                <Text style={styles.certText}>✓ Autorizat</Text>
                            </View>
                        )}
                        {distance ? (
                            <View style={styles.distanceBadge}>
                                <Text style={styles.distanceText}>{distance}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {address ? (
                    <Text style={styles.address} numberOfLines={2}>{address}</Text>
                ) : null}

                <View style={styles.bottomRow}>
                    {rating !== undefined && rating !== null ? (
                        <View style={styles.ratingGroup}>
                            <Text style={styles.stars}>{renderStars(rating)}</Text>
                            <Text style={[styles.ratingValue, styles.tabular]}>{rating.toFixed(1)}</Text>
                            {reviewCount ? (
                                <Text style={styles.reviewCount}>({reviewCount})</Text>
                            ) : null}
                        </View>
                    ) : <View style={styles.ratingGroup} />}

                    {(onCallPress || phone) ? (
                        <TouchableOpacity
                            style={styles.callBtn}
                            onPress={onCallPress}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Sună ${name}`}
                        >
                            <Text style={styles.callIcon}>📞</Text>
                            {phone ? <Text style={styles.callLabel}>{phone}</Text> : null}
                        </TouchableOpacity>
                    ) : null}
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
});

WorkshopCard.displayName = 'WorkshopCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
    },

    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    name: {
        flex: 1,
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    badges: {
        flexDirection: 'row',
        gap: spacing[1] + 1,
        flexShrink: 0,
    },
    certBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: colors.tint.good,
        borderWidth: 1,
        borderColor: colors.status.good,
    },
    certText: {
        fontSize: typography.sizes.micro,
        color: colors.status.good,
        fontWeight: typography.weights.bold,
    },
    distanceBadge: {
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
        backgroundColor: colors.bg[3],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    distanceText: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },

    address: {
        fontSize: typography.sizes.body2 - 1,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
        marginBottom: spacing[3],
    },

    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ratingGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1] + 1,
    },
    stars: {
        fontSize: typography.sizes.label2,
        color: colors.status.monitor,
        letterSpacing: 1,
    },
    ratingValue: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    reviewCount: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },
    tabular: { fontVariant: ['tabular-nums'] },

    callBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1] + 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.bg[2],
    },
    callIcon: { fontSize: typography.sizes.body2 },
    callLabel: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[2] },
    loadingBadge:  { borderRadius: radii.full },
    loadingGap:    { marginBottom: spacing[3] },
    loadingMeta:   { flexDirection: 'row', gap: spacing[4] },
});

export default WorkshopCard;
