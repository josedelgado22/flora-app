/**
 * data/quiz.js - Motor de Clasificación Botánica Asistida (Smart Fallback Offline, SC-01 / HU-FLOR-011).
 * 100% local: opera sin red a 0 ms de latencia sobre el catálogo species.json.
 * Cumple WCAG 2.1 Nivel AA mediante metadatos vectoriales para @expo/vector-icons.
 */

export const QUIZ_QUESTIONS = [
  {
    id: 'categoria',
    title: '¿Cómo son sus hojas?',
    subtitle: 'Observa la textura, grosor y forma del follaje principal.',
    options: [
      {
        value: 'Suculenta',
        label: 'Gruesas y carnosas',
        hint: 'Almacenan agua en hojas o tallos (ej. cactus, aloe)',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'cactus',
        iconColor: '#2E7D32',
        accessibilityLabel: 'Hojas gruesas y carnosas, categoría suculenta',
      },
      {
        value: 'Tropical',
        label: 'Grandes y brillantes',
        hint: 'Follaje ancho, vistoso y de verde intenso',
        iconFamily: 'Ionicons',
        iconName: 'leaf',
        iconColor: '#388E3C',
        accessibilityLabel: 'Hojas grandes y brillantes, categoría tropical',
      },
      {
        value: 'Aromática',
        label: 'Pequeñas, con aroma o flores',
        hint: 'Desprenden fragancia al frotarlas o producen floración',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'flower-tulip',
        iconColor: '#6A1B9A',
        accessibilityLabel: 'Hojas pequeñas con aroma o flores, categoría aromática',
      },
      {
        value: 'Helecho',
        label: 'Finas y plumosas (frondas)',
        hint: 'Hojas muy divididas con aspecto de pluma sin flores',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'grass',
        iconColor: '#43A047',
        accessibilityLabel: 'Hojas finas y plumosas, categoría helecho',
      },
    ],
  },
  {
    id: 'habito',
    title: '¿Cómo crece la planta?',
    subtitle: 'Identifica la estructura general de sus tallos y ramificación.',
    options: [
      {
        value: 'roseta',
        label: 'En roseta, con hojas desde el centro',
        hint: 'Crecimiento circular pegado a la base del sustrato',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'flower',
        iconColor: '#2E7D32',
        accessibilityLabel: 'Crecimiento en roseta desde el centro',
      },
      {
        value: 'erguida',
        label: 'Hojas o tallo erguidos hacia arriba',
        hint: 'Porte vertical recto o columnar',
        iconFamily: 'Ionicons',
        iconName: 'arrow-up-circle-outline',
        iconColor: '#2E7D32',
        accessibilityLabel: 'Tallo o hojas erguidas hacia arriba',
      },
      {
        value: 'trepadora',
        label: 'Tallos que trepan o cuelgan',
        hint: 'Requiere tutor o cae por los bordes de la maceta',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'sprout',
        iconColor: '#2E7D32',
        accessibilityLabel: 'Tallos trepadores o colgantes',
      },
      {
        value: 'arbustiva',
        label: 'En mata, con muchas ramas o frondas',
        hint: 'Estructura ramificada densa desde la base',
        iconFamily: 'MaterialCommunityIcons',
        iconName: 'tree',
        iconColor: '#2E7D32',
        accessibilityLabel: 'Crecimiento arbustivo en mata ramificada',
      },
    ],
  },
  {
    id: 'ubicacion',
    title: '¿Dónde la viste o la tienes?',
    subtitle: 'Permite ajustar el requerimiento lumínico y térmico.',
    options: [
      {
        value: 'interior',
        label: 'Dentro de casa o invernadero sombreado',
        hint: 'Luz filtrada y protección contra heladas',
        iconFamily: 'Ionicons',
        iconName: 'home-outline',
        iconColor: '#1565C0',
        accessibilityLabel: 'Ubicación en interior o bajo techo',
      },
      {
        value: 'exterior',
        label: 'Al aire libre',
        hint: 'Exposición directa al sol o semisombra exterior',
        iconFamily: 'Ionicons',
        iconName: 'sunny-outline',
        iconColor: '#EF6C00',
        accessibilityLabel: 'Ubicación al aire libre en exterior',
      },
    ],
  },
];

// Ponderación taxonómica: la morfología foliar tiene mayor peso discriminante
const WEIGHTS = { categoria: 3, habito: 2, ubicacion: 1 };
const MAX_SCORE = WEIGHTS.categoria + WEIGHTS.habito + WEIGHTS.ubicacion;

// Techo de certidumbre: diferencia honestamente la heurística local frente a Pl@ntNet API
export const MAX_ESTIMATED_PERCENT = 85;

/**
 * Clasifica y ordena el catálogo botánico local según las respuestas del operador.
 * @param {object} answers - Respuestas seleccionadas { categoria, habito, ubicacion }
 * @param {object[]} catalog - Arreglo de especies desde species.json
 * @param {number} limit - Cantidad máxima de candidatos a retornar
 * @returns {object[]} Top N especies con `coincidencia` estimada y bandera `estimada: true`
 */
export function rankSpeciesByAnswers(answers = {}, catalog = [], limit = 3) {
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return [];
  }

  const ranked = catalog
    .map((species) => {
      let score = 0;

      if (answers.categoria && species.categoria === answers.categoria) {
        score += WEIGHTS.categoria;
      }
      if (answers.habito && species.habito === answers.habito) {
        score += WEIGHTS.habito;
      }
      if (
        answers.ubicacion &&
        (species.ubicacion_ideal === 'ambas' || species.ubicacion_ideal === answers.ubicacion)
      ) {
        score += WEIGHTS.ubicacion;
      }

      const coincidencia = Math.round((score / MAX_SCORE) * MAX_ESTIMATED_PERCENT);

      return {
        ...species,
        coincidencia,
        estimada: true,
        origenDiagnostico: 'HEURISTICA_LOCAL',
      };
    })
    .sort((a, b) => b.coincidencia - a.coincidencia);

  // Priorizar especies con al menos una coincidencia morfológica real
  const validMatches = ranked.filter((item) => item.coincidencia > 0);
  const finalPool = validMatches.length > 0 ? validMatches : ranked;

  return finalPool.slice(0, limit);
}