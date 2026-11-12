/**
 * historyDb.js - Historial local en SQLite (no modifica db.js ni sus migraciones).
 *
 *  - identification_history: últimas identificaciones (IA, heurística o demostración).
 *  - getWateringHistory: línea de tiempo de riegos de una planta, desde watering_log.
 */
import { getDb } from './db';

const MAX_IDENTIFICATIONS = 30;
let ready = null;

function ensureTable() {
  if (!ready) {
    ready = getDb()
      .then(async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS identification_history (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_comun      TEXT NOT NULL,
            nombre_cientifico TEXT,
            coincidencia      INTEGER,
            certeza           TEXT NOT NULL,
            foto_uri          TEXT,
            candidatos        TEXT,
            creado_en         TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_ident_hist_fecha ON identification_history (creado_en);
        `);
        return db;
      })
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

/**
 * @param {{ candidates: object[], certeza: 'ia'|'heuristica'|'demo', photoUri?: string|null }} entry
 */
export async function addIdentification({ candidates, certeza, photoUri = null }) {
  const top = candidates?.[0];
  if (!top) return;
  const db = await ensureTable();
  await db.runAsync(
    `INSERT INTO identification_history
       (nombre_comun, nombre_cientifico, coincidencia, certeza, foto_uri, candidatos, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      top.nombre_comun,
      top.nombre_cientifico ?? null,
      top.coincidencia ?? null,
      certeza,
      photoUri,
      JSON.stringify(candidates.slice(0, 3)),
      new Date().toISOString(),
    ]
  );
  await db.runAsync(
    `DELETE FROM identification_history
      WHERE id NOT IN (SELECT id FROM identification_history ORDER BY id DESC LIMIT ?)`,
    [MAX_IDENTIFICATIONS]
  );
}

export async function getRecentIdentifications(limit = 3) {
  const db = await ensureTable();
  const rows = await db.getAllAsync(
    'SELECT * FROM identification_history ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows.map((row) => {
    let candidates = [];
    try {
      candidates = JSON.parse(row.candidatos ?? '[]');
    } catch {
      candidates = [];
    }
    return { ...row, candidates };
  });
}

/** Riegos de una planta, del más reciente al más antiguo: [{ regado_en, dia }] */
export async function getWateringHistory(plantId, limit = 60) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT regado_en, dia FROM watering_log WHERE planta_id = ? ORDER BY regado_en DESC LIMIT ?',
    [plantId, limit]
  );
}