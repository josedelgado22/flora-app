/**
 * certainty.js - Certidumbre botánica: de dónde sale un resultado (transparencia algorítmica).
 *
 *   ia          Pl@ntNet identificó la foto.
 *   heuristica  Clasificación local por cuestionario (reglas ponderadas sobre el catálogo).
 *   demo        Resultados de ejemplo: NO son una identificación real.
 */
export const CERTAINTY = { IA: 'ia', HEURISTICA: 'heuristica', DEMO: 'demo' };

export function getCertainty({ isDemo = false, estimada = false } = {}) {
  if (isDemo) return CERTAINTY.DEMO;
  if (estimada) return CERTAINTY.HEURISTICA;
  return CERTAINTY.IA;
}

// icon: nombre de Ionicons
export const CERTAINTY_META = {
  ia: {
    label: 'Verificada por IA',
    icon: 'shield-checkmark',
    color: '#2E7D32',
    bg: '#E8F5E9',
    hint: 'Identificada por Pl@ntNet a partir de tu foto.',
  },
  heuristica: {
    label: 'Clasificación heurística',
    icon: 'bulb',
    color: '#EF6C00',
    bg: '#FFF3E0',
    hint: 'Estimada con tus respuestas del cuestionario, sin análisis de imagen.',
  },
  demo: {
    label: 'Demostración',
    icon: 'flask',
    color: '#6A1B9A',
    bg: '#F3E5F5',
    hint: 'Resultado de ejemplo: no corresponde a una identificación real.',
  },
};

/** Texto de la fuente para la pantalla de compatibilidad. */
export function sourceLabel(fuente) {
  if (fuente === 'plantnet') return 'Pl@ntNet v2 SaaS';
  if (fuente === 'heuristica') return 'Clasificación heurística local (cuestionario)';
  return 'Modo demostración (catálogo botánico local)';
}