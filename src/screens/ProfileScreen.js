/**
 * ProfileScreen.js - Perfil con datos reales, etapa de Espina y logros.
 * Ubicación: src/screens/ProfileScreen.js
 *
 * Todo sale de datos reales (sin valores de relleno):
 *   - Racha y etapa de la mascota: PetContext
 *   - Plantas y estado de sincronización: PlantsContext
 *   - Días con riego: historial local (SQLite), se relee cada vez que se abre la pestaña
 *   - Cuenta y cierre de sesión: AuthContext
 *
 * Alineado con Rúbrica Duoc UC: IE 3 (WCAG 2.1 AA) e IE 7 (OWASP Mobile M2).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { usePet } from '../context/PetContext';
import { usePlants } from '../context/PlantsContext';
import { getWateringDays } from '../services/db';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';
import { STAGES } from '../utils/petFsm';

const GOLD = '#F9A825';
const WATER = '#29B6F6';
const FIRE = '#FF6F00';
const DEFAULT_PET_NAME = 'espina';

const plural = (n, singular, pluralForm) => (n === 1 ? singular : pluralForm);

// metric: de dónde sale el avance de cada logro
const ACHIEVEMENTS = [
  { id: 'brote', title: 'Primer brote', text: 'Agrega tu primera planta', icon: 'leaf', color: colors.primary, metric: 'plants', target: 1 },
  { id: 'jardin', title: 'Jardín pequeño', text: 'Ten 3 plantas en tu jardín', icon: 'flower', color: colors.accent, metric: 'plants', target: 3 },
  { id: 'coleccion', title: 'Coleccionista', text: 'Ten 5 plantas en tu jardín', icon: 'earth', color: colors.primaryDark, metric: 'plants', target: 5 },
  { id: 'gota', title: 'Primera gota', text: 'Registra tu primer riego', icon: 'water', color: WATER, metric: 'days', target: 1 },
  { id: 'constante', title: 'Constante', text: 'Riega en 10 días distintos', icon: 'repeat', color: WATER, metric: 'days', target: 10 },
  { id: 'racha3', title: 'Buen comienzo', text: 'Llega a 3 días de racha', icon: 'flame', color: FIRE, metric: 'streak', target: 3 },
  { id: 'racha7', title: 'Una semana', text: 'Llega a 7 días de racha', icon: 'flame', color: FIRE, metric: 'streak', target: 7 },
  { id: 'racha14', title: 'Imparable', text: 'Llega a 14 días de racha', icon: 'ribbon', color: colors.accent, metric: 'streak', target: 14 },
  { id: 'racha30', title: 'Leyenda', text: 'Llega a 30 días de racha', icon: 'trophy', color: GOLD, metric: 'streak', target: 30 },
  { id: 'nombre', title: 'Mascota con nombre', text: 'Ponle un nombre propio a tu mascota', icon: 'heart', color: colors.accent, metric: 'named', target: 1 },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { name, stage, streak } = usePet();
  const { plants, isOnline, pendingCount } = usePlants();
  const { supported, enabled, hour, setReminders, sendTest } = useNotifications();
  const [wateringDays, setWateringDays] = useState(0);

  // Cada vez que se abre la pestaña se relee el historial de riegos
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getWateringDays(400)
        .then((rows) => alive && setWateringDays(rows.length))
        .catch((error) => console.warn('[Profile] no se pudo leer el historial:', error?.message));
      return () => {
        alive = false;
      };
    }, [streak.current, plants.length])
  );

  const bestStreak = Math.max(streak.best, streak.current);

  const achievements = useMemo(() => {
    const metrics = {
      plants: plants.length,
      days: wateringDays,
      streak: bestStreak,
      named: name.trim().toLowerCase() !== DEFAULT_PET_NAME ? 1 : 0,
    };
    return ACHIEVEMENTS.map((item) => {
      const value = metrics[item.metric];
      return { ...item, value: Math.min(value, item.target), unlocked: value >= item.target };
    });
  }, [plants.length, wateringDays, bestStreak, name]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const nextAchievement = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.value / b.target - a.value / a.target)[0];

  // Progreso hacia la siguiente etapa de Espina (la etapa depende de la mejor racha)
  const nextStage = STAGES.find((item) => item.min > bestStreak);
  const stageProgress = nextStage ? (bestStreak - stage.min) / (nextStage.min - stage.min) : 1;

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Confirmas el cierre de sesión? Se purgará la caché local y los tokens almacenados de forma segura.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar la sesión correctamente.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Identidad y etapa */}
        <View style={styles.headerCard}>
          <View style={[styles.avatar, { borderColor: stage.color }]}>
            <Text style={styles.avatarText}>
              {user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'FL'}
            </Text>
          </View>
          <Text style={styles.userName}>
            {[user?.nombre, user?.apellido].filter(Boolean).join(' ') || 'Jardinero F.L.O.R.A.'}
          </Text>
          <Text style={styles.userEmail}>{user?.email || 'usuario@flora.cl'}</Text>

          <View style={[styles.stageTag, { backgroundColor: `${stage.color}22` }]}>
            <Text style={[styles.stageTagText, { color: colors.primaryDark }]}>
              {stage.icon} {stage.name} · Nivel {stage.level}
            </Text>
          </View>

          <View style={styles.stageTrack}>
            <View style={[styles.stageFill, { width: `${Math.round(stageProgress * 100)}%`, backgroundColor: stage.color }]} />
          </View>
          <Text style={styles.stageHint}>
            {nextStage
              ? `${nextStage.min - bestStreak} ${plural(nextStage.min - bestStreak, 'día', 'días')} de racha para ${nextStage.icon} ${nextStage.name}`
              : '¡Alcanzaste la etapa máxima!'}
          </Text>
        </View>

        {/* 2. Métricas */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={24} color={streak.current > 0 ? FIRE : colors.border} />
            <Text style={styles.statNumber}>{streak.current}</Text>
            <Text style={styles.statLabel}>Racha actual</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color={GOLD} />
            <Text style={styles.statNumber}>{bestStreak}</Text>
            <Text style={styles.statLabel}>Mejor racha</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="leaf" size={24} color={colors.primary} />
            <Text style={styles.statNumber}>{plants.length}</Text>
            <Text style={styles.statLabel}>{plural(plants.length, 'Planta', 'Plantas')}</Text>
          </View>
        </View>

        {/* 3. Logros */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Logros</Text>
          <Text style={styles.sectionCount}>
            {unlockedCount} de {achievements.length}
          </Text>
        </View>

        {nextAchievement ? (
          <View style={styles.nextCard}>
            <Ionicons name="flag" size={18} color={colors.accent} />
            <Text style={styles.nextText}>
              Próximo logro: <Text style={styles.bold}>{nextAchievement.title}</Text> ({nextAchievement.value}/
              {nextAchievement.target})
            </Text>
          </View>
        ) : (
          <View style={styles.nextCard}>
            <Ionicons name="sparkles" size={18} color={GOLD} />
            <Text style={styles.nextText}>¡Conseguiste todos los logros!</Text>
          </View>
        )}

        <View style={styles.achGrid}>
          {achievements.map((item) => (
            <View
              key={item.id}
              style={[styles.achCard, !item.unlocked && styles.achCardLocked]}
              accessibilityLabel={`${item.title}: ${item.unlocked ? 'conseguido' : `${item.value} de ${item.target}`}`}
            >
              <View style={[styles.achIcon, { backgroundColor: item.unlocked ? item.color : '#E0E0E0' }]}>
                <Ionicons
                  name={item.unlocked ? item.icon : 'lock-closed'}
                  size={22}
                  color={item.unlocked ? '#FFFFFF' : '#9E9E9E'}
                />
              </View>
              <Text style={styles.achTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.achText} numberOfLines={2}>
                {item.text}
              </Text>

              {item.unlocked ? (
                <Text style={[styles.achDone, { color: colors.success }]}>¡Conseguido!</Text>
              ) : (
                <View style={styles.achProgressWrap}>
                  <View style={styles.achTrack}>
                    <View style={[styles.achFill, { width: `${Math.round((item.value / item.target) * 100)}%` }]} />
                  </View>
                  <Text style={styles.achProgressText}>
                    {item.value}/{item.target}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* 4. Recordatorios de riego (notificaciones locales, HU-FLOR-015) */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderRow}>
            <Ionicons
              name={supported && enabled ? 'notifications' : 'notifications-off-outline'}
              size={22}
              color={supported && enabled ? colors.accent : colors.textMuted}
            />
            <View style={styles.reminderTextWrap}>
              <Text style={styles.reminderTitle}>Recordatorios de riego</Text>
              <Text style={styles.reminderSub}>
                {!supported
                  ? 'Disponible en la app instalada (APK). En Expo Go se simulan.'
                  : enabled
                    ? `Te avisamos a las ${String(hour).padStart(2, '0')}:00 los días que toque regar`
                    : 'Activa el interruptor para recibir avisos'}
              </Text>
            </View>
            <Switch
              value={supported && enabled}
              onValueChange={setReminders}
              disabled={!supported}
              trackColor={{ false: '#D0D0D0', true: colors.primaryLight }}
              thumbColor={supported && enabled ? colors.primary : '#F4F4F4'}
              accessibilityLabel="Activar recordatorios de riego"
            />
          </View>

          {supported && enabled ? (
            <TouchableOpacity style={styles.testButton} onPress={sendTest} accessibilityRole="button">
              <Ionicons name="paper-plane-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.testText}>Enviar notificación de prueba (5 s)</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* 5. Estado de red y sincronización */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Ionicons
              name={isOnline ? 'cloud-done' : 'cloud-offline'}
              size={22}
              color={isOnline ? colors.success : colors.warning}
            />
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                Estado del servidor:{' '}
                <Text style={isOnline ? styles.onlineText : styles.offlineText}>
                  {isOnline ? 'Conectado' : 'Sin conexión (modo local)'}
                </Text>
              </Text>
              {pendingCount > 0 ? (
                <Text style={styles.pendingText}>
                  {pendingCount} {plural(pendingCount, 'registro pendiente', 'registros pendientes')} de sincronización
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* 5. Cierre de sesión */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión de la cuenta"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar sesión segura</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>F.L.O.R.A. v2.5.0 • Duoc UC Portafolio de Título</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  bold: { fontWeight: typography.weight.bold },

  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: { color: colors.surface, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  userName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primaryDark },
  userEmail: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  stageTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  stageTagText: { fontWeight: typography.weight.semibold, fontSize: typography.size.xs },
  stageTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tint,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  stageFill: { height: 8, borderRadius: 4 },
  stageHint: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium, marginTop: 6 },

  statsRow: { flexDirection: 'row', marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginHorizontal: 4,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  statNumber: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.primaryDark, marginVertical: 2 },
  statLabel: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text },
  sectionCount: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.accent },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  nextText: { flex: 1, marginLeft: spacing.sm, fontSize: typography.size.sm, color: colors.text },

  achGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  achCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm + 2,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  achCardLocked: { backgroundColor: '#FAFAFA' },
  achIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  achTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text },
  achText: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, minHeight: 32 },
  achDone: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, marginTop: 6 },
  achProgressWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  achTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E8E8E8', overflow: 'hidden' },
  achFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  achProgressText: { fontSize: 11, fontWeight: typography.weight.semibold, color: colors.textMuted, marginLeft: 8 },

  reminderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  reminderTextWrap: { flex: 1, marginHorizontal: spacing.sm },
  reminderTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text },
  reminderSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.tint,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
  },
  testText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, color: colors.primaryDark, marginLeft: 6 },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusTextWrap: { flex: 1, marginLeft: spacing.sm },
  statusTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text },
  onlineText: { color: colors.success, fontWeight: typography.weight.bold },
  offlineText: { color: colors.warning, fontWeight: typography.weight.bold },
  pendingText: { fontSize: typography.size.xs, color: colors.warning, marginTop: 2 },

  logoutButton: {
    flexDirection: 'row',
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFCDD2',
    borderWidth: 1,
  },
  logoutText: { color: colors.danger, fontWeight: typography.weight.bold, fontSize: typography.size.sm, marginLeft: 8 },
  versionText: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs, marginTop: spacing.md },
});