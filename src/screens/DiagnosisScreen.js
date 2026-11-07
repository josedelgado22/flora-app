/**
 * DiagnosisScreen.js - Diagnóstico de salud vegetal por síntomas (HU-FLOR-012).
 * Recibe la planta por navegación: navigation.navigate('Diagnostico', { plant }).
 * Consulta las reglas del servidor y, sin conexión, usa las locales (diagnosisService).
 */
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATALOGO_SINTOMAS } from '../components/SymptomDiagnosisModal';
import { diagnose } from '../services/diagnosisService';
import { colors, radius, spacing } from '../theme/theme';

export default function DiagnosisScreen({ route, navigation }) {
  const plant = route?.params?.plant ?? null;
  const [loadingId, setLoadingId] = useState(null);
  const [result, setResult] = useState(null);

  const handleSelect = async (symptom) => {
    if (loadingId) return;
    setLoadingId(symptom.id);
    try {
      setResult(await diagnose(symptom.id, plant));
    } finally {
      setLoadingId(null);
    }
  };

  const extra = result?.recomendaciones_adicionales ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wrapper}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Diagnóstico de salud</Text>
          <Text style={styles.sub}>Planta: {plant?.nombre_comun || 'Seleccionada'}</Text>

          {!result ? (
            <>
              <Text style={styles.instruction}>¿Qué síntoma visual observas en las hojas o el tallo?</Text>
              {CATALOGO_SINTOMAS.map((symptom) => (
                <TouchableOpacity
                  key={symptom.id}
                  style={[styles.option, loadingId === symptom.id && styles.optionBusy]}
                  onPress={() => handleSelect(symptom)}
                  disabled={loadingId !== null}
                  accessibilityLabel={symptom.titulo}
                >
                  <Text style={styles.optionText}>{symptom.titulo}</Text>
                  {loadingId === symptom.id ? <ActivityIndicator color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.resultSymptom}>{result.titulo}</Text>

              <Text style={styles.label}>Diagnóstico:</Text>
              <Text style={styles.causeText}>{result.causa}</Text>

              <Text style={styles.label}>Recomendación correctiva:</Text>
              <Text style={styles.solutionText}>{result.solucion}</Text>

              {extra.length > 0 ? (
                <>
                  <Text style={styles.label}>Según tu planta:</Text>
                  {extra.map((line) => (
                    <Text key={line} style={styles.extraText}>
                      • {line}
                    </Text>
                  ))}
                </>
              ) : null}

              <Text style={styles.source}>
                {result.source === 'servidor'
                  ? 'Reglas del servidor ajustadas a tu planta'
                  : 'Reglas locales (disponibles sin conexión)'}
              </Text>

              <TouchableOpacity style={styles.btnReset} onPress={() => setResult(null)}>
                <Text style={styles.btnResetText}>Elegir otro síntoma</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.btnClose} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.btnCloseText}>Volver al jardín</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingBottom: 32, alignItems: 'center' },
  wrapper: { width: '100%', maxWidth: 600 },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600', paddingVertical: 10 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  instruction: { fontSize: 13, fontWeight: '600', marginBottom: 10, color: '#333333' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FBF7F9',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  optionBusy: { opacity: 0.7 },
  optionText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  resultBox: {
    backgroundColor: colors.tint,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resultSymptom: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginTop: 6 },
  causeText: { fontSize: 14, color: colors.text, marginTop: 2 },
  solutionText: { fontSize: 13, color: '#333333', marginTop: 2, lineHeight: 19 },
  extraText: { fontSize: 13, color: '#333333', marginTop: 4, lineHeight: 19 },
  source: { fontSize: 11, color: colors.textMuted, marginTop: 12 },
  btnReset: { marginTop: 12, alignSelf: 'flex-start' },
  btnResetText: { fontSize: 12, color: colors.accent, fontWeight: '600', textDecorationLine: 'underline' },
  btnClose: {
    marginTop: 20,
    backgroundColor: colors.ink,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
