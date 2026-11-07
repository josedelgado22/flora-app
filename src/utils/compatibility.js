/**
 * compatibility.js - Veredicto de compatibilidad planta + lugar (diferenciador del pitch).
 *
 * Cruza lo que la especie necesita (luz ideal, interior/exterior) con lo que el lugar ofrece
 * (luz medida por fotometría, ubicación elegida) y ajusta la frecuencia de riego según el
 * factor de evaporación asociado a la luz (HU-FLOR-008/010).
 */

const LIGHT_INDEX = { baja: 0, media: 1, alta: 2 };

// Más luz = más evaporación = riego más frecuente (menos días entre riegos)
const EVAPORATION_FACTOR = { baja: 1.3, media: 1, alta: 0.8 };

const LIGHT_WEIGHT = 0.7;
const LOCATION_WEIGHT = 0.3;

/**
 * @param {{species: object, light: 'baja'|'media'|'alta', ubicacion: 'interior'|'exterior'}} input
 * @returns {{score: number, verdict: 'ideal'|'aceptable'|'no_recomendado', lightDiff: number,
 *            frecuenciaAjustadaDias: number, recomendaciones: string[]}}
 */
export function evaluateCompatibility({ species, light, ubicacion }) {
  // > 0: el lugar tiene MÁS luz de la ideal | < 0: tiene MENOS
  const lightDiff = LIGHT_INDEX[light] - LIGHT_INDEX[species.nivel_luz_ideal];
  const lightScore = lightDiff === 0 ? 100 : Math.abs(lightDiff) === 1 ? 55 : 10;

  const locationOk =
    species.ubicacion_ideal === 'ambas' || species.ubicacion_ideal === ubicacion;
  const locationScore = locationOk ? 100 : 30;

  const score = Math.round(lightScore * LIGHT_WEIGHT + locationScore * LOCATION_WEIGHT);
  const verdict = score >= 80 ? 'ideal' : score >= 50 ? 'aceptable' : 'no_recomendado';

  const baseDays = species.frecuencia_riego_dias;
  const frecuenciaAjustadaDias = Math.max(1, Math.round(baseDays * EVAPORATION_FACTOR[light]));

  const recomendaciones = [];

  if (lightDiff > 0) {
    recomendaciones.push(
      'El lugar recibe más luz de la que necesita. Aléjala de la ventana o filtra la luz con una cortina translúcida.'
    );
  } else if (lightDiff < 0) {
    recomendaciones.push(
      'El lugar es más oscuro de lo ideal. Acércala a una ventana luminosa o usa una luz de cultivo.'
    );
  }

  if (!locationOk) {
    recomendaciones.push(
      species.ubicacion_ideal === 'exterior'
        ? 'Esta especie prospera mejor al aire libre. Si la dejas adentro, elige el rincón más luminoso.'
        : 'Esta especie prefiere el interior. Protégela del sol fuerte, el viento y las heladas.'
    );
  }

  if (frecuenciaAjustadaDias !== baseDays) {
    recomendaciones.push(
      `Con la luz de este lugar, riega cada ${frecuenciaAjustadaDias} días (la frecuencia base es cada ${baseDays}).`
    );
  }

  recomendaciones.push(...(species.consejos ?? []));

  return { score, verdict, lightDiff, frecuenciaAjustadaDias, recomendaciones };
}
