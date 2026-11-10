// flora_app/src/components/MonthCalendarModal.js
/**
 * MonthCalendarModal - Calendario del mes con los días de riego marcados.
 * Se abre al tocar la tarjeta de racha (WeekStrip). Lee el historial de SQLite (watering_log),
 * funciona sin conexión y permite ver meses anteriores.
 *
 * Props: visible, onClose, streak ({ current, best })
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getWateringDays } from '../services/db';
import { colors } from '../theme/theme';
import { localDayKey } from '../utils/dates';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEK_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // la semana empieza en lunes
const CELL = 36;

const GREEN = colors.primary;
const BERRY = colors.accent;
const MUTED = colors.textMuted;
const LINE = colors.border;

const currentMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
};

export default function MonthCalendarModal({ visible, onClose, streak }) {
  const [days, setDays] = useState([]);
  const [cursor, setCursor] = useState(currentMonth);

  // Al abrir: vuelve al mes actual y relee el historial
  useEffect(() => {
    if (!visible) return undefined;
    setCursor(currentMonth());
    let alive = true;
    getWateringDays(400)
      .then((rows) => alive && setDays(rows))
      .catch((error) => console.warn('[MonthCalendar] no se pudo leer el historial:', error?.message));
    return () => {
      alive = false;
    };
  }, [visible]);

  const watered = useMemo(() => new Set(days), [days]);
  const todayKey = localDayKey(new Date());
  const now = currentMonth();
  const isCurrentMonth = cursor.year === now.year && cursor.month === now.month;

  const { cells, doneCount } = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate();

    const list = [];
    for (let i = 0; i < offset; i += 1) list.push(null);

    let done = 0;
    for (let d = 1; d <= total; d += 1) {
      const key = localDayKey(new Date(cursor.year, cursor.month, d));
      const isDone = watered.has(key);
      if (isDone) done += 1;
      list.push({ key, num: d, done: isDone, isToday: key === todayKey, future: key > todayKey });
    }
    return { cells: list, doneCount: done };
  }, [cursor, watered, todayKey]);

  const goPrev = () =>
    setCursor(({ year, month }) => (month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }));
  const goNext = () => {
    if (isCurrentMonth) return;
    setCursor(({ year, month }) => (month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }));
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          {/* Navegación de mes */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={goPrev} style={styles.arrow} accessibilityLabel="Mes anterior">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {MONTHS[cursor.month]} {cursor.year}
            </Text>
            <TouchableOpacity
              onPress={goNext}
              disabled={isCurrentMonth}
              style={[styles.arrow, isCurrentMonth && styles.arrowDisabled]}
              accessibilityLabel="Mes siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Letras de la semana */}
          <View style={styles.grid}>
            {WEEK_LETTERS.map((letter, i) => (
              <View key={`${letter}${i}`} style={styles.gridCell}>
                <Text style={styles.letter}>{letter}</Text>
              </View>
            ))}

            {/* Días del mes */}
            {cells.map((cell, i) => (
              <View key={cell ? cell.key : `empty-${i}`} style={styles.gridCell}>
                {cell ? (
                  <View
                    style={[
                      styles.day,
                      cell.done && styles.dayDone,
                      cell.isToday && styles.dayToday,
                    ]}
                    accessibilityLabel={`Día ${cell.num}: ${cell.done ? 'con riego' : 'sin riego'}`}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        cell.done && styles.dayTextDone,
                        cell.future && styles.dayTextFuture,
                        cell.isToday && !cell.done && styles.dayTextToday,
                      ]}
                    >
                      {cell.num}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {/* Resumen */}
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Ionicons name="water" size={18} color={GREEN} />
              <Text style={styles.summaryText}>
                {doneCount} {doneCount === 1 ? 'día' : 'días'} con riego en {MONTHS[cursor.month]}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="flame" size={18} color="#FF6F00" />
              <Text style={styles.summaryText}>
                Racha actual {streak?.current ?? 0} · mejor {Math.max(streak?.best ?? 0, streak?.current ?? 0)}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.close} accessibilityRole="button">
            <Text style={styles.closeText}>Cerrar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textTransform: 'capitalize',
  },
  arrow: { padding: 6, borderRadius: 20, backgroundColor: colors.accentTint },
  arrowDisabled: { opacity: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: `${100 / 7}%`, alignItems: 'center', marginVertical: 3 },
  letter: { fontSize: 12, fontWeight: '700', color: MUTED },
  day: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDone: { backgroundColor: GREEN },
  dayToday: { borderWidth: 3, borderColor: BERRY },
  dayText: { fontSize: 13, fontWeight: '600', color: colors.text },
  dayTextDone: { color: '#FFFFFF', fontWeight: '800' },
  dayTextFuture: { color: LINE },
  dayTextToday: { color: BERRY, fontWeight: '800' },
  summary: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  summaryText: { fontSize: 13, fontWeight: '600', color: colors.text, marginLeft: 8 },
  close: { alignSelf: 'center', marginTop: 12, padding: 8 },
  closeText: { fontSize: 13, fontWeight: '600', color: MUTED },
});