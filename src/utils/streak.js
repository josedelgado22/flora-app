/**
 * streak.js - Rachas de cuidado a partir del historial de riegos.
 *
 * Regla: un día "cuenta" si se registró al menos un riego. La racha es la cantidad de
 * días consecutivos que termina HOY (si ya regaste) o AYER (si hoy aún puedes hacerlo).
 * Si pasa un día completo sin riego, la racha vuelve a 0.
 */
import { addDays, dayKeyToDate, diffInDays, localDayKey, startOfDay } from './dates';

export const EMPTY_STREAK = { current: 0, best: 0, doneToday: false, atRisk: false, week: [] };

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * @param {string[]} dayKeys Días con riego ('YYYY-MM-DD', hora local)
 * @param {Date} now
 */
export function computeStreak(dayKeys, now = new Date()) {
  const days = new Set(dayKeys);
  const today = startOfDay(now);
  const doneToday = days.has(localDayKey(today));

  // Racha actual: hacia atrás desde hoy (si ya regó) o desde ayer
  let cursor = doneToday ? today : addDays(today, -1);
  let current = 0;
  while (days.has(localDayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Mejor racha histórica
  let best = 0;
  let run = 0;
  let previous = null;
  for (const key of [...days].sort()) {
    const date = dayKeyToDate(key);
    run = previous && diffInDays(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  // Semana lunes-domingo
  const todayIndex = (today.getDay() + 6) % 7;
  const monday = addDays(today, -todayIndex);
  const week = WEEK_LABELS.map((label, index) => {
    const key = localDayKey(addDays(monday, index));
    return { label, key, done: days.has(key), isToday: index === todayIndex, isFuture: index > todayIndex };
  });

  return {
    current,
    best: Math.max(best, current),
    doneToday,
    atRisk: current > 0 && !doneToday, // la racha vive, pero hoy falta regar
    week,
  };
}
