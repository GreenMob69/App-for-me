'use strict';

/**
 * PerspectiveCarSvg.js — Vizualizator Hibrid Digital Twin (3D Studio Fotorealist + Hologramă CAD)
 *
 * Suportă 2 moduri vizuale comutabile de către utilizator:
 * 1. 'studio'   : Render foto-realist de studio auto (Audi A6 Sedan) cu overlay neon și senzori live.
 * 2. 'hologram' : Blueprint cibernetic vectorial avansat cu curbe Bezier fluide, jante aliaj și HUD SF.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
    Text as SvgText,
} from 'react-native-svg';
import { colors, typography, radii } from '../../theme';
import { PERSPECTIVE_PINS } from './xrayConstants';

// Asset foto-realist studio Audi A6 Sedan (fundal transparent)
const AUDI_STUDIO_IMG = require('../../../assets/vehicles/audi_a6_sedan_studio.png');

const PerspectiveCarSvg = ({
    visualMode = 'studio', // 'studio' | 'hologram'
    liveData = {},
    selectedPinId = null,
    onSelectPin,
}) => {
    const isHologram = visualMode === 'hologram';

    return (
        <View style={styles.container}>
            {/* ── 1. MODUL FOTO-REALIST 3D STUDIO (OPȚIUNEA B) ── */}
            {!isHologram && (
                <View style={styles.studioBackdrop} pointerEvents="none">
                    {/* Radianță/Halou ambiental de studio sub mașină */}
                    <View style={styles.studioFloorShadow} />
                    <View style={styles.studioFloorGlow} />

                    {/* Imaginea foto-realistă de studio a mașinii */}
                    <Image
                        source={AUDI_STUDIO_IMG}
                        style={styles.studioCarImage}
                        resizeMode="contain"
                    />
                </View>
            )}

            {/* ── 2. STRATUL VECTORIAL SVG (Overlay pentru Studio sau Hologramă Completă) ── */}
            <Svg width="100%" height={290} viewBox="0 0 380 290">
                <Defs>
                    {/* Gradiente Hologramă CAD */}
                    <LinearGradient id="holoBodyGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#0284c7" stopOpacity="0.25" />
                        <Stop offset="0.5" stopColor="#082f49" stopOpacity="0.65" />
                        <Stop offset="1" stopColor="#0c1d33" stopOpacity="0.85" />
                    </LinearGradient>
                    <LinearGradient id="holoHoodGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#00f0ff" stopOpacity="0.20" />
                        <Stop offset="1" stopColor="#0369a1" stopOpacity="0.45" />
                    </LinearGradient>
                    <LinearGradient id="holoGlassGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#38bdf8" stopOpacity="0.35" />
                        <Stop offset="0.6" stopColor="#0369a1" stopOpacity="0.15" />
                        <Stop offset="1" stopColor="#070c14" stopOpacity="0.80" />
                    </LinearGradient>
                    <LinearGradient id="holoLaserLine" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#00f0ff" stopOpacity="0.8" />
                        <Stop offset="0.5" stopColor="#38bdf8" stopOpacity="1" />
                        <Stop offset="1" stopColor="#00f0ff" stopOpacity="0.8" />
                    </LinearGradient>
                </Defs>

                {/* ── DESENUL VECTORIAL COMPLET (DOAR ÎN MODUL HOLOGRAMĂ CAD - OPȚIUNEA C) ── */}
                {isHologram && (
                    <G id="hologramVectorGroup">
                        {/* Grilă de perspectivă pe podea (Cyber Floor Grid) */}
                        <Line x1="30" y1="240" x2="350" y2="240" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.2" />
                        <Line x1="45" y1="255" x2="335" y2="255" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.15" />
                        <Line x1="60" y1="225" x2="20" y2="265" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.15" />
                        <Line x1="150" y1="225" x2="130" y2="265" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.15" />
                        <Line x1="250" y1="225" x2="260" y2="265" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.15" />
                        <Line x1="320" y1="225" x2="355" y2="265" stroke="#00f0ff" strokeWidth="0.8" strokeOpacity="0.15" />

                        {/* Umbră difuză podea */}
                        <Ellipse cx="205" cy="228" rx="145" ry="18" fill="#000000" fillOpacity="0.5" />

                        {/* 1. SILUETĂ PRINCIPALĂ CAROSERIE DIN CURBE BEZIER FLUIDE */}
                        <Path
                            d="M 42 195 
                               C 45 172, 75 158, 105 152 
                               C 142 144, 165 130, 195 82 
                               C 222 50, 260 62, 292 96 
                               C 318 122, 345 145, 362 166 
                               C 366 178, 355 190, 335 192 
                               L 322 192 
                               C 320 170, 285 170, 282 192 
                               L 145 208 
                               C 140 185, 102 185, 100 208 
                               L 52 216 
                               C 42 212, 40 202, 42 195 Z"
                            fill="url(#holoBodyGrad)"
                            stroke="#00f0ff"
                            strokeWidth="1.8"
                        />

                        {/* 2. CAPOTĂ TRANSPARENTĂ (Decupaj Cutaway către motor) */}
                        <Path
                            d="M 48 190 
                               C 55 168, 85 155, 115 150 
                               L 165 140 
                               C 145 165, 105 180, 72 198 
                               Z"
                            fill="url(#holoHoodGrad)"
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                            strokeDasharray="4,2"
                        />

                        {/* 3. PARBRIZ & GEAMURI LATERALE FUMURII */}
                        <Path
                            d="M 120 148 
                               C 152 136, 172 110, 195 84 
                               L 242 94 
                               C 220 120, 190 142, 162 146 
                               Z"
                            fill="url(#holoGlassGrad)"
                            stroke="#38bdf8"
                            strokeWidth="1.2"
                        />
                        <Path
                            d="M 198 84 
                               C 228 58, 262 68, 290 98 
                               L 282 135 
                               C 240 132, 205 110, 198 84 Z"
                            fill="url(#holoGlassGrad)"
                            stroke="#0284c7"
                            strokeWidth="1"
                        />

                        {/* 4. GRILĂ FRONTALĂ AUDI SINGLEFRAME HEXAGONALĂ */}
                        <Polygon
                            points="42,192 70,172 70,215 42,204"
                            fill="#030814"
                            stroke="#00f0ff"
                            strokeWidth="1.6"
                        />
                        {/* Lamele orizontale grilă */}
                        <Line x1="44" y1="184" x2="68" y2="178" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.7" />
                        <Line x1="44" y1="192" x2="68" y2="186" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.7" />
                        <Line x1="44" y1="200" x2="68" y2="194" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.7" />
                        {/* Emblema stilizată a celor 4 inele */}
                        <Circle cx="52" cy="188" r="3" stroke="#00f0ff" strokeWidth="0.8" fill="none" />
                        <Circle cx="56" cy="187" r="3" stroke="#00f0ff" strokeWidth="0.8" fill="none" />
                        <Circle cx="60" cy="186" r="3" stroke="#00f0ff" strokeWidth="0.8" fill="none" />
                        <Circle cx="64" cy="185" r="3" stroke="#00f0ff" strokeWidth="0.8" fill="none" />

                        {/* 5. FAR MATRIX LED AGRESIV CU SEMNĂTURĂ LUMINOASĂ */}
                        <Path
                            d="M 52 178 L 72 168 L 70 178 L 50 184 Z"
                            fill="#00f0ff"
                            fillOpacity="0.4"
                            stroke="#00f0ff"
                            strokeWidth="1.2"
                        />
                        <Line x1="53" y1="179" x2="71" y2="170" stroke="#FFFFFF" strokeWidth="1.5" />

                        {/* 6. ROȚI CU JANTE DIN ALIAJ & ETRIERE ROȘII BREMBO */}
                        {/* Roata Față (În perspectivă 3D) */}
                        <Ellipse cx="118" cy="216" rx="20" ry="32" fill="#030712" stroke="#38bdf8" strokeWidth="2.2" />
                        <Ellipse cx="118" cy="216" rx="14" ry="22" fill="#0b1329" stroke="#00f0ff" strokeWidth="1.2" strokeDasharray="3,2" />
                        {/* Spițe duble jantă față */}
                        {[0, 72, 144, 216, 288].map((deg, i) => (
                            <Line
                                key={i}
                                x1="118"
                                y1="216"
                                x2={118 + 13 * Math.cos(deg * Math.PI / 180)}
                                y2={216 + 20 * Math.sin(deg * Math.PI / 180)}
                                stroke="#7dd3fc"
                                strokeWidth="1.5"
                            />
                        ))}
                        {/* Etrier frână roșu sport pe puntea față */}
                        <Rect x="112" y="198" width="7" height="18" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="1" />

                        {/* Roata Spate */}
                        <Ellipse cx="302" cy="190" rx="18" ry="28" fill="#030712" stroke="#38bdf8" strokeWidth="2.2" />
                        <Ellipse cx="302" cy="190" rx="12" ry="18" fill="#0b1329" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="3,2" />
                        {/* Spițe jantă spate */}
                        {[0, 72, 144, 216, 288].map((deg, i) => (
                            <Line
                                key={i}
                                x1="302"
                                y1="190"
                                x2={302 + 11 * Math.cos(deg * Math.PI / 180)}
                                y2={190 + 16 * Math.sin(deg * Math.PI / 180)}
                                stroke="#fcd34d"
                                strokeWidth="1.2"
                            />
                        ))}
                        <Rect x="298" y="178" width="5" height="14" rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                        {/* Roata Dreapta-Față (vizibilă parțial sub caroserie) */}
                        <Ellipse cx="160" cy="170" rx="10" ry="16" fill="#030712" stroke="#1e3a8a" strokeWidth="1.2" />

                        {/* 7. AGREGATE MECANICE SUB CAPOTĂ (Secțiune tehnică) */}
                        {/* Bloc motor longitudinal */}
                        <Polygon points="105,152 145,138 152,160 112,174" fill="#0c2340" stroke="#38bdf8" strokeWidth="1.4" />
                        {/* Turbosuflantă & Galeri evacuare */}
                        <Circle cx="82" cy="168" r="10" fill="#241b18" stroke="#f97316" strokeWidth="1.8" />
                        {/* Cutie de viteze tunel median */}
                        <Polygon points="175,150 215,160 210,180 170,170" fill="#0f172a" stroke="#00f0ff" strokeWidth="1.2" strokeDasharray="2,2" />
                        {/* Traseu eșapament & DPF */}
                        <Path d="M 88 175 Q 140 188 215 175 L 280 172 L 350 175" stroke="#ea580c" strokeWidth="2.5" fill="none" strokeDasharray="4,2" />

                        {/* 8. HUD & ELEMENTE CALIBRARE SF (Tony Stark / CAD Blueprint) */}
                        {/* Colțuri țintă HUD */}
                        <Path d="M 15 25 L 15 12 L 28 12" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                        <Path d="M 365 25 L 365 12 L 352 12" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                        <Path d="M 15 265 L 15 278 L 28 278" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                        <Path d="M 365 265 L 365 278 L 352 278" stroke="#00f0ff" strokeWidth="1.5" fill="none" />

                        <SvgText x="32" y="20" fill="#38bdf8" fontSize="8" fontWeight="bold" letterSpacing="0.6">
                            [ HOLO-CAD // DIGITAL TWIN 3D ]
                        </SvgText>
                        <SvgText x="348" y="20" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="end">
                            ● CAN-BUS 500kbps
                        </SvgText>
                        <SvgText x="32" y="274" fill="#64748b" fontSize="7.5" fontWeight="bold">
                            L: 4,939 mm · AMPATAMENT: 2,924 mm · Cd: 0.26
                        </SvgText>
                    </G>
                )}

                {/* ── ACCENTE OVERLAY PENTRU MODUL STUDIO 3D (Subtile, elegante) ── */}
                {!isHologram && (
                    <G id="studioOverlayGroup">
                        {/* Contur neon fin pe linia capotei & blocului motor */}
                        <Path
                            d="M 65 142 Q 110 132 155 122"
                            stroke="#00f0ff"
                            strokeWidth="1.5"
                            strokeDasharray="4,3"
                            strokeOpacity="0.75"
                            fill="none"
                        />
                        {/* Cablaj electric subtil prin prag */}
                        <Path
                            d="M 125 185 L 235 178 L 320 168"
                            stroke="#10b981"
                            strokeWidth="1.2"
                            strokeDasharray="3,2"
                            strokeOpacity="0.65"
                            fill="none"
                        />
                    </G>
                )}

                {/* ── 3. CELE 8 PIN-URI LUMINOASE & LINII FRÂNTE LEADER LINES (Comune ambelor moduri) ── */}
                {PERSPECTIVE_PINS.map(pin => {
                    const isSelected = selectedPinId === pin.id;
                    const col = isSelected ? '#00f0ff' : '#10b981';

                    return (
                        <G key={pin.id}>
                            {/* Linie frântă fină de ghidaj tehnic din pin spre etichetă */}
                            <Line
                                x1={pin.pin.x}
                                y1={pin.pin.y}
                                x2={pin.chip.x + 22}
                                y2={pin.chip.y + 12}
                                stroke={col}
                                strokeWidth={1}
                                strokeDasharray="2,2"
                                strokeOpacity={0.75}
                            />
                            {/* Halou radar extins dacă este selectat */}
                            {isSelected && (
                                <Circle
                                    cx={pin.pin.x}
                                    cy={pin.pin.y}
                                    r={14}
                                    fill={col}
                                    fillOpacity={0.2}
                                    stroke={col}
                                    strokeWidth={1.5}
                                    strokeDasharray="3,2"
                                />
                            )}
                            {/* Punct luminos exterior */}
                            <Circle
                                cx={pin.pin.x}
                                cy={pin.pin.y}
                                r={8}
                                fill={col}
                                fillOpacity={0.35}
                                stroke={col}
                                strokeWidth={1.5}
                            />
                            {/* Nucleu pin interior */}
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

            {/* ── 4. CHIP-URI CU VALORI LA SUPRAFAȚĂ (Interacțiune tactilă directă!) ── */}
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
        overflow: 'hidden',
    },

    // ── STILURI MODUL STUDIO 3D (Opțiunea B) ──
    studioBackdrop: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    studioFloorShadow: {
        position: 'absolute',
        bottom: 52,
        width: 320,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#000000',
        opacity: 0.85,
    },
    studioFloorGlow: {
        position: 'absolute',
        bottom: 45,
        width: 280,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
    },
    studioCarImage: {
        width: '92%',
        height: 180,
        marginTop: 15,
    },

    // ── CHIP-URI LA SUPRAFAȚĂ ──
    surfaceChip: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(7, 12, 22, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.45)',
        borderRadius: radii.full,
        paddingHorizontal: 7,
        paddingVertical: 3,
        maxWidth: 96,
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
