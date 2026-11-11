/**
 * PlantThumb.js - Miniatura de planta: foto si existe; ícono de hoja de respaldo si no hay foto
 * o el archivo ya no está disponible (ej. el sistema limpió la caché del teléfono).
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

// emojiSize se mantiene por compatibilidad con llamadas anteriores; usa iconSize en código nuevo
export default function PlantThumb({ uri, size = 42, radius = 12, iconSize, emojiSize = 20 }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const showPhoto = Boolean(uri) && !failed;

  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius }]}>
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons name="leaf" size={iconSize ?? emojiSize} color="#FFFFFF" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primary,
    marginRight: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
});