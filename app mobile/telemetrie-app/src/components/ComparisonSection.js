import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';

const TREND_INDICATORS = {
    stable: { color: '#8b949e', symbol: '—' },
    improving: { color: '#3fb950', symbol: '↑' },
    declining: { color: '#f0883e', symbol: '↓' },
    warning: { color: '#d29922', symbol: '↓' },
};

const ComparisonSection = ({ comparison }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: 150,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!comparison) return null;

    const indicator = TREND_INDICATORS[comparison.trend] || TREND_INDICATORS.stable;

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Text style={styles.sectionLabel}>{t('comparison.sectionTitle')}</Text>
            <View style={styles.content}>
                <View style={styles.indicatorRow}>
                    <Text style={[styles.indicator, { color: indicator.color }]}>{indicator.symbol}</Text>
                    <Text style={styles.summary}>{comparison.summary}</Text>
                </View>
                {comparison.detail && (
                    <Text style={styles.detail}>{comparison.detail}</Text>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8b949e',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    content: {
        gap: 8,
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    indicator: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 1,
    },
    summary: {
        flex: 1,
        fontSize: 14,
        color: '#c9d1d9',
        lineHeight: 20,
    },
    detail: {
        fontSize: 13,
        color: '#8b949e',
        lineHeight: 19,
        marginLeft: 26,
    },
});

export default ComparisonSection;
