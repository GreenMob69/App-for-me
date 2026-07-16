import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing } from '../theme';

const getSeverityStyle = (severity) => {
    if (severity === 'HIGH') return {
        borderColor: colors.status.critical,
        iconColor:   colors.status.critical,
        bgTint:      colors.tint.critical,
    };
    return {
        borderColor: colors.status.monitor,
        iconColor:   colors.status.monitor,
        bgTint:      colors.tint.monitor,
    };
};

const PredictionCard = ({ prediction, onPress }) => {
    const { component, probability, confidence, severity, estimatedRemainingKm, recommendation } = prediction;
    const style = getSeverityStyle(severity);

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: style.borderColor, backgroundColor: style.bgTint }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <Text style={[styles.warningIcon, { color: style.iconColor }]}>⚠</Text>
                <Text style={styles.title}>{component}: {t('predictionCard.wearSigns')}</Text>
            </View>

            <View style={styles.barContainer}>
                <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${probability}%`, backgroundColor: style.borderColor }]} />
                </View>
                <Text style={[styles.barLabel, { color: style.borderColor }, styles.tabular]}>{probability}%</Text>
            </View>

            <View style={styles.details}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('predictionCard.remainingDist')}</Text>
                    <Text style={[styles.detailValue, styles.tabular]}>~{estimatedRemainingKm?.toLocaleString()} km</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('predictionCard.analysisConfidence')}</Text>
                    <Text style={[styles.detailValue, styles.tabular]}>{confidence}%</Text>
                </View>
            </View>

            <Text style={styles.recommendation} numberOfLines={2}>{recommendation}</Text>

            <Text style={[styles.link, { color: style.borderColor }]}>{t('predictionCard.viewFull')}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: radii.md,
        padding: spacing[4],
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginBottom: spacing[2] + 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    warningIcon: {
        fontSize: typography.sizes.body1,
        marginRight: spacing[2],
    },
    title: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        flex: 1,
    },
    barContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    barBg: {
        flex: 1,
        height: 6,
        backgroundColor: colors.border.strong,
        borderRadius: radii.xs,
        overflow: 'hidden',
        marginRight: spacing[2] + 2,
    },
    barFill: {
        height: 6,
        borderRadius: radii.xs,
    },
    barLabel: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        minWidth: 36,
        textAlign: 'right',
    },
    details: {
        marginBottom: spacing[2] + 2,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing[1],
    },
    detailLabel: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
    },
    detailValue: {
        fontSize: typography.sizes.label2,
        color: colors.text.primary,
        fontWeight: typography.weights.semibold,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    recommendation: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        fontStyle: 'italic',
        marginBottom: spacing[2] + 2,
        lineHeight: typography.lineHeights.label2 + 1,
    },
    link: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
});

export default PredictionCard;
