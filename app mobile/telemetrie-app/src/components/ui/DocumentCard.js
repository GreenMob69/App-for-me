/**
 * DocumentCard — card pentru un document sau fișier atașat vehiculului.
 *
 * Responsabilitate: afișează metadate ale unui document (tip, nume, mărime,
 * dată) cu un icon vizual specific tipului de fișier. Acționabil prin onPress.
 *
 * @prop {string}   title           numele documentului (required)
 * @prop {'pdf'|'image'|'doc'|'xls'|'other'}  documentType
 * @prop {string}   fileSize        mărimea formatată (ex: '2.4 MB')
 * @prop {string}   date            data emiterii/adăugării
 * @prop {string}   category        categoria documentului (ex: 'Asigurare', 'ITP')
 * @prop {function} onPress
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const DOC_TYPE_STYLES = {
    pdf:   { icon: '📄', color: colors.status.critical, bg: colors.tint.critical,  label: 'PDF' },
    image: { icon: '🖼',  color: colors.accent.default,  bg: colors.accent.muted,   label: 'IMG' },
    doc:   { icon: '📝', color: colors.status.monitor,  bg: colors.tint.monitor,   label: 'DOC' },
    xls:   { icon: '📊', color: colors.status.good,     bg: colors.tint.good,      label: 'XLS' },
    other: { icon: '📎', color: colors.text.secondary,  bg: colors.bg[3],          label: 'FILE' },
};

const DocumentCard = React.memo(({
    title,
    documentType = 'other',
    fileSize,
    date,
    category,
    onPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;
    const dStyle = DOC_TYPE_STYLES[documentType] || DOC_TYPE_STYLES.other;

    const handlePressIn = useCallback(() => {
        Animated.timing(pressScale, { toValue: 0.97, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [pressScale]);

    const handlePressOut = useCallback(() => {
        Animated.timing(pressScale, { toValue: 1, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [pressScale]);

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingRow}>
                    <Skeleton variant="rect" height={40} width={40} style={styles.loadingIcon} />
                    <View style={styles.loadingText}>
                        <Skeleton variant="text" height={typography.sizes.body2} width="75%" />
                        <Skeleton variant="text" height={typography.sizes.caption} width="50%" style={styles.loadingGap} />
                    </View>
                    <Skeleton variant="circle" height={20} width={20} />
                </View>
            </View>
        );
    }

    const meta = [fileSize, date, category].filter(Boolean).join(' · ');

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : 'none'}
            accessibilityLabel={`${title}${meta ? ', ' + meta : ''}`}
        >
            <Animated.View style={[styles.card, { transform: [{ scale: pressScale }] }, style]}>
                <View style={[styles.iconWrap, { backgroundColor: dStyle.bg, borderColor: dStyle.color }]}>
                    <Text style={styles.iconEmoji}>{dStyle.icon}</Text>
                    <Text style={[styles.typeLabel, { color: dStyle.color }]}>{dStyle.label}</Text>
                </View>

                <View style={styles.textGroup}>
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>
                    {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
                </View>

                {onPress ? (
                    <View style={styles.arrow}>
                        <Text style={styles.arrowIcon}>›</Text>
                    </View>
                ) : null}
            </Animated.View>
        </TouchableOpacity>
    );
});

DocumentCard.displayName = 'DocumentCard';

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPaddingV,
        paddingHorizontal: layout.cardPadding,
        gap: spacing[3],
    },

    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: radii.sm,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconEmoji: { fontSize: typography.sizes.body1 },
    typeLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.3,
    },

    textGroup: { flex: 1 },
    title: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.medium,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
    },
    meta: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginTop: spacing[1] - 2,
    },

    arrow: { paddingLeft: spacing[1] },
    arrowIcon: {
        fontSize: typography.sizes.title3,
        color: colors.text.tertiary,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    loadingIcon: { borderRadius: radii.sm, flexShrink: 0 },
    loadingText: { flex: 1 },
    loadingGap: { marginTop: spacing[1] },
});

export default DocumentCard;

DocumentCard.propTypes = {
    title: PropTypes.string.isRequired,
    documentType: PropTypes.string,
    fileSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    date: PropTypes.string,
    category: PropTypes.string,
    onPress: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
