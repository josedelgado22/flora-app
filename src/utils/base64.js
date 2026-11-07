/** base64.js - Utilidades base64 sin dependencias (Hermes-safe). */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < CHARS.length; i += 1) LOOKUP[CHARS.charCodeAt(i)] = i;

/** Peso en bytes del contenido decodificado, sin decodificarlo. */
export function base64ByteLength(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Decodifica base64 a Uint8Array. */
export function base64ToBytes(base64) {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const outLength = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLength);
  let o = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const n0 = LOOKUP[clean.charCodeAt(i)];
    const n1 = LOOKUP[clean.charCodeAt(i + 1)];
    const n2 = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 0;
    const n3 = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 0;

    if (o < outLength) out[o++] = (n0 << 2) | (n1 >> 4);
    if (o < outLength) out[o++] = ((n1 & 15) << 4) | (n2 >> 2);
    if (o < outLength) out[o++] = ((n2 & 3) << 6) | n3;
  }
  return out;
}
