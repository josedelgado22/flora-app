/** validation.js - Reglas de validación de formularios de cuenta. */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Requisitos de contraseña (se muestran en vivo en el registro). */
export function passwordChecks(password) {
  return {
    minLength: password.length >= 8,
    hasLetter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export const isPasswordValid = (password) => Object.values(passwordChecks(password)).every(Boolean);

/** @returns {Record<string, string>} errores por campo (vacío = válido) */
export function validateRegister({ nombre, apellido, email, password, confirm }) {
  const errors = {};

  if (nombre.trim().length < 2) errors.nombre = 'Ingresa tu nombre.';
  if (apellido.trim().length < 2) errors.apellido = 'Ingresa tu apellido.';

  if (!email.trim()) errors.email = 'Ingresa tu correo.';
  else if (!EMAIL_REGEX.test(email.trim())) errors.email = 'El correo no es válido.';

  if (!password) errors.password = 'Crea una contraseña.';
  else if (!isPasswordValid(password)) errors.password = 'No cumple los requisitos de abajo.';

  if (!confirm) errors.confirm = 'Repite tu contraseña.';
  else if (confirm !== password) errors.confirm = 'Las contraseñas no coinciden.';

  return errors;
}
