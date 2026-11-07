/**
 * ScanStack.js - Flujo de la pestaña "Escanear":
 * Scan -> (ManualQuiz) -> PlantResult -> EnvironmentScan -> Compatibility
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CompatibilityResultScreen from '../screens/CompatibilityResultScreen';
import EnvironmentScanScreen from '../screens/EnvironmentScanScreen';
import ManualQuizScreen from '../screens/ManualQuizScreen';
import PlantDetailScreen from '../screens/PlantDetailScreen';
import ScanScreen from '../screens/ScanScreen';
import { colors } from '../theme/theme';

const Stack = createNativeStackNavigator();

export default function ScanStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Escanear' }} />
      <Stack.Screen name="ManualQuiz" component={ManualQuizScreen} options={{ title: 'Cuestionario' }} />
      <Stack.Screen name="PlantResult" component={PlantDetailScreen} options={{ title: 'Tu planta' }} />
      <Stack.Screen name="EnvironmentScan" component={EnvironmentScanScreen} options={{ title: 'Lugar' }} />
      <Stack.Screen name="Compatibility" component={CompatibilityResultScreen} options={{ title: 'Compatibilidad' }} />
    </Stack.Navigator>
  );
}
