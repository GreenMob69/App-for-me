/**
 * StatusBadge — indicator semantic de stare cu puls animat opțional.
 *
 * Responsabilitate: comunicare vizuală concisă a unui status
 * (Optim, Atenție, Critic etc.) prin culoare, formă și opțional animație.
 *
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'}  status
 * @prop {string}   label      textul afișat în badge
 * @prop {'filled'|'outlined'|'dot'}  variant
 * @prop {'sm'|'md'|'lg'}  size
 * @prop {boolean}  pulse      animație de puls (recomandat pentru 'critical')
 * @prop {object}   style      override pentru container
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, motion } from '../../theme';
import PropTypes from 'prop-types';

const STATUS_COLOR = {
    optimal: colors.status.optimal,
    good:    colors.status.good,
    monitor: colors.status.monitor,
    caution: colors.status.caution,
    critical: colors.status.critical,
    neutral:  colors.status.neutral,
};

const STATUS_TINT = {
    optimal: colors.tint.optimal,
    good:    colors.tint.good,
    monitor: colors.tint.monitor,
    caution: colors.tint.caution,
    critical: colors.tint.critical,
    accent:  colors.tint.accent,
    neutral: 'transparent',
};

const DOT_SIZE = { sm: 6, md: 8, lg: 10 };

const StatusBadge = React.memo(({
    status = 'neutral',
    label,
    variant = 'filled',
    size = 'md',
    pulse = false,
    style,
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const color = STATUS_COLOR[status] || colors.status.neutral;
    const tint  = STATUS_TINT[status] || 'transparent';

    useEffect(() => {
        if (!pulse) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: motion.duration.slow,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: motion.duration.slow,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse, pulseAnim]);

    if (variant === 'dot') {
        const dotSize = DOT_SIZE[size];
        return (
            <Animated.View
                style={[
                    styles.dot,
                    {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: color,
                    },
                    pulse && { opacity: pulseAnim },
                    style,
                ]}
                accessibilityLabel={label || status}
            />
        );
    }

    return (
        <Animated.View
            style={[
                styles.base,
                styles[`size_${size}`],
                variant === 'filled' && { backgroundColor: tint, borderColor: color },
                variant === 'outlined' && { backgroundColor: 'transparent', borderColor: color },
                pulse && { opacity: pulseAnim },
                style,
            ]}
            accessibilityLabel={label || status}
        >
            <View style={[styles.dot, styles[`dot_${size}`], { backgroundColor: color }]} />
            {label ? (
                <Text style={[styles.label, styles[`label_${size}`], { color }]}>
                    {label}
                </Text>
            ) : null}
        </Animated.View>
    );
});

StatusBadge.displayName = 'StatusBadge';

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: radii.full,
        alignSelf: 'flex-start',
    },

    // ── Dimensiuni container ───────────────────────────────────────────────
    size_sm: { paddingHorizontal: spacing[1] + 2, paddingVertical: 2, gap: spacing[1] - 1 },
    size_md: { paddingHorizontal: spacing[2],     paddingVertical: 3, gap: spacing[1] },
    size_lg: { paddingHorizontal: spacing[2] + 2, paddingVertical: 4, gap: spacing[1] + 1 },

    // ── Dot indicator inline ───────────────────────────────────────────────
    dot: { borderRadius: radii.full },
    dot_sm: { width: 5, height: 5 },
    dot_md: { width: 6, height: 6 },
    dot_lg: { width: 7, height: 7 },

    // ── Label ──────────────────────────────────────────────────────────────
    label: {
        fontWeight: typography.weights.semibold,
    },
    label_sm: { fontSize: typography.sizes.micro },
    label_md: { fontSize: typography.sizes.caption },
    label_lg: { fontSize: typography.sizes.label2 },
});

StatusBadge.propTypes = {
    status: PropTypes.string,
    label: PropTypes.string,
    variant: PropTypes.string,
    size: PropTypes.string,
    pulse: PropTypes.bool,
    style: PropTypes.object,
};

export default StatusBadge;
