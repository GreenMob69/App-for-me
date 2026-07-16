/**
 * EmptyState — stare vidă standardizată cu icon, titlu, subtitlu și CTA.
 *
 * Responsabilitate: înlocuiește liste/secțiuni goale cu un mesaj util
 * și, opțional, o acțiune de remediere. Dimensiunea 'sm' se folosește
 * în interiorul unui Card, 'md' ocupă o secțiune, 'lg' umple ecranul.
 *
 * @prop {string|ReactNode}  icon       emoji sau component (opțional)
 * @prop {string}  title                titlul principal (required)
 * @prop {string}  subtitle             text descriptiv (opțional)
 * @prop {{ label: string, onPress: function }}  action  buton CTA
 * @prop {'sm'|'md'|'lg'}  size
 * @prop {object}  style                override pentru container
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, spacing, motion } from '../../theme';
import Button from './Button';

const EmptyState = React.memo(({
    icon,
    title,
    subtitle,
    action,
    size = 'md',
    style,
}) => {
    const opacity    = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: motion.duration.normal, delay: 60, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: motion.duration.normal, delay: 60, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={[
                styles.container,
                styles[`container_${size}`],
                { opacity, transform: [{ translateY }] },
                style,
            ]}
            accessible
            accessibilityRole="none"
            accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        >
            {icon ? (
                <View style={[styles.iconWrap, styles[`iconWrap_${size}`]]}>
                    {typeof icon === 'string' ? (
                        <Text style={[styles.iconText, styles[`iconText_${size}`]]}>{icon}</Text>
                    ) : icon}
                </View>
            ) : null}

            <Text style={[styles.title, styles[`title_${size}`]]}>{title}</Text>

            {subtitle ? (
                <Text style={[styles.subtitle, styles[`subtitle_${size}`]]}>{subtitle}</Text>
            ) : null}

            {action ? (
                <Button
                    label={action.label}
                    onPress={action.onPress}
                    variant="secondary"
                    size={size === 'lg' ? 'md' : 'sm'}
                    style={styles.cta}
                />
            ) : null}
        </Animated.View>
    );
});

EmptyState.displayName = 'EmptyState';

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[4],
    },
    container_sm: { paddingVertical: spacing[4] },
    container_md: { paddingVertical: spacing[8] },
    container_lg: { paddingVertical: spacing[12] },

    // ── Icon ──────────────────────────────────────────────────────────────
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing[3],
    },
    iconWrap_sm: { marginBottom: spacing[2] },
    iconWrap_md: { marginBottom: spacing[3] },
    iconWrap_lg: { marginBottom: spacing[4] },

    iconText: { includeFontPadding: false },
    iconText_sm: { fontSize: 28 },
    iconText_md: { fontSize: 40 },
    iconText_lg: { fontSize: 56 },

    // ── Text ──────────────────────────────────────────────────────────────
    title: {
        textAlign: 'center',
        fontWeight: typography.weights.semibold,
        color: colors.text.secondary,
    },
    title_sm: { fontSize: typography.sizes.body2 },
    title_md: { fontSize: typography.sizes.body1 },
    title_lg: { fontSize: typography.sizes.title3 },

    subtitle: {
        textAlign: 'center',
        color: colors.text.tertiary,
        marginTop: spacing[1] + 2,
    },
    subtitle_sm: { fontSize: typography.sizes.caption },
    subtitle_md: { fontSize: typography.sizes.body2 },
    subtitle_lg: { fontSize: typography.sizes.body1 },

    // ── Acțiune ───────────────────────────────────────────────────────────
    cta: {
        marginTop: spacing[4],
    },
});

export default EmptyState;
