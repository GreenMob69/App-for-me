/**
 * Input — câmp text standardizat cu label, eroare și helper.
 *
 * Responsabilitate: orice interacțiune text cu utilizatorul:
 * IP server, preț combustibil, VIN, căutare, câmpuri form.
 * Gestionează starea de focus vizual (border highlight).
 *
 * @prop {string}   value          valoarea curentă (required)
 * @prop {function} onChangeText   callback la modificare (required)
 * @prop {string}   label          eticheta afișată deasupra câmpului
 * @prop {string}   placeholder
 * @prop {string}   error          mesaj de eroare (activează border roșu)
 * @prop {string}   helper         text helper sub câmp
 * @prop {boolean}  disabled
 * @prop {boolean}  multiline
 * @prop {number}   numberOfLines
 * @prop {string}   keyboardType
 * @prop {boolean}  secureTextEntry
 * @prop {ReactNode} leftIcon      component afișat în stânga textului
 * @prop {ReactNode} rightIcon     component afișat în dreapta textului
 * @prop {function} onSubmitEditing
 * @prop {function} onFocus
 * @prop {function} onBlur
 * @prop {string}   returnKeyType
 * @prop {object}   style          override pentru containerul exterior
 * @prop {object}   inputStyle     override pentru TextInput
 * @prop {string}   testID
 * @prop {string}   accessibilityLabel
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing } from '../../theme';

const Input = React.memo(({
    value,
    onChangeText,
    label,
    placeholder,
    error,
    helper,
    disabled = false,
    multiline = false,
    numberOfLines = 1,
    keyboardType = 'default',
    secureTextEntry = false,
    leftIcon,
    rightIcon,
    onSubmitEditing,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
    returnKeyType,
    style,
    inputStyle,
    testID,
    accessibilityLabel,
}) => {
    const [focused, setFocused] = useState(false);

    const handleFocus = useCallback((e) => {
        setFocused(true);
        onFocusProp?.(e);
    }, [onFocusProp]);

    const handleBlur = useCallback((e) => {
        setFocused(false);
        onBlurProp?.(e);
    }, [onBlurProp]);

    const containerBorderColor = error
        ? colors.status.critical
        : focused
            ? colors.accent.default
            : colors.border.default;

    return (
        <View style={[styles.wrapper, style]}>
            {label ? (
                <Text style={[styles.label, disabled && styles.labelDisabled]}>
                    {label}
                </Text>
            ) : null}

            <View style={[
                styles.inputContainer,
                { borderColor: containerBorderColor },
                focused && styles.inputFocused,
                error && styles.inputError,
                disabled && styles.inputDisabled,
            ]}>
                {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

                <TextInput
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeft,
                        rightIcon && styles.inputWithRight,
                        multiline && styles.inputMultiline,
                        disabled && styles.inputTextDisabled,
                        inputStyle,
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.disabled}
                    editable={!disabled}
                    multiline={multiline}
                    numberOfLines={multiline ? numberOfLines : 1}
                    keyboardType={keyboardType}
                    secureTextEntry={secureTextEntry}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    returnKeyType={returnKeyType}
                    testID={testID}
                    accessibilityLabel={accessibilityLabel || label || placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
            </View>

            {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
            ) : helper ? (
                <Text style={styles.helper}>{helper}</Text>
            ) : null}
        </View>
    );
});

Input.displayName = 'Input';

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: spacing[3],
    },

    // ── Label ──────────────────────────────────────────────────────────────
    label: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
        marginBottom: spacing[1] + 2,
    },
    labelDisabled: {
        color: colors.text.disabled,
    },

    // ── Container ──────────────────────────────────────────────────────────
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg[0],
        borderWidth: 1,
        borderRadius: radii.sm,
        minHeight: 44,
    },
    inputFocused: {
        backgroundColor: colors.bg[1],
    },
    inputError: {
        backgroundColor: colors.tint.critical,
    },
    inputDisabled: {
        backgroundColor: colors.bg[0],
        opacity: 0.55,
    },

    // ── TextInput ──────────────────────────────────────────────────────────
    input: {
        flex: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2] + 2,
        color: colors.text.primary,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.medium,
    },
    inputWithLeft:  { paddingLeft: spacing[2] },
    inputWithRight: { paddingRight: spacing[2] },
    inputMultiline: {
        textAlignVertical: 'top',
        paddingTop: spacing[2] + 2,
        minHeight: 80,
    },
    inputTextDisabled: {
        color: colors.text.disabled,
    },

    // ── Icoane ─────────────────────────────────────────────────────────────
    leftIcon: {
        paddingLeft: spacing[3],
        justifyContent: 'center',
    },
    rightIcon: {
        paddingRight: spacing[3],
        justifyContent: 'center',
    },

    // ── Mesaje ─────────────────────────────────────────────────────────────
    error: {
        fontSize: typography.sizes.caption,
        color: colors.status.critical,
        marginTop: spacing[1],
    },
    helper: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: spacing[1],
    },
});

export default Input;
