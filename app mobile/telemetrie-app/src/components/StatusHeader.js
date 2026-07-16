import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing } from '../theme';
import { EVALUATION_STYLES } from '../utils/statusUtils';

const StatusHeader = ({ evaluation = 'EXCELLENT', message = '', subtitle = '' }) => {
    const style = EVALUATION_STYLES[evaluation] || EVALUATION_STYLES.EXCELLENT;
    const label = t(`evaluation.${evaluation}`);

    return (
        <View style={[styles.container, { backgroundColor: style.tint }]}>
            <Text style={styles.message}>{message}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={[styles.badge, { borderColor: style.color }]}>
                <View style={[styles.badgeDot, { backgroundColor: style.color }]} />
                <Text style={[styles.badgeText, { color: style.color }]}>{label}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: spacing[8],
        paddingHorizontal: spacing[6],
        alignItems: 'center',
        borderRadius: radii.lg,
        marginBottom: spacing[3],
    },
    message: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        textAlign: 'center',
        lineHeight: typography.lineHeights.title3,
        marginBottom: spacing[2],
    },
    subtitle: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: typography.lineHeights.label1,
        marginBottom: spacing[4],
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: spacing[1] + 2,
        borderRadius: radii.full,
        borderWidth: 1,
        gap: spacing[2],
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
    },
    badgeText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
    },
});

export default StatusHeader;
