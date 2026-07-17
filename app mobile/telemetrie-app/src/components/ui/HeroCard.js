/**
 * HeroCard — card de prim-plan pentru valori cheie ale vehiculului.
 *
 * Responsabilitate: afișează O valoare principală mare (scor, distanță,
 * consum) cu context vizual (status, icon, titlu). Folosit ca primul
 * element dintr-un ecran sau secțiune importantă.
 *
 * @prop {string|number} value       valoarea principală afișată (required)
 * @prop {string}   unit             unitatea valorii (ex: '%', 'km', 'L/100km')
 * @prop {string}   title            titlul cardului
 * @prop {string}   subtitle         subtitlu descriptiv
 * @prop {string}   description      text secundar sub valoare
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'}  status
 * @prop {string|ReactNode}  icon    icon afișat în colțul dreapta-sus
 * @prop {function} onPress
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const STATUS_BORDER = {
    optimal:  colors.status.optimal,
    good:     colors.status.good,
    monitor:  colors.status.monitor,
    caution:  colors.status.caution,
    critical: colors.status.critical,
    neutral:  colors.border.default,
};

const STATUS_TINT = {
    optimal:  colors.tint.optimal,
    good:     colors.tint.good,
    monitor:  colors.tint.monitor,
    caution:  colors.tint.caution,
    critical: colors.tint.critical,
    neutral:  'transparent',
};

const HeroCard = React.memo(({
    value,
    unit,
    title,
    subtitle,
    description,
    status = 'neutral',
    icon,
    onPress,
    loading = false,
    style,
}) => {
    const mountAnim = useRef(new Animated.Value(0)).current;
    const pressScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.timing(mountAnim, {
            toValue: 1,
            duration: motion.duration.normal,
            useNativeDriver: true,
        }).start();
    }, [mountAnim]);

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, {
            toValue: 0.98,
            duration: motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, {
            toValue: 1,
            duration: motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [onPress, pressScale]);

    const borderColor = STATUS_BORDER[status];
    const tintBg = STATUS_TINT[status];

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingRow}>
                    <Skeleton variant="text" height={typography.sizes.label1} width={80} />
                    <Skeleton variant="circle" height={32} width={32} />
                </View>
                <Skeleton variant="text" height={typography.sizes.hero} width={120} style={styles.loadingValue} />
                <Skeleton variant="text" height={typography.sizes.body2} width={160} style={styles.loadingDesc} />
            </View>
        );
    }

    const content = (
        <Animated.View
            style={[
                styles.card,
                { borderColor, backgroundColor: tintBg },
                { opacity: mountAnim, transform: [{ scale: pressScale }, { translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
                style,
            ]}
        >
            <View style={styles.topRow}>
                <View style={styles.titleGroup}>
                    {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
                    {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                {icon ? (
                    <View style={[styles.iconWrap, { borderColor, backgroundColor: tintBg }]}>
                        {typeof icon === 'string' ? (
                            <Text style={styles.iconText}>{icon}</Text>
                        ) : icon}
                    </View>
                ) : null}
            </View>

            <View style={styles.valueRow}>
                <Text style={[styles.value, { color: borderColor }, styles.tabular]}>{value ?? '--'}</Text>
                {unit ? <Text style={[styles.unit, { color: borderColor }]}>{unit}</Text> : null}
            </View>

            {description ? <Text style={styles.description}>{description}</Text> : null}
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
                {content}
            </TouchableOpacity>
        );
    }

    return content;
});

HeroCard.displayName = 'HeroCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding + spacing[2],
    },

    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[3],
    },
    titleGroup: { flex: 1, paddingRight: spacing[2] },
    title: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    subtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: spacing[1] - 2,
    },

    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconText: { fontSize: typography.sizes.title3 },

    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: spacing[1] + 2,
    },
    value: {
        fontSize: typography.sizes.hero,
        fontWeight: typography.weights.heavy,
        lineHeight: typography.lineHeights.hero,
    },
    unit: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.semibold,
        marginLeft: spacing[1] + 1,
        marginBottom: 2,
    },
    tabular: { fontVariant: ['tabular-nums'] },

    description: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
    },
    loadingValue: { marginBottom: spacing[2] },
    loadingDesc: {},
});

export default HeroCard;

HeroCard.propTypes = {
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    description: PropTypes.string,
    status: PropTypes.string,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    onPress: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
