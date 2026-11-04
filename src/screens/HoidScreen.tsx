import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useCosmere } from '../context/CosmereContext';
import { HoidService } from '../hoid/HoidService';

interface Mensaje {
  id: string;
  emisor: 'usuario' | 'hoid';
  texto: string;
}

export const HoidScreen: React.FC = () => {
  const { librosLeidos, capituloActualPorLibro } = useCosmere();
  const [cargando, setCargando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      emisor: 'hoid',
      texto: 'Saludos, viajero de mundos. Soy Sagaz (Cephandrius para quienes me conocieron antes del Gran Cataclismo). Pregúntame sobre cualquier misterio, filosofía o personaje... pero si tus ojos no han leído esa historia, tendré que tocarte una melodía evasiva.'
    }
  ]);
  const [input, setInput] = useState('');


  const enviarMensaje = async () => {
    if (!input.trim() || cargando) return;

    const textoUsuario = input.trim();
    const nuevoMsgUsuario: Mensaje = { id: Date.now().toString(), emisor: 'usuario', texto: textoUsuario };
    setMensajes(prev => [...prev, nuevoMsgUsuario]);
    setInput('');
    setCargando(true);

    const service = new HoidService();
    const reading = Object.keys(capituloActualPorLibro).map(bookId => ({\n      bookId,\n      chapter: capituloActualPorLibro[bookId],\n      completed: !!librosLeidos[bookId],\n    }));
    const result = await service.answer({ question: textoUsuario, reading });
    setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), emisor: 'hoid', texto: result.texto }]);
    setCargando(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>HOID (SAGAZ) • IA CANÓNICA</Text>
          <Text style={styles.headerSub}>Filtro de conocimiento adaptado a tus lecturas</Text>
        </View>
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
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.sendButton} onPress={enviarMensaje}>
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
  keyBtn: { backgroundColor: '#1e293b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  keyBtnText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  keyBox: { backgroundColor: '#131e36', padding: 12, borderBottomWidth: 1, borderColor: '#1e293b' },
  keyLabel: { color: '#cbd5e1', fontSize: 11, marginBottom: 6 },
  keyInput: { backgroundColor: '#090d16', color: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, fontSize: 12, borderWidth: 1, borderColor: '#334155' },
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