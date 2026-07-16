import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Platform, StatusBar, Animated, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchVehicleSummary } from '../services/vehicleService';
import { useScreenFadeIn } from '../utils/animations';
import { colors, typography, radii, spacing, layout } from '../theme';
import { Skeleton, EmptyState } from '../components/ui';

// ── Category colors ───────────────────────────────────────────────────────────
const CAT_COLOR = {
    recomandari: colors.status.caution,
    mentenanta:  colors.status.monitor,
    predictii:   colors.status.critical,
    jaloane:     '#b76bff',
    timeline:    colors.accent.default,
    curse:       colors.status.good,
    documente:   colors.text.secondary,
};

const CAT_ICON = {
    recomandari: '⚠',
    mentenanta:  '○',
    predictii:   '◈',
    jaloane:     '★',
    timeline:    '◆',
    curse:       '→',
    documente:   '📄',
};

// ── Build flat searchable index from summary data ─────────────────────────────
function buildSearchIndex(data) {
    if (!data) return [];
    const index = [];

    const add = (category, id, title, subtitle, meta = {}) => {
        index.push({
            id: `${category}::${id}`,
            category,
            title:    String(title || '').trim(),
            subtitle: String(subtitle || '').trim(),
            searchText: `${title} ${subtitle} ${Object.values(meta).join(' ')}`.toLowerCase(),
            meta,
        });
    };

    // Recommendations
    (data.recommendations || []).forEach((r, i) => {
        add('recomandari', r.failureId || i, r.title || r.failureId, r.recommendedAction || r.urgency || '', {
            urgency: r.urgency, cost: r.estimatedRepairCost?.min,
        });
    });

    // Maintenance
    (data.maintenance || []).forEach((m, i) => {
        add('mentenanta', m.item_name || i, m.item_name || m.item_type, m.status || '', {
            status: m.status, remaining: m.remaining_km,
        });
    });

    // Predictions
    (data.predictions || []).forEach((p, i) => {
        add('predictii', p.component || i, p.component, `${p.probability || 0}% probabilitate`, {
            component: p.component, prob: p.probability,
        });
    });

    // Milestones
    (data.milestones || []).forEach((ms, i) => {
        add('jaloane', ms.id || i, ms.title || ms.icon, ms.description || '', {
            achieved: ms.achieved_at,
        });
    });

    // Timeline events
    (data.timeline || []).forEach((ev, i) => {
        add('timeline', ev.id || i, ev.title, ev.description || ev.category || '', {
            category: ev.category, date: ev.event_date,
        });
    });

    // Recent trips
    (data.recentTrips || []).forEach((t, i) => {
        const dist = t.km_parcursi ? `${Number(t.km_parcursi).toFixed(1)} km` : '';
        const date = t.timestamp_start
            ? new Date(t.timestamp_start < 1e11 ? t.timestamp_start * 1000 : t.timestamp_start)
                .toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
            : '';
        add('curse', t.id || i, `Cursa ${date}`, `${dist}${t.scor_eco ? ` · Eco: ${t.scor_eco}` : ''}`, {
            km: t.km_parcursi, date: t.timestamp_start,
        });
    });

    return index;
}

// ── Local search (simple substring match) ────────────────────────────────────
function searchIndex(index, query) {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return index.filter(item => item.searchText.includes(q));
}

// ── Group results by category ─────────────────────────────────────────────────
function groupByCategory(results) {
    const groups = {};
    results.forEach(r => {
        if (!groups[r.category]) groups[r.category] = [];
        groups[r.category].push(r);
    });
    // Flatten to sections for SectionList-like rendering in FlatList
    const sections = [];
    Object.entries(groups).forEach(([cat, items]) => {
        sections.push({ type: 'header', id: `hdr::${cat}`, category: cat });
        items.slice(0, 5).forEach(item => sections.push({ ...item, type: 'item' }));
    });
    return sections;
}

// ── Category label ────────────────────────────────────────────────────────────
const CAT_LABEL = {
    recomandari: 'RECOMANDARI',
    mentenanta:  'MENTENANTA',
    predictii:   'PREDICTII',
    jaloane:     'JALOANE',
    timeline:    'EVENIMENTE',
    curse:       'CURSE',
    documente:   'DOCUMENTE',
};

// ── Search hint chips ─────────────────────────────────────────────────────────
const HINTS = [
    { label: 'ulei', query: 'ulei' },
    { label: 'filtru', query: 'filtru' },
    { label: 'EGR', query: 'egr' },
    { label: 'DPF', query: 'dpf' },
    { label: 'turbo', query: 'turbo' },
    { label: 'frana', query: 'frana' },
];

// ── GlobalSearchScreen ────────────────────────────────────────────────────────
const GlobalSearchScreen = () => {
    const navigation     = useNavigation();
    const [query, setQuery]           = useState('');
    const [index, setIndex]           = useState([]);
    const [loadState, setLoadState]   = useState('loading'); // loading | ready | error
    const debounceRef = useRef(null);
    const inputRef    = useRef(null);
    const screenFadeStyle = useScreenFadeIn('success');

    // ── Load search data on mount ────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const data = await fetchVehicleSummary();
                if (!cancelled) {
                    setIndex(buildSearchIndex(data));
                    setLoadState('ready');
                }
            } catch {
                if (!cancelled) setLoadState('error');
            }
        };
        load();
        // Auto-focus input after load
        setTimeout(() => inputRef.current?.focus(), 300);
        return () => { cancelled = true; };
    }, []);

    // ── Debounced query ──────────────────────────────────────────────────────
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const handleChangeText = useCallback((text) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedQuery(text);
        }, 250);
    }, []);

    // ── Compute results ──────────────────────────────────────────────────────
    const flatSections = useMemo(() => {
        if (debouncedQuery.length < 2) return [];
        return groupByCategory(searchIndex(index, debouncedQuery));
    }, [index, debouncedQuery]);

    const totalResults = useMemo(() => {
        return flatSections.filter(s => s.type === 'item').length;
    }, [flatSections]);

    // ── Render helpers ───────────────────────────────────────────────────────
    const renderSection = useCallback(({ item }) => {
        if (item.type === 'header') {
            const col = CAT_COLOR[item.category] || colors.text.secondary;
            return (
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionIcon, { color: col }]}>
                        {CAT_ICON[item.category] || '●'}
                    </Text>
                    <Text style={[styles.sectionTitle, { color: col }]}>
                        {CAT_LABEL[item.category] || item.category.toUpperCase()}
                    </Text>
                </View>
            );
        }
        const col = CAT_COLOR[item.category] || colors.accent.default;
        return (
            <TouchableOpacity
                style={styles.resultItem}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.subtitle}`}
            >
                <View style={[styles.resultDot, { backgroundColor: col }]} />
                <View style={styles.resultContent}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    {!!item.subtitle && (
                        <Text style={styles.resultSub} numberOfLines={1}>{item.subtitle}</Text>
                    )}
                </View>
                <Text style={[styles.resultArrow, { color: col }]}>›</Text>
            </TouchableOpacity>
        );
    }, []);

    const keyExtractor = useCallback((item) => item.id, []);

    // ── Skeleton loading ─────────────────────────────────────────────────────
    if (loadState === 'loading') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelBtnText}>Anulează</Text>
                    </TouchableOpacity>
                    <View style={styles.searchBarSkeleton}>
                        <Skeleton variant="rect" height={40} />
                    </View>
                </View>
                <View style={styles.skeletonBody}>
                    {[80, 60, 70, 60, 80, 60].map((w, i) => (
                        <Skeleton key={i} variant="text" height={14} width={`${w}%`} style={{ marginBottom: spacing[3] }} />
                    ))}
                </View>
            </View>
        );
    }

    if (loadState === 'error') {
        return (
            <View style={[styles.container, styles.center]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelBtnText}>Anulează</Text>
                    </TouchableOpacity>
                </View>
                <EmptyState
                    icon="⚠"
                    title="Nu s-au putut incarca datele"
                    subtitle="Verifica conexiunea la server si incearca din nou."
                    action={{ label: 'Reîncearcă', onPress: () => setLoadState('loading') }}
                    size="md"
                />
            </View>
        );
    }

    return (
        <Animated.View style={[styles.container, screenFadeStyle]}>
            {/* ── Header ────────────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        ref={inputRef}
                        style={styles.searchInput}
                        value={query}
                        onChangeText={handleChangeText}
                        placeholder="Cauta in vehicul..."
                        placeholderTextColor={colors.text.disabled}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                        clearButtonMode="while-editing"
                        accessibilityLabel="Cauta in tot vehiculul"
                    />
                </View>
                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel="Anuleaza cautarea"
                >
                    <Text style={styles.cancelBtnText}>Anulează</Text>
                </TouchableOpacity>
            </View>

            {/* ── Results count ─────────────────────────────────────── */}
            {debouncedQuery.length >= 2 && (
                <View style={styles.countBar}>
                    <Text style={styles.countText}>
                        {totalResults > 0
                            ? `${totalResults} rezultate`
                            : 'Niciun rezultat'}
                    </Text>
                </View>
            )}

            {/* ── Content ───────────────────────────────────────────── */}
            {debouncedQuery.length < 2 ? (
                <View style={styles.hintsWrap}>
                    <Text style={styles.hintsLabel}>Sugestii rapide</Text>
                    <View style={styles.hintsRow}>
                        {HINTS.map(h => (
                            <TouchableOpacity
                                key={h.query}
                                style={styles.hintChip}
                                onPress={() => handleChangeText(h.query)}
                                accessibilityRole="button"
                                accessibilityLabel={`Cauta ${h.label}`}
                            >
                                <Text style={styles.hintChipText}>{h.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.hintsLabel, { marginTop: spacing[5] }]}>Categorii</Text>
                    <View style={styles.categoryGrid}>
                        {Object.entries(CAT_LABEL).map(([key, label]) => (
                            <TouchableOpacity
                                key={key}
                                style={styles.categoryCard}
                                onPress={() => handleChangeText(key === 'curse' ? 'cursa' : label.toLowerCase().split(' ')[0])}
                                accessibilityRole="button"
                            >
                                <Text style={[styles.categoryIcon, { color: CAT_COLOR[key] }]}>
                                    {CAT_ICON[key]}
                                </Text>
                                <Text style={styles.categoryLabel}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : totalResults === 0 ? (
                <EmptyState
                    icon="🔍"
                    title="Niciun rezultat"
                    subtitle={`Nu s-a gasit nimic pentru "${debouncedQuery}".`}
                    size="md"
                    style={{ marginTop: spacing[8] }}
                />
            ) : (
                <FlatList
                    data={flatSections}
                    keyExtractor={keyExtractor}
                    renderItem={renderSection}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    initialNumToRender={20}
                    maxToRenderPerBatch={20}
                />
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
    center: { justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 8 : 52,
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        gap: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        paddingHorizontal: spacing[3],
        height: 40,
        gap: spacing[2],
    },
    searchBarSkeleton: { flex: 1 },
    searchIcon: { fontSize: 14, color: colors.text.disabled },
    searchInput: {
        flex: 1,
        color: colors.text.primary,
        fontSize: typography.sizes.body1,
        height: 40,
    },
    cancelBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[1] },
    cancelBtnText: {
        color: colors.accent.default,
        fontSize: typography.sizes.label1,
        fontWeight: typography.weights.semibold,
    },
    countBar: {
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[2],
        backgroundColor: colors.bg[1],
    },
    countText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },

    // ── Hints ───────────────────────────────────────────────────────────────
    hintsWrap: { flex: 1, paddingHorizontal: layout.screenPaddingH, paddingTop: spacing[5] },
    hintsLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.disabled,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: spacing[2] + 2,
    },
    hintsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    hintChip: {
        paddingVertical: spacing[1] + 2,
        paddingHorizontal: spacing[3],
        borderRadius: radii.full,
        backgroundColor: colors.bg[2],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    hintChipText: { fontSize: typography.sizes.label2, color: colors.text.secondary },
    categoryGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] + 2,
    },
    categoryCard: {
        width: '30%',
        backgroundColor: colors.bg[1],
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingVertical: spacing[3],
        alignItems: 'center',
        gap: spacing[1] + 2,
    },
    categoryIcon: { fontSize: 18 },
    categoryLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        textAlign: 'center',
    },

    // ── Results ─────────────────────────────────────────────────────────────
    listContent: { paddingBottom: spacing[10] },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        paddingHorizontal: layout.screenPaddingH,
        paddingTop: spacing[4],
        paddingBottom: spacing[1] + 2,
    },
    sectionIcon: { fontSize: 11, fontWeight: typography.weights.bold },
    sectionTitle: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
        paddingHorizontal: layout.screenPaddingH,
        gap: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle,
    },
    resultDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    resultContent: { flex: 1 },
    resultTitle: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.semibold,
        color: colors.text.primary,
    },
    resultSub: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        marginTop: 2,
    },
    resultArrow: {
        fontSize: 18,
        fontWeight: typography.weights.bold,
        flexShrink: 0,
    },
    skeletonBody: { padding: layout.screenPaddingH, paddingTop: spacing[5] },
});

export default GlobalSearchScreen;
