'use strict';

import React from 'react';
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
} from 'react-native-svg';

const ChassisOverviewSvg = ({
    topology = 'LONGITUDINAL_AWD_FWD',
    height = 300,
    activeZone = null,
    onZonePress = null,
}) => {
    return (
        <Svg width="100%" height={height} viewBox="0 0 320 440">
            <Defs>
                <LinearGradient id="ovBodyGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1e2c45" stopOpacity="0.90" />
                    <Stop offset="0.5" stopColor="#0d1526" stopOpacity="0.96" />
                    <Stop offset="1" stopColor="#1a253c" stopOpacity="0.92" />
                </LinearGradient>
                <LinearGradient id="ovWindshieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#162942" stopOpacity="0.95" />
                    <Stop offset="1" stopColor="#070c17" stopOpacity="0.98" />
                </LinearGradient>
                <LinearGradient id="ovTireGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#080c14" />
                    <Stop offset="0.5" stopColor="#1e283b" />
                    <Stop offset="1" stopColor="#080c14" />
                </LinearGradient>
            </Defs>

            {/* Oglinzi laterale */}
            <Polygon points="58,155 42,165 44,175 62,170" fill="#1b283d" stroke="#334d73" strokeWidth="1" />
            <Polygon points="262,155 278,165 276,175 258,170" fill="#1b283d" stroke="#334d73" strokeWidth="1" />

            {/* Siluetă aerodinamică CAD */}
            <Path
                d="M 122 14 C 145 10, 175 10, 198 14 C 224 19, 244 38, 250 68 C 258 100, 252 140, 254 210 C 256 275, 258 340, 250 385 C 244 412, 226 430, 198 434 C 172 438, 148 438, 122 434 C 94 430, 76 412, 70 385 C 62 340, 64 275, 66 210 C 68 140, 62 100, 70 68 C 76 38, 96 19, 122 14 Z"
                fill="url(#ovBodyGrad)"
                stroke="#2e476d"
                strokeWidth="2"
            />

            {/* Lamele splitter & Faruri DRL LED */}
            <Path d="M 98 28 L 120 22 L 120 34 Z" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1" />
            <Path d="M 222 28 L 200 22 L 200 34 Z" fill="#00f0ff" fillOpacity="0.4" stroke="#00f0ff" strokeWidth="1" />
            <Line x1="128" y1="20" x2="192" y2="20" stroke="#4d8ef5" strokeWidth="1.5" strokeOpacity="0.7" />

            {/* Parbriz cu tentă fumurie */}
            <Path
                d="M 92 136 C 130 144, 190 144, 228 136 L 236 182 C 185 190, 135 190, 84 182 Z"
                fill="url(#ovWindshieldGrad)"
                stroke="#334d73"
                strokeWidth="1.5"
            />
            <Line x1="98" y1="140" x2="222" y2="140" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.18" />

            {/* Plafon panoramic */}
            <Rect x="88" y="188" width="144" height="92" rx="6" fill="#070c16" stroke="#1f3049" strokeWidth="1.5" />

            {/* Lunetă spate */}
            <Path
                d="M 88 286 C 135 281, 185 281, 232 286 L 226 328 C 180 334, 140 334, 94 328 Z"
                fill="url(#ovWindshieldGrad)"
                stroke="#334d73"
                strokeWidth="1.5"
            />

            {/* Stopuri LED spate */}
            <Path d="M 88 418 L 232 418" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />

            {/* Roți & Jante */}
            {[
                { x: 38, y: 64 },
                { x: 254, y: 64 },
                { x: 38, y: 326 },
                { x: 254, y: 326 },
            ].map((w, idx) => (
                <G key={idx}>
                    <Rect x={w.x} y={w.y} width={28} height={60} rx="7" fill="url(#ovTireGrad)" stroke="#384f73" strokeWidth="2" />
                    <Rect x={w.x + 6} y={w.y + 12} width={16} height={36} rx="4" fill="#1b2434" stroke="#4d8ef5" strokeWidth="1.2" strokeDasharray="2,2" />
                    <Rect x={w.x + (w.x < 100 ? 18 : 2)} y={w.y + 18} width={8} height={24} rx="2" fill="#ef4444" stroke="#ff8888" strokeWidth="0.8" />
                </G>
            ))}

            {/* Punți */}
            <Line x1="66" y1="94" x2="254" y2="94" stroke="#2a3f5f" strokeWidth="3" />
            <Line x1="66" y1="356" x2="254" y2="356" stroke="#2a3f5f" strokeWidth="3" />

            {/* Radiator frontal */}
            <Rect x="114" y="36" width="92" height="20" rx="4" fill="#0f1d2e" stroke="#2a507a" strokeWidth="1.5" />
            <Line x1="120" y1="46" x2="200" y2="46" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3,2" />

            {/* Powertrain simplificat pe caroserie */}
            {topology === 'SKATEBOARD_BEV' ? (
                <G>
                    <Rect x="82" y="145" width="156" height="150" rx="8" fill="#0a1826" stroke="#00f0ff" strokeWidth="2" />
                    <Rect x="135" y="74" width="50" height="42" rx="6" fill="#132a3d" stroke="#10b981" strokeWidth="2" />
                    <Rect x="135" y="334" width="50" height="44" rx="6" fill="#132a3d" stroke="#10b981" strokeWidth="2" />
                </G>
            ) : topology === 'TRANSVERSAL_FWD' ? (
                <G>
                    <Rect x="88" y="74" width="86" height="48" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                    <Rect x="178" y="76" width="46" height="58" rx="6" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                    <Rect x="146" y="230" width="28" height="42" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.8" />
                </G>
            ) : topology === 'LONGITUDINAL_RWD' ? (
                <G>
                    <Rect x="138" y="68" width="44" height="82" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                    <Path d="M 142 150 L 178 150 L 172 208 L 148 208 Z" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                    <Line x1="160" y1="208" x2="160" y2="340" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6,3" />
                    <Rect x="146" y="340" width="28" height="28" rx="6" fill="#24192b" stroke="#d97706" strokeWidth="2" />
                </G>
            ) : (
                <G>
                    {/* Longitudinal FWD/AWD */}
                    <Rect x="135" y="74" width="50" height="74" rx="6" fill="#16253b" stroke="#3b5984" strokeWidth="2" />
                    <Path d="M 142 148 L 178 148 L 172 216 L 148 216 Z" fill="#111c2e" stroke="#2c4263" strokeWidth="1.8" />
                    <Rect x="150" y="250" width="28" height="46" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.8" />
                </G>
            )}

            {/* 3 Zone Interactive Macro Callouts */}
            {/* ZONA 1: FAȚĂ / SUB CAPOTĂ */}
            <Rect
                x="68"
                y="30"
                width="184"
                height="105"
                rx="10"
                fill="#4d8ef5"
                fillOpacity={activeZone === 'ENGINE_BAY' ? 0.22 : 0.06}
                stroke={activeZone === 'ENGINE_BAY' ? '#00f0ff' : '#4d8ef5'}
                strokeWidth={activeZone === 'ENGINE_BAY' ? 2 : 1}
                strokeDasharray="4,3"
            />

            {/* ZONA 2: MEDIANĂ / TREN RULARE & EVACUARE */}
            <Rect
                x="68"
                y="142"
                width="184"
                height="150"
                rx="10"
                fill="#10b981"
                fillOpacity={activeZone === 'UNDERBODY' ? 0.22 : 0.06}
                stroke={activeZone === 'UNDERBODY' ? '#10b981' : '#225544'}
                strokeWidth={activeZone === 'UNDERBODY' ? 2 : 1}
                strokeDasharray="4,3"
            />

            {/* ZONA 3: PUNTE SPATE & FRÂNE */}
            <Rect
                x="68"
                y="300"
                width="184"
                height="115"
                rx="10"
                fill="#f59e0b"
                fillOpacity={activeZone === 'WHEELS_BRAKES' ? 0.22 : 0.06}
                stroke={activeZone === 'WHEELS_BRAKES' ? '#f59e0b' : '#554422'}
                strokeWidth={activeZone === 'WHEELS_BRAKES' ? 2 : 1}
                strokeDasharray="4,3"
            />
        </Svg>
    );
};

export default React.memo(ChassisOverviewSvg);
