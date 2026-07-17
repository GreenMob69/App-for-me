import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing, motion } from '../theme';
import { SEVERITY_COLORS } from '../utils/statusUtils';
import ConfidenceBadge from './ConfidenceBadge';
import PropTypes from 'prop-types';

const UpcomingTimeline = ({ items }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: motion.duration.normal,
            delay: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!items || items.length === 0) return null;

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Text style={styles.sectionLabel}>{t('upcoming.sectionTitle')}</Text>
            <View style={styles.timeline}>
                {items.map((item, index) => (
                    <TimelineItem
                        key={`${item.component}-${index}`}
                        item={item}
                        isLast={index === items.length - 1}
                    />
                ))}
            </View>
        </Animated.View>
    );
};

const TimelineItem = ({ item, isLast }) => {
    const accentColor = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info;

    return (
        <View style={styles.itemRow}>
            <View style={styles.connector}>
                <View style={[styles.dot, { backgroundColor: accentColor }]} />
                {!isLast && <View style={styles.line} />}
            </View>

            <View style={styles.itemContent}>
                <Text style={styles.component}>{item.component}</Text>

                <View style={styles.timeframeRow}>
                    <Text style={[styles.timeframe, { color: accentColor }]}>{item.timeframe}</Text>
                </View>

                <Text style={styles.urgency}>{item.urgency}</Text>

                {item.reason && (
                    <Text style={styles.reason}>
                        {t('upcoming.whyPrefix')} {item.reason}
                    </Text>
                )}

                {item.recommendation && (
                    <Text style={styles.recommendation}>{item.recommendation}</Text>
                )}

                <View style={styles.footer}>
                    <ConfidenceBadge level={item.confidence} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        marginBottom: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    sectionLabel: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        color: colors.text.tertiary,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: spacing[4],
    },
    timeline: {
        gap: 0,
    },
    itemRow: {
        flexDirection: 'row',
    },
    connector: {
        width: 20,
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
        marginTop: spacing[1],
    },
    line: {
        width: 1,
        flex: 1,
        backgroundColor: colors.border.default,
        marginVertical: spacing[1],
    },
    itemContent: {
        flex: 1,
        paddingLeft: spacing[3],
        paddingBottom: spacing[5],
    },
    component: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        marginBottom: spacing[1],
    },
    timeframeRow: {
        marginBottom: spacing[1],
    },
    timeframe: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
    urgency: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.label1,
        marginBottom: spacing[1] + 2,
    },
    reason: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label2,
        marginBottom: spacing[1] + 2,
    },
    recommendation: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.label1,
        marginBottom: spacing[2],
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default UpcomingTimeline;

UpcomingTimeline.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        component: PropTypes.string,
        timeframe: PropTypes.string,
        urgency: PropTypes.string,
        reason: PropTypes.string,
        recommendation: PropTypes.string,
        confidence: PropTypes.string,
        severity: PropTypes.string,
    })),
};
