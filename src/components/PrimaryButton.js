/** PrimaryButton.js - Botón principal con estado de carga y deshabilitado. */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/theme';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'solid', // 'solid' | 'outline' | 'danger'
  style,
}) {
  const inactive = disabled || loading;
  const textColor =
    variant === 'solid' ? colors.surface : variant === 'danger' ? colors.danger : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'solid' && styles.solid,
        variant === 'outline' && styles.outline,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  solid: { backgroundColor: colors.ink },
  outline: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: 'transparent' },
  danger: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerTint },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: typography.weight.medium, letterSpacing: 0.3 },
});
