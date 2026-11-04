import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCosmere } from '../context/CosmereContext';

export const RosharAchievementsScreen: React.FC = () => {
  const { rosharAchievements, rosharAchievementState } = useCosmere();
  const unlockedCount = rosharAchievements.filter(item => item.unlocked).length;
  const rewardCount = rosharAchievementState.unlockedRewardIds.length;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>ROSHAR · PROGRESO PERSONAL</Text>
    <Text style={styles.title}>Logros de lectura</Text>
    <Text style={styles.summary}>{unlockedCount}/{rosharAchievements.length} logros desbloqueados · {rewardCount} recompensas obtenidas</Text>
    {rosharAchievements.map(item => <View key={item.id} style={[styles.card, item.unlocked && styles.cardUnlocked, item.hidden && styles.cardHidden]} accessibilityLabel={item.hidden ? 'Logro oculto' : item.title}>
      <Text style={styles.status}>{item.unlocked ? '✓ DESBLOQUEADO' : item.hidden ? '◌ OCULTO' : '○ PENDIENTE'}</Text>
      <Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.description}>{item.description}</Text>
      {item.reward && <View style={styles.reward}><Text style={styles.rewardLabel}>RECOMPENSA</Text><Text style={styles.rewardText}>{item.reward.id}</Text></View>}
    </View>)}
    <Text style={styles.note}>Los logros ocultos permanecen anonimizados hasta que su punto de lectura permite revelarlos.</Text>
  </ScrollView>;
};

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#090d16'},content:{padding:16,paddingBottom:40},
  kicker:{color:'#38bdf8',fontSize:10,fontWeight:'800',letterSpacing:1.5},title:{color:'#f8fafc',fontSize:24,fontWeight:'900',marginTop:4},
  summary:{color:'#94a3b8',fontSize:12,marginTop:6,marginBottom:16},card:{backgroundColor:'#0f172a',borderColor:'#1e293b',borderWidth:1,borderRadius:12,padding:14,marginBottom:10},
  cardUnlocked:{borderColor:'#10b981'},cardHidden:{borderColor:'#334155'},status:{color:'#94a3b8',fontSize:9,fontWeight:'900',letterSpacing:1.1,marginBottom:5},
  cardTitle:{color:'#f8fafc',fontSize:15,fontWeight:'800'},description:{color:'#cbd5e1',fontSize:12,lineHeight:18,marginTop:5},
  reward:{marginTop:10,paddingTop:8,borderTopWidth:1,borderTopColor:'#1e293b'},rewardLabel:{color:'#64748b',fontSize:9,fontWeight:'800',letterSpacing:1},
  rewardText:{color:'#34d399',fontSize:11,fontWeight:'700',marginTop:2},note:{color:'#64748b',fontSize:10,lineHeight:15,marginTop:8}
});