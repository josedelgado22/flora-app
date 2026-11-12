/**
 * theme.js - Sistema de Diseño y Tokens de F.L.O.R.A.
 */
import { StyleSheet, Platform } from 'react-native';

export const colors = {
  // Marca Principal
  primary: '#7BA44D',        // Verde Hoja
  primaryLight: '#95BC68',
  primaryDark: '#2E5016',    // Ratio de Contraste > 7:1 sobre fondos claros
  tint: '#F0F7E8',           // Verde muy suave para cards/contenedores
  sprout: '#B7D86A',

  // Acentos y Marca Secundaria
  accent: '#A84B7B',         // Rosa ajustado para mayor contraste (WCAG AA > 4.5:1)
  accentDark: '#783155',
  accentTint: '#FBEEF1',
  ink: '#1A1A1A',            // Botones/Elementos oscuros

  // Superficies y Tipografía Base
  background: '#F9FBF7',     // Fondo suave que reduce fatiga visual
  surface: '#FFFFFF',
  text: '#1A1A1A',           // Alto contraste (> 14:1)
  textMuted: '#595959',      // Ajustado desde #8A8A8A para cumplir ratio 4.5:1 (WCAG AA)
  border: '#E2B2C5',

  // Estados Semánticos (ISO/IEC 25010 - Operabilidad)
  danger: '#C62828',
  dangerTint: '#FFEBEE',
  success: '#2E7D32',
  successTint: '#E8F5E9',
  warning: '#EF6C00',
  warningTint: '#FFF3E0',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const spacing = { 
  xs: 4, 
  sm: 8, 
  md: 16, 
  lg: 24, 
  xl: 32, 
  xxl: 48 
};

export const layout = {
  // Accesibilidad WCAG 2.1 AA: Área de contacto táctil mínima de 48x48 px
  minTouchTarget: 48,
  containerMaxWidth: 600,
};

export const radius = { 
  xs: 4, 
  sm: 8, 
  md: 14, 
  lg: 20, 
  pill: 999 
};

export const typography = {
  family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  size: { 
    xs: 12, 
    sm: 14, 
    md: 16, 
    lg: 20, 
    xl: 26, 
    xxl: 34 
  },
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 34,
    xxl: 42,
  },
  weight: { 
    regular: '400', 
    medium: '500', 
    semibold: '600',
    bold: '700' 
  },
};

export const shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 8 },
    default: {},
  }),
};

export const baseStyles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  centered: { 
    flex: 1, 
    alignItems: 'center', 
    justify: 'center' 
  },
  content: { 
    padding: spacing.md 
  },
  title: { 
    fontSize: typography.size.xl, 
    lineHeight: typography.lineHeight.xl,
    fontWeight: typography.weight.bold, 
    color: colors.primaryDark 
  },
  subtitle: { 
    fontSize: typography.size.md, 
    lineHeight: typography.lineHeight.md,
    color: colors.accent, 
    marginTop: spacing.xs,
    fontWeight: typography.weight.medium
  },
  body: {
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
    color: colors.text,
  },
  caption: {
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.tint,
    ...shadow.sm,
  },
  input: {
    minHeight: layout.minTouchTarget,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.text,
  },
  buttonPrimary: {
    minHeight: layout.minTouchTarget,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadow.sm,
  },
  buttonPrimaryText: {
    color: colors.surface,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  buttonSecondary: {
    minHeight: layout.minTouchTarget,
    backgroundColor: colors.tint,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonSecondaryText: {
    color: colors.primaryDark,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});

const theme = { colors, spacing, layout, radius, typography, shadow, baseStyles };
export default theme;