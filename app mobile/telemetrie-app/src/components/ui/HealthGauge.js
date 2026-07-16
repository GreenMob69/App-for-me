/**
 * HealthGauge — indicator circular SVG pentru scorul de sănătate.
 *
 * Responsabilitate: vizualizează un scor 0-100 ca arc animat.
 * Versiunea din ui/ este generic și independent de i18n/context;
 * primește toate datele prin props. Animația arc-ului se face pe
 * JS thread (SVG nu suportă nativeDriver).
 *
 * @prop {number}  score          scorul de afișat (0-100, required)
 * @prop {string}  label          eticheta sub valoare (ex: 'SĂNĂTATE')
 * @prop {string}  subtitle       text descriptiv sub label
 * @prop {'sm'|'md'|'lg'|'xl'}  size
 * @prop {boolean} animate        animează arcul la mount (default true)
 * @prop {boolean} loading        afișează placeholder circular
 * @prop {object}  style
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, spacing, motion } from '../../theme';
import { getHealthColor } from '../../utils/statusUtils';
import Skeleton from './Skeleton';

const SIZES = {
    sm: { total: 120, stroke: 8  },
    md: { total: 180, stroke: 12 },
    lg: { total: 240, stroke: 16 },
    xl: { total: 300, stroke: 20 },
};

const VALUE_FONT = {
    sm: typography.sizes.title2,
    md: typography.sizes.hero,
    lg: typography.sizes.display,
    xl: typography.sizes.display,
};

// Semicircle arc: π → 2π (left through bottom to right)
const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const HealthGauge = React.memo(({
    score,
    label,
    subtitle,
    size = 'md',
    animate = true,
    loading = false,
    style,
}) => {
    const { total, stroke } = SIZES[size];
    const [displayScore, setDisplayScore] = useState(animate ? 0 : (score ?? 0));
    const animScore = useRef(new Animated.Value(animate ? 0 : (score ?? 0))).current;

    useEffect(() => {
        if (score === null || score === undefined) return;

        if (!animate) {
            setDisplayScore(score);
            return;
        }

        animScore.setValue(0);
        const listenerId = animScore.addListener(({ value }) => setDisplayScore(value));
        Animated.timing(animScore, {
            toValue: score,
            duration: motion.duration.reveal,
            useNativeDriver: false,
        }).start();
        return () => animScore.removeListener(listenerId);
    }, [score, animate, animScore]);

    if (loading) {
        return (
            <View style={[styles.container, style]}>
                <Skeleton variant="circle" height={total * 0.6} width={total} />
                <Skeleton variant="text" height={typography.sizes.body2} width={80} style={styles.loadingLabel} />
            </View>
        );
    }

    const radius = (total - stroke) / 2 - spacing[2];
    const cx = total / 2;
    const cy = total / 2 + spacing[2];
    const svgHeight = total * 0.6;

    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;
    const progressAngle = startAngle + (displayScore / 100) * Math.PI;

    const trackPath = describeArc(cx, cy, radius, startAngle, endAngle);
    const fillPath  = displayScore > 0
        ? describeArc(cx, cy, radius, startAngle, progressAngle)
        : '';

    const color = getHealthColor(score ?? 0);
    const displayValue = score !== null && score !== undefined ? Math.round(displayScore) : '--';

    return (
        <View style={[styles.container, style]}>
            <View style={{ width: total, height: svgHeight, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Svg width={total} height={svgHeight} style={styles.svg}>
                    <Path
                        d={trackPath}
                        stroke={colors.border.strong}
                        strokeWidth={stroke}
                        fill="none"
                        strokeLinecap="round"
                    />
                    {fillPath ? (
                        <Path
                            d={fillPath}
                            stroke={color}
                            strokeWidth={stroke}
                            fill="none"
                            strokeLinecap="round"
                        />
                    ) : null}
                </Svg>

                <View style={styles.scoreRow}>
                    <Text style={[styles.scoreValue, { fontSize: VALUE_FONT[size], color }, styles.tabular]}>
                        {displayValue}
                    </Text>
                    {typeof displayValue === 'number' && (
                        <Text style={[styles.scoreUnit, { color }]}>%</Text>
                    )}
                </View>
            </View>

            {label ? (
                <Text style={[styles.label, styles[`label_${size}`]]}>{label.toUpperCase()}</Text>
            ) : null}
            {subtitle ? (
                <Text style={[styles.subtitle, { color }]}>{subtitle}</Text>
            ) : null}
        </View>
    );
});

HealthGauge.displayName = 'HealthGauge';

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    svg: {
        position: 'absolute',
        top: 0,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: spacing[1],
    },
    scoreValue: {
        fontWeight: typography.weights.heavy,
    },
    scoreUnit: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        marginLeft: spacing[1] - 1,
        marginBottom: 2,
    },
    tabular: { fontVariant: ['tabular-nums'] },
    label: {
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        letterSpacing: 1.5,
        marginTop: spacing[1],
    },
    label_sm: { fontSize: typography.sizes.micro },
    label_md: { fontSize: typography.sizes.caption },
    label_lg: { fontSize: typography.sizes.label2 },
    label_xl: { fontSize: typography.sizes.label1 },
    subtitle: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.medium,
        marginTop: spacing[1] + 2,
        textAlign: 'center',
        paddingHorizontal: spacing[4],
    },
    loadingLabel: { marginTop: spacing[2] },
});

export default HealthGauge;
