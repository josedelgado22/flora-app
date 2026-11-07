/**
 * LoginScreen.js - Inicio de sesión (HU-FLOR-001/005). Diseño original de F.L.O.R.A.
 * El nombre del usuario proviene de la cuenta autenticada (ya no se pide en el formulario).
 * Al autenticarse, RootNavigator cambia solo a las tabs principales.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrimaryButton from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { REAL_AUTH } from '../config/appConfig';
import { colors } from '../theme/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Ingresa tu correo.';
  else if (!EMAIL_REGEX.test(email.trim())) errors.email = 'El correo no es válido.';
  if (!password) errors.password = 'Ingresa tu contraseña.';
  else if (password.length < 6) errors.password = 'Debe tener al menos 6 caracteres.';
  return errors;
}

export default function LoginScreen({ navigation, route }) {
  const { signIn, isSigningIn } = useAuth();

  const registeredEmail = route?.params?.registeredEmail ?? null; // viene desde Registro
  const [email, setEmail] = useState(registeredEmail ?? '');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const passwordRef = useRef(null);

  // Animación de entrada (nativa)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    setFormError(null);
    const errors = validate({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = await signIn({ email, password });
      if (result?.status === 'two_factor') {
        navigation.navigate('VerifyCode', { challenge: result.challenge, email: email.trim() });
      }
      // Sin 2FA, RootNavigator cambia solo a las tabs
    } catch (error) {
      console.warn('[Login] error:', error?.code, error?.status, error?.message);
      setFormError(
        [401, 403, 429, 503].includes(error.status)
          ? error.message
          : 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.'
      );
    }
  };

  const fillDemo = () => {
    setEmail('demo@flora.cl');
    setPassword('Flora1234');
    setFieldErrors({});
    setFormError(null);
  };

  const goToRegister = () => navigation.navigate('Register');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoMark} />
            <Text style={styles.logoText}>F.L.O.R.A.</Text>
          </View>

          <Text style={styles.title}>Bienvenido{'\n'}de vuelta</Text>
          <Text style={styles.subtitle}>Inicia sesión para interactuar con tu jardín</Text>

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={[
              styles.input,
              focusedInput === 'email' && styles.inputFocused,
              fieldErrors.email && styles.inputError,
            ]}
            placeholder="tucorreo@gmail.com"
            placeholderTextColor="#A0A0A0"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
            editable={!isSigningIn}
          />
          {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            ref={passwordRef}
            style={[
              styles.input,
              focusedInput === 'password' && styles.inputFocused,
              fieldErrors.password && styles.inputError,
            ]}
            placeholder="••••••••"
            placeholderTextColor="#A0A0A0"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
            editable={!isSigningIn}
          />
          {fieldErrors.password ? <Text style={styles.errorText}>{fieldErrors.password}</Text> : null}

          {registeredEmail && !formError ? (
            <View style={styles.success} accessibilityRole="alert">
              <Text style={styles.successText}>Cuenta creada. Inicia sesión con tu contraseña.</Text>
            </View>
          ) : null}

          {formError ? (
            <View style={styles.banner} accessibilityRole="alert">
              <Text style={styles.bannerText}>{formError}</Text>
            </View>
          ) : null}

          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <PrimaryButton
            title="Iniciar sesión"
            onPress={handleLogin}
            loading={isSigningIn}
            style={styles.button}
          />

          <TouchableOpacity onPress={goToRegister} activeOpacity={0.7}>
            <Text style={styles.footer}>
              ¿No tienes cuenta? <Text style={styles.footerLink}>Regístrate</Text>
            </Text>
          </TouchableOpacity>

          {/* Atajo de demostración: se elimina al conectar el backend real */}
          {!REAL_AUTH && (
            <TouchableOpacity onPress={fillDemo} disabled={isSigningIn} activeOpacity={0.7}>
              <Text style={styles.demo}>Usar cuenta de prueba</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 26, paddingTop: 20, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  logoText: { fontSize: 18, fontWeight: '700', color: colors.text, marginLeft: 12, letterSpacing: 0.5 },
  title: { fontSize: 28, color: colors.text, marginTop: 14, fontWeight: '700', lineHeight: 34 },
  subtitle: { fontSize: 14, color: colors.accent, marginTop: 4, fontWeight: '500' },
  label: {
    fontSize: 11,
    color: '#333333',
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  inputError: { borderColor: colors.danger },
  errorText: { marginTop: 4, color: colors.danger, fontSize: 12 },
  banner: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.dangerTint },
  bannerText: { color: colors.danger, fontSize: 13 },
  success: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.tint },
  successText: { color: colors.primaryDark, fontSize: 13, fontWeight: '500' },
  forgot: { textAlign: 'right', fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 10 },
  button: { marginTop: 22 },
  footer: { marginTop: 20, textAlign: 'center', fontSize: 13, color: '#777777' },
  footerLink: { color: colors.accent, fontWeight: '700' },
  demo: { marginTop: 14, textAlign: 'center', fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
});
