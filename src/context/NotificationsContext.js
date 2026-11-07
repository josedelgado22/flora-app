/**
 * NotificationsContext.js - Recordatorios locales de riego (HU-FLOR-015).
 * - Pide permiso la primera vez y recuerda la preferencia del usuario.
 * - Reprograma los recordatorios cada vez que cambian las plantas (riego, alta, sincronización).
 * - Al tocar una notificación abre la Agenda.
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
import { Alert } from 'react-native';
import { REMINDER_HOUR } from '../config/appConfig';
import { navigationRef } from '../navigation/navigationRef';
import { getMeta, setMeta } from '../services/db';
import {
  cancelAllReminders,
  configureNotifications,
  getPermissionStatus,
  NOTIFICATIONS_SUPPORTED,
  requestPermission,
  scheduleReminderPlan,
  scheduleTestNotification,
  subscribeToNotificationTaps,
} from '../services/notificationService';
import { buildReminderPlan } from '../utils/reminders';
import { useAuth } from './AuthContext';
import { usePlants } from './PlantsContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { plants } = usePlants();

  const [wantsReminders, setWantsReminders] = useState(true);
  const [permission, setPermission] = useState('undetermined');
  const [ready, setReady] = useState(false);

  const queue = useRef(Promise.resolve()); // serializa programaciones para evitar carreras

  // Inicialización / limpieza al cerrar sesión
  useEffect(() => {
    if (!NOTIFICATIONS_SUPPORTED) return undefined;

    if (!isAuthenticated) {
      setReady(false);
      cancelAllReminders().catch(() => {});
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        await configureNotifications();

        const saved = await getMeta('reminders_enabled');
        const wants = saved === null ? true : saved === '1';

        let status = await getPermissionStatus();
        if (wants && status === 'undetermined') status = await requestPermission();
        if (saved === null) await setMeta('reminders_enabled', wants ? '1' : '0');

        if (!cancelled) {
          setWantsReminders(wants);
          setPermission(status);
          setReady(true);
        }
      } catch (error) {
        console.warn('[Notifications] Error al inicializar:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const active = ready && wantsReminders && permission === 'granted';

  // Reprogramación cuando cambian plantas o preferencias
  useEffect(() => {
    if (!ready) return;

    queue.current = queue.current.then(async () => {
      try {
        if (active) {
          await scheduleReminderPlan(buildReminderPlan(plants, new Date(), { hour: REMINDER_HOUR }));
        } else {
          await cancelAllReminders();
        }
      } catch (error) {
        console.warn('[Notifications] No se pudieron programar los recordatorios:', error);
      }
    });
  }, [plants, active, ready]);

  // Tocar una notificación -> Agenda
  useEffect(() => {
    if (!active) return undefined;
    return subscribeToNotificationTaps(() => {
      if (navigationRef.isReady()) navigationRef.navigate('Agenda');
    });
  }, [active]);

  const ensurePermission = useCallback(async () => {
    let status = permission;
    if (status !== 'granted') status = await requestPermission();
    setPermission(status);
    if (status !== 'granted') {
      Alert.alert(
        'Permiso de notificaciones',
        'Activa las notificaciones de F.L.O.R.A. en los ajustes del teléfono para recibir recordatorios de riego.'
      );
      return false;
    }
    return true;
  }, [permission]);

  const setReminders = useCallback(
    async (value) => {
      if (value && !(await ensurePermission())) return;
      setWantsReminders(value);
      await setMeta('reminders_enabled', value ? '1' : '0');
    },
    [ensurePermission]
  );

  const sendTest = useCallback(async () => {
    if (!(await ensurePermission())) return;
    await scheduleTestNotification();
    Alert.alert('Recordatorio de prueba', 'Llegará en 5 segundos. Puedes enviar la app a segundo plano.');
  }, [ensurePermission]);

  const value = useMemo(
    () => ({
      supported: NOTIFICATIONS_SUPPORTED,
      enabled: wantsReminders && permission === 'granted',
      permission,
      hour: REMINDER_HOUR,
      setReminders,
      sendTest,
    }),
    [wantsReminders, permission, setReminders, sendTest]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>');
  return ctx;
}

export default NotificationsContext;
