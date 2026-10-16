import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
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
import { colors, typography, radii, spacing } from '../../theme';
import PropTypes from 'prop-types';

const HOTSPOT_COORDS = {
    racire:     { x: 160, y: 48,  label: 'RĂCIRE',      side: 'top'   },
    turbo:      { x: 92,  y: 116, label: 'TURBO',       side: 'left'  },
    motor:      { x: 160, y: 114, label: 'MOTOR AEL',   side: 'right' },
    electric:   { x: 228, y: 116, label: 'BATERIE/ECU', side: 'right' },
    transmisie: { x: 160, y: 190, label: 'TRANSMISIE',  side: 'left'  },
    dpf:        { x: 182, y: 272, label: 'DPF/EMISII',  side: 'right' },
};

function getScoreColor(score) {
    if (score == null)  return colors.text.secondary;
    if (score >= 90)    return colors.status.optimal;
    if (score >= 75)    return colors.status.good;
    if (score >= 55)    return colors.status.monitor;
    if (score >= 35)    return colors.status.caution;
    return colors.status.critical;
}

const InteractiveCarXRay = ({
    subsystems = {},
    selectedKey = null,
    onSelectSubsystem,
    style,
}) => {
    // Pulse animation for node halos
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.25,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    const handlePress = (key) => {
        if (onSelectSubsystem) {
            const data = subsystems[key] || { key, name: key };
            onSelectSubsystem(key, data);
        }
    };

    return (
        <View style={[styles.container, style]}>
            {/* ── Technical Header Title ── */}
            <View style={styles.headerRow}>
                <View style={styles.headerTag}>
                    <Text style={styles.headerTagText}>🔬 X-RAY CHASSIS VIEW</Text>
                </View>
                <Text style={styles.headerHint}>Atinge componentele pentru detalii</Text>
            </View>

            {/* ── Vector Schematic Canvas ── */}
            <View style={styles.canvasWrap}>
                <Svg width="100%" height={380} viewBox="0 0 320 440" style={styles.svg}>
                    <Defs>
                        {/* Blueprint grid pattern gradient */}
                        <LinearGradient id="chassisGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#1a2538" stopOpacity="0.8" />
                            <Stop offset="0.5" stopColor="#0c1220" stopOpacity="0.95" />
                            <Stop offset="1" stopColor="#1a2538" stopOpacity="0.8" />
                        </LinearGradient>
                        <LinearGradient id="neonGlow" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor="#00f0ff" stopOpacity="0.6" />
                            <Stop offset="1" stopColor="#4d8ef5" stopOpacity="0.4" />
                        </LinearGradient>
                    </Defs>

                    {/* ── 1. CAR BODY SILHOUETTE (Audi A6 C4 Top-Down Outline) ── */}
                    {/* Shadow / Glow layer */}
                    <Path
                        d="M 120 18 C 145 14, 175 14, 200 18 C 220 22, 240 38, 246 65 C 254 95, 252 140, 254 210 C 254 270, 256 345, 248 385 C 242 412, 225 428, 198 432 C 172 436, 148 436, 122 432 C 95 428, 78 412, 72 385 C 64 345, 66 270, 66 210 C 68 140, 66 95, 74 65 C 80 38, 100 22, 120 18 Z"
                        fill="url(#chassisGrad)"
                        stroke="#22324e"
                        strokeWidth="2.5"
                    />

                    {/* Inner styling lines (Hood, Windshield, Roof, Trunk) */}
                    {/* Radiator grille arc */}
                    <Path d="M 125 24 Q 160 20 195 24" stroke="#3d5275" strokeWidth="2" fill="none" />
                    <Line x1="135" y1="28" x2="185" y2="28" stroke="#3d5275" strokeWidth="1.5" />

                    {/* Front hood crease lines */}
                    <Path d="M 105 32 L 115 130" stroke="#1f2c42" strokeWidth="1.5" strokeDasharray="3,3" />
                    <Path d="M 215 32 L 205 130" stroke="#1f2c42" strokeWidth="1.5" strokeDasharray="3,3" />

                    {/* Windshield */}
                    <Path
                        d="M 94 135 C 130 142, 190 142, 226 135 L 234 178 C 185 186, 135 186, 86 178 Z"
                        fill="#0e1726"
                        stroke="#2a3f5f"
                        strokeWidth="1.5"
                    />

                    {/* Roof */}
                    <Rect x="88" y="186" width="144" height="95" rx="8" fill="#090e18" stroke="#1e2c44" strokeWidth="1.5" />

                    {/* Rear Windshield */}
                    <Path
                        d="M 88 286 C 135 281, 185 281, 232 286 L 226 324 C 180 329, 140 329, 94 324 Z"
                        fill="#0e1726"
                        stroke="#2a3f5f"
                        strokeWidth="1.5"
                    />

                    {/* Trunk lid */}
                    <Path d="M 96 332 L 224 332" stroke="#1f2c42" strokeWidth="1.5" strokeDasharray="3,3" />
                    <Path d="M 115 422 Q 160 426 205 422" stroke="#3d5275" strokeWidth="2" fill="none" />

                    {/* ── 2. FOUR WHEELS WITH TIRES & BRAKE DISCS ── */}
                    {/* Front-Left */}
                    <Rect x="42" y="62" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
                    <Rect x="49" y="74" width="12" height="34" rx="2" fill="#202c40" />

                    {/* Front-Right */}
                    <Rect x="252" y="62" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
                    <Rect x="259" y="74" width="12" height="34" rx="2" fill="#202c40" />

                    {/* Rear-Left */}
                    <Rect x="42" y="325" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
                    <Rect x="49" y="337" width="12" height="34" rx="2" fill="#202c40" />

                    {/* Rear-Right */}
                    <Rect x="252" y="325" width="26" height="58" rx="6" fill="#121824" stroke="#324461" strokeWidth="2" />
                    <Rect x="259" y="337" width="12" height="34" rx="2" fill="#202c40" />

                    {/* Front & Rear Axles */}
                    <Line x1="68" y1="91" x2="252" y2="91" stroke="#25354d" strokeWidth="2.5" />
                    <Line x1="68" y1="354" x2="252" y2="354" stroke="#25354d" strokeWidth="2.5" />

                    {/* ── 3. MECHANICAL BLUEPRINTS ── */}
                    {/* Radiator Core & Cooling */}
                    <Rect x="120" y="38" width="80" height="20" rx="4" fill="#152438" stroke="#2a456c" strokeWidth="1.5" />
                    <Line x1="126" y1="44" x2="194" y2="44" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
                    <Line x1="126" y1="52" x2="194" y2="52" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />

                    {/* 5-Cylinder Engine Block (Longitudinal AEL) */}
                    <Rect x="135" y="80" width="50" height="68" rx="6" fill="#172233" stroke="#3d5880" strokeWidth="2" />
                    {/* 5 cylinders */}
                    {[88, 100, 112, 124, 136].map((cy, i) => (
                        <Circle key={i} cx="160" cy={cy} r="4.5" fill="#24344d" stroke="#4d8ef5" strokeWidth="1" />
                    ))}

                    {/* Turbocharger & Manifold (Left side of engine) */}
                    <Path
                        d="M 135 105 L 115 108 C 102 110, 102 125, 114 127 L 135 125 Z"
                        fill="#1f1828"
                        stroke="#f0883e"
                        strokeWidth="1.5"
                    />
                    <Circle cx="106" cy="117" r="7" fill="#2e1f38" stroke="#ff8800" strokeWidth="1.5" />

                    {/* Battery / ECU Module (Right side of cowl) */}
                    <Rect x="206" y="102" width="30" height="28" rx="3" fill="#102528" stroke="#2fcfa4" strokeWidth="1.5" />
                    <Line x1="212" y1="108" x2="218" y2="108" stroke="#2fcfa4" strokeWidth="1.5" />
                    <Line x1="215" y1="105" x2="215" y2="111" stroke="#2fcfa4" strokeWidth="1.5" />
                    <Line x1="224" y1="108" x2="230" y2="108" stroke="#ff453a" strokeWidth="1.5" />

                    {/* Gearbox / Transmission Bellhousing & Tunnel */}
                    <Path
                        d="M 142 148 L 178 148 L 172 215 L 148 215 Z"
                        fill="#151d2a"
                        stroke="#334766"
                        strokeWidth="1.5"
                    />
                    <Line x1="160" y1="150" x2="160" y2="215" stroke="#4d8ef5" strokeWidth="1.5" strokeDasharray="3,3" />

                    {/* Exhaust line & DPF / Catalytic Canister */}
                    <Path
                        d="M 112 127 C 112 165, 138 210, 142 235 L 175 250"
                        stroke="#523924"
                        strokeWidth="2"
                        fill="none"
                    />
                    <Rect x="166" y="248" width="28" height="48" rx="6" fill="#241b18" stroke="#e07530" strokeWidth="1.5" />
                    {/* Ceramic core mesh lines */}
                    <Line x1="171" y1="260" x2="189" y2="260" stroke="#f0883e" strokeWidth="1" strokeDasharray="2,2" />
                    <Line x1="171" y1="272" x2="189" y2="272" stroke="#f0883e" strokeWidth="1" strokeDasharray="2,2" />
                    <Line x1="171" y1="284" x2="189" y2="284" stroke="#f0883e" strokeWidth="1" strokeDasharray="2,2" />

                    {/* Exhaust tailpipe */}
                    <Path d="M 180 296 L 180 370 C 180 395, 145 405, 145 428" stroke="#3d495c" strokeWidth="2" fill="none" />

                    {/* ── 4. TECHNICAL ANCHORS (Connecting Dashed Lines) ── */}
                    {Object.entries(HOTSPOT_COORDS).map(([key, item]) => {
                        const sub = subsystems[key] || {};
                        const col = getScoreColor(sub.score);
                        const isSelected = selectedKey === key;

                        return (
                            <G key={key}>
                                {/* Outer pulsing aura ring */}
                                <Circle
                                    cx={item.x}
                                    cy={item.y}
                                    r={isSelected ? 18 : 14}
                                    fill={col}
                                    fillOpacity={isSelected ? 0.35 : 0.18}
                                    stroke={col}
                                    strokeWidth={isSelected ? 2 : 1}
                                    strokeDasharray={isSelected ? undefined : '2,2'}
                                />
                                {/* Center solid node */}
                                <Circle
                                    cx={item.x}
                                    cy={item.y}
                                    r={isSelected ? 7 : 5.5}
                                    fill={col}
                                    stroke="#07080e"
                                    strokeWidth={2}
                                />
                            </G>
                        );
                    })}
                </Svg>

                {/* ── 5. TOUCHABLE HOTSPOTS OVERLAY (Interactive Mobile Targets) ── */}
                {Object.entries(HOTSPOT_COORDS).map(([key, item]) => {
                    const sub = subsystems[key] || {};
                    const score = sub.score != null ? sub.score : 90;
                    const col = getScoreColor(score);
                    const isSelected = selectedKey === key;

                    // Convert SVG coordinate space (0-320 x 0-440) to percentage
                    const leftPct = (item.x / 320) * 100;
                    const topPct  = (item.y / 440) * 100;

                    const isLeftSide = item.side === 'left';
                    const isTop      = item.side === 'top';

                    return (
                        <TouchableOpacity
                            key={key}
                            style={[
                                styles.touchTarget,
                                {
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    transform: [{ translateX: -20 }, { translateY: -20 }],
                                },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => handlePress(key)}
                            accessibilityRole="button"
                            accessibilityLabel={`Subsistem ${item.label}, scor ${score}%`}
                        >
                            {/* Visual Touch Hub */}
                            <View style={[styles.pulseRing, { borderColor: col }, isSelected && styles.pulseRingSelected]} />

                            {/* Label Pill */}
                            <View style={[
                                styles.pillBadge,
                                isLeftSide ? styles.pillLeft : isTop ? styles.pillTop : styles.pillRight,
                                { borderColor: isSelected ? col : colors.border.strong },
                                isSelected && { backgroundColor: 'rgba(15, 23, 42, 0.95)' }
                            ]}>
                                <Text style={[styles.pillScore, { color: col }]}>{score}%</Text>
                                <Text style={styles.pillText}>{item.label}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Bottom X-Ray Legend / Quick Bar ── */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.status.optimal }]} />
                    <Text style={styles.legendText}>Optim (&gt;90%)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.status.good }]} />
                    <Text style={styles.legendText}>Bun (75-89%)</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.status.monitor }]} />
                    <Text style={styles.legendText}>Monitor (&lt;75%)</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: spacing[3],
        marginVertical: spacing[2],
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
        paddingHorizontal: spacing[1],
    },
    headerTag: {
        backgroundColor: 'rgba(77, 142, 245, 0.12)',
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: 'rgba(77, 142, 245, 0.3)',
    },
    headerTagText: {
        color: colors.accent.default,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
    },
    headerHint: {
        color: colors.text.tertiary,
        fontSize: typography.sizes.micro,
    },
    canvasWrap: {
        position: 'relative',
        width: '100%',
        height: 380,
        alignItems: 'center',
        justifyContent: 'center',
    },
    svg: {
        width: '100%',
        height: 380,
    },
    touchTarget: {
        position: 'absolute',
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    pulseRing: {
        width: 28,
        height: 28,
        borderRadius: radii.full,
        borderWidth: 1.5,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    pulseRingSelected: {
        width: 34,
        height: 34,
        borderWidth: 2.5,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pillBadge: {
        position: 'absolute',
        backgroundColor: 'rgba(8, 12, 22, 0.90)',
        borderWidth: 1,
        borderRadius: radii.xs,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 4,
    },
    pillRight: {
        left: 36,
        top: 6,
    },
    pillLeft: {
        right: 36,
        top: 6,
    },
    pillTop: {
        bottom: 34,
        left: -16,
    },
    pillScore: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    pillText: {
        color: colors.text.primary,
        fontSize: 9,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.4,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[4],
        marginTop: spacing[2],
        paddingTop: spacing[2],
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: radii.full,
    },
    legendText: {
        color: colors.text.tertiary,
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.medium,
    },
});

export default InteractiveCarXRay;

InteractiveCarXRay.propTypes = {
    subsystems: PropTypes.object,
    selectedKey: PropTypes.string,
    onSelectSubsystem: PropTypes.func,
    style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};
