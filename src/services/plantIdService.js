/**
 * plantIdService.js - Identificación botánica por IA (HU-FLOR-009) con Fallback (SC-01).
 *
 * Contrato: POST /identificacion/  (multipart: campo "imagen", JPEG < 1 MB)
 *   resp: { resultados: [{ id, nombre_comun, nombre_cientifico, categoria, habito,
 *                          nivel_luz_ideal, ubicacion_ideal, frecuencia_riego_dias,
 *                          temperatura, consejos[], coincidencia (0-100) }] }
 * El backend orquesta Pl@ntNet; la app nunca habla con Pl@ntNet directamente.
 *
 * SC-01: timeout de 3 s (apiClient). fallbackToMock = false a propósito: si la IA no
 * responde NO se inventa un resultado; la pantalla conmuta al cuestionario manual.
 * SC-05: la foto se comprime a JPEG < 1 MB antes de subirla.
 */
import species from '../data/species.json';
import { DEMO_AI_MODE } from '../config/appConfig';
import { ApiError, isRecoverable, request } from './apiClient';
import { compressForUpload } from './imageService';

const MOCK_SCORES = [93, 64, 41];
let mockCursor = 0; // rota las especies para que cada escaneo demo muestre algo distinto

function buildMockResponse() {
  if (DEMO_AI_MODE === 'timeout') {
    throw new ApiError({ code: 'timeout', detail: 'El servicio de IA no respondió en 3 s.' });
  }
  if (DEMO_AI_MODE === 'offline') {
    throw new ApiError({ code: 'network', detail: 'No hay conexión con el servidor.' });
  }

  const start = mockCursor % species.length;
  mockCursor += 1;

  return {
    resultados: MOCK_SCORES.map((coincidencia, i) => ({
      ...species[(start + i) % species.length],
      coincidencia,
    })),
  };
}

/** ¿Debe la app conmutar al cuestionario manual ante este error? (SC-01) */
export function shouldFallbackToQuiz(error) {
  return isRecoverable(error);
}

/**
 * @param {{uri: string, width?: number}} photo
 * @returns {Promise<{candidates: object[], source: string, elapsedMs: number}>}
 */
export async function identifyPlant(photo) {
  const startedAt = Date.now();

  const compressed = await compressForUpload(photo);

  const form = new FormData();
  form.append('imagen', { uri: compressed.uri, name: 'planta.jpg', type: 'image/jpeg' });

  const { data, source } = await request('/identificacion/', {
    method: 'POST',
    body: form,
    fallbackToMock: false,
    mock: buildMockResponse,
  });

  const candidates = [...(data?.resultados ?? [])].sort((a, b) => b.coincidencia - a.coincidencia);
  if (candidates.length === 0) {
    throw new ApiError({ code: 'no_match', detail: 'No pudimos reconocer la planta en la foto.' });
  }

  return { candidates, source, elapsedMs: Date.now() - startedAt };
}
