import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const LiveGauge = ({ title, value, unit, color = '#ffffff', subtitle, isLarge = false }) => {
    return (
        <View style={[styles.card, isLarge && styles.cardLarge, { borderColor: color === '#ffffff' ? '#30363d' : color }]}>
            <Text style={styles.title}>{title}</Text>
            <Text style={[styles.value, isLarge && styles.valueLarge, { color: color }]}>
                {value !== undefined && value !== null ? value : 0} <Text style={[styles.unit, isLarge && styles.unitLarge]}>{unit}</Text>
            </Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161b22',
        width: '48%',
        padding: 16,
        borderRadius: 10,
        marginBottom: 16,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    cardLarge: {
        width: '100%',
        paddingVertical: 24
    },
    title: {
        fontSize: 10,
        color: '#8b949e',
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        textTransform: 'uppercase'
    },
    value: {
        fontSize: 26,
        fontWeight: '800'
    },
    valueLarge: {
        fontSize: 42,
        fontWeight: '900'
    },
    unit: {
        fontSize: 13,
        color: '#8b949e',
        fontWeight: 'normal'
    },
    unitLarge: {
        fontSize: 16,
        color: '#58a6ff'
    },
    subtitle: {
        fontSize: 10,
        color: '#8b949e',
        marginTop: 4,
        textAlign: 'center'
    }
});

export default LiveGauge;