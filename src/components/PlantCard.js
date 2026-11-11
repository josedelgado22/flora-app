/**
 * PlantCard.js - Tarjeta de planta (diseño original de F.L.O.R.A.).
 * Muestra la foto de la planta (o un ícono de hoja si no tiene), ubicación, estado de riego
 * calculado y acciones: regar / reportar síntoma.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getWateringStatus } from '../utils/watering';
import { colors, radius, spacing } from '../theme/theme';
import PlantThumb from './PlantThumb';

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

export default function PlantCard({ plant, onWater, onReportSymptom, onPress }) {
  const [isWatering, setIsWatering] = useState(false);
  const status = getWateringStatus(plant);
  const isDue = status.state !== 'ok';

  const subtitle = [capitalize(plant.ubicacion), plant.nivel_luz ? `Luz ${plant.nivel_luz}` : null]
    .filter(Boolean)
    .join(' · ');

  const handleWater = async () => {
    if (isWatering) return;
    setIsWatering(true);
    try {
      await onWater?.(plant.id);
    } finally {
      setIsWatering(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
        <PlantThumb uri={plant.foto_url} />

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{plant.nombre_comun}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
        </View>

        <Text style={[styles.waterTag, isDue && styles.waterTagUrgent]} numberOfLines={2}>
          {status.label}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        {isDue && (
          <TouchableOpacity
            style={[styles.btnWater, isWatering && styles.disabled]}
            onPress={handleWater}
            disabled={isWatering}
            accessibilityLabel={`Regar ${plant.nombre_comun}`}
          >
            <Ionicons name="water" size={14} color="#FFFFFF" />
            <Text style={styles.btnWaterText}>{isWatering ? 'Registrando...' : 'Regar ahora'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btnSymptom} onPress={() => onReportSymptom?.(plant)}>
          <MaterialCommunityIcons name="stethoscope" size={15} color={colors.accent} />
          <Text style={styles.btnSymptomText}>Reportar síntoma</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.accentTint, borderRadius: radius.md, marginBottom: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  waterTag: {
    maxWidth: 110,
    textAlign: 'right',
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '600',
    paddingLeft: spacing.sm,
  },
  waterTagUrgent: { color: colors.accent, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3D3DE',
  },
  btnWater: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnWaterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  btnSymptom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnSymptomText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});