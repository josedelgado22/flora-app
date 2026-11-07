/**
 * authService.js - Autenticación sobre apiClient (Contract-First).
 *
 * REGISTRO (con verificación de correo = doble factor desde el alta):
 *  POST /auth/register/          { nombre, apellido, email, password } ->
 *        202 { requires_verification: true, challenge_id, method: 'email', email_hint, expires_in }
 *        La cuenta queda PENDIENTE (no puede iniciar sesión) hasta verificar el código.
 *        409 { code: 'email_exists' }. Registrar de nuevo un correo pendiente genera un código nuevo.
 *  POST /auth/register/verify/   { challenge_id, code } -> { access, refresh, user }   (activa y abre sesión)
 *  POST /auth/register/resend/   { challenge_id }       -> { expires_in }
 *
 * LOGIN:
 *  POST /auth/login/             { email, password } ->
 *        { access, refresh, user }                                  (sin 2FA)
 *        { requires_2fa: true, challenge_id, method, email_hint, expires_in }   (con 2FA)
 *        403 { code: 'account_not_verified' } si el correo aún no se verificó
 *  POST /auth/2fa/verify/        { challenge_id, code } -> { access, refresh, user }
 *  POST /auth/2fa/resend/        { challenge_id }       -> { expires_in }
 *
 * fallbackToMock = false en todas: si el API real no responde NUNCA se aceptan
 * credenciales ni códigos de demostración. Los mocks solo aplican con FORCE_MOCKS.
 */
import { AUTH_REQUEST_TIMEOUT_MS, DEMO_2FA_CODE, MOCK_REQUIRE_2FA } from '../config/appConfig';
import authMock from '../mocks/auth.json';
import { ApiError, request } from './apiClient';

// ---- Estado del "servidor" simulado (en memoria: se reinicia al recargar la app) ----
const mockUsers = authMock.credentials.map((c) => ({ ...c, user: { ...c.user } }));
const mockChallenges = new Map(); // desafíos de login
const mockPending = new Map(); // registros pendientes de verificar

const normalizeEmail = (email) => email.trim().toLowerCase();
const newChallengeId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user[0]}${'*'.repeat(Math.max(user.length - 1, 2))}@${domain}`;
}

const mockSession = (user) => ({
  access: authMock.tokens.access,
  refresh: authMock.tokens.refresh,
  user,
});

const challengeExpired = () =>
  new ApiError({ status: 400, code: 'challenge_expired', detail: 'El código expiró. Solicita uno nuevo.' });

function assertCode(code) {
  if (code !== DEMO_2FA_CODE) {
    throw new ApiError({ status: 400, code: 'invalid_code', detail: 'Código incorrecto. Inténtalo de nuevo.' });
  }
}

/** Convierte la respuesta del API (snake_case) al desafío que usa la UI. */
export function toChallenge(data) {
  return {
    challengeId: data.challenge_id,
    method: data.method ?? 'email',
    emailHint: data.email_hint,
    expiresIn: data.expires_in ?? 300,
  };
}

// ---- Mocks ----
function mockRegister({ nombre, apellido, email, password }) {
  const clean = normalizeEmail(email);

  if (mockUsers.some((u) => u.email === clean)) {
    throw new ApiError({ status: 409, code: 'email_exists', detail: 'Ya existe una cuenta con ese correo.' });
  }

  // Un registro pendiente previo del mismo correo se reemplaza (genera código nuevo)
  for (const [id, pending] of mockPending) {
    if (pending.user.email === clean) mockPending.delete(id);
  }

  const challengeId = newChallengeId('reg');
  mockPending.set(challengeId, {
    password,
    user: {
      id: 0, // se asigna al activar
      email: clean,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      fecha_registro: new Date().toISOString(),
    },
  });

  return {
    requires_verification: true,
    challenge_id: challengeId,
    method: 'email',
    email_hint: maskEmail(clean),
    expires_in: 300,
  };
}

function mockVerifyRegister({ challenge_id, code }) {
  const pending = mockPending.get(challenge_id);
  if (!pending) throw challengeExpired();
  assertCode(code);

  mockPending.delete(challenge_id);
  const user = { ...pending.user, id: 100 + mockUsers.length };
  mockUsers.push({ email: user.email, password: pending.password, user });
  return mockSession(user); // la verificación del correo ya cuenta como segundo factor
}

function mockResendRegister({ challenge_id }) {
  if (!mockPending.has(challenge_id)) throw challengeExpired();
  return { expires_in: 300 };
}

function mockLogin({ email, password }) {
  const clean = normalizeEmail(email);

  if ([...mockPending.values()].some((p) => p.user.email === clean)) {
    throw new ApiError({
      status: 403,
      code: 'account_not_verified',
      detail:
        'Tu cuenta aún no está verificada. Regístrate de nuevo con el mismo correo para recibir un nuevo código.',
    });
  }

  const match = mockUsers.find((u) => u.email === clean && u.password === password);
  if (!match) throw new ApiError(authMock.errors.invalid_credentials);

  if (!MOCK_REQUIRE_2FA) return mockSession(match.user);

  const challengeId = newChallengeId('ch');
  mockChallenges.set(challengeId, { user: match.user });

  return {
    requires_2fa: true,
    challenge_id: challengeId,
    method: 'email',
    email_hint: maskEmail(match.email),
    expires_in: 300,
  };
}

function mockVerify({ challenge_id, code }) {
  const challenge = mockChallenges.get(challenge_id);
  if (!challenge) throw challengeExpired();
  assertCode(code);

  mockChallenges.delete(challenge_id);
  return mockSession(challenge.user);
}

function mockResend({ challenge_id }) {
  if (!mockChallenges.has(challenge_id)) throw challengeExpired();
  return { expires_in: 300 };
}

// ---- API pública ----
const call = async (path, body, mock) => {
  const { data } = await request(path, {
    method: 'POST',
    body,
    authenticated: false,
    fallbackToMock: false,
    timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
    mock: () => mock(body),
  });
  return data;
};

/**
 * Crea la cuenta (pendiente) y envía el código al correo.
 * @returns {Promise<object>} respuesta del API; usar toChallenge() para la UI
 */
export function register({ nombre, apellido, email, password }) {
  return call(
    '/auth/register/',
    { nombre: nombre.trim(), apellido: apellido.trim(), email: normalizeEmail(email), password },
    mockRegister
  );
}

/** Login, paso 1: devuelve la sesión o un desafío 2FA ({ requires_2fa: true, ... }). */
export function login({ email, password }) {
  return call('/auth/login/', { email: email.trim(), password }, mockLogin);
}

/**
 * Canjea el código de 6 dígitos por la sesión.
 * @param {{challengeId: string, code: string, purpose?: 'login'|'register'}} params
 */
export function verifyTwoFactor({ challengeId, code, purpose = 'login' }) {
  const isRegister = purpose === 'register';
  return call(
    isRegister ? '/auth/register/verify/' : '/auth/2fa/verify/',
    { challenge_id: challengeId, code },
    isRegister ? mockVerifyRegister : mockVerify
  );
}

/** Reenvía el código. @returns {Promise<{expires_in: number}>} */
export function resendTwoFactor(challengeId, purpose = 'login') {
  const isRegister = purpose === 'register';
  return call(
    isRegister ? '/auth/register/resend/' : '/auth/2fa/resend/',
    { challenge_id: challengeId },
    isRegister ? mockResendRegister : mockResend
  );
}
