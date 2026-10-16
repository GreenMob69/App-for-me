import React, { useState, useContext } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaintenanceScreen    from './MaintenanceScreen';
import VehicleProfileScreen from './VehicleProfileScreen';
import AIExpertScreen       from './AIExpertScreen';
import { useVehicle } from '../context/VehicleContext';
import { NotificationContext } from '../context/NotificationContext';
import { colors, typography, radii, spacing, layout, useThemeTemplate } from '../theme';
import { getRootNavigation } from '../utils/navigation';

// Compensates for status-bar height used by each sub-screen internally.
const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

const TABS = [
    { id: 'MENTENANTA', label: 'MENTENANȚĂ' },
    { id: 'PROFIL',     label: 'PROFIL & ACTE' },
    { id: 'EXPERT',     label: 'ASISTENT AI' },
];

const VehicleHubScreen = () => {
    const tpl = useThemeTemplate();
    const navigation = useNavigation();
    const [activeTab, setActiveTab] = useState('MENTENANTA');
    const { activeVin, vehicleLabel } = useVehicle();
    const { unreadCount } = useContext(NotificationContext);

    return (
        <View style={[styles.root, { backgroundColor: tpl.bg }]}>
            {/* ── Global Header Bar ───────────────────────────────────── */}
            <View style={[styles.header, { backgroundColor: tpl.bg, borderBottomColor: tpl.border }]}>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>VEHICUL & SERVICII</Text>
                    <Text style={styles.headerSub}>
                        {vehicleLabel || (activeVin ? activeVin.slice(-6) : 'Garaj Digital')}
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => getRootNavigation(navigation)?.navigate('GlobalSearch')}
                        accessibilityRole="button"
                        accessibilityLabel="Căutare globală"
                    >
                        <Text style={styles.headerIconText}>🔍</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => getRootNavigation(navigation)?.navigate('Notifications')}
                        accessibilityRole="button"
                        accessibilityLabel={`Notificări${unreadCount > 0 ? `, ${unreadCount} necitite` : ''}`}
                    >
                        <Text style={styles.headerIconText}>🔔</Text>
                        {unreadCount > 0 && (
                            <View style={styles.notifBadge}>
                                <Text style={styles.notifBadgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => getRootNavigation(navigation)?.navigate('Settings')}
                        accessibilityRole="button"
                        accessibilityLabel="Setări vehicul și aplicație"
                    >
                        <Text style={styles.headerIconText}>⚙️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Segmented control ──────────────────────────────────── */}
            <View style={[styles.topBar, { backgroundColor: tpl.bg, borderBottomColor: tpl.border }]}>
                <View style={[styles.tabs, { backgroundColor: tpl.cardBg, borderColor: tpl.border }]}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && { backgroundColor: tpl.accent }]}
                            onPress={() => setActiveTab(tab.id)}
                            accessibilityRole="tab"
                            accessibilityLabel={tab.label}
                            accessibilityState={{ selected: activeTab === tab.id }}
                        >
                            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ── Sub-screens — all mounted, only one visible ─────────── */}
            {/* marginTop: -PT offsets the sub-screen's own statusbar padding
                so content lands exactly below our tab bar.               */}
            {TABS.map(tab => (
                <View
                    key={tab.id}
                    style={[styles.screenSlot, { display: activeTab === tab.id ? 'flex' : 'none' }]}
                >
                    {tab.id === 'MENTENANTA' && <MaintenanceScreen />}
                    {tab.id === 'PROFIL'     && <VehicleProfileScreen showBack={false} />}
                    {tab.id === 'EXPERT'     && <AIExpertScreen />}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.bg[0],
        paddingTop: PT,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenPaddingH,
        paddingBottom: spacing[2],
        borderBottomWidth: 1,
        borderBottomColor: colors.border.subtle || colors.border.default,
        backgroundColor: colors.bg[0],
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: typography.sizes.caption,
        fontWeight: typography.weights.heavy,
        color: colors.text.secondary,
        letterSpacing: 0.8,
    },
    headerSub: {
        fontSize: typography.sizes.title3,
        fontWeight: typography.weights.bold,
        color: colors.text.primary,
        marginTop: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: radii.full,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.border.default,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    headerIconText: {
        fontSize: 16,
    },
    notifBadge: {
        position: 'absolute',
        top: -3,
        right: -3,
        backgroundColor: colors.status.critical,
        borderRadius: radii.full,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    notifBadgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: typography.weights.bold,
    },
    topBar: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.default,
        backgroundColor: colors.bg[0],
        zIndex: 10,
        elevation: 10,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: colors.bg[1],
        marginHorizontal: layout.screenPaddingH,
        borderRadius: radii.sm,
        borderWidth: 1,
        borderColor: colors.border.default,
        marginVertical: spacing[2],
        padding: spacing[1] - 2,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing[2] + 1,
        alignItems: 'center',
        borderRadius: radii.xs,
    },
    tabActive: {
        backgroundColor: colors.accent.default,
    },
    tabText: {
        fontSize: typography.sizes.label2,
        fontWeight: typography.weights.bold,
        color: colors.text.secondary,
        letterSpacing: 0.3,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    screenSlot: {
        flex: 1,
        marginTop: -PT,
        zIndex: 1,
    },
});

export default VehicleHubScreen;
