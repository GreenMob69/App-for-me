import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent ? Animated.createAnimatedComponent(Path) : Path;

const getHealthColor = (score) => {
    if (score >= 90) return '#3fb950';
    if (score >= 75) return '#7ee787';
    if (score >= 60) return '#d29922';
    if (score >= 40) return '#f0883e';
    return '#f85149';
};

const getHealthMessage = (score, subsystems) => {
    if (score === null) return 'Se calculează...';
    if (score >= 90) return 'Vehiculul funcționează optim';
    if (score >= 75) {
        const degraded = Object.entries(subsystems || {}).find(([_, v]) => v.trend === 'DECREASING');
        if (degraded) return `Funcționare normală · ${degraded[0]} monitorizat`;
        return 'Funcționare normală';
    }
    if (score >= 60) {
        const warning = Object.entries(subsystems || {}).find(([_, v]) => v.score < 70);
        if (warning) return `Atenție: ${warning[0]} necesită verificare`;
        return 'Necesită atenție';
    }
    if (score >= 40) return 'Problemă activă detectată';
    return 'Stare critică — verificare urgentă';
};

const HealthGauge = ({ score, subsystems, size = 220 }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (score !== null && score !== undefined) {
            Animated.timing(animatedValue, {
                toValue: score,
                duration: 800,
                useNativeDriver: false,
            }).start();
        }
    }, [score]);

    const displayScore = score !== null ? score : '--';
    const color = getHealthColor(score || 0);
    const message = getHealthMessage(score, subsystems);

    const strokeWidth = 14;
    const radius = (size - strokeWidth) / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2 + 10;

    // Arc semicircular (180 grade)
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const progressAngle = startAngle + ((score || 0) / 100) * Math.PI;

    const describeArc = (startA, endA) => {
        const x1 = centerX + radius * Math.cos(startA);
        const y1 = centerY + radius * Math.sin(startA);
        const x2 = centerX + radius * Math.cos(endA);
        const y2 = centerY + radius * Math.sin(endA);
        const largeArc = endA - startA > Math.PI ? 1 : 0;
        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    const backgroundArc = describeArc(startAngle, endAngle);
    const progressArc = score > 0 ? describeArc(startAngle, progressAngle) : '';

    return (
        <View style={styles.container}>
            <View style={{ width: size, height: size * 0.6, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Svg width={size} height={size * 0.6} style={{ position: 'absolute', top: 0 }}>
                    <Path
                        d={backgroundArc}
                        stroke="#21262d"
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                    />
                    {progressArc ? (
                        <Path
                            d={progressArc}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            fill="none"
                            strokeLinecap="round"
                        />
                    ) : null}
                </Svg>
                <View style={styles.scoreContainer}>
                    <Text style={[styles.scoreText, { color }]}>{displayScore}</Text>
                    <Text style={styles.percentText}>%</Text>
                </View>
            </View>
            <Text style={styles.labelText}>Overall Health</Text>
            <Text style={[styles.messageText, { color }]}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 4,
    },
    scoreText: {
        fontSize: 52,
        fontWeight: '900',
    },
    percentText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#8b949e',
        marginLeft: 2,
    },
    labelText: {
        fontSize: 13,
        color: '#8b949e',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: 4,
    },
    messageText: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 6,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

export default HealthGauge;
