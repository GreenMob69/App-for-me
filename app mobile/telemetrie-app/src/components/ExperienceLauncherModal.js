'use strict';
import React, { useContext } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Platform,
} from 'react-native';
import Svg, { Rect, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { AppContext } from '../context/AppContext';
import { hapticTap } from '../services/hapticFeedback';
import { colors, typography, spacing, radii } from '../theme';
import { getTranslation } from '../i18n/translations';

const PRODUCTION_PARADIGMS = [
    {
        id: 'CLASSIC_V2',
        title: '⚡ CLASSIC V2 PRO',
        subtitleRo: 'Centrul de Comandă & Scanner 3D. Instrumente rotunde, telemetrie 1Hz, osciloscop dublu și acces direct la toți cei 32 de observatori fizici.',
        subtitleEn: 'Mission Control & 3D Scanner. Circular gauges, 1Hz telemetry, dual scope and direct access to all 32 physical observers.',
        subtitleRu: 'Командный центр и 3D сканер. Круглые приборы, телеметрия 1Гц, 2-канальный осциллограф и 32 физических датчика.',
        accent: '#00E5FF',
        badgeRo: 'PRODUCȚIE ACTIV',
        badgeEn: 'CORE PRODUCTION',
        badgeRu: 'ОСНОВНОЙ РЕЖИМ',
        isAvailable: true,
        previewType: 'classic',
    },
    {
        id: 'NOTHING_MINIMAL',
        title: '⚪ NOTHING OS MINIMAL',
        subtitleRo: 'Calm Tech & Dot-Matrix. Design prin absență, vitezometru monumental de 128px, negru OLED pur (#000000) și linie bio-mecanică de puls.',
        subtitleEn: 'Calm Tech & Dot-Matrix. Design by absence, monumental 128px speedometer, true OLED black (#000000) and bio-pulse strip.',
        subtitleRu: 'Calm Tech и Dot-Matrix. Монументальный спидометр 128px, глубокий черный OLED (#000000) и линия био-механического пульса.',
        accent: '#FF3B00',
        badgeRo: 'ULTRA-MINIMALIST',
        badgeEn: 'ULTRA-MINIMAL',
        badgeRu: 'УЛЬТРА-МИНИМАЛИЗМ',
        isAvailable: true,
        previewType: 'nothing',
    },
    {
        id: 'RETRO_AUDI_96',
        title: '🟧 RETRO AUDI 1996',
        subtitleRo: 'Digifiz VFD & Tester VAG 1551. Cluster retro-futurist Audi A6 C4, sticlă fumurie (#080302), turometru 25 blocuri LED și Audi Auto-Check.',
        subtitleEn: 'Digifiz VFD & VAG 1551 Tester. Retro-futuristic Audi A6 C4 cluster, smoked glass (#080302), 25-block LED tachometer and Auto-Check.',
        subtitleRu: 'Digifiz VFD и тестер VAG 1551. Ретро-футуристичный щиток Audi A6 C4, дымчатое стекло (#080302), 25 LED блоков и Auto-Check.',
        accent: '#FF8800',
        badgeRo: 'RETRO-FUTURIST',
        badgeEn: 'RETRO-DIGIFIZ',
        badgeRu: 'РЕТРО-ДИГИФИЗ',
        isAvailable: true,
        previewType: 'audi',
    },
];

// Mini-ilustrații SVG distinctive pentru cele 3 stiluri de bord
function ParadigmMiniPreview({ type, accent }) {
    switch (type) {
        case 'classic':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="6" fill="#0A0E17" stroke="#1E293B" strokeWidth="1" />
                    <Circle cx="32" cy="28" r="18" fill="none" stroke="#1E293B" strokeWidth="3" />
                    <Circle cx="32" cy="28" r="18" fill="none" stroke={accent} strokeWidth="3" strokeDasharray="60, 100" />
                    <Circle cx="88" cy="28" r="18" fill="none" stroke="#1E293B" strokeWidth="3" />
                    <Circle cx="88" cy="28" r="18" fill="none" stroke="#22C55E" strokeWidth="3" strokeDasharray="45, 100" />
                    <SvgText x="32" y="32" fill="#FFFFFF" fontSize="10" fontWeight="bold" textAnchor="middle">85</SvgText>
                    <SvgText x="88" y="32" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">2450</SvgText>
                </Svg>
            );
        case 'nothing':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="4" fill="#000000" stroke="#222222" strokeWidth="1" />
                    <SvgText x="40" y="36" fill="#F5F5F7" fontSize="24" fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'} fontWeight="bold">92</SvgText>
                    <SvgText x="82" y="28" fill="#666666" fontSize="8" fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}>KM/H</SvgText>
                    <SvgText x="82" y="40" fill={accent} fontSize="9" fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'} fontWeight="bold">G4</SvgText>
                    <Path d="M 6 48 L 40 48 L 48 42 L 56 52 L 64 45 L 72 48 L 114 48" fill="none" stroke={accent} strokeWidth="1.5" />
                </Svg>
            );
        case 'audi':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="4" fill="#080302" stroke="#2A0E08" strokeWidth="1.5" />
                    <Path d="M 10 14 L 20 14" stroke="#00FF66" strokeWidth="3" />
                    <Path d="M 23 13 L 33 13" stroke="#00FF66" strokeWidth="3" />
                    <Path d="M 36 12 L 46 12" stroke="#FF8800" strokeWidth="3" />
                    <Path d="M 49 11 L 59 11" stroke="#FF8800" strokeWidth="3" />
                    <Path d="M 62 10 L 72 10" stroke="#FF3300" strokeWidth="3" />
                    <SvgText x="38" y="38" fill="#FF8800" fontSize="18" fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'} fontWeight="bold">110</SvgText>
                    <Rect x="78" y="18" width="34" height="26" fill="#150800" stroke="#FF8800" strokeWidth="1" rx="2" />
                    <Circle cx="95" cy="27" r="6" fill="none" stroke="#FF8800" strokeWidth="1.5" />
                    <SvgText x="95" y="30" fill="#FF8800" fontSize="7" fontWeight="bold" textAnchor="middle">OK</SvgText>
                    <SvgText x="95" y="41" fill="#FF8800" fontSize="5" textAnchor="middle">AUTO-CHECK</SvgText>
                </Svg>
            );
        default:
            return null;
    }
}

export default function ExperienceLauncherModal() {
    const {
        uiParadigm,
        setUiParadigm,
        showExperiencePicker,
        closeExperiencePicker,
        skipLauncherPrompt,
        setSkipLauncherPrompt,
        appLang,
        setAppLang,
    } = useContext(AppContext);

    const t = getTranslation(appLang);

    const handleSelectParadigm = (p) => {
        hapticTap();
        setUiParadigm(p.id);
        closeExperiencePicker();
    };

    return (
        <Modal
            visible={showExperiencePicker}
            animationType="fade"
            transparent
            onRequestClose={closeExperiencePicker}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header cu Switcher Limba [ RO | EN | RU ] */}
                    <View style={styles.header}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.superTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                {appLang === 'RU' ? 'РЕЖИМЫ ТЕЛЕМЕТРИИ' : 'MOTOR MULTI-PARADIGMĂ UI'}
                            </Text>
                            <Text style={styles.mainTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                {t.modals?.experienceTitle || 'Alege Experiența Vizuală'}
                            </Text>
                        </View>

                        {/* Tri-Lingual Quick Switcher */}
                        <View style={styles.langSwitchBar}>
                            {['RO', 'EN', 'RU'].map((l) => (
                                <TouchableOpacity
                                    key={l}
                                    style={[styles.langSwitchPill, appLang === l && styles.langSwitchPillActive]}
                                    onPress={() => {
                                        hapticTap();
                                        setAppLang(l);
                                    }}
                                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                >
                                    <Text style={[styles.langSwitchText, appLang === l && styles.langSwitchTextActive]} numberOfLines={1}>
                                        {l === 'RO' ? '🇷🇴 RO' : l === 'EN' ? '🇬🇧 EN' : '🇷🇺 RU'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={closeExperiencePicker}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel="Închide selectorul"
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.introText}>
                        {appLang === 'RU'
                            ? 'Каждый из 3 основных стилей полностью автономен и оптимизирован под 60 кадров/сек. Вы можете сменить стиль в любой момент.'
                            : appLang === 'EN'
                            ? 'Each of the 3 main styles is 100% standalone and 60 FPS optimized. You can switch anytime from the [ 🎨 STYLE ] button.'
                            : 'Fiecare dintre cele 3 stiluri principale este 100% de sine stătător și optimizat 60 FPS. Poți comuta oricând din butonul [ 🎨 STIL ].'}
                    </Text>

                    {/* Lista celor 3 stiluri de producție */}
                    <ScrollView
                        style={styles.scrollList}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={true}
                        bounces={true}
                    >
                        {PRODUCTION_PARADIGMS.map((p) => {
                            const isSelected = uiParadigm === p.id;
                            const badge = isSelected
                                ? (appLang === 'RU' ? '✓ АКТИВЕН' : appLang === 'EN' ? '✓ ACTIVE' : '✓ ACTIV')
                                : (appLang === 'RU' ? p.badgeRu : appLang === 'EN' ? p.badgeEn : p.badgeRo);
                            const subtitle = appLang === 'RU' ? p.subtitleRu : appLang === 'EN' ? p.subtitleEn : p.subtitleRo;

                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.card,
                                        { borderColor: isSelected ? p.accent : colors.border.default },
                                        isSelected && { backgroundColor: `${p.accent}12` },
                                    ]}
                                    onPress={() => handleSelectParadigm(p)}
                                    activeOpacity={0.75}
                                    accessibilityRole="button"
                                >
                                    <View style={styles.cardTopRow}>
                                        <View style={styles.previewContainer}>
                                            <ParadigmMiniPreview type={p.previewType} accent={p.accent} />
                                        </View>
                                        <View style={styles.cardHeaderInfo}>
                                            <View style={[styles.badge, { borderColor: p.accent, backgroundColor: `${p.accent}20` }]}>
                                                <Text style={[styles.badgeText, { color: p.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                                    {badge}
                                                </Text>
                                            </View>
                                            <Text style={[styles.cardTitle, isSelected && { color: p.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                                {p.title}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.cardSubtitle} numberOfLines={2}>{subtitle}</Text>

                                    <View style={styles.cardFooter}>
                                        <Text style={[styles.statusHint, { color: p.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                            {isSelected
                                                ? (appLang === 'RU' ? 'Текущий активный режим' : appLang === 'EN' ? 'Current Active Paradigm' : 'Experiență curentă')
                                                : (appLang === 'RU' ? 'Нажмите для переключения →' : appLang === 'EN' ? 'Tap to activate →' : 'Apasă pentru activare →')}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Footer cu "Nu mai afișa la pornire" */}
                    <View style={styles.footer}>
                        <View style={styles.switchRow}>
                            <View style={{ flex: 1, paddingRight: spacing[2] }}>
                                <Text style={styles.switchLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                    {appLang === 'RU' ? 'Не показывать при запуске' : appLang === 'EN' ? 'Do not show on app startup' : 'Nu mai afișa la pornire'}
                                </Text>
                                <Text style={styles.switchDesc} numberOfLines={1}>
                                    {appLang === 'RU' ? 'Доступно из меню Настройки или кнопки [ 🎨 СТИЛЬ ].' : appLang === 'EN' ? 'Reopen anytime from Settings or [ 🎨 STYLE ].' : 'Poți redeschide oricând din Setări sau [ 🎨 STIL ].'}
                                </Text>
                            </View>
                            <Switch
                                value={skipLauncherPrompt}
                                onValueChange={setSkipLauncherPrompt}
                                trackColor={{ false: colors.border.default, true: colors.accent.default }}
                                thumbColor={skipLauncherPrompt ? '#FFFFFF' : colors.text.secondary}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={closeExperiencePicker}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.confirmBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                                {appLang === 'RU' ? 'ПРОДОЛЖИТЬ В ТЕКУЩЕМ СТИЛЕ' : appLang === 'EN' ? 'CONTINUE IN ACTIVE PARADIGM' : 'CONTINUĂ ÎN STILUL ACTIV'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[3],
    },
    container: {
        width: '100%',
        maxWidth: 520,
        maxHeight: '92%',
        backgroundColor: '#070B12',
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: spacing[4],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[2],
        gap: 6,
    },
    superTitle: {
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        color: colors.accent.default,
        letterSpacing: 1.5,
        fontWeight: typography.weights.heavy,
        textTransform: 'uppercase',
    },
    mainTitle: {
        fontSize: 18,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        letterSpacing: 0.3,
        marginTop: 2,
    },
    langSwitchBar: {
        flexDirection: 'row',
        backgroundColor: '#0E1726',
        borderRadius: radii.full,
        padding: 2,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    langSwitchPill: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: radii.full,
    },
    langSwitchPillActive: {
        backgroundColor: '#00E5FF22',
    },
    langSwitchText: {
        fontSize: 9,
        fontWeight: typography.weights.bold,
        color: colors.text.disabled,
    },
    langSwitchTextActive: {
        color: '#00E5FF',
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: colors.text.secondary,
        fontSize: 14,
        fontWeight: typography.weights.bold,
    },
    introText: {
        fontSize: 11,
        lineHeight: 16,
        color: colors.text.secondary,
        marginBottom: spacing[3],
    },
    scrollList: {
        maxHeight: 400,
    },
    scrollContent: {
        paddingBottom: spacing[2],
        gap: spacing[2] + 2,
    },
    card: {
        backgroundColor: '#0C121D',
        borderRadius: radii.lg,
        borderWidth: 1.5,
        padding: spacing[3],
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[2],
        gap: spacing[3],
    },
    previewContainer: {
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    cardHeaderInfo: {
        flex: 1,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.full,
        borderWidth: 1,
        marginBottom: 4,
    },
    badgeText: {
        fontSize: 8,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.8,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: typography.weights.heavy,
        color: colors.text.primary,
        letterSpacing: 0.4,
    },
    cardSubtitle: {
        fontSize: 11,
        lineHeight: 16,
        color: colors.text.secondary,
        marginBottom: spacing[2],
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#151D2A',
        paddingTop: spacing[1],
    },
    statusHint: {
        fontSize: 10,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: typography.weights.bold,
    },
    footer: {
        marginTop: spacing[3],
        paddingTop: spacing[3],
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing[3],
    },
    switchLabel: {
        fontSize: 12,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
    },
    switchDesc: {
        fontSize: 10,
        color: colors.text.disabled,
        marginTop: 2,
    },
    confirmBtn: {
        backgroundColor: colors.accent.default,
        paddingVertical: 12,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnText: {
        color: '#000000',
        fontSize: 12,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.8,
    },
});
