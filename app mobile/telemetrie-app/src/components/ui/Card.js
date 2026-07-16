/**
 * Card — container de bază reutilizabil.
 *
 * Responsabilitate: oferă suprafața vizuală standard pentru orice secțiune
 * a interfeței. Poate fi static sau touchable. Suportă status semantic
 * (tinted border + background) și animație de press.
 *
 * @prop {'default'|'outlined'|'filled'|'elevated'}  variant    aparența suprafeței
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'} status  colorează border + bg semantic
 * @prop {'none'|'sm'|'md'|'lg'}  padding   padding intern
 * @prop {function}  onPress       dacă e furnizat, card devine TouchableOpacity
 * @prop {boolean}   disabled      dezactivează interacțiunea și reduce opacitatea
 * @prop {object}    style         override suplimentar pentru container
 * @prop {string}    testID
 * @prop {string}    accessibilityLabel
 */

import React, { useRef, useCallback } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, radii, spacing, motion } from '../../theme';

const Card = React.memo(({
    variant = 'default',
    status = null,
    padding = 'md',
    onPress,
    disabled = false,
    style,
    children,
    testID,
    accessibilityLabel,
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.timing(scale, {
            toValue: 0.98,
            duration: motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [scale]);

    const handlePressOut = useCallback(() => {
        Animated.timing(scale, {
            toValue: 1,
            duration: motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [scale]);

    const cardStyle = [
        styles.base,
        styles[`variant_${variant}`],
        status && styles[`status_${status}`],
        styles[`pad_${padding}`],
        disabled && styles.disabled,
        style,
    ];

    if (onPress) {
        return (
            <Animated.View style={{ transform: [{ scale }] }}>
                <TouchableOpacity
                    style={cardStyle}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled}
                    activeOpacity={1}
                    testID={testID}
                    accessibilityLabel={accessibilityLabel}
                    accessibilityRole="button"
                >
                    {children}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return (
        <View style={cardStyle} testID={testID} accessibilityLabel={accessibilityLabel}>
            {children}
        </View>
    );
});

Card.displayName = 'Card';

const styles = StyleSheet.create({
    base: {
        borderRadius: radii.md,
        borderWidth: 1,
        overflow: 'hidden',
    },

    // ── Variante suprafață ──────────────────────────────────────────────────
    variant_default: {
        backgroundColor: colors.bg[1],
        borderColor: colors.border.default,
    },
    variant_outlined: {
        backgroundColor: colors.bg[0],
        borderColor: colors.border.default,
    },
    variant_filled: {
        backgroundColor: colors.bg[2],
        borderWidth: 0,
    },
    variant_elevated: {
        backgroundColor: colors.bg[1],
        borderColor: colors.border.strong,
    },

    // ── Status semantic (override border + background) ──────────────────────
    status_optimal:  { borderWidth: 1, borderColor: colors.status.optimal,  backgroundColor: colors.tint.optimal },
    status_good:     { borderWidth: 1, borderColor: colors.status.good,     backgroundColor: colors.tint.good },
    status_monitor:  { borderWidth: 1, borderColor: colors.status.monitor,  backgroundColor: colors.tint.monitor },
    status_caution:  { borderWidth: 1, borderColor: colors.status.caution,  backgroundColor: colors.tint.caution },
    status_critical: { borderWidth: 1, borderColor: colors.status.critical, backgroundColor: colors.tint.critical },
    status_neutral:  { borderWidth: 1, borderColor: colors.border.default,  backgroundColor: colors.bg[1] },

    // ── Padding ────────────────────────────────────────────────────────────
    pad_none: { padding: spacing[0] },
    pad_sm:   { padding: spacing[3] },
    pad_md:   { padding: spacing[4] },
    pad_lg:   { padding: spacing[6] },

    // ── State ──────────────────────────────────────────────────────────────
    disabled: { opacity: 0.45 },
});

export default Card;
