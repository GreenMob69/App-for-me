import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { t } from '../i18n';
import { colors, typography, radii, spacing, layout } from '../theme';
import { getSubsystemColor } from '../utils/statusUtils';
import PropTypes from 'prop-types';

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

    const latestPoint = timeline[timeline.length - 1];
    const latestHealth = latestPoint?.health ?? 100;
    const latestColor = getSubsystemColor(latestHealth);

    const healthVals = timeline.map(p => p.health);
    const maxVal = Math.max(...healthVals);
    const minVal = Math.min(...healthVals);
    const avgVal = Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length);

    const statusLabel = latestHealth >= 80 ? 'STARE BUNĂ' : latestHealth >= 60 ? 'MONITORIZARE' : 'ATENȚIE';

    const data = timeline.map((point, index) => ({
        value: point.health,
        label: point.date ? point.date.slice(5) : `#${index + 1}`,
        date: point.date,
        dataPointColor: getSubsystemColor(point.health),
        customDataPoint: () => (
            <View style={[styles.dot, { backgroundColor: getSubsystemColor(point.health) }]} />
        ),
    }));

    const yMin = Math.max(0, minVal - 15);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>{t('healthTimeline.title')}</Text>
                    <Text style={styles.subtitle}>{t('healthTimeline.lastN', { n: timeline.length })}</Text>
                </View>
                <View style={[styles.statusBadge, { borderColor: latestColor, backgroundColor: `${latestColor}15` }]}>
                    <View style={[styles.statusDot, { backgroundColor: latestColor }]} />
                    <Text style={[styles.statusText, { color: latestColor }]}>
                        {latestHealth}% · {statusLabel}
                    </Text>
                </View>
            </View>

            {/* Mini Bento Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: colors.status.good, borderLeftWidth: 2 }]}>
                    <Text style={styles.statLabel}>🔺 MAX</Text>
                    <Text style={[styles.statVal, { color: colors.status.good }]}>{maxVal}%</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: minVal < 60 ? colors.status.critical : colors.status.caution, borderLeftWidth: 2 }]}>
                    <Text style={styles.statLabel}>🔻 MIN</Text>
                    <Text style={[styles.statVal, { color: minVal < 60 ? colors.status.critical : colors.text.primary }]}>{minVal}%</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.accent.default, borderLeftWidth: 2 }]}>
                    <Text style={styles.statLabel}>📊 MEDIE</Text>
                    <Text style={styles.statVal}>{avgVal}%</Text>
                </View>
            </View>

            <LineChart
                data={data}
                width={chartWidth}
                height={125}
                spacing={chartWidth / Math.max(data.length - 1, 1)}
                color={latestColor}
                thickness={2.5}
                yAxisColor="transparent"
                xAxisColor="rgba(56, 189, 248, 0.25)"
                rulesColor="rgba(56, 189, 248, 0.1)"
                rulesType="dashed"
                yAxisTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro }}
                xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: typography.sizes.micro - 1, width: 44, textAlign: 'center' }}
                hideYAxisText
                dataPointsRadius={4}
                dataPointsColor={latestColor}
                curved
                startFillColor={latestColor}
                endFillColor="rgba(0, 0, 0, 0.01)"
                startOpacity={0.35}
                endOpacity={0.02}
                areaChart
                pointerConfig={{
                    pointerStripColor: 'rgba(56, 189, 248, 0.5)',
                    pointerStripWidth: 2,
                    pointerColor: latestColor,
                    radius: 5,
                    pointerLabelWidth: 80,
                    pointerLabelHeight: 34,
                    activatePointersOnLongPress: false,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items) => (
                        <View style={styles.tooltip}>
                            <Text style={[styles.tooltipText, { color: getSubsystemColor(items[0].value) }]}>
                                {items[0].value}%
                            </Text>
                            {items[0].date && (
                                <Text style={styles.tooltipDate}>{items[0].date}</Text>
                            )}
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
        marginBottom: spacing[2],
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 3,
        borderRadius: radii.full,
        borderWidth: 1,
        gap: 5,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: radii.full,
    },
    statusText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.bg[2],
        borderRadius: radii.sm,
        padding: spacing[2],
        borderWidth: 1,
        borderColor: colors.border.subtle,
    },
    statLabel: {
        fontSize: 8,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    statVal: {
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
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
        paddingVertical: 3,
        borderColor: colors.border.default,
        borderWidth: 1,
        alignItems: 'center',
    },
    tooltipText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    tooltipDate: {
        fontSize: 7,
        color: colors.text.secondary,
        marginTop: 1,
    },
});

export default HealthTimeline;

HealthTimeline.propTypes = {
    timeline: PropTypes.arrayOf(PropTypes.shape({
        health: PropTypes.number,
        date: PropTypes.string,
    })),
};
