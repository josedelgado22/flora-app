/** ConnectionBanner.js - Informa sin conexión, cola pendiente y datos de demostración. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/theme';

export default function ConnectionBanner({ isOnline, pendingCount, source }) {
  let config = null;

  if (!isOnline) {
    config = {
      icon: 'cloud-offline-outline',
      tone: 'warning',
      text:
        pendingCount > 0
          ? `Sin conexión. ${pendingCount} ${pendingCount === 1 ? 'acción espera' : 'acciones esperan'} para sincronizarse.`
          : 'Sin conexión. Tus riegos se guardan en el teléfono.',
    };
  } else if (pendingCount > 0) {
    config = {
      icon: 'sync-outline',
      tone: 'info',
      text: `Sincronizando ${pendingCount} ${pendingCount === 1 ? 'acción' : 'acciones'}...`,
    };
  } else if (source === 'mock') {
    config = { icon: 'flask-outline', tone: 'info', text: 'Datos de demostración.' };
  }

  if (!config) return null;

  const isWarning = config.tone === 'warning';
  return (
    <View style={[styles.banner, isWarning ? styles.warning : styles.info]} accessibilityRole="alert">
      <Ionicons name={config.icon} size={18} color={isWarning ? colors.warning : colors.primaryDark} />
      <Text style={[styles.text, { color: isWarning ? colors.warning : colors.primaryDark }]}>
        {config.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  warning: { backgroundColor: '#FBF3E1' },
  info: { backgroundColor: colors.tint },
  text: { flex: 1, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
});
