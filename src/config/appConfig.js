/**
 * appConfig.js - Configuración centralizada de F.L.O.R.A.
 *
 * Estrategia de Red (en este orden):
 * 1. EXPO_PUBLIC_API_URL (archivo flora_app/.env): manda sobre todo lo demás. Úsala para probar
 *    Expo Go contra Render:  EXPO_PUBLIC_API_URL=https://TU-SERVICIO.onrender.com/api/v1
 * 2. Desarrollo local (__DEV__, Expo Go por LAN): detecta la IP de la PC desde Expo
 *    (ej: 192.168.1.9) y usa el puerto de DEV_API_PORT.
 * 3. APK / build de producción: usa PROD_API_URL (el backend en Render).
 */
import Constants from 'expo-constants';

// Puerto 8001 para evitar colisiones con Docker o servicios del SO (solo desarrollo local)
export const DEV_API_PORT = 8001;

// Backend desplegado en Render (HTTPS). AJUSTA el nombre al de tu servicio real:
// la URL aparece en el panel de Render, arriba, con la forma https://NOMBRE.onrender.com
export const PROD_API_URL = 'https://flora-backend-api.onrender.com/api/v1';

function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:${DEV_API_PORT}/api/v1`;
    return `http://10.0.2.2:${DEV_API_PORT}/api/v1`;
  }

  return PROD_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log(`[config] API_BASE_URL = ${API_BASE_URL}`);
}

// SC-01: Tiempo máximo de espera para endpoints generales (catálogo, sync, riegos).
// No se sube a propósito: es un requisito. El arranque en frío de Render se cubre con
// warmUpServer() (ver WARMUP_TIMEOUT_MS), no alargando este límite.
export const REQUEST_TIMEOUT_MS = 3000;

// Render (plan gratuito) duerme el servicio tras ~15 min sin uso y tarda cerca de 1 minuto en despertar.
// Al abrir la app se le hace un ping a /health/ con este margen, sin bloquear la interfaz.
export const WARMUP_TIMEOUT_MS = 60000;

// Las llamadas a la IA (diagnóstico / identificación, con imagen) necesitan más margen que SC-01.
// Úsalo así: request('/identificacion/...', { ..., timeoutMs: AI_REQUEST_TIMEOUT_MS })
export const AI_REQUEST_TIMEOUT_MS = 45000; 
// cubre el arranque en frío de Render
// si la IA falla -> cuestionario, nunca resultados falsos
// Qué hacer cuando la IA (Pl@ntNet) no está disponible:
//   false -> conmutar al cuestionario manual (SC-01, resiliencia real)
//   true  -> mostrar resultados de DEMOSTRACIÓN del catálogo local, marcados como tales en pantalla
export const AI_DEMO_FALLBACK = false; 
// Modo Mocks: al estar en false, todo el tráfico consume la API real de Django
export const FORCE_MOCKS = false;

// Latencia simulada para pruebas de interfaz visual
export const MOCK_LATENCY_MS = 500;

// Configuración de demostración de IA
export const DEMO_AI_MODE = 'ok';

// SC-05: Límite de peso para fotografías foliares (OWASP M7: < 950 KB)
export const MAX_UPLOAD_BYTES = 950000;

// Racha inicial simulada para demostraciones
export const DEMO_SEED_STREAK_DAYS = 6;

// Configuración de recordatorios de riego (09:00 AM)
export const REMINDER_HOUR = 9;

// Doble Factor (2FA)
export const MOCK_REQUIRE_2FA = true;
export const DEMO_2FA_CODE = '123456';

// Habilitación de endpoints reales contra Django REST
export const REAL_AUTH = true;
export const AUTH_REQUEST_TIMEOUT_MS = 20000; // Tolerancia para envío de correos 2FA (y arranque en frío de Render)
export const REAL_DATA = true; // Sincronización activa contra PostgreSQL

// Rutas derivadas al backend Django
export const REAL_PATH_PREFIXES = [
  ...(REAL_AUTH ? ['/auth/'] : []),
  ...(REAL_DATA ? ['/plantas/', '/sync/', '/rachas/', '/agenda/', '/diagnostico/', '/identificacion/'] : []),
];