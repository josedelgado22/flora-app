// flora_app/src/components/CertaintyBadge.js
/**
 * CertaintyBadge - Insignia de certidumbre botánica.
 *   <CertaintyBadge certainty="ia" percent={63} />          -> "Verificada por IA 63%"
 *   <CertaintyBadge certainty="heuristica" percent={55} />  -> "Clasificación heurística ~55%"
 *   <CertaintyBadge certainty="demo" />                     -> "Demostración"
 * El color nunca es lo único que informa: siempre lleva ícono y texto (WCAG 1.4.1).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CERTAINTY_META } from '../utils/certainty';

export default function CertaintyBadge({ certainty = 'ia', percent = null, compact = false, style }) {
  const meta = CERTAINTY_META[certainty] ?? CERTAINTY_META.ia;
  const showPercent = percent !== null && percent !== undefined && certainty !== 'demo';
  const percentText = showPercent ? ` ${certainty === 'heuristica' ? '~' : ''}${percent}%` : '';

  return (
    <View
      style={[styles.badge, { backgroundColor: meta.bg, borderColor: meta.color }, compact && styles.compact, style]}
      accessibilityLabel={`${meta.label}${percentText}. ${meta.hint}`}
    >
      <Ionicons name={meta.icon} size={compact ? 11 : 14} color={meta.color} />
      <Text style={[styles.text, { color: meta.color }, compact && styles.textCompact]} numberOfLines={1}>
        {meta.label}
        {percentText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compact: { paddingHorizontal: 7, paddingVertical: 2, gap: 3 },
  text: { fontSize: 12, fontWeight: '700' },
  textCompact: { fontSize: 10 },
});