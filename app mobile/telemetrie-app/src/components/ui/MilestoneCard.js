/**
 * MilestoneCard — card pentru o realizare sau etapă importantă.
 *
 * Responsabilitate: marchează atingerea unui obiectiv (km parcurși,
 * service efectuat, primă aniversare etc.). Starea achieved controlează
 * tratamentul vizual complet: culori, opacitate, checkmark.
 *
 * @prop {string}   title           titlul milestonului (required)
 * @prop {string}   description     descriere suplimentară
 * @prop {boolean}  achieved        dacă a fost atins sau nu
 * @prop {string|ReactNode}  icon   icon reprezentativ
 * @prop {string}   achievedDate    data atingerii (afișat doar dacă achieved=true)
 * @prop {string}   target          ținta (ex: '250 000 km', '5 service-uri')
 * @prop {number}   progress        progres 0-100 dacă nu este atins (afișează progress bar)
 * @prop {boolean}  loading
 * @prop {object}   style
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radii, spacing, layout } from '../../theme';
import Skeleton from './Skeleton';
import PropTypes from 'prop-types';

const MilestoneCard = React.memo(({
    title,
    description,
    achieved = false,
    icon,
    achievedDate,
    target,
    progress,
    loading = false,
    style,
}) => {
    if (loading) {
        return (
            <View style={[styles.card, style]}>
                <View style={styles.loadingRow}>
                    <Skeleton variant="circle" height={48} width={48} />
                    <View style={styles.loadingText}>
                        <Skeleton variant="text" height={typography.sizes.body2} width="60%" />
                        <Skeleton variant="text" height={typography.sizes.caption} width="80%" style={styles.loadingGap} />
                    </View>
                </View>
            </View>
        );
    }

    const showProgress = !achieved && progress !== undefined && progress !== null;

    return (
        <View style={[styles.card, achieved && styles.cardAchieved, !achieved && styles.cardPending, style]}>
            <View style={styles.row}>
                <View style={[styles.iconWrap, achieved ? styles.iconWrapAchieved : styles.iconWrapPending]}>
                    {typeof icon === 'string' ? (
                        <Text style={[styles.iconText, !achieved && styles.iconTextPending]}>{icon}</Text>
                    ) : icon ?? (
                        <Text style={[styles.iconText, !achieved && styles.iconTextPending]}>
                            {achieved ? '★' : '○'}
                        </Text>
                    )}
                </View>

                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, !achieved && styles.titlePending]} numberOfLines={2}>
                            {title}
                        </Text>
                        {achieved && (
                            <View style={styles.checkWrap}>
                                <Text style={styles.checkIcon}>✓</Text>
                            </View>
                        )}
                    </View>

                    {description ? (
                        <Text style={[styles.description, !achieved && styles.descriptionPending]}>
                            {description}
                        </Text>
                    ) : null}

                    <View style={styles.metaRow}>
                        {achieved && achievedDate ? (
                            <Text style={styles.date}>{achievedDate}</Text>
                        ) : null}
                        {target ? (
                            <Text style={styles.target}>Țintă: {target}</Text>
                        ) : null}
                    </View>
                </View>
            </View>

            {showProgress ? (
                <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
                    </View>
                    <Text style={[styles.progressLabel, styles.tabular]}>{Math.round(progress)}%</Text>
                </View>
            ) : null}
        </View>
    );
});

MilestoneCard.displayName = 'MilestoneCard';

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border.default,
        padding: layout.cardPadding,
    },
    cardAchieved: {
        borderColor: colors.status.optimal,
        backgroundColor: colors.tint.optimal,
    },
    cardPending: {
        opacity: 0.75,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[3],
    },

    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconWrapAchieved: {
        backgroundColor: colors.tint.optimal,
        borderWidth: 1,
        borderColor: colors.status.optimal,
    },
    iconWrapPending: {
        backgroundColor: colors.bg[3],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    iconText: {
        fontSize: typography.sizes.title2,
        includeFontPadding: false,
    },
    iconTextPending: { opacity: 0.5 },

    content: { flex: 1 },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing[2],
    },
    title: {
        flex: 1,
        fontSize: typography.sizes.body2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    titlePending: { color: colors.text.secondary },

    checkWrap: {
        width: 20,
        height: 20,
        borderRadius: radii.full,
        backgroundColor: colors.status.optimal,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    checkIcon: {
        fontSize: typography.sizes.micro,
        color: colors.text.inverse,
        fontWeight: typography.weights.heavy,
    },

    description: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: spacing[1],
        lineHeight: typography.lineHeights.caption,
    },
    descriptionPending: { color: colors.text.tertiary },

    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginTop: spacing[1] + 2,
    },
    date: {
        fontSize: typography.sizes.caption,
        color: colors.status.optimal,
        fontWeight: typography.weights.medium,
    },
    target: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
    },

    // ── Progress bar ───────────────────────────────────────────────────────
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginTop: spacing[3],
    },
    progressTrack: {
        flex: 1,
        height: 4,
        backgroundColor: colors.border.default,
        borderRadius: radii.full,
        overflow: 'hidden',
    },
    progressFill: {
        height: 4,
        backgroundColor: colors.accent.default,
        borderRadius: radii.full,
    },
    progressLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.tertiary,
        fontWeight: typography.weights.medium,
        minWidth: 30,
        textAlign: 'right',
    },
    tabular: { fontVariant: ['tabular-nums'] },

    // ── Loading ────────────────────────────────────────────────────────────
    loadingRow: { flexDirection: 'row', gap: spacing[3] },
    loadingText: { flex: 1 },
    loadingGap: { marginTop: spacing[1] },
});

export default MilestoneCard;

MilestoneCard.propTypes = {
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    achieved: PropTypes.bool,
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    achievedDate: PropTypes.string,
    target: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    progress: PropTypes.number,
    loading: PropTypes.bool,
    style: PropTypes.object,
};
