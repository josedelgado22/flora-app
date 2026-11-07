/**
 * HomeScreen.js - Tab "Jardín" (diseño original de F.L.O.R.A.).
 * Datos: PlantsContext (SQLite + API/mock). Riego offline-safe (SC-02).
 * Mascota, racha y tira semanal: PetContext (FSM de Espina + rachas reales, HU-FLOR-004).
 */
import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConnectionBanner from '../components/ConnectionBanner';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PlantCard from '../components/PlantCard';
import { useAuth } from '../context/AuthContext';
import { usePet } from '../context/PetContext';
import { usePlants } from '../context/PlantsContext';
import { colors } from '../theme/theme';

// Mientras la racha carga (SQLite) se dibujan 7 círculos vacíos para que el diseño no salte
const PLACEHOLDER_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => ({
  label,
  key: `placeholder-${index}`,
  done: false,
  isToday: false,
}));

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const {
    plants,
    isLoading,
    isRefreshing,
    error,
    source,
    pendingCount,
    isOnline,
    refresh,
    reload,
    markWatered,
  } = usePlants();
  const { name, streak, statusText, counts } = usePet();

  const pendingToday = counts.due + counts.overdue;
  const week = streak.week.length > 0 ? streak.week : PLACEHOLDER_WEEK;

  // La celebración de Espina y la racha se actualizan solas: PlantsContext emite lastWatering.
  const handleWater = useCallback(
    async (plantId) => {
      await markWatered(plantId);
    },
    [markWatered]
  );

  // "Reportar síntoma": abre la pantalla de diagnóstico de esa planta
  const handleReportSymptom = useCallback(
    (plant) => navigation.navigate('Diagnostico', { plant }),
    [navigation]
  );

  if (isLoading) return <LoadingState message="Cargando tu jardín..." />;

  if (error && plants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorState message={error} onRetry={reload} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.wrapper}>
          <Text style={styles.greeting}>Hola, {user?.nombre ?? 'jardinero'}</Text>
          <Text style={styles.subtext}>
            {pendingToday > 0
              ? 'Tienes tareas de riego pendientes en tu jardín'
              : 'Tu jardín está perfectamente hidratado'}
          </Text>

          <ConnectionBanner isOnline={isOnline} pendingCount={pendingCount} source={source} />

          {/* Mascota virtual y racha */}
          <View style={styles.mascotCard}>
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>
                🔥 {streak.current} {streak.current === 1 ? 'día' : 'días'}
              </Text>
            </View>
            <View style={styles.cactusIcon}>
              <Text style={styles.cactusEmoji}>🌵</Text>
            </View>
            <Text style={styles.mascotName}>{name}</Text>
            <Text style={styles.mascotStatus}>{statusText}</Text>
          </View>

          {/* Tira semanal (días con riego registrado) */}
          <View style={styles.weekRow}>
            {week.map((day) => (
              <View key={day.key} style={styles.dayPill}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <View
                  style={[
                    styles.dayDot,
                    day.done && styles.dayDotDone,
                    day.isToday && styles.dayDotToday,
                  ]}
                />
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Mi jardín</Text>

          {plants.length === 0 ? (
            <Text style={styles.empty}>
              Aún no tienes plantas. Escanea la primera para empezar a registrar riegos.
            </Text>
          ) : (
            plants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                onWater={handleWater}
                onReportSymptom={handleReportSymptom}
              />
            ))
          )}

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => navigation.navigate('Escanear')}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>📸 Escanear planta o entorno</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32, alignItems: 'center' },
  wrapper: { width: '100%', maxWidth: 600 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#000000' },
  subtext: { fontSize: 13, color: colors.accent, marginTop: 2 },
  mascotCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    marginTop: 16,
    padding: 22,
    alignItems: 'center',
  },
  streakPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: '#000000',
    borderRadius: 100,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  streakText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  cactusIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cactusEmoji: { fontSize: 32 },
  mascotName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  mascotStatus: { color: '#EEF3E6', fontSize: 12, marginTop: 2 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  dayPill: { alignItems: 'center' },
  dayLabel: { fontSize: 10, color: colors.textMuted, marginBottom: 6 },
  dayDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E4A2A3',
    backgroundColor: '#FFFFFF',
  },
  dayDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayDotToday: { borderWidth: 2, borderColor: colors.accent },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#000000', marginTop: 22, marginBottom: 10 },
  empty: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  scanButton: {
    marginTop: 12,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  scanButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
