/** HistogramChart.js - Histograma de luminancia (de oscuro a claro). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';

const CHART_HEIGHT = 56;

export default function HistogramChart({ histogram = [] }) {
  const max = Math.max(...histogram, 0.0001);

  return (
    <View accessibilityLabel="Histograma de luminosidad de la foto">
      <View style={styles.bars}>
        {histogram.map((value, index) => {
          const shade = Math.round((index + 0.5) * (256 / histogram.length));
          return (
            <View key={index} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(2, (value / max) * CHART_HEIGHT),
                    backgroundColor: `rgb(${shade},${shade},${shade})`,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Oscuro</Text>
        <Text style={styles.legendText}>Claro</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { height: CHART_HEIGHT, flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, paddingHorizontal: 2, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, borderWidth: 1, borderColor: colors.border },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  legendText: { fontSize: 10, color: colors.textMuted },
});
