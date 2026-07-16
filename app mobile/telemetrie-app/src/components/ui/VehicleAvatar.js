/**
 * VehicleAvatar — identitatea vizuală a vehiculului.
 *
 * Afișează un ring colorat după status, icon specific tipului de
 * combustibil și un badge mic cu starea generală. Folosit în HeroCard-urile
 * principale și în header-ele de ecran.
 *
 * @prop {'optimal'|'good'|'monitor'|'caution'|'critical'|'neutral'}  status
 * @prop {'DIESEL'|'BENZINA'|'GPL'|'HYBRID'|'ELECTRIC'}  fuelType
 * @prop {'sm'|'md'|'lg'}  size
 * @prop {boolean}  showBadge       afișează badge-ul de stare (default true)
 * @prop {object}   style
 */

import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography, motion } from '../../theme';

// ── Config ────────────────────────────────────────────────────────────────────

const SIZES = {
    sm: { outer: 44, inner: 34, icon: 18, badge: 10, ringWidth: 2 },
    md: { outer: 60, inner: 48, icon: 24, badge: 11, ringWidth: 2.5 },
    lg: { outer: 76, inner: 62, icon: 30, badge: 12, ringWidth: 3 },
};

const STATUS_RING = {
    optimal:  colors.status.optimal,
    good:     colors.status.good,
    monitor:  colors.status.monitor,
    caution:  colors.status.caution,
    critical: colors.status.critical,
    neutral:  colors.border.strong,
};

const STATUS_BADGE = {
    optimal:  { label: 'READY',  bg: colors.tint.optimal,  text: colors.status.optimal  },
    good:     { label: 'READY',  bg: colors.tint.good,     text: colors.status.good     },
    monitor:  { label: 'ATENȚIE', bg: colors.tint.monitor, text: colors.status.monitor  },
    caution:  { label: 'VERIFICARE', bg: colors.tint.caution, text: colors.status.caution },
    critical: { label: 'URGENT', bg: colors.tint.critical, text: colors.status.critical  },
    neutral:  null,
};

const FUEL_ICON = {
    DIESEL:   '🚗',
    BENZINA:  '🚗',
    GPL:      '🚗',
    HYBRID:   '🔋',
    ELECTRIC: '⚡',
};

// ── Component ─────────────────────────────────────────────────────────────────

const VehicleAvatar = React.memo(({
    status    = 'neutral',
    fuelType  = 'DIESEL',
    size      = 'md',
    showBadge = true,
    style,
}) => {
    const mountAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(mountAnim, {
            toValue: 1,
            duration: motion.duration.normal,
            delay: 80,
            useNativeDriver: true,
        }).start();
    }, []);

    const dim    = SIZES[size]    || SIZES.md;
    const ring   = STATUS_RING[status]  || STATUS_RING.neutral;
    const badge  = STATUS_BADGE[status] || null;
    const icon   = FUEL_ICON[fuelType]  || '🚗';

    const containerSize = dim.outer + (showBadge && badge ? 14 : 0);

    return (
        <Animated.View
            style={[
                styles.root,
                { width: dim.outer, minHeight: containerSize },
                { opacity: mountAnim, transform: [{ scale: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] },
                style,
            ]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Vehicul · Status: ${badge?.label || 'neutru'}`}
        >
            {/* Ring + inner */}
            <View
                style={[
                    styles.ring,
                    {
                        width:        dim.outer,
                        height:       dim.outer,
                        borderRadius: dim.outer / 2,
                        borderWidth:  dim.ringWidth,
                        borderColor:  ring,
                    },
                ]}
            >
                <View
                    style={[
                        styles.inner,
                        {
                            width:        dim.inner,
                            height:       dim.inner,
                            borderRadius: dim.inner / 2,
                        },
                    ]}
                >
                    <Text style={{ fontSize: dim.icon, lineHeight: dim.icon + 4 }}>
                        {icon}
                    </Text>
                </View>
            </View>

            {/* Badge */}
            {showBadge && badge ? (
                <View
                    style={[
                        styles.badge,
                        {
                            backgroundColor: badge.bg,
                            borderColor:     badge.text,
                            marginTop:       spacing[1] - 2,
                        },
                    ]}
                >
                    <Text style={[styles.badgeText, { color: badge.text, fontSize: dim.badge }]}>
                        {badge.label}
                    </Text>
                </View>
            ) : null}
        </Animated.View>
    );
});

VehicleAvatar.displayName = 'VehicleAvatar';

// ── Stiluri ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: {
        alignItems: 'center',
    },
    ring: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    inner: {
        backgroundColor: colors.bg[2],
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        borderRadius: radii.full,
        borderWidth: 1,
        paddingHorizontal: spacing[1] + 2,
        paddingVertical: 2,
        alignItems: 'center',
    },
    badgeText: {
        fontWeight: '700',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        includeFontPadding: false,
    },
});

export default VehicleAvatar;
