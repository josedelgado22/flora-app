/**
 * PlantThumb.js - Miniatura de planta: foto si existe; emoji 🌿 de respaldo si no hay foto
 * o el archivo ya no está disponible (ej. el sistema limpió la caché del teléfono).
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

export default function PlantThumb({ uri, size = 42, radius = 12, emojiSize = 20 }) {
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
        <Text style={{ fontSize: emojiSize }}>🌿</Text>
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
