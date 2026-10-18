import React from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Platform,
    Alert,
} from 'react-native';
import Svg, { Rect, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useUiParadigm } from '../context/AppContext';
import { colors, typography, spacing, radii } from '../theme';

const PARADIGMS = [
    {
        id: 'CLASSIC_V2',
        title: 'CLASIC HMI & COCKPIT',
        subtitle: 'Bord complet multi-tab (Stare, Live, Curse, Vehicul), instrumente rotunde, telemetrie 1Hz și acces la toate cele 32 de modele fizice.',
        accent: '#00E5FF',
        badge: 'STANDARD ACTIV',
        isAvailable: true,
        previewType: 'classic',
    },
    {
        id: 'NOTHING_MINIMAL',
        title: 'NOTHING OS // CALM TECH',
        subtitle: 'Design prin absență, vitezometru monumental de 128px, negru OLED pur (#000000), linie bio-mecanică de puls și alertare doar prin excepție.',
        accent: '#FF3B00',
        badge: 'ULTRA-MINIMALIST',
        isAvailable: true,
        previewType: 'nothing',
    },
    {
        id: 'RETRO_AUDI_96',
        title: 'AUDI 1996 DIGIFIZ VFD',
        subtitle: 'Cluster digital retro-futurist Audi A6 C4, sticlă fumurie (#080302), turometru 25 blocuri LED în trepte, 7-segmente și Audi Auto-Check.',
        accent: '#FF8800',
        badge: 'RETRO-FUTURIST',
        isAvailable: true,
        previewType: 'audi',
    },
    {
        id: 'F1_CYBERDECK',
        title: 'F1 TELEMETRY CYBERDECK',
        subtitle: 'Display dens inspirat din motorsport de vârf, canale multiple split-screen, G-Force radial și telemetrie pe ferestre modulare.',
        accent: '#00FF66',
        badge: 'ÎN CURÂND (ETAPA 2)',
        isAvailable: false,
        previewType: 'f1',
    },
    {
        id: 'SPATIAL_CANVAS',
        title: 'SPATIAL 3D CANVAS',
        subtitle: 'Mașină exploded 3D cu noduri fizice plutitoare conectate de senzori, particule de flux și interacțiune spațială liberă.',
        accent: '#B026FF',
        badge: 'ÎN CURÂND (ETAPA 3)',
        isAvailable: false,
        previewType: 'spatial',
    },
];

// Mini-ilustrații SVG distinctive pentru fiecare stil de bord
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
                    {/* Bio Pulse Line */}
                    <Path d="M 6 48 L 40 48 L 48 42 L 56 52 L 64 45 L 72 48 L 114 48" fill="none" stroke={accent} strokeWidth="1.5" />
                </Svg>
            );
        case 'audi':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="4" fill="#080302" stroke="#2A0E08" strokeWidth="1.5" />
                    {/* Stepped LED tachometer preview */}
                    <Path d="M 10 14 L 20 14" stroke="#00FF66" strokeWidth="3" />
                    <Path d="M 23 13 L 33 13" stroke="#00FF66" strokeWidth="3" />
                    <Path d="M 36 12 L 46 12" stroke="#FF8800" strokeWidth="3" />
                    <Path d="M 49 11 L 59 11" stroke="#FF8800" strokeWidth="3" />
                    <Path d="M 62 10 L 72 10" stroke="#FF3300" strokeWidth="3" />
                    {/* 7 Segment style speed */}
                    <SvgText x="38" y="38" fill="#FF8800" fontSize="18" fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'} fontWeight="bold">110</SvgText>
                    <Rect x="78" y="18" width="34" height="26" fill="#150800" stroke="#FF8800" strokeWidth="1" rx="2" />
                    <Circle cx="95" cy="27" r="6" fill="none" stroke="#FF8800" strokeWidth="1.5" />
                    <SvgText x="95" y="30" fill="#FF8800" fontSize="7" fontWeight="bold" textAnchor="middle">OK</SvgText>
                    <SvgText x="95" y="41" fill="#FF8800" fontSize="5" textAnchor="middle">AUTO-CHECK</SvgText>
                </Svg>
            );
        case 'f1':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="4" fill="#050C08" stroke="#0D2E1A" strokeWidth="1" />
                    <Rect x="10" y="8" width="6" height="4" fill="#00FF66" />
                    <Rect x="18" y="8" width="6" height="4" fill="#00FF66" />
                    <Rect x="26" y="8" width="6" height="4" fill="#FFD700" />
                    <Rect x="34" y="8" width="6" height="4" fill="#FF3300" />
                    <Rect x="42" y="8" width="6" height="4" fill="#00E5FF" />
                    <Path d="M 10 35 L 30 25 L 50 38 L 70 20 L 90 30" fill="none" stroke="#00FF66" strokeWidth="1.5" />
                    <SvgText x="100" y="28" fill="#00FF66" fontSize="12" fontWeight="bold">F1</SvgText>
                </Svg>
            );
        case 'spatial':
            return (
                <Svg width={120} height={56} viewBox="0 0 120 56">
                    <Rect x="2" y="2" width="116" height="52" rx="4" fill="#090411" stroke="#260E45" strokeWidth="1" />
                    <Circle cx="60" cy="28" r="14" fill="none" stroke="#B026FF" strokeWidth="1" strokeDasharray="3, 3" />
                    <Circle cx="45" cy="22" r="3" fill="#B026FF" />
                    <Circle cx="75" cy="22" r="3" fill="#B026FF" />
                    <Circle cx="60" cy="36" r="3" fill="#00E5FF" />
                    <Line x1="45" y1="22" x2="75" y2="22" stroke="#B026FF" strokeWidth="0.8" />
                    <Line x1="45" y1="22" x2="60" y2="36" stroke="#B026FF" strokeWidth="0.8" />
                    <Line x1="75" y1="22" x2="60" y2="36" stroke="#B026FF" strokeWidth="0.8" />
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
    } = useUiParadigm();

    if (!showExperiencePicker) return null;

    const handleSelectParadigm = (p) => {
        if (!p.isAvailable) {
            Alert.alert(
                'În Dezvoltare',
                `Paradigma "${p.title}" va fi disponibilă în următoarea etapă arhitecturală. Alege Stilul 1 (Nothing Minimal) sau Stilul 2 (Retro Audi 96)!`
            );
            return;
        }
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
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.superTitle}>MOTOR MULTI-PARADIGMĂ UI</Text>
                            <Text style={styles.mainTitle}>Alege Experiența Vizuală</Text>
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
                        Fiecare paradigmă oferă o interpretare unică a celor 32 de modele din motorul fizic. Poți comuta oricând din butonul [ 🎨 STIL ] sau din Setări.
                    </Text>

                    {/* Lista cardurilor de paradigme */}
                    <ScrollView
                        style={styles.scrollList}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {PARADIGMS.map((p) => {
                            const isSelected = uiParadigm === p.id;
                            return (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.card,
                                        { borderColor: isSelected ? p.accent : colors.border.default },
                                        isSelected && { backgroundColor: `${p.accent}12` },
                                        !p.isAvailable && styles.cardDisabled,
                                    ]}
                                    onPress={() => handleSelectParadigm(p)}
                                    activeOpacity={p.isAvailable ? 0.75 : 0.9}
                                    accessibilityRole="button"
                                >
                                    <View style={styles.cardTopRow}>
                                        <View style={styles.previewContainer}>
                                            <ParadigmMiniPreview type={p.previewType} accent={p.accent} />
                                        </View>
                                        <View style={styles.cardHeaderInfo}>
                                            <View style={[styles.badge, { borderColor: p.accent, backgroundColor: `${p.accent}20` }]}>
                                                <Text style={[styles.badgeText, { color: p.accent }]}>
                                                    {isSelected ? '✓ ACTIV ACUM' : p.badge}
                                                </Text>
                                            </View>
                                            <Text style={[styles.cardTitle, isSelected && { color: p.accent }]}>
                                                {p.title}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.cardSubtitle}>{p.subtitle}</Text>

                                    <View style={styles.cardFooter}>
                                        <Text style={[styles.statusHint, { color: p.isAvailable ? p.accent : colors.text.disabled }]}>
                                            {isSelected
                                                ? 'Experiență curentă'
                                                : p.isAvailable
                                                ? 'Apasă pentru activare →'
                                                : 'Disponibil curând'}
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
                                <Text style={styles.switchLabel}>Nu mai afișa acest ecran la pornire</Text>
                                <Text style={styles.switchDesc}>Poți redeschide oricând din Setări sau din butonul [ 🎨 STIL ].</Text>
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
                            <Text style={styles.confirmBtnText}>Gata / Închide</Text>
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
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[3],
    },
    container: {
        width: '100%',
        maxHeight: '90%',
        backgroundColor: '#07090E',
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: '#1E2536',
        padding: spacing[4],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing[1],
    },
    superTitle: {
        color: colors.accent.default,
        fontSize: 10,
        fontWeight: typography.weights.bold,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    mainTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.3,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#151924',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#262D40',
    },
    closeBtnText: {
        color: '#A0AEC0',
        fontSize: 14,
        fontWeight: typography.weights.bold,
    },
    introText: {
        color: '#8A94A6',
        fontSize: 12,
        lineHeight: 16,
        marginBottom: spacing[3],
    },
    scrollList: {
        maxHeight: 380,
    },
    scrollContent: {
        gap: spacing[3],
        paddingBottom: spacing[2],
    },
    card: {
        backgroundColor: '#0D111A',
        borderRadius: radii.lg,
        borderWidth: 1.5,
        padding: spacing[3],
    },
    cardDisabled: {
        opacity: 0.55,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
    },
    previewContainer: {
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1E2536',
    },
    cardHeaderInfo: {
        flex: 1,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.xs,
        borderWidth: 1,
        marginBottom: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: typography.weights.heavy,
        letterSpacing: 0.5,
    },
    cardTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.4,
    },
    cardSubtitle: {
        color: '#8A94A6',
        fontSize: 11,
        lineHeight: 15,
        marginTop: spacing[2],
    },
    cardFooter: {
        marginTop: spacing[2],
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    statusHint: {
        fontSize: 10,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.3,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: '#1A2130',
        paddingTop: spacing[3],
        marginTop: spacing[2],
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    switchLabel: {
        color: '#CBD5E1',
        fontSize: 12,
        fontWeight: typography.weights.medium,
    },
    switchDesc: {
        color: '#64748B',
        fontSize: 10,
        marginTop: 1,
    },
    confirmBtn: {
        backgroundColor: colors.accent.default,
        borderRadius: radii.md,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnText: {
        color: '#000000',
        fontSize: 13,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
});
