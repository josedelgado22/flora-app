/**
 * photoUploadService.js - Subida de fotos pendientes (HU-FLOR-014).
 *
 * Backend: POST /plantas/<id>/fotos/  (multipart: imagen, tipo) -> { id, tipo, url, tomada_en }
 */
import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { compressForUpload } from './imageService';
import { request, isRecoverable } from './apiClient';
import { getPendingPhotos, markPhotoUploaded, markPhotoFailed } from './db';

const PHOTO_TIMEOUT_MS = 30000;

export async function uploadSinglePhoto(photo) {
  // 1. Compresión previa (OWASP M7: < 950 KB)
  const { uri: rawUri } = await compressForUpload({ uri: photo.uri });

  // 2. Normalización de URI para Android
  const cleanUri =
    Platform.OS === 'android' && !rawUri.startsWith('file://') && !rawUri.startsWith('content://')
      ? `file://${rawUri}`
      : rawUri;

  // 3. Multipart (apiClient omite Content-Type si el body es FormData).
  // Las versiones recientes de Expo usan un fetch estándar que NO acepta el objeto
  // { uri, name, type } de React Native ("Unsupported FormDataPart implementation"):
  // hay que adjuntar un File real (Blob) de expo-file-system.
  const formData = new FormData();
  formData.append('imagen', new File(cleanUri));
  formData.append('tipo', photo.tipo || 'planta');

  const { data } = await request(`/plantas/${photo.planta_id}/fotos/`, {
    method: 'POST',
    body: formData,
    timeoutMs: PHOTO_TIMEOUT_MS,
  });
  return data;
}

/** Sube las fotos pendientes. Devuelve cuántas se subieron. */
export async function uploadPendingPhotos() {
  const pending = await getPendingPhotos();
  let uploaded = 0;

  for (const photo of pending) {
    try {
      const data = await uploadSinglePhoto(photo);
      await markPhotoUploaded(photo, data?.url ?? photo.uri);
      uploaded += 1;
    } catch (e) {
      console.warn('[photos] fallo subiendo la foto', photo.id, e?.code, e?.message);
      if (isRecoverable(e)) break; // sin red / servidor caído: no insistir ni gastar intentos
      await markPhotoFailed(photo.id, e?.message); // rechazo real (4xx) o error de imagen: cuenta intento
    }
  }
  return uploaded;
}