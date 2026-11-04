import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { ROSHAR_READING_UNITS } from '../data/roshar/catalog/readingUnits';

export function RosharReadingNavigator({ workId }: { workId: string }) {
  const { readingProgress, setUnidadLecturaActual, completarUnidadLectura } = useCosmere();
  const units = ROSHAR_READING_UNITS.filter(unit => unit.workId === workId);
  const progress = readingProgress.find(item => item.workId === workId);
  const completed = new Set(progress?.completedUnitIds ?? []);
  if (units.length === 0) return null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>LECTURA CAPÍTULO A CAPÍTULO</Text>
      {units.map(unit => {
        const done = completed.has(unit.id);
        const current = progress?.currentUnitId === unit.id;
        return (
          <TouchableOpacity
            key={unit.id}
            style={[styles.row, done && styles.done, current && styles.current]}
            accessibilityRole="button"
            accessibilityLabel={unit.label}
            onPress={() => setUnidadLecturaActual(workId, unit.id)}
          >
            <View style={styles.textBox}>
              <Text style={styles.label}>{unit.label}</Text>
              <Text style={styles.meta}>{unit.kind}{current ? ' · ACTUAL' : ''}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={'Marcar como completado ' + unit.label}
              disabled={done}
              onPress={() => completarUnidadLectura(workId, unit.id)}
              style={[styles.complete, done && styles.completeDone]}
            >
              <Text style={styles.completeText}>{done ? '✓' : 'LEÍDO'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: '#1e293b', padding: 10, backgroundColor: '#090d16' },
  title: { color: '#7dd3fc', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 9, borderRadius: 7, marginBottom: 4, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b' },
  done: { borderColor: '#047857', backgroundColor: '#052e2b' },
  current: { borderColor: '#38bdf8' },
  textBox: { flex: 1 },
  label: { color: '#e2e8f0', fontSize: 11, fontWeight: '700' },
  meta: { color: '#64748b', fontSize: 9, marginTop: 2 },
  complete: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5, backgroundColor: '#164e63', marginLeft: 8 },
  completeDone: { backgroundColor: '#065f46' },
  completeText: { color: '#ecfeff', fontSize: 8, fontWeight: '800' }
});