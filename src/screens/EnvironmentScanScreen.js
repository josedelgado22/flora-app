/**
 * EnvironmentScanScreen.js - Paso 2: evaluar el lugar (HU-FLOR-010 / SC-03).
 * Fotometría local por histograma; si no hay foto o falla el análisis, el usuario
 * puede indicar el nivel de luz manualmente.
 */
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HistogramChart from '../components/HistogramChart';
import LoadingState from '../components/LoadingState';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';
import { analyzeLight } from '../services/lightService';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { LIGHT_LEVELS, lightLabel } from '../utils/light';

const PLACE_OPTIONS = [
  { value: 'interior', label: 'Interior', icon: 'home' },
  { value: 'exterior', label: 'Exterior', icon: 'sunny' },
];

export default function EnvironmentScanScreen({ route, navigation }) {
  const { photoUri, species } = route.params;

  const [ubicacion, setUbicacion] = useState(
    species.ubicacion_ideal === 'exterior' ? 'exterior' : 'interior'
  );
  const [placePhoto, setPlacePhoto] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [light, setLight] = useState(null); // { nivel, luminanciaMedia?, histograma?, manual }
  const [error, setError] = useState(null);

  const handlePlacePhoto = async (picked) => {
    setPlacePhoto(picked);
    setError(null);
    setAnalyzing(true);
    try {
      const result = await analyzeLight(picked.uri);
      setLight({ ...result, manual: false });
    } catch (e) {
      setLight(null);
      setError('No pudimos medir la luz de la foto. Elige el nivel de luz manualmente.');
    } finally {
      setAnalyzing(false);
    }
  };

  const chooseManual = (nivel) => {
    setError(null);
    setLight({ nivel, manual: true });
  };

  const goToResult = () =>
    navigation.navigate('Compatibility', {
      photoUri,
      placePhotoUri: placePhoto?.uri ?? null,
      species,
      light,
      ubicacion,
    });

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>¿Dónde la pondrás?</Text>
      <Text style={styles.subtitle}>
        Fotografía el lugar para medir cuánta luz recibe {species.nombre_comun}.
      </Text>

      <Text style={styles.sectionLabel}>Tipo de lugar</Text>
      <View style={styles.segment}>
        {PLACE_OPTIONS.map((option) => {
          const active = ubicacion === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => setUbicacion(option.value)}
              accessibilityState={{ selected: active }}
            >
              <Ionicons name={option.icon} size={18} color={active ? '#FFFFFF' : colors.text} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Foto del lugar</Text>
      {placePhoto ? <Image source={{ uri: placePhoto.uri }} style={styles.placePhoto} /> : null}

      {analyzing ? (
        <LoadingState message="Midiendo la luz..." fullScreen={false} />
      ) : (
        <PhotoPicker
          onPicked={handlePlacePhoto}
          cameraLabel={placePhoto ? 'Tomar otra foto' : 'Fotografiar el lugar'}
          cameraIcon="camera-outline"
        />
      )}

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {light && !light.manual && (
        <View style={styles.lightCard}>
          <Text style={styles.lightTitle}>{lightLabel(light.nivel)}</Text>
          <Text style={styles.lightSub}>Luminosidad promedio: {light.luminanciaMedia} de 255</Text>
          <View style={styles.histogram}>
            <HistogramChart histogram={light.histograma} />
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>
        {light && !light.manual ? '¿No coincide? Corrígelo' : '¿Sin foto? Elige el nivel de luz'}
      </Text>
      {LIGHT_LEVELS.map((level) => {
        const active = light?.nivel === level.value;
        return (
          <TouchableOpacity
            key={level.value}
            style={[styles.levelOption, active && styles.levelOptionActive]}
            onPress={() => chooseManual(level.value)}
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.levelLabel}>{level.label}</Text>
            <Text style={styles.levelHint}>{level.hint}</Text>
          </TouchableOpacity>
        );
      })}

      <PrimaryButton
        title="Ver compatibilidad"
        onPress={goToResult}
        disabled={!light || analyzing}
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  segmentItemActive: { backgroundColor: colors.ink },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.text },
  segmentTextActive: { color: '#FFFFFF' },
  placePhoto: { height: 160, borderRadius: radius.md, marginBottom: spacing.sm, width: '100%' },
  errorBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerTint },
  errorText: { color: colors.danger, fontSize: 13 },
  lightCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.tint,
  },
  lightTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  lightSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  histogram: { marginTop: spacing.md },
  levelOption: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  levelOptionActive: { borderColor: colors.primary, backgroundColor: colors.tint },
  levelLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  levelHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cta: { marginTop: spacing.lg },
});