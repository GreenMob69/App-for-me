import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EcoScoreBadge = ({ score = 100, size = 'normal' }) => {
    let badgeColor = '#3fb950'; // Verde (Optim)
    let label = 'EXCELENT';

    if (score < 80 && score >= 60) {
        badgeColor = '#d29922'; // Galben (Moderat)
        label = 'MODERAT';
    } else if (score < 60) {
        badgeColor = '#f85149'; // Roșu (Agresiv)
        label = 'AGRESIV';
    }

    const isLarge = size === 'large';

    return (
        <View style={[styles.container, { borderColor: badgeColor, backgroundColor: `${badgeColor}15` }]}>
            <Text style={[styles.scoreText, { color: badgeColor, fontSize: isLarge ? 28 : 18 }]}>
                {score} <Text style={{ fontSize: isLarge ? 14 : 10 }}>pct</Text>
            </Text>
            <Text style={[styles.labelText, { color: badgeColor }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center'
    },
    scoreText: {
        fontWeight: '900'
    },
    labelText: {
        fontSize: 9,
        fontWeight: 'bold',
        marginTop: 2,
        letterSpacing: 0.5
    }
});

export default EcoScoreBadge;