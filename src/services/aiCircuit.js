/**
 * aiCircuit.js - Circuit Breaker de la identificación por IA (Smart Fallback, nivel 1 -> nivel 2).
 *
 * Nivel 1: Pl@ntNet vía backend.  Nivel 2: clasificación heurística local (cuestionario).
 * Tras FAILURE_THRESHOLD fallos seguidos el circuito se ABRE durante OPEN_MS: mientras está
 * abierto la app no espera a la red y pasa directo al nivel 2 (ISO/IEC 25010: tolerancia a fallos).
 * Al vencer el plazo se vuelve a intentar con la IA ("semiabierto"); un éxito cierra el circuito.
 */
import { useEffect, useState } from 'react';

export const FAILURE_THRESHOLD = 2;
export const OPEN_MS = 60 * 1000;

let state = { failures: 0, openUntil: 0 };
let timer = null;
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(getAiStatus()));
}

function scheduleReopenNotice() {
  clearTimeout(timer);
  const wait = state.openUntil - Date.now();
  if (wait > 0) timer = setTimeout(notify, wait + 50);
}

export function isCircuitOpen(now = Date.now()) {
  return state.openUntil > now;
}

/** 'ok' = se intenta la IA | 'degraded' = circuito abierto, se usa el respaldo directo */
export function getAiStatus() {
  return isCircuitOpen() ? 'degraded' : 'ok';
}

export function recordAiSuccess() {
  state = { failures: 0, openUntil: 0 };
  clearTimeout(timer);
  notify();
}

export function recordAiFailure() {
  const failures = state.failures + 1;
  state = {
    failures,
    openUntil: failures >= FAILURE_THRESHOLD ? Date.now() + OPEN_MS : state.openUntil,
  };
  scheduleReopenNotice();
  notify();
}

export function resetCircuit() {
  recordAiSuccess();
}

export function subscribeAiStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hook: estado actual del servicio de IA ('ok' | 'degraded'). */
export function useAiStatus() {
  const [status, setStatus] = useState(getAiStatus());
  useEffect(() => {
    setStatus(getAiStatus());
    return subscribeAiStatus(setStatus);
  }, []);
  return status;
}