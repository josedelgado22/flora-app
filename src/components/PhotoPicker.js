/** PhotoPicker.js - Captura de foto (cámara) o selección desde galería, con permisos. */
import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import PrimaryButton from './PrimaryButton';
import { spacing } from '../theme/theme';

export default function PhotoPicker({
  onPicked,
  disabled = false,
  cameraLabel = '📷 Tomar foto',
  galleryLabel = '🖼️ Elegir de la galería',
}) {
  const handleResult = (result) => {
    if (result.canceled || !result.assets?.length) return;
    const { uri, width, height } = result.assets[0];
    onPicked({ uri, width, height });
  };

  const openCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso de cámara',
          'Activa el permiso de cámara en los ajustes del teléfono para tomar la foto, o elige una de tu galería.'
        );
        return;
      }
      handleResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
    } catch (error) {
      Alert.alert('No se pudo abrir la cámara', 'Prueba eligiendo una foto de tu galería.');
    }
  };

  const openGallery = async () => {
    try {
      handleResult(
        await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
      );
    } catch (error) {
      Alert.alert('No se pudo abrir la galería', 'Revisa los permisos de la app e inténtalo de nuevo.');
    }
  };

  return (
    <View style={styles.container}>
      <PrimaryButton title={cameraLabel} onPress={openCamera} disabled={disabled} />
      <PrimaryButton
        title={galleryLabel}
        onPress={openGallery}
        disabled={disabled}
        variant="outline"
        style={styles.second}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  second: { marginTop: spacing.sm },
});
