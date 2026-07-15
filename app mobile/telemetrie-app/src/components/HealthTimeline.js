import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

const getPointColor = (value) => {
    if (value >= 85) return '#3fb950';
    if (value >= 60) return '#d29922';
    return '#f85149';
};

const HealthTimeline = ({ timeline, onPointPress }) => {
    if (!timeline || timeline.length < 2) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Efectuează cel puțin 3 curse pentru a vedea evoluția</Text>
            </View>
        );
    }

    const data = timeline.map((point, index) => ({
        value: point.health,
        label: point.date ? point.date.slice(5) : `#${index + 1}`,
        dataPointColor: getPointColor(point.health),
        customDataPoint: () => (
            <View style={[styles.dot, { backgroundColor: getPointColor(point.health) }]} />
        ),
    }));

    const minVal = Math.min(...timeline.map(p => p.health));
    const maxVal = Math.max(...timeline.map(p => p.health));
    const yMin = Math.max(0, minVal - 10);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Evoluție Health Score</Text>
                <Text style={styles.subtitle}>Ultimele {timeline.length} curse</Text>
            </View>
            <LineChart
                data={data}
                width={280}
                height={120}
                spacing={280 / Math.max(data.length - 1, 1)}
                color="#58a6ff"
                thickness={2}
                hideRules
                yAxisColor="transparent"
                xAxisColor="#30363d"
                yAxisTextStyle={{ color: '#8b949e', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#8b949e', fontSize: 9, width: 40, textAlign: 'center' }}
                hideYAxisText
                dataPointsRadius={5}
                dataPointsColor="#58a6ff"
                curved
                startFillColor="rgba(88, 166, 255, 0.15)"
                endFillColor="rgba(88, 166, 255, 0.01)"
                areaChart
                pointerConfig={{
                    pointerStripColor: '#58a6ff',
                    pointerStripWidth: 1,
                    pointerColor: '#58a6ff',
                    radius: 6,
                    pointerLabelWidth: 100,
                    pointerLabelHeight: 40,
                    pointerLabelComponent: (items) => {
                        const item = items[0];
                        return (
                            <View style={styles.tooltip}>
                                <Text style={styles.tooltipText}>{item.value}%</Text>
                            </View>
                        );
                    },
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
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 16,
        borderColor: '#30363d',
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 13,
        fontWeight: '700',
        color: '#c9d1d9',
    },
    subtitle: {
        fontSize: 11,
        color: '#8b949e',
    },
    emptyContainer: {
        backgroundColor: '#161b22',
        borderRadius: 12,
        padding: 24,
        borderColor: '#30363d',
        borderWidth: 1,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#8b949e',
        textAlign: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    tooltip: {
        backgroundColor: '#21262d',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderColor: '#58a6ff',
        borderWidth: 1,
    },
    tooltipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default HealthTimeline;
