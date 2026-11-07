/** ErrorState.js - Mensaje de error con acción de reintento. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from './PrimaryButton';
import { colors, spacing, typography } from '../theme/theme';

export default function ErrorState({ message, onRetry, retryLabel = 'Reintentar' }) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.danger} />
      <Text style={styles.title}>No pudimos cargar tus plantas</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <PrimaryButton title={retryLabel} onPress={onRetry} variant="outline" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: spacing.xl },
  title: {
    marginTop: spacing.md,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  message: { marginTop: spacing.sm, color: colors.textMuted, textAlign: 'center', fontSize: typography.size.sm },
  button: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
