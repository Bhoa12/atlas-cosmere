import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { LOGROS_DISPONIBLES } from '../data/gamification';
import { PROXIMOS_LANZAMIENTOS } from '../data/upcomingReleases';

export const ProfileScreen: React.FC = () => {
  const { nombreUsuario, apodoActivo, rangoActual, puntosInvestidura, setApodoActivo, todosLosLibrosLeidos } = useCosmere();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* IDENTIFICACIÓN */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{nombreUsuario ? nombreUsuario.charAt(0) : 'T'}</Text>
        </View>
        <Text style={styles.userName}>{nombreUsuario}</Text>
        <Text style={styles.userTitle}>"{apodoActivo}"</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.pill, { backgroundColor: rangoActual.color }]}>
            <Text style={styles.pillText}>{rangoActual.nombre}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: '#1e293b' }]}>
            <Text style={styles.pillText}>{puntosInvestidura} Investidura</Text>
          </View>
        </View>

        <Text style={styles.statsBooks}>
          Estado de Lectura: {todosLosLibrosLeidos ? '✓ 100% Cosmere Completado' : 'Leyendo el universo...'}
        </Text>
      </View>

      {/* TODOS LOS PRÓXIMOS LANZAMIENTOS OFICIALES */}
      <Text style={styles.sectionTitle}>CALENDARIO DE LANZAMIENTOS DE BRANDON</Text>
      {PROXIMOS_LANZAMIENTOS.map(lan => (
        <View key={lan.id} style={styles.releaseCard}>
          <View style={styles.releaseHeader}>
            <Text style={styles.releaseSaga}>{lan.saga.toUpperCase()}</Text>
            <Text style={styles.releasePlanet}>{lan.planeta}</Text>
          </View>
          <Text style={styles.releaseTitle}>{lan.titulo}</Text>
          <Text style={styles.releaseDesc}>{lan.descripcion}</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Progreso de Escritura: {lan.progresoEscrituraBrandon}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${lan.progresoEscrituraBrandon}%` }]} />
            </View>
          </View>
        </View>
      ))}

      {/* CATÁLOGO DE 16 APODOS DESBLOQUEABLES */}
      <Text style={styles.sectionTitle}>TÍTULOS Y APODOS DESBLOQUEABLES</Text>
      {LOGROS_DISPONIBLES.map(logro => (
        <View key={logro.id} style={styles.achievementCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.achTitle}>{logro.titulo}</Text>
            <Text style={styles.achDesc}>{logro.descripcion}</Text>
            <Text style={styles.achReward}>Título: "{logro.recompensaApodo}"</Text>
          </View>
          <TouchableOpacity
            style={styles.equipBtn}
            onPress={() => {
              setApodoActivo(logro.recompensaApodo);
              Alert.alert('¡Apodo Equipado!', `Tu título activo es ahora: "${logro.recompensaApodo}"`);
            }}
          >
            <Text style={styles.equipBtnText}>Equipar</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: 16, paddingBottom: 60 },
  profileCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1e293b', marginBottom: 20 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: '#090d16' },
  userName: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  userTitle: { color: '#38bdf8', fontSize: 13, fontStyle: 'italic', marginVertical: 4 },
  badgeRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  statsBooks: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginTop: 10 },
  releaseCard: { backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 12 },
  releaseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  releaseSaga: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  releasePlanet: { color: '#64748b', fontSize: 10 },
  releaseTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', marginVertical: 2 },
  releaseDesc: { color: '#94a3b8', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  progressContainer: { marginTop: 4 },
  progressLabel: { color: '#cbd5e1', fontSize: 10, marginBottom: 3 },
  progressBarBg: { height: 6, backgroundColor: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#38bdf8' },
  achievementCard: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b', marginBottom: 8, alignItems: 'center' },
  achTitle: { color: '#f8fafc', fontSize: 12, fontWeight: 'bold' },
  achDesc: { color: '#64748b', fontSize: 10, marginVertical: 2 },
  achReward: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  equipBtn: { backgroundColor: '#1e293b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  equipBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }
});