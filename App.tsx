import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  Dimensions 
} from 'react-native';

const { width } = Dimensions.get('window');

// Simulación de Base de Datos Canónica (Se conectará a Supabase)
const SISTEMAS_COSMERE = [
  {
    id: 'roshar',
    nombre: 'Sistema Rosharano',
    planeta: 'Roshar',
    esquirlas: ['Honor', 'Cultivación', 'Odium'],
    colorAura: '#38bdf8', // Luz tormentosa
    descripcion: 'Mundo rocoso asolado por las Altas Tormentas. Origen del cremacio y los esprecs.',
    magia: 'Potenciación & Vínculos Nahel',
    libros: [
      { id: 'twok', titulo: 'El Camino de los Reyes', saga: 'Archivo 1', leido: true },
      { id: 'wor', titulo: 'Palabras Radiantes', saga: 'Archivo 2', leido: false },
      { id: 'o', titulo: 'Juramentada', saga: 'Archivo 3', leido: false },
    ],
    secretosDesbloqueados: [
      'Fauna: Chulls, Abismoides y Esprecs comunes.',
      'Fenómeno: Ciclo regular de la Alta Tormenta y acumulación de gemas infusas.',
    ],
    secretoBloqueado: 'Requiere leer: "Palabras Radiantes" para desbloquear las Órdenes de los Caballeros Radiantes.'
  },
  {
    id: 'scadrial',
    nombre: 'Sistema Scadriano',
    planeta: 'Scadrial',
    esquirlas: ['Conservación', 'Ruina'],
    colorAura: '#f59e0b', // Oro/Metálico
    descripcion: 'Mundo cubierto de ceniza y protegido por las Brumas ancestrales.',
    magia: 'Artes Metálicas (Alomancia, Feruquimia, Hemalurgia)',
    libros: [
      { id: 'tfe', titulo: 'El Imperio Final', saga: 'Nacidos de la Bruma 1', leido: true },
      { id: 'woa', titulo: 'El Pozo de la Ascensión', saga: 'Nacidos de la Bruma 2', leido: true },
      { id: 'hoa', titulo: 'El Héroe de las Eras', saga: 'Nacidos de la Bruma 3', leido: false },
    ],
    secretosDesbloqueados: [
      'Fauna: Mistwraiths (Espectros de la Bruma).',
      'Metales Básicos: Los 8 metales alománticos estándar descubiertos.',
    ],
    secretoBloqueado: 'Requiere leer: "El Héroe de las Eras" para desbloquear la naturaleza del Atium.'
  }
];

export default function App() {
  const [sistemaActivo, setSistemaActivo] = useState(SISTEMAS_COSMERE[0]);
  const [progreso, setProgreso] = useState(SISTEMAS_COSMERE);

  // Alternar estado de lectura de un libro
  const toggleLibro = (sistemaId: string, libroId: string) => {
    const nuevosSistemas = progreso.map(sis => {
      if (sis.id === sistemaId) {
        const nuevosLibros = sis.libros.map(lib => {
          if (lib.id === libroId) return { ...lib, leido: !lib.leido };
          return lib;
        });
        return { ...sis, libros: nuevosLibros };
      }
      return sis;
    });
    setProgreso(nuevosSistemas);
    const activoActualizado = nuevosSistemas.find(s => s.id === sistemaActivo.id);
    if (activoActualizado) setSistemaActivo(activoActualizado);
  };

  const totalLeidos = progreso.reduce((acc, sis) => 
    acc + sis.libros.filter(l => l.leido).length, 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* CABECERA: TÍTULO Y RANGO DEL COSMERE */}
      <View style={styles.header}>
        <Text style={styles.brandSubtitle}>TERMINAL DE SILVERLIGHT</Text>
        <Text style={styles.brandTitle}>ATLAS DEL COSMERE</Text>
        
        {/* Barra de progreso global */}
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>Rango Actual: <Text style={styles.rankHighlight}>Ojo de Estaño (Tier II)</Text></Text>
          <Text style={styles.statsText}>{totalLeidos} / 6 Libros Leídos</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* SELECTOR DE PLANETAS */}
        <Text style={styles.sectionTitle}>SISTEMAS PLANETARIOS</Text>
        <View style={styles.planetSelector}>
          {progreso.map(sistema => (
            <TouchableOpacity 
              key={sistema.id} 
              onPress={() => setSistemaActivo(sistema)}
              style={[
                styles.planetButton, 
                sistemaActivo.id === sistema.id && { borderColor: sistema.colorAura, backgroundColor: '#1e293b' }
              ]}
            >
              <View style={[styles.planetSphere, { backgroundColor: sistema.colorAura }]} />
              <Text style={styles.planetName}>{sistema.planeta}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* VISUALIZADOR PLANETARIO CENTRAL */}
        <View style={[styles.visualizerCard, { borderColor: sistemaActivo.colorAura }]}>
          <Text style={[styles.planetTitleBig, { color: sistemaActivo.colorAura }]}>
            {sistemaActivo.planeta.toUpperCase()}
          </Text>
          <Text style={styles.systemSubtitle}>{sistemaActivo.nombre}</Text>

          {/* Representación visual de la Esfera Planetaria con Aura */}
          <View style={styles.planetOrbitContainer}>
            <View style={[styles.outerGlow, { shadowColor: sistemaActivo.colorAura }]}>
              <View style={[styles.planetCore, { backgroundColor: sistemaActivo.colorAura }]}>
                <Text style={styles.planetCoreText}>3D VIEW</Text>
              </View>
            </View>
          </View>

          <Text style={styles.descriptionText}>{sistemaActivo.descripcion}</Text>
          
          <View style={styles.badgeRow}>
            <Text style={styles.badgeLabel}>Esquirlas:</Text>
            {sistemaActivo.esquirlas.map(e => (
              <View key={e} style={styles.badge}>
                <Text style={styles.badgeText}>{e}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CONTROL DE LECTURA Y DESBLOQUEO */}
        <View style={styles.codexSection}>
          <Text style={styles.sectionTitle}>PROGRESO EN ESTE MUNDO (ANTIESPOILER)</Text>
          <Text style={styles.helperText}>Toca un libro para marcarlo como leído y desbloquear su Códice:</Text>
          
          {sistemaActivo.libros.map(libro => (
            <TouchableOpacity 
              key={libro.id}
              style={[styles.bookCard, libro.leido && styles.bookCardRead]}
              onPress={() => toggleLibro(sistemaActivo.id, libro.id)}
            >
              <Text style={styles.bookTitle}>{libro.titulo}</Text>
              <Text style={[styles.bookStatus, { color: libro.leido ? '#4ade80' : '#94a3b8' }]}>
                {libro.leido ? '✓ LEÍDO' : '○ PENDIENTE'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CÓDICE DESBLOQUEADO (FAUNA, FLORA, MAGIA) */}
        <View style={styles.codexSection}>
          <Text style={styles.sectionTitle}>CÓDICE DE {sistemaActivo.planeta.toUpperCase()}</Text>
          
          {sistemaActivo.secretosDesbloqueados.map((sec, idx) => (
            <View key={idx} style={styles.secretCard}>
              <Text style={styles.secretUnlockedTag}>DESBLOQUEADO POR TU LECTURA</Text>
              <Text style={styles.secretText}>{sec}</Text>
            </View>
          ))}

          {/* ELEMENTO BLOQUEADO POR SPOILER */}
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>🔒 CONTENIDO CLASIFICADO</Text>
            <Text style={styles.lockedText}>{sistemaActivo.secretoBloqueado}</Text>
          </View>
        </View>

        {/* BOTÓN ASISTENTE HOID */}
        <TouchableOpacity style={styles.hoidButton}>
          <Text style={styles.hoidButtonText}>✨ Consultar a Sagaz (Hoid IA)</Text>
          <Text style={styles.hoidSubtext}>Solo responderá sobre lo que has marcado como leído</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  header: { padding: 20, borderBottomWidth: 1, borderColor: '#1e293b' },
  brandSubtitle: { color: '#64748b', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  brandTitle: { color: '#f8fafc', fontSize: 24, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  rankContainer: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rankText: { color: '#94a3b8', fontSize: 12 },
  rankHighlight: { color: '#38bdf8', fontWeight: 'bold' },
  statsText: { color: '#64748b', fontSize: 12 },
  scroll: { padding: 16, paddingBottom: 60 },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 16, marginBottom: 12 },
  planetSelector: { flexDirection: 'row', marginBottom: 16 },
  planetButton: { flex: 1, padding: 12, backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', marginRight: 8, alignItems: 'center' },
  planetSphere: { width: 14, height: 14, borderRadius: 7, marginBottom: 6 },
  planetName: { color: '#f8fafc', fontWeight: '700', fontSize: 13 },
  visualizerCard: { backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 20 },
  planetTitleBig: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  systemSubtitle: { color: '#64748b', fontSize: 13, marginTop: 2, marginBottom: 16 },
  planetOrbitContainer: { height: 140, justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  outerGlow: { width: 110, height: 110, borderRadius: 55, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 25, elevation: 15, justifyContent: 'center', alignItems: 'center' },
  planetCore: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' },
  planetCoreText: { color: '#090d16', fontSize: 10, fontWeight: '900', opacity: 0.7 },
  descriptionText: { color: '#cbd5e1', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, flexWrap: 'wrap' },
  badgeLabel: { color: '#64748b', fontSize: 12, marginRight: 8 },
  badge: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 6 },
  badgeText: { color: '#e2e8f0', fontSize: 11, fontWeight: '600' },
  codexSection: { marginTop: 10 },
  helperText: { color: '#64748b', fontSize: 12, marginBottom: 10 },
  bookCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 14, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  bookCardRead: { borderColor: '#10b981', backgroundColor: '#06281e' },
  bookTitle: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  bookStatus: { fontSize: 12, fontWeight: '800' },
  secretCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#38bdf8' },
  secretUnlockedTag: { color: '#38bdf8', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  secretText: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  lockedCard: { backgroundColor: '#111827', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#374151', borderStyle: 'dashed' },
  lockedTitle: { color: '#f43f5e', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  lockedText: { color: '#6b7280', fontSize: 12, fontStyle: 'italic' },
  hoidButton: { marginTop: 24, backgroundColor: '#312e81', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4f46e5' },
  hoidButtonText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  hoidSubtext: { color: '#c7d2fe', fontSize: 11, marginTop: 4 }
});