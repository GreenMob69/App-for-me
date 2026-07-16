/**
 * Button — buton interactiv cu variante, stări și animație.
 *
 * Responsabilitate: acțiunile principale ale utilizatorului.
 * Suportă 5 variante vizuale, 3 dimensiuni, starea loading (cu spinner)
 * și animație subtilă de scale la apăsare.
 *
 * @prop {string}   label          textul butonului (required)
 * @prop {function} onPress        callback la apăsare (required)
 * @prop {'primary'|'secondary'|'ghost'|'danger'|'success'}  variant
 * @prop {'sm'|'md'|'lg'}  size
 * @prop {boolean}  loading        afișează spinner, dezactivează interacțiunea
 * @prop {boolean}  disabled       dezactivează butonul
 * @prop {string|ReactNode}  leftIcon   icon la stânga textului
 * @prop {string|ReactNode}  rightIcon  icon la dreapta textului
 * @prop {boolean}  fullWidth      ocupă toată lățimea disponibilă
 * @prop {object}   style          override pentru container
 * @prop {string}   testID
 * @prop {string}   accessibilityLabel  dacă nu e furnizat, folosește label
 */

import React, { useRef, useCallback } from 'react';
import { Text, TouchableOpacity, Animated, ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, motion } from '../../theme';

// Culoarea spinnerului per variantă
const SPINNER_COLOR = {
    primary:   colors.text.inverse,
    secondary: colors.text.primary,
    ghost:     colors.accent.default,
    danger:    colors.status.critical,
    success:   colors.status.good,
};

const Button = React.memo(({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    style,
    testID,
    accessibilityLabel,
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const isDisabled = disabled || loading;

    const handlePressIn = useCallback(() => {
        Animated.timing(scale, {
            toValue: 0.97,
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

    const renderIcon = (icon, variantStr) => {
        if (!icon) return null;
        if (typeof icon === 'string') {
            return <Text style={[styles.iconText, styles[`${variantStr}_text`]]}>{icon}</Text>;
        }
        return icon;
    };

    return (
        <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }]}>
            <TouchableOpacity
                style={[
                    styles.base,
                    styles[`variant_${variant}`],
                    styles[`size_${size}`],
                    isDisabled && styles.disabled,
                    style,
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isDisabled}
                activeOpacity={1}
                testID={testID}
                accessibilityLabel={accessibilityLabel || label}
                accessibilityRole="button"
                accessibilityState={{ disabled: isDisabled, busy: loading }}
            >
                {loading ? (
                    <ActivityIndicator
                        size="small"
                        color={SPINNER_COLOR[variant] || colors.text.primary}
                    />
                ) : (
                    <>
                        {leftIcon ? (
                            <View style={styles.iconLeft}>
                                {renderIcon(leftIcon, `variant_${variant}`)}
                            </View>
                        ) : null}
                        <Text style={[styles.label, styles[`size_${size}_text`], styles[`variant_${variant}_text`]]}>
                            {label}
                        </Text>
                        {rightIcon ? (
                            <View style={styles.iconRight}>
                                {renderIcon(rightIcon, `variant_${variant}`)}
                            </View>
                        ) : null}
                    </>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    fullWidth: { width: '100%' },

    // ── Variante ───────────────────────────────────────────────────────────
    variant_primary: {
        backgroundColor: colors.accent.default,
        borderColor: colors.accent.default,
    },
    variant_primary_text: { color: colors.text.inverse },

    variant_secondary: {
        backgroundColor: colors.bg[2],
        borderColor: colors.border.default,
    },
    variant_secondary_text: { color: colors.text.primary },

    variant_ghost: {
        backgroundColor: colors.bg[0],
        borderColor: 'transparent',
    },
    variant_ghost_text: { color: colors.accent.default },

    variant_danger: {
        backgroundColor: colors.tint.critical,
        borderColor: colors.status.critical,
    },
    variant_danger_text: { color: colors.status.critical },

    variant_success: {
        backgroundColor: colors.tint.good,
        borderColor: colors.status.good,
    },
    variant_success_text: { color: colors.status.good },

    // ── Dimensiuni ─────────────────────────────────────────────────────────
    size_sm: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        minHeight: 32,
    },
    size_sm_text: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },

    size_md: {
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[2] + 2,
        minHeight: 40,
    },
    size_md_text: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
    },

    size_lg: {
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[3] + 2,
        minHeight: 50,
    },
    size_lg_text: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.bold,
    },

    // ── Stare ──────────────────────────────────────────────────────────────
    disabled: { opacity: 0.4 },

    // ── Icoane ─────────────────────────────────────────────────────────────
    label: { textAlign: 'center' },
    iconText: { fontSize: typography.sizes.body2 },
    iconLeft:  { marginRight: spacing[2] },
    iconRight: { marginLeft: spacing[2] },
});

export default Button;
