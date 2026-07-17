import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { t } from '../i18n';
import { colors, typography, radii, spacing, motion } from '../theme';
import PropTypes from 'prop-types';

const CalmState = ({ lastTrip }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: motion.duration.slow,
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
        backgroundColor: colors.tint.good,
        borderRadius: radii.md,
        padding: spacing[6],
        marginBottom: spacing[3],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(52,209,114,0.15)', // optical: bordura good la 15% — mai vizibilă decât tint.good (8%) pe fundal întunecat
    },
    iconRow: {
        marginBottom: spacing[3],
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: radii.full,
        backgroundColor: colors.status.good,
    },
    message: {
        fontSize: typography.sizes.body2,
        color: colors.text.primary,
        textAlign: 'center',
        lineHeight: typography.lineHeights.body2,
    },
    detail: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        textAlign: 'center',
        marginTop: spacing[2],
    },
});

export default CalmState;

CalmState.propTypes = {
    lastTrip: PropTypes.shape({
        text: PropTypes.string,
    }),
};
