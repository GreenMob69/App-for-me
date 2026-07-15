import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';
import ConfidenceBadge from './ConfidenceBadge';

const SEVERITY_COLORS = {
    info: '#58a6ff',
    warning: '#d29922',
    serious: '#f0883e',
    critical: '#f85149',
};

const UpcomingTimeline = ({ items }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 400,
            delay: 200,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!items || items.length === 0) return null;

    return (
        <Animated.View style={[styles.container, { opacity }]}>
            <Text style={styles.sectionLabel}>{t('upcoming.sectionTitle')}</Text>
            <View style={styles.timeline}>
                {items.map((item, index) => (
                    <TimelineItem key={index} item={item} isLast={index === items.length - 1} />
                ))}
            </View>
        </Animated.View>
    );
};

const TimelineItem = ({ item, isLast }) => {
    const accentColor = SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info;

    return (
        <View style={styles.itemRow}>
            {/* Timeline connector */}
            <View style={styles.connector}>
                <View style={[styles.dot, { backgroundColor: accentColor }]} />
                {!isLast && <View style={styles.line} />}
            </View>

            {/* Content */}
            <View style={styles.itemContent}>
                <Text style={styles.component}>{item.component}</Text>

                <View style={styles.timeframeRow}>
                    <Text style={[styles.timeframe, { color: accentColor }]}>{item.timeframe}</Text>
                </View>

                <Text style={styles.urgency}>{item.urgency}</Text>

                {item.reason && (
                    <Text style={styles.reason}>
                        {t('upcoming.whyPrefix')} {item.reason}
                    </Text>
                )}

                {item.recommendation && (
                    <Text style={styles.recommendation}>{item.recommendation}</Text>
                )}

                <View style={styles.footer}>
                    <ConfidenceBadge level={item.confidence} />
                </View>
            </View>
        </View>
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
        marginBottom: 16,
    },
    timeline: {
        gap: 0,
    },
    itemRow: {
        flexDirection: 'row',
    },
    connector: {
        width: 20,
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    line: {
        width: 1,
        flex: 1,
        backgroundColor: '#30363d',
        marginVertical: 4,
    },
    itemContent: {
        flex: 1,
        paddingLeft: 12,
        paddingBottom: 20,
    },
    component: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 4,
    },
    timeframeRow: {
        marginBottom: 4,
    },
    timeframe: {
        fontSize: 12,
        fontWeight: '600',
    },
    urgency: {
        fontSize: 13,
        color: '#c9d1d9',
        lineHeight: 19,
        marginBottom: 6,
    },
    reason: {
        fontSize: 12,
        color: '#8b949e',
        lineHeight: 17,
        marginBottom: 6,
    },
    recommendation: {
        fontSize: 13,
        color: '#c9d1d9',
        lineHeight: 19,
        marginBottom: 8,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default UpcomingTimeline;
