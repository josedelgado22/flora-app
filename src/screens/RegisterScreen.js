/**
 * RegisterScreen.js - Registro de cuenta (HU-FLOR-001/005).
 * Valida en el cliente (misma regla que el backend), muestra los requisitos de contraseña
 * en vivo y, al crear la cuenta, vuelve al Login con el correo prellenado.
 */
import React, { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormField from '../components/FormField';
import PrimaryButton from '../components/PrimaryButton';
import { register, toChallenge } from '../services/authService';
import { colors } from '../theme/theme';
import { passwordChecks, validateRegister } from '../utils/validation';

const REQUIREMENTS = [
  { key: 'minLength', label: 'Al menos 8 caracteres' },
  { key: 'hasLetter', label: 'Una letra' },
  { key: 'hasNumber', label: 'Un número' },
];

export default function RegisterScreen({ navigation }) {
  const [values, setValues] = useState({ nombre: '', apellido: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apellidoRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const setField = (key) => (text) => setValues((prev) => ({ ...prev, [key]: text }));
  const checks = passwordChecks(values.password);

  const handleSubmit = async () => {
    setFormError(null);
    const found = validateRegister(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const data = await register(values);
      // La cuenta queda pendiente hasta confirmar el código enviado al correo (doble factor)
      navigation.navigate('VerifyCode', {
        challenge: toChallenge(data),
        email: values.email.trim(),
        purpose: 'register',
      });
    } catch (error) {
      console.warn('[Register] error:', error?.code, error?.status, error?.message);
      setFormError(
        [400, 409, 429, 503].includes(error.status)
          ? error.message
          : 'No pudimos crear tu cuenta. Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Empieza a cuidar tus plantas con F.L.O.R.A.</Text>

          <View style={styles.row}>
            <FormField
              style={styles.half}
              label="Nombre"
              value={values.nombre}
              onChangeText={setField('nombre')}
              error={errors.nombre}
              placeholder="José"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => apellidoRef.current?.focus()}
              editable={!submitting}
            />
            <FormField
              ref={apellidoRef}
              style={styles.half}
              label="Apellido"
              value={values.apellido}
              onChangeText={setField('apellido')}
              error={errors.apellido}
              placeholder="Delgado"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              editable={!submitting}
            />
          </View>

          <FormField
            ref={emailRef}
            label="Correo electrónico"
            value={values.email}
            onChangeText={setField('email')}
            error={errors.email}
            placeholder="tucorreo@gmail.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
          />

          <FormField
            ref={passwordRef}
            label="Contraseña"
            value={values.password}
            onChangeText={setField('password')}
            error={errors.password}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            editable={!submitting}
          />

          <View style={styles.requirements}>
            {REQUIREMENTS.map((item) => (
              <Text
                key={item.key}
                style={[styles.requirement, checks[item.key] && styles.requirementOk]}
              >
                {checks[item.key] ? '✓' : '○'} {item.label}
              </Text>
            ))}
          </View>

          <FormField
            ref={confirmRef}
            label="Repite la contraseña"
            value={values.confirm}
            onChangeText={setField('confirm')}
            error={errors.confirm}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!submitting}
          />

          {formError ? (
            <View style={styles.banner} accessibilityRole="alert">
              <Text style={styles.bannerText}>{formError}</Text>
            </View>
          ) : null}

          <PrimaryButton
            title="Crear cuenta"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submit}
          />

          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.footer}>
              ¿Ya tienes cuenta? <Text style={styles.footerLink}>Inicia sesión</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 12, paddingBottom: 32, maxWidth: 600, width: '100%', alignSelf: 'center' },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600', paddingVertical: 8 },
  title: { fontSize: 28, color: colors.text, marginTop: 8, fontWeight: '700' },
  subtitle: { fontSize: 14, color: colors.accent, marginTop: 4, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  requirements: { marginTop: 8 },
  requirement: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  requirementOk: { color: colors.primaryDark, fontWeight: '600' },
  banner: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.dangerTint },
  bannerText: { color: colors.danger, fontSize: 13 },
  submit: { marginTop: 22 },
  footer: { marginTop: 20, textAlign: 'center', fontSize: 13, color: '#777777' },
  footerLink: { color: colors.accent, fontWeight: '700' },
});
