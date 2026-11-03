import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';

export const QuizzesScreen: React.FC = () => {
  const { rangoActual, puntosInvestidura, sumarPuntosTestUnico, testsCompletadosExitosos, todosLosLibrosLeidos } = useCosmere();
  const [testIndex, setTestIndex] = useState(0);

  const BANCO_DE_PREGUNTAS = [
    {
      id: 'q1',
      libro: 'El Imperio Final',
      pregunta: '¿Cuál de los siguientes metales alománticos es el metal del empuje físico?',
      opciones: ['Hierro', 'Acero', 'Estaño', 'Cobre'],
      correcta: 1,
      exp: 'El Acero empuja fuentes de metal cercanas, mientras que el Hierro tira de ellas.'
    },
    {
      id: 'q2',
      libro: 'El Camino de los Reyes',
      pregunta: '¿Cuál es el primer ideal común a todas las Órdenes de los Caballeros Radiantes?',
      opciones: [
        'La fuerza antes que la debilidad',
        'Vida antes que muerte, fuerza antes que debilidad, viaje antes que destino',
        'Protegeré a quienes no pueden protegerse',
        'Acepto que habrá quienes no pueda salvar'
      ],
      correcta: 1,
      exp: 'Es el Primer Ideal inmortal jurado por todas las órdenes sin excepción.'
    },
    {
      id: 'q3',
      libro: 'El Aliento de los Dioses',
      pregunta: '¿Cuántos Alientos biocromáticos son necesarios aproximadamente para alcanzar el Quinto Despertar (Inmortalidad)?',
      opciones: ['50', '200', '2.000', '10.000'],
      correcta: 2,
      exp: 'Con 2.000 alientos se alcanza el Quinto Despertar, otorgando agelessness (cuerpo inmortal).'
    },
    {
      id: 'q4',
      libro: 'El Alma del Emperador',
      pregunta: '¿De qué material debe estar tallado un Sello de Alma auténtico para funcionar?',
      opciones: ['Piedra de hueso', 'Vidrio volcánico', 'Piedra del alma (Soulstone)', 'Madera investida'],
      correcta: 2,
      exp: 'Solo la piedra del alma es suficientemente maleable y resonante con el Dor.'
    },
    {
      id: 'q5',
      libro: 'Palabras Radiantes',
      pregunta: '¿Qué tipo de esprec forma vínculo con Shallan Davar?',
      opciones: ['Esprec de Honor', 'Esprec de Cripta (Mentiras)', 'Esprec de Ceniza', 'Esprec Cultivador'],
      correcta: 1,
      exp: 'Patrón es un Cryptic (esprec de cripta) fascinado por las geometrías y mentiras.'
    },
    {
      id: 'q6',
      libro: 'Cosmere General',
      pregunta: '¿En qué planeta primigenio ocurrió la Fragmentación original de Adonalsium?',
      opciones: ['Roshar', 'Yolen', 'Scadrial', 'Taldain'],
      correcta: 1,
      exp: 'Yolen es el planeta natal de Adonalsium, Hoid y los dieciséis conspiradores originales.'
    }
  ];

  const actual = BANCO_DE_PREGUNTAS[testIndex];
  const yaSuperado = !!testsCompletadosExitosos[actual.id];

  const responder = (opcionIdx: number) => {
    if (opcionIdx === actual.correcta) {
      const ganoPuntos = sumarPuntosTestUnico(actual.id, 200);
      if (ganoPuntos) {
        Alert.alert('¡Correcto!', '+200 Puntos de Investidura ganados.\n\n' + actual.exp);
      } else {
        Alert.alert('¡Correcto!', 'Respuesta acertada, pero esta pregunta ya la habías superado anteriormente (+0 Puntos).');
      }
    } else {
      Alert.alert('Incorrecto', 'Esa no es la respuesta adecuada.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* TARJETA DE RANGO EXIGENTE */}
      <View style={[styles.rankCard, { borderColor: rangoActual.color }]}>
        <Text style={styles.rankIcon}>{rangoActual.icono}</Text>
        <Text style={[styles.rankTitle, { color: rangoActual.color }]}>{rangoActual.nombre.toUpperCase()}</Text>
        <Text style={styles.rankSaga}>Origen: {rangoActual.sagaOrigen} • Nivel {rangoActual.nivel}</Text>
        <Text style={styles.rankPoints}>{puntosInvestidura} Pts acumulados</Text>
        
        {rangoActual.nivel === 7 && !todosLosLibrosLeidos && (
          <View style={styles.blockNotice}>
            <Text style={styles.blockNoticeText}>
              ⚠️ Para ascender a "Vaso de una Esquirla" requieres tener marcados como leídos todos los libros del Cosmere.
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>PRUEBAS OFICIALES DE VERISTITALIA</Text>

      <View style={styles.quizCard}>
        <View style={styles.quizCardHeader}>
          <Text style={styles.bookTag}>{actual.libro}</Text>
          <Text style={[styles.statusTag, { color: yaSuperado ? '#34d399' : '#f59e0b' }]}>
            {yaSuperado ? '✓ SUPERADA (0 PTS)' : '⚡ PUNTOS DISPONIBLES (+200)'}
          </Text>
        </View>

        <Text style={styles.questionText}>{actual.pregunta}</Text>

        {actual.opciones.map((op, idx) => (
          <TouchableOpacity key={idx} style={styles.optBtn} onPress={() => responder(idx)}>
            <Text style={styles.optText}>{op}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.navRow}>
          <TouchableOpacity
            disabled={testIndex === 0}
            style={[styles.arrowBtn, testIndex === 0 && { opacity: 0.3 }]}
            onPress={() => setTestIndex(testIndex - 1)}
          >
            <Text style={styles.arrowText}>◀ Anterior</Text>
          </TouchableOpacity>

          <Text style={styles.counterText}>{testIndex + 1} de {BANCO_DE_PREGUNTAS.length}</Text>

          <TouchableOpacity
            disabled={testIndex === BANCO_DE_PREGUNTAS.length - 1}
            style={[styles.arrowBtn, testIndex === BANCO_DE_PREGUNTAS.length - 1 && { opacity: 0.3 }]}
            onPress={() => setTestIndex(testIndex + 1)}
          >
            <Text style={styles.arrowText}>Siguiente ▶</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: 16, paddingBottom: 60 },
  rankCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 2, marginBottom: 20 },
  rankIcon: { fontSize: 38, marginBottom: 6 },
  rankTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  rankSaga: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  rankPoints: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', marginTop: 8 },
  blockNotice: { backgroundColor: '#451a03', padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#b45309' },
  blockNoticeText: { color: '#fde047', fontSize: 11, textAlign: 'center', fontWeight: '600' },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
  quizCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b' },
  quizCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bookTag: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  statusTag: { fontSize: 10, fontWeight: '800' },
  questionText: { color: '#f8fafc', fontSize: 14, fontWeight: '700', lineHeight: 21, marginBottom: 16 },
  optBtn: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 8 },
  optText: { color: '#f8fafc', fontSize: 12, fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 10 },
  arrowBtn: { padding: 8 },
  arrowText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  counterText: { color: '#64748b', fontSize: 11 }
});