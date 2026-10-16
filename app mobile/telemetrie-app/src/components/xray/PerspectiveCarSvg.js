'use strict';

/**
 * PerspectiveCarSvg.js — Top-Down Grand Tourer Blueprint (Vedere Tehnică Ortografică Simetrică)
 *
 * Inspirat de clusterele digitale Tesla OS / Porsche Taycan:
 * - Geometrie CAD 100% simetrică matematic pe axa longitudinală Y = 115.
 * - Siluetă sport-sedan proporționată: capotă sculptată, parbriz, plafon panoramic, jante cu etriere roșii,
 *   bloc motor, turbină, cutie de viteze, baterie 12V și linie dublă de evacuare cu DPF.
 * - Caroserie 100% curată: DOAR pini circulari numerotați (1..8) cu halo activ la atingere.
 * - Fără casete lungi de text peste mașină (telemetria detaliată se afișează în grila 2x4 dedicată).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
    Path,
    Rect,
    Circle,
    G,
    Line,
    Defs,
    LinearGradient,
    Stop,
    Text as SvgText,
} from 'react-native-svg';
import { typography } from '../../theme';
import { PERSPECTIVE_PINS } from './xrayConstants';

const PerspectiveCarSvg = ({
    visualMode = 'hologram', // 'studio' | 'hologram'
    liveData = {},
    selectedPinId = null,
    onSelectPin,
}) => {
    const isHolo = visualMode === 'hologram';
    const accentCol = isHolo ? '#00f0ff' : '#38bdf8';
    const bodyStroke = isHolo ? '#00f0ff' : '#60a5fa';

    return (
        <View style={styles.container}>
            <Svg width="100%" height={240} viewBox="0 0 380 230">
                <Defs>
                    {/* Gradient fundal corp mașină */}
                    <LinearGradient id="carBodyGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={isHolo ? '#031a2e' : '#0a1526'} stopOpacity="0.95" />
                        <Stop offset="0.4" stopColor={isHolo ? '#062644' : '#101d36'} stopOpacity="0.9" />
                        <Stop offset="0.8" stopColor={isHolo ? '#081d33' : '#0c1626'} stopOpacity="0.95" />
                        <Stop offset="1" stopColor={isHolo ? '#031221' : '#070f1a'} stopOpacity="0.95" />
                    </LinearGradient>

                    {/* Gradient plafon panoramic sticlă fumurie */}
                    <LinearGradient id="panoramicGlassGrad" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#00f0ff" stopOpacity="0.25" />
                        <Stop offset="0.3" stopColor="#0284c7" stopOpacity="0.15" />
                        <Stop offset="0.7" stopColor="#0f172a" stopOpacity="0.7" />
                        <Stop offset="1" stopColor="#00f0ff" stopOpacity="0.2" />
                    </LinearGradient>

                    {/* Gradient neon laser scan */}
                    <LinearGradient id="laserGlow" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#00f0ff" stopOpacity="0.8" />
                        <Stop offset="0.5" stopColor="#38bdf8" stopOpacity="0.2" />
                        <Stop offset="1" stopColor="#00f0ff" stopOpacity="0.8" />
                    </LinearGradient>
                </Defs>

                {/* ── 1. GRILĂ DE FUNDAL CAD & LINII TEHNICE DE CALIBRARE ── */}
                <G id="cadGrid" opacity={isHolo ? 0.25 : 0.15}>
                    {/* Linii orizontale */}
                    <Line x1="15" y1="50" x2="365" y2="50" stroke="#00f0ff" strokeWidth="0.6" strokeDasharray="3,3" />
                    <Line x1="15" y1="115" x2="365" y2="115" stroke="#00f0ff" strokeWidth="0.8" strokeDasharray="5,3" />
                    <Line x1="15" y1="180" x2="365" y2="180" stroke="#00f0ff" strokeWidth="0.6" strokeDasharray="3,3" />
                    {/* Linii verticale de ampatament */}
                    <Line x1="96" y1="35" x2="96" y2="195" stroke="#00f0ff" strokeWidth="0.8" strokeDasharray="4,4" />
                    <Line x1="280" y1="35" x2="280" y2="195" stroke="#00f0ff" strokeWidth="0.8" strokeDasharray="4,4" />
                </G>

                {/* ── 2. CELE 4 ROȚI CU ETRIERE ROȘII SPORT (Vedere de sus) ── */}
                <G id="wheelsGroup">
                    {/* Roata Stânga-Față (Sus) */}
                    <Rect x="82" y="44" width="28" height="15" rx="3.5" fill="#050a14" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="86" y1="47" x2="106" y2="47" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Line x1="86" y1="56" x2="106" y2="56" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Rect x="93" y="55" width="6" height="5" rx="1" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                    {/* Roata Dreapta-Față (Jos) — Simetrică matematic pe Y=115 */}
                    <Rect x="82" y="171" width="28" height="15" rx="3.5" fill="#050a14" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="86" y1="174" x2="106" y2="174" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Line x1="86" y1="183" x2="106" y2="183" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Rect x="93" y="170" width="6" height="5" rx="1" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                    {/* Roata Stânga-Spate (Sus) */}
                    <Rect x="266" y="44" width="28" height="15" rx="3.5" fill="#050a14" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="270" y1="47" x2="290" y2="47" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Line x1="270" y1="56" x2="290" y2="56" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Rect x="277" y="55" width="6" height="5" rx="1" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                    {/* Roata Dreapta-Spate (Jos) */}
                    <Rect x="266" y="171" width="28" height="15" rx="3.5" fill="#050a14" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="270" y1="174" x2="290" y2="174" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Line x1="270" y1="183" x2="290" y2="183" stroke="#7dd3fc" strokeWidth="1" strokeDasharray="2,1" />
                    <Rect x="277" y="170" width="6" height="5" rx="1" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />

                    {/* Punte motoare / planetare față și spate */}
                    <Line x1="96" y1="59" x2="96" y2="171" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.5" />
                    <Line x1="280" y1="59" x2="280" y2="171" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.5" />
                </G>

                {/* ── 3. SILUETA CAROSERIEI SPORT-SEDAN GRAND TOURER (Simetrie 100%) ── */}
                <G id="carSilhouette">
                    {/* Caroserie exterioară sculptată */}
                    <Path
                        d="M 45 115
                           C 46,95 56,80 72,74
                           C 84,72 96,70 112,70
                           C 135,72 170,73 210,73
                           C 245,72 265,70 280,70
                           C 300,70 325,82 335,100
                           C 336,108 336,112 336,115
                           C 336,118 336,122 335,130
                           C 325,148 300,160 280,160
                           C 265,160 245,158 210,157
                           C 170,157 135,158 112,160
                           C 96,160 84,158 72,156
                           C 56,150 46,135 45,115 Z"
                        fill="url(#carBodyGrad)"
                        stroke={bodyStroke}
                        strokeWidth="1.8"
                    />

                    {/* Oglinzi laterale aerodinamice */}
                    <Path d="M 134 71 L 138 52 L 146 54 L 140 71 Z" fill="#082f49" stroke="#38bdf8" strokeWidth="1" />
                    <Path d="M 134 159 L 138 178 L 146 176 L 140 159 Z" fill="#082f49" stroke="#38bdf8" strokeWidth="1" />

                    {/* Nervuri pe capotă (Sculpted Hood Lines) */}
                    <Path d="M 52 105 Q 85 102 125 96" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" fill="none" />
                    <Path d="M 52 125 Q 85 128 125 134" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" fill="none" />

                    {/* Faruri Matrix LED ascuțite */}
                    <Path d="M 50 92 L 64 80 L 68 85 L 54 98 Z" fill="#00f0ff" fillOpacity="0.5" stroke="#00f0ff" strokeWidth="1" />
                    <Path d="M 50 138 L 64 150 L 68 145 L 54 132 Z" fill="#00f0ff" fillOpacity="0.5" stroke="#00f0ff" strokeWidth="1" />

                    {/* Stopuri LED spate stil Lightbar */}
                    <Path d="M 333 92 L 335 115 L 333 138" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <Line x1="324" y1="84" x2="333" y2="92" stroke="#ef4444" strokeWidth="1.8" />
                    <Line x1="324" y1="146" x2="333" y2="138" stroke="#ef4444" strokeWidth="1.8" />

                    {/* Ieșiri duble de eșapament cromate la difuzor */}
                    <Rect x="334" y="90" width="4" height="6" rx="1.5" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="0.8" />
                    <Rect x="334" y="134" width="4" height="6" rx="1.5" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="0.8" />
                </G>

                {/* ── 4. ORGANE MECANICE CUTAWAY / X-RAY (Top-Down Clartate Maximă) ── */}
                <G id="mechanicalOrgans">
                    {/* Radiator frontal & intercooler */}
                    <Rect x="54" y="90" width="10" height="50" rx="2" fill="#0b192c" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="56" y1="96" x2="62" y2="96" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.7" />
                    <Line x1="56" y1="104" x2="62" y2="104" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.7" />
                    <Line x1="56" y1="115" x2="62" y2="115" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.7" />
                    <Line x1="56" y1="126" x2="62" y2="126" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.7" />
                    <Line x1="56" y1="134" x2="62" y2="134" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.7" />

                    {/* Bloc Motor cu 4 Cilindri Bores */}
                    <Rect x="100" y="95" width="40" height="40" rx="4" fill="#0d1b2a" stroke="#00f0ff" strokeWidth="1.4" />
                    <Circle cx="109" cy="104" r="5" fill="#060c14" stroke="#38bdf8" strokeWidth="1" />
                    <Circle cx="131" cy="104" r="5" fill="#060c14" stroke="#38bdf8" strokeWidth="1" />
                    <Circle cx="109" cy="126" r="5" fill="#060c14" stroke="#38bdf8" strokeWidth="1" />
                    <Circle cx="131" cy="126" r="5" fill="#060c14" stroke="#38bdf8" strokeWidth="1" />

                    {/* Turbosuflantă VNT (Sus, pe evacuare) */}
                    <Circle cx="115" cy="76" r="8" fill="#1e1b18" stroke="#f97316" strokeWidth="1.5" />
                    <Path d="M 112 73 Q 115 76 118 73" stroke="#fb923c" strokeWidth="1" fill="none" />
                    {/* Conductă intercooler spre motor */}
                    <Path d="M 64 100 Q 85 88 108 78" stroke="#38bdf8" strokeWidth="1.5" fill="none" strokeDasharray="3,2" />

                    {/* Baterie 12V & Alternator */}
                    <Rect x="146" y="68" width="18" height="14" rx="2" fill="#0f172a" stroke="#10b981" strokeWidth="1.2" />
                    <Rect x="149" y="66" width="3" height="2" fill="#10b981" />
                    <Rect x="158" y="66" width="3" height="2" fill="#ef4444" />

                    {/* Cutie de viteze (Transmisie tunel median) */}
                    <Rect x="155" y="103" width="38" height="24" rx="3" fill="#091424" stroke="#38bdf8" strokeWidth="1.2" />
                    <Line x1="165" y1="106" x2="165" y2="124" stroke="#0284c7" strokeWidth="1" strokeDasharray="2,2" />
                    <Line x1="175" y1="106" x2="175" y2="124" stroke="#0284c7" strokeWidth="1" strokeDasharray="2,2" />

                    {/* Cardan median spre puntea spate */}
                    <Line x1="193" y1="115" x2="270" y2="115" stroke="#38bdf8" strokeWidth="2.5" />
                    {/* Diferențial spate */}
                    <Circle cx="280" cy="115" r="9" fill="#0d1b2a" stroke="#0284c7" strokeWidth="1.4" />

                    {/* Traseu eșapament & Canistră Filtru DPF */}
                    <Path d="M 122 80 Q 155 92 185 138 L 210 142" stroke="#ea580c" strokeWidth="2" fill="none" strokeDasharray="3,2" />
                    <Rect x="210" y="136" width="38" height="12" rx="3" fill="#231709" stroke="#f97316" strokeWidth="1.4" />
                    <Line x1="216" y1="138" x2="216" y2="146" stroke="#fb923c" strokeWidth="1" strokeDasharray="1,1" />
                    <Line x1="228" y1="138" x2="228" y2="146" stroke="#fb923c" strokeWidth="1" strokeDasharray="1,1" />
                    <Line x1="240" y1="138" x2="240" y2="146" stroke="#fb923c" strokeWidth="1" strokeDasharray="1,1" />
                    <Path d="M 248 142 L 310 142 L 334 137" stroke="#ea580c" strokeWidth="2" fill="none" />
                </G>

                {/* ── 5. HABITACLU & PLAFON PANORAMIC TRANSPARENT ── */}
                <G id="cabinGlass">
                    <Path
                        d="M 142 82
                           C 180 80, 215 80, 248 83
                           L 268 92
                           C 272 105, 272 125, 268 138
                           L 248 147
                           C 215 150, 180 150, 142 148
                           L 128 138
                           C 124 125, 124 105, 128 92 Z"
                        fill="url(#panoramicGlassGrad)"
                        stroke="#38bdf8"
                        strokeWidth="1.2"
                        strokeOpacity="0.75"
                    />
                    {/* Separator bord / parbriz */}
                    <Path d="M 132 94 Q 138 115 132 136" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" fill="none" />
                    {/* Lunetă spate */}
                    <Path d="M 250 86 Q 256 115 250 144" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" fill="none" />
                </G>

                {/* ── 6. HUD TEHNIC CAD (Colțuri Blueprint fără suprapuneri) ── */}
                <G id="hudOverlays" pointerEvents="none">
                    {/* Colț Stânga-Sus */}
                    <Path d="M 15 22 L 15 12 L 28 12" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                    <SvgText x="32" y="16" fill="#38bdf8" fontSize="8" fontWeight="bold" letterSpacing="0.6">
                        [ TOP-DOWN GRAND TOURER // ORTHOGRAPHIC CAD ]
                    </SvgText>

                    {/* Colț Dreapta-Sus */}
                    <Path d="M 365 22 L 365 12 L 352 12" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                    <SvgText x="348" y="16" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="end">
                        ● CAN-BUS 500kbps · 60 FPS
                    </SvgText>

                    {/* Colț Stânga-Jos */}
                    <Path d="M 15 208 L 15 218 L 28 218" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                    <SvgText x="32" y="215" fill="#64748b" fontSize="7.5" fontWeight="bold">
                        L: 4,939 mm · AMPATAMENT: 2,924 mm · Cd: 0.26
                    </SvgText>

                    {/* Colț Dreapta-Jos */}
                    <Path d="M 365 208 L 365 218 L 352 218" stroke="#00f0ff" strokeWidth="1.5" fill="none" />
                    <SvgText x="348" y="215" fill="#38bdf8" fontSize="7.5" fontWeight="bold" textAnchor="end">
                        8 NODURI MONITORIZATE
                    </SvgText>
                </G>

                {/* ── 7. CELE 8 PIN-URI CIRCULARE NUMEROTATE (1..8) ── */}
                {/* INTERZIS casete mari de text peste caroserie! DOAR PINUL TACTIL CU HALO */}
                {PERSPECTIVE_PINS.map((pin, index) => {
                    const isSelected = selectedPinId === pin.id;
                    const pinNum = pin.num || (index + 1);
                    const col = isSelected ? '#00f0ff' : '#10b981';

                    return (
                        <G
                            key={pin.id}
                            onPress={() => onSelectPin && onSelectPin(pin)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Halou radar exterior la selecție */}
                            {isSelected && (
                                <Circle
                                    cx={pin.pin.x}
                                    cy={pin.pin.y}
                                    r={17}
                                    fill={col}
                                    fillOpacity={0.25}
                                    stroke={col}
                                    strokeWidth={1.8}
                                    strokeDasharray="4,2"
                                />
                            )}

                            {/* Halou de standby subtil */}
                            {!isSelected && (
                                <Circle
                                    cx={pin.pin.x}
                                    cy={pin.pin.y}
                                    r={12}
                                    fill={col}
                                    fillOpacity={0.12}
                                    stroke={col}
                                    strokeWidth={0.8}
                                />
                            )}

                            {/* Corp pin circular (badge de sticlă întunecată) */}
                            <Circle
                                cx={pin.pin.x}
                                cy={pin.pin.y}
                                r={10}
                                fill="#060c18"
                                stroke={col}
                                strokeWidth={isSelected ? 2 : 1.4}
                            />

                            {/* Cifră Pin (1, 2, 3...) centrată matematic */}
                            <SvgText
                                x={pin.pin.x}
                                y={pin.pin.y + 3.5}
                                fill={isSelected ? '#00f0ff' : '#ffffff'}
                                fontSize="9.5"
                                fontWeight="bold"
                                textAnchor="middle"
                            >
                                {pinNum}
                            </SvgText>
                        </G>
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 235,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});

export default React.memo(PerspectiveCarSvg);
