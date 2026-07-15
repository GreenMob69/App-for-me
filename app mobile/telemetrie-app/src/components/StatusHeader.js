import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t } from '../i18n';

const EVALUATION_STYLES = {
    EXCELLENT: { color: '#3fb950', gradient: 'rgba(63,185,80,0.08)' },
    GOOD: { color: '#58a6ff', gradient: 'rgba(88,166,255,0.06)' },
    ATTENTION: { color: '#d29922', gradient: 'rgba(210,153,34,0.08)' },
    PROBLEM: { color: '#f0883e', gradient: 'rgba(240,136,62,0.08)' },
    CRITICAL: { color: '#f85149', gradient: 'rgba(248,81,73,0.08)' },
};

const StatusHeader = ({ evaluation = 'EXCELLENT', message = '', subtitle = '' }) => {
    const style = EVALUATION_STYLES[evaluation] || EVALUATION_STYLES.EXCELLENT;
    const label = t(`evaluation.${evaluation}`);

    return (
        <View style={[styles.container, { backgroundColor: style.gradient }]}>
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
        paddingVertical: 32,
        paddingHorizontal: 24,
        alignItems: 'center',
        borderRadius: 16,
        marginBottom: 16,
    },
    message: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        lineHeight: 26,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 13,
        color: '#8b949e',
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 16,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
    },
    badgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
});

export default StatusHeader;
