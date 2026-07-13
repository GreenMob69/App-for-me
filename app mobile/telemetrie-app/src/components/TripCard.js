import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const TripCard = ({ id, date, km = 0, consum = 0, medie = 0, scor = 100, onPress }) => {
    const isGoodScore = scor >= 80;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.tripId}>SESIUNEA #{id}</Text>
                    <Text style={styles.tapHint}>👆 Atinge pentru diagnoză</Text>
                </View>
                <Text style={styles.date}>{date}</Text>
            </View>

            <View style={styles.grid}>
                <View>
                    <Text style={styles.label}>DISTANȚĂ</Text>
                    <Text style={styles.val}>{km} <Text style={styles.unit}>km</Text></Text>
                </View>
                <View>
                    <Text style={styles.label}>CONSUM TOTAL</Text>
                    <Text style={styles.val}>{consum} <Text style={styles.unit}>L</Text></Text>
                </View>
                <View>
                    <Text style={styles.label}>MEDIE 100KM</Text>
                    <Text style={styles.val}>{medie} <Text style={styles.unit}>L</Text></Text>
                </View>
                <View>
                    <Text style={styles.label}>SCOR ECO</Text>
                    <Text style={[styles.val, { color: isGoodScore ? '#3fb950' : '#f85149' }]}>
                        {scor} <Text style={styles.unit}>pct</Text>
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#161b22',
        borderRadius: 10,
        padding: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#30363d'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#21262d',
        paddingBottom: 10,
        marginBottom: 12
    },
    tripId: {
        color: '#58a6ff',
        fontWeight: 'bold',
        fontSize: 14
    },
    tapHint: {
        color: '#8b949e',
        fontSize: 10
    },
    date: {
        color: '#8b949e',
        fontSize: 12
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    label: {
        fontSize: 10,
        color: '#8b949e',
        fontWeight: 'bold',
        marginBottom: 4
    },
    val: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff'
    },
    unit: {
        fontSize: 11,
        color: '#8b949e',
        fontWeight: 'normal'
    }
});

export default TripCard;