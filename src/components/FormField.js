/** FormField.js - Campo de formulario con etiqueta, foco y mensaje de error (diseño F.L.O.R.A.). */
import React, { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/theme';

const FormField = forwardRef(function FormField({ label, error, style, ...inputProps }, ref) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={[styles.input, focused && styles.focused, error && styles.error]}
        placeholderTextColor="#A0A0A0"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

export default FormField;

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    color: '#333333',
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#FAFAFA',
  },
  focused: { borderColor: colors.primary, backgroundColor: '#FFFFFF' },
  error: { borderColor: colors.danger },
  errorText: { marginTop: 4, color: colors.danger, fontSize: 12 },
});
