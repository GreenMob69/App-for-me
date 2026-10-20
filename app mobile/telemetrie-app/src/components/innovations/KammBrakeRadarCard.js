'use strict';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { safeNum } from '../../utils/safeMath';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function KammBrakeRadarCard({
    variant = 'classic', // 'classic' | 'nothing' | 'audi'
    appLang = 'RO',
    telemetry = null,
    brakePyrometer = null,
}) {
    const isRu = appLang === 'RU';
    const isEn = appLang === 'EN';

    const isNothing = variant === 'nothing';
    const isAudi = variant === 'audi';

    const accentColor = isNothing ? '#FF3B00' : isAudi ? '#FF8800' : '#00E5FF';
    const cardBg = isNothing ? '#000000' : isAudi ? '#080302' : '#0B1320';
    const borderColor = isNothing ? '#222222' : isAudi ? '#2A0E08' : '#1E293B';

    const gLat = safeNum(telemetry?.gForceLat, 0.0);
    const gLong = safeNum(telemetry?.gForceLong, 0.0);
    const resultantG = Number(Math.sqrt(gLat * gLat + gLong * gLong).toFixed(2));
    const gripPct = Math.min(100, Math.round((resultantG / 1.1) * 100));

    // 4-Corner Brake temps (FL, FR, RL, RR)
    const baseTemp = safeNum(telemetry?.brakeFluidTemp, 90);
    const fl = brakePyrometer?.fl ?? Math.round(baseTemp + Math.abs(gLong) * 45 + (gLat > 0 ? 15 : 0));
    const fr = brakePyrometer?.fr ?? Math.round(baseTemp + Math.abs(gLong) * 45 + (gLat < 0 ? 15 : 0));
    const rl = brakePyrometer?.rl ?? Math.round(baseTemp * 0.85 + Math.abs(gLong) * 20);
    const rr = brakePyrometer?.rr ?? Math.round(baseTemp * 0.85 + Math.abs(gLong) * 20);

    const getPyroColor = (temp) => {
        if (temp > 280) return '#EF4444';
        if (temp > 180) return '#F59E0B';
        return '#10B981';
    };

    // Radar SVG center & radius
    const size = 90;
    const center = size / 2;
    const maxR = center - 8;

    // Map G-forces (-1.2G to +1.2G)
    const dotX = Math.max(8, Math.min(size - 8, center + (gLat / 1.2) * maxR));
    const dotY = Math.max(8, Math.min(size - 8, center - (gLong / 1.2) * maxR));

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: accentColor }]}>
                        ⭕ {isRu ? 'КРУГ КАММА И ТОРМОЗНОЙ ПИРОМЕТР' : isEn ? 'KAMM RADAR & BRAKE PYROMETER' : 'CERCUL KAMM & PIROMETRU FRÂNE'}
                    </Text>
                    <Text style={styles.sub}>
                        {isRu ? 'ПРЕДЕЛ СЦЕПЛЕНИЯ И ТЕМПЕРАТУРА 4 КОЛЕС' : isEn ? 'ADHESION LIMIT & 4-ROTOR HEAT' : 'ADERENȚĂ & TEMPERATURI 4 ROȚI'}
                    </Text>
                </View>
                <View style={[styles.gBadge, { borderColor: gripPct > 85 ? '#EF4444' : accentColor }]}>
                    <Text style={[styles.gBadgeText, { color: gripPct > 85 ? '#EF4444' : accentColor }]}>
                        {resultantG} G
                    </Text>
                </View>
            </View>

            {/* Split Content: Radar Kamm on left, 4-corner Pyrometer on right */}
            <View style={styles.contentRow}>
                {/* 2D Kamm Radar SVG */}
                <View style={styles.radarBox}>
                    <Svg width={size} height={size}>
                        {/* Outer 1.0G limit circle */}
                        <Circle
                            cx={center}
                            cy={center}
                            r={maxR}
                            fill="none"
                            stroke={gripPct > 85 ? '#EF4444' : '#334155'}
                            strokeWidth={gripPct > 85 ? 2 : 1}
                            strokeDasharray={gripPct > 85 ? undefined : '2, 2'}
                        />
                        {/* 0.5G inner circle */}
                        <Circle cx={center} cy={center} r={maxR * 0.5} fill="none" stroke="#1E293B" strokeWidth="1" />
                        {/* Axes */}
                        <Line x1={8} y1={center} x2={size - 8} y2={center} stroke="#1E293B" strokeWidth="1" />
                        <Line x1={center} y1={8} x2={center} y2={size - 8} stroke="#1E293B" strokeWidth="1" />

                        {/* Moving G-Force Dot */}
                        <Circle cx={dotX} cy={dotY} r="4.5" fill={gripPct > 85 ? '#EF4444' : accentColor} stroke="#FFFFFF" strokeWidth="1.5" />
                    </Svg>
                    <Text style={styles.radarMeta}>
                        {isRu ? 'Сцепление' : isEn ? 'Grip' : 'Aderență'}: {gripPct}%
                    </Text>
                </View>

                {/* 4-Corner Brake Heat Pyrometer */}
                <View style={styles.pyroContainer}>
                    <View style={styles.carOutlineBox}>
                        {/* Front Axle */}
                        <View style={styles.axleRow}>
                            <View style={[styles.cornerPill, { borderColor: getPyroColor(fl) }]}>
                                <Text style={styles.cornerLabel}>FL</Text>
                                <Text style={[styles.cornerVal, { color: getPyroColor(fl) }]}>{fl}°</Text>
                            </View>
                            <View style={styles.carSilhouetteMid} />
                            <View style={[styles.cornerPill, { borderColor: getPyroColor(fr) }]}>
                                <Text style={styles.cornerLabel}>FR</Text>
                                <Text style={[styles.cornerVal, { color: getPyroColor(fr) }]}>{fr}°</Text>
                            </View>
                        </View>

                        {/* Rear Axle */}
                        <View style={styles.axleRow}>
                            <View style={[styles.cornerPill, { borderColor: getPyroColor(rl) }]}>
                                <Text style={styles.cornerLabel}>RL</Text>
                                <Text style={[styles.cornerVal, { color: getPyroColor(rl) }]}>{rl}°</Text>
                            </View>
                            <View style={styles.carSilhouetteMid} />
                            <View style={[styles.cornerPill, { borderColor: getPyroColor(rr) }]}>
                                <Text style={styles.cornerLabel}>RR</Text>
                                <Text style={[styles.cornerVal, { color: getPyroColor(rr) }]}>{rr}°</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
        marginVertical: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        fontSize: 10.5,
        fontFamily: MONO,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    sub: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#64748B',
        marginTop: 1,
    },
    gBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: '#0F172A',
    },
    gBadgeText: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '900',
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 12,
    },
    radarBox: {
        alignItems: 'center',
    },
    radarMeta: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#94A3B8',
        marginTop: 2,
    },
    pyroContainer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    carOutlineBox: {
        gap: 8,
    },
    axleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    carSilhouetteMid: {
        flex: 1,
        height: 2,
        backgroundColor: '#1E293B',
        marginHorizontal: 8,
    },
    cornerPill: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: '#0A101D',
        alignItems: 'center',
        minWidth: 42,
    },
    cornerLabel: {
        fontSize: 7,
        fontFamily: MONO,
        color: '#64748B',
    },
    cornerVal: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        marginTop: 1,
    },
});
