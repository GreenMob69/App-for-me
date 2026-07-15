import React, { useRef, useContext, useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryProvider, TelemetryContext } from './src/context/TelemetryContext';
import { setCustomServerUrl } from './src/utils/config';
import api from './src/services/api';
import socketService from './src/services/socket';

import VehicleHealthScreen from './src/screens/VehicleHealthScreen';
import SubsystemDetailScreen from './src/screens/SubsystemDetailScreen';
import TripReportScreen from './src/screens/TripReportScreen';
import LiveDashboardScreen from './src/screens/LiveDashboardScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const HealthStack = createNativeStackNavigator();

function HealthStackScreen() {
    return (
        <HealthStack.Navigator screenOptions={{ headerShown: false }}>
            <HealthStack.Screen name="HealthMain" component={VehicleHealthScreen} />
            <HealthStack.Screen name="SubsystemDetail" component={SubsystemDetailScreen} />
        </HealthStack.Navigator>
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
                name="Health"
                component={HealthStackScreen}
                options={{ tabBarLabel: 'HEALTH' }}
            />
            <Tab.Screen
                name="Live"
                component={LiveDashboardScreen}
                options={{ tabBarLabel: 'LIVE' }}
            />
            <Tab.Screen
                name="Istoric"
                component={TripHistoryScreen}
                options={{ tabBarLabel: 'CURSE' }}
            />
            <Tab.Screen
                name="Diagnoza"
                component={DiagnosticsScreen}
                options={{ tabBarLabel: 'DIAG' }}
            />
            <Tab.Screen
                name="Setari"
                component={SettingsScreen}
                options={{ tabBarLabel: 'SETARI' }}
            />
        </Tab.Navigator>
    );
}

function AppNavigator() {
    const { setNavigationRef } = useContext(TelemetryContext);
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

    useEffect(() => {
        const initCustomIp = async () => {
            try {
                const savedUrl = await AsyncStorage.getItem('@custom_server_url');
                if (savedUrl) {
                    setCustomServerUrl(savedUrl);
                    api.defaults.baseURL = `${savedUrl}/api`;
                    socketService.disconnect();
                    socketService.socket = null;
                }
            } catch (e) {}
            setReady(true);
        };
        initCustomIp();
    }, []);

    if (!ready) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#58a6ff" />
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
