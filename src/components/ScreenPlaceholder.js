/**
 * ScreenPlaceholder.js - Pantalla temporal para tabs aún no implementadas.
 * Se reemplaza por la pantalla real en los Bloques C y D.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { baseStyles, colors, spacing, typography } from '../theme/theme';

export default function ScreenPlaceholder({ icon = 'leaf-outline', title, description, story }) {
  return (
    <View style={[baseStyles.screen, baseStyles.centered, styles.wrap]}>
      <Ionicons name={icon} size={56} color={colors.primaryLight} />
      <Text style={[baseStyles.title, styles.title]}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {story ? <Text style={styles.story}>{story}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl },
  title: { marginTop: spacing.md, textAlign: 'center' },
  description: {
    marginTop: spacing.sm,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.size.md,
    lineHeight: 22,
  },
  story: { marginTop: spacing.md, color: colors.primaryLight, fontSize: typography.size.sm },
});
