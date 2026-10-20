'use strict';
import React from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { safeNum } from '../../utils/safeMath';

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function VirtualDynoDragCard({
    variant = 'classic', // 'classic' | 'nothing' | 'audi'
    appLang = 'RO',
    dynoData = null,
    dragBox = null,
    telemetry = null,
}) {
    const isRu = appLang === 'RU';
    const isEn = appLang === 'EN';

    const isNothing = variant === 'nothing';
    const isAudi = variant === 'audi';

    const accentColor = isNothing ? '#FF3B00' : isAudi ? '#FF8800' : '#00E5FF';
    const cardBg = isNothing ? '#000000' : isAudi ? '#080302' : '#0B1320';
    const borderColor = isNothing ? '#222222' : isAudi ? '#2A0E08' : '#1E293B';

    // SVG Dyno Dimensions
    const graphWidth = Math.min(SCREEN_WIDTH - 48, 380);
    const graphHeight = 110;

    const currentRpm = safeNum(telemetry?.rpm, 0);
    const currentHp = safeNum(dynoData?.currentHp ?? telemetry?.powerHp, 0);
    const currentNm = safeNum(dynoData?.currentNm ?? telemetry?.torqueNm, 0);

    const peakHp = dynoData?.peakHp || 142;
    const peakNm = dynoData?.peakNm || 310;

    // Scale helpers (RPM 1000-6000, HP/Nm 0-380)
    const mapX = (r) => Math.max(20, Math.min(graphWidth - 10, 20 + ((r - 1000) / 5000) * (graphWidth - 30)));
    const mapY = (v) => Math.max(10, Math.min(graphHeight - 15, graphHeight - 15 - (v / 380) * (graphHeight - 25)));

    // Generate dyno points
    const points = dynoData?.points || [
        { rpm: 1000, torqueNm: 150, powerHp: 21 },
        { rpm: 2000, torqueNm: 290, powerHp: 82 },
        { rpm: 3000, torqueNm: 310, powerHp: 132 },
        { rpm: 4000, torqueNm: 250, powerHp: 142 },
        { rpm: 5000, torqueNm: 180, powerHp: 128 },
    ];

    let hpPath = '';
    let nmPath = '';
    points.forEach((pt, i) => {
        const x = mapX(pt.rpm);
        const yHp = mapY(pt.powerHp);
        const yNm = mapY(pt.torqueNm);
        if (i === 0) {
            hpPath += `M ${x} ${yHp}`;
            nmPath += `M ${x} ${yNm}`;
        } else {
            hpPath += ` L ${x} ${yHp}`;
            nmPath += ` L ${x} ${yNm}`;
        }
    });

    const liveDotX = mapX(currentRpm);
    const liveDotYHp = mapY(currentHp);

    return (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: accentColor }]}>
                        ⚡ {isRu ? 'ВИРТУАЛЬНЫЙ ДИНО-СТЕНД' : isEn ? 'VIRTUAL DYNO CHASSIS' : 'STAND DYNO VIRTUAL'}
                    </Text>
                    <Text style={styles.sub}>
                        {isRu ? 'КРИВЫЕ МОЩНОСТИ И МОМЕНТА (SAE)' : isEn ? 'SAE J1349 HORSEPOWER & TORQUE' : 'CURBA DE CUPLU & PUTERE SAE'}
                    </Text>
                </View>
                <View style={[styles.peakBadge, { borderColor: accentColor }]}>
                    <Text style={[styles.peakText, { color: accentColor }]}>
                        {peakHp} CP / {peakNm} Nm
                    </Text>
                </View>
            </View>

            {/* SVG Dyno Graph */}
            <View style={styles.graphWrap}>
                <Svg width={graphWidth} height={graphHeight}>
                    {/* Grid lines */}
                    <Line x1="20" y1={graphHeight - 15} x2={graphWidth - 10} y2={graphHeight - 15} stroke="#1E293B" strokeWidth="1" />
                    <Line x1="20" y1="10" x2="20" y2={graphHeight - 15} stroke="#1E293B" strokeWidth="1" />
                    <Line x1="20" y1={mapY(200)} x2={graphWidth - 10} y2={mapY(200)} stroke="#1E293B" strokeDasharray="3, 3" strokeWidth="0.8" />

                    {/* Torque Curve (Yellow/Orange) */}
                    <Path d={nmPath} fill="none" stroke="#F59E0B" strokeWidth="2" />
                    {/* Power Curve (Accent) */}
                    <Path d={hpPath} fill="none" stroke={accentColor} strokeWidth="2.5" />

                    {/* Operating Live Dot */}
                    {currentRpm >= 800 && (
                        <Circle cx={liveDotX} cy={liveDotYHp} r="4" fill="#FFFFFF" stroke={accentColor} strokeWidth="2" />
                    )}

                    {/* Scale labels */}
                    <SvgText x="22" y="18" fill="#64748B" fontSize="7" fontFamily={MONO}>380</SvgText>
                    <SvgText x={graphWidth - 25} y={graphHeight - 4} fill="#64748B" fontSize="7" fontFamily={MONO}>6000</SvgText>
                </Svg>
            </View>

            {/* Live Readout Bar */}
            <View style={styles.readoutRow}>
                <View style={styles.readoutCell}>
                    <Text style={styles.readoutLabel}>{isRu ? 'МОЩНОСТЬ' : isEn ? 'POWER' : 'PUTERE'}</Text>
                    <Text style={[styles.readoutVal, { color: accentColor }]}>{currentHp} CP</Text>
                </View>
                <View style={styles.readoutCell}>
                    <Text style={styles.readoutLabel}>{isRu ? 'МОМЕНТ' : isEn ? 'TORQUE' : 'CUPLU'}</Text>
                    <Text style={[styles.readoutVal, { color: '#F59E0B' }]}>{currentNm} Nm</Text>
                </View>
                <View style={styles.readoutCell}>
                    <Text style={styles.readoutLabel}>{isRu ? 'ОБОРОТЫ' : isEn ? 'RPM' : 'TURAȚIE'}</Text>
                    <Text style={styles.readoutVal}>{currentRpm}</Text>
                </View>
            </View>

            {/* Performance Box Grid (0-100, 80-120, 100-0) */}
            <View style={styles.dragGrid}>
                <View style={styles.dragBox}>
                    <Text style={styles.dragLabel}>0–100 km/h</Text>
                    <Text style={[styles.dragVal, { color: '#10B981' }]}>{dragBox?.time0_100 || '7.82s'}</Text>
                </View>
                <View style={styles.dragBox}>
                    <Text style={styles.dragLabel}>80–120 km/h</Text>
                    <Text style={[styles.dragVal, { color: '#00E5FF' }]}>{dragBox?.time80_120 || '4.65s'}</Text>
                </View>
                <View style={styles.dragBox}>
                    <Text style={styles.dragLabel}>100–0 km/h</Text>
                    <Text style={[styles.dragVal, { color: '#F59E0B' }]}>{dragBox?.brake100_0 || '36.4m'}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        marginVertical: 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        fontSize: 11,
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
    peakBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        backgroundColor: '#0F172A',
    },
    peakText: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
    },
    graphWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
    },
    readoutRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    readoutCell: {
        flex: 1,
        backgroundColor: '#0F172A',
        borderRadius: 6,
        padding: 6,
        alignItems: 'center',
    },
    readoutLabel: {
        fontSize: 7,
        fontFamily: MONO,
        color: '#64748B',
        marginBottom: 2,
    },
    readoutVal: {
        fontSize: 12,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#F1F5F9',
    },
    dragGrid: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    dragBox: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        borderRadius: 6,
        paddingVertical: 5,
        alignItems: 'center',
    },
    dragLabel: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#94A3B8',
    },
    dragVal: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '900',
        marginTop: 1,
    },
});
