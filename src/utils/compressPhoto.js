/**
 * compressPhoto.js - Reduce la foto antes de subirla (el servidor acepta hasta 3 MB).
 * Recibe la URI de la foto y devuelve la URI de un JPEG de máx. 1280 px, calidad 0.7.
 */
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_SIDE = 1280; // px del lado mayor
const QUALITY = 0.7;

export async function compressPhoto(uri) {
  // Carga la imagen para conocer su tamaño real
  let image = await ImageManipulator.manipulate(uri).renderAsync();

  // Solo se reduce si es más grande que el máximo (nunca se agranda)
  if (Math.max(image.width, image.height) > MAX_SIDE) {
    const size = image.width >= image.height ? { width: MAX_SIDE } : { height: MAX_SIDE };
    image = await ImageManipulator.manipulate(image).resize(size).renderAsync();
  }

  const result = await image.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: QUALITY,
  });
  return result.uri;
}
