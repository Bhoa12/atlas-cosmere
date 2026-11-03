import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
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
import { useCosmere } from '../context/CosmereContext';

const { width } = Dimensions.get('window');

export const ToolsScreen: React.FC = () => {
  const [subTab, setSubTab] = useState<
    'radar' | 'cronologia' | 'hoidLog' | 'cuaderno' | 'tonos' | 'pasaporte' | 'buscador' | 'twinborn' | 'ordenes' | 'trotamundos' | 'fonetica'
  >('radar');

  const { nombreUsuario, apodoActivo, rangoActual, puntosInvestidura, setApodoActivo, sumarPuntosTestUnico, librosLeidos } = useCosmere();

  // Estados de Radar de Lectura
  const [capituloRadar, setCapituloRadar] = useState(1);
  const radarActual = RADAR_CAPITULOS_CANONICO.find(r => r.capitulo === capituloRadar) || RADAR_CAPITULOS_CANONICO[0];

  // Estados de Cronología
  const [indiceCronologia, setIndiceCronologia] = useState(2);
  const eventoCrono = CRONOLOGIA_COSMERE[indiceCronologia];

  // Estados de Tonos de Roshar
  const [balanceHonor, setBalanceHonor] = useState(50);
  const [balanceOdium, setBalanceOdium] = useState(50);

  // Estados de Buscador y Twinborn
  const [queryBusqueda, setQueryBusqueda] = useState('');
  const todosLosLibrosYMagias = SISTEMAS_COSMERE_COMPLETO.flatMap(s => [
    ...s.libros.map(l => ({ tipo: 'Libro', nombre: l.titulo, extra: `${l.saga} (${s.planeta})` })),
    ...s.sistemasMagicos.map(m => ({ tipo: 'Magia', nombre: m.nombre, extra: `${s.planeta}: ${m.desc}` })),
    ...s.faunaFlora.map(f => ({ tipo: 'Criatura', nombre: f.nombre, extra: `${s.planeta} (${f.tipo})` }))
  ]);
  const resultadosBusqueda = buscarConTolerancia(todosLosLibrosYMagias, item => item.nombre, queryBusqueda, 2);

  const [metalA, setMetalA] = useState('acero');
  const [metalF, setMetalF] = useState('hierro');
  const resonancia = calcularResonancia(metalA, metalF);

  // Estados Test Órdenes
  const [respuestasQuiz, setRespuestasQuiz] = useState<{ [preguntaIdx: number]: string }>({});
  const [ordenGanadora, setOrdenGanadora] = useState<string | null>(null);

  const responderPreguntaOrden = (preguntaIdx: number, orden: string) => {
    const nuevas = { ...respuestasQuiz, [preguntaIdx]: orden };
    setRespuestasQuiz(nuevas);

    if (Object.keys(nuevas).length === PREGUNTAS_ORDEN_RADIANTE.length) {
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
      {/* SELECTOR SUPERIOR DESLIZABLE CON TODAS LAS HERRAMIENTAS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topSelector}>
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
          <Text style={[styles.tabText, subTab === 'cuaderno' && styles.tabTextActive]}>📜 Bocetos Shallan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'tonos' && styles.tabChipActive]} onPress={() => setSubTab('tonos')}>
          <Text style={[styles.tabText, subTab === 'tonos' && styles.tabTextActive]}>🎵 Tonos de Roshar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabChip, subTab === 'pasaporte' && styles.tabChipActive]} onPress={() => setSubTab('pasaporte')}>
          <Text style={[styles.tabText, subTab === 'pasaporte' && styles.tabTextActive]}>🎓 Pasaporte Silverlight</Text>
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
        {/* 1. MODO LECTOR EN VIVO (RADAR CONTEXTUAL) */}
        {subTab === 'radar' && (
          <View>
            <Text style={styles.secTitle}>RADAR DE LECTURA EN VIVO (CERO SPOILERS)</Text>
            <Text style={styles.secSub}>Selecciona tu capítulo actual. La app solo desvela lo presente en esta escena:</Text>

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

              {radarActual.avistamientoHoid && (
                <View style={styles.hoidAlertBox}>
                  <Text style={styles.hoidAlertText}>🕵️ ALERTA DE SAGAZ: {radarActual.avistamientoHoid}</Text>
                </View>
              )}

              <View style={styles.spoilerShieldNote}>
                <Text style={styles.shieldNoteText}>🔒 {radarActual.notaAntiespoiler}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 2. CRONOLOGÍA CÓSMICA DESLIZABLE */}
        {subTab === 'cronologia' && (
          <View>
            <Text style={styles.secTitle}>LÍNEA TEMPORAL MULTIMUNDO DESLIZABLE</Text>
            <Text style={styles.secSub}>Compara qué ocurría en cada planeta en el mismo momento cósmico:</Text>

            <View style={styles.timelineControl}>
              <TouchableOpacity
                disabled={indiceCronologia === 0}
                style={[styles.timelineNavBtn, indiceCronologia === 0 && { opacity: 0.3 }]}
                onPress={() => setIndiceCronologia(indiceCronologia - 1)}
              >
                <Text style={styles.timelineNavText}>◀ Siglo Anterior</Text>
              </TouchableOpacity>
              <Text style={styles.eraIndicator}>{eventoCrono.era}</Text>
              <TouchableOpacity
                disabled={indiceCronologia === CRONOLOGIA_COSMERE.length - 1}
                style={[styles.timelineNavBtn, indiceCronologia === CRONOLOGIA_COSMERE.length - 1 && { opacity: 0.3 }]}
                onPress={() => setIndiceCronologia(indiceCronologia + 1)}
              >
                <Text style={styles.timelineNavText}>Siguiente Era ▶</Text>
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

              <View style={styles.planetEventBox}>
                <Text style={styles.planetEventTitle}>🌌 OTROS MUNDOS & SILVERLIGHT:</Text>
                <Text style={styles.planetEventText}>{eventoCrono.eventoOtrosMundos}</Text>
              </View>
            </View>
          </View>
        )}

        {/* 3. RASTREADOR DE AVISTAMIENTOS DE HOID */}
        {subTab === 'hoidLog' && (
          <View>
            <Text style={styles.secTitle}>RASTREADOR DE SAGAZ (HOID LOGBOOK)</Text>
            <Text style={styles.secSub}>Descubre dónde se escondía Hoid en cada obra leída:</Text>

            {AVISTAMIENTOS_HOID_TOTAL.map((h, i) => {
              const leido = !!librosLeidos[h.libroId];
              return (
                <View key={i} style={[styles.hoidCard, !leido && styles.hoidCardLocked]}>
                  <View style={styles.hoidCardHeader}>
                    <Text style={styles.hoidBookTitle}>{h.tituloLibro}</Text>
                    <Text style={[styles.hoidTag, { color: leido ? '#38bdf8' : '#f43f5e' }]}>
                      {leido ? `Disfraz: ${h.alias}` : '🔒 NO LEÍDO'}
                    </Text>
                  </View>
                  <Text style={styles.hoidChapter}>Capítulo: {h.capitulo}</Text>
                  <Text style={styles.hoidDesc}>
                    {leido ? h.descripcionCanon : 'Debes marcar este libro como leído para desvelar el disfraz y magia usados por Hoid.'}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* 4. CUADERNO ANATÓMICO DE SHALLAN DAVAR */}
        {subTab === 'cuaderno' && (
          <View>
            <Text style={styles.secTitle}>CUADERNO DE CAMPO DE SHALLAN DAVAR</Text>
            <Text style={styles.secSub}>Bocetos anatómicos a carboncillo de la fauna y esprecs de Roshar:</Text>

            {CUADERNO_SHALLAN.map(lamina => (
              <View key={lamina.id} style={styles.parchmentCard}>
                <Text style={styles.parchmentTitle}>{lamina.especie.toUpperCase()}</Text>
                <Text style={styles.parchmentWorld}>Origen: {lamina.mundo}</Text>
                
                <View style={styles.asciiContainer}>
                  <Text style={styles.asciiArt}>{lamina.ilustracionAscii}</Text>
                </View>

                <Text style={styles.parchmentLabel}>Notas anatómicas manuscritas:</Text>
                {lamina.anatomiaNotas.map((n, i) => (
                  <Text key={i} style={styles.parchmentNote}>• {n}</Text>
                ))}

                <Text style={styles.parchmentQuote}>{lamina.citaShallan}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 5. SINTETIZADOR DE RITMOS Y TONOS DE ROSHAR */}
        {subTab === 'tonos' && (
          <View>
            <Text style={styles.secTitle}>SINTETIZADOR DE TONOS PUROS DE INVESTIDURA</Text>
            <Text style={styles.secSub}>Combina las frecuencias de Honor y Odium para sintetizar el Ritmo de la Guerra:</Text>

            <View style={styles.synthCard}>
              <Text style={styles.synthToneName}>Frecuencia de Honor: {balanceHonor}%</Text>
              <View style={styles.synthBarBg}>
                <View style={[styles.synthBarFill, { width: `${balanceHonor}%`, backgroundColor: '#38bdf8' }]} />
              </View>

              <Text style={[styles.synthToneName, { marginTop: 14 }]}>Frecuencia de Odium: {balanceOdium}%</Text>
              <View style={styles.synthBarBg}>
                <View style={[styles.synthBarFill, { width: `${balanceOdium}%`, backgroundColor: '#eab308' }]} />
              </View>

              <View style={styles.synthButtonsRow}>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(80); setBalanceOdium(20); }}>
                  <Text style={styles.synthBtnText}>Tono Puro de Honor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(50); setBalanceOdium(50); }}>
                  <Text style={styles.synthBtnText}>Ritmo de la Guerra (Luz Bélica)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.synthBtn} onPress={() => { setBalanceHonor(10); setBalanceOdium(90); }}>
                  <Text style={styles.synthBtnText}>Tono Puro de Odium</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.resonanceFeedback}>
                <Text style={styles.resonanceFeedbackTitle}>
                  {balanceHonor === 50 && balanceOdium === 50 ? '⚡ RESONANCIA ARMÓNICA: LUZ BÉLICA DETECTADA' : 'Sintonizando acordes de las Esquirlas...'}
                </Text>
                <Text style={styles.resonanceFeedbackText}>
                  Navani Kholin y Raboniel descubrieron que la Investidura vibra según leyes de resonancia acústica fundamental.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 6. PASAPORTE OFICIAL DE SILVERLIGHT (DIPLOMA) */}
        {subTab === 'pasaporte' && (
          <View>
            <Text style={styles.secTitle}>PASAPORTE ESTELAR DE SILVERLIGHT</Text>
            <Text style={styles.secSub}>Documento canónico expedido por la Universidad de Silverlight:</Text>

            <View style={styles.passportDiploma}>
              <Text style={styles.diplomaHeader}>UNIVERSIDAD DE SILVERLIGHT • REINO COGNITIVO</Text>
              <Text style={styles.diplomaSub}>Acreditación Oficial de Conocimiento Cosmérico</Text>

              <View style={styles.diplomaDivider} />

              <Text style={styles.diplomaStudentName}>{nombreUsuario.toUpperCase()}</Text>
              <Text style={styles.diplomaTitle}>"{apodoActivo}"</Text>

              <View style={styles.diplomaStatsRow}>
                <View style={styles.diplomaStatBox}>
                  <Text style={styles.diplomaStatLabel}>RANGO DIVINO</Text>
                  <Text style={styles.diplomaStatValue}>{rangoActual.nombre}</Text>
                </View>
                <View style={styles.diplomaStatBox}>
                  <Text style={styles.diplomaStatLabel}>INVESTIDURA</Text>
                  <Text style={styles.diplomaStatValue}>{puntosInvestidura} Pts</Text>
                </View>
              </View>

              <Text style={styles.diplomaSeal}>📜 SELLADO CANÓNICAMENTE POR:</Text>
              <Text style={styles.diplomaSignatures}>Khrissalla de Taldain & Nazrilof</Text>

              <TouchableOpacity
                style={styles.shareDiplomaBtn}
                onPress={() => Alert.alert('¡Pasaporte Preparado!', 'Tarjeta oficial lista para compartir en historias de Instagram o WhatsApp.')}
              >
                <Text style={styles.shareDiplomaText}>Compartir Pasaporte Oficial</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 7. BUSCADOR DIFUSO */}
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

        {/* 8. CALCULADORA TWINBORN */}
        {subTab === 'twinborn' && (
          <View>
            <Text style={styles.secTitle}>LABORATORIO DE RESONANCIAS METÁLICAS</Text>
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

            <View style={styles.resonanceCard}>
              <Text style={styles.resonanceTitle}>{resonancia.nombreTitulo.toUpperCase()}</Text>
              <Text style={styles.resonanceDesc}>{resonancia.efectoEspecial}</Text>
            </View>
          </View>
        )}

        {/* 9. TEST ÓRDENES RADIANTE */}
        {subTab === 'ordenes' && (
          <View>
            <Text style={styles.secTitle}>TEST DE AFINIDAD DE LOS CABALLEROS RADIANTE</Text>
            {ordenGanadora && (
              <View style={[styles.orderResultCard, { borderColor: ORDENES_RADIANTE[ordenGanadora].color }]}>
                <Text style={styles.orderGlifo}>{ORDENES_RADIANTE[ordenGanadora].glifo}</Text>
                <Text style={[styles.orderTitle, { color: ORDENES_RADIANTE[ordenGanadora].color }]}>
                  {ORDENES_RADIANTE[ordenGanadora].nombre.toUpperCase()}
                </Text>
                <Text style={styles.orderLema}>"{ORDENES_RADIANTE[ordenGanadora].lema}"</Text>
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

        {/* 10. TROTAMUNDOS */}
        {subTab === 'trotamundos' && (
          <View>
            <Text style={styles.secTitle}>RED DE VIAJESOMBRAS (WORLDHOPPERS)</Text>
            {LISTA_WORLDHOPPERS.map(w => (
              <View key={w.id} style={styles.hopperCard}>
                <Text style={styles.hopperName}>{w.nombre}</Text>
                <Text style={styles.hopperOrg}>{w.organizacion}</Text>
                <Text style={styles.hopperDesc}>{w.descripcion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 11. FONÉTICA */}
        {subTab === 'fonetica' && (
          <View>
            <Text style={styles.secTitle}>GUÍA FONÉTICA CANÓNICA</Text>
            {DICCIONARIO_FONETICO.map((t, idx) => (
              <View key={idx} style={styles.phoneticCard}>
                <Text style={styles.termTitle}>{t.termino}</Text>
                <Text style={styles.termHowTo}>🗣️ Se lee: <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{t.foneticaEspanol}</Text></Text>
                <Text style={styles.termMeaning}>{t.significado}</Text>
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
  topSelector: { maxHeight: 52, paddingHorizontal: 10, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  tabChip: { paddingHorizontal: 12, paddingVertical: 10, marginRight: 6, justifyContent: 'center' },
  tabChipActive: { borderBottomWidth: 2, borderColor: '#38bdf8' },
  tabText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#38bdf8' },
  content: { padding: 16, paddingBottom: 60 },
  secTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  secSub: { color: '#64748b', fontSize: 11, marginVertical: 6 },
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
  hoidAlertBox: { backgroundColor: '#2e1065', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#7c3aed', marginTop: 12 },
  hoidAlertText: { color: '#ddd6fe', fontSize: 11, fontWeight: 'bold' },
  spoilerShieldNote: { backgroundColor: '#090d16', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  shieldNoteText: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },
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
  hoidCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hoidBookTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  hoidTag: { fontSize: 11, fontWeight: '800' },
  hoidChapter: { color: '#64748b', fontSize: 10, marginVertical: 3 },
  hoidDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  parchmentCard: { backgroundColor: '#1c1917', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#78350f', marginBottom: 14 },
  parchmentTitle: { color: '#fde047', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  parchmentWorld: { color: '#a8a29e', fontSize: 10, marginBottom: 8 },
  asciiContainer: { backgroundColor: '#0c0a09', padding: 10, borderRadius: 8, alignItems: 'center', marginVertical: 8 },
  asciiArt: { color: '#fde047', fontFamily: 'monospace', fontSize: 10 },
  parchmentLabel: { color: '#d6d3d1', fontSize: 11, fontWeight: 'bold', marginTop: 6, marginBottom: 4 },
  parchmentNote: { color: '#a8a29e', fontSize: 11, lineHeight: 16 },
  parchmentQuote: { color: '#fde047', fontSize: 10, fontStyle: 'italic', marginTop: 10, borderTopWidth: 1, borderColor: '#44403c', paddingTop: 6 },
  synthCard: { backgroundColor: '#0f172a', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', marginVertical: 10 },
  synthToneName: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  synthBarBg: { height: 8, backgroundColor: '#090d16', borderRadius: 4, overflow: 'hidden' },
  synthBarFill: { height: '100%' },
  synthButtonsRow: { flexDirection: 'row', gap: 6, marginVertical: 14 },
  synthBtn: { flex: 1, backgroundColor: '#1e293b', padding: 8, borderRadius: 8, alignItems: 'center' },
  synthBtnText: { color: '#38bdf8', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  resonanceFeedback: { backgroundColor: '#131e36', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#38bdf8' },
  resonanceFeedbackTitle: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  resonanceFeedbackText: { color: '#cbd5e1', fontSize: 10, lineHeight: 15 },
  passportDiploma: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#eab308', alignItems: 'center', marginVertical: 12 },
  diplomaHeader: { color: '#eab308', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  diplomaSub: { color: '#94a3b8', fontSize: 10, textAlign: 'center', marginTop: 2 },
  diplomaDivider: { width: '80%', height: 1, backgroundColor: '#334155', marginVertical: 12 },
  diplomaStudentName: { color: '#f8fafc', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  diplomaTitle: { color: '#38bdf8', fontSize: 13, fontStyle: 'italic', marginVertical: 4 },
  diplomaStatsRow: { flexDirection: 'row', gap: 16, marginVertical: 14 },
  diplomaStatBox: { backgroundColor: '#090d16', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  diplomaStatLabel: { color: '#64748b', fontSize: 9, fontWeight: 'bold' },
  diplomaStatValue: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  diplomaSeal: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold', marginTop: 6 },
  diplomaSignatures: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  shareDiplomaBtn: { backgroundColor: '#eab308', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, marginTop: 16 },
  shareDiplomaText: { color: '#090d16', fontWeight: 'bold', fontSize: 12 },
  searchInput: { backgroundColor: '#0f172a', color: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155', fontSize: 13, marginBottom: 12 },
  resultCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  resultName: { color: '#f8fafc', fontWeight: 'bold', fontSize: 13 },
  resultTag: { color: '#38bdf8', fontSize: 10, fontWeight: '800' },
  resultExtra: { color: '#94a3b8', fontSize: 11 },
  pickerLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  metalScroll: { marginBottom: 8 },
  metalChip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginRight: 6 },
  metalChipActiveA: { backgroundColor: '#1e3a8a', borderColor: '#38bdf8' },
  metalChipActiveF: { backgroundColor: '#78350f', borderColor: '#f59e0b' },
  metalChipText: { color: '#f8fafc', fontSize: 11 },
  resonanceCard: { backgroundColor: '#131e36', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', marginTop: 10 },
  resonanceTitle: { color: '#f59e0b', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  resonanceDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  orderResultCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 2, alignItems: 'center', marginBottom: 12 },
  orderGlifo: { fontSize: 30 },
  orderTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  orderLema: { color: '#cbd5e1', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  questionBox: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  questionTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  quizOptBtn: { backgroundColor: '#1e293b', padding: 8, borderRadius: 6, marginBottom: 6 },
  quizOptBtnSelected: { backgroundColor: '#0369a1' },
  quizOptText: { color: '#cbd5e1', fontSize: 11 },
  hopperCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10 },
  hopperName: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  hopperOrg: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold', marginVertical: 2 },
  hopperDesc: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  phoneticCard: { backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8 },
  termTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  termHowTo: { color: '#cbd5e1', fontSize: 11, marginVertical: 2 },
  termMeaning: { color: '#94a3b8', fontSize: 10 }
});