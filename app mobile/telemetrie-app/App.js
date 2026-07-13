import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TelemetryProvider } from './src/context/TelemetryContext';

// Importăm ecranele noastre
import LiveDashboardScreen from './src/screens/LiveDashboardScreen';
import TripHistoryScreen from './src/screens/TripHistoryScreen';
import DiagnosticsScreen from './src/screens/DiagnosticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
const Tab = createBottomTabNavigator();

export default function App() {
    return (
        <TelemetryProvider>
            <View style={styles.container}>
                <StatusBar style="light" backgroundColor="#0d1117" />
                
                <NavigationContainer>
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
                                fontSize: 12,
                                fontWeight: 'bold',
                            },
                        }}
                    >
                        <Tab.Screen 
                            name="Live" 
                            component={LiveDashboardScreen} 
                            options={{ tabBarLabel: '🏁 LIVE BORD' }}
                        />
                        <Tab.Screen 
                            name="Istoric" 
                            component={TripHistoryScreen} 
                            options={{ tabBarLabel: '📊 ARHIVĂ' }}
                        />
                        <Tab.Screen 
                            name="Diagnoza" 
                            component={DiagnosticsScreen}
                            options={{ tabBarLabel: '🛡️ DIAGNOZĂ' }}
                        />
                        <Tab.Screen 
                            name="Setări" 
                            component={SettingsScreen}
                            options={{ tabBarLabel: '⚙️ SETĂRI' }}
                        />

                        
                    </Tab.Navigator>
                </NavigationContainer>
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