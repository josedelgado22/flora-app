/**
 * plantIdService.js - Identificación botánica (HU-FLOR-009), Smart Fallback de dos niveles.
 *   Nivel 1: Pl@ntNet vía backend (POST /identificacion/, multipart "imagen")
 *   Nivel 2: cuestionario heurístico (lo abre ScanScreen ante errores recuperables)
 * Resultado: { candidates, source, isDemo, fuente, tiempoMs, elapsedMs }
 */
import species from '../data/species.json';
import { AI_DEMO_FALLBACK, AI_REQUEST_TIMEOUT_MS, DEMO_AI_MODE } from '../config/appConfig';
import { ApiError, isRecoverable, request } from './apiClient';
import { isCircuitOpen, recordAiFailure, recordAiSuccess } from './aiCircuit';
import { setLastIdentification } from './demoSettings';
import { compressForUpload } from './imageService';
import { File } from 'expo-file-system';
import { getCertainty } from '../utils/certainty';

const MOCK_SCORES = [93, 64, 41];
let mockCursor = 0;

// Tope absoluto: la pantalla nunca queda cargando para siempre.
const HARD_TIMEOUT_MS = AI_REQUEST_TIMEOUT_MS + 10000;

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

  // Circuito abierto: no se espera a la red
  if (isCircuitOpen()) {
    throw new ApiError({
      status: 503,
      code: 'unavailable',
      detail: 'El servicio de identificación está temporalmente degradado.',
    });
  }

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
    recordAiSuccess();
  } catch (error) {
    if (!shouldFallbackToQuiz(error)) throw error; // 400/413/no_match: no es una caída
    recordAiFailure();

    if (AI_DEMO_FALLBACK) {
      console.warn('[plantId] IA no disponible, resultados de demostración:', error?.code);
      data = buildDemoResponse();
      source = 'mock';
    } else {
      throw error; // ScanScreen abre el cuestionario
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

  setLastIdentification({ fuente, tiempoMs, certainty: getCertainty({ isDemo }), at: Date.now() });

  return { candidates, source, isDemo, fuente, tiempoMs, elapsedMs };
}

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