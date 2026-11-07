/**
 * schedule.js - Agenda de riego (HU-FLOR-008).
 * La frecuencia por planta ya viene ajustada a la luz del lugar (compatibility.js /
 * backend). Aquí solo se proyectan las fechas, así la agenda funciona offline.
 */
import { addDays, formatDayLabel, startOfDay } from './dates';
import { getDueInfo } from './watering';

/**
 * @returns {{key: string, title: string, offset: number,
 *            data: {key: string, plant: object, offset: number, projected: boolean}[]}[]}
 *  - projected=false: el próximo riego real de la planta (accionable si offset <= 0)
 *  - projected=true : riegos siguientes asumiendo que se riega a tiempo (informativo)
 */
export function buildSchedule(plants, now = new Date(), horizonDays = 14) {
  const today = startOfDay(now);
  const items = [];

  for (const plant of plants) {
    const { daysUntil } = getDueInfo(plant, now);
    const frequency = Math.max(1, plant.frecuencia_riego_dias || 7);

    if (daysUntil < horizonDays) {
      items.push({ key: `${plant.id}-0`, plant, offset: daysUntil, projected: false });
    }

    for (let k = 1; ; k += 1) {
      const offset = Math.max(daysUntil, 0) + k * frequency;
      if (offset >= horizonDays) break;
      items.push({ key: `${plant.id}-${k}`, plant, offset, projected: true });
    }
  }

  const groups = new Map();
  for (const item of items) {
    const groupOffset = item.offset < 0 ? -1 : item.offset; // todas las atrasadas juntas
    if (!groups.has(groupOffset)) groups.set(groupOffset, []);
    groups.get(groupOffset).push(item);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offset, data]) => ({
      key: `d${offset}`,
      offset,
      title:
        offset === -1
          ? 'Atrasadas'
          : offset === 0
          ? 'Hoy'
          : offset === 1
          ? 'Mañana'
          : formatDayLabel(addDays(today, offset)),
      data: data.sort((a, b) => a.plant.nombre_comun.localeCompare(b.plant.nombre_comun)),
    }));
}
