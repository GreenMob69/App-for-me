import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import ConfidenceBadge from './ConfidenceBadge';

const SEVERITY_COLORS = {
    info: '#58a6ff',
    warning: '#d29922',
    serious: '#f0883e',
    critical: '#f85149',
};

const ObservationCard = ({
    title,
    evidence,
    explanation,
    action,
    urgency,
    confidence,
    severity = 'info',
    estimateKm,
    estimateDays,
    onDetailPress,
    index = 0,
}) => {
    const [expanded, setExpanded] = useState(false);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(10)).current;
    const accentColor = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 400, delay: index * 100, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={[styles.container, { borderLeftColor: accentColor, opacity, transform: [{ translateY }] }]}>
            {/* Concluzia */}
            <Text style={styles.title}>{title}</Text>

            {/* Evidenta tehnica */}
            {evidence ? <Text style={styles.evidence}>{evidence}</Text> : null}

            {/* Explicatia — vizibila la expand */}
            {explanation ? (
                <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                    {expanded ? (
                        <Text style={styles.explanation}>{explanation}</Text>
                    ) : (
                        <Text style={styles.expandHint}>De ce spun asta...</Text>
                    )}
                </TouchableOpacity>
            ) : null}

            {/* Actiunea recomandata */}
            {action ? (
                <View style={styles.actionBox}>
                    <Text style={styles.actionLabel}>CE SA FACI:</Text>
                    <Text style={styles.actionText}>{action}</Text>
                </View>
            ) : null}

            {/* Footer: urgenta + estimare + confidence */}
            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    {urgency ? <Text style={[styles.urgency, { color: accentColor }]}>{urgency}</Text> : null}
                    {(estimateKm || estimateDays) ? (
                        <Text style={styles.estimate}>
                            {estimateKm ? `~${estimateKm} km` : ''}
                            {estimateKm && estimateDays ? ' / ' : ''}
                            {estimateDays ? `~${estimateDays} zile` : ''}
                        </Text>
                    ) : null}
                </View>
                {confidence ? <ConfidenceBadge level={confidence} /> : null}
            </View>

            {/* Link detalii */}
            {onDetailPress ? (
                <TouchableOpacity style={styles.detailLink} onPress={onDetailPress}>
                    <Text style={styles.detailLinkText}>Vezi detalii</Text>
                </TouchableOpacity>
            ) : null}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderWidth: 1,
        borderColor: '#30363d',
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: '#ffffff',
        lineHeight: 22,
        marginBottom: 6,
    },
    evidence: {
        fontSize: 12,
        color: '#8b949e',
        fontFamily: undefined,
        marginBottom: 8,
    },
    expandHint: {
        fontSize: 12,
        color: '#58a6ff',
        marginBottom: 8,
    },
    explanation: {
        fontSize: 13,
        color: '#c9d1d9',
        lineHeight: 19,
        marginBottom: 10,
    },
    actionBox: {
        backgroundColor: 'rgba(88,166,255,0.06)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    actionLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#8b949e',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    actionText: {
        fontSize: 13,
        color: '#ffffff',
        lineHeight: 19,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLeft: {
        flex: 1,
        gap: 2,
    },
    urgency: {
        fontSize: 12,
        fontWeight: '600',
    },
    estimate: {
        fontSize: 11,
        color: '#484f58',
    },
    detailLink: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#21262d',
    },
    detailLinkText: {
        fontSize: 12,
        color: '#58a6ff',
        fontWeight: '600',
    },
});

export default ObservationCard;
