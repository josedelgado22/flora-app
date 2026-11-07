/**
 * db.web.js - Reemplazo de db.js SOLO para el navegador (Metro lo elige en web).
 *
 * expo-sqlite no es estable en web, así que aquí se emula la misma API con localStorage.
 * Sirve para probar y mostrar la UI en un computador; la app móvil usa SQLite real (db.js).
 */
import { addDays, localDayKey } from '../utils/dates';

const STORAGE_KEY = 'flora_web_db_v1';
const MAX_ATTEMPTS = 5;

let cache = null;

function load() {
  if (cache) return cache;
  let parsed = null;
  try {
    parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    parsed = null;
  }
  cache = parsed ?? { plants: [], queue: [], log: [], meta: {}, seq: { queue: 1, log: 1 } };
  return cache;
}

function save() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // almacenamiento lleno o bloqueado: se mantiene en memoria
  }
}

export async function getDb() {
  load();
  return null;
}

// ---- Catálogo ----
export async function upsertPlants(plants, { prune = false } = {}) {
  const db = load();

  for (const p of plants) {
    const index = db.plants.findIndex((row) => row.id === p.id);
    const existing = index >= 0 ? db.plants[index] : null;
    const incoming = p.ultimo_riego ?? null;

    // Conserva el riego local si es más reciente que el del servidor
    const keepLocal =
      existing?.ultimo_riego != null && (incoming == null || existing.ultimo_riego >= incoming);

    const row = {
      id: p.id,
      nombre_comun: p.nombre_comun,
      nombre_cientifico: p.nombre_cientifico ?? null,
      categoria: p.categoria ?? null,
      nivel_luz: p.nivel_luz ?? null,
      ubicacion: p.ubicacion ?? null,
      frecuencia_riego_dias: p.frecuencia_riego_dias ?? 7,
      ultimo_riego: keepLocal ? existing.ultimo_riego : incoming,
      foto_url: p.foto_url ?? null,
    };

    if (index >= 0) db.plants[index] = row;
    else db.plants.push(row);
  }

  if (prune) {
    const ids = new Set(plants.map((p) => p.id));
    db.plants = db.plants.filter((p) => p.id <= 0 || ids.has(p.id));
  }
  save();
}

export async function getPlants() {
  return [...load().plants].sort((a, b) =>
    a.nombre_comun.localeCompare(b.nombre_comun, undefined, { sensitivity: 'base' })
  );
}

// ---- Cola de sincronización ----
function pushOperation(db, tipo, payload, creadoEn) {
  db.queue.push({
    id: db.seq.queue++,
    tipo,
    payload,
    creado_en: creadoEn,
    estado: 'pendiente',
    intentos: 0,
    ultimo_error: null,
  });
}

export async function registerWatering(plantId, whenIso) {
  const db = load();
  const plant = db.plants.find((p) => p.id === plantId);
  if (plant) plant.ultimo_riego = whenIso;

  db.log.push({
    id: db.seq.log++,
    planta_id: plantId,
    regado_en: whenIso,
    dia: localDayKey(new Date(whenIso)),
  });
  pushOperation(db, 'riego', { planta_id: plantId, regado_en: whenIso }, whenIso);
  save();
}

export async function enqueueOperation(tipo, payload) {
  const db = load();
  pushOperation(db, tipo, payload, new Date().toISOString());
  save();
}

export async function getPendingOperations(limit = 50) {
  return load()
    .queue.filter((op) => op.estado === 'pendiente')
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
    .map((op) => ({ ...op }));
}

export async function countPendingOperations() {
  return load().queue.filter((op) => op.estado === 'pendiente').length;
}

export async function markOperationsSynced(ids) {
  const db = load();
  for (const op of db.queue) {
    if (ids.includes(op.id)) {
      op.estado = 'sincronizada';
      op.ultimo_error = null;
    }
  }
  save();
}

export async function markOperationFailed(id, message) {
  const db = load();
  const op = db.queue.find((row) => row.id === id);
  if (!op) return;
  op.intentos += 1;
  op.ultimo_error = message ?? 'Error desconocido';
  op.estado = op.intentos >= MAX_ATTEMPTS ? 'fallida' : 'pendiente';
  save();
}

// ---- Plantas creadas en el dispositivo ----
export async function insertLocalPlant(planta) {
  const db = load();
  const localId = -(Date.now() * 1000 + Math.floor(Math.random() * 1000));

  db.plants.push({
    id: localId,
    nombre_comun: planta.nombre_comun,
    nombre_cientifico: planta.nombre_cientifico ?? null,
    categoria: planta.categoria ?? null,
    nivel_luz: planta.nivel_luz ?? null,
    ubicacion: planta.ubicacion ?? null,
    frecuencia_riego_dias: planta.frecuencia_riego_dias ?? 7,
    ultimo_riego: null,
    foto_url: planta.foto_uri ?? null,
  });

  pushOperation(
    db,
    'planta_nueva',
    {
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
    },
    new Date().toISOString()
  );
  save();
  return localId;
}

export async function remapPlantId(localId, serverId) {
  const db = load();
  const plant = db.plants.find((p) => p.id === localId);
  if (plant) plant.id = serverId;

  for (const op of db.queue) {
    if (op.estado === 'pendiente' && op.tipo === 'riego' && op.payload?.planta_id === localId) {
      op.payload = { ...op.payload, planta_id: serverId };
    }
  }
  save();
}

// ---- Historial, rachas y metadatos ----
export async function getWateringDays(limit = 400) {
  const days = [...new Set(load().log.map((row) => row.dia))].sort().reverse();
  return days.slice(0, limit);
}

export async function getMeta(key) {
  return load().meta[key] ?? null;
}

export async function setMeta(key, value) {
  load().meta[key] = String(value);
  save();
}

export async function seedDemoStreak(days) {
  if (!days || days <= 0) return;
  if ((await getMeta('demo_streak_seeded')) === '1') return;

  const db = load();
  if (db.log.length === 0) {
    for (let i = 1; i <= days; i += 1) {
      const date = addDays(new Date(), -i);
      db.log.push({
        id: db.seq.log++,
        planta_id: null,
        regado_en: date.toISOString(),
        dia: localDayKey(date),
      });
    }
  }
  await setMeta('demo_streak_seeded', '1');
}
