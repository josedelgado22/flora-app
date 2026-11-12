/**
 * DiagnosisScreen.js - Diagnóstico de salud vegetal por síntomas (HU-FLOR-012).
 * Recibe la planta por navegación: navigation.navigate('Diagnostico', { plant }).
 * Consulta las reglas del servidor y, sin conexión, usa las locales (diagnosisService).
 * Cada síntoma muestra su ícono vectorial (sintoma.icon / sintoma.iconColor).
 */
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const resultSymptom = result ? CATALOGO_SINTOMAS.find((item) => item.id === result.sintoma_id) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wrapper}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
            <Ionicons name="arrow-back" size={16} color={colors.accent} />
            <Text style={styles.back}>Volver</Text>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="stethoscope" size={26} color={colors.primaryDark} />
            <Text style={styles.title}>Diagnóstico de salud</Text>
          </View>
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
                  accessibilityRole="button"
                  accessibilityLabel={symptom.titulo}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${symptom.iconColor}22` }]}>
                    <MaterialCommunityIcons name={symptom.icon} size={24} color={symptom.iconColor} />
                  </View>
                  <Text style={styles.optionText}>{symptom.titulo}</Text>
                  {loadingId === symptom.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.resultBox}>
              <View style={styles.resultHeader}>
                {resultSymptom ? (
                  <MaterialCommunityIcons
                    name={resultSymptom.icon}
                    size={24}
                    color={resultSymptom.iconColor}
                  />
                ) : null}
                <Text style={styles.resultSymptom}>{result.titulo}</Text>
              </View>

              <View style={styles.labelRow}>
                <MaterialCommunityIcons name="stethoscope" size={15} color={colors.primaryDark} />
                <Text style={styles.label}>Diagnóstico:</Text>
              </View>
              <Text style={styles.causeText}>{result.causa}</Text>

              <View style={styles.labelRow}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={15} color={colors.primaryDark} />
                <Text style={styles.label}>Recomendación correctiva:</Text>
              </View>
              <Text style={styles.solutionText}>{result.solucion}</Text>

              {extra.length > 0 ? (
                <>
                  <View style={styles.labelRow}>
                    <Ionicons name="leaf-outline" size={15} color={colors.primaryDark} />
                    <Text style={styles.label}>Según tu planta:</Text>
                  </View>
                  {extra.map((line) => (
                    <Text key={line} style={styles.extraText}>
                      • {line}
                    </Text>
                  ))}
                </>
              ) : null}

              <View style={styles.sourceRow}>
                <Ionicons
                  name={result.source === 'servidor' ? 'cloud-done-outline' : 'phone-portrait-outline'}
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.source}>
                  {result.source === 'servidor'
                    ? 'Reglas del servidor ajustadas a tu planta'
                    : 'Reglas locales (disponibles sin conexión)'}
                </Text>
              </View>

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
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, alignSelf: 'flex-start' },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  instruction: { fontSize: 13, fontWeight: '600', marginBottom: 10, color: '#333333' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF7F9',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 8,
    minHeight: 60,
  },
  optionBusy: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  resultBox: {
    backgroundColor: colors.tint,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resultSymptom: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  causeText: { fontSize: 14, color: colors.text, marginTop: 2 },
  solutionText: { fontSize: 13, color: '#333333', marginTop: 2, lineHeight: 19 },
  extraText: { fontSize: 13, color: '#333333', marginTop: 4, lineHeight: 19 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  source: { flex: 1, fontSize: 11, color: colors.textMuted },
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