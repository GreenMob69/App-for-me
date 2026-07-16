import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing, motion } from '../theme';

const SEVERITY_MAP = {
    PROBLEM:  { bg: colors.tint.caution,  border: colors.status.caution,  dot: colors.status.caution },
    CRITICAL: { bg: colors.tint.critical, border: colors.status.critical, dot: colors.status.critical },
};

const UrgentBanner = ({ evaluation, primaryObservation }) => {
    const translateY = useRef(new Animated.Value(-8)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: motion.duration.normal, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: motion.duration.normal, useNativeDriver: true }),
        ]).start();
    }, []);

    const style = SEVERITY_MAP[evaluation] || SEVERITY_MAP.PROBLEM;
    const label = evaluation === 'CRITICAL'
        ? t('urgent.labelCritical')
        : t('urgent.labelProblem');

    return (
        <Animated.View style={[styles.container, { backgroundColor: style.bg, borderColor: style.border, opacity, transform: [{ translateY }] }]}>
            <View style={styles.header}>
                <View style={[styles.dot, { backgroundColor: style.dot }]} />
                <Text style={[styles.label, { color: style.border }]}>{label}</Text>
            </View>
            {primaryObservation && (
                <View style={styles.body}>
                    <Text style={styles.title}>{primaryObservation.title}</Text>
                    {primaryObservation.evidence && (
                        <Text style={styles.evidence}>{primaryObservation.evidence}</Text>
                    )}
                    {primaryObservation.action && (
                        <View style={styles.actionBox}>
                            <Text style={styles.actionLabel}>{t('urgent.actionLabel')}</Text>
                            <Text style={styles.actionText}>{primaryObservation.action}</Text>
                        </View>
                    )}
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.md,
        padding: spacing[4],
        marginBottom: spacing[3],
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
    },
    label: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    body: {
        gap: spacing[2],
    },
    title: {
        fontSize: typography.sizes.body1,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
        lineHeight: typography.lineHeights.body1,
    },
    evidence: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
    },
    actionBox: {
        backgroundColor: 'rgba(255,255,255,0.04)', // optical: overlay alb 4% pentru separare vizuală față de bg-ul tinted al bannerului
        borderRadius: radii.sm,
        padding: spacing[3],
        marginTop: spacing[1],
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
});

export default UrgentBanner;
