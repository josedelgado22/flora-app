/** dates.js - Fechas en calendario LOCAL (días completos, sin sorpresas de zona horaria/DST). */

const DAY_MS = 24 * 60 * 60 * 1000;

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Suma días calendario conservando la hora local. */
export const addDays = (date, days) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora local. */
export const localDayKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function dayKeyToDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Días calendario entre dos fechas (to - from). */
export const diffInDays = (from, to) =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      DAY_MS
  );

/** 'jue 24 oct' */
export const formatDayLabel = (date) =>
  `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
