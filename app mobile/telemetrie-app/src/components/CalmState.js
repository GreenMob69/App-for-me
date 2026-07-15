import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';

const CalmState = ({ lastTrip }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            delay: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <View style={styles.iconRow}>
                <View style={styles.dot} />
            </View>
            <Text style={styles.message}>{t('calm.message')}</Text>
            {lastTrip && (
                <Text style={styles.detail}>
                    {t('calm.lastCheck', { date: lastTrip.text })}
                </Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(63,185,80,0.04)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(63,185,80,0.15)',
    },
    iconRow: {
        marginBottom: 12,
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#3fb950',
    },
    message: {
        fontSize: 14,
        color: '#c9d1d9',
        textAlign: 'center',
        lineHeight: 20,
    },
    detail: {
        fontSize: 12,
        color: '#8b949e',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default CalmState;
