/**
 * diagnosisService.js - Diagnóstico de salud vegetal (HU-FLOR-012).
 *
 * Primero consulta POST /diagnostico/ (reglas del servidor, ajustadas a la planta). Si no hay
 * red, el servidor falla o la planta aún no está sincronizada, usa las reglas locales de
 * CATALOGO_SINTOMAS: el diagnóstico siempre funciona (Offline-First).
 */
import { CATALOGO_SINTOMAS } from '../components/SymptomDiagnosisModal';
import { request } from './apiClient';

// /diagnostico/ son reglas del servidor (no IA): responde rápido. Si tarda, es mejor caer
// pronto a las reglas locales que hacer esperar al usuario (por eso NO usa AI_REQUEST_TIMEOUT_MS).
const DIAGNOSIS_TIMEOUT_MS = 5000;

/** Diagnóstico con las reglas locales (mismo formato que responde el servidor). */
export function localDiagnosis(sintomaId) {
  const sintoma = CATALOGO_SINTOMAS.find((item) => item.id === sintomaId);
  if (!sintoma) throw new Error(`Síntoma desconocido: ${sintomaId}`);

  return {
    sintoma_id: sintoma.id,
    titulo: sintoma.titulo,
    causa: sintoma.causa,
    solucion: sintoma.solucion,
    tipo: sintoma.tipo,
    recomendaciones_adicionales: [],
  };
}

/**
 * @param {string} sintomaId 's1' | 's2' | 's3' | 's4'
 * @param {object|null} plant planta (con id); solo las ya sincronizadas (id > 0) existen en el servidor
 * @returns {Promise<object & {source: 'servidor'|'local'}>}
 */
export async function diagnose(sintomaId, plant = null) {
  const body = { sintoma_id: sintomaId };
  if (plant && plant.id > 0) body.planta_id = plant.id;

  try {
    const { data, source } = await request('/diagnostico/', {
      method: 'POST',
      body,
      timeoutMs: DIAGNOSIS_TIMEOUT_MS,
      mock: () => localDiagnosis(sintomaId),
    });
    return { ...data, source: source === 'api' ? 'servidor' : 'local' };
  } catch (error) {
    // Cualquier fallo (sin red, timeout, 401, 404...): el usuario igual recibe el diagnóstico local
    console.warn('[Diagnóstico] usando reglas locales:', error?.code ?? error?.message);
    return { ...localDiagnosis(sintomaId), source: 'local' };
  }
}