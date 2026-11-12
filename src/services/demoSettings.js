/**
 * demoSettings.js - Ajustes del Panel Oculto de Demostración.
 *
 *   aiMode        'auto'  -> usa Pl@ntNet y, si falla, el respaldo configurado
 *                 'down'  -> simula una caída de Pl@ntNet (muestra la resiliencia en vivo)
 *                 'demo'  -> no consulta la red: resultados de demostración (marcados como tales)
 *   fallbackMode  'quiz'  -> si la IA falla, cuestionario manual (clasificación heurística)
 *                 'demo'  -> si la IA falla, resultados de demostración
 *
 * aiMode NO se guarda: cada vez que se abre la app vuelve a 'auto'. fallbackMode sí se guarda.
 */
import { useEffect, useState } from 'react';
import { AI_DEMO_FALLBACK } from '../config/appConfig';
import { getMeta, setMeta } from './db';

const META_KEY = 'demo_settings';

let state = {
  aiMode: 'auto',
  fallbackMode: AI_DEMO_FALLBACK ? 'demo' : 'quiz',
  last: null, // { fuente, tiempoMs, certainty, at } de la última identificación
};
let loadPromise = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getDemoSettings() {
  return state;
}

/** Carga (una sola vez) lo guardado en SQLite. Seguro de llamar muchas veces. */
export function loadDemoSettings() {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await getMeta(META_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.fallbackMode === 'quiz' || saved.fallbackMode === 'demo') {
            state = { ...state, fallbackMode: saved.fallbackMode };
            notify();
          }
        }
      } catch (error) {
        console.warn('[demoSettings] no se pudo leer lo guardado:', error?.message);
      }
      return state;
    })();
  }
  return loadPromise;
}

export function updateDemoSettings(patch) {
  state = { ...state, ...patch };
  notify();
  if (patch.fallbackMode) {
    setMeta(META_KEY, JSON.stringify({ fallbackMode: state.fallbackMode })).catch(() => {});
  }
}

export function setLastIdentification(info) {
  state = { ...state, last: info };
  notify();
}

export function subscribeDemoSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDemoSettings() {
  const [value, setValue] = useState(state);
  useEffect(() => {
    loadDemoSettings();
    setValue(state);
    return subscribeDemoSettings(setValue);
  }, []);
  return value;
}