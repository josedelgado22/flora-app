/**
 * PlantHistoryScreen.js - Detalle e historial de una planta del Jardín (ruta "PlantHistory").
 * Recibe { plantId }. Todo sale del dispositivo (SQLite): datos de la planta, próximo riego,
 * estadísticas y la línea de tiempo de riegos (watering_log). Funciona sin conexión.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import PlantThumb from '../components/PlantThumb';
import PrimaryButton from '../components/PrimaryButton';
import { usePlants } from '../context/PlantsContext';
import { getWateringHistory } from '../services/historyDb';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { addDays, localDayKey } from '../utils/dates';
import { getWateringStatus } from '../utils/watering';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const BAR_DAYS = 14;

const pad = (n) => String(n).padStart(2, '0');

function formatDate(iso) {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function relativeDays(iso, now = new Date()) {
  const diff = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / 86400000);
  if (diff <= 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return `Hace ${diff} días`;
}

/** Promedio de días entre riegos distintos (si hay al menos dos). */
function averageInterval(history) {
  const days = [...new Set(history.map((row) => row.dia))].sort();
  if (days.length < 2) return null;
  const first = new Date(`${days[0]}T00:00:00`);
  const last = new Date(`${days[days.length - 1]}T00:00:00`);
  return Math.round((last - first) / 86400000 / (days.length - 1));
}

function TimelineItem({ row, index, isLast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const delay = Math.min(index, 8) * 70;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 280, delay, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, shift]);

  return (
    <Animated.View style={[styles.tlRow, { opacity, transform: [{ translateY: shift }] }]}>
      <View style={styles.tlRail}>
        <View style={styles.tlDot}>
          <Ionicons name="water" size={11} color="#FFFFFF" />
        </View>
        {!isLast ? <View style={styles.tlLine} /> : null}
      </View>
      <View style={styles.tlBody}>
        <Text style={styles.tlDate}>{formatDate(row.regado_en)}</Text>
        <Text style={styles.tlRel}>{relativeDays(row.regado_en)}</Text>
      </View>
    </Animated.View>
  );
}

export default function PlantHistoryScreen({ route, navigation }) {
  const { plantId } = route.params ?? {};
  const { plants, markWatered, lastWatering } = usePlants();
  const plant = plants.find((item) => item.id === plantId);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watering, setWatering] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getWateringHistory(plantId)
      .then((rows) => alive && setHistory(rows))
      .catch((error) => console.warn('[PlantHistory] historial:', error?.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [plantId, lastWatering?.at]);

  const bars = useMemo(() => {
    const done = new Set(history.map((row) => row.dia));
    const today = new Date();
    return Array.from({ length: BAR_DAYS }, (_, i) => {
      const date = addDays(today, i - (BAR_DAYS - 1));
      return { key: localDayKey(date), done: done.has(localDayKey(date)), isToday: i === BAR_DAYS - 1 };
    });
  }, [history]);

  if (!plant) {
    return (
      <View style={[baseStyles.screen, baseStyles.centered, styles.emptyWrap]}>
        <Ionicons name="leaf-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyText}>No encontramos esta planta en tu jardín.</Text>
        <PrimaryButton title="Volver" onPress={() => navigation.goBack()} style={styles.emptyBtn} />
      </View>
    );
  }

  const status = getWateringStatus(plant);
  const isDue = status.state !== 'ok';
  const lastIso = history[0]?.regado_en ?? plant.ultimo_riego ?? null;
  const interval = averageInterval(history);

  const handleWater = async () => {
    if (watering) return;
    setWatering(true);
    try {
      await markWatered(plant.id);
    } finally {
      setWatering(false);
    }
  };

  const subtitle = [
    plant.ubicacion ? (plant.ubicacion === 'exterior' ? 'Exterior' : 'Interior') : null,
    plant.nivel_luz ? `Luz ${plant.nivel_luz}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      {/* Cabecera */}
      <View style={styles.headerCard}>
        <PlantThumb uri={plant.foto_url} size={76} radius={22} iconSize={32} />
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={2}>{plant.nombre_comun}</Text>
          {plant.nombre_cientifico ? <Text style={styles.latin}>{plant.nombre_cientifico}</Text> : null}
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* Próximo riego */}
      <View style={[styles.statusBox, isDue && styles.statusBoxDue]}>
        <Ionicons
          name={isDue ? 'alert-circle' : 'water-outline'}
          size={22}
          color={isDue ? colors.accent : colors.primaryDark}
        />
        <View style={styles.flex}>
          <Text style={styles.statusLabel}>Próximo riego</Text>
          <Text style={[styles.statusValue, isDue && { color: colors.accent }]}>{status.label}</Text>
        </View>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{history.length}</Text>
          <Text style={styles.statLabel}>riegos registrados</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{plant.frecuencia_riego_dias ?? '-'} d</Text>
          <Text style={styles.statLabel}>frecuencia</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{interval ? `${interval} d` : '-'}</Text>
          <Text style={styles.statLabel}>promedio real</Text>
        </View>
      </View>

      {/* Últimos 14 días */}
      <Text style={styles.sectionTitle}>Últimos {BAR_DAYS} días</Text>
      <View style={styles.bars}>
        {bars.map((bar) => (
          <View
            key={bar.key}
            style={[
              styles.bar,
              bar.done ? styles.barDone : styles.barEmpty,
              bar.isToday && styles.barToday,
            ]}
            accessibilityLabel={`${bar.key}: ${bar.done ? 'con riego' : 'sin riego'}`}
          />
        ))}
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        {isDue ? (
          <PrimaryButton
            title={watering ? 'Registrando...' : 'Regar ahora'}
            icon="water"
            onPress={handleWater}
            loading={watering}
          />
        ) : null}
        <PrimaryButton
          title="Reportar síntoma"
          variant="outline"
          onPress={() => navigation.navigate('Diagnostico', { plant })}
          style={isDue ? styles.second : undefined}
        />
      </View>

      {/* Línea de tiempo */}
      <Text style={styles.sectionTitle}>Historial de riegos</Text>
      {loading ? (
        <Text style={styles.hint}>Cargando historial...</Text>
      ) : history.length === 0 ? (
        <View style={styles.emptyHistory}>
          <MaterialCommunityIcons name="calendar-blank-outline" size={30} color={colors.textMuted} />
          <Text style={styles.hint}>
            Aún no hay riegos registrados desde este dispositivo.
            {lastIso ? `\nÚltimo riego conocido: ${formatDate(lastIso)}.` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {history.slice(0, 20).map((row, index, list) => (
            <TimelineItem
              key={`${row.regado_en}-${index}`}
              row={row}
              index={index}
              isLast={index === list.length - 1}
            />
          ))}
          {history.length > 20 ? (
            <Text style={styles.hint}>Mostrando los 20 riegos más recientes de {history.length}.</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  flex: { flex: 1 },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentTint,
  },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  latin: { fontSize: 12, fontStyle: 'italic', color: colors.accent, marginTop: 2 },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.tint,
  },
  statusBoxDue: { backgroundColor: colors.accentTint },
  statusLabel: { fontSize: 11, color: colors.textMuted },
  statusValue: { fontSize: 16, fontWeight: '700', color: colors.primaryDark, marginTop: 1 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  stat: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E4A2A3',
    backgroundColor: '#FFFFFF',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 14, fontWeight: '700', color: colors.text },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 34 },
  bar: { flex: 1, borderRadius: 4 },
  barDone: { height: 32, backgroundColor: colors.primary },
  barEmpty: { height: 8, backgroundColor: '#EBD3D9' },
  barToday: { borderWidth: 2, borderColor: colors.accent },
  actions: { marginTop: spacing.lg },
  second: { marginTop: spacing.sm },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 6 },
  emptyHistory: { alignItems: 'center', gap: 8, paddingVertical: spacing.lg },
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: 'row', minHeight: 52 },
  tlRail: { width: 28, alignItems: 'center' },
  tlDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlLine: { flex: 1, width: 2, backgroundColor: '#D9E8C8', marginVertical: 2 },
  tlBody: { flex: 1, paddingLeft: 10, paddingBottom: 14 },
  tlDate: { fontSize: 13, fontWeight: '600', color: colors.text },
  tlRel: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  emptyWrap: { padding: spacing.xl, gap: 10 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  emptyBtn: { marginTop: spacing.md, alignSelf: 'stretch' },
});