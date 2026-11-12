/**
 * watering.js - Estado de riego por plantas, en días calendario.
 */
import { addDays, diffInDays, startOfDay } from './dates';

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

/**
 * Cuántos días faltan para regar (negativo = atrasada). Sin riegos registrados = hoy.
 * @returns {{daysUntil: number, dueDate: Date}}
 */
export function getDueInfo(plant, now = new Date()) {
  const frequency = Math.max(1, plant.frecuencia_riego_dias || 7);

  if (!plant.ultimo_riego) return { daysUntil: 0, dueDate: startOfDay(now) };

  const dueDate = addDays(startOfDay(new Date(plant.ultimo_riego)), frequency);
  return { daysUntil: diffInDays(now, dueDate), dueDate };
}

/** @returns {{state: 'overdue'|'today'|'ok', daysUntil: number, label: string}} */
export function getWateringStatus(plant, now = new Date()) {
  if (!plant.ultimo_riego) {
    return { state: 'today', daysUntil: 0, label: 'Sin riegos registrados' };
  }

  const { daysUntil } = getDueInfo(plant, now);

  if (daysUntil < 0) {
    const late = Math.abs(daysUntil);
    return { state: 'overdue', daysUntil, label: `Atrasada ${late} ${plural(late, 'día', 'días')}` };
  }
  if (daysUntil === 0) return { state: 'today', daysUntil, label: 'Toca regar hoy' };
  if (daysUntil === 1) return { state: 'ok', daysUntil, label: 'Regar mañana' };
  return { state: 'ok', daysUntil, label: `Regar en ${daysUntil} días` };
}
