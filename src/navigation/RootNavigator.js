/**
 * RootNavigator.js - Decide qué flujo mostrar según el estado de sesión.
 *   restaurando -> splash | autenticado -> MainStack (tabs + pantallas sobre ellas) | no autenticado -> AuthStack
 * El cambio ocurre automáticamente al llamar signIn/signOut.
 */
import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoadingState from '../components/LoadingState';
import { useAuth } from '../context/AuthContext';
import DiagnosisScreen from '../screens/DiagnosisScreen';
import { colors } from '../theme/theme';
import AppNavigator from './AppNavigator';
import AuthStack from './AuthStack';
import { navigationRef } from './navigationRef';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const Stack = createNativeStackNavigator();

/** Tabs principales + pantallas que se abren por encima de ellas (ej. Diagnóstico). */
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AppNavigator} />
      <Stack.Screen name="Diagnostico" component={DiagnosisScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isRestoring } = useAuth();

  if (isRestoring) return <LoadingState message="Abriendo tu jardín..." />;

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
