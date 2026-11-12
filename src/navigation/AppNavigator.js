/**
 * AppNavigator.js - Navegación principal para usuarios autenticados.
 *
 * Stack nativo (nivel superior)
 *   ├─ "Tabs"         -> pestañas: Jardín | Escanear | Agenda | Perfil
 *   └─ "PlantHistory" -> detalle e historial de una planta (se abre desde la tarjeta del Jardín)
 *
 * PlantHistory vive en un stack POR ENCIMA de las pestañas porque "Jardín" es una pestaña
 * (no tiene stack propio). Las demás rutas (ej. "Diagnostico") siguen resolviéndose en los
 * navegadores superiores, igual que antes.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import PlantHistoryScreen from '../screens/PlantHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScanStack from './ScanStack';
import { colors, typography } from '../theme/theme';
import WateringScheduleScreen from '../screens/WateringScheduleScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Definidos fuera del componente para no recrearlos en cada render
const TABS = [
  { name: 'Jardin', label: 'Jardín', component: HomeScreen, icon: 'leaf', iconOff: 'leaf-outline' },
  { name: 'Escanear', label: 'Escanear', component: ScanStack, icon: 'camera', iconOff: 'camera-outline' },
  { name: 'Agenda', label: 'Agenda', component: WateringScheduleScreen, icon: 'calendar', iconOff: 'calendar-outline' },
  { name: 'Perfil', label: 'Perfil', component: ProfileScreen, icon: 'person', iconOff: 'person-outline' },
];

function Tabs() {
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
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{ title: t.label, headerShown: !['Jardin', 'Escanear'].includes(t.name) }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="PlantHistory"
        component={PlantHistoryScreen}
        options={{
          title: 'Mi planta',
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: typography.weight.bold },
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}