import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing, motion } from '../theme';
import { SEVERITY_COLORS } from '../utils/statusUtils';
import ConfidenceBadge from './ConfidenceBadge';

const ObservationCard = ({
    title,
    evidence,
    explanation,
    action,
    urgency,
    confidence,
    severity = 'info',
    estimateKm,
    estimateDays,
    onDetailPress,
    index = 0,
}) => {
    const [expanded, setExpanded] = useState(false);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;
    const accentColor = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: motion.duration.normal, delay: index * 100, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: motion.duration.normal, delay: index * 100, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.container, { borderLeftColor: accentColor, opacity, transform: [{ translateY }] }]}>
            <Text style={styles.title}>{title}</Text>

            {evidence ? <Text style={styles.evidence}>{evidence}</Text> : null}

            {explanation ? (
                <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                    {expanded ? (
                        <Text style={styles.explanation}>{explanation}</Text>
                    ) : (
                        <Text style={[styles.expandHint, { color: accentColor }]}>{t('observation.expandHint')}</Text>
                    )}
                </TouchableOpacity>
            ) : null}

            {action ? (
                <View style={styles.actionBox}>
                    <Text style={styles.actionLabel}>{t('observation.actionLabel')}</Text>
                    <Text style={styles.actionText}>{action}</Text>
                </View>
            ) : null}

            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    {urgency ? <Text style={[styles.urgency, { color: accentColor }]}>{urgency}</Text> : null}
                    {(estimateKm || estimateDays) ? (
                        <Text style={styles.estimate}>
                            {estimateKm ? `~${estimateKm} km` : ''}
                            {estimateKm && estimateDays ? ' / ' : ''}
                            {estimateDays ? `~${estimateDays} zile` : ''}
                        </Text>
                    ) : null}
                </View>
                {confidence ? <ConfidenceBadge level={confidence} /> : null}
            </View>

            {onDetailPress ? (
                <TouchableOpacity style={styles.detailLink} onPress={onDetailPress}>
                    <Text style={[styles.detailLinkText, { color: colors.accent.default }]}>Vezi detalii</Text>
                </TouchableOpacity>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        marginBottom: spacing[3],
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    title: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body1,
        marginBottom: spacing[1] + 2,
    },
    evidence: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginBottom: spacing[2],
    },
    expandHint: {
        fontSize: typography.sizes.label2,
        marginBottom: spacing[2],
    },
    explanation: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.label1,
        marginBottom: spacing[2] + 2,
    },
    actionBox: {
        backgroundColor: colors.tint.accent,
        borderRadius: radii.sm,
        padding: spacing[3],
        marginBottom: spacing[3],
    },
    actionLabel: {
        fontSize: typography.sizes.micro - 1,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.5,
        marginBottom: spacing[1],
    },
    actionText: {
        fontSize: typography.sizes.label1,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.label1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLeft: {
        flex: 1,
        gap: spacing[0] + 2,
    },
    urgency: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
    estimate: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
    },
    detailLink: {
        marginTop: spacing[3],
        paddingTop: spacing[2] + 2,
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    detailLinkText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
    },
});

export default ObservationCard;
