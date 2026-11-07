/**
 * PlantDetailScreen.js - Resultado de la identificación (ruta "PlantResult").
 * Recibe { photoUri, candidates[], estimada }. Permite elegir entre candidatos,
 * evaluar el lugar (flujo completo) o guardar directamente.
 */
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import { usePlants } from '../context/PlantsContext';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { lightLabel } from '../utils/light';
import { buildPlantPayload } from '../utils/plantPayload';

export default function PlantDetailScreen({ route, navigation }) {
  const { photoUri = null, candidates = [], estimada = false } = route.params ?? {};
  const { addPlant } = usePlants();

  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);

  const species = candidates[selected];

  if (!species) {
    return (
      <View style={[baseStyles.screen, baseStyles.centered, styles.emptyWrap]}>
        <Text style={styles.name}>No hay resultados para mostrar</Text>
        <PrimaryButton title="Volver a escanear" onPress={() => navigation.popToTop()} style={styles.emptyBtn} />
      </View>
    );
  }

  const goToGarden = () => {
    navigation.popToTop();
    navigation.getParent()?.navigate('Jardin');
  };

  const handleSaveDirect = async () => {
    setSaving(true);
    try {
      await addPlant(buildPlantPayload(species, { photoUri }));
      Alert.alert('¡Planta guardada! 🌱', `${species.nombre_comun} ya está en tu jardín.`, [
        { text: 'Ver mi jardín', onPress: goToGarden },
      ]);
    } catch (error) {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Text style={styles.photoEmoji}>🌿</Text>
        </View>
      )}

      <View style={styles.matchTag}>
        <Text style={styles.matchText}>
          {estimada ? `Coincidencia estimada ~${species.coincidencia}%` : `${species.coincidencia}% de coincidencia`}
        </Text>
      </View>

      {estimada && (
        <Text style={styles.note}>
          Resultado estimado con tus respuestas. Confirma que se parece a tu planta.
        </Text>
      )}

      {species.datos_estimados && (
        <Text style={styles.note}>
          Esta especie no está en nuestro catálogo: los datos de cuidado son estimados.
        </Text>
      )}

      {candidates.length > 1 && (
        <View style={styles.chips}>
          {candidates.map((candidate, index) => (
            <TouchableOpacity
              key={candidate.id}
              onPress={() => setSelected(index)}
              style={[styles.chip, index === selected && styles.chipActive]}
              accessibilityState={{ selected: index === selected }}
            >
              <Text style={[styles.chipText, index === selected && styles.chipTextActive]}>
                {candidate.nombre_comun} · {candidate.coincidencia}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.name}>{species.nombre_comun}</Text>
      <Text style={styles.latin}>{species.nombre_cientifico}</Text>

      <View style={styles.careGrid}>
        <View style={styles.careChip}>
          <Text style={styles.careVal}>cada {species.frecuencia_riego_dias} d</Text>
          <Text style={styles.careLab}>riego base</Text>
        </View>
        <View style={styles.careChip}>
          <Text style={styles.careVal}>{lightLabel(species.nivel_luz_ideal)}</Text>
          <Text style={styles.careLab}>luz ideal</Text>
        </View>
        <View style={styles.careChip}>
          <Text style={styles.careVal}>{species.temperatura}</Text>
          <Text style={styles.careLab}>temperatura</Text>
        </View>
      </View>

      <PrimaryButton
        title="Evaluar el lugar donde la pondré"
        onPress={() => navigation.navigate('EnvironmentScan', { photoUri, species })}
        disabled={saving}
        style={styles.cta}
      />
      <PrimaryButton
        title="Guardar en mi jardín sin evaluar"
        variant="outline"
        onPress={handleSaveDirect}
        loading={saving}
        style={styles.second}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  photo: { height: 200, borderRadius: 18, width: '100%' },
  photoPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  photoEmoji: { fontSize: 56 },
  matchTag: {
    alignSelf: 'flex-start',
    marginTop: -14,
    marginLeft: spacing.md,
    backgroundColor: '#000000',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  note: { marginTop: spacing.sm, fontSize: 12, color: colors.warning },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },
  name: { fontSize: 22, fontWeight: '700', color: '#000000', marginTop: spacing.md },
  latin: { fontSize: 13, fontStyle: 'italic', color: colors.accent, marginTop: 2 },
  careGrid: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  careChip: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4A2A3',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  careVal: { fontSize: 13, fontWeight: '600', color: '#000000', textAlign: 'center' },
  careLab: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  cta: { marginTop: spacing.lg },
  second: { marginTop: spacing.sm },
  emptyWrap: { padding: spacing.xl },
  emptyBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
