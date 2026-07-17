import React, { useRef, useContext, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryProvider } from './src/context/TelemetryContext';
import { AppContext } from './src/context/AppContext';
import { NotificationContext } from './src/context/NotificationContext';
import { setCustomServerUrl, setVin, setVehicleLabel, setFuelType, DEFAULT_VIN } from './src/utils/config';
import api from './src/services/api';
import socketService from './src/services/socket';
import { colors, typography, layout, spacing } from './src/theme';

import StatusScreen         from './src/screens/StatusScreen';
import MaintenanceScreen    from './src/screens/MaintenanceScreen';
import VehicleHealthScreen  from './src/screens/VehicleHealthScreen';
import SubsystemDetailScreen from './src/screens/SubsystemDetailScreen';
import TripReportScreen     from './src/screens/TripReportScreen';
import TripDetailScreen     from './src/screens/TripDetailScreen';
import LiveDashboardScreen  from './src/screens/LiveDashboardScreen';
import TripHistoryScreen    from './src/screens/TripHistoryScreen';
import SettingsScreen       from './src/screens/SettingsScreen';
import VehicleOnboardingScreen from './src/screens/VehicleOnboardingScreen';
import VehicleProfileScreen from './src/screens/VehicleProfileScreen';
import VehicleHubScreen     from './src/screens/VehicleHubScreen';
import AIExpertScreen       from './src/screens/AIExpertScreen';
import NotificationScreen   from './src/screens/NotificationScreen';
import GlobalSearchScreen   from './src/screens/GlobalSearchScreen';
import ErrorBoundary        from './src/components/ErrorBoundary';

const Tab       = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const StatusStack = createNativeStackNavigator();

function StatusStackScreen() {
    return (
        <ErrorBoundary>
            <StatusStack.Navigator screenOptions={{ headerShown: false }}>
                <StatusStack.Screen name="StatusMain"    component={StatusScreen} />
                <StatusStack.Screen name="HealthDetail"  component={VehicleHealthScreen} />
                <StatusStack.Screen name="SubsystemDetail" component={SubsystemDetailScreen} />
            </StatusStack.Navigator>
        </ErrorBoundary>
    );
}

function TabNavigator() {
    const { unreadCount } = useContext(NotificationContext);

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.bg[1],
                    borderTopColor: colors.border.default,
                    paddingBottom: spacing[1],
                    height: layout.tabBarHeight,
                },
                tabBarActiveTintColor:   colors.accent.default,
                tabBarInactiveTintColor: colors.text.secondary,
                tabBarLabelStyle: {
                    fontSize:    typography.sizes.caption,
                    fontWeight:  typography.weights.bold,
                },
            }}
        >
            <Tab.Screen
                name="Stare"
                component={StatusStackScreen}
                options={{
                    tabBarLabel: 'STARE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={color} />
                    ),
                    tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
                    tabBarBadgeStyle: {
                        backgroundColor: colors.status.critical,
                        fontSize: 9,
                        minWidth: 16,
                        height: 16,
                    },
                }}
            />
            <Tab.Screen
                name="Live"
                options={{
                    tabBarLabel: 'LIVE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'radio' : 'radio-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><LiveDashboardScreen /></ErrorBoundary>}
            </Tab.Screen>
            <Tab.Screen
                name="Istoric"
                options={{
                    tabBarLabel: 'CURSE',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'car' : 'car-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><TripHistoryScreen /></ErrorBoundary>}
            </Tab.Screen>
            <Tab.Screen
                name="Vehicul"
                options={{
                    tabBarLabel: 'VEHICUL',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons name={focused ? 'construct' : 'construct-outline'} size={size} color={color} />
                    ),
                }}
            >
                {() => <ErrorBoundary><VehicleHubScreen /></ErrorBoundary>}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

function AppNavigator() {
    const { setNavigationRef } = useContext(AppContext);
    const navigationRef = useRef(null);

    return (
        <NavigationContainer
            ref={(ref) => {
                navigationRef.current = ref;
                setNavigationRef(ref);
            }}
        >
            <RootStack.Navigator screenOptions={{ headerShown: false }}>
                <RootStack.Screen name="MainTabs"      component={TabNavigator} />
                <RootStack.Screen
                    name="TripReport"
                    component={TripReportScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <RootStack.Screen
                    name="VehicleProfile"
                    component={VehicleProfileScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="TripDetail"
                    component={TripDetailScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="Notifications"
                    component={NotificationScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
                <RootStack.Screen
                    name="GlobalSearch"
                    component={GlobalSearchScreen}
                    options={{ animation: 'slide_from_top' }}
                />
            </RootStack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    const [ready, setReady]                   = useState(false);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const savedUrl = await AsyncStorage.getItem('@custom_server_url');
                if (savedUrl) {
                    setCustomServerUrl(savedUrl);
                    api.defaults.baseURL = `${savedUrl}/api`;
                    socketService.disconnect();
                    socketService.socket = null;
                }

                const savedVin = await AsyncStorage.getItem('@active_vin');
                if (savedVin) setVin(savedVin);

                // Încarcă label vehicul pentru afișare în subtitluri
                try {
                    const vin = savedVin || DEFAULT_VIN;
                    const res = await api.get('/vehicule/list', { timeout: 4000 });
                    if (Array.isArray(res.data) && res.data.length > 0) {
                        const v = res.data.find(r => r.vin === vin) || res.data[0];
                        const parts = [v.model].filter(Boolean);
                        if (v.variant)    parts.push(v.variant);
                        if (v.year)       parts.push(String(v.year));
                        setVehicleLabel(parts.join(' · ') || v.vin || vin);
                        if (v.tip_combustibil) setFuelType(v.tip_combustibil);
                    }
                } catch {}
            } catch (e) {}

            const vehicleId = await AsyncStorage.getItem('@vehicle_id');
            if (!vehicleId) setNeedsOnboarding(true);

            setReady(true);
        };
        init();
    }, []);

    const handleOnboardingComplete = async (vehicle) => {
        if (vehicle?.id) {
            await AsyncStorage.setItem('@vehicle_id', String(vehicle.id));
        }
        setNeedsOnboarding(false);
    };

    if (!ready) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent.default} />
            </View>
        );
    }

    if (needsOnboarding) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor={colors.bg[0]} />
                <VehicleOnboardingScreen onComplete={handleOnboardingComplete} />
            </View>
        );
    }

    return (
        <TelemetryProvider>
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor={colors.bg[0]} />
                <AppNavigator />
            </View>
        </TelemetryProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
});
