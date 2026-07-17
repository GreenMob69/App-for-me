/**
 * IconButton — buton circular sau pătrat cu icon și opțional badge.
 *
 * Responsabilitate: acțiuni secundare compacte (close, edit, filter,
 * notificări). Diferă de Button prin formă fixă și absența unui label text.
 *
 * @prop {string|ReactNode}  icon     conținutul butonului (required)
 * @prop {function}  onPress          callback la apăsare (required)
 * @prop {'default'|'outlined'|'ghost'|'danger'}  variant
 * @prop {'xs'|'sm'|'md'|'lg'}  size
 * @prop {number|boolean}  badge  afișează badge; number → cifra, true → dot
 * @prop {boolean}   disabled
 * @prop {string}    shape    'circle'|'square' (implicit 'circle')
 * @prop {object}    style    override pentru container
 * @prop {string}    accessibilityLabel  (required pentru accesibilitate)
 * @prop {string}    testID
 */

import React, { useRef, useCallback } from 'react';
import { Text, TouchableOpacity, Animated, View, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, motion } from '../../theme';
import PropTypes from 'prop-types';

const SIZE_DIMENSIONS = {
    xs: 28,
    sm: 32,
    md: 40,
    lg: 48,
};

const ICON_FONT_SIZE = {
    xs: typography.sizes.label2,
    sm: typography.sizes.body2,
    md: typography.sizes.body1,
    lg: typography.sizes.title3,
};

const IconButton = React.memo(({
    icon,
    onPress,
    variant = 'default',
    size = 'md',
    badge,
    disabled = false,
    shape = 'circle',
    style,
    accessibilityLabel,
    testID,
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const dim = SIZE_DIMENSIONS[size];

    const handlePressIn = useCallback(() => {
        Animated.timing(scale, {
            toValue: 0.92,
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

    const buttonStyle = {
        width: dim,
        height: dim,
        borderRadius: shape === 'circle' ? dim / 2 : radii.sm,
    };

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
                style={[styles.base, buttonStyle, styles[`variant_${variant}`], disabled && styles.disabled, style]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled}
                activeOpacity={1}
                testID={testID}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
            >
                {typeof icon === 'string' ? (
                    <Text style={[styles.iconText, { fontSize: ICON_FONT_SIZE[size] }, styles[`icon_${variant}`]]}>
                        {icon}
                    </Text>
                ) : icon}
            </TouchableOpacity>

            {badge !== undefined && badge !== false && badge !== 0 && (
                <View style={[styles.badge, typeof badge === 'number' && badge > 9 && styles.badgeWide]}>
                    {typeof badge === 'number' ? (
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                    ) : null}
                </View>
            )}
        </Animated.View>
    );
});

IconButton.displayName = 'IconButton';

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },

    // ── Variante ───────────────────────────────────────────────────────────
    variant_default: {
        backgroundColor: colors.bg[1],
        borderColor: colors.border.default,
    },
    icon_default: { color: colors.text.secondary },

    variant_outlined: {
        backgroundColor: colors.bg[0],
        borderColor: colors.border.default,
    },
    icon_outlined: { color: colors.text.primary },

    variant_ghost: {
        backgroundColor: colors.bg[0],
        borderColor: 'transparent',
    },
    icon_ghost: { color: colors.text.secondary },

    variant_danger: {
        backgroundColor: colors.tint.critical,
        borderColor: colors.status.critical,
    },
    icon_danger: { color: colors.status.critical },

    // ── Badge ──────────────────────────────────────────────────────────────
    badge: {
        position: 'absolute',
        top: -3,
        right: -3,
        minWidth: 16,
        height: 16,
        borderRadius: radii.full,
        backgroundColor: colors.status.critical,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[1] - 1,
    },
    badgeWide: { minWidth: 20 },
    badgeText: {
        color: colors.text.inverse,
        fontSize: typography.sizes.micro - 1,
        fontWeight: typography.weights.heavy,
        lineHeight: typography.sizes.micro,
    },

    // ── Stare ──────────────────────────────────────────────────────────────
    disabled: { opacity: 0.4 },
    iconText: { includeFontPadding: false },
});

IconButton.propTypes = {
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
    onPress: PropTypes.func.isRequired,
    variant: PropTypes.string,
    size: PropTypes.string,
    badge: PropTypes.oneOfType([PropTypes.number, PropTypes.bool]),
    disabled: PropTypes.bool,
    shape: PropTypes.string,
    style: PropTypes.object,
    accessibilityLabel: PropTypes.string,
    testID: PropTypes.string,
};

export default IconButton;
