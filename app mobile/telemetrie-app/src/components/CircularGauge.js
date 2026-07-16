import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography, spacing } from '../theme';

const CircularGauge = ({ label, value, unit, min = 0, max = 100, color = colors.accent.default, size = 130 }) => {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const safeValue = Math.min(Math.max(Number(value) || 0, min), max);
    const percent = ((safeValue - min) / (max - min)) * 100;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <View style={styles.container}>
            <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
                <Svg width={size} height={size} style={{ position: 'absolute' }}>
                    <Circle
                        stroke={colors.border.strong}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
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
                        rotation="-90"
                        originX={size / 2}
                        originY={size / 2}
                    />
                </Svg>
                <Text style={[styles.valText, { color }, styles.tabular]} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                </Text>
                <Text style={styles.unitText}>{unit}</Text>
            </View>
            <Text style={styles.labelText}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: spacing[2] + 2,
        width: '48%',
    },
    valText: {
        fontSize: typography.sizes.hero - 8,
        fontWeight: typography.weights.heavy,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    unitText: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        marginTop: -2,
    },
    labelText: {
        fontSize: typography.sizes.micro,
        color: colors.text.primary,
        fontWeight: typography.weights.bold,
        marginTop: spacing[2] + 2,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default CircularGauge;
