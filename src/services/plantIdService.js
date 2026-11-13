/**
 * plantIdService.js - Identificación botánica por IA (HU-FLOR-009) con Fallback (SC-01).
 *
 * Contrato: POST /identificacion/  (multipart: campo "imagen", JPEG < 1 MB)
 *   resp: { resultados: [...], fuente, tiempo_ms }
 * El backend orquesta Pl@ntNet; la app nunca habla con Pl@ntNet directamente.
 *
 * Si la IA no está disponible (timeout, sin red o 5xx):
 *   - AI_DEMO_FALLBACK = false: se lanza el error y la pantalla conmuta al cuestionario.
 *   - AI_DEMO_FALLBACK = true:  resultados de DEMOSTRACIÓN con isDemo = true.
 *
 * Resultado: { candidates, source, isDemo, fuente, tiempoMs, elapsedMs }
 */
import species from '../data/species.json';
import { AI_DEMO_FALLBACK, AI_REQUEST_TIMEOUT_MS, DEMO_AI_MODE } from '../config/appConfig';
import { ApiError, isRecoverable, request } from './apiClient';
import { compressForUpload } from './imageService';
import { File } from 'expo-file-system';

const MOCK_SCORES = [93, 64, 41];
let mockCursor = 0;

// Tope absoluto: pase lo que pase, la pantalla nunca queda cargando para siempre.
// Debe ser un poco mayor que AI_REQUEST_TIMEOUT_MS.
const HARD_TIMEOUT_MS = AI_REQUEST_TIMEOUT_MS + 8000;

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

function buildMockResponse() {
  if (DEMO_AI_MODE === 'timeout') {
    throw new ApiError({ code: 'timeout', detail: 'El servicio de IA no respondió a tiempo.' });
  }
  if (DEMO_AI_MODE === 'offline') {
    throw new ApiError({ code: 'network', detail: 'No hay conexión con el servidor.' });
  }
  return buildDemoResponse();
}

export function shouldFallbackToQuiz(error) {
  return isRecoverable(error);
}

async function identifyPlantInner(photo) {
  const startedAt = Date.now();

  console.log('[plantId] comprimiendo');
  const compressed = await compressForUpload(photo);

  const form = new FormData();
  form.append('imagen', new File(compressed.uri));

  let data;
  let source;
  try {
    console.log('[plantId] enviando', compressed.bytes, 'bytes');
    ({ data, source } = await request('/identificacion/', {
      method: 'POST',
      body: form,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      mock: buildMockResponse,
    }));
    console.log('[plantId] respuesta OK');
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

  const fuente = data?.fuente ?? (source === 'mock' ? 'simulado' : 'plantnet');
  const isDemo = source === 'mock' || fuente === 'simulado';
  const elapsedMs = Date.now() - startedAt;
  const tiempoMs = data?.tiempo_ms ?? elapsedMs;

  return { candidates, source, isDemo, fuente, tiempoMs, elapsedMs };
}

/**
 * @param {{uri: string, width?: number}} photo
 */
export async function identifyPlant(photo) {
  let timer;
  const hardTimeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError({ code: 'timeout', detail: 'La identificación tardó demasiado.' })),
      HARD_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([identifyPlantInner(photo), hardTimeout]);
  } finally {
    clearTimeout(timer);
  }
}