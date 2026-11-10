/**
 * PlantsContext.js - Estado global del catálogo, Offline-First.
 *
 * Flujo de carga:
 *   1. Pinta de inmediato lo que haya en SQLite (sin esperar la red).
 *   2. Consulta el API (mock en modo demo) y actualiza la caché local.
 *   3. Si el API falla y hay caché, se queda con la caché (sin romper la UI).
 *
 * Flujo de riego (SC-02): guarda en SQLite + encola; al haber red, sincroniza en lote.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import useNetworkStatus from '../hooks/useNetworkStatus';
import { fetchPlants, guardarPlantaEnJardin } from '../services/plantService';
import { flushQueue } from '../services/syncService';
import { uploadPendingPhotos } from '../services/photoUploadService';
import {
  countPendingOperations,
  getPlants,
  registerWatering,
  upsertPlants,
} from '../services/db';

const PlantsContext = createContext(null);

export function PlantsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [plants, setPlants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('cache'); // 'api' | 'mock' | 'cache'
  const [pendingCount, setPendingCount] = useState(0);
  const [lastWatering, setLastWatering] = useState(null);
  const wasOffline = useRef(false);

  const refreshPending = useCallback(async () => {
    setPendingCount(await countPendingOperations());
  }, []);

  /** Envía la cola al backend, sube las fotos pendientes y actualiza el contador. */
  const syncNow = useCallback(async () => {
    let step = 'flushQueue';
    try {
      const { offline } = await flushQueue();
      step = 'uploadPendingPhotos';
      if (!offline) await uploadPendingPhotos();
      step = 'getPlants';
      setPlants(await getPlants()); // ids pueden cambiar al sincronizar
    } catch (e) {
      console.warn(
        `[Plants] Falló la sincronización en "${step}":`,
        e?.message,
        String(e?.stack).split('\n').slice(0, 5).join('\n')
      );
    } finally {
      await refreshPending();
    }
  }, [refreshPending]);

  const load = useCallback(async () => {
    setError(null);
    try {
      // 1) Caché local primero
      const cached = await getPlants();
      if (cached.length > 0) {
        setPlants(cached);
        setIsLoading(false);
      }

      // 2) Red / mock. Con caché existente no se permite sustituirla por mocks.
      try {
        const { plants: remote, source: src } = await fetchPlants({
          allowMock: cached.length === 0,
        });
        await upsertPlants(remote, { prune: src === 'api' });
        setPlants(await getPlants());
        setSource(src);
      } catch (networkError) {
        // 3) Sin red: si hay caché seguimos con ella; si no, es un error real
        if (cached.length === 0) throw networkError;
        setSource('cache');
      }

      await refreshPending();
    } catch (e) {
      setError(e?.message ?? 'No se pudo cargar tu jardín.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [refreshPending]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    return load();
  }, [load]);

  /** Registra un riego (offline-safe). */
  const markWatered = useCallback(
    async (plantId) => {
      await registerWatering(plantId, new Date().toISOString());
      setLastWatering({ plantId, at: Date.now() });
      setPlants(await getPlants());
      await refreshPending();
      if (isOnline) syncNow();
    },
    [isOnline, refreshPending, syncNow]
  );

  /** Agrega una planta nueva (offline-safe) y la muestra de inmediato. */
  const addPlant = useCallback(
    async (data) => {
      const localId = await guardarPlantaEnJardin(data);
      setPlants(await getPlants());
      await refreshPending();
      if (isOnline) syncNow();
      return localId;
    },
    [isOnline, refreshPending, syncNow]
  );

  // Carga inicial al autenticarse / limpieza al cerrar sesión
  useEffect(() => {
    if (!isAuthenticated) {
      setPlants([]);
      setIsLoading(true);
      setError(null);
      return;
    }
    load().then(() => {
      if (isOnline) syncNow();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Al recuperar conectividad: sincronizar la cola y refrescar el catálogo
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isOnline && wasOffline.current) {
      syncNow().then(() => load());
    }
    wasOffline.current = !isOnline;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isAuthenticated]);

  const value = useMemo(
    () => ({
      plants,
      isLoading,
      isRefreshing,
      error,
      source,
      pendingCount,
      isOnline,
      refresh,
      reload: load,
      markWatered,
      addPlant,
      lastWatering,
    }),
    [plants, isLoading, isRefreshing, error, source, pendingCount, isOnline, refresh, load, markWatered, addPlant]
  );

  return <PlantsContext.Provider value={value}>{children}</PlantsContext.Provider>;
}

export function usePlants() {
  const ctx = useContext(PlantsContext);
  if (!ctx) throw new Error('usePlants debe usarse dentro de <PlantsProvider>');
  return ctx;
}

export default PlantsContext;
