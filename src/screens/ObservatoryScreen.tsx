import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SISTEMAS_COSMERE_COMPLETO } from '../data/cosmereUniverse';
import { GalaxyScene } from '../features/observatory/components/GalaxyScene';



export const ObservatoryScreen = () => {
  const [selectedId, setSelectedId] = useState(SISTEMAS_COSMERE_COMPLETO[0]?.id);
  const [focusedId, setFocusedId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'galaxy' | 'system'>('galaxy');
  const selectedSystem = useMemo(
    () => SISTEMAS_COSMERE_COMPLETO.find((system) => system.id === selectedId) || SISTEMAS_COSMERE_COMPLETO[0],
    [selectedId],
  );



  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>CARTOGRAFÍA ESTELAR · REINO FÍSICO</Text>
        <Text style={styles.title}>Cosmere Observatory</Text>
        <Text style={styles.subtitle}>Un viaje entre sistemas. Selecciona un astro para abrir su registro.</Text>
      </View>

      <View style={styles.galaxyPanel}>
        <View style={styles.panelTopline}>
          <Text style={styles.panelLabel}>{viewMode === 'galaxy' ? 'VISTA GALÁCTICA' : 'SISTEMA ESTELAR'}</Text>
          <View style={styles.modePill}><Text style={styles.modeText}>ESCALA ARTÍSTICA</Text></View>
        </View>
        <View style={styles.galaxyStage}>
          <GalaxyScene
            selectedSystemId={selectedId}
            focusedSystemId={focusedId}
            viewMode={viewMode}
            onSelectSystem={(id) => { setSelectedId(id); setFocusedId(id); }}
            onReset={() => { setFocusedId(undefined); setViewMode('galaxy'); }}
          />
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
            <TouchableOpacity
              key={system.id}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar sistema ${system.planeta}`}
              accessibilityState={{ selected: active }}
              onPress={() => { setSelectedId(system.id); setFocusedId(system.id); setViewMode('galaxy'); }}
              style={[styles.systemChip, active && { borderColor: system.colorAura, backgroundColor: '#172235' }]}
            >
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
          {viewMode === 'galaxy' ? (
            <TouchableOpacity style={styles.exploreButton} onPress={() => setViewMode('system')} accessibilityRole="button">
              <Text style={styles.exploreButtonText}>EXPLORAR SISTEMA ESTELAR  ↗</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.systemNotice}>
              <Text style={styles.systemNoticeTitle}>CARTOGRAFÍA DEL SISTEMA</Text>
              <Text style={styles.systemNoticeText}>Esta vista es un esquema artístico de navegación. El catálogo todavía no contiene datos verificados suficientes para representar planetas, lunas u órbitas de este sistema; no se muestran cuerpos inventados.</Text>
              <TouchableOpacity onPress={() => setViewMode('galaxy')} style={styles.backButton}>
                <Text style={styles.backButtonText}>← VOLVER A LA GALAXIA</Text>
              </TouchableOpacity>
            </View>
          )}
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
      <Text style={styles.footer}>FASE III · EXPLORACIÓN DE SISTEMAS</Text>
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
  exploreButton: { alignSelf: 'flex-start', backgroundColor: '#d6b477', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, marginTop: 16 },
  exploreButtonText: { color: '#17202c', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  systemNotice: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#0b1422', borderWidth: 1, borderColor: '#35445a' },
  systemNoticeTitle: { color: '#d6b477', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  systemNoticeText: { color: '#aab7c8', fontSize: 11, lineHeight: 17, marginTop: 7 },
  backButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 6 },
  backButtonText: { color: '#d6b477', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  divider: { height: 1, backgroundColor: '#29364a', marginVertical: 13 },
  metaLabel: { color: '#d6b477', fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 9, marginBottom: 6 },
  shardRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shardPill: { backgroundColor: '#1b293b', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  shardText: { color: '#d7e0eb', fontSize: 10 },
  metaValue: { color: '#c5cfdb', fontSize: 11 },
  disclaimer: { color: '#77869a', fontSize: 9, lineHeight: 14, marginTop: 14 },
  footer: { color: '#58677b', fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center', marginTop: 22 },
});
