/**
 * quiz.js - Cuestionario botánico asistido (Fallback Manual, SC-01 / HU-FLOR-011).
 * 100% local: funciona sin red usando el catálogo species.json.
 */

export const QUIZ_QUESTIONS = [
  {
    id: 'categoria',
    title: '¿Cómo son sus hojas?',
    options: [
      { value: 'Suculenta', emoji: '🌵', label: 'Gruesas y carnosas' },
      { value: 'Tropical', emoji: '🌿', label: 'Grandes y brillantes' },
      { value: 'Aromática', emoji: '💜', label: 'Pequeñas, con aroma o flores' },
      { value: 'Helecho', emoji: '🍃', label: 'Finas y plumosas (frondas)' },
    ],
  },
  {
    id: 'habito',
    title: '¿Cómo crece?',
    options: [
      { value: 'roseta', emoji: '🌸', label: 'En roseta, con hojas desde el centro' },
      { value: 'erguida', emoji: '📏', label: 'Hojas o tallo erguidos hacia arriba' },
      { value: 'trepadora', emoji: '🪴', label: 'Tallos que trepan o cuelgan' },
      { value: 'arbustiva', emoji: '🌳', label: 'En mata, con muchas ramas o frondas' },
    ],
  },
  {
    id: 'ubicacion',
    title: '¿Dónde la viste o la tienes?',
    options: [
      { value: 'interior', emoji: '🏠', label: 'Dentro de casa' },
      { value: 'exterior', emoji: '☀️', label: 'Al aire libre' },
    ],
  },
];

const WEIGHTS = { categoria: 3, habito: 2, ubicacion: 1 };
const MAX_SCORE = WEIGHTS.categoria + WEIGHTS.habito + WEIGHTS.ubicacion;
const MAX_ESTIMATED_PERCENT = 85; // una respuesta manual nunca debe parecer 100% segura

/**
 * Ordena el catálogo según las respuestas.
 * @returns {object[]} top N especies con `coincidencia` estimada y `estimada: true`
 */
export function rankSpeciesByAnswers(answers, catalog, limit = 3) {
  return catalog
    .map((species) => {
      let score = 0;
      if (species.categoria === answers.categoria) score += WEIGHTS.categoria;
      if (species.habito === answers.habito) score += WEIGHTS.habito;
      if (
        answers.ubicacion &&
        (species.ubicacion_ideal === 'ambas' || species.ubicacion_ideal === answers.ubicacion)
      ) {
        score += WEIGHTS.ubicacion;
      }
      return {
        ...species,
        coincidencia: Math.round((score / MAX_SCORE) * MAX_ESTIMATED_PERCENT),
        estimada: true,
      };
    })
    .sort((a, b) => b.coincidencia - a.coincidencia)
    .slice(0, limit);
}
