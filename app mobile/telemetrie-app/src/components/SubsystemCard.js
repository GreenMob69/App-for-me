import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const SYSTEM_ICONS = {
    motor: '⚙',
    electric: '⚡',
    turbo: '🌀',
    combustibil: '⛽',
    stil_condus: '🛣',
};

const SYSTEM_LABELS = {
    motor: 'MOTOR',
    electric: 'ELECTRIC',
    turbo: 'TURBO',
    combustibil: 'COMBUSTIBIL',
    stil_condus: 'STIL CONDUS',
};

const getTrendIndicator = (trend) => {
    switch (trend) {
        case 'IMPROVING': return { symbol: '▲', color: '#3fb950' };
        case 'DECREASING': return { symbol: '▼', color: '#f85149' };
        default: return { symbol: '●', color: '#8b949e' };
    }
};

const getScoreColor = (score) => {
    if (score >= 85) return '#238636';
    if (score >= 60) return '#d29922';
    return '#da3633';
};

const getBorderColor = (score) => {
    if (score >= 85) return '#238636';
    if (score >= 60) return '#d29922';
    return '#da3633';
};

const SubsystemCard = ({ systemKey, data, onPress }) => {
    const { score, status, trend, prediction } = data;
    const trendInfo = getTrendIndicator(trend);
    const borderColor = getBorderColor(score);
    const icon = SYSTEM_ICONS[systemKey] || '●';
    const label = SYSTEM_LABELS[systemKey] || systemKey;

    const displayStatus = prediction
        ? prediction.component + ' monitorizat'
        : status;

    return (
        <TouchableOpacity
            style={[styles.card, { borderLeftColor: borderColor }]}
            onPress={() => onPress && onPress(systemKey)}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <Text style={styles.icon}>{icon}</Text>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.scoreRow}>
                    <Text style={[styles.score, { color: getScoreColor(score) }]}>{score}%</Text>
                    <Text style={[styles.trend, { color: trendInfo.color }]}>{trendInfo.symbol}</Text>
                </View>
            </View>
            <Text style={styles.status} numberOfLines={1}>{displayStatus}</Text>
            <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: borderColor }]} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 14,
        borderLeftWidth: 4,
        borderColor: '#30363d',
        width: '48%',
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    icon: {
        fontSize: 14,
        marginRight: 6,
    },
    label: {
        fontSize: 11,
        fontWeight: '700',
        color: '#c9d1d9',
        flex: 1,
        letterSpacing: 0.5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    score: {
        fontSize: 16,
        fontWeight: '900',
    },
    trend: {
        fontSize: 10,
        marginLeft: 4,
    },
    status: {
        fontSize: 11,
        color: '#8b949e',
        marginBottom: 8,
    },
    progressBg: {
        height: 3,
        backgroundColor: '#21262d',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: 3,
        borderRadius: 2,
    },
});

export default SubsystemCard;
