import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    PanResponder, Dimensions,
} from 'react-native';
import Svg, { Rect, Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { colors, typography, radii, spacing, layout } from '../../theme';
import PropTypes from 'prop-types';

const { width: SCREEN_W } = Dimensions.get('window');

function formatMmSs(ms) {
    if (!ms || ms < 0 || isNaN(ms)) return '00:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * TelemetryReplayPlayer — Consolă de reluare dinamică a telemetriei (MoTeC / RaceChrono style).
 * Permite redarea pas-cu-pas a cursei, scrubbing pe timeline și sincronizarea cadranelor fizice.
 */
const TelemetryReplayPlayer = ({
    data = [],
    trip = null,
    alerts = [],
    onIndexChange,
    containerStyle,
}) => {
    const totalPoints = data.length;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
    const [trackWidth, setTrackWidth] = useState(SCREEN_W - 48);

    const playTimerRef = useRef(null);
    const currentIndexRef = useRef(currentIndex);
    currentIndexRef.current = currentIndex;

    // Durata estimată a cursei
    const totalDurationMs = useMemo(() => {
        if (trip?.timestamp_end && trip?.timestamp_start) {
            return Math.max(1000, trip.timestamp_end - trip.timestamp_start);
        }
        return Math.max(1000, totalPoints * 1000);
    }, [trip, totalPoints]);

    // Punctele cheie de vârf din cursă (Event Pins)
    const peakEvents = useMemo(() => {
        if (!data || data.length === 0) return [];
        let maxSpd = { val: 0, idx: 0 };
        let maxBst = { val: 0, idx: 0 };
        let maxTmp = { val: 0, idx: 0 };
        let maxRpm = { val: 0, idx: 0 };

        data.forEach((row, idx) => {
            const spd = parseFloat(row?.speed ?? row?.viteza ?? row?.motor?.speed ?? 0);
            const bst = parseFloat(row?.boost_bar ?? row?.boost ?? row?.aer?.boost_bar ?? 0);
            const tmp = parseFloat(row?.temp_apa_c ?? row?.coolant ?? row?.motor?.temp_apa_c ?? 0);
            const rpm = parseFloat(row?.rpm ?? row?.motor?.rpm ?? 0);

            if (spd > maxSpd.val) maxSpd = { val: spd, idx };
            if (bst > maxBst.val) maxBst = { val: bst, idx };
            if (tmp > maxTmp.val) maxTmp = { val: tmp, idx };
            if (rpm > maxRpm.val) maxRpm = { val: rpm, idx };
        });

        const events = [];
        if (maxSpd.val > 10) {
            events.push({
                id: 'max_spd',
                label: `🚀 Vmax ${Math.round(maxSpd.val)} km/h`,
                idx: maxSpd.idx,
                color: colors.status.good,
            });
        }
        if (maxBst.val > 0.4) {
            events.push({
                id: 'max_bst',
                label: `⚡ Peak ${maxBst.val.toFixed(2)} bar`,
                idx: maxBst.idx,
                color: colors.status.monitor,
            });
        }
        if (maxTmp.val > 70) {
            events.push({
                id: 'max_tmp',
                label: `🌡️ Max ${Math.round(maxTmp.val)}°C`,
                idx: maxTmp.idx,
                color: maxTmp.val > 100 ? colors.status.critical : colors.status.caution,
            });
        }
        if (maxRpm.val > 2500) {
            events.push({
                id: 'max_rpm',
                label: `🏁 ${Math.round(maxRpm.val)} RPM`,
                idx: maxRpm.idx,
                color: colors.accent.default,
            });
        }
        return events;
    }, [data]);

    // Notifică părintele când se schimbă cadrul activ
    const seekToIndex = useCallback((newIdx) => {
        const clamped = Math.max(0, Math.min(totalPoints - 1, Math.round(newIdx)));
        setCurrentIndex(clamped);
        onIndexChange?.(clamped, data[clamped]);
    }, [totalPoints, data, onIndexChange]);

    // Loop de redare Play/Pause
    useEffect(() => {
        if (isPlaying && totalPoints > 1) {
            const intervalMs = Math.max(40, Math.floor(200 / playbackSpeed));
            playTimerRef.current = setInterval(() => {
                const next = currentIndexRef.current + 1;
                if (next >= totalPoints) {
                    setIsPlaying(false);
                    seekToIndex(totalPoints - 1);
                } else {
                    seekToIndex(next);
                }
            }, intervalMs);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }
        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isPlaying, playbackSpeed, totalPoints, seekToIndex]);

    // PanResponder pentru cursorul timeline
    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
            setIsPlaying(false);
            const x = evt.nativeEvent.locationX;
            const pct = Math.max(0, Math.min(1, x / trackWidth));
            seekToIndex(pct * (totalPoints - 1));
        },
        onPanResponderMove: (evt) => {
            const x = evt.nativeEvent.locationX;
            const pct = Math.max(0, Math.min(1, x / trackWidth));
            seekToIndex(pct * (totalPoints - 1));
        },
        onPanResponderRelease: () => {},
    }), [trackWidth, totalPoints, seekToIndex]);

    if (!data || data.length === 0) return null;

    // Extracție date cadru curent
    const currentSample = data[currentIndex] || {};
    const speed = Math.round(parseFloat(currentSample?.speed ?? currentSample?.viteza ?? currentSample?.motor?.speed ?? 0));
    const rpm = Math.round(parseFloat(currentSample?.rpm ?? currentSample?.motor?.rpm ?? 0));
    const boost = parseFloat(currentSample?.boost_bar ?? currentSample?.boost ?? currentSample?.aer?.boost_bar ?? 0);
    const temp = Math.round(parseFloat(currentSample?.temp_apa_c ?? currentSample?.coolant ?? currentSample?.motor?.temp_apa_c ?? 0));
    const maf = Math.round(parseFloat(currentSample?.maf ?? currentSample?.aer?.maf ?? 0));
    const bsfc = Math.round(parseFloat(currentSample?.bsfc ?? currentSample?.virtual?.bsfc ?? 0));

    // Calcul treaptă de viteză
    const gear = currentSample?.treapta ?? currentSample?.gear ?? (
        speed > 105 ? 'G5' :
        speed > 72  ? 'G4' :
        speed > 44  ? 'G3' :
        speed > 22  ? 'G2' :
        speed > 4   ? 'G1' : 'N'
    );

    // Timp scurs la cadrul curent
    const progressPct = totalPoints > 1 ? currentIndex / (totalPoints - 1) : 0;
    const currentElapsedMs = progressPct * totalDurationMs;

    // Culoare RPM
    const rpmPct = Math.min(1, rpm / 5000);
    const rpmColor = rpm > 4200 ? colors.status.critical : rpm > 3200 ? colors.accentSecondary || '#ffb800' : colors.status.good;

    return (
        <View style={[styles.card, containerStyle]}>
            {/* ── Header Consola Replay ────────────────────────────────────── */}
            <View style={styles.headerRow}>
                <View style={styles.titleBadge}>
                    <Text style={styles.titleBadgeIcon}>⏱️</Text>
                    <Text style={styles.titleBadgeText}>TELEMETRIE REPLAY</Text>
                </View>
                <View style={styles.timeBadge}>
                    <Text style={styles.timeElapsedText}>{formatMmSs(currentElapsedMs)}</Text>
                    <Text style={styles.timeTotalText}> / {formatMmSs(totalDurationMs)}</Text>
                </View>
            </View>

            {/* ── Cockpit SMR (Synchronized Multi-gauge Readout) ─────────── */}
            <View style={styles.smrContainer}>
                {/* 1. Viteză & Treaptă */}
                <View style={styles.speedBox}>
                    <View style={styles.gearPill}>
                        <Text style={styles.gearText}>{gear}</Text>
                    </View>
                    <View style={styles.speedNumWrap}>
                        <Text style={styles.speedNum}>{speed}</Text>
                        <Text style={styles.speedUnit}>km/h</Text>
                    </View>
                </View>

                {/* 2. Turometru & Presiune & Temperatură */}
                <View style={styles.telemetryStatsBox}>
                    {/* RPM Bar */}
                    <View style={styles.rpmRow}>
                        <View style={styles.rpmLabelRow}>
                            <Text style={styles.rpmLabel}>RPM</Text>
                            <Text style={[styles.rpmVal, { color: rpmColor }]}>{rpm.toLocaleString()}</Text>
                        </View>
                        <View style={styles.rpmTrack}>
                            <View style={[styles.rpmFill, { width: `${Math.round(rpmPct * 100)}%`, backgroundColor: rpmColor }]} />
                        </View>
                    </View>

                    {/* Twin gauges: Boost & Temp */}
                    <View style={styles.twinGaugesRow}>
                        <View style={styles.twinPill}>
                            <Text style={styles.twinLabel}>BOOST</Text>
                            <Text style={[styles.twinVal, { color: boost > 1.3 ? colors.status.critical : colors.status.monitor }]}>
                                {boost > 0 ? boost.toFixed(2) : '0.00'} <Text style={styles.twinUnit}>bar</Text>
                            </Text>
                        </View>

                        <View style={styles.twinPill}>
                            <Text style={styles.twinLabel}>TEMP</Text>
                            <Text style={[styles.twinVal, {
                                color: temp > 100 ? colors.status.critical : temp >= 80 ? colors.status.good : colors.status.monitor
                            }]}>
                                {temp > 0 ? temp : '—'} <Text style={styles.twinUnit}>°C</Text>
                            </Text>
                        </View>

                        {maf > 0 && (
                            <View style={styles.twinPill}>
                                <Text style={styles.twinLabel}>MAF</Text>
                                <Text style={[styles.twinVal, { color: '#38bdf8' }]}>
                                    {maf} <Text style={styles.twinUnit}>g/s</Text>
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* ── Timeline Scrubber Track ─────────────────────────────────── */}
            <View
                style={styles.scrubberContainer}
                onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
            >
                <View style={styles.trackBg}>
                    <View style={[styles.trackFill, { width: `${Math.round(progressPct * 100)}%` }]} />
                </View>

                {/* Cursor Thumb iluminat */}
                <View
                    style={[
                        styles.thumb,
                        { left: Math.max(0, Math.min(trackWidth - 18, (progressPct * trackWidth) - 9)) }
                    ]}
                >
                    <View style={styles.thumbInner} />
                </View>
            </View>

            {/* ── Quick Event Snap Pills (Peak Markers) ──────────────────── */}
            {peakEvents.length > 0 && (
                <View style={styles.eventPinsRow}>
                    {peakEvents.map((ev) => (
                        <TouchableOpacity
                            key={ev.id}
                            style={[
                                styles.eventPinBtn,
                                Math.abs(currentIndex - ev.idx) <= 2 && styles.eventPinBtnActive
                            ]}
                            onPress={() => seekToIndex(ev.idx)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`Sari la ${ev.label}`}
                        >
                            <Text style={[styles.eventPinText, { color: ev.color }]}>{ev.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* ── Controale Player (Play, Pauză, 1x/2x/4x, Reset) ───────── */}
            <View style={styles.controlsRow}>
                {/* Reset / Rewind */}
                <TouchableOpacity
                    style={styles.ctrlBtnSecondary}
                    onPress={() => seekToIndex(0)}
                    accessibilityRole="button"
                    accessibilityLabel="Reia de la început"
                >
                    <Text style={styles.ctrlIconText}>⏮️</Text>
                </TouchableOpacity>

                {/* Play / Pause Principal */}
                <TouchableOpacity
                    style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                    onPress={() => setIsPlaying(!isPlaying)}
                    accessibilityRole="button"
                    accessibilityLabel={isPlaying ? "Pauză reluare" : "Redă telemetrie"}
                >
                    <Text style={styles.playBtnText}>{isPlaying ? '⏸️ PAUZĂ' : '▶️ REDĂ TELEMETRIE'}</Text>
                </TouchableOpacity>

                {/* Viteză playback: 1x / 2x / 4x */}
                <TouchableOpacity
                    style={styles.speedBtn}
                    onPress={() => setPlaybackSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Viteză redare ${playbackSpeed}x`}
                >
                    <Text style={styles.speedBtnText}>{playbackSpeed}x</Text>
                </TouchableOpacity>
            </View>

            {/* Subtext info */}
            <View style={styles.footerRow}>
                <Text style={styles.footerText}>
                    Cadru: {currentIndex + 1} / {totalPoints} · Glisează pe bară pentru scrub orizontal
                </Text>
            </View>
        </View>
    );
};

TelemetryReplayPlayer.propTypes = {
    data: PropTypes.array.isRequired,
    trip: PropTypes.object,
    alerts: PropTypes.array,
    onIndexChange: PropTypes.func,
    containerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1] || '#0d131f',
        borderRadius: radii.xl || 16,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.border.default || '#1e293b',
        marginBottom: spacing[4],
        overflow: 'hidden',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
    },
    titleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    titleBadgeIcon: {
        fontSize: 16,
    },
    titleBadgeText: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        color: colors.accent.default || '#00f0ff',
        letterSpacing: 0.8,
    },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'baseline',
        backgroundColor: colors.bg[2] || '#161f30',
        paddingHorizontal: spacing[2] + 2,
        paddingVertical: 3,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.subtle || '#23324a',
    },
    timeElapsedText: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.bold,
        color: '#FFFFFF',
        fontVariant: ['tabular-nums'],
    },
    timeTotalText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary || '#94a3b8',
        fontVariant: ['tabular-nums'],
    },
    smrContainer: {
        flexDirection: 'row',
        backgroundColor: colors.bg[0] || '#05070e',
        borderRadius: radii.lg || 12,
        padding: spacing[3],
        borderWidth: 1,
        borderColor: colors.border.subtle || '#1e293b',
        marginBottom: spacing[3],
        alignItems: 'center',
        gap: spacing[3],
    },
    speedBox: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: colors.border.subtle || '#23324a',
        paddingRight: spacing[3],
        minWidth: 84,
    },
    gearPill: {
        backgroundColor: 'rgba(255, 184, 0, 0.15)',
        borderColor: '#ffb800',
        borderWidth: 1,
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.sm,
        marginBottom: 2,
    },
    gearText: {
        fontSize: 12,
        fontWeight: typography.weights.heavy,
        color: '#ffb800',
        fontVariant: ['tabular-nums'],
    },
    speedNumWrap: {
        alignItems: 'center',
    },
    speedNum: {
        fontSize: 32,
        fontWeight: typography.weights.heavy,
        color: colors.accent.default || '#00f0ff',
        fontVariant: ['tabular-nums'],
        lineHeight: 36,
    },
    speedUnit: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary || '#94a3b8',
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
    },
    telemetryStatsBox: {
        flex: 1,
    },
    rpmRow: {
        marginBottom: spacing[2],
    },
    rpmLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 3,
    },
    rpmLabel: {
        fontSize: typography.sizes.micro,
        color: colors.text.secondary || '#94a3b8',
        fontWeight: typography.weights.bold,
    },
    rpmVal: {
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.heavy,
        fontVariant: ['tabular-nums'],
    },
    rpmTrack: {
        height: 6,
        backgroundColor: colors.bg[2] || '#1a2436',
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    rpmFill: {
        height: 6,
        borderRadius: radii.full,
    },
    twinGaugesRow: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    twinPill: {
        flex: 1,
        backgroundColor: colors.bg[2] || '#131b2b',
        borderRadius: radii.sm,
        paddingVertical: 3,
        paddingHorizontal: 4,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border.subtle || '#23324a',
    },
    twinLabel: {
        fontSize: 8,
        fontWeight: typography.weights.bold,
        color: colors.text.disabled || '#64748b',
        marginBottom: 1,
    },
    twinVal: {
        fontSize: 12,
        fontWeight: typography.weights.bold,
        fontVariant: ['tabular-nums'],
    },
    twinUnit: {
        fontSize: 8,
        color: colors.text.secondary || '#94a3b8',
    },
    scrubberContainer: {
        height: 28,
        justifyContent: 'center',
        position: 'relative',
        marginBottom: spacing[2],
    },
    trackBg: {
        height: 8,
        backgroundColor: colors.bg[2] || '#1e293b',
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    trackFill: {
        height: 8,
        backgroundColor: colors.accent.default || '#00f0ff',
        borderRadius: radii.full,
    },
    thumb: {
        position: 'absolute',
        top: 5,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.accent.default || '#00f0ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 6,
    },
    thumbInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accent.default || '#00f0ff',
    },
    eventPinsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[1] + 2,
        marginBottom: spacing[3],
    },
    eventPinBtn: {
        backgroundColor: colors.bg[0] || '#05070e',
        paddingHorizontal: spacing[2],
        paddingVertical: 4,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.subtle || '#1e293b',
    },
    eventPinBtnActive: {
        borderColor: colors.accent.default || '#00f0ff',
        backgroundColor: 'rgba(0, 240, 255, 0.1)',
    },
    eventPinText: {
        fontSize: typography.sizes.micro,
        fontWeight: typography.weights.bold,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    ctrlBtnSecondary: {
        width: 42,
        height: 42,
        backgroundColor: colors.bg[2] || '#161f30',
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border.default || '#23324a',
    },
    ctrlIconText: {
        fontSize: 16,
    },
    playBtn: {
        flex: 1,
        height: 42,
        backgroundColor: colors.accent.default || '#00f0ff',
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.accent.default || '#00f0ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 4,
    },
    playBtnActive: {
        backgroundColor: colors.accentSecondary || '#ffb800',
    },
    playBtnText: {
        color: '#05070e',
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    speedBtn: {
        width: 44,
        height: 42,
        backgroundColor: colors.bg[2] || '#161f30',
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border.default || '#23324a',
    },
    speedBtnText: {
        color: colors.text.primary,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.heavy,
    },
    footerRow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerText: {
        fontSize: typography.sizes.micro - 1,
        color: colors.text.disabled || '#64748b',
    },
});

export default TelemetryReplayPlayer;
