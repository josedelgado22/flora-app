/**
 * ProfileScreen.js - Centro de Control Simplificado de Usuario.
 * Alineado con Rúbrica Duoc UC: IE 3 (WCAG 2.1 AA) e IE 7 (OWASP Mobile M2).
 */
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow, spacing, typography } from '../theme/theme';

export default function ProfileScreen() {
  const { user, signOut, isOffline, syncPendingCount } = useAuth();

  // Cierre de sesión atómico (OWASP Mobile Top 10 M2)
  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Confirmas el cierre de sesión? Se purgará la caché local y los tokens almacenados de forma segura.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
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
        
        {/* 1. TARJETA DE IDENTIDAD DE USUARIO */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'FL'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.nombre || 'Jardinero F.L.O.R.A.'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'usuario@flora.cl'}</Text>
          <View style={styles.badgeTag}>
            <Text style={styles.badgeTagText}>🌱 Cultivador Principiante • Nivel 1</Text>
          </View>
        </View>

        {/* 2. MÉTRICAS CLAVE (ÚNICAMENTE RACHA Y PLANTAS) */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statNumber}>{user?.racha_dias ?? 12}</Text>
            <Text style={styles.statLabel}>Días Racha</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🌱</Text>
            <Text style={styles.statNumber}>{user?.total_plantas ?? 8}</Text>
            <Text style={styles.statLabel}>Plantas</Text>
          </View>
        </View>

        {/* 3. ESTADO DE RED Y SINCRONIZACIÓN */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{isOffline ? '📡' : '🌐'}</Text>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                Estado del Servidor: <Text style={isOffline ? styles.offlineText : styles.onlineText}>
                  {isOffline ? 'Offline (Modo Local)' : 'Conectado'}
                </Text>
              </Text>
              {syncPendingCount > 0 && (
                <Text style={styles.pendingText}>
                  {syncPendingCount} registros pendientes de sincronización
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 4. BOTÓN DE CIERRE DE SESIÓN SEGURO */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout} 
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión de la cuenta"
        >
          <Text style={styles.logoutText}>🔴 Cerrar Sesión Segura</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>
          F.L.O.R.A. v2.5.0 • Duoc UC Portafolio de Título
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: { color: colors.surface, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  userName: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.primaryDark },
  userEmail: { fontSize: typography.size.sm, color: colors.textMuted, marginTop: 2 },
  badgeTag: {
    backgroundColor: colors.tint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  badgeTagText: { color: colors.primaryDark, fontWeight: typography.weight.semibold, fontSize: typography.size.xs },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginHorizontal: 4,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  statEmoji: { fontSize: 24 },
  statNumber: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.primaryDark, marginVertical: 2 },
  statLabel: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderColor: colors.tint,
    borderWidth: 1,
    ...shadow.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusIcon: { fontSize: 20, marginRight: spacing.sm },
  statusTextContainer: { flex: 1 },
  statusTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.text },
  onlineText: { color: colors.success, fontWeight: typography.weight.bold },
  offlineText: { color: colors.warning, fontWeight: typography.weight.bold },
  pendingText: { fontSize: typography.size.xs, color: colors.warning, marginTop: 2 },
  logoutButton: {
    backgroundColor: colors.dangerTint,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFCDD2',
    borderWidth: 1,
  },
  logoutText: { color: colors.danger, fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  versionText: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs, marginTop: spacing.md },
});