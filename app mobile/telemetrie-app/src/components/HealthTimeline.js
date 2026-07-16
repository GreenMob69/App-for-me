import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';

const HealthTimeline = ({ timeline }) => {
    const { width: screenWidth } = useWindowDimensions();
    const chartWidth = screenWidth - layout.screenPaddingH * 2 - spacing[4] * 2;

    if (!timeline || timeline.length < 2) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('healthTimeline.emptyHint')}</Text>
            </View>
        );
    }

    const data = timeline.map((point, index) => ({
        value: point.health,
        label: point.date ? point.date.slice(5) : `#${index + 1}`,
        dataPointColor: getSubsystemColor(point.health),
        customDataPoint: () => (
            <View style={[styles.dot, { backgroundColor: getSubsystemColor(point.health) }]} />
        ),
    }));

    const minVal = Math.min(...timeline.map(p => p.health));
    const yMin = Math.max(0, minVal - 10);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('healthTimeline.title')}</Text>
                <Text style={styles.subtitle}>{t('healthTimeline.lastN', { n: timeline.length })}</Text>
            </View>
            <LineChart
                data={data}
                width={chartWidth}
                height={120}
                spacing={chartWidth / Math.max(data.length - 1, 1)}
                color={colors.accent.default}
                thickness={2}
                hideRules
                yAxisColor="transparent"
                xAxisColor={colors.border.default}
                yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro }}
                xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1, width: 40, textAlign: 'center' }}
                hideYAxisText
                dataPointsRadius={5}
                dataPointsColor={colors.accent.default}
                curved
                startFillColor={colors.accent.muted}
                endFillColor="rgba(77,142,245,0.01)"
                areaChart
                pointerConfig={{
                    pointerStripColor: colors.accent.default,
                    pointerStripWidth: 1,
                    pointerColor: colors.accent.default,
                    radius: 6,
                    pointerLabelWidth: 60,
                    pointerLabelHeight: 32,
                    pointerLabelComponent: (items) => (
                        <View style={styles.tooltip}>
                            <Text style={styles.tooltipText}>{items[0].value}%</Text>
                        </View>
                    ),
                }}
                noOfSections={3}
                maxValue={100}
                yAxisOffset={yMin}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[4],
        borderColor: colors.border.default,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    title: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
    },
    emptyContainer: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        padding: spacing[6],
        borderColor: colors.border.default,
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.label1,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
    },
    tooltip: {
        backgroundColor: colors.bg[2],
        borderRadius: radii.xs,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderColor: colors.accent.default,
        borderWidth: 1,
    },
    tooltipText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
});

export default HealthTimeline;
