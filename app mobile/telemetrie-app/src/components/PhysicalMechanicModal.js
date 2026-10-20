import React, { useContext } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Dimensions,
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { hapticTap } from '../services/hapticFeedback';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function PhysicalMechanicModal({
    visible,
    guideData,
    onClose,
    onNavigateTo3D,
}) {
    const { appLang } = useContext(AppContext) || {};
    const isEn = appLang === 'EN';

    if (!guideData) return null;

    const title = isEn ? guideData.titleEn : guideData.titleRo;
    const location = isEn ? guideData.locationEn : guideData.locationRo;
    const steps = isEn ? guideData.stepsEn : guideData.stepsRo;
    const symptoms = isEn ? guideData.symptomsEn : guideData.symptomsRo;
    const cost = isEn ? guideData.estimatedCostEur : guideData.estimatedCostRon;

    const isCritical = guideData.diyLevel === 'CRITIC';

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheetContainer}>
                    {/* Header bar */}
                    <View style={[styles.header, isCritical && styles.headerCritical]}>
                        <View style={styles.headerLeft}>
                            <View style={styles.tagRow}>
                                <Text style={styles.systemBadge}>{guideData.system}</Text>
                                {guideData.code && (
                                    <Text style={styles.codeBadge}>{guideData.code}</Text>
                                )}
                                <Text
                                    style={[
                                        styles.diyBadge,
                                        isCritical ? styles.diyBadgeCrit : styles.diyBadgeNormal,
                                    ]}
                                >
                                    {guideData.diyLevel}
                                </Text>
                            </View>
                            <Text style={styles.titleText} numberOfLines={2}>
                                {title}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => {
                                hapticTap();
                                onClose?.();
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollArea}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* 1. Localizare fizică */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>📍</Text>
                                <Text style={styles.cardTitle}>
                                    {isEn ? 'PHYSICAL LOCATION ON VEHICLE' : 'LOCALIZARE FIZICĂ PE MAȘINĂ'}
                                </Text>
                            </View>
                            <Text style={styles.cardBodyText}>{location}</Text>
                        </View>

                        {/* 2. Verificare rapidă 3 pași */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>🖐️</Text>
                                <Text style={styles.cardTitle}>
                                    {isEn ? 'QUICK 2-MINUTE PHYSICAL CHECK (3 STEPS)' : 'VERIFICARE FIZICĂ RAPIDĂ ÎN 2 MINUTE'}
                                </Text>
                            </View>
                            {steps.map((st, idx) => (
                                <View key={idx} style={styles.stepRow}>
                                    <View style={styles.stepNumberBadge}>
                                        <Text style={styles.stepNumberText}>{idx + 1}</Text>
                                    </View>
                                    <Text style={styles.stepText}>{st}</Text>
                                </View>
                            ))}
                        </View>

                        {/* 3. Simptome */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>⚠️</Text>
                                <Text style={styles.cardTitle}>
                                    {isEn ? 'DRIVER SYMPTOMS' : 'SIMPTOME RESIMȚITE DE ȘOFER'}
                                </Text>
                            </View>
                            <Text style={styles.cardBodyText}>{symptoms}</Text>
                        </View>

                        {/* 4. Scule, Durată & Cost */}
                        <View style={styles.kpiGrid}>
                            <View style={styles.kpiBox}>
                                <Text style={styles.kpiLabel}>{isEn ? 'ESTIMATED TIME' : 'DURATĂ'}</Text>
                                <Text style={styles.kpiVal}>{guideData.durationMin} min</Text>
                            </View>
                            <View style={styles.kpiBox}>
                                <Text style={styles.kpiLabel}>{isEn ? 'ESTIMATED COST' : 'COST ESTIMAT'}</Text>
                                <Text style={[styles.kpiVal, { color: '#00FF66' }]}>{cost}</Text>
                            </View>
                        </View>

                        {/* Scule necesare */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>🔧</Text>
                                <Text style={styles.cardTitle}>
                                    {isEn ? 'REQUIRED TOOLS' : 'SCULE NECESARE'}
                                </Text>
                            </View>
                            <View style={styles.toolsWrap}>
                                {guideData.tools.map((t, i) => (
                                    <View key={i} style={styles.toolPill}>
                                        <Text style={styles.toolPillText}>• {t}</Text>
                                    </View>
                                ))}
                            </View>
                            {guideData.partNumberRef && (
                                <View style={styles.partRefBox}>
                                    <Text style={styles.partRefLabel}>
                                        {isEn ? 'REF / OEM PART NUMBER:' : 'REFERINȚĂ COD PIESĂ:'}
                                    </Text>
                                    <Text style={styles.partRefVal}>{guideData.partNumberRef}</Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        {onNavigateTo3D && guideData.subsystem && (
                            <TouchableOpacity
                                style={styles.xrayBtn}
                                onPress={() => {
                                    hapticTap();
                                    onNavigateTo3D(guideData.subsystem);
                                    onClose?.();
                                }}
                            >
                                <Text style={styles.xrayBtnText}>
                                    {isEn ? '🔬 VIEW SUBSYSTEM IN 3D' : '🔬 VEZI PIESA ÎN 3D X-RAY'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={() => {
                                hapticTap();
                                onClose?.();
                            }}
                        >
                            <Text style={styles.doneBtnText}>
                                {isEn ? 'DISMISS' : 'AM ÎNȚELES'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 14, 0.85)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#0A101D',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderWidth: 1,
        borderColor: '#00F0FF44',
        maxHeight: SCREEN_HEIGHT * 0.88,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        shadowColor: '#00F0FF',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
    },
    headerCritical: {
        backgroundColor: '#FF2A2A14',
        borderBottomColor: '#FF2A2A44',
    },
    headerLeft: {
        flex: 1,
        marginRight: 10,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    systemBadge: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#00F0FF',
        backgroundColor: '#00F0FF1A',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    codeBadge: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        color: '#FFB800',
        backgroundColor: '#FFB8001A',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    diyBadge: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '900',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    diyBadgeNormal: {
        color: '#10B981',
        backgroundColor: '#10B9811A',
    },
    diyBadgeCrit: {
        color: '#FF2A2A',
        backgroundColor: '#FF2A2A2A',
    },
    titleText: {
        fontFamily: MONO,
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#162235',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: '#94A3B8',
        fontSize: 16,
        fontWeight: '700',
    },
    scrollArea: {
        maxHeight: SCREEN_HEIGHT * 0.65,
    },
    scrollContent: {
        padding: 16,
        gap: 12,
    },
    card: {
        backgroundColor: '#101726',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 12,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    cardIcon: {
        fontSize: 14,
    },
    cardTitle: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#00F0FF',
        letterSpacing: 0.8,
    },
    cardBodyText: {
        fontFamily: MONO,
        fontSize: 11,
        color: '#CBD5E1',
        lineHeight: 16,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginTop: 8,
    },
    stepNumberBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#00F0FF22',
        borderWidth: 1,
        borderColor: '#00F0FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    stepNumberText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#00F0FF',
    },
    stepText: {
        flex: 1,
        fontFamily: MONO,
        fontSize: 11,
        color: '#E2E8F0',
        lineHeight: 16,
    },
    kpiGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    kpiBox: {
        flex: 1,
        backgroundColor: '#101726',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1E293B',
        padding: 10,
        alignItems: 'center',
    },
    kpiLabel: {
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: '800',
        color: '#64748B',
    },
    kpiVal: {
        fontFamily: MONO,
        fontSize: 14,
        fontWeight: '900',
        color: '#00F0FF',
        marginTop: 4,
    },
    toolsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    toolPill: {
        backgroundColor: '#1A2333',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    toolPillText: {
        fontFamily: MONO,
        fontSize: 10,
        color: '#94A3B8',
    },
    partRefBox: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    partRefLabel: {
        fontFamily: MONO,
        fontSize: 8,
        fontWeight: '800',
        color: '#64748B',
    },
    partRefVal: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFB800',
        marginTop: 2,
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 10,
        gap: 10,
    },
    xrayBtn: {
        flex: 1,
        backgroundColor: '#00F0FF1A',
        borderWidth: 1,
        borderColor: '#00F0FF',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    xrayBtnText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#00F0FF',
    },
    doneBtn: {
        flex: 1,
        backgroundColor: '#1E293B',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        fontFamily: MONO,
        fontSize: 10,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
