/**
 * warmup.js - Despierta el backend gratuito de Render (arranque en frío) al abrir la app.
 * Ubicación: src/services/warmup.js
 *
 * No bloquea la interfaz ni lanza errores: si no hay red o el servidor no responde,
 * la app sigue funcionando offline como siempre.
 */
import { API_BASE_URL, WARMUP_TIMEOUT_MS } from '../config/appConfig';

export async function warmUpServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS);

  try {
    await fetch(`${API_BASE_URL}/health/`, { signal: controller.signal });
  } catch {
    // Sin red o servidor caído: se ignora a propósito
  } finally {
    clearTimeout(timer);
  }
}