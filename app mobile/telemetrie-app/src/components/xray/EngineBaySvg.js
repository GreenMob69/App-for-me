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

const EngineBaySvg = ({
    topology = 'LONGITUDINAL_AWD_FWD',
    subCategory = 'AIR_BOOST', // 'AIR_BOOST' | 'FUEL_ING' | 'COOLING_ELEC'
    activeSensors = [],
    selectedSensorId = null,
    onSelectSensor = null,
}) => {
    return (
        <Svg width="100%" height={320} viewBox="0 0 340 340">
            <Defs>
                <LinearGradient id="bayMetalGrad2" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#141d2d" />
                    <Stop offset="1" stopColor="#0a0f1a" />
                </LinearGradient>
            </Defs>

            {/* Structură compartiment motor: Traversă frontală & lonjeroane */}
            <Path
                d="M 28 42 L 312 42 L 324 315 L 16 315 Z"
                fill="url(#bayMetalGrad2)"
                stroke="#25374e"
                strokeWidth="2"
            />

            {/* Oale amortizoare (Strut Towers) */}
            <Circle cx="44" cy="170" r="20" fill="#0e1724" stroke="#374f70" strokeWidth="2" />
            <Circle cx="296" cy="170" r="20" fill="#0e1724" stroke="#374f70" strokeWidth="2" />

            {/* Radiator & Intercooler frontal (evidențiat dacă e COOLING_ELEC sau AIR_BOOST) */}
            <Rect
                x="64"
                y="50"
                width="212"
                height="30"
                rx="4"
                fill={subCategory === 'COOLING_ELEC' || subCategory === 'AIR_BOOST' ? '#14314d' : '#111e2e'}
                stroke={subCategory === 'COOLING_ELEC' ? '#10b981' : subCategory === 'AIR_BOOST' ? '#38bdf8' : '#223852'}
                strokeWidth={subCategory === 'COOLING_ELEC' || subCategory === 'AIR_BOOST' ? 1.8 : 1}
            />
            <Line x1="72" y1="60" x2="268" y2="60" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3,2" />
            <Line x1="72" y1="70" x2="268" y2="70" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3,2" />

            {/* ── ARHITECTURĂ DINAMICĂ A MOTORULUI CONFORM TOPOLOGIEI ── */}
            {topology === 'SKATEBOARD_BEV' ? (
                <G>
                    {/* Unitate propulsie electrică frontală + invertor */}
                    <Rect x="90" y="105" width="160" height="130" rx="8" fill="#0e1f30" stroke="#00f0ff" strokeWidth="2" />
                    <Circle cx="170" cy="170" r="32" fill="#091420" stroke="#10b981" strokeWidth="2" />
                    {/* Cabluri HV portocalii */}
                    <Path d="M 120 170 L 60 170" stroke="#f97316" strokeWidth="4" fill="none" />
                    <Path d="M 220 170 L 280 170" stroke="#f97316" strokeWidth="4" fill="none" />
                </G>
            ) : topology === 'TRANSVERSAL_FWD' ? (
                <G>
                    {/* Motor 4 Cilindri Transversal dispus orizontal */}
                    <Rect
                        x="75"
                        y="105"
                        width="115"
                        height="125"
                        rx="8"
                        fill="#16253c"
                        stroke={subCategory === 'FUEL_ING' ? '#4d8ef5' : '#2d4465'}
                        strokeWidth={subCategory === 'FUEL_ING' ? 2 : 1.2}
                    />
                    {[95, 115, 135, 155].map((cx, i) => (
                        <Circle key={i} cx={cx} cy="140" r="5" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Cutie transaxle în stânga/dreapta motorului */}
                    <Rect x="195" y="112" width="60" height="110" rx="6" fill="#111c2e" stroke="#2c4263" strokeWidth="1.5" />
                    {/* Turbină în spatele motorului */}
                    <Circle
                        cx="132"
                        cy="245"
                        r="16"
                        fill="#241b18"
                        stroke={subCategory === 'AIR_BOOST' ? '#f97316' : '#553322'}
                        strokeWidth={subCategory === 'AIR_BOOST' ? 2 : 1}
                    />
                </G>
            ) : topology === 'LONGITUDINAL_RWD' ? (
                <G>
                    {/* Motor 6 Cilindri Longitudinal retras spre peretele ignifug */}
                    <Rect
                        x="120"
                        y="95"
                        width="100"
                        height="160"
                        rx="8"
                        fill="#16253c"
                        stroke={subCategory === 'FUEL_ING' ? '#4d8ef5' : '#2d4465'}
                        strokeWidth={subCategory === 'FUEL_ING' ? 2 : 1.2}
                    />
                    {[115, 135, 155, 175, 195, 215].map((cy, i) => (
                        <Circle key={i} cx="170" cy={cy} r="4" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Turbină lateral stânga */}
                    <Circle
                        cx="85"
                        cy="185"
                        r="16"
                        fill="#241b18"
                        stroke={subCategory === 'AIR_BOOST' ? '#f97316' : '#553322'}
                        strokeWidth={subCategory === 'AIR_BOOST' ? 2 : 1}
                    />
                </G>
            ) : (
                <G>
                    {/* Default: Audi Longitudinal 5-Cylinder AEL */}
                    <Rect
                        x="115"
                        y="100"
                        width="110"
                        height="150"
                        rx="8"
                        fill="#16253c"
                        stroke={subCategory === 'FUEL_ING' ? '#4d8ef5' : '#2d4465'}
                        strokeWidth={subCategory === 'FUEL_ING' ? 2 : 1.2}
                    />
                    {[120, 142, 164, 186, 208].map((cy, i) => (
                        <Circle key={i} cx="170" cy={cy} r="4" fill="#223654" stroke="#4d8ef5" strokeWidth="1" />
                    ))}
                    {/* Turbină KKK cu melc */}
                    <Circle
                        cx="80"
                        cy="195"
                        r="16"
                        fill="#241b18"
                        stroke={subCategory === 'AIR_BOOST' ? '#f97316' : '#553322'}
                        strokeWidth={subCategory === 'AIR_BOOST' ? 2 : 1}
                    />
                </G>
            )}

            {/* Filtru aer / Airbox (Evidențiat dacă e AIR_BOOST) */}
            <Rect
                x="36"
                y="110"
                width="44"
                height="38"
                rx="6"
                fill={subCategory === 'AIR_BOOST' ? '#1a2e46' : '#111a26'}
                stroke={subCategory === 'AIR_BOOST' ? '#38bdf8' : '#223852'}
                strokeWidth={subCategory === 'AIR_BOOST' ? 1.8 : 1}
            />

            {/* Alternator & Baterie (Evidențiat dacă e COOLING_ELEC) */}
            <Rect
                x="245"
                y="225"
                width="50"
                height="40"
                rx="6"
                fill={subCategory === 'COOLING_ELEC' ? '#103032' : '#0d1a1c'}
                stroke={subCategory === 'COOLING_ELEC' ? '#10b981' : '#1c3d3a'}
                strokeWidth={subCategory === 'COOLING_ELEC' ? 1.8 : 1}
            />

            {/* ── RANDARE DOAR A SENZORILOR DIN SUB-CATEGORIA ACTIVĂ (Max 2-3 senzori!) ── */}
            {activeSensors.map(sensor => {
                const isSelected = selectedSensorId === sensor.id;
                const col = isSelected ? '#00f0ff' : '#10b981';

                return (
                    <G key={sensor.id}>
                        {/* Radar Pulse pe senzorul selectat */}
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

export default React.memo(EngineBaySvg);
