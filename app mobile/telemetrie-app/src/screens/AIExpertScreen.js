import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, KeyboardAvoidingView, Platform,
    StatusBar, ScrollView, ActivityIndicator,
} from 'react-native';
import api from '../services/api';
import { getVin } from '../utils/config';
import { StatusBadge, EmptyState } from '../components/ui';
import { colors, typography, radii, spacing, layout } from '../theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_LEVEL_STATUS = {
    NORMAL:        'good',
    CAUTION:       'monitor',
    AVOID_HIGHWAY: 'monitor',
    WORKSHOP:      'caution',
    DO_NOT_DRIVE:  'critical',
};

const ALERT_LEVEL_RO = {
    NORMAL:        'Normal',
    CAUTION:       'Prudență',
    AVOID_HIGHWAY: 'Evită autostrada',
    WORKSHOP:      'Service recomandat',
    DO_NOT_DRIVE:  'Nu conduce',
};

const CONFIDENCE_STATUS = {
    HIGH:   'good',
    MEDIUM: 'monitor',
    LOW:    'caution',
};

const CONFIDENCE_RO = {
    HIGH:   'Sigur',
    MEDIUM: 'Probabil',
    LOW:    'Incert',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTwinAge(savedAt) {
    if (!savedAt) return '';
    const diffMin = Math.round((Date.now() - savedAt) / 60000);
    if (diffMin < 2)    return 'chiar acum';
    if (diffMin < 60)   return `acum ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24)     return `acum ${diffH}h`;
    return `acum ${Math.round(diffH / 24)} zile`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AIExpertScreen = () => {
    const flatListRef = useRef(null);

    const [twinState,         setTwinState]         = useState('loading');
    const [twinMeta,          setTwinMeta]           = useState(null);
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    const [messages,          setMessages]           = useState([]);
    const [input,             setInput]              = useState('');
    const [isQuerying,        setIsQuerying]         = useState(false);

    // Ref sincronizat cu messages — evită closure stale în sendQuestion
    const messagesRef = useRef([]);

    // ── Load twin context ────────────────────────────────────────────────
    const loadTwin = useCallback(async () => {
        setTwinState('loading');
        try {
            const res = await api.get(`/vehicul/${getVin()}/twin`);
            if (res.data.status === 'NO_DATA') {
                setTwinState('no_data');
                setSuggestedQuestions(res.data.suggestedQuestions || []);
            } else {
                setTwinState('ok');
                setTwinMeta(res.data.twinMeta);
                setSuggestedQuestions(res.data.suggestedQuestions || []);
            }
        } catch {
            setTwinState('error');
        }
    }, []);

    useEffect(() => { loadTwin(); }, [loadTwin]);

    // Ține messagesRef sincronizat pentru a fi folosit în sendQuestion fără closure stale
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // ── Auto-scroll on new message ───────────────────────────────────────
    useEffect(() => {
        if (flatListRef.current && messages.length > 0) {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, isQuerying]);

    // ── Send a question ──────────────────────────────────────────────────
    const sendQuestion = useCallback(async (questionText) => {
        const q = (questionText || input).trim();
        if (!q || isQuerying || twinState === 'loading') return;

        const userMsg = { id: `u_${Date.now()}`, role: 'user', text: q };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsQuerying(true);

        try {
            // Trimite ultimele 8 mesaje ca istoric pentru rezolvare referințe
            const history = messagesRef.current.slice(-8).map(m => ({
                role:     m.role,
                text:     m.text.substring(0, 250),
                intent:   m.intent   || null,
                topicRef: m.topicRef || null,
            }));
            const res = await api.post('/ai/expert/query', { vin: getVin(), question: q, history });
            const d   = res.data;
            const aiMsg = {
                id:               `a_${Date.now()}`,
                role:             'ai',
                text:             d.answer,
                confidence:       d.confidence,
                intent:           d.intent,
                topicRef:         d.topicRef      || null,
                isFollowUp:       d.isFollowUp    || false,
                resolvedTopic:    d.resolvedTopic || null,
                relatedQuestions: d.relatedQuestions || [],
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch {
            setMessages(prev => [...prev, {
                id:         `e_${Date.now()}`,
                role:       'ai',
                text:       'Eroare de comunicare cu serverul. Încearcă din nou.',
                confidence: 'LOW',
                intent:     'ERROR',
                relatedQuestions: [],
            }]);
        } finally {
            setIsQuerying(false);
        }
    }, [input, isQuerying, twinState]);

    // ── Render message ───────────────────────────────────────────────────
    const renderMessage = ({ item: msg }) => {
        if (msg.role === 'user') {
            return (
                <View style={styles.userBubbleWrap}>
                    <View style={styles.userBubble}>
                        <Text style={styles.userBubbleText}>{msg.text}</Text>
                    </View>
                </View>
            );
        }

        // AI message
        const confStatus = CONFIDENCE_STATUS[msg.confidence] || 'neutral';
        const confLabel  = CONFIDENCE_RO[msg.confidence]  || msg.confidence || '';

        return (
            <View style={styles.aiBubbleWrap}>
                <View style={styles.aiAvatar}>
                    <Text style={styles.aiAvatarText}>AI</Text>
                </View>
                <View style={styles.aiBubbleCol}>
                    {msg.isFollowUp && msg.resolvedTopic ? (
                        <View style={styles.contextChip}>
                            <Text style={styles.contextChipText}>↩ {msg.resolvedTopic}</Text>
                        </View>
                    ) : null}
                    <View style={styles.aiBubble}>
                        <Text style={styles.aiBubbleText}>{msg.text}</Text>
                    </View>
                    {msg.confidence && msg.intent !== 'ERROR' ? (
                        <View style={styles.aiBubbleMeta}>
                            <StatusBadge
                                status={confStatus}
                                label={confLabel}
                                size="sm"
                            />
                        </View>
                    ) : null}
                    {msg.relatedQuestions?.length > 0 ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.relatedScroll}
                        >
                            {msg.relatedQuestions.map(rq => (
                                <TouchableOpacity
                                    key={rq}
                                    style={styles.relatedChip}
                                    onPress={() => sendQuestion(rq)}
                                >
                                    <Text style={styles.relatedChipText}>{rq}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    ) : null}
                </View>
            </View>
        );
    };

    // ── Welcome / empty state header ─────────────────────────────────────
    const ListHeader = () => {
        if (messages.length > 0) return null;

        return (
            <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIconWrap}>
                    <Text style={styles.welcomeIcon}>🔍</Text>
                </View>
                <Text style={styles.welcomeTitle}>AI Expert</Text>
                <Text style={styles.welcomeSubtitle}>
                    {twinState === 'ok'
                        ? `Bazat pe Vehicle Digital Twin · Date analizate din cursele înregistrate.`
                        : twinState === 'no_data'
                        ? 'Niciun Digital Twin disponibil. Înregistrează câteva curse pentru a activa analiza.'
                        : 'Întrebă-mă orice despre starea vehiculului tău.'}
                </Text>

                {suggestedQuestions.length > 0 && twinState === 'ok' ? (
                    <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsLabel}>ÎNTREBĂRI FRECVENTE</Text>
                        <View style={styles.suggestionsGrid}>
                            {suggestedQuestions.map(sq => (
                                <TouchableOpacity
                                    key={sq}
                                    style={styles.suggestionChip}
                                    onPress={() => sendQuestion(sq)}
                                >
                                    <Text style={styles.suggestionChipText}>{sq}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>
        );
    };

    // ── Thinking indicator ────────────────────────────────────────────────
    const ThinkingIndicator = () => (
        <View style={styles.aiBubbleWrap}>
            <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>AI</Text>
            </View>
            <View style={[styles.aiBubble, styles.aiBubbleThinking]}>
                <ActivityIndicator size="small" color={colors.accent.default} />
                <Text style={[styles.aiBubbleText, { marginLeft: spacing[2] }]}>
                    Analizez datele vehiculului…
                </Text>
            </View>
        </View>
    );

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <View style={styles.main}>
            {/* ── Header ────────────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>AI Expert</Text>
                    <Text style={styles.subtitle}>Vehicle Digital Twin · Q&A</Text>
                </View>
                {twinMeta ? (
                    <View style={styles.headerRight}>
                        <StatusBadge
                            status={ALERT_LEVEL_STATUS[twinMeta.alertLevel] || 'neutral'}
                            label={ALERT_LEVEL_RO[twinMeta.alertLevel]     || 'Normal'}
                            size="sm"
                        />
                        {twinMeta.healthScore != null ? (
                            <Text style={styles.healthPill}>{twinMeta.healthScore}/100</Text>
                        ) : null}
                    </View>
                ) : null}
            </View>

            {/* ── Twin status bar ────────────────────────────────────── */}
            {twinMeta ? (
                <View style={styles.twinBar}>
                    <Text style={styles.twinBarText}>
                        Twin actualizat {fmtTwinAge(twinMeta.savedAt)}
                        {twinMeta.dataCompleteness != null ? ` · Date ${twinMeta.dataCompleteness}% complete` : ''}
                    </Text>
                    <TouchableOpacity onPress={loadTwin}>
                        <Text style={styles.twinBarRefresh}>↺ Reîncarcă</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {/* ── Loading ────────────────────────────────────────────── */}
            {twinState === 'loading' ? (
                <View style={styles.centerFill}>
                    <ActivityIndicator size="large" color={colors.accent.default} />
                    <Text style={styles.loadingText}>Încarc Digital Twin…</Text>
                </View>
            ) : twinState === 'error' ? (
                <View style={styles.centerFill}>
                    <EmptyState
                        title="Nu pot accesa Digital Twin-ul."
                        subtitle="Verifică conexiunea la server și încearcă din nou."
                        action={{ label: 'Reîncearcă', onPress: loadTwin }}
                        style={{ paddingHorizontal: layout.screenPaddingH }}
                    />
                </View>
            ) : (
                /* ── Chat ────────────────────────────────────────────── */
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}
                >
                    <FlatList
                        ref={flatListRef}
                        style={styles.messageList}
                        contentContainerStyle={styles.messageListContent}
                        data={messages}
                        keyExtractor={item => item.id}
                        ListHeaderComponent={ListHeader}
                        ListFooterComponent={isQuerying ? ThinkingIndicator : null}
                        renderItem={renderMessage}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />

                    {/* ── Persistent suggestions strip (after conversation starts) ── */}
                    {messages.length > 0 && suggestedQuestions.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.persistSuggestScroll}
                            contentContainerStyle={styles.persistSuggestContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {suggestedQuestions.slice(0, 4).map(sq => (
                                <TouchableOpacity
                                    key={sq}
                                    style={styles.persistChip}
                                    onPress={() => sendQuestion(sq)}
                                    disabled={isQuerying}
                                >
                                    <Text style={styles.persistChipText} numberOfLines={1}>{sq}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* ── Input ────────────────────────────────────────── */}
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            value={input}
                            onChangeText={setInput}
                            placeholder="Întreabă ceva despre mașina ta…"
                            placeholderTextColor={colors.text.secondary}
                            returnKeyType="send"
                            onSubmitEditing={() => sendQuestion()}
                            editable={!isQuerying && twinState !== 'loading'}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!input.trim() || isQuerying) && styles.sendBtnDisabled]}
                            onPress={() => sendQuestion()}
                            disabled={!input.trim() || isQuerying}
                        >
                            <Text style={styles.sendBtnText}>→</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    main: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44,
    },
    centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // ── Header ────────────────────────────────────────────────────────────────
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        gap: spacing[3],
    },
    title:    { fontSize: typography.sizes.title3, fontWeight: typography.weights.bold, color: colors.text.primary },
    subtitle: { fontSize: typography.sizes.caption, color: colors.text.secondary, marginTop: 2 },
    headerRight: { alignItems: 'flex-end', gap: spacing[1] },
    healthPill: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
        fontVariant: ['tabular-nums'],
    },

    // ── Twin bar ──────────────────────────────────────────────────────────────
    twinBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[2],
        backgroundColor: colors.bg[1],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
    },
    twinBarText:    { fontSize: typography.sizes.caption, color: colors.text.secondary },
    twinBarRefresh: { fontSize: typography.sizes.caption, color: colors.accent.default, fontWeight: typography.weights.semibold },

    // ── Loading ───────────────────────────────────────────────────────────────
    loadingText: { marginTop: spacing[3], fontSize: typography.sizes.body, color: colors.text.secondary },

    // ── Message list ──────────────────────────────────────────────────────────
    messageList:        { flex: 1 },
    messageListContent: { paddingHorizontal: layout.screenPaddingH, paddingBottom: spacing[4] },

    // ── Welcome ───────────────────────────────────────────────────────────────
    welcomeContainer:  { alignItems: 'center', paddingTop: spacing[6], paddingBottom: spacing[4] },
    welcomeIconWrap: {
        width: 60, height: 60,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    welcomeIcon:     { fontSize: 28 },
    welcomeTitle:    { fontSize: typography.sizes.title3, fontWeight: typography.weights.bold, color: colors.text.primary, marginBottom: spacing[2] },
    welcomeSubtitle: {
        fontSize: typography.sizes.body,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing[5],
        maxWidth: 320,
    },
    suggestionsContainer: { width: '100%' },
    suggestionsLabel: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        marginBottom: spacing[2],
    },
    suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
    suggestionChip: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    suggestionChipText: {
        fontSize: typography.sizes.label2,
        color: colors.text.primary,
        fontWeight: typography.weights.semibold,
    },

    // ── User bubble ───────────────────────────────────────────────────────────
    userBubbleWrap: { alignItems: 'flex-end', marginBottom: spacing[3] },
    userBubble: {
        backgroundColor: colors.accent.default,
        borderRadius: radii.lg,
        borderBottomRightRadius: radii.sm,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        maxWidth: '80%',
    },
    userBubbleText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.body,
        lineHeight: 22,
    },

    // ── AI bubble ─────────────────────────────────────────────────────────────
    aiBubbleWrap: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] },
    aiAvatar: {
        width: 32, height: 32,
        borderRadius: radii.full,
        backgroundColor: colors.accent.default + '22',
        borderWidth: 1,
        borderColor: colors.accent.default + '66',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing[2],
        marginTop: spacing[1],
    },
    aiAvatarText: { fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, color: colors.accent.default },
    aiBubbleCol:  { flex: 1 },
    aiBubble: {
        backgroundColor: colors.bg[1],
        borderRadius: radii.lg,
        borderBottomLeftRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        maxWidth: '100%',
    },
    aiBubbleThinking: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
    },
    aiBubbleText: {
        color: colors.text.primary,
        fontSize: typography.sizes.body,
        lineHeight: 22,
    },
    aiBubbleMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing[1] + 2,
        marginLeft: spacing[1],
    },

    // ── Related questions ──────────────────────────────────────────────────────
    relatedScroll: { marginTop: spacing[2] },
    relatedChip: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        backgroundColor: colors.bg[0],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.accent.default + '88',
        marginRight: spacing[2],
    },
    relatedChipText: {
        fontSize: typography.sizes.caption,
        color: colors.accent.default,
        fontWeight: typography.weights.semibold,
    },

    // ── Input row ─────────────────────────────────────────────────────────────
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[3],
        paddingBottom: Platform.OS === 'ios' ? spacing[6] : spacing[3],
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        backgroundColor: colors.bg[0],
        gap: spacing[2],
    },
    input: {
        flex: 1,
        height: 44,
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        paddingHorizontal: spacing[4],
        fontSize: typography.sizes.body,
        color: colors.text.primary,
    },
    sendBtn: {
        width: 44, height: 44,
        borderRadius: radii.full,
        backgroundColor: colors.accent.default,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: colors.bg[2] ?? colors.bg[1], opacity: 0.5 },
    sendBtnText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        marginTop: -2,
    },
    // ── Persistent suggestions strip ──────────────────────────────────────────
    persistSuggestScroll: {
        borderTopWidth: 1,
        borderTopColor: colors.border.subtle ?? colors.border.default,
        backgroundColor: colors.bg[0],
        maxHeight: 44,
    },
    persistSuggestContent: {
        paddingHorizontal: layout.screenPaddingH,
        paddingVertical: spacing[2],
        gap: spacing[2],
        alignItems: 'center',
    },
    persistChip: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 1,
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        borderWidth: 1,
        borderColor: colors.border.default,
        maxWidth: 200,
    },
    persistChipText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontWeight: typography.weights.semibold,
    },

    // Context chip — apare deasupra bulei AI când răspunsul este un follow-up
    contextChip: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg[1],
        borderRadius: radii.full,
        paddingHorizontal: spacing[3],
        paddingVertical: 2,
        marginBottom: spacing[1],
        borderWidth: 1,
        borderColor: colors.border.default,
    },
    contextChipText: {
        fontSize: typography.sizes.caption,
        color: colors.text.secondary,
        fontStyle: 'italic',
    },
});

export default AIExpertScreen;
