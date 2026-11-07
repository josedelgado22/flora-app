/**
 * apiClient.js - Cliente HTTP dual (Contract-First).
 *
 *  1. Si FORCE_MOCKS está activo -> resuelve con el mock.
 *  2. Si no, llama al API REST con timeout (SC-01: 3 s).
 *  3. Ante timeout / sin red / 5xx -> cae al mock SOLO si la llamada lo permite
 *     (fallbackToMock). Los errores 4xx (ej. 401) son respuestas reales del
 *     servidor y NUNCA caen a mock.
 *
 * Devuelve siempre { data, source } con source = 'api' | 'mock', para que
 * la UI pueda mostrar "datos de demostración" si corresponde.
 */
import {
  API_BASE_URL,
  FORCE_MOCKS,
  MOCK_LATENCY_MS,
  REAL_PATH_PREFIXES,
  REQUEST_TIMEOUT_MS,
  AUTH_REQUEST_TIMEOUT_MS,
} from '../config/appConfig';
import { getAccessToken, getRefreshToken, setAccessToken } from './tokenStorage';

/** Error normalizado: status (0 si no hubo respuesta), code y detail. */
export class ApiError extends Error {
  constructor({ status = 0, code = 'unknown', detail = 'Error desconocido' } = {}) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errores de infraestructura: justifican fallback / reintento. */
export function isRecoverable(error) {
  return (
    error instanceof ApiError &&
    (error.code === 'timeout' || error.code === 'network' || error.status >= 500)
  );
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError({
        code: 'timeout',
        detail: `El servidor no respondió en ${timeoutMs / 1000} s.`,
      });
    }
    throw new ApiError({ code: 'network', detail: 'No hay conexión con el servidor.' });
  } finally {
    clearTimeout(timer);
  }
}

async function callApi(path, { method, body, authenticated, timeoutMs }) {
  const headers = { Accept: 'application/json' };
  // FormData (multipart): el runtime fija el Content-Type con el boundary
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  if (authenticated) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) },
    timeoutMs
  );

  // 204 No Content
  let payload = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.code ?? `http_${response.status}`,
      detail: payload?.detail ?? 'La solicitud no pudo completarse.',
    });
  }

  return payload;
}

// --- Renovación del access token (dura 30 min; el refresh dura 7 días) ---
let authExpiredHandler = null;
let refreshInFlight = null;

/** AuthContext registra aquí su signOut: se llama cuando el refresh token ya no sirve. */
export function setAuthExpiredHandler(handler) {
  authExpiredHandler = handler;
}

/** @returns {Promise<'ok'|'expired'|'error'>} */
function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = await getRefreshToken();
      if (!refresh) return 'expired';
      try {
        const data = await callApi('/auth/token/refresh/', {
          method: 'POST',
          body: { refresh },
          authenticated: false,
          timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
        });
        if (!data?.access) return 'expired';
        await setAccessToken(data.access);
        return 'ok';
      } catch (error) {
        // 401 = refresh inválido o vencido. Cualquier otro fallo (sin red, 5xx) no cierra la sesión.
        return error instanceof ApiError && error.status === 401 ? 'expired' : 'error';
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Llama al API y, ante un 401 con sesión, renueva el token y reintenta UNA vez. */
async function callWithRefresh(path, options) {
  try {
    return await callApi(path, options);
  } catch (error) {
    const canRefresh =
      options.authenticated && error instanceof ApiError && error.status === 401;
    if (!canRefresh) throw error;

    const outcome = await refreshAccessToken();
    if (outcome === 'ok') return callApi(path, options);
    if (outcome === 'expired') authExpiredHandler?.();
    throw error;
  }
}

async function runMock(mock) {
  if (typeof mock !== 'function') {
    throw new ApiError({ code: 'no_mock', detail: 'No hay datos de demostración para esta ruta.' });
  }
  await wait(MOCK_LATENCY_MS);
  return { data: await mock(), source: 'mock' };
}

/**
 * @param {string} path  Ruta relativa, ej. '/plantas/'
 * @param {object} opts
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [opts.method='GET']
 * @param {object} [opts.body]
 * @param {boolean} [opts.authenticated=true]   Adjunta el JWT si existe
 * @param {Function} [opts.mock]                Función que devuelve el mock (puede lanzar ApiError)
 * @param {boolean} [opts.fallbackToMock=true]  Permitir mock si el API falla
 * @param {number} [opts.timeoutMs]
 */
export async function request(
  path,
  {
    method = 'GET',
    body,
    authenticated = true,
    mock,
    fallbackToMock = true,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = {}
) {
  // Modo demo, salvo las rutas que se enviaron al backend real (auth y, con REAL_DATA, el jardín)
  const useMock = FORCE_MOCKS && !REAL_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (useMock) return runMock(mock);

  try {
    const data = await callWithRefresh(path, { method, body, authenticated, timeoutMs });
    return { data, source: 'api' };
  } catch (error) {
    console.warn(`[apiClient] ${method} ${API_BASE_URL}${path} -> ${error?.code} ${error?.status ?? ''}`);
    if (fallbackToMock && mock && isRecoverable(error)) {
      console.warn(`[apiClient] ${method} ${path} falló (${error.code}); usando mock.`);
      return runMock(mock);
    }
    throw error;
  }
}
