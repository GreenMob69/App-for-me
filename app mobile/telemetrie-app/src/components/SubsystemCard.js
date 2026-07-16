import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing } from '../theme';
import { getSubsystemColor, TREND_INDICATORS } from '../utils/statusUtils';

const getTrendInfo = (trend) => {
    if (!trend) return TREND_INDICATORS.stable;
    const key = trend.toLowerCase() === 'improving' ? 'improving'
              : trend.toLowerCase() === 'decreasing' ? 'declining'
              : 'stable';
    return TREND_INDICATORS[key] || TREND_INDICATORS.stable;
};

const SubsystemCard = ({ systemKey, data, onPress }) => {
    const { score, status, trend, prediction } = data;
    const accentColor = getSubsystemColor(score);
    const trendInfo = getTrendInfo(trend);
    const label = t(`subsystems.${systemKey}`) || systemKey.toUpperCase();

    const displayStatus = prediction
        ? prediction.component + ' monitorizat'
        : status;

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: accentColor }]}
            onPress={() => onPress && onPress(systemKey)}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.scoreRow}>
                    <Text style={[styles.score, { color: accentColor }, styles.tabular]}>{score}%</Text>
                    <Text style={[styles.trend, { color: trendInfo.color }]}>{trendInfo.symbol}</Text>
                </View>
            </View>
            <Text style={styles.status} numberOfLines={1}>{displayStatus}</Text>
            <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: accentColor }]} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[3] + 2,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: colors.border.default,
        width: '48%',
        marginBottom: spacing[2] + 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[1] + 2,
    },
    label: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        flex: 1,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    score: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.heavy,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    trend: {
        fontSize: typography.sizes.label2,
        marginLeft: spacing[1],
    },
    status: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginBottom: spacing[2],
    },
    progressBg: {
        height: 3,
        backgroundColor: colors.border.default,
        borderRadius: radii.xs,
        overflow: 'hidden',
    },
    progressFill: {
        height: 3,
        borderRadius: radii.xs,
    },
});

export default SubsystemCard;
