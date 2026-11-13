/**
 * ScanScreen.js - Captura e Identificación Botánica por Visión Artificial (HU-FLOR-009 / HU-FLOR-010)
 *
 * Smart Fallback de doble nivel (ISO/IEC 25010 - tolerancia a fallos, SC-01):
 *   - Sin conexión                    -> nivel 2 inmediato (cuestionario heurístico).
 *   - Nivel 1: IA (Pl@ntNet)          -> candidatos con insignia "Verificada por IA".
 *   - IA caída / circuito abierto     -> nivel 2: cuestionario, o demostración si está configurado.
 *   - Error 400 (luminosidad)         -> reintento con mejor iluminación.
 * Además: consejos para una buena foto y las últimas identificaciones (SQLite).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CertaintyBadge from '../components/CertaintyBadge';
import LoadingState from '../components/LoadingState';
import PhotoPicker from '../components/PhotoPicker';
import PlantThumb from '../components/PlantThumb';
import PrimaryButton from '../components/PrimaryButton';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { useAiStatus } from '../services/aiCircuit';
import { useDemoSettings } from '../services/demoSettings';
import { addIdentification, getRecentIdentifications } from '../services/historyDb';
import { identifyPlant, shouldFallbackToQuiz } from '../services/plantIdService';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { getCertainty } from '../utils/certainty';
import { timeAgo } from '../utils/timeAgo';

const TIPS = [
  { icon: 'sunny-outline', text: 'Luz natural, sin flash ni sombras fuertes.' },
  { icon: 'leaf-outline', text: 'Una hoja o flor completa, bien centrada.' },
  { icon: 'scan-outline', text: 'Cerca y con el enfoque nítido.' },
  { icon: 'image-outline', text: 'Fondo simple, sin otras plantas detrás.' },
];

export default function ScanScreen({ navigation }) {
  const { isOnline } = useNetworkStatus();
  const aiStatus = useAiStatus();
  const demo = useDemoSettings();
  const [phase, setPhase] = useState('idle'); // 'idle' | 'processing' | 'error'
  const [photo, setPhoto] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [recent, setRecent] = useState([]);

  const degraded = aiStatus === 'degraded' || demo.aiMode === 'down';

  const loadRecent = useCallback(() => {
    getRecentIdentifications(3)
      .then(setRecent)
      .catch((error) => console.warn('[Scan] historial:', error?.message));
  }, []);

  useEffect(() => {
    loadRecent();
    return navigation.addListener('focus', loadRecent);
  }, [navigation, loadRecent]);

  const goToQuiz = (reason, photoUri = null) =>
    navigation.navigate('ManualQuiz', { photoUri, reason });

  const identify = async (picked) => {
    setPhoto(picked);
    setErrorMessage(null);

    // Nivel 2 inmediato si no hay red (latencia 0 ms)
    if (!isOnline) {
      goToQuiz('offline', picked.uri);
      return;
    }

    setPhase('processing');
    try {
      const { candidates, isDemo, fuente, tiempoMs } = await identifyPlant(picked);
      setPhase('idle');

      const certeza = getCertainty({ isDemo });
      addIdentification({ candidates, certeza, photoUri: picked.uri }).catch(() => {});

      const goToResult = () =>
        navigation.navigate('PlantResult', {
          photoUri: picked.uri,
          candidates,
          estimada: false,
          isDemo,
          fuente,
          tiempoMs,
        });

      if (isDemo) {
        // Transparencia: no son una identificación real de la foto.
        Alert.alert(
          'Modo demostración',
          'El servicio de identificación (Pl@ntNet) no está disponible en este momento. ' +
            'Te mostramos resultados de ejemplo, que no corresponden a una identificación real de tu foto.',
          [{ text: 'Ver resultados', onPress: goToResult }],
          { cancelable: false }
        );
      } else {
        goToResult();
      }
    } catch (error) {
      if (shouldFallbackToQuiz(error)) {
        setPhase('idle');
        const reason =
          error.code === 'timeout' ? 'timeout' : error.code === 'unavailable' ? 'unavailable' : 'network';
        goToQuiz(reason, picked.uri);
      } else {
        setPhase('error');
        setErrorMessage(error.message ?? 'No pudimos identificar la planta. Revisa la iluminación de la toma.');
      }
    }
  };

  const openRecent = (item) =>
    navigation.navigate('PlantResult', {
      photoUri: item.foto_uri,
      candidates: item.candidates,
      estimada: item.certeza === 'heuristica',
      isDemo: item.certeza === 'demo',
      fuente: item.certeza === 'ia' ? 'plantnet' : item.certeza === 'heuristica' ? 'heuristica' : 'simulado',
    });

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
        Toma una foto de las hojas con buena luz. Evaluaremos la especie y sus requerimientos de riego.
      </Text>

      {/* Estado del servicio de identificación (Smart Fallback) */}
      <View style={[styles.statusChip, degraded ? styles.statusDegraded : styles.statusOk]}>
        <Ionicons
          name={degraded ? 'cloud-offline-outline' : 'cloud-done-outline'}
          size={16}
          color={degraded ? colors.warning : colors.primaryDark}
        />
        <Text style={[styles.statusText, { color: degraded ? colors.warning : colors.primaryDark }]}>
          {degraded
            ? 'IA con problemas: usaremos el cuestionario (clasificación heurística)'
            : 'Identificación por IA disponible'}
        </Text>
      </View>

      {!isOnline && (
        <View style={styles.offlineBox}>
          <Ionicons name="cloud-offline" size={16} color={colors.warning} />
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

      {/* Consejos para una buena foto */}
      <View style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <Ionicons name="camera-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.tipsTitle}>Consejos para una buena foto</Text>
        </View>
        {TIPS.map((tip) => (
          <View key={tip.icon} style={styles.tipRow}>
            <Ionicons name={tip.icon} size={18} color={colors.primary} />
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>

      {/* Últimas identificaciones (SQLite) */}
      {recent.length > 0 && (
        <View style={styles.recentBox}>
          <Text style={styles.recentTitle}>Últimas identificaciones</Text>
          {recent.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentRow}
              onPress={() => openRecent(item)}
              activeOpacity={0.7}
              accessibilityLabel={`${item.nombre_comun}, abrir resultado`}
            >
              <PlantThumb uri={item.foto_uri} size={44} radius={12} iconSize={20} />
              <View style={styles.recentInfo}>
                <Text style={styles.recentName} numberOfLines={1}>{item.nombre_comun}</Text>
                <Text style={styles.recentLatin} numberOfLines={1}>{item.nombre_cientifico}</Text>
                <CertaintyBadge
                  certainty={item.certeza}
                  percent={item.coincidencia}
                  compact
                  style={styles.recentBadge}
                />
              </View>
              <Text style={styles.recentTime}>{timeAgo(item.creado_en)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Atribución obligatoria de API Pl@ntNet (Términos de Servicio) */}
      <View style={styles.attributionBox}>
        <Text style={styles.attributionText}>Powered by Pl@ntNet v2 Vision API</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  statusOk: { backgroundColor: colors.tint },
  statusDegraded: { backgroundColor: '#FBF3E1' },
  statusText: { flex: 1, fontSize: 12, fontWeight: '600' },
  pickerBox: { marginTop: spacing.md },
  link: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  offlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FBF3E1',
  },
  offlineText: { flex: 1, color: colors.warning, fontSize: 13, fontWeight: '500' },
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
  tipsCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.tint,
  },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  tipText: { flex: 1, fontSize: 13, color: '#333333' },
  recentBox: { marginTop: spacing.lg },
  recentTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentTint,
  },
  recentInfo: { flex: 1, gap: 2 },
  recentName: { fontSize: 14, fontWeight: '600', color: colors.text },
  recentLatin: { fontSize: 11, fontStyle: 'italic', color: colors.accent },
  recentBadge: { marginTop: 2 },
  recentTime: { fontSize: 11, color: colors.textMuted, marginLeft: 8 },
  attributionBox: { marginTop: spacing.xl, alignItems: 'center' },
  attributionText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
});