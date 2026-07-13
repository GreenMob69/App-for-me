import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const CircularGauge = ({ label, value, unit, min = 0, max = 100, color = '#58a6ff', size = 130 }) => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    // Calculăm cât la sută din cerc trebuie umplut
    const safeValue = Math.min(Math.max(Number(value) || 0, min), max);
    const percent = ((safeValue - min) / (max - min)) * 100;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <View style={styles.container}>
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Svg width={size} height={size} style={{ position: 'absolute' }}>
                    {/* Cercul de fundal (Gri închis) */}
                    <Circle
                        stroke="#21262d"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    {/* Cercul de progres (Colorat, animat vizual) */}
                    <Circle
                        stroke={color}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90" // Începe de sus
                        originX={size / 2}
                        originY={size / 2}
                    />
                </Svg>
                
                {/* Valorile din interiorul cercului */}
                <Text style={[styles.valText, { color }]} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                </Text>
                <Text style={styles.unitText}>{unit}</Text>
            </View>
            
            {/* Eticheta senzorului (sub cadran) */}
            <Text style={styles.labelText}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 10,
        width: '48%', // Pentru a intra câte 2 pe un rând
    },
    valText: {
        fontSize: 28,
        fontWeight: '900',
    },
    unitText: {
        fontSize: 12,
        color: '#8b949e',
        marginTop: -2,
    },
    labelText: {
        fontSize: 10,
        color: '#c9d1d9',
        fontWeight: 'bold',
        marginTop: 10,
        textAlign: 'center',
        textTransform: 'uppercase',
    }
});

export default CircularGauge;