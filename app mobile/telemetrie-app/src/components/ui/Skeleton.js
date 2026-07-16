/**
 * Skeleton — placeholder animat pentru conținut în curs de încărcare.
 *
 * Responsabilitate: simulează forma elementelor care urmează să apară,
 * reducând perceived lag. Animația shimmer folosește opacity loop.
 *
 * @prop {'text'|'rect'|'circle'|'card'}  variant   forma placeholder-ului
 * @prop {number}   width     lățimea (implicit: '100%' pentru text/rect/card)
 * @prop {number}   height    înălțimea (implicit per variant)
 * @prop {number}   lines     pt variant='text': numărul de linii (default 1)
 * @prop {boolean}  animate   activează animația (default true)
 * @prop {object}   style     override pentru container
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii, spacing, motion } from '../../theme';

const DEFAULT_HEIGHT = {
    text:   14,
    rect:   80,
    circle: 40,
    card:  100,
};

const Skeleton = React.memo(({
    variant = 'rect',
    width,
    height,
    lines = 1,
    animate = true,
    style,
}) => {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!animate) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.35,
                    duration: motion.duration.slow,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: motion.duration.slow,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [animate, opacity]);

    if (variant === 'text' && lines > 1) {
        return (
            <View style={style}>
                {Array.from({ length: lines }).map((_, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.base,
                            {
                                height: height || DEFAULT_HEIGHT.text,
                                width: i === lines - 1 ? '65%' : '100%',
                                borderRadius: radii.xs,
                                marginBottom: i < lines - 1 ? spacing[2] : 0,
                                opacity,
                            },
                        ]}
                    />
                ))}
            </View>
        );
    }

    const h = height || DEFAULT_HEIGHT[variant];
    const w = variant === 'circle' ? (width || h) : (width || '100%');

    const baseStyle = {
        height: h,
        width: w,
        borderRadius: variant === 'circle'
            ? (h / 2)
            : variant === 'card'
                ? radii.md
                : variant === 'text'
                    ? radii.xs
                    : radii.sm,
        opacity,
    };

    return <Animated.View style={[styles.base, baseStyle, style]} />;
});

Skeleton.displayName = 'Skeleton';

const styles = StyleSheet.create({
    base: {
        backgroundColor: colors.bg[3],
    },
});

export default Skeleton;
