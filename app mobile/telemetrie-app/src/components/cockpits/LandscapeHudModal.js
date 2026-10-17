'use strict';
import React, { memo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal, StatusBar,
} from 'react-native';
import { typography, radii, spacing } from '../../theme';

const LandscapeHudModal = memo(({
    visible,
    onClose,
    liveData,
    numeric,
    dynamicRedline = 4800,
    baseRedline = 4800,
    contextualAlert = null,
    isHudMirrored = false,
    onToggleMirror,
}) => {
    if (!visible) return null;

    const m   = liveData?.motor || {};
    const tem = liveData?.temperaturi || {};
    const a   = liveData?.aer || {};
    const tr  = liveData?.transmisie || {};

    const rpm       = numeric?.rpm ?? (m.rpm ?? 0);
    const speed     = numeric?.speed ?? (m.speed ?? 0);
    const cool      = numeric?.coolant ?? (tem.coolant ?? 0);
    const oil       = tem.oil ?? 90;
    const boost     = numeric?.boost ?? (a.boost_actual ?? 0);
    const throttle  = m.throttle_pos ?? 0;
    const gear      = tr.gear ? tr.gear : 'N';
    const accelX    = liveData?.accelerometru?.accel_x ?? 0;
    const accelY    = liveData?.accelerometru?.accel_y ?? 0;

    const hudRedline = dynamicRedline || baseRedline || 4800;
    const isRedlineFlashing = rpm >= hudRedline;

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="fade"
            supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
            onRequestClose={onClose}
        >
            <View style={[
                styles.landscapeHudRoot,
                isHudMirrored && styles.hudMirrorScale,
            ]}>
                <StatusBar hidden />
                {/* Header HUD */}
                <View style={styles.hudTopBar}>
                    <View style={styles.hudBadgeGroup}>
                        <View style={styles.hudLiveBadge}>
                            <View style={styles.hudLiveDot} />
                            <Text style={styles.hudLiveText}>COCKPIT HUD</Text>
                        </View>
                        <View style={[styles.hudEcoBadge, throttle > 65 && { borderColor: '#ff2a2a' }]}>
                            <Text style={[styles.hudEcoText, throttle > 65 && { color: '#ff2a2a' }]}>
                                {throttle > 65 ? 'POWER MODE' : (throttle < 20 ? 'ECO CRUISE' : 'DYNAMIC')}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.hudActionGroup}>
                        <TouchableOpacity
                            style={[styles.hudMirrorBtn, isHudMirrored && styles.hudMirrorBtnActive]}
                            onPress={onToggleMirror}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.hudMirrorBtnText, isHudMirrored && { color: '#05070e' }]}>
                                {isHudMirrored ? '🪞 OGLINDIRĂ ACTIVĂ' : '🪞 OGLINDIRE PARBRIZ'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.hudCloseBtn}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.hudCloseBtnText}>✕ ÎNCHIDE</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Alertă de urgență dacă este activă */}
                {contextualAlert && (contextualAlert.priority === 'critical' || contextualAlert.priority === 'high') && (
                    <View style={styles.hudAlertStrip}>
                        <Text style={styles.hudAlertStripText} numberOfLines={1}>
                            ⚠️ {contextualAlert.title}: {contextualAlert.description}
                        </Text>
                    </View>
                )}

                {/* Shift Light Strip cu 12 segmente LED */}
                <View style={styles.hudShiftStrip}>
                    {Array.from({ length: 12 }).map((_, i) => {
                        const isLit = i < Math.floor((rpm / hudRedline) * 12);
                        const isRed = i >= 9;
                        const isYellow = i >= 6 && i < 9;
                        const color = isRed ? '#ff2a2a' : isYellow ? '#ffb800' : '#00f0ff';
                        return (
                            <View
                                key={i}
                                style={[
                                    styles.hudShiftPill,
                                    isLit && { backgroundColor: color, borderColor: color, shadowColor: color, shadowRadius: 6, shadowOpacity: 0.9, elevation: 5 },
                                    isLit && isRedlineFlashing && isRed && { opacity: 0.35 },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Grilă principală cockpit: 3 coloane */}
                <View style={styles.hudMainGrid}>
                    {/* Stânga: Turație & Boost & Accelerație */}
                    <View style={styles.hudColLeft}>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>TURAȚIE MOTOR</Text>
                            <Text style={styles.hudMetricCardNum}>{typeof rpm === 'number' ? rpm.toLocaleString('ro-RO') : rpm}</Text>
                            <Text style={styles.hudMetricCardUnit}>RPM</Text>
                        </View>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>PRESIUNE TURBO</Text>
                            <Text style={[styles.hudMetricCardNum, { color: '#00f0ff' }]}>{boost.toFixed(2)}</Text>
                            <Text style={styles.hudMetricCardUnit}>BAR</Text>
                        </View>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>PEDALĂ ACCELERAȚIE</Text>
                            <Text style={styles.hudMetricCardNum}>{Math.round(throttle)}%</Text>
                            <View style={styles.hudMiniTrack}>
                                <View style={[styles.hudMiniFill, { width: `${Math.min(100, Math.max(0, throttle))}%` }]} />
                            </View>
                        </View>
                    </View>

                    {/* Centru: Vitezometru Gigant & Treaptă Viteză */}
                    <View style={styles.hudColCenter}>
                        <View style={styles.hudSpeedBox}>
                            <Text style={styles.hudSpeedGiant}>{speed}</Text>
                            <Text style={styles.hudSpeedUnit}>KM/H</Text>
                        </View>

                        <View style={styles.hudGearBox}>
                            <Text style={styles.hudGearLabel}>TREAPTĂ</Text>
                            <View style={styles.hudGearPill}>
                                <Text style={styles.hudGearGiant}>{gear}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Dreapta: Temperaturi & Forțe G */}
                    <View style={styles.hudColRight}>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>LICHID RĂCIRE</Text>
                            <Text style={[styles.hudMetricCardNum, { color: cool > 100 ? '#ff2a2a' : (cool >= 80 ? '#10b981' : '#38bdf8') }]}>
                                {cool}°C
                            </Text>
                            <Text style={styles.hudMetricCardUnit}>{cool >= 80 && cool <= 95 ? 'OPTIM' : 'MONITOR'}</Text>
                        </View>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>TEMPERATURĂ ULEI</Text>
                            <Text style={[styles.hudMetricCardNum, { color: '#ffb800' }]}>{oil}°C</Text>
                            <Text style={styles.hudMetricCardUnit}>LUBRIFIERE</Text>
                        </View>
                        <View style={styles.hudMetricCard}>
                            <Text style={styles.hudMetricCardLabel}>FORȚĂ G ACCEL / FRÂNĂ</Text>
                            <Text style={styles.hudMetricCardNum}>
                                {accelX > 0 ? `+${accelX.toFixed(2)}` : accelX.toFixed(2)} G
                            </Text>
                            <Text style={styles.hudMetricCardUnit}>LATERAL: {accelY.toFixed(2)} G</Text>
                        </View>
                    </View>
                </View>

                {/* Notă instructivă la baza ecranului */}
                <View style={styles.hudBottomHint}>
                    <Text style={styles.hudBottomHintText}>
                        {isHudMirrored
                            ? '✨ Așază telefonul orizontal pe bord sub parbriz — reflexia se vede dreaptă pe sticlă.'
                            : 'Rotește telefonul orizontal în suport sau apasă 🪞 OGLINDIRE PARBRIZ noaptea.'}
                    </Text>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    landscapeHudRoot: {
        flex: 1,
        backgroundColor: '#000000',
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        justifyContent: 'space-between',
    },
    hudMirrorScale: {
        transform: [{ scaleX: -1 }],
    },
    hudTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    hudBadgeGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    hudLiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0b0f1a',
        borderColor: '#162238',
        borderWidth: 1,
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 4,
        borderRadius: radii.full,
        gap: 6,
    },
    hudLiveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    hudLiveText: {
        color: '#8b96b5',
        fontSize: 10,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.8,
    },
    hudEcoBadge: {
        borderWidth: 1,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: spacing[2],
        paddingVertical: 4,
        borderRadius: radii.full,
    },
    hudEcoText: {
        color: '#10b981',
        fontSize: 10,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.8,
    },
    hudActionGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    hudMirrorBtn: {
        backgroundColor: '#162238',
        borderWidth: 1,
        borderColor: '#00f0ff',
        paddingHorizontal: spacing[3],
        paddingVertical: 6,
        borderRadius: radii.full,
    },
    hudMirrorBtnActive: {
        backgroundColor: '#00f0ff',
    },
    hudMirrorBtnText: {
        color: '#00f0ff',
        fontSize: 11,
        fontWeight: typography.weights.heavy,
    },
    hudCloseBtn: {
        backgroundColor: 'rgba(255, 42, 42, 0.15)',
        borderWidth: 1,
        borderColor: '#ff2a2a',
        paddingHorizontal: spacing[3],
        paddingVertical: 6,
        borderRadius: radii.full,
    },
    hudCloseBtnText: {
        color: '#ff2a2a',
        fontSize: 11,
        fontWeight: typography.weights.heavy,
    },
    hudAlertStrip: {
        backgroundColor: 'rgba(255, 42, 42, 0.2)',
        borderWidth: 1,
        borderColor: '#ff2a2a',
        borderRadius: radii.xs,
        paddingHorizontal: spacing[3],
        paddingVertical: 4,
        marginBottom: spacing[2],
    },
    hudAlertStripText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: typography.weights.bold,
    },
    hudShiftStrip: {
        flexDirection: 'row',
        gap: 4,
        marginBottom: spacing[3],
    },
    hudShiftPill: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#121826',
        borderWidth: 1,
        borderColor: '#1b2438',
    },
    hudMainGrid: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[3],
    },
    hudColLeft: {
        flex: 1,
        gap: spacing[2],
    },
    hudColCenter: {
        flex: 1.4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hudColRight: {
        flex: 1,
        gap: spacing[2],
    },
    hudMetricCard: {
        backgroundColor: '#090d16',
        borderColor: '#162238',
        borderWidth: 1,
        borderRadius: radii.sm,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
    },
    hudMetricCardLabel: {
        fontSize: 9,
        color: '#8b96b5',
        fontWeight: typography.weights.bold,
        letterSpacing: 0.6,
    },
    hudMetricCardNum: {
        fontSize: 22,
        fontWeight: typography.weights.heavy,
        color: '#ffffff',
        fontVariant: ['tabular-nums'],
    },
    hudMetricCardUnit: {
        fontSize: 9,
        color: '#525d7a',
        fontWeight: typography.weights.semibold,
    },
    hudMiniTrack: {
        height: 4,
        backgroundColor: '#162238',
        borderRadius: 2,
        marginTop: 4,
        overflow: 'hidden',
    },
    hudMiniFill: {
        height: '100%',
        backgroundColor: '#00f0ff',
    },
    hudSpeedBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    hudSpeedGiant: {
        fontSize: 88,
        fontWeight: typography.weights.heavy,
        color: '#00f0ff',
        fontVariant: ['tabular-nums'],
        lineHeight: 92,
    },
    hudSpeedUnit: {
        fontSize: 14,
        color: '#8b96b5',
        fontWeight: typography.weights.heavy,
        letterSpacing: 2,
    },
    hudGearBox: {
        alignItems: 'center',
        marginTop: spacing[1],
    },
    hudGearLabel: {
        fontSize: 9,
        color: '#525d7a',
        fontWeight: typography.weights.bold,
        letterSpacing: 1,
    },
    hudGearPill: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0b0f1a',
        borderWidth: 2,
        borderColor: '#ffb800',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    hudGearGiant: {
        fontSize: 24,
        fontWeight: typography.weights.heavy,
        color: '#ffb800',
    },
    hudBottomHint: {
        alignItems: 'center',
        paddingTop: spacing[2],
    },
    hudBottomHintText: {
        fontSize: 10,
        color: '#525d7a',
        fontStyle: 'italic',
    },
});

export default LandscapeHudModal;
