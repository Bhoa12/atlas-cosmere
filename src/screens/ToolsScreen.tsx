import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { buscarConTolerancia } from '../utils/fuzzySearch';
import { ORDENES_RADIANTE, PREGUNTAS_ORDEN_RADIANTE } from '../data/radiantQuiz';
import { METALES_COSMERE, calcularResonancia } from '../data/twinbornData';
import { LISTA_WORLDHOPPERS } from '../data/worldhoppers';
import { DICCIONARIO_FONETICO } from '../data/phonetics';
import { useCosmere } from '../context/CosmereContext';

export const ToolsScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<'buscador' | 'twinborn' | 'ordenes' | 'trotamundos' | 'fonetica'>('buscador');
  const { setApodoActivo, sumarPuntosTestUnico } = useCosmere();

  // 1. Estados Buscador
  const [queryBusqueda, setQueryBusqueda] = useState('');
  const todosLosLibrosYMagias = SISTEMAS_COSMERE_COMPLETO.flatMap(s => [
    ...s.libros.map(l => ({ tipo: 'Libro', nombre: l.titulo, extra: `${l.saga} (${s.planeta})` })),
    ...s.sistemasMagicos.map(m => ({ tipo: 'Magia', nombre: m.nombre, extra: `${s.planeta}: ${m.desc}` })),
    ...s.faunaFlora.map(f => ({ tipo: 'Criatura', nombre: f.nombre, extra: `${s.planeta} (${f.tipo})` }))
  ]);
  const resultadosBusqueda = buscarConTolerancia(todosLosLibrosYMagias, item => item.nombre, queryBusqueda, 2);

  // 2. Estados Twinborn
  const [metalA, setMetalA] = useState('acero');
  const [metalF, setMetalF] = useState('hierro');
  const resonancia = calcularResonancia(metalA, metalF);

  // 3. Estados Test Órdenes
  const [respuestasQuiz, setRespuestasQuiz] = useState<{ [preguntaIdx: number]: string }>({});
  const [ordenGanadora, setOrdenGanadora] = useState<string | null>(null);

  const responderPreguntaOrden = (preguntaIdx: number, orden: string) => {
    const nuevas = { ...respuestasQuiz, [preguntaIdx]: orden };
    setRespuestasQuiz(nuevas);

    if (Object.keys(nuevas).length === PREGUNTAS_ORDEN_RADIANTE.length) {
      // Contar orden más repetida
      const conteo: { [orden: string]: number } = {};
      Object.values(nuevas).forEach(o => { conteo[o] = (conteo[o] || 0) + 1; });
      const ganadora = Object.keys(conteo).reduce((a, b) => conteo[a] > conteo[b] ? a : b);
      setOrdenGanadora(ganadora);
      setApodoActivo(ORDENES_RADIANTE[ganadora].nombre);
      sumarPuntosTestUnico('radiant_affinity', 300);
      Alert.alert('¡Juramento Pronunciado!', `Has sido aceptado entre los ${ORDENES_RADIANTE[ganadora].nombre}. Título equipado en tu perfil.`);
    }
  };

  return (
    <View style={styles.container}>
      {/* SELECTOR DE HERRAMIENTAS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topSelector}>
        <TouchableOpacity style={[styles.tabChip, subTab === 'buscador' && styles.tabChipActive]} onPress={() => setSubTab('buscador')}>
          <Text style={[styles.tabText, subTab === 'buscador' && styles.tabTextActive]}>🔍 Buscador</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'twinborn' && styles.tabChipActive]} onPress={() => setSubTab('twinborn')}>
          <Text style={[styles.tabText, subTab === 'twinborn' && styles.tabTextActive]}>⚔️ Nacidos Dobles</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'ordenes' && styles.tabChipActive]} onPress={() => setSubTab('ordenes')}>
          <Text style={[styles.tabText, subTab === 'ordenes' && styles.tabTextActive]}>✨ Test Radiante</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'trotamundos' && styles.tabChipActive]} onPress={() => setSubTab('trotamundos')}>
          <Text style={[styles.tabText, subTab === 'trotamundos' && styles.tabTextActive]}>🌌 Trotamundos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'fonetica' && styles.tabChipActive]} onPress={() => setSubTab('fonetica')}>
          <Text style={[styles.tabText, subTab === 'fonetica' && styles.tabTextActive]}>🗣️ Fonética</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {/* VISTA 1: BUSCADOR DIFUSO */}
        {subTab === 'buscador' && (
          <View>
            <Text style={styles.secTitle}>BÚSQUEDA TOLERANTE A ERRATAS</Text>
            <Text style={styles.secSub}>Escribe aunque no sepas la ortografía exacta (ej: "Zeth", "Chul", "Abrasio"):</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar libros, criaturas, magias..."
              placeholderTextColor="#64748b"
              value={queryBusqueda}
              onChangeText={setQueryBusqueda}
            />
            {resultadosBusqueda.slice(0, 8).map((r, i) => (
              <View key={i} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultName}>{r.nombre}</Text>
                  <Text style={styles.resultTag}>{r.tipo.toUpperCase()}</Text>
                </View>
                <Text style={styles.resultExtra}>{r.extra}</Text>
              </View>
            ))}
          </View>
        )}

        {/* VISTA 2: CALCULADORA DE NACIDOS DOBLES */}
        {subTab === 'twinborn' && (
          <View>
            <Text style={styles.secTitle}>LABORATORIO DE RESONANCIAS METÁLICAS</Text>
            <Text style={styles.secSub}>Elige 1 metal alomántico y 1 feruquímico para calcular tu combinación:</Text>

            <Text style={styles.pickerLabel}>1. Metal Alomántico:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metalScroll}>
              {Object.keys(METALES_COSMERE).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.metalChip, metalA === m && styles.metalChipActiveA]}
                  onPress={() => setMetalA(m)}
                >
                  <Text style={styles.metalChipText}>{METALES_COSMERE[m].nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>2. Metal Feruquímico:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metalScroll}>
              {Object.keys(METALES_COSMERE).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.metalChip, metalF === m && styles.metalChipActiveF]}
                  onPress={() => setMetalF(m)}
                >
                  <Text style={styles.metalChipText}>{METALES_COSMERE[m].nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* RESULTADO DE LA RESONANCIA */}
            <View style={styles.resonanceCard}>
              <Text style={styles.resonanceTitle}>{resonancia.nombreTitulo.toUpperCase()}</Text>
              <Text style={styles.resonanceDesc}>{resonancia.efectoEspecial}</Text>
            </View>
          </View>
        )}

        {/* VISTA 3: TEST DE LAS 10 ÓRDENES RADIANTE */}
        {subTab === 'ordenes' && (
          <View>
            <Text style={styles.secTitle}>TEST DE AFINIDAD DE LOS CABALLEROS RADIANTE</Text>
            <Text style={styles.secSub}>Responde con sinceridad para descubrir con qué esprec tienes vínculo:</Text>

            {ordenGanadora && (
              <View style={[styles.orderResultCard, { borderColor: ORDENES_RADIANTE[ordenGanadora].color }]}>
                <Text style={styles.orderGlifo}>{ORDENES_RADIANTE[ordenGanadora].glifo}</Text>
                <Text style={[styles.orderTitle, { color: ORDENES_RADIANTE[ordenGanadora].color }]}>
                  {ORDENES_RADIANTE[ordenGanadora].nombre.toUpperCase()}
                </Text>
                <Text style={styles.orderLema}>"{ORDENES_RADIANTE[ordenGanadora].lema}"</Text>
                <Text style={styles.orderDesc}>{ORDENES_RADIANTE[ordenGanadora].descripcion}</Text>
                <Text style={styles.orderSpren}>Esprec: {ORDENES_RADIANTE[ordenGanadora].esprec}</Text>
              </View>
            )}

            {PREGUNTAS_ORDEN_RADIANTE.map((p, idx) => (
              <View key={idx} style={styles.questionBox}>
                <Text style={styles.questionTitle}>{idx + 1}. {p.pregunta}</Text>
                {p.opciones.map((op, oIdx) => (
                  <TouchableOpacity
                    key={oIdx}
                    style={[styles.quizOptBtn, respuestasQuiz[idx] === op.orden && styles.quizOptBtnSelected]}
                    onPress={() => responderPreguntaOrden(idx, op.orden)}
                  >
                    <Text style={styles.quizOptText}>{op.texto}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* VISTA 4: GRAFO DE CONEXIONES TROTAMUNDOS */}
        {subTab === 'trotamundos' && (
          <View>
            <Text style={styles.secTitle}>RED DE VIAJESOMBRAS (WORLDHOPPERS)</Text>
            <Text style={styles.secSub}>Agentes que transitan el Reino Cognitivo conectando sistemas:</Text>

            {LISTA_WORLDHOPPERS.map(w => (
              <View key={w.id} style={styles.hopperCard}>
                <Text style={styles.hopperName}>{w.nombre}</Text>
                <Text style={styles.hopperOrg}>Organización: {w.organizacion}</Text>
                <Text style={styles.hopperOrigin}>Origen: <Text style={{ color: '#38bdf8' }}>{w.mundoOrigen}</Text></Text>
                
                <View style={styles.routeBox}>
                  <Text style={styles.routeLabel}>Ruta interplanetaria:</Text>
                  <View style={styles.routePills}>
                    {w.mundosVisitados.map((m, i) => (
                      <Text key={i} style={styles.routePill}>🪐 {m}</Text>
                    ))}
                  </View>
                </View>
                <Text style={styles.hopperDesc}>{w.descripcion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* VISTA 5: DICCIONARIO FONÉTICO */}
        {subTab === 'fonetica' && (
          <View>
            <Text style={styles.secTitle}>GUÍA FONÉTICA CANÓNICA</Text>
            <Text style={styles.secSub}>Pronunciación oficial aprobada por Dragonsteel:</Text>

            {DICCIONARIO_FONETICO.map((t, idx) => (
              <View key={idx} style={styles.phoneticCard}>
                <Text style={styles.termTitle}>{t.termino}</Text>
                <Text style={styles.termIpa}>IPA: {t.ipa}</Text>
                <Text style={styles.termHowTo}>🗣️ Se lee: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{t.foneticaEspanol}</Text></Text>
                <Text style={styles.termMeaning}>{t.significado} ({t.origen})</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  topSelector: { maxHeight: 50, paddingHorizontal: 12, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  tabChip: { paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, justifyContent: 'center' },
  tabChipActive: { borderBottomWidth: 2, borderColor: '#38bdf8' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#38bdf8' },
  content: { padding: 16, paddingBottom: 60 },
  secTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  secSub: { color: '#64748b', fontSize: 11, marginVertical: 6 },
  searchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 13, marginBottom: 12 },
  resultCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultName: { color: '#f8fafc', fontWeight: 'bold', fontSize: 13 },
  resultTag: { color: '#38bdf8', fontSize: 10, fontWeight: '800' },
  resultExtra: { color: '#94a3b8', fontSize: 11 },
  pickerLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold', marginTop: 10, marginBottom: 6 },
  metalScroll: { marginBottom: 10 },
  metalChip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginRight: 6 },
  metalChipActiveA: { backgroundColor: '#1e3a8a', borderColor: '#38bdf8' },
  metalChipActiveF: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  metalChipText: { color: '#f8fafc', fontSize: 11, fontWeight: '600' },
  resonanceCard: { backgroundColor: '#131e36', padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#f59e0b', marginTop: 14 },
  resonanceTitle: { color: '#f59e0b', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  resonanceDesc: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  questionBox: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  questionTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  quizOptBtn: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, marginBottom: 6 },
  quizOptBtnSelected: { backgroundColor: '#0369a1', borderWidth: 1, borderColor: '#38bdf8' },
  quizOptText: { color: '#cbd5e1', fontSize: 11 },
  orderResultCard: { backgroundColor: '#0f172a', padding: 18, borderRadius: 14, borderWidth: 2, alignItems: 'center', marginBottom: 16 },
  orderGlifo: { fontSize: 36, marginBottom: 4 },
  orderTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  orderLema: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginVertical: 4 },
  orderDesc: { color: '#94a3b8', fontSize: 11, textAlign: 'center', lineHeight: 16, marginVertical: 6 },
  orderSpren: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  hopperCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  hopperName: { color: '#f8fafc', fontSize: 15, fontWeight: '900' },
  hopperOrg: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold', marginVertical: 2 },
  hopperOrigin: { color: '#94a3b8', fontSize: 11 },
  routeBox: { marginVertical: 8, backgroundColor: '#090d16', padding: 8, borderRadius: 8 },
  routeLabel: { color: '#64748b', fontSize: 10, marginBottom: 4 },
  routePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  routePill: { backgroundColor: '#1e293b', color: '#cbd5e1', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hopperDesc: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  phoneticCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  termTitle: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  termIpa: { color: '#64748b', fontSize: 10, fontStyle: 'italic', marginVertical: 2 },
  termHowTo: { color: '#cbd5e1', fontSize: 12, marginVertical: 2 },
  termMeaning: { color: '#94a3b8', fontSize: 11, marginTop: 4 }
});