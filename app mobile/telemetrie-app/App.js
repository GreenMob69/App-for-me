import React, { useRef, useContext, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryProvider } from './src/context/TelemetryContext';
import { AppContext } from './src/context/AppContext';
import { setCustomServerUrl } from './src/utils/config';
import api from './src/services/api';
import socketService from './src/services/socket';

import StatusScreen from './src/screens/StatusScreen';
import VehicleHealthScreen from './src/screens/VehicleHealthScreen';
import SubsystemDetailScreen from './src/screens/SubsystemDetailScreen';
import TripReportScreen from './src/screens/TripReportScreen';
import LiveDashboardScreen from './src/screens/LiveDashboardScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import VehicleOnboardingScreen from './src/screens/VehicleOnboardingScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const StatusStack = createNativeStackNavigator();

function StatusStackScreen() {
    return (
        <ErrorBoundary>
            <StatusStack.Navigator screenOptions={{ headerShown: false }}>
                <StatusStack.Screen name="StatusMain" component={StatusScreen} />
                <StatusStack.Screen name="HealthDetail" component={VehicleHealthScreen} />
                <StatusStack.Screen name="SubsystemDetail" component={SubsystemDetailScreen} />
            </StatusStack.Navigator>
        </ErrorBoundary>
    );
}

function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#161b22',
                    borderTopColor: '#30363d',
                    paddingBottom: 5,
                    height: 60,
                },
                tabBarActiveTintColor: '#58a6ff',
                tabBarInactiveTintColor: '#8b949e',
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: 'bold',
                },
            }}
        >
            <Tab.Screen
                name="Stare"
                component={StatusStackScreen}
                options={{ tabBarLabel: 'STARE' }}
            />
            <Tab.Screen
                name="Live"
                options={{ tabBarLabel: 'LIVE' }}
            >
                {() => <ErrorBoundary><LiveDashboardScreen /></ErrorBoundary>}
            </Tab.Screen>
            <Tab.Screen
                name="Istoric"
                options={{ tabBarLabel: 'CURSE' }}
            >
                {() => <ErrorBoundary><TripHistoryScreen /></ErrorBoundary>}
            </Tab.Screen>
            <Tab.Screen
                name="Setari"
                options={{ tabBarLabel: 'SETARI' }}
            >
                {() => <ErrorBoundary><SettingsScreen /></ErrorBoundary>}
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
                <RootStack.Screen name="MainTabs" component={TabNavigator} />
                <RootStack.Screen
                    name="TripReport"
                    component={TripReportScreen}
                    options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
                />
            </RootStack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    const [ready, setReady] = useState(false);
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
            } catch (e) {}

            // Check if vehicle profile exists
            const vehicleId = await AsyncStorage.getItem('@vehicle_id');
            if (!vehicleId) {
                setNeedsOnboarding(true);
            }

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
                <ActivityIndicator size="large" color="#58a6ff" />
            </View>
        );
    }

    if (needsOnboarding) {
        return (
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor="#0d1117" />
                <VehicleOnboardingScreen onComplete={handleOnboardingComplete} />
            </View>
        );
    }

    return (
        <TelemetryProvider>
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor="#0d1117" />
                <AppNavigator />
            </View>
        </TelemetryProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0d1117',
    }
});
