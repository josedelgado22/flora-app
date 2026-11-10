// flora_app/src/components/WeekStrip.js
/**
 * WeekStrip - Racha de riego de los últimos 7 días (termina en hoy).
 *
 * Qué muestra:
 *   - Encabezado con la llama, los días de racha actual y la mejor racha.
 *   - Barra de progreso hacia la siguiente etapa de Espina (Cactus Bebé, Florecido, Leyenda).
 *   - 7 círculos: gota blanca si se regó ese día, gota con pulso si hoy falta regar,
 *     punto gris si se perdió el día. Debajo de cada círculo va el número del día.
 *   - Las barras verdes unen los días consecutivos con riego.
 *
 * Animaciones (driver nativo, sin GIFs - SC-06): entrada en cascada, barras que se encienden
 * y pulso en el círculo de hoy mientras falta regar. La barra de progreso usa el driver JS.
 *
 * Uso:
 *   <WeekStrip streak={streak} refreshKey={`${streak.current}:${lastWatering?.at ?? 0}`} />
 *
 * Props:
 *   streak      { current, best } de usePet()
 *   days        (opcional) días 'YYYY-MM-DD' con riego; si no se pasa, se leen de SQLite
 *   refreshKey  cambia cuando hay que releer el historial
 *   style       estilo extra del contenedor
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { getWateringDays } from '../services/db';
import { colors } from '../theme/theme';
import { addDays, localDayKey } from '../utils/dates';
import { STAGES } from '../utils/petFsm';
import MonthCalendarModal from './MonthCalendarModal';

const LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // índice = Date.getDay()
const DAYS_SHOWN = 7;
const CIRCLE = 40;
const FIRE = '#FF6F00';

const GREEN = colors.primary;
const BERRY = colors.accent;
const CARD = colors.accentTint;
const MUTED = colors.textMuted;
const LINE = colors.border;

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

const linkStyle = (value) => ({
  opacity: value,
  transform: [{ scaleY: value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
});

export default function WeekStrip({ streak, days: daysProp, refreshKey = 0, style }) {
  const [fetched, setFetched] = useState([]);
  const [monthOpen, setMonthOpen] = useState(false);
  const current = streak?.current ?? 0;
  const best = Math.max(streak?.best ?? 0, current);

  useEffect(() => {
    if (daysProp) return undefined;
    let alive = true;
    getWateringDays(60)
      .then((rows) => alive && setFetched(rows))
      .catch((error) => console.warn('[WeekStrip] no se pudo leer el historial:', error?.message));
    return () => {
      alive = false;
    };
  }, [daysProp, refreshKey]);

  const watered = useMemo(() => new Set(daysProp ?? fetched), [daysProp, fetched]);
  const todayKey = localDayKey(new Date());

  const cells = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const date = addDays(today, i - (DAYS_SHOWN - 1));
      const key = localDayKey(date);
      return {
        key,
        letter: LETTERS[date.getDay()],
        num: date.getDate(),
        isToday: i === DAYS_SHOWN - 1,
        done: watered.has(key),
      };
    });
    // todayKey: recalcula al cambiar de día
  }, [watered, todayKey]);

  const doneCount = cells.filter((c) => c.done).length;
  const todayPending = !cells[DAYS_SHOWN - 1].done;
  const signature = cells.map((c) => (c.done ? '1' : '0')).join('');

  // Progreso hacia la siguiente etapa de la mascota
  const next = STAGES.find((stage) => stage.min > current);
  const previous = [...STAGES].reverse().find((stage) => stage.min <= current) ?? STAGES[0];
  const progress = next ? (current - previous.min) / (next.min - previous.min) : 1;
  const remaining = next ? next.min - current : 0;

  const pops = useRef(Array.from({ length: DAYS_SHOWN }, () => new Animated.Value(0.6))).current;
  const links = useRef(Array.from({ length: DAYS_SHOWN - 1 }, () => new Animated.Value(0))).current;
  const halo = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  // Entrada: círculos en cascada y luego las barras de la racha
  useEffect(() => {
    pops.forEach((v) => v.setValue(0.6));
    links.forEach((v) => v.setValue(0));

    const entrance = Animated.parallel([
      Animated.stagger(
        70,
        pops.map((v) =>
          Animated.spring(v, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true })
        )
      ),
      Animated.sequence([
        Animated.delay(350),
        Animated.stagger(
          90,
          links.map((v) => Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }))
        ),
      ]),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [signature, pops, links]);

  // Barra de progreso: crece hasta su valor
  useEffect(() => {
    Animated.timing(bar, {
      toValue: progress,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, bar]);

  // Pulso del círculo de hoy mientras falta regar
  useEffect(() => {
    if (!todayPending) {
      halo.setValue(0);
      return undefined;
    }
    const pulse = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    pulse.start();
    return () => pulse.stop();
  }, [todayPending, halo]);

  const haloStyle = {
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  };
  const barWidth = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={() => setMonthOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Ver el calendario del mes"
    >
      {/* Encabezado: racha actual y mejor racha */}
      <View style={styles.header}>
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={22} color={current > 0 ? FIRE : LINE} />
          <Text style={styles.streakNumber}>{current}</Text>
          <Text style={styles.streakLabel}>{plural(current, 'día de racha', 'días de racha')}</Text>
        </View>
        <Text style={styles.best}>Mejor: {best}</Text>
      </View>

      {/* Progreso hacia la siguiente etapa */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: barWidth }]} />
      </View>
      <Text style={styles.progressText}>
        {next
          ? `Faltan ${remaining} ${plural(remaining, 'día', 'días')} para ${next.icon} ${next.name}`
          : `${previous.icon} ${previous.name}: ¡nivel máximo!`}
      </Text>

      {/* Últimos 7 días */}
      <View style={styles.row}>
        {cells.map((cell, i) => {
          const linkLeft = cell.done && cells[i - 1]?.done;
          const linkRight = cell.done && cells[i + 1]?.done;
          const pendingToday = cell.isToday && !cell.done;

          return (
            <View
              key={cell.key}
              style={styles.cell}
              accessibilityLabel={`Día ${cell.num}: ${cell.done ? 'con riego' : 'sin riego'}${cell.isToday ? ', hoy' : ''}`}
            >
              <Text style={[styles.letter, cell.isToday && styles.letterToday]}>{cell.letter}</Text>

              <View style={styles.circleWrap}>
                <View style={styles.baseLine} />
                {linkLeft ? (
                  <Animated.View style={[styles.link, styles.linkLeft, linkStyle(links[i - 1])]} />
                ) : null}
                {linkRight ? (
                  <Animated.View style={[styles.link, styles.linkRight, linkStyle(links[i])]} />
                ) : null}

                {pendingToday ? (
                  <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
                ) : null}

                <Animated.View
                  style={[
                    styles.circle,
                    cell.done ? styles.circleDone : styles.circleEmpty,
                    cell.isToday && styles.circleToday,
                    { transform: [{ scale: pops[i] }] },
                  ]}
                >
                  {cell.done ? (
                    <Ionicons name="water" size={20} color="#FFFFFF" />
                  ) : pendingToday ? (
                    <Ionicons name="water-outline" size={20} color={BERRY} />
                  ) : (
                    <View style={styles.missDot} />
                  )}
                </Animated.View>
              </View>

              <Text style={[styles.num, cell.isToday && styles.numToday]}>{cell.num}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>
        {doneCount} de {DAYS_SHOWN} días con riego esta semana · Toca para ver el mes
      </Text>

      <MonthCalendarModal visible={monthOpen} onClose={() => setMonthOpen(false)} streak={streak} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakNumber: { fontSize: 24, fontWeight: '800', color: colors.text, marginLeft: 4 },
  streakLabel: { fontSize: 13, fontWeight: '600', color: MUTED, marginLeft: 6, marginTop: 4 },
  best: { fontSize: 12, fontWeight: '700', color: BERRY },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: GREEN },
  progressText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    marginTop: 6,
    marginHorizontal: 6,
  },
  row: { flexDirection: 'row', marginTop: 16 },
  cell: { flex: 1, alignItems: 'center' },
  letter: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 6 },
  letterToday: { color: BERRY, fontWeight: '800' },
  circleWrap: {
    width: '100%',
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CIRCLE / 2 - 1,
    height: 2,
    backgroundColor: LINE,
    opacity: 0.5,
  },
  link: {
    position: 'absolute',
    top: CIRCLE / 2 - 3,
    height: 6,
    backgroundColor: GREEN,
  },
  linkLeft: { left: 0, right: '50%' },
  linkRight: { left: '50%', right: 0 },
  halo: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: BERRY,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: GREEN, borderWidth: 2, borderColor: GREEN },
  circleEmpty: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: LINE },
  circleToday: { borderColor: BERRY, borderWidth: 3 },
  missDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: LINE },
  num: { fontSize: 11, fontWeight: '600', color: MUTED, marginTop: 6 },
  numToday: { color: BERRY, fontWeight: '800' },
  footer: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
    marginTop: 12,
  },
});