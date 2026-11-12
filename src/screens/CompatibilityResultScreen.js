/**
 * CompatibilityResultScreen.js - Paso 3: veredicto planta + lugar (HU-FLOR-009 / HU-FLOR-011).
 * Es el diferenciador del producto: cruza la especie con la luz y el tipo de lugar,
 * entrega recomendaciones, ajusta la frecuencia de riego según el entorno
 * e incluye la atribución normativa obligatoria a Pl@ntNet v2 Vision API.
 */
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { usePlants } from '../context/PlantsContext';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { evaluateCompatibility } from '../utils/compatibility';
import { lightLabel } from '../utils/light';
import { sourceLabel } from '../utils/certainty';
import { buildPlantPayload } from '../utils/plantPayload';

const VERDICT_META = {
  ideal: { icon: 'checkmark-circle', title: 'Lugar ideal', color: colors.primaryDark, bg: colors.tint },
  aceptable: { icon: 'warning', title: 'Lugar aceptable', color: colors.warning, bg: '#FBF3E1' },
  no_recomendado: { icon: 'close-circle', title: 'No recomendado', color: colors.danger, bg: colors.dangerTint },
};

export default function CompatibilityResultScreen({ route, navigation }) {
  const { photoUri, species, light, ubicacion, fuente = 'plantnet', tiempoMs = 0 } = route.params;
  const { addPlant } = usePlants();
  const [saving, setSaving] = useState(false);

  const result = useMemo(
    () => evaluateCompatibility({ species, light: light.nivel, ubicacion }),
    [species, light.nivel, ubicacion]
  );
  const meta = VERDICT_META[result.verdict];

  const goToGarden = () => {
    navigation.popToTop();
    navigation.getParent()?.navigate('Jardin');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await addPlant(
        buildPlantPayload(species, {
          ubicacion,
          nivel_luz: light.nivel,
          frecuencia_riego_dias: result.frecuenciaAjustadaDias,
          photoUri,
        })
      );
      Alert.alert(
        '¡Planta guardada!',
        `${species.nombre_comun} quedó en tu jardín con riego cada ${result.frecuenciaAjustadaDias} días.`,
        [{ text: 'Ver mi jardín', onPress: goToGarden }]
      );
    } catch (error) {
      Alert.alert('No se pudo guardar', 'Inténtalo de nuevo en unos segundos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.verdictCard, { backgroundColor: meta.bg }]}>
        <Ionicons name={meta.icon} size={48} color={meta.color} />
        <Text style={[styles.verdictTitle, { color: meta.color }]}>{meta.title}</Text>
        <Text style={styles.verdictSub}>
          {species.nombre_comun} en un lugar {ubicacion} · compatibilidad {result.score}%
        </Text>
      </View>

      <View style={styles.compareRow}>
        <View style={styles.compareBox}>
          <Text style={styles.compareLabel}>Luz del lugar</Text>
          <Text style={styles.compareValue}>{lightLabel(light.nivel)}</Text>
        </View>
        <View style={styles.compareBox}>
          <Text style={styles.compareLabel}>Luz que necesita</Text>
          <Text style={styles.compareValue}>{lightLabel(species.nivel_luz_ideal)}</Text>
        </View>
      </View>

      <View style={styles.waterBox}>
        <Ionicons name="water" size={30} color="#3B8EDB" style={styles.waterIcon} />
        <View style={styles.flex}>
          <Text style={styles.waterTitle}>Riego recomendado: cada {result.frecuenciaAjustadaDias} días</Text>
          <Text style={styles.waterSub}>Ajustado a la luz de este lugar.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recomendaciones</Text>
      {result.recomendaciones.map((text, index) => (
        <View key={index} style={styles.tipRow}>
          <View style={styles.tipDot} />
          <Text style={styles.tipText}>{text}</Text>
        </View>
      ))}

      <PrimaryButton
        title="Guardar en mi jardín"
        onPress={handleSave}
        loading={saving}
        style={styles.cta}
      />
      <PrimaryButton
        title="Probar otro lugar"
        variant="outline"
        onPress={() => navigation.goBack()}
        disabled={saving}
        style={styles.second}
      />

      {/* Fuente del resultado (transparencia) + atribución obligatoria a Pl@ntNet cuando aplica */}
      <View style={styles.attributionContainer}>
        <Text style={styles.attributionTitle}>Reconocimiento de Fuente de Datos</Text>
        {fuente === 'plantnet' ? (
          <Text style={styles.attributionBody}>
            Identificación botánica procesada mediante <Text style={styles.boldText}>Pl@ntNet v2 Vision API</Text>
            {tiempoMs > 0 ? ` (${tiempoMs} ms)` : ''}.
          </Text>
        ) : (
          <Text style={styles.attributionBody}>
            Este resultado no proviene de una identificación por imagen de Pl@ntNet.
          </Text>
        )}
        <Text style={styles.attributionSub}>Fuente: {sourceLabel(fuente)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  verdictCard: { padding: spacing.lg, borderRadius: radius.lg, alignItems: 'center' },
  verdictTitle: { fontSize: 22, fontWeight: '700', marginTop: spacing.xs },
  verdictSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  compareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  compareBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E4A2A3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  compareLabel: { fontSize: 11, color: colors.textMuted },
  compareValue: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 2 },
  waterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentTint,
  },
  waterIcon: { marginRight: spacing.md },
  waterTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  waterSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  tipRow: { flexDirection: 'row', marginBottom: spacing.sm },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7, marginRight: spacing.sm },
  tipText: { flex: 1, fontSize: 13, color: '#333333', lineHeight: 19 },
  cta: { marginTop: spacing.lg },
  second: { marginTop: spacing.sm },
  attributionContainer: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E0E0E0',
    alignItems: 'center',
  },
  attributionTitle: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  attributionBody: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  attributionSub: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  boldText: { fontWeight: '700' },
});