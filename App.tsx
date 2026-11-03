import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, Modal } from 'react-native';
import { CosmereProvider, useCosmere } from './src/context/CosmereContext';
import { SISTEMAS_COSMERE_COMPLETO, Libro } from './src/data/cosmereUniverse';
import { InvestitureWheel } from './src/components/InvestitureWheel';
import { ToolsScreen } from './src/screens/ToolsScreen';
import { HoidScreen } from './src/screens/HoidScreen';
import { QuizzesScreen } from './src/screens/QuizzesScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const MainNavigator = () => {
  const [tab, setTab] = useState<'atlas' | 'wheel' | 'tools' | 'hoid' | 'quiz' | 'comunidad' | 'perfil'>('atlas');
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState(SISTEMAS_COSMERE_COMPLETO[0]);
  const [libroModal, setLibroModal] = useState<Libro | null>(null);
  const { toggleLibroLeido, librosLeidos, reinoCognitivoActivo, toggleReinoCognitivo } = useCosmere();

  const themeBg = reinoCognitivoActivo ? '#030712' : '#090d16';
  const themeCard = reinoCognitivoActivo ? '#0b0f19' : '#0f172a';
  const themeAccent = reinoCognitivoActivo ? '#a855f7' : '#38bdf8';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeBg }]}>
      <StatusBar barStyle="light-content" />

      {/* CABECERA CON INTERRUPTOR DE SHADESMAR */}
      <View style={[styles.topBar, { backgroundColor: themeCard }]}>
        <View>
          <Text style={styles.brandSubtitle}>TERMINAL DE SILVERLIGHT</Text>
          <Text style={[styles.brandTitle, { color: themeAccent }]}>ATLAS DEL COSMERE</Text>
        </View>

        {/* BOTÓN INTERRUPTOR DE REINOS */}
        <TouchableOpacity 
          style={[styles.realmToggleBtn, { borderColor: themeAccent }]} 
          onPress={toggleReinoCognitivo}
        >
          <Text style={styles.realmToggleIcon}>{reinoCognitivoActivo ? '🔮' : '🪐'}</Text>
          <Text style={[styles.realmToggleText, { color: themeAccent }]}>
            {reinoCognitivoActivo ? 'Reino Cognitivo' : 'Reino Físico'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CUERPO CENTRAL */}
      <View style={styles.body}>
        {tab === 'atlas' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.brandSubtitle}>
              {reinoCognitivoActivo ? 'MAR DE CUENTAS DE CRISTAL (SHADESMAR)' : 'MAPA ESTELAR DEL REINO FÍSICO'}
            </Text>

            {/* Sistema Galáctico Unificado */}
            <View style={[styles.galaxyMapBox, { backgroundColor: themeCard }]}>
              <Text style={styles.galaxyTitle}>SISTEMAS Y PERPENDICULARIDADES ACTIVAS</Text>
              <View style={styles.galaxyOrbits}>
                {SISTEMAS_COSMERE_COMPLETO.map(sis => (
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

            {/* Ficha Detallada del Planeta */}
            <View style={[styles.planetCard, { borderColor: sistemaSeleccionado.colorAura, backgroundColor: themeCard }]}>
              <Text style={[styles.planetBigTitle, { color: sistemaSeleccionado.colorAura }]}>
                {sistemaSeleccionado.planeta.toUpperCase()}
              </Text>
              <Text style={styles.systemName}>{sistemaSeleccionado.nombre}</Text>

              <View style={styles.mapBox}>
                <Text style={styles.mapLabel}>🗺️ CARTOGRAFÍA {reinoCognitivoActivo ? 'COGNITIVA' : 'TERRITORIAL'}:</Text>
                <Text style={styles.mapText}>{sistemaSeleccionado.mapaTerritorial}</Text>
              </View>

              <Text style={styles.desc}>{sistemaSeleccionado.descripcion}</Text>
            </View>

            {/* Bibliografía */}
            <Text style={styles.subHeader}>BIBLIOGRAFÍA (PULSA PARA SINOPSIS & PERSONAJES)</Text>
            {sistemaSeleccionado.libros.map(lib => {
              const leido = !!librosLeidos[lib.id];
              return (
                <View key={lib.id} style={[styles.bookRow, leido && styles.bookRowRead, { backgroundColor: themeCard }]}>
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

        {tab === 'tools' && <ToolsScreen />}
        {tab === 'hoid' && <HoidScreen />}
        {tab === 'quiz' && <QuizzesScreen />}
        {tab === 'comunidad' && <CommunityScreen />}
        {tab === 'perfil' && <ProfileScreen />}
      </View>

      {/* MODAL DETALLES DEL LIBRO */}
      <Modal visible={!!libroModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeCard }]}>
            {libroModal && (
              <>
                <Text style={styles.modalSaga}>{libroModal.saga.toUpperCase()}</Text>
                <Text style={styles.modalTitle}>{libroModal.titulo}</Text>
                <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
                  <Text style={styles.modalSectionTitle}>SINOPSIS CANÓNICA:</Text>
                  <Text style={styles.modalBodyText}>{libroModal.sinopsis}</Text>

                  <Text style={styles.modalSectionTitle}>PERSONAJES PRINCIPALES:</Text>
                  {libroModal.personajesClave.map((p, i) => (
                    <Text key={i} style={styles.characterItem}>
                      • <Text style={{ color: themeAccent, fontWeight: 'bold' }}>{p.nombre}</Text>: {p.rol}
                    </Text>
                  ))}

                  <Text style={styles.modalSectionTitle}>CONEXIÓN CON EL COSMERE:</Text>
                  <Text style={styles.modalBodyText}>{libroModal.conexionesCosmere}</Text>
                </ScrollView>
                <TouchableOpacity style={[styles.closeModalBtn, { backgroundColor: themeAccent }]} onPress={() => setLibroModal(null)}>
                  <Text style={styles.closeModalBtnText}>Cerrar Ficha</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <View style={[styles.bottomNav, { backgroundColor: themeCard }]}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('atlas')}>
          <Text style={styles.navIcon}>🪐</Text>
          <Text style={[styles.navText, tab === 'atlas' && { color: themeAccent }]}>Atlas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('wheel')}>
          <Text style={styles.navIcon}>☸️</Text>
          <Text style={[styles.navText, tab === 'wheel' && { color: themeAccent }]}>Códice</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('tools')}>
          <Text style={styles.navIcon}>🛠️</Text>
          <Text style={[styles.navText, tab === 'tools' && { color: themeAccent }]}>Bóveda</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('hoid')}>
          <Text style={styles.navIcon}>🧙‍♂️</Text>
          <Text style={[styles.navText, tab === 'hoid' && { color: themeAccent }]}>Hoid IA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('quiz')}>
          <Text style={styles.navIcon}>⚡</Text>
          <Text style={[styles.navText, tab === 'quiz' && { color: themeAccent }]}>Tests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('comunidad')}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navText, tab === 'comunidad' && { color: themeAccent }]}>Foro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setTab('perfil')}>
          <Text style={styles.navIcon}>🛡️</Text>
          <Text style={[styles.navText, tab === 'perfil' && { color: themeAccent }]}>Perfil</Text>
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
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#1e293b' },
  brandSubtitle: { color: '#64748b', fontSize: 9, letterSpacing: 1.5, fontWeight: '800' },
  brandTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  realmToggleBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: '#090d16' },
  realmToggleIcon: { fontSize: 13, marginRight: 6 },
  realmToggleText: { fontSize: 10, fontWeight: 'bold' },
  body: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  galaxyMapBox: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#1e293b', marginVertical: 12 },
  galaxyTitle: { color: '#f8fafc', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  galaxyOrbits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  orbitPlanetNode: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090d16' },
  orbitNodeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  planetCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginVertical: 10 },
  planetBigTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  systemName: { color: '#64748b', fontSize: 12, marginTop: 2, textAlign: 'center' },
  mapBox: { backgroundColor: '#090d16', padding: 12, borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: '#1e293b' },
  mapLabel: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  mapText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  desc: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  subHeader: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 16, marginBottom: 10 },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  bookRowRead: { borderColor: '#10b981' },
  bookTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  bookMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  readToggleBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#1e293b' },
  readToggleBtnActive: { backgroundColor: '#064e3b' },
  statusTag: { fontSize: 11, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#38bdf8' },
  modalSaga: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginVertical: 4 },
  modalSectionTitle: { color: '#94a3b8', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  modalBodyText: { color: '#cbd5e1', fontSize: 12, lineHeight: 18 },
  characterItem: { color: '#cbd5e1', fontSize: 11, marginVertical: 2 },
  closeModalBtn: { padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  closeModalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#1e293b', paddingVertical: 8, justifyContent: 'space-around' },
  navBtn: { alignItems: 'center', paddingVertical: 2, flex: 1 },
  navIcon: { fontSize: 16, marginBottom: 2 },
  navText: { color: '#64748b', fontSize: 8, fontWeight: '700' }
});

registerRootComponent(App);