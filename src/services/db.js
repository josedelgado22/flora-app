/**
 * db.js - Persistencia local Offline-First con expo-sqlite (HU-FLOR-013, SC-02).
 *
 * Tablas:
 *  - plants:         espejo local del catálogo (lectura sin conexión).
 *  - sync_queue:     operaciones pendientes de enviar al backend en lote.
 *  - pending_photos: fotos pendientes de subir a /plantas/<id>/fotos/ (HU-FLOR-014).
 *
 * Migraciones con PRAGMA user_version. Requiere expo-sqlite (API async, SDK 51+).
 */
import * as SQLite from 'expo-sqlite';
import { addDays, localDayKey } from '../utils/dates';

const DB_NAME = 'flora.db';
const MAX_ATTEMPTS = 5; // tras 5 rechazos del servidor, la operación se marca 'fallida'
const MAX_PHOTO_ATTEMPTS = 5; // tras 5 intentos fallidos, la foto deja de reintentarse

let dbPromise = null;

/** Abre la base una sola vez (singleton) y aplica migraciones. */
export function getDb() {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((error) => {
      dbPromise = null; // permite reintentar si falló la apertura
      throw error;
    });
  }
  return dbPromise;
}

async function openAndMigrate() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS plants (
          id                    INTEGER PRIMARY KEY,
          nombre_comun          TEXT NOT NULL,
          nombre_cientifico     TEXT,
          categoria             TEXT,
          nivel_luz             TEXT,
          ubicacion             TEXT,
          frecuencia_riego_dias INTEGER NOT NULL DEFAULT 7,
          ultimo_riego          TEXT,
          foto_url              TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          tipo          TEXT NOT NULL,
          payload       TEXT NOT NULL,
          creado_en     TEXT NOT NULL,
          estado        TEXT NOT NULL DEFAULT 'pendiente',
          intentos      INTEGER NOT NULL DEFAULT 0,
          ultimo_error  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_estado ON sync_queue (estado, id);
      `);
      await db.execAsync('PRAGMA user_version = 1');
    });
  }

  if (version < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS watering_log (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          planta_id  INTEGER,
          regado_en  TEXT NOT NULL,
          dia        TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_watering_log_dia ON watering_log (dia);

        CREATE TABLE IF NOT EXISTS app_meta (
          key    TEXT PRIMARY KEY,
          value  TEXT
        );
      `);
      await db.execAsync('PRAGMA user_version = 2');
    });
  }

  if (version < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_photos (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          planta_id     INTEGER NOT NULL,
          uri           TEXT NOT NULL,
          tipo          TEXT NOT NULL DEFAULT 'planta',
          intentos      INTEGER NOT NULL DEFAULT 0,
          ultimo_error  TEXT,
          creado_en     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pending_photos_planta ON pending_photos (planta_id);
      `);
      await db.execAsync('PRAGMA user_version = 3');
    });
  }

  return db;
}

// ----------------------------------------------------------------------------
// Catálogo de plantas
// ----------------------------------------------------------------------------

/**
 * Inserta/actualiza plantas. Conserva el 'ultimo_riego' local si es más reciente
 * que el del servidor (riego hecho offline que aún no sincroniza). Conserva también
 * la foto local mientras el servidor aún no tenga una (foto pendiente de subir).
 * @param {{prune?: boolean}} options prune=true elimina las que ya no existen en el servidor.
 */
export async function upsertPlants(plants, { prune = false } = {}) {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    for (const p of plants) {
      await db.runAsync(
        `INSERT INTO plants
           (id, nombre_comun, nombre_cientifico, categoria, nivel_luz, ubicacion,
            frecuencia_riego_dias, ultimo_riego, foto_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nombre_comun          = excluded.nombre_comun,
           nombre_cientifico     = excluded.nombre_cientifico,
           categoria             = excluded.categoria,
           nivel_luz             = excluded.nivel_luz,
           ubicacion             = excluded.ubicacion,
           frecuencia_riego_dias = excluded.frecuencia_riego_dias,
           foto_url = CASE
             WHEN excluded.foto_url IS NULL AND plants.foto_url IS NOT NULL
              AND plants.foto_url NOT LIKE 'http%'
             THEN plants.foto_url
             ELSE excluded.foto_url
           END,
           ultimo_riego = CASE
             WHEN plants.ultimo_riego IS NOT NULL
              AND (excluded.ultimo_riego IS NULL OR plants.ultimo_riego >= excluded.ultimo_riego)
             THEN plants.ultimo_riego
             ELSE excluded.ultimo_riego
           END`,
        [
          p.id,
          p.nombre_comun,
          p.nombre_cientifico ?? null,
          p.categoria ?? null,
          p.nivel_luz ?? null,
          p.ubicacion ?? null,
          p.frecuencia_riego_dias ?? 7,
          p.ultimo_riego ?? null,
          p.foto_url ?? null,
        ]
      );
    }

    if (prune) {
      const ids = plants.map((p) => p.id);
      if (ids.length > 0) {
        await db.runAsync(
          `DELETE FROM plants WHERE id > 0 AND id NOT IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      } else {
        await db.runAsync('DELETE FROM plants WHERE id > 0');
      }
    }
  });
}

export async function getPlants() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM plants ORDER BY nombre_comun COLLATE NOCASE');
}

// ----------------------------------------------------------------------------
// Cola de sincronización (SC-02)
// ----------------------------------------------------------------------------

/**
 * Registra un riego de forma ATÓMICA: actualiza la planta y encola la operación
 * en la misma transacción (nunca queda una sin la otra).
 */
export async function registerWatering(plantId, whenIso) {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plants SET ultimo_riego = ? WHERE id = ?', [whenIso, plantId]);
    // Historial por día local: base de las rachas (Bloque D)
    await db.runAsync(
      'INSERT INTO watering_log (planta_id, regado_en, dia) VALUES (?, ?, ?)',
      [plantId, whenIso, localDayKey(new Date(whenIso))]
    );
    await db.runAsync(
      'INSERT INTO sync_queue (tipo, payload, creado_en) VALUES (?, ?, ?)',
      ['riego', JSON.stringify({ planta_id: plantId, regado_en: whenIso }), whenIso]
    );
  });
}

/** Encola una operación genérica (fotos, plantas nuevas, etc. en bloques futuros). */
export async function enqueueOperation(tipo, payload) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO sync_queue (tipo, payload, creado_en) VALUES (?, ?, ?)',
    [tipo, JSON.stringify(payload), now]
  );
}

/** Operaciones pendientes en orden de creación (FIFO). */
export async function getPendingOperations(limit = 50) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT * FROM sync_queue WHERE estado = 'pendiente' ORDER BY id LIMIT ?",
    [limit]
  );

  return rows.map((row) => {
    let payload = null;
    try {
      payload = JSON.parse(row.payload);
    } catch {
      payload = null;
    }
    return { ...row, payload };
  });
}

export async function countPendingOperations() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT COUNT(*) AS total FROM sync_queue WHERE estado = 'pendiente'"
  );
  return row?.total ?? 0;
}

export async function markOperationsSynced(ids) {
  if (!ids.length) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue SET estado = 'sincronizada', ultimo_error = NULL
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

/** Rechazo del servidor: suma un intento y, al llegar al máximo, descarta de la cola activa. */
export async function markOperationFailed(id, message) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue
        SET intentos = intentos + 1,
            ultimo_error = ?,
            estado = CASE WHEN intentos + 1 >= ? THEN 'fallida' ELSE 'pendiente' END
      WHERE id = ?`,
    [message ?? 'Error desconocido', MAX_ATTEMPTS, id]
  );
}

// ----------------------------------------------------------------------------
// Plantas creadas en el dispositivo (Bloque C)
// ----------------------------------------------------------------------------

/**
 * Inserta una planta nueva y encola 'planta_nueva' en UNA transacción (SC-02).
 * El id local es NEGATIVO hasta que el servidor asigne el definitivo
 * (así nunca choca con ids reales y el prune de upsertPlants no la borra).
 * @returns {Promise<number>} id local
 */
export async function insertLocalPlant(planta) {
  const db = await getDb();
  const localId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO plants
         (id, nombre_comun, nombre_cientifico, categoria, nivel_luz, ubicacion,
          frecuencia_riego_dias, ultimo_riego, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        localId,
        planta.nombre_comun,
        planta.nombre_cientifico ?? null,
        planta.categoria ?? null,
        planta.nivel_luz ?? null,
        planta.ubicacion ?? null,
        planta.frecuencia_riego_dias ?? 7,
        planta.foto_uri ?? null,
      ]
    );
    await db.runAsync(
      'INSERT INTO sync_queue (tipo, payload, creado_en) VALUES (?, ?, ?)',
      [
        'planta_nueva',
        JSON.stringify({
          local_id: localId,
          especie_slug: planta.especie_slug ?? null,
          nombre_comun: planta.nombre_comun,
          nombre_cientifico: planta.nombre_cientifico ?? null,
          categoria: planta.categoria ?? null,
          nivel_luz: planta.nivel_luz ?? null,
          ubicacion: planta.ubicacion ?? null,
          frecuencia_riego_dias: planta.frecuencia_riego_dias ?? 7,
          frecuencia_base_dias: planta.frecuencia_base_dias ?? null,
          foto_local_uri: planta.foto_uri ?? null,
        }),
        now,
      ]
    );
  });

  return localId;
}

/** Reemplaza el id local por el definitivo del servidor (también en riegos y fotos pendientes). */
export async function remapPlantId(localId, serverId) {
  const db = await getDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plants SET id = ? WHERE id = ?', [serverId, localId]);
    await db.runAsync('UPDATE pending_photos SET planta_id = ? WHERE planta_id = ?', [
      serverId,
      localId,
    ]);

    const rows = await db.getAllAsync(
      "SELECT id, payload FROM sync_queue WHERE estado = 'pendiente' AND tipo = 'riego'"
    );
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload);
        if (payload.planta_id === localId) {
          payload.planta_id = serverId;
          await db.runAsync('UPDATE sync_queue SET payload = ? WHERE id = ?', [
            JSON.stringify(payload),
            row.id,
          ]);
        }
      } catch {
        // payload corrupto: se ignora, el servidor lo rechazará y quedará registrado
      }
    }
  });
}

// ----------------------------------------------------------------------------
// Historial de riegos, rachas y metadatos (Bloque D)
// ----------------------------------------------------------------------------

/** Días (YYYY-MM-DD, hora local) con al menos un riego, del más reciente al más antiguo. */
export async function getWateringDays(limit = 400) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT DISTINCT dia FROM watering_log ORDER BY dia DESC LIMIT ?',
    [limit]
  );
  return rows.map((row) => row.dia);
}

export async function getMeta(key) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

/**
 * Siembra `days` días de riegos previos (hasta ayer) SOLO una vez y SOLO si no hay
 * historial real. Son datos de demostración: no pasan por la sync_queue.
 */
export async function seedDemoStreak(days) {
  if (!days || days <= 0) return;
  if ((await getMeta('demo_streak_seeded')) === '1') return;

  const db = await getDb();
  const existing = await db.getFirstAsync('SELECT COUNT(*) AS total FROM watering_log');

  if ((existing?.total ?? 0) === 0) {
    await db.withTransactionAsync(async () => {
      for (let i = 1; i <= days; i += 1) {
        const date = addDays(new Date(), -i);
        await db.runAsync(
          'INSERT INTO watering_log (planta_id, regado_en, dia) VALUES (NULL, ?, ?)',
          [date.toISOString(), localDayKey(date)]
        );
      }
    });
  }
  await setMeta('demo_streak_seeded', '1');
}

// ----------------------------------------------------------------------------
// Fotos pendientes de subir (HU-FLOR-014)
// ----------------------------------------------------------------------------

/** Encola una foto para subirla cuando la planta ya exista en el servidor. */
export async function enqueuePhoto(plantId, uri, tipo = 'planta') {
  if (!uri) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO pending_photos (planta_id, uri, tipo, creado_en) VALUES (?, ?, ?, ?)',
    [plantId, uri, tipo, new Date().toISOString()]
  );
}

/** Solo fotos de plantas que ya existen en el servidor (id positivo). */
export async function getPendingPhotos(limit = 20) {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT * FROM pending_photos WHERE planta_id > 0 AND intentos < ? ORDER BY id LIMIT ?',
    [MAX_PHOTO_ATTEMPTS, limit]
  );
}

export async function countPendingPhotos() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS total FROM pending_photos WHERE intentos < ?',
    [MAX_PHOTO_ATTEMPTS]
  );
  return row?.total ?? 0;
}

/** Subida exitosa: quita la foto de la cola y deja la URL del servidor como foto de la planta. */
export async function markPhotoUploaded(photo, serverUrl) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pending_photos WHERE id = ?', [photo.id]);
    if (photo.tipo === 'planta') {
      await db.runAsync('UPDATE plants SET foto_url = ? WHERE id = ?', [serverUrl, photo.planta_id]);
    }
  });
}

export async function markPhotoFailed(photoId, message) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE pending_photos SET intentos = intentos + 1, ultimo_error = ? WHERE id = ?',
    [message ?? 'Error desconocido', photoId]
  );
}