/** light.js - Niveles de luz y textos compartidos (SC-03). */

export const LIGHT_LEVELS = [
  { value: 'baja', label: 'Luz baja', hint: 'Rincón sombreado, lejos de ventanas' },
  { value: 'media', label: 'Luz media', hint: 'Luz indirecta brillante' },
  { value: 'alta', label: 'Luz alta', hint: 'Sol directo o muy luminoso' },
];

export const lightLabel = (value) =>
  LIGHT_LEVELS.find((l) => l.value === value)?.label ?? 'Sin dato';
