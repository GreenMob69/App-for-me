import React, { useRef, useContext, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, LogBox, Animated } from 'react-native';

LogBox.ignoreLogs([
    '`expo-notifications` functionality is not fully supported in Expo Go',
    'Push notifications (remote notifications) are unavailable in Expo Go',
    'SafeAreaView has been deprecated',
]);
import { SecurityProvider, SecurityContext } from './src/context/SecurityContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LockScreen from './src/screens/LockScreen';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider, AppContext } from './src/context/AppContext';
import { NotificationProvider, NotificationContext } from './src/context/NotificationContext';
import { AlertProvider } from './src/context/AlertContext';
import { LiveProvider } from './src/context/LiveContext';
import { setCustomServerUrl } from './src/utils/config';
import { VehicleProvider, useVehicle } from './src/context/VehicleContext';
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
import UIPlaygroundScreen  from './src/screens/UIPlaygroundScreen';
import SmartMobilityScreen  from './src/screens/SmartMobilityScreen';
import CrashAlertModal      from './src/components/CrashAlertModal';
import ErrorBoundary        from './src/components/ErrorBoundary';
import ExperienceLauncherModal from './src/components/ExperienceLauncherModal';
import MinimalNothingParadigm from './src/screens/paradigms/MinimalNothingParadigm';
import RetroAudi96Paradigm  from './src/screens/paradigms/RetroAudi96Paradigm';
import F1CyberdeckParadigm  from './src/screens/paradigms/F1CyberdeckParadigm';
import SpatialCanvasParadigm from './src/screens/paradigms/SpatialCanvasParadigm';
import CloudSimulatorModal  from './src/components/CloudSimulatorModal';
import LiveSimStrip         from './src/components/LiveSimStrip';

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
    const { currentTemplate } = useContext(AppContext);

    const activeAccent = currentTemplate?.accent || colors.accent.default;
    const tabBorder = currentTemplate?.border || colors.border.default;
    const tabBg = currentTemplate?.cardBg || colors.bg[1];

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: tabBg,
                    borderTopColor: tabBorder,
                    borderTopWidth: 1,
                    paddingBottom: spacing[1],
                    height: layout.tabBarHeight,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.35,
                    shadowRadius: 5,
                    elevation: 10,
                },
                tabBarActiveTintColor:   activeAccent,
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

function SecurityGate({ children }) {
    const { isLocked, securityEnabled, unlockApp, ready } = useContext(SecurityContext);
    if (!ready) return null;
    if (securityEnabled && isLocked) return <LockScreen onUnlock={unlockApp} />;
    return children;
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
                    options={{ animation: 'fade' }}
                >
                    {() => <ErrorBoundary><GlobalSearchScreen /></ErrorBoundary>}
                </RootStack.Screen>
                <RootStack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="AIExpert"
                    component={AIExpertScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="UIPlayground"
                    component={UIPlaygroundScreen}
                    options={{ animation: 'slide_from_right' }}
                />
                <RootStack.Screen
                    name="SmartMobility"
                    component={SmartMobilityScreen}
                    options={{ animation: 'slide_from_right' }}
                />
            </RootStack.Navigator>
        </NavigationContainer>
    );
}

function MainContent() {
    const { uiParadigm } = useContext(AppContext);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const [renderedParadigm, setRenderedParadigm] = useState(uiParadigm);

    useEffect(() => {
        if (uiParadigm !== renderedParadigm) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 90,
                useNativeDriver: true,
            }).start(() => {
                setRenderedParadigm(uiParadigm);
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 110,
                    useNativeDriver: true,
                }).start();
            });
        }
    }, [uiParadigm]);

    let content = null;
    if (renderedParadigm === 'NOTHING_MINIMAL') {
        content = (
            <ErrorBoundary>
                <MinimalNothingParadigm />
            </ErrorBoundary>
        );
    } else if (renderedParadigm === 'RETRO_AUDI_96') {
        content = (
            <ErrorBoundary>
                <RetroAudi96Paradigm />
            </ErrorBoundary>
        );
    } else if (renderedParadigm === 'F1_CYBERDECK') {
        content = (
            <ErrorBoundary>
                <F1CyberdeckParadigm />
            </ErrorBoundary>
        );
    } else if (renderedParadigm === 'SPATIAL_CANVAS') {
        content = (
            <ErrorBoundary>
                <SpatialCanvasParadigm />
            </ErrorBoundary>
        );
    } else {
        content = <AppNavigator />;
    }

    return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            {content}
        </Animated.View>
    );
}

function AppSecurityAndModals() {
    const { showSimulatorModal, closeSimulatorModal } = useContext(AppContext);
    return (
        <SecurityGate>
            <LiveSimStrip />
            <MainContent />
            <ExperienceLauncherModal />
            <CloudSimulatorModal visible={showSimulatorModal} onClose={closeSimulatorModal} />
            <CrashAlertModal />
        </SecurityGate>
    );
}

function AppRoot() {
    const [serverReady, setServerReady] = useState(false);
    const { ready: vehicleReady, activeVin, switchVehicle } = useVehicle();

    useEffect(() => {
        AsyncStorage.getItem('@custom_server_url')
            .then(savedUrl => {
                if (savedUrl) {
                    setCustomServerUrl(savedUrl);
                    api.defaults.baseURL = `${savedUrl}/api`;
                    socketService.disconnect();
                    socketService.socket = null;
                }
            })
            .catch(() => {})
            .finally(() => setServerReady(true));
    }, []);

    if (!serverReady || !vehicleReady) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.accent.default} />
            </View>
        );
    }

    if (!activeVin) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor={colors.bg[0]} />
                <VehicleOnboardingScreen onComplete={async (vehicle) => {
                    if (vehicle?.id) await AsyncStorage.setItem('@vehicle_id', String(vehicle.id));
                    if (vehicle?.vin) await switchVehicle(vehicle.vin);
                }} />
            </View>
        );
    }

    return (
        <AppProvider>
            <SecurityProvider>
                <NotificationProvider>
                    <AlertProvider>
                        <LiveProvider>
                            <View style={styles.container}>
                                <StatusBar style="light" backgroundColor={colors.bg[0]} />
                                <AppSecurityAndModals />
                            </View>
                        </LiveProvider>
                    </AlertProvider>
                </NotificationProvider>
            </SecurityProvider>
        </AppProvider>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <VehicleProvider>
                <AppRoot />
            </VehicleProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg[0],
    },
});
