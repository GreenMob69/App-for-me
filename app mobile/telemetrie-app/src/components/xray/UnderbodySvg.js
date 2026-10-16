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
} from 'react-native-svg';

const UnderbodySvg = ({
    topology = 'LONGITUDINAL_AWD_FWD',
    subCategory = 'DRIVETRAIN', // 'DRIVETRAIN' | 'EXHAUST' | 'BRAKES_FRONT' | 'BRAKES_REAR' | 'OIL_SUMP'
    activeSensors = [],
    selectedSensorId = null,
    onSelectSensor = null,
}) => {
    return (
        <Svg width="100%" height={260} viewBox="0 0 400 240">
            <Defs>
                <LinearGradient id="ubCarGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#1e2c45" stopOpacity="0.88" />
                    <Stop offset="1" stopColor="#0c1322" stopOpacity="0.96" />
                </LinearGradient>
            </Defs>

            {/* Siluetă aerodinamică laterală */}
            <Path
                d="M 22 185 L 35 185 C 40 152, 60 144, 85 144 C 110 144, 128 152, 134 185 L 265 185 C 270 152, 290 144, 318 144 C 344 144, 360 152, 366 185 L 384 185 C 388 168, 376 138, 362 134 L 330 134 L 285 88 C 265 76, 195 72, 155 82 L 105 134 L 35 140 C 18 155, 18 175, 22 185 Z"
                fill="url(#ubCarGrad)"
                stroke="#2e476d"
                strokeWidth="2"
            />

            {/* Geamuri laterale */}
            <Path d="M 158 88 L 210 86 L 210 130 L 118 130 Z" fill="#070c16" stroke="#334d73" strokeWidth="1.5" />
            <Path d="M 220 86 L 276 90 L 320 130 L 220 130 Z" fill="#070c16" stroke="#334d73" strokeWidth="1.5" />

            {/* Roți & Jante sport */}
            <Circle cx="84" cy="180" r="28" fill="#0b1019" stroke="#384f73" strokeWidth="2.5" />
            <Circle
                cx="84"
                cy="180"
                r={subCategory === 'BRAKES_FRONT' ? 19 : 17}
                fill="#1b2537"
                stroke={subCategory === 'BRAKES_FRONT' ? '#00f0ff' : '#4d8ef5'}
                strokeWidth={subCategory === 'BRAKES_FRONT' ? 2 : 1.2}
                strokeDasharray="3,2"
            />
            <Rect
                x="78"
                y="166"
                width={subCategory === 'BRAKES_FRONT' ? 8 : 6}
                height={subCategory === 'BRAKES_FRONT' ? 16 : 14}
                rx="2"
                fill="#ef4444"
                stroke="#ff8888"
                strokeWidth={0.8}
            />

            <Circle cx="318" cy="180" r="28" fill="#0b1019" stroke="#384f73" strokeWidth="2.5" />
            <Circle
                cx="318"
                cy="180"
                r={subCategory === 'BRAKES_REAR' ? 18 : 15}
                fill="#1b2537"
                stroke={subCategory === 'BRAKES_REAR' ? '#00f0ff' : '#f59e0b'}
                strokeWidth={subCategory === 'BRAKES_REAR' ? 2 : 1.2}
                strokeDasharray="3,2"
            />
            <Rect
                x="312"
                y="168"
                width={subCategory === 'BRAKES_REAR' ? 8 : 6}
                height={subCategory === 'BRAKES_REAR' ? 15 : 12}
                rx="2"
                fill="#ef4444"
                stroke="#ff8888"
                strokeWidth={0.8}
            />

            {/* Baie de ulei inferioară din aluminiu */}
            <Rect
                x="118"
                y="176"
                width="28"
                height="12"
                rx="2"
                fill={subCategory === 'OIL_SUMP' ? '#163a4d' : '#202c40'}
                stroke={subCategory === 'OIL_SUMP' ? '#00f0ff' : '#38bdf8'}
                strokeWidth={subCategory === 'OIL_SUMP' ? 2 : 1.2}
            />

            {/* Cutie de viteze în tunelul median */}
            <Rect
                x="160"
                y="172"
                width="34"
                height="16"
                rx="3"
                fill={subCategory === 'DRIVETRAIN' ? '#1c3654' : '#182333'}
                stroke={subCategory === 'DRIVETRAIN' ? '#00f0ff' : '#4d8ef5'}
                strokeWidth={subCategory === 'DRIVETRAIN' ? 2 : 1.2}
            />

            {/* Traseu eșapament cu DPF și tobă */}
            <Path
                d="M 144 165 L 175 184 L 355 184 L 375 180"
                stroke={subCategory === 'EXHAUST' ? '#f97316' : '#5a3d24'}
                strokeWidth={subCategory === 'EXHAUST' ? 3.5 : 2}
                fill="none"
            />
            <Rect
                x="216"
                y="176"
                width="40"
                height="16"
                rx="4"
                fill={subCategory === 'EXHAUST' ? '#3d2016' : '#261b17'}
                stroke={subCategory === 'EXHAUST' ? '#00f0ff' : '#f97316'}
                strokeWidth={subCategory === 'EXHAUST' ? 2 : 1.2}
            />

            {/* ── SENZORI DIN SUB-CATEGORIA ACTIVĂ ── */}
            {activeSensors.map(sensor => {
                const isSelected = selectedSensorId === sensor.id;
                const col = isSelected ? '#00f0ff' : '#10b981';

                return (
                    <G key={sensor.id}>
                        {isSelected && (
                            <Circle
                                cx={sensor.coords.x}
                                cy={sensor.coords.y}
                                r={20}
                                fill={col}
                                fillOpacity={0.16}
                                stroke={col}
                                strokeWidth={1.5}
                                strokeDasharray="3,2"
                            />
                        )}
                        <Circle
                            cx={sensor.coords.x}
                            cy={sensor.coords.y}
                            r={12}
                            fill={col}
                            fillOpacity={0.3}
                            stroke={col}
                            strokeWidth={2}
                        />
                        <Circle
                            cx={sensor.coords.x}
                            cy={sensor.coords.y}
                            r={5.5}
                            fill={col}
                            stroke="#070c14"
                            strokeWidth={1.8}
                        />
                    </G>
                );
            })}
        </Svg>
    );
};

export default React.memo(UnderbodySvg);
