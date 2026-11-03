import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';

export const QuizzesScreen: React.FC = () => {
  const { rangoActual, puntosInvestidura, sumarPuntos, librosLeidos } = useCosmere();
  const [preguntaActiva, setPreguntaActiva] = useState(0);
  const [testCompletado, setTestCompletado] = useState(false);

  // Preguntas generadas adaptativamente según los libros completados
  const preguntasTest = [
    {
      libro: 'El Imperio Final',
      pregunta: '¿Cuál es el metal alomántico que permite calmar las emociones de las personas?',
      opciones: ['Peltre', 'Zinc', 'Latón', 'Hierro'],
      correcta: 2,
      exp: 'El Latón aplaca las emociones, mientras que el Zinc las inflama.'
    },
    {
      libro: 'El Camino de los Reyes',
      pregunta: '¿Qué tipo de esprec acompaña y forma un vínculo con Kaladin?',
      opciones: ['Esprec de Cripta', 'Esprec de Ceniza', 'Esprec de Honor', 'Esprec de Fuego'],
      correcta: 2,
      exp: 'Sylphrena es un esprec de honor (honorspren).'
    },
    {
      libro: 'Cosmere General',
      pregunta: '¿Cuántas Esquirlas surgieron tras la Fragmentación de Adonalsium?',
      opciones: ['10', '12', '16', '24'],
      correcta: 2,
      exp: 'Dieciséis esquirlas fueron tomadas por los conspiradores en Yolen.'
    }
  ];

  const responder = (indiceOpcion: number) => {
    if (indiceOpcion === preguntasTest[preguntaActiva].correcta) {
      sumarPuntos(150);
      Alert.alert('¡Correcto!', '+150 Puntos de Investidura ganados.\n\n' + preguntasTest[preguntaActiva].exp);
    } else {
      Alert.alert('Incorrecto', 'Esa no era la respuesta adecuada. Sigue estudiando los textos sagrados.');
    }

    if (preguntaActiva + 1 < preguntasTest.length) {
      setPreguntaActiva(preguntaActiva + 1);
    } else {
      setTestCompletado(true);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* CABECERA DE RANGO */}
      <View style={[styles.rankBadgeCard, { borderColor: rangoActual.color }]}>
        <Text style={styles.rankIcon}>{rangoActual.icono}</Text>
        <Text style={[styles.rankTitle, { color: rangoActual.color }]}>{rangoActual.nombre.toUpperCase()}</Text>
        <Text style={styles.rankSaga}>Origen: {rangoActual.sagaOrigen} • Nivel {rangoActual.nivel}</Text>
        <Text style={styles.rankPoints}>{puntosInvestidura} Puntos de Investidura</Text>
        <Text style={styles.rankLore}>{rangoActual.lore}</Text>
      </View>

      <Text style={styles.sectionTitle}>PRUEBA DE CONOCIMIENTO (TEST IA)</Text>

      {!testCompletado ? (
        <View style={styles.quizCard}>
          <Text style={styles.quizSourceTag}>{preguntasTest[preguntaActiva].libro}</Text>
          <Text style={styles.quizQuestion}>{preguntasTest[preguntaActiva].pregunta}</Text>

          {preguntasTest[preguntaActiva].opciones.map((op, idx) => (
            <TouchableOpacity key={idx} style={styles.optionBtn} onPress={() => responder(idx)}>
              <Text style={styles.optionText}>{op}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.quizCounter}>Pregunta {preguntaActiva + 1} de {preguntasTest.length}</Text>
        </View>
      ) : (
        <View style={styles.completedCard}>
          <Text style={styles.completedTitle}>🎉 ¡TEST DE HOY COMPLETADO!</Text>
          <Text style={styles.completedDesc}>Has demostrado tu valía ante los eruditos de Veristitalia. Vuelve a generar otro test cuando leas más capítulos.</Text>
          <TouchableOpacity 
            style={styles.restartBtn} 
            onPress={() => { setPreguntaActiva(0); setTestCompletado(false); }}
          >
            <Text style={styles.restartBtnText}>Generar Nuevo Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: 16, paddingBottom: 60 },
  rankBadgeCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 2, marginBottom: 20 },
  rankIcon: { fontSize: 40, marginBottom: 8 },
  rankTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  rankSaga: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  rankPoints: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginTop: 8 },
  rankLore: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 8, fontStyle: 'italic', lineHeight: 18 },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  quizCard: { backgroundColor: '#0f172a', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b' },
  quizSourceTag: { color: '#38bdf8', fontSize: 11, fontWeight: '800', marginBottom: 6 },
  quizQuestion: { color: '#f8fafc', fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: 16 },
  optionBtn: { backgroundColor: '#1e293b', padding: 14, borderRadius: 10, marginBottom: 10 },
  optionText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  quizCounter: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 8 },
  completedCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#10b981' },
  completedTitle: { color: '#34d399', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  completedDesc: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  restartBtn: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  restartBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 }
});