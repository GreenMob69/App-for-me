import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { t } from '../i18n';
import { typography, radii, spacing } from '../theme';
import { CONFIDENCE_STYLES } from '../utils/statusUtils';
import PropTypes from 'prop-types';

const ConfidenceBadge = ({ level = 'MEDIUM' }) => {
    const style = CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.MEDIUM;
    const label = t(`confidence.${level}`);

    return (
        <View style={[styles.container, { backgroundColor: style.bg, borderColor: style.color }]}>
            <View style={[styles.dot, { backgroundColor: style.color }]} />
            <Text style={[styles.label, { color: style.color }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: spacing[1] + 1,
        borderRadius: radii.md,
        borderWidth: 1,
        gap: spacing[1] + 2,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: radii.full,
    },
    label: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.semibold,
    },
});

export default ConfidenceBadge;

ConfidenceBadge.propTypes = {
    level: PropTypes.string,
};
