/**
 * AppNavigator.js - Tabs principales para usuarios autenticados.
 * Jardín | Escanear | Agenda | Perfil
 * Escanear y Agenda usan placeholders hasta los Bloques C y D.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScanStack from './ScanStack';
import { colors, typography } from '../theme/theme';
import WateringScheduleScreen from '../screens/WateringScheduleScreen';

const Tab = createBottomTabNavigator();

// Definidos fuera del componente para no recrearlos en cada render

const TABS = [
  { name: 'Jardin', label: 'Jardín', component: HomeScreen, icon: 'leaf', iconOff: 'leaf-outline' },
  { name: 'Escanear', label: 'Escanear', component: ScanStack, icon: 'camera', iconOff: 'camera-outline' },
  { name: 'Agenda', label: 'Agenda', component: WateringScheduleScreen, icon: 'calendar', iconOff: 'calendar-outline' },
  { name: 'Perfil', label: 'Perfil', component: ProfileScreen, icon: 'person', iconOff: 'person-outline' },
];

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name);
        return {
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: typography.weight.bold },
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: typography.size.xs, fontWeight: typography.weight.medium },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? tab.icon : tab.iconOff} size={size} color={color} />
          ),
        };
      }}
    >
      {TABS.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ title: t.label, headerShown: !['Jardin', 'Escanear'].includes(t.name) }} />
      ))}
    </Tab.Navigator>
  );
}
