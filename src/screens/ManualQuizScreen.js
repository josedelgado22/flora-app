/**
 * ManualQuizScreen.js - Fallback Manual Asistido (SC-01 / HU-FLOR-011).
 * Cuestionario botánico de 3 preguntas, 100% local: no depende de red ni de la IA.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import species from '../data/species.json';
import { QUIZ_QUESTIONS, rankSpeciesByAnswers } from '../data/quiz';
import { baseStyles, colors, radius, spacing } from '../theme/theme';

const REASON_MESSAGE = {
  timeout: 'La identificación tardó más de 3 segundos. Responde 3 preguntas y te ayudamos igual.',
  network: 'No pudimos conectar con el servicio de identificación. Te ayudamos con unas preguntas.',
  offline: 'Estás sin conexión. Te ayudamos con unas preguntas rápidas.',
  manual: 'Respondamos unas preguntas para encontrar tu planta.',
};

export default function ManualQuizScreen({ route, navigation }) {
  const { photoUri = null, reason = 'manual' } = route.params ?? {};
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const question = QUIZ_QUESTIONS[step];

  const handleAnswer = (value) => {
    const nextAnswers = { ...answers, [question.id]: value };
    setAnswers(nextAnswers);

    if (step < QUIZ_QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }

    const candidates = rankSpeciesByAnswers(nextAnswers, species);
    // replace: al volver atrás se regresa al escaneo, no a mitad del cuestionario
    navigation.replace('PlantResult', { photoUri, candidates, estimada: true });
  };

  return (
    <ScrollView style={baseStyles.screen} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{REASON_MESSAGE[reason] ?? REASON_MESSAGE.manual}</Text>
      </View>

      <Text style={styles.progress}>
        Pregunta {step + 1} de {QUIZ_QUESTIONS.length}
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }]}
        />
      </View>

      <Text style={styles.question}>{question.title}</Text>

      {question.options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={styles.option}
          onPress={() => handleAnswer(option.value)}
          activeOpacity={0.7}
        >
          <Text style={styles.optionEmoji}>{option.emoji}</Text>
          <Text style={styles.optionLabel}>{option.label}</Text>
        </TouchableOpacity>
      ))}

      {step > 0 && (
        <TouchableOpacity onPress={() => setStep(step - 1)} activeOpacity={0.7}>
          <Text style={styles.back}>Volver a la pregunta anterior</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  banner: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.tint },
  bannerText: { color: colors.primaryDark, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  progress: { marginTop: spacing.lg, fontSize: 12, color: colors.textMuted },
  progressTrack: {
    marginTop: spacing.xs,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tint,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  question: { fontSize: 20, fontWeight: '700', color: colors.text, marginVertical: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  optionEmoji: { fontSize: 24, marginRight: spacing.md },
  optionLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  back: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
});
