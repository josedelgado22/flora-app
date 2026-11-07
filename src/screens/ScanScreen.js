/**
 * ScanScreen.js - Captura e Identificación Botánica por Visión Artificial (HU-FLOR-009 / HU-FLOR-010)
 * 
 * Flujo de Resiliencia ISO/IEC 25010 (SC-01):
 *   - Sin conexión a internet          -> Redirección automática al cuestionario manual (0 ms).
 *   - Respuesta IA < 3.0 s              -> Presentación de candidatos botánicos.
 *   - Timeout / Error de Red / HTTP 5xx -> Conmutación suave hacia el cuestionario manual.
 *   - Error HTTP 400 (Luminosidad)     -> Alerta visual para reintento con mejor iluminación.
 */
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LoadingState from '../components/LoadingState';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { identifyPlant, shouldFallbackToQuiz } from '../services/plantIdService';
import { baseStyles, colors, radius, spacing } from '../theme/theme';

export default function ScanScreen({ navigation }) {
  const { isOnline } = useNetworkStatus();
  const [phase, setPhase] = useState('idle'); // 'idle' | 'processing' | 'error'
  const [photo, setPhoto] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const goToQuiz = (reason, photoUri = null) =>
    navigation.navigate('ManualQuiz', { photoUri, reason });

  const identify = async (picked) => {
    setPhoto(picked);
    setErrorMessage(null);

    // Conmutación inmediata si no hay red celular/Wi-Fi (ISO/IEC 25010: Latencia 0 ms)
    if (!isOnline) {
      goToQuiz('offline', picked.uri);
      return;
    }

    setPhase('processing');
    try {
      const { candidates } = await identifyPlant(picked);
      setPhase('idle');
      navigation.navigate('PlantResult', { photoUri: picked.uri, candidates, estimada: false });
    } catch (error) {
      if (shouldFallbackToQuiz(error)) {
        setPhase('idle');
        goToQuiz(error.code === 'timeout' ? 'timeout' : 'network', picked.uri);
      } else {
        setPhase('error');
        setErrorMessage(error.message ?? 'No pudimos identificar la planta. Revisa la iluminación de la toma.');
      }
    }
  };

  if (phase === 'processing') {
    return (
      <View style={baseStyles.screen}>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.processingPhoto} /> : null}
        <LoadingState message="Identificando tu planta con Pl@ntNet AI..." />
      </View>
    );
  }

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Identifica tu planta</Text>
      <Text style={styles.subtitle}>
        Toma una foto de las hojas con buena luz (evita sombras extremas o encandilamiento). Evaluaremos la especie y sus requerimientos de riego.
      </Text>

      {!isOnline && (
        <View style={styles.offlineBox}>
          <Text style={styles.offlineText}>
            Sin conexión: al tomar la foto, te ayudaremos con un cuestionario interactivo offline.
          </Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorTitle}>No pudimos procesar la imagen</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <View style={styles.errorActions}>
            <PrimaryButton
              title="Reintentar"
              onPress={() => photo && identify(photo)}
              style={styles.flex}
            />
            <PrimaryButton
              title="Usar cuestionario"
              variant="outline"
              onPress={() => goToQuiz('manual', photo?.uri)}
              style={styles.flex}
            />
          </View>
        </View>
      )}

      <View style={styles.pickerBox}>
        <PhotoPicker onPicked={identify} />
      </View>

      <TouchableOpacity onPress={() => goToQuiz('manual')} activeOpacity={0.7}>
        <Text style={styles.link}>No puedo tomar la foto: identificar mediante preguntas</Text>
      </TouchableOpacity>

      {/* Atribución obligatoria de API Pl@ntNet (Términos de Servicio) */}
      <View style={styles.attributionBox}>
        <Text style={styles.attributionText}>Powered by Pl@ntNet v2 Vision API</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  pickerBox: { marginTop: spacing.lg },
  link: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  offlineBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FBF3E1',
  },
  offlineText: { color: colors.warning, fontSize: 13, fontWeight: '500' },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerTint,
  },
  errorTitle: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 2 },
  errorActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
  processingPhoto: { height: 220, width: '100%' },
  attributionBox: { marginTop: spacing.xl, alignItems: 'center' },
  attributionText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
});