import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

// Fade-in pe mount — pentru componente individuale (list items, modals, cards)
export function useFadeIn(delay = 0, duration = 400) {
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration,
            delay,
            useNativeDriver: true,
        }).start();
    }, []);
    return { opacity };
}

// Slide-up + fade-in pe mount — pentru conținut principal de ecran
export function useSlideIn(fromY = 16, delay = 0) {
    const opacity   = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(fromY)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
        ]).start();
    }, []);
    return { opacity, transform: [{ translateY }] };
}

// Press scale — pentru butoane și carduri apăsabile
export function usePressScale(toScale = 0.97) {
    const scale = useRef(new Animated.Value(1)).current;
    const onPressIn  = () =>
        Animated.timing(scale, { toValue: toScale, duration: 80,  useNativeDriver: true }).start();
    const onPressOut = () =>
        Animated.timing(scale, { toValue: 1,       duration: 140, useNativeDriver: true }).start();
    return { pressStyle: { transform: [{ scale }] }, onPressIn, onPressOut };
}

// Stagger fade — pentru liste de elemente care intră succesiv
export function useStaggerFade(count, baseDelay = 0, stagger = 60) {
    const anims = useRef(
        Array.from({ length: count }, () => new Animated.Value(0))
    ).current;
    useEffect(() => {
        Animated.stagger(
            stagger,
            anims.map(a =>
                Animated.timing(a, {
                    toValue: 1, duration: 350, delay: baseDelay, useNativeDriver: true,
                })
            )
        ).start();
    }, []);
    return anims.map(a => ({ opacity: a }));
}

// Screen transition — fade-in când screenState devine 'success'
export function useScreenFadeIn(screenState) {
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (screenState === 'success') {
            opacity.setValue(0);
            Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }
    }, [screenState]);
    return { opacity };
}
