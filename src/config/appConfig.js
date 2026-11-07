/**
 * appConfig.js - Configuración central de la app.
 * Cambia FORCE_MOCKS a false cuando el backend (Render) esté desplegado.
 */
import Constants from 'expo-constants';

// URL base del API REST de Django.
//  - Desarrollo (Expo Go, red local o hotspot): se detecta SOLA con la IP de la PC que Expo
//    ya conoce (la misma del QR). No hay que editarla cuando cambia la red.
//  - Producción (APK): PROD_API_URL (cámbiala por la URL HTTPS de Render).
//  - Forzar una dirección: define EXPO_PUBLIC_API_URL antes de iniciar Expo.
// Con "expo start --tunnel" la detección apunta al túnel: usa el modo LAN normal.
const DEV_API_PORT = 8000;
const PROD_API_URL = 'https://TU-SERVICIO.onrender.com/api/v1';

function resolveApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(':')[0];
    if (host) return `http://${host}:${DEV_API_PORT}/api/v1`;
    return `http://10.0.2.2:${DEV_API_PORT}/api/v1`; // emulador Android sin hostUri
  }

  return PROD_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

// SC-01: tiempo máximo de espera antes de considerar la llamada fallida.
export const REQUEST_TIMEOUT_MS = 3000;

// true  = modo demo: todo se resuelve con mocks/ (Contract-First)
// false = intenta el API real y cae a mocks solo donde está permitido
export const FORCE_MOCKS = true;

// Latencia simulada de los mocks (para ver estados de carga)
export const MOCK_LATENCY_MS = 500;

// Demo del flujo de IA (solo con FORCE_MOCKS = true): 'ok' | 'timeout' | 'offline'
//  'timeout' simula que Pl@ntNet supera los 3 s -> la app salta al cuestionario (SC-01).
export const DEMO_AI_MODE = 'ok';

// SC-05: tope de peso de la foto enviada a la IA (< 1 MB, con margen)
export const MAX_UPLOAD_BYTES = 950000;

// Demo de rachas (solo con FORCE_MOCKS = true): siembra N días de riegos previos
// (hasta ayer) la primera vez, para que la mascota ya muestre una racha en la demo.
// Pon 0 para empezar desde cero. Los días sembrados NO se sincronizan al backend.
export const DEMO_SEED_STREAK_DAYS = 6;

// Hora local (0-23) de los recordatorios de riego
export const REMINDER_HOUR = 9;

// Doble factor (solo mocks): si es true, el login demo exige un código de 6 dígitos.
// Pon false para una demo más rápida (el flujo 2FA queda implementado igual).
export const MOCK_REQUIRE_2FA = true;

// Código válido en modo demo (FORCE_MOCKS). Con el backend real lo envía por correo.
export const DEMO_2FA_CODE = '123456';

// Autenticación REAL contra el backend Django (registro, login y doble factor por correo)
// aunque FORCE_MOCKS siga en true: el resto de la app (plantas, agenda, IA) sigue con datos de demostración.
// Pon false para volver a la autenticación simulada (código 123456).
export const REAL_AUTH = true;

// Las rutas /auth/ envían un correo por SMTP: pueden tardar más que los 3 s de REQUEST_TIMEOUT_MS
// (que se reserva a la IA, SC-01). Con Render gratis, el primer arranque puede tardar ~30-50 s.
export const AUTH_REQUEST_TIMEOUT_MS = 20000;

// Datos REALES (plantas, riegos, rachas, agenda y sincronización) contra el backend Django (Fase 2).
// Déjalo en false hasta que el backend tenga aplicadas las migraciones de la app "plants"
// (python manage.py migrate). Con true, el jardín de cada usuario vive en el servidor.
export const REAL_DATA = true;

// Rutas que van al backend aunque FORCE_MOCKS sea true (todo lo demás sigue con datos de demostración).
export const REAL_PATH_PREFIXES = [
  ...(REAL_AUTH ? ['/auth/'] : []),
  ...(REAL_DATA ? ['/plantas/', '/sync/', '/rachas/', '/agenda/', '/diagnostico/', '/identificacion/'] : []),
];
