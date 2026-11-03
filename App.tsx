import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Modal } from 'react-native';
import { CosmereProvider, useCosmere } from './src/context/CosmereContext';
import { SISTEMAS_COSMERE_COMPLETO, Libro } from './src/data/cosmereUniverse';
import { InvestitureWheel } from './src/components/InvestitureWheel';
import { HoidScreen } from './src/screens/HoidScreen';
import { QuizzesScreen } from './src/screens/QuizzesScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const MainNavigator = () => {
  const [tab, setTab] = useState<'atlas' | 'wheel' | 'hoid' | 'quiz' | 'comunidad' | 'perfil'>('atlas');
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState(SISTEMAS_COSMERE_COMPLETO[0]);
  const [libroModal, setLibroModal] = useState<Libro | null>(null);
  const { toggleLibroLeido, librosLeidos } = useCosmere();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.body}>
        {tab === 'atlas' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.brandSubtitle}>MAPA ESTELAR DEL REINO FÍSICO</Text>
            <Text style={styles.brandTitle}>ATLAS DEL COSMERE</Text>

            {/* SISTEMA GALÁCTICO UNIFICADO (REPRESENTACIÓN ESPACIAL CONJUNTA) */}
            <View style={styles.galaxyMapBox}>
              <Text style={styles.galaxyTitle}>SISTEMA ESTELAR Y PERPENDICULARIDADES</Text>
              <Text style={styles.galaxySub}>Toca un mundo para orbitar hacia su sector:</Text>
              <View style={styles.galaxyOrbits}>
                {SISTEMAS_COSMERE_COMPLETO.map((sis, idx) => (
                  <TouchableOpacity
                    key={sis.id}
                    onPress={() => setSistemaSeleccionado(sis)}
                    style={[
                      styles.orbitPlanetNode,
                      { borderColor: sis.colorAura },
                      sistemaSeleccionado.id === sis.id && { backgroundColor: sis.colorAura, transform: [{ scale: 1.15 }] }
                    ]}
                  >
                    <Text style={[styles.orbitNodeText, sistemaSeleccionado.id === sis.id && { color: '#000' }]}>
                      {sis.planeta.substring(0, 3).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* FICHA DETALLADA DEL PLANETA Y MAPAS */}
            <View style={[styles.planetCard, { borderColor: sistemaSeleccionado.colorAura }]}>
              <Text style={[styles.planetBigTitle, { color: sistemaSeleccionado.colorAura }]}>
                {sistemaSeleccionado.planeta.toUpperCase()}
              </Text>
              <Text style={styles.systemName}>{sistemaSeleccionado.nombre}</Text>

              <View style={styles.mapBox}>
                <Text style={styles.mapLabel}>🗺️ CARTOGRAFÍA TERRITORIAL:</Text>
                <Text style={styles.mapText}>{sistemaSeleccionado.mapaTerritorial}</Text>
              </View>

              <Text style={styles.desc}>{sistemaSeleccionado.descripcion}</Text>
            </View>

            {/* BIBLIOGRAFÍA CON ACCESO A DETALLES */}
            <Text style={styles.subHeader}>BIBLIOGRAFÍA (PULSA PARA VER SINOPSIS & PERSONAJES)</Text>
            {sistemaSeleccionado.libros.map(lib => {
              const leido = !!librosLeidos[lib.id];
              return (
                <View key={lib.id} style={[styles.bookRow, leido && styles.bookRowRead]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setLibroModal(lib)}>
                    <Text style={styles.bookTitle}>{lib.titulo} ℹ️</Text>
                    <Text style={styles.bookMeta}>{lib.saga} • {lib.totalCapitulos} Caps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.readToggleBtn, leido && styles.readToggleBtnActive]}
                    onPress={() => toggleLibroLeido(lib.id)}
                  >
                    <Text style={[styles.statusTag, { color: leido ? '#34d399' : '#94a3b8' }]}>
                      {leido ? '✓ LEÍDO' : '○ PENDIENTE'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {tab === 'wheel' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <InvestitureWheel />
          </ScrollView>
        )}

        {tab === 'hoid' && <HoidScreen />}
        {tab === 'quiz' && <QuizzesScreen />}
        {tab === 'comunidad' && <CommunityScreen />}
        {tab === 'perfil' && <ProfileScreen />}
      </View>

      {/* MODAL CON SINOPSIS Y PERSONAJES DE CADA LIBRO */}
      <Modal visible={!!libroModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {libroModal && (
              <>
                <Text style={styles.modalSaga}>{libroModal.saga.toUpperCase()}</Text>
                <Text style={styles.modalTitle}>{libroModal.titulo}</Text>
                <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
                  <Text style={styles.modalSectionTitle}>SINOPSIS OFICIAL:</Text>
                  <Text style={styles.modalBodyText}>{libroModal.sinopsis}</Text>

                  <Text style={styles.modalSectionTitle}>PERSONAJES PRINCIPALES:</Text>
                  {libroModal.personajesClave.map((p, i) => (
                    <Text key={i} style={styles.characterItem}>
                      • <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>{p.nombre}</Text>: {p.rol}
                    </Text>
                  ))}

                  <Text style={styles.modalSectionTitle}>CONEXIÓN CON EL COSMERE:</Text>
                  <Text style={styles.modalBodyText}>{libroModal.conexionesCosmere}</Text>
                </ScrollView>
                <TouchableOpacity style={styles.closeModalBtn} onPress={() => setLibroModal(null)}>
                  <Text style={styles.closeModalBtnText}>Cerrar Ficha</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('atlas')}>
          <Text style={styles.navIcon}>🪐</Text>
          <Text style={[styles.navText, tab === 'atlas' && styles.navTextActive]}>Atlas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('wheel')}>
          <Text style={styles.navIcon}>☸️</Text>
          <Text style={[styles.navText, tab === 'wheel' && styles.navTextActive]}>Códice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('hoid')}>
          <Text style={styles.navIcon}>🧙‍♂️</Text>
          <Text style={[styles.navText, tab === 'hoid' && styles.navTextActive]}>Hoid IA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('quiz')}>
          <Text style={styles.navIcon}>⚡</Text>
          <Text style={[styles.navText, tab === 'quiz' && styles.navTextActive]}>Tests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('comunidad')}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navText, tab === 'comunidad' && styles.navTextActive]}>Foro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('perfil')}>
          <Text style={styles.navIcon}>🛡️</Text>
          <Text style={[styles.navText, tab === 'perfil' && styles.navTextActive]}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <CosmereProvider>
      <MainNavigator />
    </CosmereProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#090d16' },
  body: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  brandSubtitle: { color: '#64748b', fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  brandTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '900', letterSpacing: 1, marginVertical: 4 },
  galaxyMapBox: { backgroundColor: '#0b1120', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', marginVertical: 12 },
  galaxyTitle: { color: '#f8fafc', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  galaxySub: { color: '#64748b', fontSize: 10, marginBottom: 12 },
  galaxyOrbits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  orbitPlanetNode: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090d16' },
  orbitNodeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  planetCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, borderWidth: 1, marginVertical: 10 },
  planetBigTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  systemName: { color: '#64748b', fontSize: 12, marginTop: 2, textAlign: 'center' },
  mapBox: { backgroundColor: '#090d16', padding: 12, borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: '#1e293b' },
  mapLabel: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  mapText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  desc: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  subHeader: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 16, marginBottom: 10 },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  bookRowRead: { backgroundColor: '#06281e', borderColor: '#10b981' },
  bookTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  bookMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  readToggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#1e293b' },
  readToggleBtnActive: { backgroundColor: '#064e3b' },
  statusTag: { fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#38bdf8' },
  modalSaga: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginVertical: 4 },
  modalSectionTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  modalBodyText: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  characterItem: { color: '#cbd5e1', fontSize: 11, marginVertical: 2 },
  closeModalBtn: { backgroundColor: '#0284c7', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  closeModalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#0b1120', borderTopWidth: 1, borderColor: '#1e293b', paddingVertical: 8, justifyContent: 'space-around' },
  navBtn: { alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navText: { color: '#64748b', fontSize: 9, fontWeight: '700' },
  navTextActive: { color: '#38bdf8' }
});

registerRootComponent(App);