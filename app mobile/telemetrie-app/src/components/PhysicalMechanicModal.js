'use strict';
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
import { exportWorkshopDossier } from '../utils/dossierExport';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function PhysicalMechanicModal({
    visible,
    guideData,
    onClose,
    onNavigateTo3D,
    freezeFrameTelemetry = null,
    activeVehicle = null,
}) {
    const { appLang } = useContext(AppContext) || {};
    const isRu = appLang === 'RU';
    const isEn = appLang === 'EN';

    if (!guideData) return null;

    const title = isRu ? (guideData.titleRu || guideData.titleRo) : isEn ? (guideData.titleEn || guideData.titleRo) : guideData.titleRo;
    const location = isRu ? (guideData.locationRu || guideData.locationRo) : isEn ? (guideData.locationEn || guideData.locationRo) : guideData.locationRo;
    const steps = isRu ? (guideData.stepsRu || guideData.stepsRo) : isEn ? (guideData.stepsEn || guideData.stepsRo) : guideData.stepsRo;
    const symptoms = isRu ? (guideData.symptomsRu || guideData.symptomsRo) : isEn ? (guideData.symptomsEn || guideData.symptomsRo) : guideData.symptomsRo;
    const cost = isEn ? guideData.estimatedCostEur : guideData.estimatedCostRon;

    const isCritical = guideData.diyLevel === 'CRITIC';

    const handleExportItp = () => {
        hapticTap();
        exportWorkshopDossier(freezeFrameTelemetry || {}, activeVehicle || {});
    };

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
                                    numberOfLines={1}
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
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {isRu ? 'ЛОКАЛИЗАЦИЯ ДЕТАЛИ НА АВТО' : isEn ? 'PHYSICAL LOCATION ON VEHICLE' : 'LOCALIZARE FIZICĂ PE MAȘINĂ'}
                                </Text>
                            </View>
                            <Text style={styles.cardBodyText}>{location}</Text>
                        </View>

                        {/* 2. Verificare rapidă pași */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>🖐️</Text>
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {isRu ? 'ШАГИ ТАКТИЛЬНОЙ ПРОВЕРКИ' : isEn ? 'TACTILE INSPECTION STEPS (HANDS-ON)' : 'VERIFICARE FIZICĂ RAPIDĂ LA MAȘINĂ'}
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
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {isRu ? 'СИМПТОМЫ ДЛЯ ВОДИТЕЛЯ' : isEn ? 'DRIVER WARNING SYMPTOMS' : 'SIMPTOME RESIMȚITE DE ȘOFER'}
                                </Text>
                            </View>
                            <Text style={styles.cardBodyText}>{symptoms}</Text>
                        </View>

                        {/* 4. Durată & Cost */}
                        <View style={styles.kpiGrid}>
                            <View style={styles.kpiBox}>
                                <Text style={styles.kpiLabel}>{isRu ? 'ВРЕМЯ РЕМОНТА' : isEn ? 'ESTIMATED TIME' : 'DURATĂ'}</Text>
                                <Text style={styles.kpiVal}>{guideData.durationMin} min</Text>
                            </View>
                            <View style={styles.kpiBox}>
                                <Text style={styles.kpiLabel}>{isRu ? 'СТОИМОСТЬ ДЕТАЛЕЙ' : isEn ? 'PARTS BUDGET' : 'COST ESTIMAT'}</Text>
                                <Text style={[styles.kpiVal, { color: '#00FF66' }]}>{cost}</Text>
                            </View>
                        </View>

                        {/* Scule necesare */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.cardIcon}>🔧</Text>
                                <Text style={styles.cardTitle} numberOfLines={1}>
                                    {isRu ? 'НЕОБХОДИМЫЙ ИНСТРУМЕНТ' : isEn ? 'REQUIRED TOOLS' : 'SCULE NECESARE'}
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
                                        {isRu ? 'OEM НОМЕР ДЕТАЛИ:' : isEn ? 'REF / OEM PART NUMBER:' : 'REFERINȚĂ COD PIESĂ:'}
                                    </Text>
                                    <Text style={styles.partRefVal}>{guideData.partNumberRef}</Text>
                                </View>
                            )}
                        </View>

                        {/* 5. Freeze-Frame Snapshot Telemetry */}
                        {freezeFrameTelemetry && (
                            <View style={styles.card}>
                                <View style={styles.cardHeaderRow}>
                                    <Text style={styles.cardIcon}>⏱️</Text>
                                    <Text style={styles.cardTitle} numberOfLines={1}>
                                        {isRu ? 'СТОП-КАДР ТЕЛЕМЕТРИИ В МОМЕНТ СБОЯ' : isEn ? 'FREEZE-FRAME ANOMALY TELEMETRY' : 'DATE FREEZE-FRAME ÎNREGISTRATE'}
                                    </Text>
                                </View>
                                <View style={styles.freezeGrid}>
                                    <View style={styles.freezeCell}>
                                        <Text style={styles.freezeCellLabel}>SPEED</Text>
                                        <Text style={styles.freezeCellVal}>{freezeFrameTelemetry.speed || 0} km/h</Text>
                                    </View>
                                    <View style={styles.freezeCell}>
                                        <Text style={styles.freezeCellLabel}>RPM</Text>
                                        <Text style={styles.freezeCellVal}>{freezeFrameTelemetry.rpm || 0}</Text>
                                    </View>
                                    <View style={styles.freezeCell}>
                                        <Text style={styles.freezeCellLabel}>BOOST</Text>
                                        <Text style={styles.freezeCellVal}>{freezeFrameTelemetry.boost || 0} bar</Text>
                                    </View>
                                    <View style={styles.freezeCell}>
                                        <Text style={styles.freezeCellLabel}>COOLANT</Text>
                                        <Text style={styles.freezeCellVal}>{freezeFrameTelemetry.coolantTemp || 90}°C</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.itpExportBtn}
                            onPress={handleExportItp}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.itpExportBtnText} numberOfLines={1}>
                                {isRu ? '📄 ЭКСПОРТ ДОСЬЕ ТЕХОСМОТРА' : isEn ? '📄 EXPORT ITP DOSSIER' : '📄 EXPORTĂ DOSAR TEHNIC ITP'}
                            </Text>
                        </TouchableOpacity>

                        {onNavigateTo3D && guideData.subsystem && (
                            <TouchableOpacity
                                style={styles.xrayBtn}
                                onPress={() => {
                                    hapticTap();
                                    onNavigateTo3D(guideData.subsystem);
                                    onClose?.();
                                }}
                            >
                                <Text style={styles.xrayBtnText} numberOfLines={1}>
                                    {isRu ? '🔬 3D X-RAY' : isEn ? '🔬 VIEW IN 3D' : '🔬 VEZI PIESA ÎN 3D'}
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
                            <Text style={styles.doneBtnText} numberOfLines={1}>
                                {isRu ? 'ЗАКРЫТЬ' : isEn ? 'DISMISS' : 'AM ÎNȚELES'}
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
        maxHeight: SCREEN_HEIGHT * 0.90,
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
        borderBottomColor: '#1A233A',
    },
    headerCritical: {
        backgroundColor: '#2A0E12',
        borderBottomColor: '#EF444466',
    },
    headerLeft: {
        flex: 1,
        paddingRight: 10,
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 4,
        alignItems: 'center',
    },
    systemBadge: {
        fontSize: 9,
        fontFamily: MONO,
        color: '#00F0FF',
        fontWeight: '900',
    },
    codeBadge: {
        fontSize: 9,
        fontFamily: MONO,
        color: '#F59E0B',
        fontWeight: '900',
    },
    diyBadge: {
        fontSize: 8,
        fontFamily: MONO,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontWeight: '900',
    },
    diyBadgeNormal: {
        backgroundColor: '#1E293B',
        color: '#94A3B8',
    },
    diyBadgeCrit: {
        backgroundColor: '#EF4444',
        color: '#FFFFFF',
    },
    titleText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 18,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: 'bold',
    },
    scrollArea: {
        paddingHorizontal: 14,
    },
    scrollContent: {
        paddingVertical: 12,
        gap: 10,
    },
    card: {
        backgroundColor: '#0F172A',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    cardIcon: {
        fontSize: 14,
    },
    cardTitle: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#00F0FF',
        letterSpacing: 0.5,
        flex: 1,
    },
    cardBodyText: {
        fontSize: 12,
        lineHeight: 17,
        color: '#CBD5E1',
    },
    stepRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 8,
        alignItems: 'flex-start',
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
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#00F0FF',
    },
    stepText: {
        fontSize: 11.5,
        lineHeight: 16,
        color: '#E2E8F0',
        flex: 1,
    },
    kpiGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    kpiBox: {
        flex: 1,
        backgroundColor: '#0F172A',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
        alignItems: 'center',
    },
    kpiLabel: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#64748B',
        marginBottom: 2,
    },
    kpiVal: {
        fontSize: 13,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    toolsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    toolPill: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    toolPillText: {
        fontSize: 10,
        fontFamily: MONO,
        color: '#E2E8F0',
    },
    partRefBox: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
    },
    partRefLabel: {
        fontSize: 8,
        fontFamily: MONO,
        color: '#64748B',
    },
    partRefVal: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '800',
        color: '#F59E0B',
        marginTop: 2,
    },
    freezeGrid: {
        flexDirection: 'row',
        gap: 6,
    },
    freezeCell: {
        flex: 1,
        backgroundColor: '#0A101D',
        borderRadius: 6,
        padding: 6,
        alignItems: 'center',
    },
    freezeCellLabel: {
        fontSize: 7,
        fontFamily: MONO,
        color: '#64748B',
    },
    freezeCellVal: {
        fontSize: 11,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#00F0FF',
        marginTop: 2,
    },
    footer: {
        paddingHorizontal: 14,
        paddingTop: 8,
        flexDirection: 'row',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#1A233A',
    },
    itpExportBtn: {
        flex: 1.2,
        backgroundColor: '#00FF6622',
        borderWidth: 1,
        borderColor: '#00FF66',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itpExportBtnText: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#00FF66',
    },
    xrayBtn: {
        flex: 0.9,
        backgroundColor: '#00F0FF22',
        borderWidth: 1,
        borderColor: '#00F0FF',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    xrayBtnText: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#00F0FF',
    },
    doneBtn: {
        flex: 0.9,
        backgroundColor: '#1E293B',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
