import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useCosmere } from '../context/CosmereContext';

interface Mensaje {
  id: string;
  emisor: 'usuario' | 'hoid';
  texto: string;
}

export const HoidScreen: React.FC = () => {
  const { librosLeidos } = useCosmere();
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      emisor: 'hoid',
      texto: 'Saludos, viajero. Soy Hoid, bufón de reyes, narrador errante y conocedor de muchas cosas que no deberían saberse. Pregunta lo que desees... pero recuerda: un buen truco se arruina si miras tras el telón antes de tiempo.'
    }
  ]);
  const [input, setInput] = useState('');

  // Simulación del motor RAG con personalidad y filtro antiespoiler
  const enviarMensaje = () => {
    if (!input.trim()) return;

    const textoUsuario = input.trim();
    const nuevoMsgUsuario: Mensaje = { id: Date.now().toString(), emisor: 'usuario', texto: textoUsuario };
    setMensajes(prev => [...prev, nuevoMsgUsuario]);
    setInput('');

    setTimeout(() => {
      let respuestaHoid = '';
      const minuscula = textoUsuario.toLowerCase();

      // Control antiespoiler estricto
      if ((minuscula.includes('thaidakar') || minuscula.includes('kelsier')) && !librosLeidos['sh']) {
        respuestaHoid = '¿Thaidakar? Ah, pronuncias nombres que resuenan en las sombras del Reino Cognitivo. Tus ojos aún no han visto esa historia (requiere "Historia Secreta"). Sé paciente, muchacho.';
      } else if ((minuscula.includes('espada') || minuscula.includes('sangre')) && !librosLeidos['wor']) {
        respuestaHoid = 'Ciertas hojas de metal negro tienen un apetito voraz por la Investidura... y una molesta manía de hablar. Pero aún no has llegado a ese duelo en las llanuras.';
      } else if (minuscula.includes('esquirla') || minuscula.includes('adonalsium')) {
        respuestaHoid = 'Adonalsium fue hecho pedazos por dieciséis personas con intenciones cuestionables. Yo estaba allí, ¿sabes? Pero decidí no tomar una de esas cargas divinas. Demasiado trabajo y poco tiempo para afinar la flauta.';
      } else if (minuscula.includes('investidura')) {
        respuestaHoid = 'La Investidura es el aliento de la Creación. Adopta la forma de niebla, luz en gemas, alientos de color o metales en el estómago. Cambia el envase, pero la melodía de fondo siempre es la misma.';
      } else {
        respuestaHoid = `Interesante dilema sobre "${textoUsuario}". Las historias son lo único que nos separa del abismo, pero te aseguro que todo está conectado en la sinfonía del Cosmere. Sigue leyendo y hallarás las respuestas.`;
      }

      setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), emisor: 'hoid', texto: respuestaHoid }]);
    }, 800);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HOID (SAGAZ)</Text>
        <Text style={styles.headerSub}>Omnisciente pero respetuoso con tu lectura</Text>
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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Pregúntale a Hoid sobre el lore..."
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
  header: { padding: 16, backgroundColor: '#0f172a', borderBottomWidth: 1, borderColor: '#1e293b' },
  headerTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  headerSub: { color: '#818cf8', fontSize: 11, marginTop: 2 },
  chatList: { padding: 16, paddingBottom: 20 },
  bubble: { padding: 14, borderRadius: 14, marginBottom: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#38bdf8' },
  hoidBubble: { alignSelf: 'flex-start', backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#4338ca' },
  bubbleAuthor: { fontSize: 9, fontWeight: '900', color: '#cbd5e1', marginBottom: 4 },
  bubbleText: { color: '#ffffff', fontSize: 13, lineHeight: 19 },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#0f172a', borderTopWidth: 1, borderColor: '#1e293b' },
  input: { flex: 1, backgroundColor: '#090d16', color: '#ffffff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#334155', fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }
});