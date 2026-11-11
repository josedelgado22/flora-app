import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from '../components/PrimaryButton';
import { DEMO_2FA_CODE, FORCE_MOCKS, REAL_AUTH } from '../config/appConfig';
import { useAuth } from '../context/AuthContext';
import { resendTwoFactor } from '../services/authService';
import { colors } from '../theme/theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function VerifyCodeScreen({ route, navigation }) {
  const { challenge, email, purpose = 'login' } = route.params;
  const isRegister = purpose === 'register'; // verificación de correo al crear la cuenta
  const { verifyTwoFactor, isSigningIn } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(challenge.expiresIn ?? 300);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resending, setResending] = useState(false);

  // Un solo reloj para el vencimiento y el enfriamiento del reenvío
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const expired = secondsLeft === 0;

  const submit = useCallback(
    async (value) => {
      if (value.length !== CODE_LENGTH || expired || isSigningIn) return;
      setError(null);
      setNotice(null);
      try {
        await verifyTwoFactor({ challengeId: challenge.challengeId, code: value, purpose });
        // éxito: RootNavigator cambia solo a las tabs
      } catch (e) {
        console.warn('[2FA] error:', e?.code, e?.status, e?.message);
        setCode('');
        setError(
          e.code === 'timeout' || e.code === 'network'
            ? 'No pudimos verificar el código. Revisa tu conexión.'
            : e.message
        );
      }
    },
    [challenge.challengeId, expired, isSigningIn, verifyTwoFactor, purpose]
  );

  const handleChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) submit(digits);
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const data = await resendTwoFactor(challenge.challengeId, purpose);
      setSecondsLeft(data?.expires_in ?? 300);
      setCooldown(RESEND_COOLDOWN_S);
      setCode('');
      setNotice('Te enviamos un nuevo código.');
    } catch (e) {
      setError(e.message ?? 'No pudimos reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
            <Ionicons name="arrow-back" size={16} color={colors.accent} />
            <Text style={styles.back}>Volver</Text>
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name={isRegister ? 'mail' : 'lock-closed'} size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>{isRegister ? 'Confirma tu correo' : 'Verifica tu identidad'}</Text>
          <Text style={styles.subtitle}>
            {isRegister ? 'Para activar tu cuenta, enviamos' : 'Enviamos'} un código de {CODE_LENGTH} dígitos a{' '}
            <Text style={styles.bold}>{challenge.emailHint ?? email}</Text>
          </Text>

          <TextInput
            style={[styles.codeInput, error && styles.codeInputError]}
            value={code}
            onChangeText={handleChange}
            placeholder="······"
            placeholderTextColor="#C8C8C8"
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            editable={!isSigningIn && !expired}
            accessibilityLabel="Código de verificación"
          />

          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {notice && !error ? <Text style={styles.notice}>{notice}</Text> : null}

          <Text style={[styles.timer, expired && styles.timerExpired]}>
            {expired ? 'El código expiró. Solicita uno nuevo.' : `El código vence en ${formatTime(secondsLeft)}`}
          </Text>

          <PrimaryButton
            title={isRegister ? 'Activar cuenta' : 'Verificar'}
            onPress={() => submit(code)}
            loading={isSigningIn}
            disabled={code.length !== CODE_LENGTH || expired}
            style={styles.submit}
          />

          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0 || resending} activeOpacity={0.7}>
            <Text style={[styles.resend, (cooldown > 0 || resending) && styles.resendDisabled]}>
              {resending ? 'Enviando...' : cooldown > 0 ? `Reenviar código (${cooldown} s)` : 'Reenviar código'}
            </Text>
          </TouchableOpacity>

          {FORCE_MOCKS && !REAL_AUTH ? (
            <Text style={styles.demo}>Modo demo: usa el código {DEMO_2FA_CODE}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 12, paddingBottom: 32, maxWidth: 600, width: '100%', alignSelf: 'center' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, alignSelf: 'flex-start' },
  back: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  iconWrap: {
    marginTop: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, color: colors.text, marginTop: 12, fontWeight: '700' },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  bold: { fontWeight: '700', color: colors.text },
  codeInput: {
    marginTop: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 12,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  codeInputError: { borderColor: colors.danger },
  errorBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.dangerTint },
  errorText: { color: colors.danger, fontSize: 13 },
  notice: { marginTop: 12, color: colors.primaryDark, fontSize: 13, fontWeight: '500' },
  timer: { marginTop: 14, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  timerExpired: { color: colors.danger, fontWeight: '600' },
  submit: { marginTop: 18 },
  resend: { marginTop: 18, textAlign: 'center', fontSize: 13, color: colors.accent, fontWeight: '700' },
  resendDisabled: { color: colors.textMuted, fontWeight: '500' },
  demo: { marginTop: 24, textAlign: 'center', fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
});