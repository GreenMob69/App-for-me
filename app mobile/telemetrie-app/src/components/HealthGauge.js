import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { t } from '../i18n';
import { colors, typography, spacing, motion } from '../theme';
import { getHealthColor } from '../utils/statusUtils';

const getHealthMessage = (score, subsystems) => {
    if (score === null) return t('states.loading');
    if (score >= 90) return t('status.excellent.message');
    if (score >= 75) {
        const degraded = Object.entries(subsystems || {}).find(([_, v]) => v.trend === 'DECREASING');
        if (degraded) return t('status.good.message');
        return t('status.good.message');
    }
    if (score >= 60) return t('status.attention.subtitleGeneral');
    if (score >= 40) return t('status.problem.subtitle');
    return t('status.critical.subtitle');
};

const HealthGauge = ({ score, subsystems, size = 220 }) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (score !== null && score !== undefined) {
            Animated.timing(animatedValue, {
                toValue: score,
                duration: motion.duration.reveal,
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
                        stroke={colors.border.strong}
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
                    <Text style={[styles.scoreText, { color }, styles.tabular]}>{displayScore}</Text>
                    <Text style={styles.percentText}>%</Text>
                </View>
            </View>
            <Text style={styles.labelText}>{t('health.overall').toUpperCase()}</Text>
            <Text style={[styles.messageText, { color }]}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: spacing[4],
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: spacing[1],
    },
    scoreText: {
        fontSize: typography.sizes.display,
        fontWeight: typography.weights.heavy,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    percentText: {
        fontSize: typography.sizes.title2,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        marginLeft: spacing[1] - 2,
    },
    labelText: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        letterSpacing: 1.5,
        marginTop: spacing[1],
    },
    messageText: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.medium,
        marginTop: spacing[1] + 2,
        textAlign: 'center',
        paddingHorizontal: spacing[5],
    },
});

export default HealthGauge;
