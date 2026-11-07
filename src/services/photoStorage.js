/**
 * photoStorage.js - Copia la foto de la planta al almacenamiento PERMANENTE de la app.
 * Las fotos del selector/cámara quedan en la caché del teléfono, que el sistema puede limpiar;
 * en el directorio de documentos sobreviven. Degradación grácil: si algo falla, se conserva
 * la URI original y la app sigue funcionando.
 * Requiere: npx expo install expo-file-system
 */
import { Directory, File, Paths } from 'expo-file-system';

const PHOTOS_DIR = 'plant-photos';

/** @returns {string|null} URI permanente (o la original si no se pudo copiar) */
export function persistPhoto(sourceUri) {
  if (!sourceUri) return null;

  try {
    const directory = new Directory(Paths.document, PHOTOS_DIR);
    if (!directory.exists) directory.create();

    const extension = (sourceUri.split('?')[0].match(/\.(\w{3,4})$/)?.[1] ?? 'jpg').toLowerCase();
    const target = new File(directory, `planta-${Date.now()}.${extension}`);
    new File(sourceUri).copy(target);
    return target.uri;
  } catch (error) {
    console.warn('[photoStorage] No se pudo guardar la foto de forma permanente:', error?.message);
    return sourceUri;
  }
}

/** Borra todas las fotos guardadas (al cerrar sesión o cambiar de cuenta). Nunca lanza error. */
export function clearPhotos() {
  try {
    const directory = new Directory(Paths.document, PHOTOS_DIR);
    if (directory.exists) directory.delete();
  } catch (error) {
    console.warn('[photoStorage] No se pudieron borrar las fotos:', error?.message);
  }
}
