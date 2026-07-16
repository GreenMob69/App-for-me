import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Platform, StatusBar,
} from 'react-native';
import MaintenanceScreen from './MaintenanceScreen';
import AIExpertScreen    from './AIExpertScreen';
import SettingsScreen    from './SettingsScreen';
import { colors, typography, radii, spacing, layout } from '../theme';

// Compensates for status-bar height used by each sub-screen internally.
// VehicleHubScreen provides its own statusbar offset (paddingTop on root);
// screenSlot is shifted up by the same amount so the sub-screen's own
// paddingTop brings content perfectly below the hub's tab bar.
const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 10 : 44;

const TABS = [
    { id: 'MENTENANTA', label: 'MENTENANȚĂ' },
    { id: 'EXPERT',     label: 'EXPERT AI'  },
    { id: 'SETARI',     label: 'SETĂRI'     },
];

const VehicleHubScreen = () => {
    const [activeTab, setActiveTab] = useState('MENTENANTA');

    return (
        <View style={styles.root}>
            {/* ── Segmented control ──────────────────────────────────── */}
            <View style={styles.topBar}>
                <View style={styles.tabs}>
                    {TABS.map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
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
                    {tab.id === 'EXPERT'     && <AIExpertScreen />}
                    {tab.id === 'SETARI'     && <SettingsScreen />}
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
