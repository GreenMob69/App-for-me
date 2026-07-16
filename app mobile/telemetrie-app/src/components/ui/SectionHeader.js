/**
 * SectionHeader — titlu de secțiune standardizat.
 *
 * Responsabilitate: afișează titlul și subtitlul unei secțiuni,
 * cu opțional un buton de acțiune aliniat la dreapta.
 * Folosit pentru a introduce orice grup de carduri sau liste.
 *
 * @prop {string}   title     titlul principal (required)
 * @prop {string}   subtitle  text descriptiv sub titlu
 * @prop {{ label: string, onPress: function }} action  buton text la dreapta
 * @prop {'sm'|'md'|'lg'}  size  dimensiunea titlului
 * @prop {boolean}  uppercase  transformă titlul în UPPERCASE (implicit true)
 * @prop {object}   style     override pentru containerul rând
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';

const SectionHeader = React.memo(({
    title,
    subtitle,
    action,
    size = 'md',
    uppercase = true,
    style,
}) => {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.left}>
                <Text
                    style={[styles.title, styles[`title_${size}`], uppercase && styles.uppercase]}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                ) : null}
            </View>

            {action ? (
                <TouchableOpacity
                    onPress={action.onPress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                >
                    <Text style={styles.action}>{action.label}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
});

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2] + 2,
    },
    left: {
        flex: 1,
        paddingRight: spacing[2],
    },

    // ── Titlu ──────────────────────────────────────────────────────────────
    title: {
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.4,
    },
    title_sm: { fontSize: typography.sizes.caption },
    title_md: { fontSize: typography.sizes.label1 },
    title_lg: { fontSize: typography.sizes.body2 },
    uppercase: { textTransform: 'uppercase' },

    subtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[1] - 2,
    },

    // ── Acțiune ────────────────────────────────────────────────────────────
    action: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },
});

export default SectionHeader;
