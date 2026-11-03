import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { LOGROS_DISPONIBLES } from '../data/gamification';
import { PROXIMOS_LANZAMIENTOS } from '../data/upcomingReleases';

export const ProfileScreen: React.FC = () => {
  const { nombreUsuario, apodoActivo, rangoActual, puntosInvestidura, setApodoActivo } = useCosmere();
  const [googleConectado, setGoogleConectado] = useState(false);

  const toggleGoogle = () => {
    setGoogleConectado(!googleConectado);
    Alert.alert(
      googleConectado ? 'Sesión Cerrada' : 'Conectado con Google',
      googleConectado ? 'Tus datos ahora se guardan solo en local.' : 'Progreso sincronizado en la nube de Supabase.'
    );
  };

  const proximo = PROXIMOS_LANZAMIENTOS[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* TARJETA DE IDENTIFICACIÓN DE SILVERLIGHT */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{nombreUsuario[0]}</Text>
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

        {/* Botón de Google */}
        <TouchableOpacity 
          style={[styles.googleBtn, googleConectado && styles.googleBtnConnected]} 
          onPress={toggleGoogle}
        >
          <Text style={styles.googleBtnText}>
            {googleConectado ? '✓ Cuenta de Google Sincronizada' : 'Conectar con Google'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* WIDGET DE PRÓXIMO LANZAMIENTO */}
      <Text style={styles.sectionTitle}>PRÓXIMO LANZAMIENTO OFICIAL</Text>
      <View style={styles.releaseCard}>
        <Text style={styles.releaseSaga}>{proximo.saga}</Text>
        <Text style={styles.releaseTitle}>{proximo.titulo}</Text>
        <Text style={styles.releaseDesc}>{proximo.descripcion}</Text>
        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Progreso de Escritura de Brandon: {proximo.progresoEscrituraBrandon}%</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${proximo.progresoEscrituraBrandon}%` }]} />
          </View>
        </View>
      </View>

      {/* APODOS Y LOGROS DESBLOQUEABLES */}
      <Text style={styles.sectionTitle}>APODOS Y TÍTULOS DISPONIBLES</Text>
      {LOGROS_DISPONIBLES.map(logro => (
        <View key={logro.id} style={styles.achievementCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.achTitle}>{logro.titulo}</Text>
            <Text style={styles.achDesc}>{logro.descripcion}</Text>
            <Text style={styles.achReward}>Apodo desbloqueable: "{logro.recompensaApodo}"</Text>
          </View>
          <TouchableOpacity 
            style={styles.equipBtn} 
            onPress={() => {
              setApodoActivo(logro.recompensaApodo);
              Alert.alert('¡Apodo Equipado!', `Ahora eres conocido como "${logro.recompensaApodo}"`);
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
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarInitial: { fontSize: 28, fontWeight: '900', color: '#090d16' },
  userName: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  userTitle: { color: '#38bdf8', fontSize: 13, fontStyle: 'italic', marginTop: 2, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  googleBtn: { backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, width: '100%', alignItems: 'center' },
  googleBtnConnected: { backgroundColor: '#10b981' },
  googleBtnText: { color: '#090d16', fontWeight: 'bold', fontSize: 12 },
  sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10, marginTop: 10 },
  releaseCard: { backgroundColor: '#131e36', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0284c7', marginBottom: 20 },
  releaseSaga: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  releaseTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '900', marginVertical: 4 },
  releaseDesc: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  progressContainer: { marginTop: 6 },
  progressLabel: { color: '#cbd5e1', fontSize: 11, marginBottom: 4 },
  progressBarBg: { height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#38bdf8' },
  achievementCard: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b', marginBottom: 10, alignItems: 'center' },
  achTitle: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  achDesc: { color: '#64748b', fontSize: 11, marginVertical: 2 },
  achReward: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  equipBtn: { backgroundColor: '#1e293b', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  equipBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' }
});