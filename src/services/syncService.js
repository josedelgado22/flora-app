/**
 * syncService.js - Envío en lote de la Sync Queue al backend (SC-02).
 *
 * Contrato: POST /sync/batch/
 *   body:  { operaciones: [{ client_id, tipo, payload, creado_en }] }
 *   resp:  { procesadas: [client_id...], rechazadas: [{ client_id, motivo }] }
 *
 * - Una sola ejecución a la vez (evita enviar duplicados).
 * - Si no hay red/timeout NO se penalizan las operaciones: quedan pendientes.
 * - fallbackToMock = false: jamás se marca como sincronizado algo que el API real no recibió.
 */
import { isRecoverable, request } from './apiClient';
import {
  getPendingOperations,
  markOperationFailed,
  markOperationsSynced,
  remapPlantId,
} from './db';

const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 10;

let inFlight = null;

/** @returns {Promise<{sent: number, offline: boolean}>} */
export function flushQueue() {
  if (!inFlight) {
    inFlight = doFlush().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doFlush() {
  let sent = 0;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
    const operations = await getPendingOperations(BATCH_SIZE);
    if (operations.length === 0) break;

    const body = {
      operaciones: operations.map((op) => ({
        client_id: op.id,
        tipo: op.tipo,
        payload: op.payload,
        creado_en: op.creado_en,
      })),
    };

    try {
      const { data } = await request('/sync/batch/', {
        method: 'POST',
        body,
        fallbackToMock: false,
        // Mock (solo modo demo): el "servidor" acepta todo el lote
        mock: () => ({ procesadas: operations.map((op) => op.id), rechazadas: [] }),
      });

      await markOperationsSynced(data?.procesadas ?? []);
      // Plantas creadas offline: el servidor devuelve su id definitivo
      for (const m of data?.mapeo_plantas ?? []) {
        await remapPlantId(m.local_id, m.server_id);
      }
      for (const rejected of data?.rechazadas ?? []) {
        await markOperationFailed(rejected.client_id, rejected.motivo);
      }
      sent += (data?.procesadas ?? []).length;

      if (operations.length < BATCH_SIZE) break;
    } catch (error) {
      if (isRecoverable(error)) {
        // Sin red, timeout o servidor caído: se reintenta en la próxima reconexión
        return { sent, offline: true };
      }
      // 4xx: el servidor rechazó el lote completo
      for (const op of operations) {
        await markOperationFailed(op.id, error.message);
      }
      break;
    }
  }

  return { sent, offline: false };
}
