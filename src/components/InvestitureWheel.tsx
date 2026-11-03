import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';

export const InvestitureWheel: React.FC = () => {
  const { librosLeidos, esContenidoDesbloqueado } = useCosmere();
  const [categoriaActiva, setCategoriaActiva] = useState<'magia' | 'fauna' | 'tormentas'>('magia');

  // Filtrar todo lo descubierto según los libros leídos
  const todosLosSistemas = SISTEMAS_COSMERE_COMPLETO;
  
  return (
    <View style={styles.container}>
      <Text style={styles.wheelHeader}>CÍRCULO DE INVESTIDURA</Text>
      <Text style={styles.wheelSub}>Pulso de secretos cósmicos sintonizados con tu lectura actual</Text>

      {/* Selector de categorías del Círculo */}
      <View style={styles.dialControls}>
        <TouchableOpacity 
          onPress={() => setCategoriaActiva('magia')}
          style={[styles.dialBtn, categoriaActiva === 'magia' && styles.dialBtnActive]}
        >
          <Text style={[styles.dialBtnText, categoriaActiva === 'magia' && styles.dialBtnTextActive]}>✨ MAGIAS</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCategoriaActiva('fauna')}
          style={[styles.dialBtn, categoriaActiva === 'fauna' && styles.dialBtnActive]}
        >
          <Text style={[styles.dialBtnText, categoriaActiva === 'fauna' && styles.dialBtnTextActive]}>🦎 FAUNA & FLORA</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setCategoriaActiva('tormentas')}
          style={[styles.dialBtn, categoriaActiva === 'tormentas' && styles.dialBtnActive]}
        >
          <Text style={[styles.dialBtnText, categoriaActiva === 'tormentas' && styles.dialBtnTextActive]}>⚡ CLIMAS</Text>
        </TouchableOpacity>
      </View>

      {/* Lista dinámica de secretos desbloqueados o bloqueados */}
      <ScrollView style={styles.secretsList} nestedScrollEnabled={true}>
        {categoriaActiva === 'magia' && (
          todosLosSistemas.map(sis => (
            <View key={sis.id} style={styles.systemGroup}>
              <Text style={[styles.groupTitle, { color: sis.colorAura }]}>{sis.planeta.toUpperCase()}</Text>
              {sis.sistemasMagicos.map((mag, i) => {
                const unlocked = esContenidoDesbloqueado(mag.desbloqueoLibroId);
                return (
                  <View key={i} style={[styles.card, unlocked ? styles.cardUnlocked : styles.cardLocked]}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: unlocked ? '#f8fafc' : '#64748b' }]}>
                        {unlocked ? mag.nombre : '🔒 Sistema Mágico Sellado'}
                      </Text>
                      <Text style={[styles.cardTag, { color: unlocked ? '#38bdf8' : '#f43f5e' }]}>
                        {unlocked ? 'DESVELADO' : 'SPOILER'}
                      </Text>
                    </View>
                    <Text style={styles.cardDesc}>
                      {unlocked ? mag.desc : 'Requiere avanzar en las lecturas de este mundo para comprender sus leyes.'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {categoriaActiva === 'fauna' && (
          todosLosSistemas.map(sis => (
            <View key={sis.id} style={styles.systemGroup}>
              <Text style={[styles.groupTitle, { color: sis.colorAura }]}>{sis.planeta.toUpperCase()}</Text>
              {sis.faunaFlora.map((ff, i) => {
                const unlocked = esContenidoDesbloqueado(ff.desbloqueoLibroId);
                return (
                  <View key={i} style={[styles.card, unlocked ? styles.cardUnlocked : styles.cardLocked]}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: unlocked ? '#f8fafc' : '#64748b' }]}>
                        {unlocked ? `${ff.nombre} (${ff.tipo.toUpperCase()})` : '🔒 Especie Desconocida'}
                      </Text>
                      <Text style={[styles.cardTag, { color: unlocked ? '#34d399' : '#f43f5e' }]}>
                        {unlocked ? 'REGISTRADO' : 'BLOQUEADO'}
                      </Text>
                    </View>
                    <Text style={styles.cardDesc}>
                      {unlocked ? ff.desc : 'No has alcanzado la expedición que cataloga esta forma de vida.'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}

        {categoriaActiva === 'tormentas' && (
          todosLosSistemas.map(sis => (
            <View key={sis.id} style={[styles.card, styles.cardUnlocked, { marginBottom: 14 }]}>
              <Text style={[styles.groupTitle, { color: sis.colorAura }]}>{sis.planeta}: FENÓMENO METEOROLÓGICO</Text>
              <Text style={styles.cardDesc}>{sis.climaYTiempo}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginVertical: 12, borderWidth: 1, borderColor: '#1e293b' },
  wheelHeader: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  wheelSub: { color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 14 },
  dialControls: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16, backgroundColor: '#090d16', padding: 4, borderRadius: 10 },
  dialBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  dialBtnActive: { backgroundColor: '#1e293b' },
  dialBtnText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  dialBtnTextActive: { color: '#38bdf8' },
  secretsList: { maxHeight: 350 },
  systemGroup: { marginBottom: 16 },
  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  card: { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
  cardUnlocked: { backgroundColor: '#131e36', borderColor: '#1e293b' },
  cardLocked: { backgroundColor: '#090d16', borderColor: '#334155', borderStyle: 'dashed' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardTag: { fontSize: 9, fontWeight: '800' },
  cardDesc: { color: '#94a3b8', fontSize: 12, lineHeight: 18 }
});