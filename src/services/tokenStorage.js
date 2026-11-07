/**
 * tokenStorage.js - Persistencia de la sesión (HU-FLOR-005).
 *
 * Android/iOS: expo-secure-store (Keychain / Keystore). Es el modo de PRODUCCIÓN.
 * Web: localStorage, SOLO para probar en el navegador (no es almacenamiento seguro).
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  access: 'flora_access_token',
  refresh: 'flora_refresh_token',
  user: 'flora_user',
};

const storage =
  Platform.OS === 'web'
    ? {
        get: async (key) => globalThis.localStorage?.getItem(key) ?? null,
        set: async (key, value) => globalThis.localStorage?.setItem(key, value),
        remove: async (key) => globalThis.localStorage?.removeItem(key),
      }
    : {
        get: (key) => SecureStore.getItemAsync(key),
        set: (key, value) => SecureStore.setItemAsync(key, value),
        remove: (key) => SecureStore.deleteItemAsync(key),
      };

/** Guarda access, refresh y datos básicos del usuario. */
export async function saveSession({ access, refresh, user }) {
  await Promise.all([
    storage.set(KEYS.access, access),
    storage.set(KEYS.refresh, refresh),
    storage.set(KEYS.user, JSON.stringify(user)),
  ]);
}

/** Lee la sesión guardada. Devuelve null si no existe o está corrupta. */
export async function loadSession() {
  const [accessToken, refreshToken, rawUser] = await Promise.all([
    storage.get(KEYS.access),
    storage.get(KEYS.refresh),
    storage.get(KEYS.user),
  ]);

  if (!accessToken || !rawUser) return null;

  try {
    return { accessToken, refreshToken, user: JSON.parse(rawUser) };
  } catch {
    await clearSession();
    return null;
  }
}

/** Elimina toda la sesión (logout). */
export async function clearSession() {
  await Promise.all(Object.values(KEYS).map((key) => storage.remove(key)));
}

export async function getAccessToken() {
  return storage.get(KEYS.access);
}

export async function getRefreshToken() {
  return storage.get(KEYS.refresh);
}

/** Guarda solo el access token renovado (el refresh y el usuario no cambian). */
export async function setAccessToken(access) {
  await storage.set(KEYS.access, access);
}
