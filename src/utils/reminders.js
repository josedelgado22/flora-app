/**
 * reminders.js - Plan de recordatorios locales de riego (HU-FLOR-015 / HU-FLOR-008).
 * Agrupa por día para no saturar: UNA notificación diaria con las plantas que tocan.
 * Cubre TODOS los riegos de la agenda dentro del horizonte (14 días por defecto):
 * el próximo riego real de cada planta y los siguientes, asumiendo que se riega a tiempo
 * (misma regla que buildSchedule en schedule.js).
 * Función pura: se prueba sin dispositivo.
 */
import { startOfDay } from './dates';
import { getDueInfo } from './watering';

function joinNames(names) {
  if (names.length === 1) return names[0];
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`;
}

/**
 * @param {object[]} plants
 * @param {Date} now
 * @param {{hour?: number, horizonDays?: number}} options
 * @returns {{date: Date, title: string, body: string, plantIds: number[]}[]}
 */
export function buildReminderPlan(plants, now = new Date(), { hour = 9, horizonDays = 14 } = {}) {
  const today = startOfDay(now);
  const todayAtHour = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0, 0);
  const todayPassed = todayAtHour <= now;

  const groups = new Map(); // offset de día -> [{ plant, overdue }]

  const add = (offset, plant, overdue) => {
    if (offset >= horizonDays) return;
    if (!groups.has(offset)) groups.set(offset, []);
    const items = groups.get(offset);
    if (items.some((item) => item.plant.id === plant.id)) return; // una planta, un aviso por día
    items.push({ plant, overdue });
  };

  for (const plant of plants) {
    const frequency = Math.max(1, plant.frecuencia_riego_dias || 7);
    const { daysUntil } = getDueInfo(plant, now);

    // Próximo riego real (si ya venció, se recuerda hoy; si la hora de hoy pasó, mañana)
    let offset = Math.max(daysUntil, 0);
    if (offset === 0 && todayPassed) offset = 1;
    add(offset, plant, daysUntil < offset);

    // Riegos siguientes, asumiendo que se riega a tiempo
    for (let k = 1; ; k += 1) {
      const next = Math.max(daysUntil, 0) + k * frequency;
      if (next >= horizonDays) break;
      add(next, plant, false);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offset, items]) => {
      const names = items.map((item) => item.plant.nombre_comun);
      const anyOverdue = items.some((item) => item.overdue);

      return {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, hour, 0, 0),
        title: anyOverdue ? 'Riegos pendientes' : 'Hoy toca regar',
        body: `${joinNames(names)} ${names.length === 1 ? 'necesita' : 'necesitan'} agua.`,
        plantIds: items.map((item) => item.plant.id),
      };
    });
}