/**
 * webAlert.js - Alert.alert no hace nada en react-native-web, lo que dejaría sin respuesta
 * confirmaciones como "Cerrar sesión" o "Planta guardada". Esta versión usa los diálogos
 * del navegador. En Android/iOS no cambia nada.
 */
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons = []) => {
    const text = [title, message].filter(Boolean).join('\n\n');

    if (buttons.length <= 1) {
      window.alert(text);
      buttons[0]?.onPress?.();
      return;
    }

    const cancel = buttons.find((button) => button.style === 'cancel');
    const actions = buttons.filter((button) => button !== cancel);
    const accepted = window.confirm(text);
    const chosen = accepted ? actions[actions.length - 1] ?? actions[0] : cancel;
    chosen?.onPress?.();
  };
}
