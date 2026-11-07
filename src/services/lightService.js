/**
 * lightService.js - Fotometría ambiental (SC-03 / HU-FLOR-010).
 *
 * Determina cualitativamente el nivel de luz de un lugar a partir del histograma de
 * luminancia de la foto, 100% en el dispositivo (funciona sin conexión):
 *   1. Reduce la imagen a ~48 px de ancho (JPEG).
 *   2. Decodifica los píxeles con jpeg-js (JavaScript puro).
 *   3. Calcula luminancia relativa (Rec. 709), histograma de 8 barras y razones oscuro/brillante.
 *
 * LIMITACIÓN: la cámara aplica autoexposición, por lo que el valor absoluto es una
 * aproximación. Los umbrales están pensados para fotos de ambientes reales y deben
 * calibrarse con pruebas de campo (ver THRESHOLDS).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { base64ToBytes } from '../utils/base64';

const SAMPLE_WIDTH = 48;
const BINS = 8;

// Umbrales (escala 0-255) - ajustables tras pruebas de campo
export const THRESHOLDS = {
  dark: 70, // píxel "oscuro"
  bright: 180, // píxel "brillante"
  meanLow: 85, // media bajo este valor -> luz baja
  meanHigh: 150, // media sobre este valor -> luz alta
  darkRatio: 0.6, // si >60 % de píxeles oscuros -> luz baja
  brightRatio: 0.5, // si >50 % de píxeles brillantes -> luz alta
};

/**
 * @param {string} uri Foto del lugar
 * @returns {Promise<{nivel: 'baja'|'media'|'alta', luminanciaMedia: number,
 *   histograma: number[], ratioOscuro: number, ratioBrillante: number}>}
 */
export async function analyzeLight(uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: SAMPLE_WIDTH });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });

  if (!saved.base64) throw new Error('No se pudo leer la imagen para medir la luz.');

  const { data, width, height } = decode(base64ToBytes(saved.base64), {
    useTArray: true,
    formatAsRGBA: true,
  });

  return classifyLuminance(data, width * height);
}

/** Clasificación pura (separada para poder probarla sin cámara). */
export function classifyLuminance(rgba, pixelCount) {
  if (!pixelCount) throw new Error('La imagen no tiene píxeles.');

  const counts = new Array(BINS).fill(0);
  const binSize = 256 / BINS;
  let sum = 0;
  let dark = 0;
  let bright = 0;

  for (let i = 0; i < pixelCount; i += 1) {
    const luminance = 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
    sum += luminance;
    counts[Math.min(BINS - 1, Math.floor(luminance / binSize))] += 1;
    if (luminance < THRESHOLDS.dark) dark += 1;
    else if (luminance > THRESHOLDS.bright) bright += 1;
  }

  const mean = sum / pixelCount;
  const ratioOscuro = dark / pixelCount;
  const ratioBrillante = bright / pixelCount;

  let nivel = 'media';
  if (mean < THRESHOLDS.meanLow || ratioOscuro > THRESHOLDS.darkRatio) nivel = 'baja';
  else if (mean > THRESHOLDS.meanHigh || ratioBrillante > THRESHOLDS.brightRatio) nivel = 'alta';

  return {
    nivel,
    luminanciaMedia: Math.round(mean),
    histograma: counts.map((c) => c / pixelCount),
    ratioOscuro,
    ratioBrillante,
  };
}
