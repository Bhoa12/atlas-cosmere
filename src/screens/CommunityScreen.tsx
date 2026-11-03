import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { useCosmere } from '../context/CosmereContext';

export const CommunityScreen: React.FC = () => {
  const { comentarios, agregarComentario, darLuzTormentosa, capituloActualPorLibro } = useCosmere();
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [reveladosManualmente, setReveladosManualmente] = useState<{ [id: string]: boolean }>({});

  const publicar = () => {
    if (!nuevoTexto.trim()) return;
    agregarComentario('twok', 75, nuevoTexto.trim());
    setNuevoTexto('');
  };

  const toggleRevelar = (id: string) => {
    setReveladosManualmente(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FORO DE ESPECULACIONES</Text>
        <Text style={styles.sub}>Debates protegidos contra spoilers por Investidura</Text>
      </View>

      {/* Caja para publicar nueva teoría */}
      <View style={styles.postBox}>
        <TextInput
          style={styles.postInput}
          placeholder="Escribe tu teoría o especulación cósmica..."
          placeholderTextColor="#64748b"
          value={nuevoTexto}
          onChangeText={setNuevoTexto}
          multiline
        />
        <TouchableOpacity style={styles.postBtn} onPress={publicar}>
          <Text style={styles.postBtnText}>Publicar Teoría (+20 Pts)</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de comentarios */}
      <FlatList
        data={comentarios}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const capUsuarioEnEseLibro = capituloActualPorLibro[item.libroId] || 0;
          const esSpoiler = item.capituloMaximo > capUsuarioEnEseLibro;
          const estaRevelado = reveladosManualmente[item.id];

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.author}>{item.usuario}</Text>
                <Text style={styles.bookTag}>Libro: {item.libroId.toUpperCase()} • Cap. {item.capituloMaximo}</Text>
              </View>

              {esSpoiler && !estaRevelado ? (
                <TouchableOpacity style={styles.spoilerShield} onPress={() => toggleRevelar(item.id)}>
                  <Text style={styles.spoilerWarn}>⚠️ POSIBLE SPOILER</Text>
                  <Text style={styles.spoilerPrompt}>Contiene información hasta el Cap. {item.capituloMaximo}. Toca para desvelar bajo tu propio riesgo.</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.content}>{item.contenido}</Text>
              )}

              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.likeBtn} onPress={() => darLuzTormentosa(item.id)}>
                  <Text style={styles.likeText}>💎 {item.luzTormentosaLikes} Luz Tormentosa</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  header: { padding: 16, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  sub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  postBox: { padding: 14, backgroundColor: '#0f172a', margin: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  postInput: { color: '#ffffff', minHeight: 60, fontSize: 13, textAlignVertical: 'top' },
  postBtn: { backgroundColor: '#0284c7', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, alignSelf: 'flex-end', marginTop: 8 },
  postBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  card: { backgroundColor: '#0f172a', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  author: { color: '#38bdf8', fontWeight: 'bold', fontSize: 13 },
  bookTag: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  content: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  spoilerShield: { backgroundColor: '#1c1917', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#b91c1c', marginVertical: 6 },
  spoilerWarn: { color: '#f87171', fontWeight: 'bold', fontSize: 11, marginBottom: 2 },
  spoilerPrompt: { color: '#9ca3af', fontSize: 11 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 8 },
  likeBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  likeText: { color: '#38bdf8', fontSize: 12, fontWeight: '700' }
});