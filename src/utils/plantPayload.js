/** plantPayload.js - Convierte una especie del catálogo en la planta a guardar. */

export function buildPlantPayload(
  species,
  { ubicacion, nivel_luz, frecuencia_riego_dias, photoUri }
) {
  return {
    especie_slug: species.id,
    nombre_comun: species.nombre_comun,
    nombre_cientifico: species.nombre_cientifico,
    categoria: species.categoria,
    ubicacion: ubicacion ?? (species.ubicacion_ideal === 'exterior' ? 'exterior' : 'interior'),
    nivel_luz: nivel_luz ?? species.nivel_luz_ideal,
    frecuencia_riego_dias: frecuencia_riego_dias ?? species.frecuencia_riego_dias,
    frecuencia_base_dias: species.frecuencia_riego_dias, // base de la especie (el servidor ajusta por luz)
    foto_uri: photoUri ?? null,
  };
}
