import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';

const SEVERITY_MAP = {
    PROBLEM: { bg: 'rgba(240,136,62,0.08)', border: '#f0883e', dotColor: '#f0883e' },
    CRITICAL: { bg: 'rgba(248,81,73,0.08)', border: '#f85149', dotColor: '#f85149' },
};

const UrgentBanner = ({ evaluation, primaryObservation }) => {
    const translateY = useRef(new Animated.Value(-8)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
    }, []);

    const style = SEVERITY_MAP[evaluation] || SEVERITY_MAP.PROBLEM;
    const label = evaluation === 'CRITICAL'
        ? t('urgent.labelCritical')
        : t('urgent.labelProblem');

    return (
        <Animated.View style={[styles.container, { backgroundColor: style.bg, borderColor: style.border, opacity, transform: [{ translateY }] }]}>
            <View style={styles.header}>
                <View style={[styles.dot, { backgroundColor: style.dotColor }]} />
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
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    body: {
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
        lineHeight: 22,
    },
    evidence: {
        fontSize: 12,
        color: '#8b949e',
    },
    actionBox: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
    },
    actionLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#8b949e',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    actionText: {
        fontSize: 13,
        color: '#ffffff',
        lineHeight: 19,
    },
});

export default UrgentBanner;
