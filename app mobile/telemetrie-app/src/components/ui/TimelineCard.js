/**
 * TimelineCard — element individual într-o linie cronologică.
 *
 * Responsabilitate: afișează un eveniment cu dată/oră, titlu și descriere
 * ca parte dintr-o linie de timp verticală. Liniile de conectare
 * sunt gestionate prin isFirst/isLast.
 *
 * @prop {string}   title           titlul evenimentului (required)
 * @prop {string}   description     detalii suplimentare
 * @prop {string}   date            data formatată (ex: '14 iun 2025')
 * @prop {string}   time            ora formatată (ex: '09:42')
 * @prop {'event'|'maintenance'|'alert'|'trip'|'milestone'}  type
 * @prop {boolean}  isFirst         ascunde linia de sus
 * @prop {boolean}  isLast          ascunde linia de jos
 * @prop {function} onPress
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, motion } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const TYPE_STYLES = {
    event:       { color: colors.accent.default,   icon: '◆', bg: colors.accent.muted },
    maintenance: { color: colors.status.monitor,   icon: '⚙',  bg: colors.tint.monitor },
    alert:       { color: colors.status.caution,   icon: '⚠',  bg: colors.tint.caution },
    trip:        { color: colors.status.good,      icon: '↗',  bg: colors.tint.good },
    milestone:   { color: colors.status.optimal,   icon: '★',  bg: colors.tint.optimal },
};

const TimelineCard = React.memo(({
    title,
    description,
    date,
    time,
    type = 'event',
    isFirst = false,
    isLast = false,
    onPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;
    const tStyle = TYPE_STYLES[type] || TYPE_STYLES.event;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 0.98, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, { toValue: 1, duration: motion.duration.fast, useNativeDriver: true }).start();
    }, [onPress, pressScale]);

    if (loading) {
        return (
            <View style={[styles.row, style]}>
                <View style={styles.timelineCol}>
                    <View style={[styles.connectorTop, isFirst && styles.connectorHidden]} />
                    <View style={[styles.dotOuter, styles.dotLoading]} />
                    <View style={[styles.connectorBottom, isLast && styles.connectorHidden]} />
                </View>
                <View style={styles.content}>
                    <Skeleton variant="text" height={typography.sizes.caption} width={80} style={styles.loadingGap} />
                    <Skeleton variant="text" height={typography.sizes.body2} width="80%" />
                    <Skeleton variant="text" height={typography.sizes.caption} width="60%" style={styles.loadingGap} />
                </View>
            </View>
        );
    }

    const inner = (
        <Animated.View style={[styles.row, { transform: [{ scale: pressScale }] }, style]}>
            <View style={styles.timelineCol}>
                <View style={[styles.connectorTop, isFirst && styles.connectorHidden]} />
                <View style={[styles.dotOuter, { backgroundColor: tStyle.bg, borderColor: tStyle.color }]}>
                    <Text style={[styles.dotIcon, { color: tStyle.color }]}>{tStyle.icon}</Text>
                </View>
                <View style={[styles.connectorBottom, isLast && styles.connectorHidden]} />
            </View>

            <View style={styles.content}>
                {(date || time) ? (
                    <Text style={styles.dateText}>
                        {[date, time].filter(Boolean).join(' · ')}
                    </Text>
                ) : null}
                <Text style={styles.title}>{title}</Text>
                {description ? (
                    <Text style={styles.description}>{description}</Text>
                ) : null}
            </View>
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
                {inner}
            </TouchableOpacity>
        );
    }

    return inner;
});

TimelineCard.displayName = 'TimelineCard';

const DOT_SIZE = 28;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        minHeight: 56,
    },

    // ── Timeline column ────────────────────────────────────────────────────
    timelineCol: {
        width: DOT_SIZE + spacing[3],
        alignItems: 'center',
    },
    connectorTop: {
        flex: 1,
        width: 2,
        backgroundColor: colors.border.default,
        maxHeight: spacing[3],
    },
    connectorBottom: {
        flex: 1,
        width: 2,
        backgroundColor: colors.border.default,
    },
    connectorHidden: { backgroundColor: 'transparent' },
    dotOuter: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotIcon: {
        fontSize: typography.sizes.caption,
        includeFontPadding: false,
    },
    dotLoading: {
        backgroundColor: colors.bg[3],
        borderColor: colors.border.default,
    },

    // ── Content ────────────────────────────────────────────────────────────
    content: {
        flex: 1,
        paddingLeft: spacing[3],
        paddingBottom: spacing[4],
        paddingTop: spacing[1],
    },
    dateText: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        marginBottom: spacing[1] - 1,
    },
    title: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    description: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[1] - 1,
        lineHeight: typography.lineHeights.caption,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingGap: { marginBottom: spacing[1] },
});

export default TimelineCard;

TimelineCard.propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    date: PropTypes.string,
    time: PropTypes.string,
    type: PropTypes.string,
    isFirst: PropTypes.bool,
    isLast: PropTypes.bool,
    onPress: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
