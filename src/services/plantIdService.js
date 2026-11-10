/**
 * plantIdService.js - Identificación botánica por IA (HU-FLOR-009) con Fallback (SC-01).
 *
 * Contrato: POST /identificacion/  (multipart: campo "imagen", JPEG < 1 MB)
 *   resp: { resultados: [{ id, nombre_comun, nombre_cientifico, categoria, habito,
 *                          nivel_luz_ideal, ubicacion_ideal, frecuencia_riego_dias,
 *                          temperatura, consejos[], coincidencia (0-100) }], fuente, tiempo_ms }
 * El backend orquesta Pl@ntNet; la app nunca habla con Pl@ntNet directamente.
 *
 * Timeout: AI_REQUEST_TIMEOUT_MS. Debe ser MAYOR que el del servidor
 * (conexión + PLANTNET_TIMEOUT_SECONDS), o la app cortaría antes de recibir su respuesta.
 *
 * Si la IA no está disponible (timeout, sin red o 5xx) hay dos comportamientos,
 * según AI_DEMO_FALLBACK (appConfig):
 *   - false: se lanza el error y la pantalla conmuta al cuestionario manual (SC-01).
 *   - true:  se devuelven resultados de DEMOSTRACIÓN del catálogo local, marcados con
 *            isDemo = true. La pantalla DEBE indicarlo al usuario: no son una identificación real.
 * SC-05: la foto se comprime a JPEG < 1 MB antes de subirla.
 */
import species from '../data/species.json';
import { AI_DEMO_FALLBACK, AI_REQUEST_TIMEOUT_MS, DEMO_AI_MODE } from '../config/appConfig';
import { ApiError, isRecoverable, request } from './apiClient';
import { compressForUpload } from './imageService';
import { File } from 'expo-file-system';

const MOCK_SCORES = [93, 64, 41];
let mockCursor = 0; // rota las especies para que cada escaneo demo muestre algo distinto

/** Resultados de demostración del catálogo local (mismo formato que responde el servidor). */
function buildDemoResponse() {
  const start = mockCursor % species.length;
  mockCursor += 1;

  return {
    resultados: MOCK_SCORES.map((coincidencia, i) => ({
      ...species[(start + i) % species.length],
      coincidencia,
    })),
    fuente: 'simulado',
  };
}

/** Mock del modo demo global (FORCE_MOCKS): puede simular fallos con DEMO_AI_MODE. */
function buildMockResponse() {
  if (DEMO_AI_MODE === 'timeout') {
    throw new ApiError({ code: 'timeout', detail: 'El servicio de IA no respondió a tiempo.' });
  }
  if (DEMO_AI_MODE === 'offline') {
    throw new ApiError({ code: 'network', detail: 'No hay conexión con el servidor.' });
  }
  return buildDemoResponse();
}

/** ¿Debe la app conmutar al cuestionario manual ante este error? (timeout, sin red o 5xx) */
export function shouldFallbackToQuiz(error) {
  return isRecoverable(error);
}

/**
 * @param {{uri: string, width?: number}} photo
 * @returns {Promise<{candidates: object[], source: string, isDemo: boolean, elapsedMs: number}>}
 */
export async function identifyPlant(photo) {
  const startedAt = Date.now();

  const compressed = await compressForUpload(photo);

  // File (Blob) de expo-file-system: el fetch de Expo no acepta el objeto { uri, name, type }
  const form = new FormData();
  form.append('imagen', new File(compressed.uri));

  let data;
  let source;
  try {
    ({ data, source } = await request('/identificacion/', {
      method: 'POST',
      body: form,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      mock: buildMockResponse, // solo se usa en modo demo (FORCE_MOCKS)
    }));
  } catch (error) {
    if (AI_DEMO_FALLBACK && shouldFallbackToQuiz(error)) {
      console.warn('[plantId] IA no disponible, resultados de demostración:', error?.code);
      data = buildDemoResponse();
      source = 'mock';
    } else {
      throw error; // la pantalla conmuta al cuestionario manual
    }
  }

  const candidates = [...(data?.resultados ?? [])].sort((a, b) => b.coincidencia - a.coincidencia);
  if (candidates.length === 0) {
    throw new ApiError({ code: 'no_match', detail: 'No pudimos reconocer la planta en la foto.' });
  }

  // Demostración = datos del catálogo local o modo simulado del servidor (no es Pl@ntNet)
  const isDemo = source === 'mock' || data?.fuente === 'simulado';

  return { candidates, source, isDemo, elapsedMs: Date.now() - startedAt };
}