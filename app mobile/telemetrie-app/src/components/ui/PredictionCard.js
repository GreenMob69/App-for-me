/**
 * PredictionCard — card pentru prognoze și estimări predictive.
 *
 * Responsabilitate: prezintă o predicție cu nivel de confidență,
 * orizont temporal și status. Folosit pentru estimări de mentenanță,
 * consum sau stare a pieselor.
 *
 * @prop {string}   title           titlul predicției (required)
 * @prop {string}   prediction      textul predicției principale (required)
 * @prop {'low'|'medium'|'high'}  confidence
 * @prop {string}   timeframe       orizontul temporal (ex: '~2 săptămâni', '1200 km')
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'}  status
 * @prop {string|ReactNode}  icon
 * @prop {function} onPress         dacă e furnizat, cardul devine touchable cu press scale
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { colors, typography, radii, spacing, layout, motion } from '../../theme';
import { CONFIDENCE_STYLES } from '../../utils/statusUtils';
import Skeleton from './Skeleton';
import StatusBadge from './StatusBadge';
import PropTypes from 'prop-types';

const CONFIDENCE_LABEL = {
    low:    'Confidență scăzută',
    medium: 'Confidență medie',
    high:   'Confidență ridicată',
};

const CONFIDENCE_STATUS = {
    low:    'neutral',
    medium: 'monitor',
    high:   'good',
};

const PredictionCard = React.memo(({
    title,
    prediction,
    confidence = 'medium',
    timeframe,
    status = 'neutral',
    icon,
    onPress,
    loading = false,
    style,
}) => {
    const pressScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, {
            toValue:         0.97,
            duration:        motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [onPress, pressScale]);

    const handlePressOut = useCallback(() => {
        if (!onPress) return;
        Animated.timing(pressScale, {
            toValue:         1,
            duration:        motion.duration.fast,
            useNativeDriver: true,
        }).start();
    }, [onPress, pressScale]);

    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingHeader}>
                    <Skeleton variant="text" height={typography.sizes.label1} width={100} />
                    <Skeleton variant="rect" height={20} width={80} style={styles.loadingBadge} />
                </View>
                <Skeleton variant="text" lines={2} height={typography.sizes.body2} style={styles.loadingGap} />
                <Skeleton variant="text" height={typography.sizes.caption} width={120} style={styles.loadingGap} />
            </View>
        );
    }

    const confStyle = CONFIDENCE_STYLES[confidence.toUpperCase()] || CONFIDENCE_STYLES.MEDIUM;

    const cardContent = (
        <Animated.View
            style={[styles.card, { transform: [{ scale: pressScale }] }, style]}
            accessible={!onPress}
            accessibilityLabel={!onPress ? `${title}. ${prediction}` : undefined}
        >
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {icon ? (
                        <View style={styles.iconWrap}>
                            {typeof icon === 'string'
                                ? <Text style={styles.iconText}>{icon}</Text>
                                : icon}
                        </View>
                    ) : null}
                    <Text style={styles.title} numberOfLines={2}>{title}</Text>
                </View>
                <StatusBadge
                    status={CONFIDENCE_STATUS[confidence]}
                    label={CONFIDENCE_LABEL[confidence]}
                    size="sm"
                    variant="filled"
                />
            </View>

            <Text style={styles.prediction}>{prediction}</Text>

            {timeframe ? (
                <View style={styles.timeframeRow}>
                    <Text style={styles.timeframeIcon} accessibilityElementsHidden>⏱</Text>
                    <Text style={styles.timeframeText}>{timeframe}</Text>
                </View>
            ) : null}

            <View style={styles.confidenceBar} accessibilityElementsHidden>
                <View
                    style={[
                        styles.confidenceFill,
                        {
                            width: confidence === 'high' ? '90%' : confidence === 'medium' ? '55%' : '25%',
                            backgroundColor: confStyle.color,
                        },
                    ]}
                />
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
                accessibilityHint={prediction}
            >
                {cardContent}
            </TouchableOpacity>
        );
    }

    return cardContent;
});

PredictionCard.displayName = 'PredictionCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[3],
        gap: spacing[2],
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[2],
    },
    iconWrap: {
        marginTop: 1,
        flexShrink: 0,
    },
    iconText: { fontSize: typography.sizes.body1 },
    title: {
        flex: 1,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body2,
    },

    prediction: {
        fontSize: typography.sizes.body2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights.body2,
        marginBottom: spacing[3],
    },

    timeframeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1] + 1,
        marginBottom: spacing[3],
    },
    timeframeIcon: { fontSize: typography.sizes.caption },
    timeframeText: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontWeight: typography.weights.medium,
    },

    confidenceBar: {
        height: 3,
        backgroundColor: colors.border.default,
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    confidenceFill: {
        height: 3,
        borderRadius: radii.full,
    },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
    loadingBadge:  {},
    loadingGap:    { marginBottom: spacing[2] },
});

export default PredictionCard;

PredictionCard.propTypes = {
    title: PropTypes.string.isRequired,
    prediction: PropTypes.string.isRequired,
    confidence: PropTypes.string,
    timeframe: PropTypes.string,
    status: PropTypes.string,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    onPress: PropTypes.func,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
