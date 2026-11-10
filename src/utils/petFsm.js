/**
 * petFsm.js - Máquina de Estados Finitos de la mascota "Espina" (HU-FLOR-004).
 *
 * ESTADO DE ÁNIMO (FSM), con transiciones explícitas:
 *
 *            DUE                 OVERDUE
 *   feliz ─────────► hambrienta ─────────► critica
 *     ▲  ◄───────────    │  ◄─────────────     │
 *     │      CLEAR       │         DUE/CLEAR   │
 *     └──────────────────┴─────────────────────┘
 *   (cualquiera) ──WATERED──► celebrando ──CELEBRATION_END──► feliz
 *
 * Eventos derivados del estado de riego de las plantas:
 *   CLEAR   = nada pendiente | DUE = hay riegos hoy | OVERDUE = hay plantas atrasadas
 *
 * ETAPA EVOLUTIVA: permanente, según la MEJOR racha lograda (la mascota no retrocede
 * al perder una racha; la presión viene del ánimo). Para que dependa de la racha
 * actual, pasar streak.current a getStage.
 *
 * SC-06: sin GIFs. Cada estado se representa con imágenes estáticas del cactus;
 * el movimiento lo aporta la API Animated de React Native (ver DynamicPlantMascot).
 */
export const MOODS = {
  FELIZ: 'feliz',
  HAMBRIENTA: 'hambrienta',
  CRITICA: 'critica',
  CELEBRANDO: 'celebrando',
};
export const EVENTS = {
  DUE: 'DUE',
  OVERDUE: 'OVERDUE',
  CLEAR: 'CLEAR',
  WATERED: 'WATERED',
  CELEBRATION_END: 'CELEBRATION_END',
};
const TRANSITIONS = {
  feliz: { DUE: 'hambrienta', OVERDUE: 'critica', WATERED: 'celebrando' },
  hambrienta: { CLEAR: 'feliz', OVERDUE: 'critica', WATERED: 'celebrando' },
  critica: { CLEAR: 'feliz', DUE: 'hambrienta', WATERED: 'celebrando' },
  // Mientras celebra ignora el resto de eventos; al terminar vuelve a 'feliz'
  celebrando: { CELEBRATION_END: 'feliz' },
};
/** Siguiente ánimo. Un evento sin transición definida mantiene el estado. */
export function transition(mood, event) {
  return TRANSITIONS[mood]?.[event] ?? mood;
}
/** Evento que describe el estado actual de las plantas. */
export function snapshotEvent({ due, overdue }) {
  if (overdue > 0) return EVENTS.OVERDUE;
  if (due > 0) return EVENTS.DUE;
  return EVENTS.CLEAR;
}
export const MOOD_META = {
  feliz: { emoji: '😊' },
  hambrienta: { emoji: '🥺' },
  critica: { emoji: '😰' },
  celebrando: { emoji: '🎉' },
};
export const STAGES = [
  { level: 1, min: 0, name: 'Brote Semilla', icon: '🌱', color: '#8BC34A' },
  { level: 2, min: 5, name: 'Cactus Bebé', icon: '🌵', color: '#2E7D32' },
  { level: 3, min: 14, name: 'Cactus Florecido', icon: '🌸', color: '#E91E63' },
  { level: 4, min: 30, name: 'Guardiana Leyenda', icon: '👑', color: '#FFD700' },
];
export const RENAME_UNLOCK_DAYS = 5;
export function getStage(streakDays) {
  return [...STAGES].reverse().find((stage) => streakDays >= stage.min) ?? STAGES[0];
}

// ---------------------------------------------------------------------------
// Expresión (imagen) que muestra DynamicPlantMascot
// ---------------------------------------------------------------------------
// Son las 7 imágenes del cactus. Se eligen con las mismas señales que alimentan
// la FSM (plantas por regar / atrasadas, racha, celebración) más la hora del día.
export const EXPRESSIONS = {
  NEUTRAL: 'neutral',
  EXCITED: 'excited',
  HAPPY: 'happy',
  BLOOMING: 'blooming',
  ANGRY: 'angry',
  SAD: 'sad',
  SLEEPING: 'sleeping',
};

const NIGHT_START = 22; // 22:00
const NIGHT_END = 6; // 06:00
const isNight = (hour) => hour >= NIGHT_START || hour < NIGHT_END;

/**
 * Prioridad (la primera que se cumple gana):
 *   celebrando -> EXCITED | 3+ atrasadas -> ANGRY | 1+ atrasada -> SAD | riego hoy -> NEUTRAL
 *   noche -> SLEEPING | racha >= 7 -> BLOOMING | racha >= 1 -> HAPPY | resto -> NEUTRAL
 * Los umbrales son una propuesta: ajústalos a tu especificación.
 */
export function getEffectiveMood({
  due = 0,
  overdue = 0,
  streakDays = 0,
  isCelebrating = false,
  currentHour = new Date().getHours(),
} = {}) {
  if (isCelebrating) return EXPRESSIONS.EXCITED;
  if (overdue >= 3) return EXPRESSIONS.ANGRY;
  if (overdue >= 1) return EXPRESSIONS.SAD;
  if (due >= 1) return EXPRESSIONS.NEUTRAL;
  if (isNight(currentHour)) return EXPRESSIONS.SLEEPING;
  if (streakDays >= 7) return EXPRESSIONS.BLOOMING;
  if (streakDays >= 1) return EXPRESSIONS.HAPPY;
  return EXPRESSIONS.NEUTRAL;
}