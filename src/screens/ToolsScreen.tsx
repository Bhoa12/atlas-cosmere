import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { buscarConTolerancia } from '../utils/fuzzySearch';
import { ORDENES_RADIANTE, PREGUNTAS_ORDEN_RADIANTE } from '../data/radiantQuiz';
import { METALES_COSMERE, calcularResonancia } from '../data/twinbornData';
import { LISTA_WORLDHOPPERS } from '../data/worldhoppers';
import { DICCIONARIO_FONETICO } from '../data/phonetics';
import { RADAR_CAPITULOS_CANONICO } from '../data/companionData';
import { CRONOLOGIA_COSMERE } from '../data/timelineData';
import { AVISTAMIENTOS_HOID_TOTAL } from '../data/hoidSightings';
import { CUADERNO_SHALLAN } from '../data/sketchbookData';
import { UBICACIONES_SHADESMAR, ESENCIAS_MOLDEAR_ALMAS } from '../data/shadesmarData';
import { evaluarTeoriaMagica, EvaluacionContinuidad } from '../data/continuityEngine';
import { useCosmere } from '../context/CosmereContext';

export const ToolsScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<
    'shadesmar' | 'validador' | 'radar' | 'cronologia' | 'hoidLog' | 'cuaderno' | 'tonos' | 'pasaporte' | 'buscador' | 'twinborn' | 'ordenes' | 'trotamundos' | 'fonetica'
  >('shadesmar');

  const { nombreUsuario, apodoActivo, rangoActual, puntosInvestidura, setApodoActivo, sumarPuntosTestUnico, librosLeidos, reinoCognitivoActivo } = useCosmere();

  // Estados Validador
  const [teoriaInput, setTeoriaInput] = useState('');
  const [evaluacion, setEvaluacion] = useState<EvaluacionContinuidad | null>(null);

  // Estados Radar
  const [capituloRadar, setCapituloRadar] = useState(1);
  const radarActual = RADAR_CAPITULOS_CANONICO.find(r => r.capitulo === capituloRadar) || RADAR_CAPITULOS_CANONICO[0];

  // Estados Cronología
  const [indiceCronologia, setIndiceCronologia] = useState(2);
  const eventoCrono = CRONOLOGIA_COSMERE[indiceCronologia];

  // Estados Tonos
  const [balanceHonor, setBalanceHonor] = useState(50);
  const [balanceOdium, setBalanceOdium] = useState(50);

  // Estados Buscador
  const [queryBusqueda, setQueryBusqueda] = useState('');
  const todosLosLibrosYMagias = SISTEMAS_COSMERE_COMPLETO.flatMap(s => [
    ...s.libros.map(l => ({ tipo: 'Libro', nombre: l.titulo, extra: `${l.saga} (${s.planeta})` })),
    ...s.sistemasMagicos.map(m => ({ tipo: 'Magia', nombre: m.nombre, extra: `${s.planeta}: ${m.desc}` })),
    ...s.faunaFlora.map(f => ({ tipo: 'Criatura', nombre: f.nombre, extra: `${s.planeta} (${f.tipo})` }))
  ]);
  const resultadosBusqueda = buscarConTolerancia(todosLosLibrosYMagias, item => item.nombre, queryBusqueda, 2);

  // Estados Twinborn
  const [metalA, setMetalA] = useState('acero');
  const [metalF, setMetalF] = useState('hierro');
  const resonancia = calcularResonancia(metalA, metalF);

  // Estados Quiz Órdenes
  const [respuestasQuiz, setRespuestasQuiz] = useState<{ [preguntaIdx: number]: string }>({});
  const [ordenGanadora, setOrdenGanadora] = useState<string | null>(null);
  const testRadianteCompletadoRef = useRef(false);

  const ejecutarValidacion = () => {
    if (!teoriaInput.trim()) return;
    const res = evaluarTeoriaMagica(teoriaInput.trim());
    setEvaluacion(res);
  };

  const responderPreguntaOrden = (preguntaIdx: number, orden: string) => {
    if (testRadianteCompletadoRef.current) return;
    const nuevas = { ...respuestasQuiz, [preguntaIdx]: orden };
    setRespuestasQuiz(nuevas);

    if (Object.keys(nuevas).length >= PREGUNTAS_ORDEN_RADIANTE.length) {
      testRadianteCompletadoRef.current = true;
      const conteo: { [orden: string]: number } = {};
      Object.values(nuevas).forEach(o => { conteo[o] = (conteo[o] || 0) + 1; });
      const ganadora = Object.keys(conteo).reduce((a, b) => conteo[a] > conteo[b] ? a : b);
      const orden = ORDENES_RADIANTE[ganadora];
      if (!orden) {
        testRadianteCompletadoRef.current = false;
        return;
      }
      setOrdenGanadora(ganadora);
      setApodoActivo(orden.nombre);
      const puntosConcedidos = sumarPuntosTestUnico('radiant_affinity', 300);
      Alert.alert('¡Juramento Pronunciado!', `Has sido aceptado entre los ${orden.nombre}. ${puntosConcedidos ? 'Has ganado 300 puntos de Investidura.' : 'Este test ya estaba recompensado.'} Título equipado en tu perfil.`);
    }
  };

  const bgStyle = reinoCognitivoActivo ? styles.darkShadesmarContainer : styles.container;

  return (
    <View style={bgStyle}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topSelector}>
        <TouchableOpacity style={[styles.tabChip, subTab === 'shadesmar' && styles.tabChipActive]} onPress={() => setSubTab('shadesmar')}>
          <Text style={[styles.tabText, subTab === 'shadesmar' && styles.tabTextActive]}>🔮 Shadesmar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'validador' && styles.tabChipActive]} onPress={() => setSubTab('validador')}>
          <Text style={[styles.tabText, subTab === 'validador' && styles.tabTextActive]}>⚖️ Validador</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'radar' && styles.tabChipActive]} onPress={() => setSubTab('radar')}>
          <Text style={[styles.tabText, subTab === 'radar' && styles.tabTextActive]}>🧭 Lector en Vivo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'cronologia' && styles.tabChipActive]} onPress={() => setSubTab('cronologia')}>
          <Text style={[styles.tabText, subTab === 'cronologia' && styles.tabTextActive]}>⏳ Cronología</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'hoidLog' && styles.tabChipActive]} onPress={() => setSubTab('hoidLog')}>
          <Text style={[styles.tabText, subTab === 'hoidLog' && styles.tabTextActive]}>🕵️ Rastreador Hoid</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'cuaderno' && styles.tabChipActive]} onPress={() => setSubTab('cuaderno')}>
          <Text style={[styles.tabText, subTab === 'cuaderno' && styles.tabTextActive]}>📜 Bocetos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'tonos' && styles.tabChipActive]} onPress={() => setSubTab('tonos')}>
          <Text style={[styles.tabText, subTab === 'tonos' && styles.tabTextActive]}>🎵 Tonos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'pasaporte' && styles.tabChipActive]} onPress={() => setSubTab('pasaporte')}>
          <Text style={[styles.tabText, subTab === 'pasaporte' && styles.tabTextActive]}>🎓 Pasaporte</Text>
        </TouchableOpacity>
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
        {/* HERRAMIENTA 1: EXPLORADOR DE SHADESMAR Y CUENTAS */}
        {subTab === 'shadesmar' && (
          <View>
            <Text style={styles.secTitle}>MAPA INVERSO DE SHADESMAR (REINO COGNITIVO)</Text>
            <Text style={styles.secSub}>En este plano, los continentes son mares de cuentas de cristal y los océanos son roca sólida:</Text>

            {UBICACIONES_SHADESMAR.map(u => (
              <View key={u.id} style={styles.shadesmarCard}>
                <Text style={styles.shadesmarName}>{u.nombre.toUpperCase()}</Text>
                <Text style={styles.shadesmarEquiv}>Equivalente físico: {u.equivalenteFisico}</Text>
                <Text style={styles.shadesmarType}>Terreno: {u.tipoTerreno}</Text>
                <Text style={styles.shadesmarDesc}>{u.descripcion}</Text>
                <View style={styles.dangerBox}>
                  <Text style={styles.dangerText}>⚠️ Amenaza: {u.peligro}</Text>
                </View>
              </View>
            ))}

            <Text style={[styles.secTitle, { marginTop: 14 }]}>MOLDEAR ALMAS: NEGOCIACIÓN CON ESENCIAS</Text>
            {ESENCIAS_MOLDEAR_ALMAS.map((e, idx) => (
              <View key={idx} style={styles.soulcastCard}>
                <Text style={styles.soulcastMaterial}>{e.material.toUpperCase()}</Text>
                <Text style={styles.soulcastDiff}>Dificultad de Persuasión: {e.dificultadPersuasion}</Text>
                <Text style={styles.soulcastQuote}>{e.argumentoCanonica}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HERRAMIENTA 2: MOTOR HEURÍSTICO DE CONTINUIDAD */}
        {subTab === 'validador' && (
          <View>
            <Text style={styles.secTitle}>ANALIZADOR ORIENTATIVO DE CONTINUIDAD</Text>
            <Text style={styles.secSub}>Herramienta orientativa basada en reglas simplificadas; no es una validación oficial ni sustituye las fuentes canónicas. Introduce una hipótesis o mezcla mágica para analizar su coherencia:</Text>

            <TextInput
              style={styles.theoryInput}
              placeholder="Ej: ¿Puede un Radiante usar clavos hemalúrgicos para robar alomancia sin perder su spren?"
              placeholderTextColor="#64748b"
              value={teoriaInput}
              onChangeText={setTeoriaInput}
              multiline
            />
            <TouchableOpacity style={styles.validateBtn} onPress={ejecutarValidacion}>
              <Text style={styles.validateBtnText}>Auditar Teoría con las Leyes de Sanderson</Text>
            </TouchableOpacity>

            {evaluacion && (
              <View style={styles.evalCard}>
                <View style={styles.evalScoreRow}>
                  <Text style={styles.evalPercent}>{evaluacion.viabilidadPorcentaje}%</Text>
                  <Text style={styles.evalVerdict}>{evaluacion.veredicto}</Text>
                </View>
                <View style={styles.lawBox}>
                  <Text style={styles.lawTitle}>1ª Ley de Sanderson:</Text>
                  <Text style={styles.lawText}>{evaluacion.primeraLey}</Text>
                </View>
                <View style={styles.lawBox}>
                  <Text style={styles.lawTitle}>2ª Ley (Límites y Costes):</Text>
                  <Text style={styles.lawText}>{evaluacion.segundaLey}</Text>
                </View>
                <View style={styles.lawBox}>
                  <Text style={styles.lawTitle}>3ª Ley (Extrapolación Lógica):</Text>
                  <Text style={styles.lawText}>{evaluacion.terceraLey}</Text>
                </View>
                <View style={styles.lawBox}>
                  <Text style={styles.lawTitle}>Identidad & Resistencia Espiritual:</Text>
                  <Text style={styles.lawText}>{evaluacion.analisisEspiritual}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* HERRAMIENTA 3: LECTOR EN VIVO */}
        {subTab === 'radar' && (
          <View>
            <Text style={styles.secTitle}>RADAR DE LECTURA EN VIVO (CERO SPOILERS)</Text>
            <View style={styles.chapterButtonsRow}>
              {[1, 6, 19].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[styles.capButton, capituloRadar === num && styles.capButtonActive]}
                  onPress={() => setCapituloRadar(num)}
                >
                  <Text style={[styles.capButtonText, capituloRadar === num && styles.capButtonTextActive]}>
                    Capítulo {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.radarCard}>
              <Text style={styles.radarSceneTitle}>{radarActual.tituloEscena.toUpperCase()}</Text>
              <Text style={styles.radarLocation}>📍 Ubicación: <Text style={{ color: '#38bdf8' }}>{radarActual.ubicacion}</Text></Text>
              <Text style={styles.radarLabel}>Personajes en escena:</Text>
              <View style={styles.tagWrap}>
                {radarActual.personajesPresentes.map((p, i) => (
                  <Text key={i} style={styles.characterTag}>👤 {p}</Text>
                ))}
              </View>
              <Text style={styles.radarLabel}>Manifestación de Magia:</Text>
              <View style={styles.tagWrap}>
                {radarActual.magiasEnUso.map((m, i) => (
                  <Text key={i} style={styles.magicTag}>⚡ {m}</Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* HERRAMIENTA 4: CRONOLOGÍA */}
        {subTab === 'cronologia' && (
          <View>
            <Text style={styles.secTitle}>LÍNEA TEMPORAL MULTIMUNDO DESLIZABLE</Text>
            <View style={styles.timelineControl}>
              <TouchableOpacity
                disabled={indiceCronologia === 0}
                style={[styles.timelineNavBtn, indiceCronologia === 0 && { opacity: 0.3 }]}
                onPress={() => setIndiceCronologia(indiceCronologia - 1)}
              >
                <Text style={styles.timelineNavText}>◀ Anterior</Text>
              </TouchableOpacity>
              <Text style={styles.eraIndicator}>{eventoCrono.era}</Text>
              <TouchableOpacity
                disabled={indiceCronologia === CRONOLOGIA_COSMERE.length - 1}
                style={[styles.timelineNavBtn, indiceCronologia === CRONOLOGIA_COSMERE.length - 1 && { opacity: 0.3 }]}
                onPress={() => setIndiceCronologia(indiceCronologia + 1)}
              >
                <Text style={styles.timelineNavText}>Siguiente ▶</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.timelineYear}>{eventoCrono.anoAproximado}</Text>
              <Text style={styles.timelineShard}>Esquirlas: {eventoCrono.esquirlaRelevante}</Text>
              <View style={styles.planetEventBox}>
                <Text style={styles.planetEventTitle}>🪐 ROSHAR:</Text>
                <Text style={styles.planetEventText}>{eventoCrono.eventoRoshar}</Text>
              </View>
              <View style={styles.planetEventBox}>
                <Text style={styles.planetEventTitle}>🪐 SCADRIAL:</Text>
                <Text style={styles.planetEventText}>{eventoCrono.eventoScadrial}</Text>
              </View>
            </View>
          </View>
        )}

        {/* HERRAMIENTA 5: RASTREADOR HOID */}
        {subTab === 'hoidLog' && (
          <View>
            <Text style={styles.secTitle}>RASTREADOR DE SAGAZ (HOID LOGBOOK)</Text>
            {AVISTAMIENTOS_HOID_TOTAL.map((h, i) => {
              const leido = !!librosLeidos[h.libroId];
              return (
                <View key={i} style={[styles.hoidCard, !leido && styles.hoidCardLocked]}>
                  <Text style={styles.hoidBookTitle}>{h.tituloLibro}</Text>
                  <Text style={styles.hoidChapter}>Capítulo: {h.capitulo} • Disfraz: {leido ? h.alias : '🔒 Oculto'}</Text>
                  <Text style={styles.hoidDesc}>{leido ? h.descripcionCanon : 'Marca este libro como leído para revelar el informe de Hoid.'}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* HERRAMIENTA 6: CUADERNO SHALLAN */}
        {subTab === 'cuaderno' && (
          <View>
            <Text style={styles.secTitle}>CUADERNO DE CAMPO DE SHALLAN DAVAR</Text>
            {CUADERNO_SHALLAN.map(l => (
              <View key={l.id} style={styles.parchmentCard}>
                <Text style={styles.parchmentTitle}>{l.especie.toUpperCase()}</Text>
                <View style={styles.asciiContainer}><Text style={styles.asciiArt}>{l.ilustracionAscii}</Text></View>
                {l.anatomiaNotas.map((n, i) => (<Text key={i} style={styles.parchmentNote}>• {n}</Text>))}
                <Text style={styles.parchmentQuote}>{l.citaShallan}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HERRAMIENTA 7: TONOS */}
        {subTab === 'tonos' && (
          <View>
            <Text style={styles.secTitle}>SINTETIZADOR DE TONOS PUROS DE INVESTIDURA</Text>
            <View style={styles.synthCard}>
              <Text style={styles.synthToneName}>Honor: {balanceHonor}% | Odium: {balanceOdium}%</Text>
              <View style={styles.synthButtonsRow}>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(80); setBalanceOdium(20); }}>
                  <Text style={styles.synthBtnText}>Honor Puro</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(50); setBalanceOdium(50); }}>
                  <Text style={styles.synthBtnText}>Ritmo de la Guerra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(20); setBalanceOdium(80); }}>
                  <Text style={styles.synthBtnText}>Odium Puro</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* HERRAMIENTA 8: PASAPORTE */}
        {subTab === 'pasaporte' && (
          <View style={styles.passportDiploma}>
            <Text style={styles.diplomaHeader}>UNIVERSIDAD DE SILVERLIGHT</Text>
            <Text style={styles.diplomaStudentName}>{nombreUsuario.toUpperCase()}</Text>
            <Text style={styles.diplomaTitle}>"{apodoActivo}"</Text>
            <Text style={styles.diplomaStatValue}>{rangoActual.nombre} • {puntosInvestidura} Pts</Text>
            <TouchableOpacity style={styles.shareDiplomaBtn} onPress={() => Alert.alert('¡Pasaporte!', 'Acreditación oficial lista para compartir.')}>
              <Text style={styles.shareDiplomaText}>Exportar Pasaporte Oficial</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HERRAMIENTA 9: BUSCADOR */}
        {subTab === 'buscador' && (
          <View>
            <Text style={styles.secTitle}>BÚSQUEDA TOLERANTE A ERRATAS</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar libros, criaturas, magias..."
              placeholderTextColor="#64748b"
              value={queryBusqueda}
              onChangeText={setQueryBusqueda}
            />
            {resultadosBusqueda.slice(0, 6).map((r, i) => (
              <View key={i} style={styles.resultCard}>
                <Text style={styles.resultName}>{r.nombre}</Text>
                <Text style={styles.resultExtra}>{r.extra}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HERRAMIENTA 10: TWINBORN */}
        {subTab === 'twinborn' && (
          <View>
            <Text style={styles.secTitle}>RESONANCIAS METÁLICAS (NACIDOS DOBLES)</Text>
            <View style={styles.resonanceCard}>
              <Text style={styles.resonanceTitle}>{resonancia.nombreTitulo.toUpperCase()}</Text>
              <Text style={styles.resonanceDesc}>{resonancia.efectoEspecial}</Text>
            </View>
          </View>
        )}

        {/* HERRAMIENTA 11: TEST RADIANTE */}
        {subTab === 'ordenes' && (
          <View>
            <Text style={styles.secTitle}>TEST DE AFINIDAD DE CABALLEROS RADIANTE</Text>
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

        {/* HERRAMIENTA 12: TROTAMUNDOS */}
        {subTab === 'trotamundos' && (
          <View>
            <Text style={styles.secTitle}>RED DE VIAJESOMBRAS (WORLDHOPPERS)</Text>
            {LISTA_WORLDHOPPERS.map(w => (
              <View key={w.id} style={styles.hopperCard}>
                <Text style={styles.hopperName}>{w.nombre}</Text>
                <Text style={styles.hopperDesc}>{w.descripcion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* HERRAMIENTA 13: FONÉTICA */}
        {subTab === 'fonetica' && (
          <View>
            <Text style={styles.secTitle}>GUÍA FONÉTICA CANÓNICA</Text>
            {DICCIONARIO_FONETICO.map((t, idx) => (
              <View key={idx} style={styles.phoneticCard}>
                <Text style={styles.termTitle}>{t.termino}</Text>
                <Text style={styles.termHowTo}>🗣️ Se lee: {t.foneticaEspanol}</Text>
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
  darkShadesmarContainer: { flex: 1, backgroundColor: '#030712' },
  topSelector: { maxHeight: 52, paddingHorizontal: 10, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  tabChip: { paddingHorizontal: 12, paddingVertical: 10, marginRight: 6, justifyContent: 'center' },
  tabChipActive: { borderBottomWidth: 2, borderColor: '#38bdf8' },
  tabText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#38bdf8' },
  content: { padding: 16, paddingBottom: 60 },
  secTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  secSub: { color: '#64748b', fontSize: 11, marginVertical: 6 },
  shadesmarCard: { backgroundColor: '#090d16', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed', marginBottom: 12 },
  shadesmarName: { color: '#a855f7', fontSize: 14, fontWeight: '900' },
  shadesmarEquiv: { color: '#cbd5e1', fontSize: 11, marginVertical: 2 },
  shadesmarType: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },
  shadesmarDesc: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginTop: 6 },
  dangerBox: { backgroundColor: '#2e1065', padding: 8, borderRadius: 6, marginTop: 8 },
  dangerText: { color: '#f43f5e', fontSize: 10, fontWeight: 'bold' },
  soulcastCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  soulcastMaterial: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  soulcastDiff: { color: '#94a3b8', fontSize: 10 },
  soulcastQuote: { color: '#fde047', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  theoryInput: { backgroundColor: '#0f172a', color: '#fff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', fontSize: 12, minHeight: 70, textAlignVertical: 'top' },
  validateBtn: { backgroundColor: '#4f46e5', padding: 12, borderRadius: 10, alignItems: 'center', marginVertical: 10 },
  validateBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  evalCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#10b981', marginTop: 10 },
  evalScoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  evalPercent: { color: '#34d399', fontSize: 24, fontWeight: '900' },
  evalVerdict: { color: '#f8fafc', fontSize: 11, fontWeight: 'bold', flex: 1, textAlign: 'right' },
  lawBox: { backgroundColor: '#090d16', padding: 10, borderRadius: 8, marginBottom: 8 },
  lawTitle: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  lawText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  chapterButtonsRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  capButton: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  capButtonActive: { backgroundColor: '#0284c7' },
  capButtonText: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  capButtonTextActive: { color: '#ffffff' },
  radarCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#0284c7', marginVertical: 8 },
  radarSceneTitle: { color: '#38bdf8', fontSize: 14, fontWeight: '900', marginBottom: 6 },
  radarLocation: { color: '#cbd5e1', fontSize: 12, marginBottom: 10 },
  radarLabel: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  characterTag: { backgroundColor: '#1e293b', color: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11 },
  magicTag: { backgroundColor: '#311042', color: '#e879f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontSize: 11 },
  timelineControl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 10, borderRadius: 10, marginVertical: 10 },
  timelineNavBtn: { padding: 6 },
  timelineNavText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  eraIndicator: { color: '#f8fafc', fontSize: 12, fontWeight: '900' },
  timelineCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b' },
  timelineYear: { color: '#f59e0b', fontSize: 15, fontWeight: '900' },
  timelineShard: { color: '#818cf8', fontSize: 11, marginBottom: 12 },
  planetEventBox: { backgroundColor: '#090d16', padding: 10, borderRadius: 8, marginBottom: 8 },
  planetEventTitle: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  planetEventText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  hoidCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  hoidCardLocked: { opacity: 0.6, borderColor: '#450a0a' },
  hoidBookTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  hoidChapter: { color: '#64748b', fontSize: 10, marginVertical: 3 },
  hoidDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  parchmentCard: { backgroundColor: '#1c1917', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#78350f', marginBottom: 14 },
  parchmentTitle: { color: '#fde047', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  asciiContainer: { backgroundColor: '#0c0a09', padding: 10, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  asciiArt: { color: '#fde047', fontFamily: 'monospace', fontSize: 10 },
  parchmentNote: { color: '#a8a29e', fontSize: 11, lineHeight: 16 },
  parchmentQuote: { color: '#fde047', fontSize: 10, fontStyle: 'italic', marginTop: 10, borderTopWidth: 1, borderColor: '#44403c', paddingTop: 6 },
  synthCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', marginVertical: 10 },
  synthToneName: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  synthButtonsRow: { flexDirection: 'row', gap: 6, marginVertical: 14 },
  synthBtn: { flex: 1, backgroundColor: '#1e293b', padding: 8, borderRadius: 8, alignItems: 'center' },
  synthBtnText: { color: '#38bdf8', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  passportDiploma: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#eab308', alignItems: 'center', marginVertical: 12 },
  diplomaHeader: { color: '#eab308', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  diplomaStudentName: { color: '#f8fafc', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  diplomaTitle: { color: '#38bdf8', fontSize: 13, fontStyle: 'italic', marginVertical: 4 },
  diplomaStatValue: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  shareDiplomaBtn: { backgroundColor: '#eab308', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, marginTop: 16 },
  shareDiplomaText: { color: '#090d16', fontWeight: 'bold', fontSize: 12 },
  searchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 13, marginBottom: 12 },
  resultCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  resultName: { color: '#f8fafc', fontWeight: 'bold', fontSize: 13 },
  resultExtra: { color: '#94a3b8', fontSize: 11 },
  resonanceCard: { backgroundColor: '#131e36', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', marginTop: 10 },
  resonanceTitle: { color: '#f59e0b', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  resonanceDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  questionBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  questionTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  quizOptBtn: { backgroundColor: '#1e293b', padding: 8, borderRadius: 6, marginBottom: 6 },
  quizOptBtnSelected: { backgroundColor: '#0369a1' },
  quizOptText: { color: '#cbd5e1', fontSize: 11 },
  hopperCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  hopperName: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  hopperDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  phoneticCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  termTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  termHowTo: { color: '#cbd5e1', fontSize: 11, marginVertical: 2 }
});