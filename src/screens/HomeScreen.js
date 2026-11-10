/**
 * HomeScreen.js - Tab "Jardín" (diseño original de F.L.O.R.A.).
 * Datos: PlantsContext (SQLite + API/mock). Riego offline-safe (SC-02).
 * Mascota y racha: PetContext (FSM de Espina + rachas reales, HU-FLOR-004).
 * Imagen de la mascota: DynamicPlantMascot. Últimos 7 días: WeekStrip.
 */
import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConnectionBanner from '../components/ConnectionBanner';
import DynamicPlantMascot from '../components/DynamicPlantMascot';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PlantCard from '../components/PlantCard';
import WeekStrip from '../components/WeekStrip';
import { useAuth } from '../context/AuthContext';
import { usePet } from '../context/PetContext';
import { usePlants } from '../context/PlantsContext';
import { colors } from '../theme/theme';
import { MOODS } from '../utils/petFsm';

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
    lastWatering,
  } = usePlants();
  const { name, mood, streak, statusText, counts } = usePet();

  const pendingToday = counts.due + counts.overdue;

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

            <DynamicPlantMascot
              due={counts.due}
              overdue={counts.overdue}
              streakDays={streak.current}
              isCelebrating={mood === MOODS.CELEBRANDO}
              resizeMode="cover"
              style={styles.mascotImage}
            />

            <Text style={styles.mascotName}>{name}</Text>
            <Text style={styles.mascotStatus}>{statusText}</Text>
          </View>

          {/* Últimos 7 días con riego (se relee al regar o al cambiar la racha) */}
          <WeekStrip
            style={styles.weekStrip}
            streak={streak}
            refreshKey={`${streak.current}:${lastWatering?.at ?? 0}`}
          />

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
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 22,
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
  // La imagen lleva su propio borde redondo (sin recorte, así el salto de la celebración no se corta)
  mascotImage: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  mascotName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 10 },
  mascotStatus: { color: '#EEF3E6', fontSize: 12, marginTop: 2 },
  weekStrip: { marginTop: 16 },
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