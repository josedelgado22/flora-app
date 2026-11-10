// flora_app/src/components/DynamicPlantMascot.js
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { EXPRESSIONS, getEffectiveMood } from '../utils/petFsm';

// Mapeo estático de assets (Metro exige rutas literales en require)
const MASCOT_IMAGES = {
  [EXPRESSIONS.NEUTRAL]: require('../../assets/mascot/cactus_neutral.jpg'),
  [EXPRESSIONS.EXCITED]: require('../../assets/mascot/cactus_excited.jpg'),
  [EXPRESSIONS.HAPPY]: require('../../assets/mascot/cactus_happy.jpg'),
  [EXPRESSIONS.BLOOMING]: require('../../assets/mascot/cactus_blooming.jpg'),
  [EXPRESSIONS.ANGRY]: require('../../assets/mascot/cactus_angry.jpg'),
  [EXPRESSIONS.SAD]: require('../../assets/mascot/cactus_sad.jpg'),
  [EXPRESSIONS.SLEEPING]: require('../../assets/mascot/cactus_sleeping.jpg'),
};

/**
 * Animaciones (todas con el driver nativo, sin GIFs - SC-06):
 *   - Respiración: sube y baja suave en bucle (más lenta si duerme).
 *   - Pulso: escala/opacidad al cambiar de expresión.
 *   - Reacción al entrar en una expresión:
 *       EXCITED  -> 3 saltitos
 *       ANGRY    -> sacudida horizontal
 *       HAPPY / BLOOMING -> pequeño balanceo
 */
export default function DynamicPlantMascot({
  due = 0,
  overdue = 0,
  streakDays = 0,
  isCelebrating = false,
  resizeMode = 'contain',
  style,
}) {
  const currentMood = getEffectiveMood({ due, overdue, streakDays, isCelebrating });
  const imageSource = MASCOT_IMAGES[currentMood] || MASCOT_IMAGES[EXPRESSIONS.NEUTRAL];

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const jumpAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const swayAnim = useRef(new Animated.Value(0)).current;

  // Respiración en bucle
  useEffect(() => {
    const duration = currentMood === EXPRESSIONS.SLEEPING ? 2600 : 1700;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [currentMood, floatAnim]);

  // Pulso al cambiar de estado
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 120, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.7, duration: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
  }, [currentMood, isCelebrating, scaleAnim, opacityAnim]);

  // Reacción propia de cada expresión
  useEffect(() => {
    let reaction = null;

    if (currentMood === EXPRESSIONS.EXCITED) {
      const hop = [
        Animated.timing(jumpAnim, {
          toValue: -20,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(jumpAnim, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ];
      reaction = Animated.sequence([...hop, ...hop, ...hop]);
    } else if (currentMood === EXPRESSIONS.ANGRY) {
      reaction = Animated.sequence(
        [-8, 8, -6, 6, -3, 0].map((toValue) =>
          Animated.timing(shakeAnim, { toValue, duration: 50, useNativeDriver: true })
        )
      );
    } else if (currentMood === EXPRESSIONS.HAPPY || currentMood === EXPRESSIONS.BLOOMING) {
      reaction = Animated.sequence(
        [1, -1, 0].map((toValue) =>
          Animated.timing(swayAnim, {
            toValue,
            duration: 160,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          })
        )
      );
    }

    if (reaction) reaction.start();
    return () => {
      if (reaction) reaction.stop();
      jumpAnim.setValue(0);
      shakeAnim.setValue(0);
      swayAnim.setValue(0);
    };
  }, [currentMood, jumpAnim, shakeAnim, swayAnim]);

  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = swayAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={imageSource}
        style={[
          styles.image,
          style,
          {
            opacity: opacityAnim,
            transform: [
              { translateY: floatY },
              { translateY: jumpAnim },
              { translateX: shakeAnim },
              { rotate },
              { scale: scaleAnim },
            ],
          },
        ]}
        resizeMode={resizeMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 200,
    height: 240,
  },
});