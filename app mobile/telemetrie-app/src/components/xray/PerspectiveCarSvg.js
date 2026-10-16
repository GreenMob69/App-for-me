'use strict';

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, {
    Path,
    Rect,
    Circle,
    G,
    Line,
    Defs,
    LinearGradient,
    Stop,
    Polygon,
    Ellipse,
} from 'react-native-svg';
import { colors, typography, radii } from '../../theme';
import { PERSPECTIVE_PINS } from './xrayConstants';

const PerspectiveCarSvg = ({
    liveData = {},
    selectedPinId = null,
    onSelectPin,
}) => {
    return (
        <View style={styles.container}>
            <Svg width="100%" height={290} viewBox="0 0 380 290">
                <Defs>
                    {/* Metal Car Body Gradient (Angled 3/4 Perspective) */}
                    <LinearGradient id="car3dBody" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#1e2e4a" stopOpacity="0.85" />
                        <Stop offset="0.5" stopColor="#0d1628" stopOpacity="0.95" />
                        <Stop offset="1" stopColor="#162238" stopOpacity="0.90" />
                    </LinearGradient>
                    <LinearGradient id="hoodCutaway" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#162842" stopOpacity="0.65" />
                        <Stop offset="1" stopColor="#09121f" stopOpacity="0.80" />
                    </LinearGradient>
                    <LinearGradient id="glass3d" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#25426b" stopOpacity="0.4" />
                        <Stop offset="1" stopColor="#070c17" stopOpacity="0.85" />
                    </LinearGradient>
                </Defs>

                {/* ── 1. SILUETĂ CAROSERIE PERSPECTIVĂ 3/4 (Stil Cutaway Audi) ── */}
                {/* Contur exterior caroserie sport sedan */}
                <Path
                    d="M 45 180 L 78 162 L 140 132 L 185 75 L 245 88 L 290 115 L 348 145 L 360 170 L 345 195 L 310 195 L 290 220 L 260 220 L 250 195 L 125 215 L 105 255 L 70 255 L 60 225 L 40 215 Z"
                    fill="url(#car3dBody)"
                    stroke="#2e486e"
                    strokeWidth="2"
                />

                {/* Capotă transparentă (Cutaway Hood) */}
                <Polygon
                    points="50,178 135,134 175,146 76,192"
                    fill="url(#hoodCutaway)"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                    strokeDasharray="4,2"
                />

                {/* Parbriz & Geamuri laterale 3D */}
                <Polygon
                    points="135,134 185,75 240,88 175,146"
                    fill="url(#glass3d)"
                    stroke="#4d8ef5"
                    strokeWidth="1.2"
                />
                <Polygon
                    points="185,75 285,110 280,140 178,145"
                    fill="url(#glass3d)"
                    stroke="#2e486e"
                    strokeWidth="1"
                />

                {/* Grilă frontală hexagonală Singleframe */}
                <Polygon
                    points="44,180 72,165 72,212 44,202"
                    fill="#080e18"
                    stroke="#00f0ff"
                    strokeWidth="1.5"
                />
                <Line x1="44" y1="190" x2="72" y2="180" stroke="#38bdf8" strokeWidth="1" />
                <Line x1="44" y1="198" x2="72" y2="190" stroke="#38bdf8" strokeWidth="1" />

                {/* Far LED Matrix unghiular */}
                <Polygon points="54,174 72,166 70,178 52,182" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1" />

                {/* ── 2. CABLAJ ELECTRIC WIRING HARNESS (Neon traces ca în poza de referință) ── */}
                {/* Traseu principal cablaj motor spre habitaclu */}
                <Path d="M 68 175 Q 110 155 145 140" stroke="#00f0ff" strokeWidth="2" fill="none" strokeDasharray="3,2" />
                <Path d="M 145 140 Q 185 145 220 155" stroke="#f59e0b" strokeWidth="2" fill="none" />
                {/* Cablaj de-a lungul pragului ușii spre spate */}
                <Path d="M 120 205 L 250 190 L 320 170" stroke="#10b981" strokeWidth="1.8" fill="none" />
                {/* Conexiune la panou siguranțe și ECU */}
                <Circle cx="165" cy="115" r="4" fill="#f59e0b" />
                <Line x1="165" y1="115" x2="145" y2="140" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2,2" />

                {/* ── 3. ROȚI & JANTE ÎN PERSPECTIVĂ 3D CU ETRIERE ROȘII ── */}
                {/* Roată Față-Stânga */}
                <Ellipse cx="88" cy="225" rx="22" ry="34" fill="#090d16" stroke="#3b5275" strokeWidth="2.5" />
                <Ellipse cx="88" cy="225" rx="14" ry="22" fill="#1b2434" stroke="#4d8ef5" strokeWidth="1.5" strokeDasharray="2,2" />
                <Rect x="82" y="210" width="8" height="18" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                {/* Roată Față-Dreapta (vizibilă sub bot) */}
                <Ellipse cx="165" cy="172" rx="12" ry="18" fill="#090d16" stroke="#25354d" strokeWidth="1.5" />

                {/* Roată Spate-Stânga */}
                <Ellipse cx="285" cy="195" rx="20" ry="30" fill="#090d16" stroke="#3b5275" strokeWidth="2.5" />
                <Ellipse cx="285" cy="195" rx="12" ry="18" fill="#1b2434" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2,2" />
                <Rect x="280" y="182" width="6" height="14" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                {/* ── 4. AGREGATE MECANICE VIZIBILE ÎN CUTAWAY ── */}
                {/* Bloc motor sub capotă */}
                <Polygon points="105,155 145,138 155,160 115,178" fill="#162740" stroke="#4d8ef5" strokeWidth="1.5" />
                {/* Turbină & Galeri evacuare */}
                <Circle cx="80" cy="175" r="11" fill="#241b18" stroke="#f97316" strokeWidth="1.8" />
                {/* Radiator & Ventilator */}
                <Polygon points="60,140 75,134 75,172 60,178" fill="#132438" stroke="#38bdf8" strokeWidth="1.2" />
                {/* Cutie de viteze în tunel */}
                <Polygon points="175,152 215,162 210,182 170,172" fill="#121b2b" stroke="#38547a" strokeWidth="1.5" />
                {/* Traseu eșapament & DPF */}
                <Path d="M 85 182 Q 130 190 200 178 L 260 175 L 340 180" stroke="#784824" strokeWidth="3" fill="none" />
                <Rect x="245" y="168" width="28" height="14" rx="4" fill="#261b17" stroke="#f97316" strokeWidth="1.5" />

                {/* ── 5. LINII FRÂNTE LEADER LINES CĂTRE CHIP-URILE DE LA SUPRAFAȚĂ ── */}
                {PERSPECTIVE_PINS.map(pin => {
                    const isSelected = selectedPinId === pin.id;
                    const col = isSelected ? '#00f0ff' : '#10b981';

                    return (
                        <G key={pin.id}>
                            {/* Linie frântă fină de ghidaj tehnic din pin spre etichetă */}
                            <Line
                                x1={pin.pin.x}
                                y1={pin.pin.y}
                                x2={pin.chip.x + 20}
                                y2={pin.chip.y + 12}
                                stroke={col}
                                strokeWidth={1}
                                strokeDasharray="2,2"
                                strokeOpacity={0.7}
                            />
                            {/* Hotspot cerc luminos pe mașină */}
                            {isSelected && (
                                <Circle
                                    cx={pin.pin.x}
                                    cy={pin.pin.y}
                                    r={14}
                                    fill={col}
                                    fillOpacity={0.18}
                                    stroke={col}
                                    strokeWidth={1.5}
                                    strokeDasharray="2,2"
                                />
                            )}
                            <Circle
                                cx={pin.pin.x}
                                cy={pin.pin.y}
                                r={8}
                                fill={col}
                                fillOpacity={0.3}
                                stroke={col}
                                strokeWidth={1.5}
                            />
                            <Circle
                                cx={pin.pin.x}
                                cy={pin.pin.y}
                                r={3.5}
                                fill={col}
                                stroke="#070c14"
                                strokeWidth={1.5}
                            />
                        </G>
                    );
                })}
            </Svg>

            {/* ── 6. CHIP-URI CU DETALII LA SUPRAFAȚĂ (Touchable direct pe ecran!) ── */}
            {PERSPECTIVE_PINS.map(pin => {
                const isSelected = selectedPinId === pin.id;
                const reading = pin.getReading ? pin.getReading(liveData) : { val: 'Nominal' };
                const leftPct = (pin.chip.x / 380) * 100;
                const topPct  = (pin.chip.y / 290) * 100;

                return (
                    <TouchableOpacity
                        key={pin.id}
                        activeOpacity={0.8}
                        style={[
                            styles.surfaceChip,
                            { left: `${leftPct}%`, top: `${topPct}%` },
                            isSelected && styles.surfaceChipSelected,
                        ]}
                        onPress={() => onSelectPin && onSelectPin(pin)}
                    >
                        <View style={[styles.chipDot, { backgroundColor: isSelected ? '#00f0ff' : '#10b981' }]} />
                        <Text style={[styles.chipCode, isSelected && { color: '#00f0ff' }]}>{pin.code}</Text>
                        <Text style={[styles.chipVal, isSelected && { color: '#FFFFFF', fontWeight: 'bold' }]}>
                            {reading.val}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        width: '100%',
        height: 290,
        alignItems: 'center',
        justifyContent: 'center',
    },
    surfaceChip: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(8, 14, 24, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.45)',
        borderRadius: radii.full,
        paddingHorizontal: 7,
        paddingVertical: 3,
        gap: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.7,
        shadowRadius: 3,
        elevation: 4,
    },
    surfaceChipSelected: {
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.22)',
    },
    chipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    chipCode: {
        fontSize: 9,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.3,
    },
    chipVal: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        fontVariant: ['tabular-nums'],
    },
});

export default React.memo(PerspectiveCarSvg);
