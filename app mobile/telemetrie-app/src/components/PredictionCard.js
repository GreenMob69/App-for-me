import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const getSeverityStyle = (severity) => {
    if (severity === 'HIGH') return { borderColor: '#da3633', iconColor: '#f85149', bgTint: 'rgba(218, 54, 51, 0.06)' };
    return { borderColor: '#d29922', iconColor: '#d29922', bgTint: 'rgba(210, 153, 34, 0.06)' };
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
                <Text style={styles.title}>{component}: semne de uzură</Text>
            </View>

            <View style={styles.barContainer}>
                <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${probability}%`, backgroundColor: style.borderColor }]} />
                </View>
                <Text style={[styles.barLabel, { color: style.borderColor }]}>{probability}%</Text>
            </View>

            <View style={styles.details}>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distanță estimată rămasă</Text>
                    <Text style={styles.detailValue}>~{estimatedRemainingKm?.toLocaleString()} km</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Încredere analiză</Text>
                    <Text style={styles.detailValue}>{confidence}%</Text>
                </View>
            </View>

            <Text style={styles.recommendation} numberOfLines={2}>{recommendation}</Text>

            <Text style={[styles.link, { color: style.borderColor }]}>Vezi analiza completă →</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 16,
        borderLeftWidth: 4,
        marginBottom: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    warningIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
        flex: 1,
    },
    barContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    barBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#21262d',
        borderRadius: 3,
        overflow: 'hidden',
        marginRight: 10,
    },
    barFill: {
        height: 6,
        borderRadius: 3,
    },
    barLabel: {
        fontSize: 13,
        fontWeight: '800',
        minWidth: 36,
        textAlign: 'right',
    },
    details: {
        marginBottom: 10,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    detailLabel: {
        fontSize: 12,
        color: '#8b949e',
    },
    detailValue: {
        fontSize: 12,
        color: '#c9d1d9',
        fontWeight: '600',
    },
    recommendation: {
        fontSize: 12,
        color: '#8b949e',
        fontStyle: 'italic',
        marginBottom: 10,
        lineHeight: 17,
    },
    link: {
        fontSize: 12,
        fontWeight: '600',
    },
});

export default PredictionCard;
