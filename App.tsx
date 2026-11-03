import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { CosmereProvider, useCosmere } from './src/context/CosmereContext';
import { SISTEMAS_COSMERE_COMPLETO } from './src/data/cosmereUniverse';
import { InvestitureWheel } from './src/components/InvestitureWheel';
import { HoidScreen } from './src/screens/HoidScreen';
import { QuizzesScreen } from './src/screens/QuizzesScreen';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const MainNavigator = () => {
  const [tab, setTab] = useState<'atlas' | 'wheel' | 'hoid' | 'quiz' | 'comunidad' | 'perfil'>('atlas');
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState(SISTEMAS_COSMERE_COMPLETO[0]);
  const { toggleLibroLeido, librosLeidos } = useCosmere();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* CONTENIDO DE LA PANTALLA SEGÚN LA PESTAÑA */}
      <View style={styles.body}>
        {tab === 'atlas' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.brandSubtitle}>MAPA ESTELAR DEL REINO FÍSICO</Text>
            <Text style={styles.brandTitle}>ATLAS DEL COSMERE</Text>

            {/* Selector de Planetas */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {SISTEMAS_COSMERE_COMPLETO.map(sis => (
                <TouchableOpacity 
                  key={sis.id} 
                  onPress={() => setSistemaSeleccionado(sis)}
                  style={[styles.planetChip, sistemaSeleccionado.id === sis.id && { borderColor: sis.colorAura, backgroundColor: '#1e293b' }]}
                >
                  <View style={[styles.dot, { backgroundColor: sis.colorAura }]} />
                  <Text style={styles.planetChipText}>{sis.planeta}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tarjeta del Planeta Seleccionado */}
            <View style={[styles.planetCard, { borderColor: sistemaSeleccionado.colorAura }]}>
              <Text style={[styles.planetBigTitle, { color: sistemaSeleccionado.colorAura }]}>
                {sistemaSeleccionado.planeta.toUpperCase()}
              </Text>
              <Text style={styles.systemName}>{sistemaSeleccionado.nombre}</Text>
              
              {/* Representación visual de la Esfera Orbital */}
              <View style={styles.orbitContainer}>
                <View style={[styles.coreSphere, { backgroundColor: sistemaSeleccionado.colorAura }]}>
                  <Text style={styles.sphereText}>3D ORBIT</Text>
                </View>
              </View>

              <Text style={styles.desc}>{sistemaSeleccionado.descripcion}</Text>
            </View>

            {/* Obras de este mundo */}
            <Text style={styles.subHeader}>BIBLIOGRAFÍA Y ESTADO DE LECTURA</Text>
            {sistemaSeleccionado.libros.map(lib => {
              const leido = !!librosLeidos[lib.id];
              return (
                <TouchableOpacity 
                  key={lib.id} 
                  style={[styles.bookRow, leido && styles.bookRowRead]}
                  onPress={() => toggleLibroLeido(lib.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle}>{lib.titulo}</Text>
                    <Text style={styles.bookMeta}>{lib.saga} • {lib.totalCapitulos} Caps</Text>
                  </View>
                  <Text style={[styles.statusTag, { color: leido ? '#34d399' : '#64748b' }]}>
                    {leido ? '✓ LEÍDO' : '○ PENDIENTE'}
                  </Text>
                </TouchableOpacity>
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

      {/* BARRA DE NAVEGACIÓN INFERIOR (BOTTOM TABS) */}
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
  hScroll: { marginVertical: 12 },
  planetChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#1e293b', marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  planetChipText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  planetCard: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, marginVertical: 10 },
  planetBigTitle: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  systemName: { color: '#64748b', fontSize: 12, marginTop: 2 },
  orbitContainer: { height: 110, justifyContent: 'center', alignItems: 'center', marginVertical: 10 },
  coreSphere: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  sphereText: { color: '#090d16', fontSize: 9, fontWeight: '900' },
  desc: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  subHeader: { color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: 16, marginBottom: 10 },
  bookRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  bookRowRead: { backgroundColor: '#06281e', borderColor: '#10b981' },
  bookTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  bookMeta: { color: '#64748b', fontSize: 11, marginTop: 2 },
  statusTag: { fontSize: 11, fontWeight: '800' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#0b1120', borderTopWidth: 1, borderColor: '#1e293b', paddingVertical: 8, justifyContent: 'space-around' },
  navBtn: { alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 18, marginBottom: 2 },
  navText: { color: '#64748b', fontSize: 9, fontWeight: '700' },
  navTextActive: { color: '#38bdf8' }
});
registerRootComponent(App);