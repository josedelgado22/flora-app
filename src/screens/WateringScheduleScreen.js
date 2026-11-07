/**
 * WateringScheduleScreen.js - Agenda adaptativa de riego (HU-FLOR-008).
 * Próximos 14 días agrupados (Atrasadas / Hoy / Mañana / fecha). La frecuencia de cada
 * planta ya está ajustada a su luz. Funciona offline: el riego se guarda en SQLite y se
 * sincroniza al volver la red (SC-02).
 */
import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConnectionBanner from '../components/ConnectionBanner';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import MascotaWidget from '../components/MascotaWidget';
import PlantThumb from '../components/PlantThumb';
import { useNotifications } from '../context/NotificationsContext';
import { usePet } from '../context/PetContext';
import { usePlants } from '../context/PlantsContext';
import { baseStyles, colors, radius, spacing } from '../theme/theme';
import { buildSchedule } from '../utils/schedule';

function ScheduleRow({ item, onWater }) {
  const [busy, setBusy] = useState(false);
  const { plant, offset, projected } = item;
  const actionable = !projected && offset <= 0;

  const handleWater = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onWater(plant.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.row, projected && styles.rowProjected]}>
      <PlantThumb uri={plant.foto_url} size={38} radius={11} emojiSize={18} />

      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>{plant.nombre_comun}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {projected ? 'Estimado' : `Cada ${plant.frecuencia_riego_dias} días`}
          {plant.ubicacion ? ` · ${plant.ubicacion === 'exterior' ? 'Exterior' : 'Interior'}` : ''}
        </Text>
      </View>

      {actionable && (
        <TouchableOpacity
          style={[styles.waterBtn, busy && styles.waterBtnBusy]}
          onPress={handleWater}
          disabled={busy}
          accessibilityLabel={`Regar ${plant.nombre_comun}`}
        >
          <Text style={styles.waterBtnText}>{busy ? '...' : '💧 Regar'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function WateringScheduleScreen() {
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
  const { supported, enabled, hour } = useNotifications();
  const { name, streak, counts } = usePet(); // datos reales de Espina para el widget flotante

  const sections = useMemo(() => buildSchedule(plants), [plants]);

  const overdueCount = sections.find((s) => s.offset === -1)?.data.length ?? 0;
  const todayCount = sections.find((s) => s.offset === 0)?.data.filter((i) => !i.projected).length ?? 0;

  if (isLoading) return <LoadingState message="Preparando tu agenda..." />;

  if (error && plants.length === 0) {
    return (
      <View style={baseStyles.screen}>
        <ErrorState message={error} onRetry={reload} />
      </View>
    );
  }

  const summary =
    overdueCount + todayCount === 0
      ? 'No tienes riegos pendientes. ¡Buen trabajo!'
      : [
          overdueCount > 0 ? `${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'}` : null,
          todayCount > 0 ? `${todayCount} para hoy` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  // Botón "Alimentar" de Espina: registra el riego de todas las plantas pendientes (con confirmación)
  const pendingItems = sections.flatMap((s) => s.data).filter((i) => !i.projected && i.offset <= 0);

  const handleAlimentar = () => {
    if (pendingItems.length === 0) {
      Alert.alert('Todo regado 🌱', 'No tienes riegos pendientes por ahora.');
      return;
    }
    const names = pendingItems.map((i) => i.plant.nombre_comun);
    const list = names.length > 4 ? `${names.slice(0, 4).join(', ')} y ${names.length - 4} más` : names.join(', ');
    Alert.alert(
      'Registrar riegos 💧',
      `¿Ya regaste ${pendingItems.length === 1 ? 'esta planta' : `estas ${pendingItems.length} plantas`}?\n${list}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, regadas',
          onPress: async () => {
            for (const item of pendingItems) {
              await markWatered(item.plant.id);
            }
          },
        },
      ]
    );
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.summary}>{summary}</Text>
      {supported && (
        <Text style={styles.reminder}>
          {enabled
            ? `🔔 Te avisamos a las ${String(hour).padStart(2, '0')}:00`
            : '🔕 Recordatorios desactivados (actívalos en Perfil)'}
        </Text>
      )}
      <ConnectionBanner isOnline={isOnline} pendingCount={pendingCount} source={source} />
    </View>
  );

  return (
    <View style={baseStyles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <ScheduleRow item={item} onWater={markWatered} />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, section.offset === -1 && styles.sectionOverdue]}>
            {section.title}
          </Text>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aún no tienes plantas. Escanea la primera y su agenda aparecerá aquí.
          </Text>
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      />
      <MascotaWidget
        nombreInicial={name}
        racha={streak.current}
        estado={counts.due + counts.overdue > 0 ? 'hungry' : 'happy'}
        onAlimentar={handleAlimentar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, paddingBottom: 110 },
  header: { marginBottom: spacing.sm },
  summary: { fontSize: 15, fontWeight: '700', color: colors.text },
  reminder: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'capitalize',
  },
  sectionOverdue: { color: colors.danger },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentTint,
  },
  rowProjected: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEEEEE' },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  waterBtn: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  waterBtnBusy: { opacity: 0.6 },
  waterBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  empty: { marginTop: spacing.xl, textAlign: 'center', color: colors.textMuted, fontSize: 13 },
});
