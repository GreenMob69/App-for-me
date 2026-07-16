import React, { useState, useCallback, useContext, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Platform, StatusBar, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NotificationContext } from '../context/NotificationContext';
import { NOTIF_CATEGORY, NOTIF_SEVERITY } from '../engine/NotificationEngine';
import { useScreenFadeIn } from '../utils/animations';
import { colors, typography, radii, spacing, layout } from '../theme';
import { EmptyState, Skeleton } from '../components/ui';

// ── Design tokens ─────────────────────────────────────────────────────────────
const SEVERITY_COLOR = {
    [NOTIF_SEVERITY.CRITICAL]: colors.status.critical,
    [NOTIF_SEVERITY.WARNING]:  colors.status.caution,
    [NOTIF_SEVERITY.INFO]:     colors.accent.default,
};

const SEVERITY_BG = {
    [NOTIF_SEVERITY.CRITICAL]: colors.tint.critical,
    [NOTIF_SEVERITY.WARNING]:  colors.tint.caution,
    [NOTIF_SEVERITY.INFO]:     colors.tint.accent || colors.bg[2],
};

// ── Category filter configuration ────────────────────────────────────────────
const CATEGORIES = [
    { key: 'ALL',                           label: 'Toate' },
    { key: NOTIF_CATEGORY.ALERTS,           label: 'Alerte' },
    { key: NOTIF_CATEGORY.HEALTH,           label: 'Sanatate' },
    { key: NOTIF_CATEGORY.MAINTENANCE,      label: 'Mentenanta' },
    { key: NOTIF_CATEGORY.RECOMMENDATIONS,  label: 'Recomandari' },
    { key: NOTIF_CATEGORY.PREDICTIONS,      label: 'Predictii' },
    { key: NOTIF_CATEGORY.MILESTONES,       label: 'Jaloane' },
];

// ── Relative timestamp formatter ──────────────────────────────────────────────
function relativeTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const min  = Math.floor(diff / 60000);
    if (min < 1)  return 'Acum';
    if (min < 60) return `Acum ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)   return `Acum ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7)    return `Acum ${d} zile`;
    return new Date(ts).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' });
}

// ── Notification Item ─────────────────────────────────────────────────────────
const NotifItem = React.memo(({ item, onPress }) => {
    const sColor = SEVERITY_COLOR[item.severity] || colors.text.secondary;
    const sBg    = SEVERITY_BG[item.severity]    || colors.bg[2];

    return (
        <TouchableOpacity
            style={[styles.item, item.read && styles.itemRead]}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${item.body}`}
            accessibilityState={{ selected: !item.read }}
        >
            {/* Severity strip */}
            <View style={[styles.strip, { backgroundColor: sColor }]} />

            {/* Icon bubble */}
            <View style={[styles.iconBubble, { backgroundColor: sBg }]}>
                <Text style={[styles.iconText, { color: sColor }]}>{item.icon || '●'}</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.contentHeader}>
                    <Text style={[styles.title, item.read && styles.titleRead]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    {!item.read && <View style={[styles.unreadDot, { backgroundColor: sColor }]} />}
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.time}>{relativeTime(item.timestamp)}</Text>
            </View>
        </TouchableOpacity>
    );
});

NotifItem.displayName = 'NotifItem';

// ── NotificationScreen ────────────────────────────────────────────────────────
const NotificationScreen = () => {
    const navigation = useNavigation();
    const {
        notifications,
        unreadCount,
        markRead,
        markAllRead,
        clearAll,
        getByCategory,
    } = useContext(NotificationContext);

    const [activeCategory, setActiveCategory] = useState('ALL');
    const screenFadeStyle = useScreenFadeIn('success');

    const filtered = useMemo(() => {
        return getByCategory(activeCategory);
    }, [getByCategory, activeCategory]);

    const handleItem = useCallback((item) => {
        markRead(item.id);
    }, [markRead]);

    const handleCategoryPress = useCallback((key) => {
        setActiveCategory(key);
    }, []);

    const keyExtractor = useCallback((item) => item.id, []);

    const renderItem = useCallback(({ item }) => (
        <NotifItem item={item} onPress={handleItem} />
    ), [handleItem]);

    // Category badge counts
    const categoryCounts = useMemo(() => {
        const counts = {};
        notifications.forEach(n => {
            if (!n.read) {
                counts[n.category] = (counts[n.category] || 0) + 1;
                counts['ALL']      = (counts['ALL'] || 0) + 1;
            }
        });
        return counts;
    }, [notifications]);

    const ListEmpty = useCallback(() => (
        <EmptyState
            icon="🔔"
            title="Nicio notificare"
            subtitle={
                activeCategory === 'ALL'
                    ? 'Vei vedea alertele vehiculului aici dupa prima cursa.'
                    : 'Nicio notificare in aceasta categorie.'
            }
            size="md"
            style={{ marginTop: spacing[8] }}
        />
    ), [activeCategory]);

    return (
        <Animated.View style={[styles.container, screenFadeStyle]}>
            {/* ── Header ───────────────────────────────────────────────── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Notificari</Text>
                    {unreadCount > 0 && (
                        <Text style={styles.headerSub}>{unreadCount} necitite</Text>
                    )}
                </View>
                <View style={styles.headerActions}>
                    {unreadCount > 0 && (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={markAllRead}
                            accessibilityRole="button"
                            accessibilityLabel="Marcheaza toate ca citite"
                        >
                            <Text style={styles.actionBtnText}>Citeste toate</Text>
                        </TouchableOpacity>
                    )}
                    {notifications.length > 0 && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.clearBtn]}
                            onPress={clearAll}
                            accessibilityRole="button"
                            accessibilityLabel="Sterge toate notificarile"
                        >
                            <Text style={[styles.actionBtnText, styles.clearBtnText]}>Sterge</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── Category filter chips ─────────────────────────────────── */}
            <View style={styles.chipRow}>
                <FlatList
                    data={CATEGORIES}
                    keyExtractor={c => c.key}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipContent}
                    renderItem={({ item: cat }) => {
                        const isActive = activeCategory === cat.key;
                        const cnt      = categoryCounts[cat.key];
                        return (
                            <TouchableOpacity
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => handleCategoryPress(cat.key)}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: isActive }}
                                accessibilityLabel={cat.label}
                            >
                                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                    {cat.label}
                                    {cnt ? ` ${cnt}` : ''}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {/* ── Notification list ─────────────────────────────────────── */}
            <FlatList
                data={filtered}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListEmptyComponent={ListEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                initialNumToRender={15}
                maxToRenderPerBatch={15}
                windowSize={7}
                removeClippedSubviews
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 52,
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
        gap: spacing[2],
    },
    backBtn: {
        width: 32, height: 32, borderRadius: radii.full,
        backgroundColor: colors.bg[1], borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center', alignItems: 'center',
    },
    backBtnText: {
        color: colors.text.secondary,
        fontSize: typography.sizes.body,
        fontWeight: typography.weights.bold,
    },
    headerTitle: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    headerSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    actionBtn: {
        paddingVertical: spacing[1] + 2,
        paddingHorizontal: spacing[2] + 2,
        borderRadius: radii.sm,
        backgroundColor: colors.bg[2],
    },
    clearBtn: { borderWidth: 1, borderColor: colors.border.default },
    actionBtnText: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },
    clearBtnText: { color: colors.text.secondary },

    // ── Chips ──────────────────────────────────────────────────────────────
    chipRow: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    chipContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[2],
        gap: spacing[2],
    },
    chip: {
        paddingVertical: spacing[1] + 2,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    chipActive: {
        backgroundColor: colors.accent.default,
        borderColor: colors.accent.default,
    },
    chipText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },
    chipTextActive: { color: '#FFFFFF' },

    // ── List ───────────────────────────────────────────────────────────────
    listContent: { paddingBottom: spacing[10] },
    separator: { height: 1, backgroundColor: colors.border.subtle, marginLeft: spacing[4] + 32 },

    // ── Notification item ─────────────────────────────────────────────────
    item: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: spacing[3],
        paddingRight: spacing[4],
        backgroundColor: colors.bg[1],
        gap: spacing[3],
    },
    itemRead: { backgroundColor: colors.bg[0], opacity: 0.8 },
    strip: {
        width: 3,
        alignSelf: 'stretch',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    iconBubble: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    iconText: {
        fontSize: 14,
        fontWeight: typography.weights.bold,
    },
    content: { flex: 1 },
    contentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1] + 2,
        marginBottom: spacing[1],
    },
    title: {
        flex: 1,
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    titleRead: { fontWeight: typography.weights.semibold, color: colors.text.secondary },
    unreadDot: {
        width: 8, height: 8, borderRadius: 4, flexShrink: 0,
    },
    body: {
        fontSize: typography.sizes.label2,
        color: colors.text.secondary,
        lineHeight: typography.lineHeights?.label2 || 18,
    },
    time: {
        marginTop: spacing[1],
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
    },
});

export default NotificationScreen;
