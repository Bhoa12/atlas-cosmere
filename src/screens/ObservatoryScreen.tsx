import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SISTEMAS_COSMERE_COMPLETO, SistemaPlanetario } from '../data/cosmereUniverse';

const STAR_POSITIONS = [
  { left: '8%', top: '13%', size: 2 }, { left: '21%', top: '28%', size: 3 },
  { left: '34%', top: '9%', size: 2 }, { left: '48%', top: '21%', size: 2 },
  { left: '63%', top: '10%', size: 3 }, { left: '79%', top: '24%', size: 2 },
  { left: '91%', top: '12%', size: 2 }, { left: '13%', top: '72%', size: 2 },
  { left: '29%', top: '83%', size: 2 }, { left: '44%', top: '69%', size: 3 },
  { left: '71%', top: '78%', size: 2 }, { left: '88%', top: '67%', size: 3 },
  { left: '56%', top: '91%', size: 2 }, { left: '5%', top: '48%', size: 2 },
];

export const ObservatoryScreen = () => {
  const [selectedId, setSelectedId] = useState(SISTEMAS_COSMERE_COMPLETO[0]?.id);
  const selectedSystem = useMemo(
    () => SISTEMAS_COSMERE_COMPLETO.find((system) => system.id === selectedId) || SISTEMAS_COSMERE_COMPLETO[0],
    [selectedId],
  );

  const getNodePosition = (index: number) => {
    const angle = (index / Math.max(SISTEMAS_COSMERE_COMPLETO.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { left: `${50 + Math.cos(angle) * 34}%`, top: `${50 + Math.sin(angle) * 34}%` };
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>CARTOGRAFÍA ESTELAR · REINO FÍSICO</Text>
        <Text style={styles.title}>Cosmere Observatory</Text>
        <Text style={styles.subtitle}>Un viaje entre sistemas. Selecciona un astro para abrir su registro.</Text>
      </View>

      <View style={styles.galaxyPanel}>
        <View style={styles.panelTopline}>
          <Text style={styles.panelLabel}>VISTA GALÁCTICA</Text>
          <View style={styles.modePill}><Text style={styles.modeText}>ESCALA ARTÍSTICA</Text></View>
        </View>
        <View style={styles.galaxyStage}>
          {STAR_POSITIONS.map((star, index) => (
            <View key={index} style={[styles.star, { left: star.left, top: star.top, width: star.size, height: star.size }]} />
          ))}
          <View style={styles.nebulaOne} />
          <View style={styles.nebulaTwo} />
          <View style={styles.galaxyCoreOuter} />
          <View style={styles.galaxyCoreInner} />
          {SISTEMAS_COSMERE_COMPLETO.map((system, index) => {
            const position = getNodePosition(index);
            const active = selectedSystem?.id === system.id;
            return (
              <TouchableOpacity
                key={system.id}
                accessibilityRole="button"
                accessibilityLabel={`Seleccionar sistema ${system.nombre}`}
                onPress={() => setSelectedId(system.id)}
                style={[styles.systemNode, position, { borderColor: system.colorAura }, active && { backgroundColor: system.colorAura, transform: [{ scale: 1.18 }] }]}
              >
                <Text style={[styles.nodeText, active && styles.activeNodeText]}>{system.planeta.slice(0, 3).toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.coreCaption}>COSMERE</Text>
        </View>
        <Text style={styles.legend}>Representación artística: posiciones, tamaños y distancias no están a escala astronómica.</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sistemas catalogados</Text>
        <Text style={styles.count}>{SISTEMAS_COSMERE_COMPLETO.length} REGISTROS</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.systemList}>
        {SISTEMAS_COSMERE_COMPLETO.map((system) => {
          const active = selectedSystem?.id === system.id;
          return (
            <TouchableOpacity key={system.id} onPress={() => setSelectedId(system.id)} style={[styles.systemChip, active && { borderColor: system.colorAura, backgroundColor: '#172235' }]}>
              <View style={[styles.chipDot, { backgroundColor: system.colorAura }]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{system.planeta}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedSystem && (
        <View style={[styles.detailCard, { borderColor: selectedSystem.colorAura }]}>
          <View style={styles.detailTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailEyebrow}>SISTEMA SELECCIONADO</Text>
              <Text style={[styles.planetName, { color: selectedSystem.colorAura }]}>{selectedSystem.planeta}</Text>
              <Text style={styles.systemName}>{selectedSystem.nombre}</Text>
            </View>
            <View style={[styles.planetOrb, { borderColor: selectedSystem.colorAura, backgroundColor: selectedSystem.colorAura + '22' }]}>
              <View style={[styles.planetOrbCore, { backgroundColor: selectedSystem.colorAura }]} />
            </View>
          </View>
          <Text style={styles.description}>{selectedSystem.descripcion}</Text>
          <View style={styles.divider} />
          <Text style={styles.metaLabel}>ESQUIRLAS ASOCIADAS</Text>
          <View style={styles.shardRow}>
            {selectedSystem.esquirlas.map((shard) => <View key={shard} style={styles.shardPill}><Text style={styles.shardText}>{shard}</Text></View>)}
          </View>
          <Text style={styles.metaLabel}>REGISTROS DISPONIBLES</Text>
          <Text style={styles.metaValue}>{selectedSystem.libros.length} obras vinculadas · {selectedSystem.sistemasMagicos.length} sistemas mágicos catalogados</Text>
          <Text style={styles.disclaimer}>Los datos descriptivos proceden del catálogo actual de Atlas. La geometría de esta vista es ilustrativa, no una afirmación de canon.</Text>
        </View>
      )}
      <Text style={styles.footer}>FASE I · NAVEGACIÓN GALÁCTICA</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  content: { padding: 16, paddingBottom: 36 },
  heading: { marginBottom: 18 },
  eyebrow: { color: '#9b8b70', fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#f1e7d4', fontSize: 25, fontWeight: '800', letterSpacing: 0.4, marginTop: 5 },
  subtitle: { color: '#9aa8ba', fontSize: 12, lineHeight: 18, marginTop: 6 },
  galaxyPanel: { backgroundColor: '#101a2a', borderRadius: 18, borderWidth: 1, borderColor: '#29364a', padding: 12, overflow: 'hidden' },
  panelTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelLabel: { color: '#d6b477', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  modePill: { borderRadius: 20, borderWidth: 1, borderColor: '#756449', paddingHorizontal: 8, paddingVertical: 4 },
  modeText: { color: '#d6b477', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  galaxyStage: { height: 270, marginTop: 8, position: 'relative', overflow: 'hidden' },
  star: { position: 'absolute', borderRadius: 5, backgroundColor: '#d9e7f5', opacity: 0.75 },
  nebulaOne: { position: 'absolute', width: 210, height: 100, left: '18%', top: '30%', borderRadius: 100, backgroundColor: '#32436b', opacity: 0.28, transform: [{ rotate: '-24deg' }] },
  nebulaTwo: { position: 'absolute', width: 150, height: 72, left: '46%', top: '44%', borderRadius: 100, backgroundColor: '#75506f', opacity: 0.2, transform: [{ rotate: '28deg' }] },
  galaxyCoreOuter: { position: 'absolute', width: 82, height: 82, left: '50%', top: '50%', marginLeft: -41, marginTop: -41, borderRadius: 50, borderWidth: 1, borderColor: '#d6b47766', backgroundColor: '#d6b47712' },
  galaxyCoreInner: { position: 'absolute', width: 24, height: 24, left: '50%', top: '50%', marginLeft: -12, marginTop: -12, borderRadius: 20, backgroundColor: '#e6c88d', opacity: 0.8 },
  systemNode: { position: 'absolute', width: 38, height: 38, marginLeft: -19, marginTop: -19, borderRadius: 22, borderWidth: 1.5, backgroundColor: '#0b1220', alignItems: 'center', justifyContent: 'center' },
  nodeText: { color: '#e7edf5', fontSize: 9, fontWeight: '800' },
  activeNodeText: { color: '#111827' },
  coreCaption: { position: 'absolute', left: '50%', top: '50%', marginTop: 48, marginLeft: -25, color: '#d6b477', fontSize: 8, letterSpacing: 1, fontWeight: '800' },
  legend: { color: '#718096', fontSize: 9, lineHeight: 14, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: '#f1e7d4', fontSize: 15, fontWeight: '800' },
  count: { color: '#77869a', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  systemList: { paddingBottom: 4, gap: 8 },
  systemChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#29364a', paddingHorizontal: 11, paddingVertical: 8, marginRight: 4, backgroundColor: '#101a2a' },
  chipDot: { width: 7, height: 7, borderRadius: 5, marginRight: 7 },
  chipText: { color: '#9aa8ba', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#f1e7d4' },
  detailCard: { backgroundColor: '#101a2a', borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 14 },
  detailTop: { flexDirection: 'row', alignItems: 'center' },
  detailEyebrow: { color: '#8997a9', fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  planetName: { fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginTop: 3 },
  systemName: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  planetOrb: { width: 58, height: 58, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  planetOrbCore: { width: 35, height: 35, borderRadius: 20, opacity: 0.75 },
  description: { color: '#c5cfdb', fontSize: 12, lineHeight: 19, marginTop: 14 },
  divider: { height: 1, backgroundColor: '#29364a', marginVertical: 13 },
  metaLabel: { color: '#d6b477', fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 9, marginBottom: 6 },
  shardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shardPill: { backgroundColor: '#1b293b', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  shardText: { color: '#d7e0eb', fontSize: 10 },
  metaValue: { color: '#c5cfdb', fontSize: 11 },
  disclaimer: { color: '#77869a', fontSize: 9, lineHeight: 14, marginTop: 14 },
  footer: { color: '#58677b', fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 22 },
});
