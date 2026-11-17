import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { createHoidEditorialRuntime, getHoidEditorialRegistryStatus } from '../hoid/editorialRegistry';
import { createHoidCursorEvidenceRuntime, projectHoidCursorProgressSnapshot } from '../hoid/cursorEvidenceRuntime';
import { fingerprintHoidCursorProgressProjection } from '../hoid/knowledgeGraph';
import { createHoidConversationGateway } from '../hoid/conversationGateway';
import type { HoidRecommendation } from '../hoid/recommendations';

const editorialRuntime = createHoidEditorialRuntime();
const hoidRuntime = editorialRuntime ? createHoidCursorEvidenceRuntime(editorialRuntime) : null;

interface Mensaje {
  id: string;
  emisor: 'usuario' | 'hoid';
  texto: string;
}

export const HoidScreen: React.FC = () => {
  const {
    hoidCursorProgressSnapshot,
    getHoidCursorProgressSnapshot,
    progresoPersistenciaEstado,
  } = useCosmere();
  const progressReaderRef = useRef(getHoidCursorProgressSnapshot);
  progressReaderRef.current = getHoidCursorProgressSnapshot;
  const conversationGateway = hoidRuntime
    ? createHoidConversationGateway({ runtime: hoidRuntime, getCurrentProgress: () => progressReaderRef.current() })
    : null;

  const [cargando, setCargando] = useState(false);
  const [cargandoRecomendaciones, setCargandoRecomendaciones] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      emisor: 'hoid',
      texto: 'Saludos, viajero de mundos. Soy Sagaz. Estoy usando el runtime estricto con el progreso de lectura vinculado a la edición. El registro editorial todavía está vacío, así que no inventaré hechos ni recurriré a respuestas libres.'
    }
  ]);
  const [input, setInput] = useState('');
  const [recomendaciones, setRecomendaciones] = useState<readonly HoidRecommendation[]>([]);
  const [recommendationRevision, setRecommendationRevision] = useState<number | null>(null);
  const [recommendationFingerprint, setRecommendationFingerprint] = useState<string | null>(null);
  const [recommendationMessage, setRecommendationMessage] = useState('');

  useEffect(() => {
    setRecomendaciones([]);
    setRecommendationRevision(null);
    setRecommendationFingerprint(null);
    setRecommendationMessage('');
  }, [hoidCursorProgressSnapshot, progresoPersistenciaEstado]);

  const enviarMensaje = async () => {
    if (!input.trim() || cargando || progresoPersistenciaEstado !== 'ready') return;
    const currentProgress = progressReaderRef.current();
    if (!currentProgress) return;

    const textoUsuario = input.trim();
    const nuevoMsgUsuario: Mensaje = { id: Date.now().toString(), emisor: 'usuario', texto: textoUsuario };
    setMensajes(prev => [...prev, nuevoMsgUsuario]);
    setInput('');
    setCargando(true);

    try {
      const result = conversationGateway
        ? await conversationGateway.answer({ question: textoUsuario, progress: currentProgress })
        : null;
      const respuesta = result?.status === 'ready'
        ? result.answer.text
        : result?.reason === 'progress-changed'
          ? 'Tu progreso de lectura ha cambiado mientras preparaba la respuesta. He descartado el resultado; vuelve a formular la pregunta.'
          : result?.reason === 'invalid-progress'
            ? 'No puedo verificar el progreso actual. La respuesta queda bloqueada para evitar spoilers.'
            : 'El runtime de conocimiento no está disponible. No se enviará la pregunta a un proveedor alternativo.';
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        emisor: 'hoid',
        texto: respuesta,
      }]);
    } catch {
      setMensajes(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        emisor: 'hoid',
        texto: 'No puedo responder de forma verificable en este momento. No enviaré la pregunta a un proveedor no configurado ni completaré la respuesta mediante suposiciones.',
      }]);
    } finally {
      setCargando(false);
    }
  };

  const cargarRecomendaciones = async () => {
    if (cargandoRecomendaciones || progresoPersistenciaEstado !== 'ready' || !conversationGateway) return;
    const currentProgress = progressReaderRef.current();
    if (!currentProgress) {
      setRecomendaciones([]);
      setRecommendationRevision(null);
      setRecommendationFingerprint(null);
      setRecommendationMessage('No puedo verificar el progreso actual. No mostraré recomendaciones.');
      return;
    }

    setCargandoRecomendaciones(true);
    setRecomendaciones([]);
    setRecommendationRevision(null);
    setRecommendationFingerprint(null);
    setRecommendationMessage('');

    try {
      const result = await conversationGateway.recommend({ progress: currentProgress, limit: 3 });
      if (result.status === 'ready') {
        setRecomendaciones(result.items);
        setRecommendationRevision(result.progressRevision);
        setRecommendationFingerprint(result.progressFingerprint);
        setRecommendationMessage(result.items.length === 0
          ? 'No quedan obras sin empezar en el catálogo actual.'
          : 'Son obras del catálogo que todavía no has empezado; el orden no representa una ruta de lectura.');
      } else {
        setRecomendaciones([]);
        setRecommendationRevision(null);
        setRecommendationFingerprint(null);
        setRecommendationMessage(result.reason === 'progress-changed'
          ? 'Tu progreso ha cambiado. Vuelve a solicitar las recomendaciones.'
          : 'No puedo verificar el progreso o el catálogo. No mostraré recomendaciones.');
      }
    } catch {
      setRecomendaciones([]);
      setRecommendationRevision(null);
      setRecommendationFingerprint(null);
      setRecommendationMessage('No puedo verificar el progreso o el catálogo. No mostraré recomendaciones.');
    } finally {
      setCargandoRecomendaciones(false);
    }
  };

  const liveProgress = progressReaderRef.current();
  const liveProjection = liveProgress ? projectHoidCursorProgressSnapshot(liveProgress) : null;
  const liveFingerprint = liveProjection?.status === 'ready'
    ? fingerprintHoidCursorProgressProjection(liveProjection)
    : null;
  const recommendationsAreCurrent =
    recommendationRevision !== null &&
    recommendationFingerprint !== null &&
    liveProgress !== null &&
    recommendationRevision === liveProgress.revision &&
    recommendationFingerprint === liveFingerprint;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>HOID (SAGAZ) • MODO SEGURO</Text>
          <Text style={styles.headerSub}>
            {progresoPersistenciaEstado === 'loading'
              ? 'Cargando progreso de lectura seguro…'
              : progresoPersistenciaEstado === 'unavailable'
                ? 'Progreso no disponible · consultas bloqueadas'
                : getHoidEditorialRegistryStatus() === 'empty'
                  ? 'Sin afirmaciones editoriales verificadas · runtime estricto'
                  : 'Registro editorial disponible · runtime estricto'}
          </Text>
        </View>
      </View>

      <View style={styles.recommendationPanel}>
        <View style={styles.recommendationHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.recommendationTitle}>DESCUBRIR OBRAS</Text>
            <Text style={styles.recommendationNote}>
              Solo catálogo y progreso; no establece un orden de lectura.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !conversationGateway}
            style={[
              styles.recommendationButton,
              (progresoPersistenciaEstado !== 'ready' || cargandoRecomendaciones || !conversationGateway) && styles.disabledButton,
            ]}
            onPress={cargarRecomendaciones}
          >
            <Text style={styles.recommendationButtonText}>Explorar</Text>
          </TouchableOpacity>
        </View>
        {cargandoRecomendaciones && <ActivityIndicator color="#818cf8" style={{ marginTop: 8 }} />}
        {recommendationMessage.length > 0 && (
          <Text style={styles.recommendationMessage}>{recommendationMessage}</Text>
        )}
        {recommendationsAreCurrent && recomendaciones.map(item => (
          <View key={item.sourceId} style={styles.recommendationItem}>
            <Text style={styles.recommendationItemText}>{item.title}</Text>
            <Text style={styles.recommendationItemMeta}>Todavía no empezada</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={mensajes}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.emisor === 'usuario' ? styles.userBubble : styles.hoidBubble]}>
            <Text style={styles.bubbleAuthor}>{item.emisor === 'usuario' ? 'TÚ' : 'HOID'}</Text>
            <Text style={styles.bubbleText}>{item.texto}</Text>
          </View>
        )}
      />

      {cargando && <ActivityIndicator color="#818cf8" style={{ marginVertical: 8 }} />}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pregúntale a Hoid..."
          placeholderTextColor="#64748b"
          value={input}
          editable={progresoPersistenciaEstado === 'ready'}
          onChangeText={setInput}
        />
        <TouchableOpacity disabled={progresoPersistenciaEstado !== 'ready' || cargando} style={[styles.sendButton, (progresoPersistenciaEstado !== 'ready' || cargando) && styles.disabledButton]} onPress={enviarMensaje}>
          <Text style={styles.sendButtonText}>➔</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  headerTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  headerSub: { color: '#818cf8', fontSize: 11, marginTop: 2 },
  recommendationPanel: { padding: 12, backgroundColor: '#101a2e', borderBottomWidth: 1, borderColor: '#1e293b' },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recommendationTitle: { color: '#e2e8f0', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  recommendationNote: { color: '#94a3b8', fontSize: 10, marginTop: 3 },
  recommendationButton: { backgroundColor: '#312e81', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  recommendationButtonText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  recommendationMessage: { color: '#cbd5e1', fontSize: 11, lineHeight: 16, marginTop: 8 },
  recommendationItem: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#26344d', marginTop: 7 },
  recommendationItemText: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  recommendationItemMeta: { color: '#94a3b8', fontSize: 10, marginTop: 2 },
  disabledButton: { opacity: 0.45 },
  chatList: { padding: 16, paddingBottom: 20 },
  bubble: { padding: 14, borderRadius: 14, marginBottom: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#0284c7' },
  hoidBubble: { alignSelf: 'flex-start', backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#4338ca' },
  bubbleAuthor: { fontSize: 9, fontWeight: '900', color: '#cbd5e1', marginBottom: 4 },
  bubbleText: { color: '#ffffff', fontSize: 13, lineHeight: 19 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#0f172a', borderTopWidth: 1, borderColor: '#1e293b' },
  input: { flex: 1, backgroundColor: '#090d16', color: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155', fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});
