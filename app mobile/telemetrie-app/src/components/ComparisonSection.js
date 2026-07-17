import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing, motion } from '../theme';
import { TREND_INDICATORS } from '../utils/statusUtils';
import PropTypes from 'prop-types';

const ComparisonSection = ({ comparison }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: motion.duration.normal,
            delay: 150,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!comparison) return null;

    const indicator = TREND_INDICATORS[comparison.trend] || TREND_INDICATORS.stable;

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Text style={styles.sectionLabel}>{t('comparison.sectionTitle')}</Text>
            <View style={styles.content}>
                <View style={styles.indicatorRow}>
                    <Text style={[styles.indicator, { color: indicator.color }]}>{indicator.symbol}</Text>
                    <Text style={styles.summary}>{comparison.summary}</Text>
                </View>
                {comparison.detail && (
                    <Text style={styles.detail}>{comparison.detail}</Text>
                )}
            </View>
        </Animated.View>
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
        marginBottom: spacing[3],
    },
    content: {
        gap: spacing[2],
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[2] + 2,
    },
    indicator: {
        fontSize: typography.sizes.title3 - 1,
        fontWeight: typography.weights.bold,
        marginTop: 1,
    },
    summary: {
        flex: 1,
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
    },
    detail: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.label1,
        marginLeft: 26,
    },
});

export default ComparisonSection;

ComparisonSection.propTypes = {
    comparison: PropTypes.shape({
        trend: PropTypes.string,
        summary: PropTypes.string,
        detail: PropTypes.string,
    }),
};
