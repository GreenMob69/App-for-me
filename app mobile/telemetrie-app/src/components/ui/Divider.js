/**
 * Divider — linie de separare orizontală sau verticală.
 *
 * Responsabilitate: delimitare vizuală ușoară între secțiuni sau elemente.
 * Poate afișa un label centrat (ex: 'SAU', 'MAI MULT').
 *
 * @prop {'horizontal'|'vertical'}  orientation   default: 'horizontal'
 * @prop {string}   label          text centrat pe linie (doar horizontal)
 * @prop {'subtle'|'default'|'strong'}  strength   intensitatea liniei
 * @prop {number}   spacing        marginile verticale (horizontal) sau orizontale (vertical)
 * @prop {object}   style          override pentru container
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing as s } from '../../theme';

const BORDER_COLOR = {
    subtle:  colors.border.subtle,
    default: colors.border.default,
    strong:  colors.border.strong,
};

const Divider = React.memo(({
    orientation = 'horizontal',
    label,
    strength = 'default',
    spacing: spacingProp,
    style,
}) => {
    const lineColor = BORDER_COLOR[strength] || BORDER_COLOR.default;

    if (orientation === 'vertical') {
        return (
            <View
                style={[
                    styles.vertical,
                    { borderLeftColor: lineColor, marginHorizontal: spacingProp ?? s[2] },
                    style,
                ]}
            />
        );
    }

    if (label) {
        return (
            <View style={[styles.horizontal, { marginVertical: spacingProp ?? s[3] }, style]}>
                <View style={[styles.line, { backgroundColor: lineColor, flex: 1 }]} />
                <Text style={styles.labelText}>{label}</Text>
                <View style={[styles.line, { backgroundColor: lineColor, flex: 1 }]} />
            </View>
        );
    }

    return (
        <View
            style={[
                styles.line,
                { backgroundColor: lineColor, marginVertical: spacingProp ?? s[3] },
                style,
            ]}
        />
    );
});

Divider.displayName = 'Divider';

const styles = StyleSheet.create({
    line: {
        height: 1,
    },
    horizontal: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vertical: {
        alignSelf: 'stretch',
        borderLeftWidth: 1,
    },
    labelText: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
        fontWeight: typography.weights.semibold,
        marginHorizontal: s[3],
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});

export default Divider;
