/**
 * PetContext.js - Mascota virtual "Espina" (HU-FLOR-004).
 *
 * - Rachas REALES: se calculan desde el historial de riegos en SQLite (watering_log).
 * - Ánimo: FSM (utils/petFsm.js) alimentada por el estado de riego de las plantas
 *   y por el evento WATERED que emite PlantsContext al regar.
 * - Etapa evolutiva: según la mejor racha lograda.
 * - Funciona 100% offline.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { DEMO_SEED_STREAK_DAYS, FORCE_MOCKS, REAL_DATA } from '../config/appConfig';
import { getMeta, getWateringDays, seedDemoStreak, setMeta } from '../services/db';
import { EVENTS, getStage, MOOD_META, MOODS, snapshotEvent, transition } from '../utils/petFsm';
import { computeStreak, EMPTY_STREAK } from '../utils/streak';
import { getWateringStatus } from '../utils/watering';
import { useAuth } from './AuthContext';
import { usePlants } from './PlantsContext';

const DEFAULT_PET_NAME = 'Espina';
const MAX_NAME_LENGTH = 20;
const CELEBRATION_MS = 2500;

const PetContext = createContext(null);

const moodReducer = (state, event) => ({ mood: transition(state.mood, event) });

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

export function PetProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { plants, lastWatering } = usePlants();

  const [name, setName] = useState(DEFAULT_PET_NAME);
  const [streak, setStreak] = useState(EMPTY_STREAK);
  const [clock, setClock] = useState(() => Date.now()); // fuerza recálculo al cambiar de día
  const [state, dispatch] = useReducer(moodReducer, { mood: MOODS.FELIZ });

  const celebrationTimer = useRef(null);
  const snapshotRef = useRef(EVENTS.CLEAR);

  const loadStreak = useCallback(async () => {
    try {
      setStreak(computeStreak(await getWateringDays(), new Date()));
    } catch (error) {
      console.warn('[Pet] No se pudo calcular la racha:', error);
    }
  }, []);

  // Inicialización al autenticarse
  useEffect(() => {
    if (!isAuthenticated) {
      setStreak(EMPTY_STREAK);
      setName(DEFAULT_PET_NAME);
      return;
    }
    (async () => {
      try {
        if (FORCE_MOCKS && !REAL_DATA) await seedDemoStreak(DEMO_SEED_STREAK_DAYS);
        const savedName = await getMeta('pet_name');
        if (savedName) setName(savedName);
      } catch (error) {
        console.warn('[Pet] Error al inicializar:', error);
      }
      await loadStreak();
    })();
  }, [isAuthenticated, loadStreak]);

  // Al volver a primer plano puede haber cambiado el día: recalcula racha y estados
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setClock(Date.now());
        loadStreak();
      }
    });
    return () => subscription.remove();
  }, [loadStreak]);

  // Estado de riego de las plantas -> evento de la FSM
  const counts = useMemo(() => {
    const now = new Date();
    let due = 0;
    let overdue = 0;
    for (const plant of plants) {
      const status = getWateringStatus(plant, now).state;
      if (status === 'overdue') overdue += 1;
      else if (status === 'today') due += 1;
    }
    return { due, overdue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, clock]);

  const currentSnapshot = snapshotEvent(counts);

  useEffect(() => {
    snapshotRef.current = currentSnapshot;
    dispatch(currentSnapshot);
  }, [currentSnapshot]);

  // Riego registrado -> celebración + racha actualizada
  useEffect(() => {
    if (!lastWatering) return undefined;

    dispatch(EVENTS.WATERED);
    loadStreak();

    clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => {
      dispatch(EVENTS.CELEBRATION_END);
      dispatch(snapshotRef.current); // vuelve al ánimo que corresponde hoy
    }, CELEBRATION_MS);

    return undefined;
  }, [lastWatering, loadStreak]);

  useEffect(() => () => clearTimeout(celebrationTimer.current), []);

  const renamePet = useCallback(async (newName) => {
    const clean = newName.trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return false;
    setName(clean);
    try {
      await setMeta('pet_name', clean);
    } catch (error) {
      console.warn('[Pet] No se pudo guardar el nombre:', error);
    }
    return true;
  }, []);

  const stage = getStage(streak.best);

  const statusText = useMemo(() => {
    switch (state.mood) {
      case MOODS.CELEBRANDO:
        return '¡Gracias por regar! ';
      case MOODS.CRITICA:
        return `${counts.overdue} ${plural(counts.overdue, 'planta atrasada', 'plantas atrasadas')}: ¡te necesito!`;
      case MOODS.HAMBRIENTA:
        return `${counts.due} ${plural(counts.due, 'riego pendiente', 'riegos pendientes')} hoy`;
      default:
        return plants.length === 0 ? 'Agrega tu primera planta' : 'Feliz — regada a tiempo';
    }
  }, [state.mood, counts, plants.length]);

  const value = useMemo(
    () => ({
      name,
      stage,
      mood: state.mood,
      moodIcon: MOOD_META[state.mood].icon,
      streak,
      statusText,
      counts,
      renamePet,
    }),
    [name, stage, state.mood, streak, statusText, counts, renamePet]
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePet debe usarse dentro de <PetProvider>');
  return ctx;
}

export default PetContext;
