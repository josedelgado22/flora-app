// flora_app/src/components/SecretTapArea.js
/**
 * SecretTapArea - Envuelve cualquier elemento y llama a onUnlock tras N toques seguidos.
 *   <SecretTapArea taps={5} onUnlock={() => setDemoOpen(true)}>
 *     <Text>F.L.O.R.A. v1.0</Text>
 *   </SecretTapArea>
 * Los toques deben ocurrir dentro de windowMs entre sí; si no, el contador se reinicia.
 */
import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';

export default function SecretTapArea({ taps = 5, windowMs = 2500, onUnlock, children, style }) {
  const count = useRef(0);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handlePress = () => {
    clearTimeout(timer.current);
    count.current += 1;

    if (count.current >= taps) {
      count.current = 0;
      onUnlock?.();
      return;
    }
    timer.current = setTimeout(() => {
      count.current = 0;
    }, windowMs);
  };

  return (
    <Pressable onPress={handlePress} style={style} accessible={false}>
      {children}
    </Pressable>
  );
}