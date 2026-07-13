import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const AlertItem = ({ type, desc, valoare, time, severity = 'WARNING' }) => {
    const isCritical = severity === 'CRITICAL';
    const accentColor = isCritical ? '#f85149' : '#d29922';

    return (
        <View style={[styles.card, { borderLeftColor: accentColor }]}>
            <View style={styles.topRow}>
                <Text style={[styles.typeText, { color: accentColor }]}>{type}</Text>
                {time && <Text style={styles.timeText}>{time}</Text>}
            </View>
            <Text style={styles.descText}>{desc}</Text>
            {valoare !== undefined && (
                <Text style={styles.valText}>Valoare înregistrată: {valoare}</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161b22',
        padding: 12,
        borderRadius: 6,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#30363d',
        borderLeftWidth: 4
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    typeText: {
        fontSize: 12,
        fontWeight: 'bold'
    },
    timeText: {
        fontSize: 10,
        color: '#8b949e'
    },
    descText: {
        color: '#c9d1d9',
        fontSize: 12,
        lineHeight: 16
    },
    valText: {
        color: '#8b949e',
        fontSize: 11,
        marginTop: 6,
        fontStyle: 'italic'
    }
});

export default AlertItem;