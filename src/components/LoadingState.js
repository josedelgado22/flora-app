/** LoadingState.js - Indicador de carga reutilizable (pantalla completa o inline). */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme/theme';

export default function LoadingState({ message = 'Cargando...', fullScreen = true }) {
  return (
    <View style={[styles.container, fullScreen && styles.full]}>
      <ActivityIndicator size="large" color={colors.primaryLight} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  full: { flex: 1, backgroundColor: colors.background },
  text: { marginTop: spacing.md, color: colors.textMuted, fontSize: typography.size.md },
});
