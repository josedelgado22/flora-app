/**
 * SymptomDiagnosisModal.js - Diagnóstico de salud vegetal por síntomas (HU-FLOR-012).
 * Base de reglas causales local: funciona sin conexión.
 * Extraído del HomeScreen original para poder reutilizarlo en DiagnosisScreen.
 * Los síntomas llevan un ícono vectorial (MaterialCommunityIcons) en lugar de emoji.
 */
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

export const CATALOGO_SINTOMAS = [
  {
    id: 's1',
    titulo: 'Hojas amarillas y blandas',
    icon: 'leaf',
    iconColor: '#F9A825',
    causa: 'Exceso de riego (asfixia radicular)',
    solucion:
      'Pausa el riego inmediatamente. Permite que los primeros 3 cm de sustrato se sequen totalmente antes de volver a regar.',
    tipo: 'exceso',
  },
  {
    id: 's2',
    titulo: 'Hojas marrones, secas y crujientes',
    icon: 'leaf-off',
    iconColor: '#8D6E63',
    causa: 'Falta de riego o humedad ambiental baja',
    solucion:
      'Realiza un riego por inmersión de 15 minutos y pulveriza sus hojas si es una especie tropical.',
    tipo: 'falta',
  },
  {
    id: 's3',
    titulo: 'Manchas negras u oscuras en follaje',
    icon: 'bacteria',
    iconColor: '#424242',
    causa: 'Infección fúngica por exceso de humedad en hojas',
    solucion:
      'Poda las hojas infectadas con tijera desinfectada y evita mojar el follaje al regar.',
    tipo: 'hongo',
  },
  {
    id: 's4',
    titulo: 'Plantas caídas o tallos débiles',
    icon: 'sprout-outline',
    iconColor: '#C2185B',
    causa: 'Estrés hídrico o falta de luminosidad',
    solucion:
      'Verifica la humedad del sustrato. Si está seco, riega; si está húmedo, traslada a un lugar más iluminado.',
    tipo: 'luz',
  },
];

export default function SymptomDiagnosisModal({ visible, plantName, onClose }) {
  const [result, setResult] = useState(null);

  // Cada vez que se abre, vuelve a la lista de síntomas
  useEffect(() => {
    if (visible) setResult(null);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Diagnóstico de salud</Text>
          <Text style={styles.sub}>Planta: {plantName || 'Seleccionada'}</Text>

          {!result ? (
            <>
              <Text style={styles.instruction}>
                ¿Qué síntoma visual observas en las hojas o el tallo?
              </Text>
              {CATALOGO_SINTOMAS.map((sintoma) => (
                <TouchableOpacity
                  key={sintoma.id}
                  style={styles.option}
                  onPress={() => setResult(sintoma)}
                >
                  <View style={styles.optionRow}>
                    <MaterialCommunityIcons name={sintoma.icon} size={22} color={sintoma.iconColor} />
                    <Text style={styles.optionText}>{sintoma.titulo}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.diagnosisBox}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="stethoscope" size={16} color={colors.primaryDark} />
                <Text style={styles.causeTitle}>Diagnóstico:</Text>
              </View>
              <Text style={styles.causeText}>{result.causa}</Text>

              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.causeTitle}>Recomendación correctiva:</Text>
              </View>
              <Text style={styles.solutionText}>{result.solucion}</Text>

              <TouchableOpacity style={styles.btnReset} onPress={() => setResult(null)}>
                <Text style={styles.btnResetText}>Elegir otro síntoma</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.btnClose} onPress={onClose}>
            <Text style={styles.btnCloseText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 5 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, marginBottom: 14 },
  instruction: { fontSize: 13, fontWeight: '600', marginBottom: 10, color: '#333333' },
  option: {
    backgroundColor: '#FBF7F9',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
  diagnosisBox: {
    backgroundColor: colors.tint,
    padding: 14,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  causeTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  causeText: { fontSize: 13, color: colors.text, marginBottom: 10, marginTop: 2 },
  solutionText: { fontSize: 12, color: '#333333', marginTop: 2 },
  btnReset: { marginTop: 12, alignSelf: 'flex-start' },
  btnResetText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  btnClose: {
    marginTop: 16,
    backgroundColor: colors.ink,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCloseText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});