/**
 * plantService.js - Catálogo de plantas (HU-FLOR-014).
 * Contrato: GET /plantas/ -> lista (o { results: [...] } si el backend pagina).
 */
import plantsMock from '../mocks/plants.json';
import { REAL_DATA } from '../config/appConfig';
import { request } from './apiClient';
import { enqueuePhoto, insertLocalPlant } from './db';
import { persistPhoto } from './photoStorage';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Convierte el mock al formato del contrato (fechas ISO relativas a hoy). */
function buildMockPlants() {
  const now = Date.now();
  return plantsMock.results.map(({ ultimo_riego_hace_dias, ...plant }) => ({
    ...plant,
    ultimo_riego:
      ultimo_riego_hace_dias == null
        ? null
        : new Date(now - ultimo_riego_hace_dias * DAY_MS).toISOString(),
  }));
}

/**
 * @param {{allowMock?: boolean}} options
 *   allowMock=false evita reemplazar datos reales con mocks si el API cae
 *   (el contexto lo usa cuando ya existe caché local).
 * @returns {Promise<{plants: object[], source: 'api'|'mock'}>}
 */
export async function fetchPlants({ allowMock = true } = {}) {
  const { data, source } = await request('/plantas/', {
    mock: buildMockPlants,
    fallbackToMock: allowMock && !REAL_DATA, // con datos reales NUNCA se cae a plantas de demostración
  });

  const plants = Array.isArray(data) ? data : data?.results ?? [];
  return { plants, source };
}

/**
 * Guarda una planta nueva (offline-first, SC-02): SQLite + cola 'planta_nueva'.
 * La foto se copia primero al almacenamiento permanente de la app.
 * @returns {Promise<number>} id local (negativo hasta sincronizar)
 */
export async function guardarPlantaEnJardin(planta) {
  const foto_uri = persistPhoto(planta.foto_uri);
  const localId = await insertLocalPlant({ ...planta, foto_uri });
  await enqueuePhoto(localId, foto_uri); // se sube cuando la planta ya exista en el servidor
  return localId;
}