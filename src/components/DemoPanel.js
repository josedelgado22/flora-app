// flora_app/src/components/DemoPanel.js
/**
 * DemoPanel - Panel Oculto de Demostración (se abre con 5 toques en Perfil, ver SecretTapArea).
 *
 * Es el "seguro" ante una caída de señal o de Pl@ntNet durante la evaluación:
 *   - Modo de IA: Automático / Simular caída / Solo demostración.
 *   - Respaldo si la IA falla: Cuestionario (heurístico) o Resultados de demostración.
 *   - Estado del servidor (ping a /health/) y del circuit breaker.
 *   - Notificación de prueba a los 5 s.
 * Todo resultado de demostración se marca como tal en pantalla (transparencia algorítmica).
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config/appConfig';
import { resetCircuit, useAiStatus } from '../services/aiCircuit';
import { request } from '../services/apiClient';
import { updateDemoSettings, useDemoSettings } from '../services/demoSettings';
import { scheduleTestNotification } from '../services/notificationService';
import { colors, radius, spacing } from '../theme/theme';

const AI_MODES = [
  { value: 'auto', label: 'Automático' },
  { value: 'down', label: 'Simular caída' },
  { value: 'demo', label: 'Solo demo' },
];

const FALLBACK_MODES = [
  { value: 'quiz', label: 'Cuestionario' },
  { value: 'demo', label: 'Demostración' },
];

function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function DemoPanel({ visible, onClose }) {
  const settings = useDemoSettings();
  const aiStatus = useAiStatus();
  const [ping, setPing] = useState(null); // { state: 'loading'|'ok'|'error', ms?, code? }
  const [notified, setNotified] = useState(false);

  const pingServer = async () => {
    const startedAt = Date.now();
    setPing({ state: 'loading' });
    try {
      await request('/health/', { method: 'GET', authenticated: false, timeoutMs: 8000 });
      setPing({ state: 'ok', ms: Date.now() - startedAt });
    } catch (error) {
      setPing({ state: 'error', ms: Date.now() - startedAt, code: error?.code ?? 'error' });
    }
  };

  const sendTestNotification = async () => {
    await scheduleTestNotification();
    setNotified(true);
    setTimeout(() => setNotified(false), 6000);
  };

  const last = settings.last;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Ionicons name="construct" size={20} color={colors.primaryDark} />
            <Text style={styles.title}>Panel de demostración</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar panel" hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {/* Servidor */}
            <Text style={styles.section}>Servidor</Text>
            <Text style={styles.mono} selectable>{API_BASE_URL}</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={pingServer} accessibilityRole="button">
                <Ionicons name="pulse" size={16} color="#FFFFFF" />
                <Text style={styles.btnText}>Probar conexión</Text>
              </TouchableOpacity>
              {ping ? (
                <Text
                  style={[
                    styles.pingText,
                    ping.state === 'ok' && { color: colors.success },
                    ping.state === 'error' && { color: colors.danger },
                  ]}
                >
                  {ping.state === 'loading'
                    ? 'Consultando...'
                    : ping.state === 'ok'
                      ? `Responde en ${ping.ms} ms`
                      : `Sin respuesta (${ping.code}, ${ping.ms} ms)`}
                </Text>
              ) : null}
            </View>
            <Text style={styles.hint}>
              Si el servidor está dormido (plan gratuito), la primera respuesta puede tardar cerca de un minuto.
            </Text>

            {/* Modo de IA */}
            <Text style={styles.section}>Identificación por IA</Text>
            <Segmented
              options={AI_MODES}
              value={settings.aiMode}
              onChange={(value) => updateDemoSettings({ aiMode: value })}
            />
            <Text style={styles.hint}>
              {settings.aiMode === 'auto'
                ? 'Usa Pl@ntNet; si falla, aplica el respaldo elegido abajo.'
                : settings.aiMode === 'down'
                  ? 'Simula una caída de Pl@ntNet para mostrar la resiliencia en vivo.'
                  : 'No consulta la red: resultados de ejemplo, avisados como demostración.'}
            </Text>

            <Text style={styles.section}>Si la IA falla</Text>
            <Segmented
              options={FALLBACK_MODES}
              value={settings.fallbackMode}
              onChange={(value) => updateDemoSettings({ fallbackMode: value })}
            />
            <Text style={styles.hint}>
              {settings.fallbackMode === 'quiz'
                ? 'Nivel 2: clasificación heurística por cuestionario (recomendado).'
                : 'Muestra resultados de ejemplo con el aviso "Demostración".'}
            </Text>

            {/* Circuit breaker */}
            <Text style={styles.section}>Circuit breaker</Text>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: aiStatus === 'ok' ? colors.success : colors.warning }]} />
              <Text style={styles.value}>
                {aiStatus === 'ok' ? 'Cerrado: se intenta la IA' : 'Abierto: va directo al respaldo'}
              </Text>
              {aiStatus !== 'ok' ? (
                <TouchableOpacity style={styles.btnSmall} onPress={resetCircuit}>
                  <Text style={styles.btnSmallText}>Reiniciar</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Última identificación */}
            <Text style={styles.section}>Última identificación</Text>
            {last ? (
              <Text style={styles.value}>
                Fuente: {last.fuente} · {last.tiempoMs} ms · {last.certainty}
              </Text>
            ) : (
              <Text style={styles.hint}>Aún no hay ninguna en esta sesión.</Text>
            )}

            {/* Notificación */}
            <Text style={styles.section}>Recordatorios</Text>
            <TouchableOpacity style={styles.btn} onPress={sendTestNotification} accessibilityRole="button">
              <Ionicons name="notifications" size={16} color="#FFFFFF" />
              <Text style={styles.btnText}>Notificación de prueba (5 s)</Text>
            </TouchableOpacity>
            {notified ? <Text style={styles.hint}>Programada: llegará en unos segundos.</Text> : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  mono: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  value: { flexShrink: 1, fontSize: 13, color: colors.text },
  hint: { marginTop: 6, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pingText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    minHeight: 44,
  },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  btnSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnSmallText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  segmentItemActive: { backgroundColor: colors.ink },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.text },
  segmentTextActive: { color: '#FFFFFF' },
});