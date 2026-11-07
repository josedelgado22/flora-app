/**
 * AuthContext.js - Estado global de autenticación.
 * - Restaura la sesión desde SecureStore al abrir la app.
 * - Expone signIn / signOut y el estado de carga.
 * - Los tokens viven en SecureStore; en memoria solo el accessToken y el usuario.
 * - Privacidad: al cerrar sesión se envía lo pendiente y se borran los datos locales; si entra
 *   otra cuenta distinta, también se borran (los datos locales pertenecen a un solo usuario).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { setAuthExpiredHandler } from '../services/apiClient';
import * as authService from '../services/authService';
import { clearLocalData, countPendingOperations, getMeta, setMeta } from '../services/db';
import { clearPhotos } from '../services/photoStorage';
import { flushQueue } from '../services/syncService';
import * as tokenStorage from '../services/tokenStorage';

const AuthContext = createContext(null);

const EMPTY_SESSION = { user: null, accessToken: null };

/**
 * Los datos locales (plantas, riegos, fotos) son de UN usuario. Si inicia sesión una cuenta
 * distinta a la dueña de esos datos, se borran antes de mostrar nada.
 */
async function clearDataIfAccountChanged(user) {
  try {
    const current = String(user?.id ?? user?.email ?? '');
    if (!current) return;

    const owner = await getMeta('owner_user_id');
    if (owner && owner !== current) {
      await clearLocalData(); // también vacía app_meta
      clearPhotos();
    }
    await setMeta('owner_user_id', current);
  } catch (error) {
    console.warn('[Auth] No se pudo comprobar el dueño de los datos locales:', error);
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY_SESSION);
  const [isRestoring, setIsRestoring] = useState(true); // splash inicial
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Restauración de sesión al montar la app
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const saved = await tokenStorage.loadSession();
        if (!cancelled && saved) {
          setSession({ user: saved.user, accessToken: saved.accessToken });
        }
      } catch (error) {
        console.warn('[Auth] No se pudo restaurar la sesión:', error);
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Guarda la sesión (SecureStore) y activa el flujo autenticado. */
  const completeSignIn = useCallback(async ({ access, refresh, user }) => {
    await tokenStorage.saveSession({ access, refresh, user });
    await clearDataIfAccountChanged(user); // antes de abrir la sesión: otra cuenta no ve datos ajenos
    setSession({ user, accessToken: access });
  }, []);

  /**
   * Paso 1 del login. Lanza el error para que la pantalla muestre el mensaje.
   * @returns {{status: 'authenticated'} | {status: 'two_factor', challenge: object}}
   */
  const signIn = useCallback(
    async (credentials) => {
      setIsSigningIn(true);
      try {
        const data = await authService.login(credentials);

        if (data.requires_2fa) {
          return {
            status: 'two_factor',
            challenge: {
              challengeId: data.challenge_id,
              method: data.method ?? 'email',
              emailHint: data.email_hint,
              expiresIn: data.expires_in ?? 300,
            },
          };
        }

        await completeSignIn(data);
        return { status: 'authenticated' };
      } finally {
        setIsSigningIn(false);
      }
    },
    [completeSignIn]
  );

  /** Paso 2 (2FA): valida el código y, si es correcto, abre la sesión. */
  const verifyTwoFactor = useCallback(
    async ({ challengeId, code, purpose = 'login' }) => {
      setIsSigningIn(true);
      try {
        await completeSignIn(await authService.verifyTwoFactor({ challengeId, code, purpose }));
      } finally {
        setIsSigningIn(false);
      }
    },
    [completeSignIn]
  );

  /**
   * Cierra sesión. Primero intenta enviar al servidor lo pendiente (con los tokens aún válidos)
   * y, si no queda nada sin sincronizar, borra los datos locales y las fotos. Si quedan operaciones
   * pendientes (sin conexión) los datos se conservan para no perder trabajo; la comprobación de
   * cuenta al volver a entrar evita que otro usuario los vea.
   * @param {{keepLocalData?: boolean}} options keepLocalData=true cuando la sesión venció.
   */
  const signOut = useCallback(async ({ keepLocalData = false } = {}) => {
    if (!keepLocalData) {
      try {
        await flushQueue().catch(() => {});
        if ((await countPendingOperations()) === 0) {
          await clearLocalData();
          clearPhotos();
        }
      } catch (error) {
        console.warn('[Auth] No se pudieron limpiar los datos locales:', error);
      }
    }

    await tokenStorage.clearSession();
    setSession(EMPTY_SESSION);
  }, []);

  // Si el token de renovación venció, apiClient pide cerrar la sesión (vuelve al Login).
  // Aquí NO se borran los datos: el usuario puede volver a entrar y recuperarlos.
  useEffect(() => {
    setAuthExpiredHandler(() => {
      signOut({ keepLocalData: true });
    });
    return () => setAuthExpiredHandler(null);
  }, [signOut]);

  const value = useMemo(
    () => ({
      user: session.user,
      accessToken: session.accessToken,
      isAuthenticated: Boolean(session.accessToken),
      isRestoring,
      isSigningIn,
      signIn,
      verifyTwoFactor,
      signOut,
    }),
    [session, isRestoring, isSigningIn, signIn, verifyTwoFactor, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook de acceso al contexto. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export default AuthContext;
