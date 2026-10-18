import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
    Rect, Path, Circle, Text as SvgText, Defs, LinearGradient, Stop, G, Line
} from 'react-native-svg';
import PropTypes from 'prop-types';

/**
 * CockpitVisualPreview — Redare vectorială SVG micro-viewport pentru șabloanele de bord
 * Folosit în SettingsScreen pentru a previzualiza fidel geometria fiecărui cockpit.
 */
const CockpitVisualPreview = ({ templateId, isSelected = false, width = 135, height = 70 }) => {
    switch (templateId) {
        case 'MOTORSPORT': {
            return (
                <View style={[styles.container, { width, height }]}>
                    <Svg width={width} height={height} viewBox="0 0 135 70">
                        {/* Background */}
                        <Rect x="0" y="0" width="135" height="70" rx="8" fill="#05070e" stroke={isSelected ? '#00f0ff' : '#162238'} strokeWidth="1" />

                        {/* Top Shift Light Strip (8 LEDs) */}
                        <G y="5">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                                const ledColor = i < 4 ? '#10b981' : i < 6 ? '#ffb800' : '#ff2a2a';
                                const active = i < 6;
                                return (
                                    <Rect
                                        key={i}
                                        x={18 + i * 12}
                                        y="0"
                                        width="9"
                                        height="4"
                                        rx="1"
                                        fill={active ? ledColor : '#1e293b'}
                                        opacity={active ? 1 : 0.4}
                                    />
                                );
                            })}
                        </G>

                        {/* Central Radial Tachometer */}
                        <Circle cx="67" cy="40" r="21" stroke="#162238" strokeWidth="3" fill="none" />
                        <Path
                            d="M 50 54 A 21 21 0 1 1 84 54"
                            stroke="#00f0ff"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            fill="none"
                        />
                        {/* Redline sector */}
                        <Path
                            d="M 76 22 A 21 21 0 0 1 84 54"
                            stroke="#ff2a2a"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            fill="none"
                        />

                        {/* Gear & Speed inside Tachometer */}
                        <SvgText x="67" y="36" fill="#ffb800" fontSize="9" fontWeight="900" textAnchor="middle">G4</SvgText>
                        <SvgText x="67" y="47" fill="#00f0ff" fontSize="11" fontWeight="900" textAnchor="middle">104</SvgText>

                        {/* Left mini performance block */}
                        <Rect x="6" y="22" width="26" height="34" rx="3" fill="#0b0f1a" stroke="#162238" strokeWidth="0.8" />
                        <SvgText x="19" y="32" fill="#64748b" fontSize="5" fontWeight="bold" textAnchor="middle">BOOST</SvgText>
                        <SvgText x="19" y="42" fill="#00f0ff" fontSize="8" fontWeight="bold" textAnchor="middle">1.25</SvgText>
                        <SvgText x="19" y="50" fill="#94a3b8" fontSize="5" textAnchor="middle">bar</SvgText>

                        {/* Right mini performance block */}
                        <Rect x="103" y="22" width="26" height="34" rx="3" fill="#0b0f1a" stroke="#162238" strokeWidth="0.8" />
                        <SvgText x="116" y="32" fill="#64748b" fontSize="5" fontWeight="bold" textAnchor="middle">DYNO</SvgText>
                        <SvgText x="116" y="42" fill="#ffb800" fontSize="8" fontWeight="bold" textAnchor="middle">142</SvgText>
                        <SvgText x="116" y="50" fill="#94a3b8" fontSize="5" textAnchor="middle">CP</SvgText>
                    </Svg>
                </View>
            );
        }

        case 'AUDI_RS': {
            return (
                <View style={[styles.container, { width, height }]}>
                    <Svg width={width} height={height} viewBox="0 0 135 70">
                        {/* Background */}
                        <Rect x="0" y="0" width="135" height="70" rx="8" fill="#08080a" stroke={isSelected ? '#ff2a2a' : '#2a1a1c'} strokeWidth="1" />

                        {/* RS Badge */}
                        <Rect x="8" y="7" width="18" height="6" rx="1.5" fill="#ff2a2a" />
                        <SvgText x="17" y="12" fill="#FFFFFF" fontSize="5" fontWeight="900" textAnchor="middle">RS</SvgText>

                        {/* Boomerang Hockey-Stick Tachometer Bar */}
                        <Path
                            d="M 10 24 L 74 24 L 92 12"
                            stroke="#ff2a2a"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                        />
                        <Path
                            d="M 92 12 L 100 7"
                            stroke="#ffffff"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            fill="none"
                        />

                        {/* Center Speed & Gear */}
                        <SvgText x="44" y="46" fill="#FFFFFF" fontSize="18" fontWeight="900" textAnchor="middle">112</SvgText>
                        <SvgText x="44" y="56" fill="#94a3b8" fontSize="6" fontWeight="bold" textAnchor="middle">km/h</SvgText>

                        {/* Gear Box */}
                        <Rect x="12" y="34" width="14" height="14" rx="2" fill="#18181f" stroke="#ff2a2a" strokeWidth="0.8" />
                        <SvgText x="19" y="44" fill="#ff2a2a" fontSize="8" fontWeight="bold" textAnchor="middle">G5</SvgText>

                        {/* Right: G-Force Radar Meter */}
                        <Circle cx="106" cy="43" r="16" stroke="#2a1a1c" strokeWidth="1" fill="#121318" />
                        <Circle cx="106" cy="43" r="8" stroke="#332024" strokeWidth="0.8" fill="none" />
                        <Line x1="90" y1="43" x2="122" y2="43" stroke="#332024" strokeWidth="0.8" />
                        <Line x1="106" y1="27" x2="106" y2="59" stroke="#332024" strokeWidth="0.8" />
                        {/* Dynamic Red Dot */}
                        <Circle cx="109" cy="39" r="2.8" fill="#ff2a2a" />
                        <SvgText x="106" y="66" fill="#94a3b8" fontSize="5" textAnchor="middle">0.42 G</SvgText>
                    </Svg>
                </View>
            );
        }

        case 'TESLA_MINIMAL': {
            return (
                <View style={[styles.container, { width, height }]}>
                    <Svg width={width} height={height} viewBox="0 0 135 70">
                        {/* Background */}
                        <Rect x="0" y="0" width="135" height="70" rx="8" fill="#08090d" stroke={isSelected ? '#38bdf8' : '#1a202c'} strokeWidth="1" />

                        {/* Horizon Power & Regen Bar */}
                        <Rect x="14" y="8" width="50" height="3" rx="1.5" fill="#10b981" />
                        <Rect x="68" y="8" width="53" height="3" rx="1.5" fill="#38bdf8" />
                        <Circle cx="66" cy="9.5" r="3" fill="#FFFFFF" />

                        {/* PRND Drive Selector */}
                        <SvgText x="67" y="24" fill="#64748b" fontSize="7" fontWeight="bold" textAnchor="middle">
                            P   R   N   <SvgText fill="#38bdf8" fontWeight="900">[D]</SvgText>
                        </SvgText>

                        {/* Giant Minimal Speed */}
                        <SvgText x="67" y="47" fill="#f8fafc" fontSize="20" fontWeight="300" textAnchor="middle">90</SvgText>
                        <SvgText x="67" y="55" fill="#64748b" fontSize="6" fontWeight="bold" textAnchor="middle">KM/H</SvgText>

                        {/* 3 Clean Bottom Indicator Dots */}
                        <SvgText x="28" y="64" fill="#94a3b8" fontSize="5" textAnchor="middle">88°C</SvgText>
                        <SvgText x="67" y="64" fill="#94a3b8" fontSize="5" textAnchor="middle">215 g/kWh</SvgText>
                        <SvgText x="106" y="64" fill="#94a3b8" fontSize="5" textAnchor="middle">1.1 bar</SvgText>
                    </Svg>
                </View>
            );
        }

        case 'NIGHT_HUD': {
            return (
                <View style={[styles.container, { width, height }]}>
                    <Svg width={width} height={height} viewBox="0 0 135 70">
                        {/* Pure AMOLED Black Background */}
                        <Rect x="0" y="0" width="135" height="70" rx="8" fill="#000000" stroke={isSelected ? '#ff453a' : '#2a1010'} strokeWidth="1" />

                        {/* HUD Mirror Indicator Badge */}
                        <Rect x="36" y="6" width="63" height="8" rx="2" fill="rgba(255, 69, 58, 0.15)" stroke="#ff453a" strokeWidth="0.6" />
                        <SvgText x="67" y="12" fill="#ff453a" fontSize="5" fontWeight="bold" textAnchor="middle">🪞 PROIECȚIE HUD</SvgText>

                        {/* Giant Neon Red Speed */}
                        <SvgText x="67" y="44" fill="#ff453a" fontSize="22" fontWeight="900" textAnchor="middle">108</SvgText>
                        <SvgText x="67" y="54" fill="#ff9f0a" fontSize="8" fontWeight="bold" textAnchor="middle">KM/H · G5</SvgText>

                        {/* Borderless night stats */}
                        <SvgText x="25" y="64" fill="#ff453a" fontSize="6" fontWeight="bold" textAnchor="middle">89°C</SvgText>
                        <SvgText x="67" y="64" fill="#ff9f0a" fontSize="6" fontWeight="bold" textAnchor="middle">3,100 RPM</SvgText>
                        <SvgText x="108" y="64" fill="#ff453a" fontSize="6" fontWeight="bold" textAnchor="middle">1.25 bar</SvgText>
                    </Svg>
                </View>
            );
        }

        default:
            return null;
    }
};

CockpitVisualPreview.propTypes = {
    templateId: PropTypes.string.isRequired,
    isSelected: PropTypes.bool,
    width: PropTypes.number,
    height: PropTypes.number,
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
});

export default React.memo(CockpitVisualPreview);
