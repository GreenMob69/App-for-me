import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t } from '../i18n';

const LEVEL_STYLES = {
    HIGH: { color: '#3fb950', bg: 'rgba(63,185,80,0.1)' },
    MEDIUM: { color: '#d29922', bg: 'rgba(210,153,34,0.1)' },
    LOW: { color: '#8b949e', bg: 'rgba(139,148,158,0.1)' },
};

const ConfidenceBadge = ({ level = 'MEDIUM' }) => {
    const style = LEVEL_STYLES[level] || LEVEL_STYLES.MEDIUM;
    const label = t(`confidence.${level}`);

    return (
        <View style={[styles.container, { backgroundColor: style.bg, borderColor: style.color }]}>
            <View style={[styles.dot, { backgroundColor: style.color }]} />
            <Text style={[styles.label, { color: style.color }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
    },
});

export default ConfidenceBadge;
