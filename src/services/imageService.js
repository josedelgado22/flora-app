/**
 * imageService.js - Middleware de compresión de imagen (SC-05).
 *
 * Reduce la foto a JPEG < 1 MB antes de enviarla a la IA para sostener el SLA < 3 s.
 * Prueba escalones decrecientes de resolución/calidad hasta cumplir el tope.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { MAX_UPLOAD_BYTES } from '../config/appConfig';
import { base64ByteLength } from '../utils/base64';

const STEPS = [
  { width: 1280, quality: 0.7 },
  { width: 1024, quality: 0.6 },
  { width: 800, quality: 0.5 },
  { width: 640, quality: 0.4 },
];

/**
 * @param {{uri: string, width?: number}} photo
 * @returns {Promise<{uri: string, width: number, height: number, bytes: number}>}
 */
export async function compressForUpload(photo) {
  for (const step of STEPS) {
    // Nunca ampliar: si la foto original es más angosta que el escalón, se usa su ancho
    const targetWidth = photo.width ? Math.min(step.width, photo.width) : step.width;

    const context = ImageManipulator.manipulate(photo.uri);
    context.resize({ width: targetWidth });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: step.quality,
      format: SaveFormat.JPEG,
      base64: true, // solo para medir el peso real; no se conserva
    });

    const bytes = base64ByteLength(saved.base64 ?? '');
    if (bytes > 0 && bytes <= MAX_UPLOAD_BYTES) {
      return { uri: saved.uri, width: saved.width, height: saved.height, bytes };
    }
  }

  const error = new Error('No se pudo reducir la foto por debajo de 1 MB.');
  error.code = 'image_too_large';
  throw error;
}
