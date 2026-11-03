import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ScrollView, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';

export const CommunityScreen: React.FC = () => {
  const { comentarios, agregarComentario, darLuzTormentosa, capituloActualPorLibro, librosLeidos } = useCosmere();
  const [sagaSeleccionada, setSagaSeleccionada] = useState<string>('Archivo de las Tormentas');
  const [libroSeleccionadoId, setLibroSeleccionadoId] = useState<string>('twok');
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [capituloTeoria, setCapituloTeoria] = useState('1');
  const [reveladosManualmente, setReveladosManualmente] = useState<{ [id: string]: boolean }>({});

  // Extraer todas las sagas únicas
  const todasLasSagas = Array.from(new Set(
    SISTEMAS_COSMERE_COMPLETO.flatMap(s => s.libros.map(l => l.saga))
  ));

  // Libros pertenecientes a la saga seleccionada
  const librosDeSaga = SISTEMAS_COSMERE_COMPLETO
    .flatMap(s => s.libros)
    .filter(l => l.saga === sagaSeleccionada);

  const libroSeleccionado = librosDeSaga.find(libro => libro.id === libroSeleccionadoId);
  const comentariosFiltrados = comentarios.filter(c => c.libroId === libroSeleccionadoId);

  const publicar = () => {
    const texto = nuevoTexto.trim();
    const capitulo = Number.parseInt(capituloTeoria, 10);
    if (!texto) return;
    if (!libroSeleccionado) {
      Alert.alert('Selecciona un libro', 'Elige una obra antes de publicar tu teoría.');
      return;
    }
    if (!Number.isInteger(capitulo) || capitulo < 1 || capitulo > libroSeleccionado.totalCapitulos) {
      Alert.alert('Capítulo no válido', `Introduce un capítulo entre 1 y ${libroSeleccionado.totalCapitulos}.`);
      return;
    }
    const capituloLeido = librosLeidos[libroSeleccionadoId]
      ? libroSeleccionado.totalCapitulos
      : (capituloActualPorLibro[libroSeleccionadoId] ?? 0);
    if (capitulo > capituloLeido) {
      Alert.alert('Límite de lectura', `Solo puedes publicar teorías hasta el capítulo ${capituloLeido}, que es tu progreso actual en este libro.`);
      return;
    }
    agregarComentario(sagaSeleccionada, libroSeleccionadoId, capitulo, texto);
    setNuevoTexto('');
  };

  const toggleRevelar = (id: string) => {
    setReveladosManualmente(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FORO DE ESPECULACIONES</Text>
        <Text style={styles.sub}>Debates organizados por saga y obra</Text>
      </View>

      {/* 1. SELECTOR DE SAGAS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sagaScroll}>
        {todasLasSagas.map(saga => (
          <TouchableOpacity
            key={saga}
            onPress={() => {
              setSagaSeleccionada(saga);
              const primerLibro = SISTEMAS_COSMERE_COMPLETO.flatMap(s => s.libros).find(l => l.saga === saga);
              if (primerLibro) setLibroSeleccionadoId(primerLibro.id);
              setCapituloTeoria('1');
            }}
            style={[styles.sagaChip, sagaSeleccionada === saga && styles.sagaChipActive]}
          >
            <Text style={[styles.sagaChipText, sagaSeleccionada === saga && styles.sagaChipTextActive]}>{saga}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 2. SELECTOR DE LIBROS DE ESA SAGA */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookScroll}>
        {librosDeSaga.map(lib => (
          <TouchableOpacity
            key={lib.id}
            onPress={() => {
              setLibroSeleccionadoId(lib.id);
              setCapituloTeoria('1');
            }}
            style={[styles.bookChip, libroSeleccionadoId === lib.id && styles.bookChipActive]}
          >
            <Text style={[styles.bookChipText, libroSeleccionadoId === lib.id && styles.bookChipTextActive]}>
              📖 {lib.titulo}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 3. CAJA PARA CREAR COMENTARIO */}
      <View style={styles.postBox}>
        <TextInput
          style={styles.postInput}
          placeholder="Escribe tu teoría sobre este libro..."
          placeholderTextColor="#64748b"
          value={nuevoTexto}
          onChangeText={setNuevoTexto}
          multiline
        />
        <View style={styles.postFooter}>
          <Text style={styles.capLabel}>Hasta qué capítulo spoilea:</Text>
          <TextInput
            style={styles.capInput}
            value={capituloTeoria}
            onChangeText={setCapituloTeoria}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.postBtn} onPress={publicar}>
            <Text style={styles.postBtnText}>Publicar Teoría</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 4. LISTA DE COMENTARIOS FILTRADOS POR ESE LIBRO */}
      <FlatList
        data={comentariosFiltrados}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay teorías publicadas aún para este libro. ¡Sé el primero!</Text>
        }
        renderItem={({ item }) => {
          const libroComentario = SISTEMAS_COSMERE_COMPLETO.flatMap(s => s.libros).find(libro => libro.id === item.libroId);
          const capUsuarioEnEseLibro = Math.max(
            librosLeidos[item.libroId] ? (libroComentario?.totalCapitulos ?? 0) : 0,
            capituloActualPorLibro[item.libroId] ?? 0
          );
          const esSpoiler = item.capituloMaximo > capUsuarioEnEseLibro;
          const estaRevelado = reveladosManualmente[item.id];

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.author}>{item.usuario}</Text>
                <Text style={styles.bookTag}>Cap. {item.capituloMaximo}</Text>
              </View>

              {esSpoiler && !estaRevelado ? (
                <TouchableOpacity style={styles.spoilerShield} onPress={() => toggleRevelar(item.id)}>
                  <Text style={styles.spoilerWarn}>⚠️ CONTIENE SPOILERS</Text>
                  <Text style={styles.spoilerPrompt}>Abarca hasta el capítulo {item.capituloMaximo}. Pulsa si deseas leerlo.</Text>
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
  header: { padding: 14, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  sub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  sagaScroll: { maxHeight: 44, paddingHorizontal: 12, marginVertical: 6 },
  sagaChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0f172a', borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#1e293b' },
  sagaChipActive: { backgroundColor: '#1e3a8a', borderColor: '#38bdf8' },
  sagaChipText: { color: '#94a3b8', fontSize: 11, fontWeight: 'bold' },
  sagaChipTextActive: { color: '#ffffff' },
  bookScroll: { maxHeight: 40, paddingHorizontal: 12, marginBottom: 8 },
  bookChip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1e293b', borderRadius: 8, marginRight: 6 },
  bookChipActive: { backgroundColor: '#0284c7' },
  bookChipText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  bookChipTextActive: { color: '#ffffff', fontWeight: 'bold' },
  postBox: { backgroundColor: '#0f172a', marginHorizontal: 12, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  postInput: { color: '#ffffff', minHeight: 48, fontSize: 12, textAlignVertical: 'top' },
  postFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 8, marginTop: 6 },
  capLabel: { color: '#64748b', fontSize: 10 },
  capInput: { backgroundColor: '#090d16', color: '#fff', width: 44, textAlign: 'center', borderRadius: 6, fontSize: 11, paddingVertical: 2, borderWidth: 1, borderColor: '#334155' },
  postBtn: { backgroundColor: '#0284c7', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  postBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 24, fontStyle: 'italic', fontSize: 12 },
  card: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  author: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
  bookTag: { color: '#64748b', fontSize: 10 },
  content: { color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  spoilerShield: { backgroundColor: '#1c1917', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#b91c1c', marginVertical: 6 },
  spoilerWarn: { color: '#f87171', fontWeight: 'bold', fontSize: 10 },
  spoilerPrompt: { color: '#9ca3af', fontSize: 11 },
  cardFooter: { borderTopWidth: 1, borderColor: '#1e293b', paddingTop: 6, alignItems: 'flex-end' },
  likeBtn: { paddingVertical: 2, paddingHorizontal: 6 },
  likeText: { color: '#38bdf8', fontSize: 11, fontWeight: '700' }
});