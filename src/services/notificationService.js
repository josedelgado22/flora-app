/**
 * notificationService.js - Notificaciones LOCALES con expo-notifications (HU-FLOR-015).
 * Implementa el patrón de Degradación Grácil (ISO/IEC 25010) para evitar
 * colapsos en entornos de prueba genéricos como Expo Go.
 */
import { Platform } from 'react-native';

let NotificationsModule = null;
let isNativeModuleAvailable = false;

// Carga dinámica del módulo nativo para prevenir Red Screens en Expo Go / Web
try {
  if (Platform.OS !== 'web') {
    NotificationsModule = require('expo-notifications');
    isNativeModuleAvailable = true;
  }
} catch (error) {
  console.warn(
    '[notificationService] Módulo nativo expo-notifications no detectado en Expo Go. Operando en modo simulado.'
  );
  isNativeModuleAvailable = false;
}

export const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web' && isNativeModuleAvailable;

const CHANNEL_ID = 'riego';

/** Handler (mostrar aviso con la app abierta) + canal de Android. Idempotente. */
export async function configureNotifications() {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) return;

  try {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await NotificationsModule.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Recordatorios de riego',
        importance: NotificationsModule.AndroidImportance.DEFAULT,
      });
    }
  } catch (err) {
    console.warn('[notificationService] Error al configurar handler de notificaciones:', err.message);
  }
}

/** @returns {Promise<'granted'|'denied'|'undetermined'>} */
export async function getPermissionStatus() {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) return 'denied';
  try {
    const { status } = await NotificationsModule.getPermissionsAsync();
    return status;
  } catch (err) {
    return 'denied';
  }
}

export async function requestPermission() {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) return 'denied';
  try {
    const { status } = await NotificationsModule.requestPermissionsAsync();
    return status;
  } catch (err) {
    return 'denied';
  }
}

export async function cancelAllReminders() {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) return;
  try {
    await NotificationsModule.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notificationService] No se pudieron cancelar los recordatorios:', err.message);
  }
}

/** Reemplaza TODOS los recordatorios por el plan recibido. */
export async function scheduleReminderPlan(plan) {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) {
    console.log('[Mock notificationService] Plan de recordatorios programado localmente (Simulado):', plan.length);
    return;
  }

  try {
    await NotificationsModule.cancelAllScheduledNotificationsAsync();

    for (const reminder of plan) {
      await NotificationsModule.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { tipo: 'riego', plantIds: reminder.plantIds },
        },
        trigger: {
          type: NotificationsModule.SchedulableTriggerInputTypes.DATE,
          date: reminder.date,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn('[notificationService] Error al agendar plan de recordatorios:', err.message);
  }
}

/** Notificación de prueba a los 5 segundos (útil para la demo en vivo). */
export async function scheduleTestNotification() {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) {
    console.log('[Mock notificationService] Alerta de prueba de 5s activada (Consola local)');
    return;
  }

  try {
    await NotificationsModule.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio de prueba 💧',
        body: 'Así te avisará F.L.O.R.A. cuando toque regar.',
        data: { tipo: 'prueba' },
      },
      trigger: {
        type: NotificationsModule.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: CHANNEL_ID,
      },
    });
  } catch (err) {
    console.warn('[notificationService] Error al agendar notificación de prueba:', err.message);
  }
}

/** Escucha cuando el usuario toca una notificación. Devuelve la función para desuscribirse. */
export function subscribeToNotificationTaps(callback) {
  if (!NOTIFICATIONS_SUPPORTED || !NotificationsModule) return () => {};
  try {
    const subscription = NotificationsModule.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  } catch (err) {
    return () => {};
  }
}