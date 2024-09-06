import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { ArrowUpDown, Trash2, Plus } from 'lucide-react-native';
import { useTeam, Player } from '../context/team-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';

export default function LineupScreen() {
  const { team } = useTeam();
  const [lineup, setLineup] = useState<Player[]>([]);

  const loadLineup = async () => {
    try {
      const savedLineup = await AsyncStorage.getItem('lineup');
      if (savedLineup) setLineup(JSON.parse(savedLineup));
    } catch (error) {
      console.error('Failed to load lineup:', error);
    }
  };

  const saveLineup = async (newLineup: Player[]) => {
    try {
      await AsyncStorage.setItem('lineup', JSON.stringify(newLineup));
    } catch (error) {
      console.error('Failed to save lineup:', error);
    }
  };

  const removeFromLineup = (playerId: string) => {
    const newLineup = lineup.filter(p => p.id !== playerId);
    setLineup(newLineup);
    saveLineup(newLineup);
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const newLineup = [...lineup];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < lineup.length) {
      [newLineup[index], newLineup[newIndex]] = [newLineup[newIndex], newLineup[index]];
      setLineup(newLineup);
      saveLineup(newLineup);
    }
  };

  const addToLineup = (player: Player) => {
    if (!lineup.some(p => p.id === player.id)) {
      const newLineup = [...lineup, player];
      setLineup(newLineup);
      saveLineup(newLineup);
    }
  };

  const availablePlayers = team?.players.filter(p => !lineup.some(lp => lp.id === p.id)) || [];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
         {team?.name || "Unnamed Team"} Roster
        </Text>
        <FlatList
          data={availablePlayers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.playerItem}>
              <Text>{item.name} (#{item.number})</Text>
              <TouchableOpacity onPress={() => addToLineup(item)}>
                <Plus size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Lineup</Text>
        {lineup.length === 0 ? (
          <Text style={styles.emptyText}>No players in the lineup yet.</Text>
        ) : (
          <FlatList
            data={lineup}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.playerItem}>
                <Text>{index + 1}. {item.name} (#{item.number})</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity onPress={() => movePlayer(index, 'up')} disabled={index === 0}>
                    <ArrowUpDown size={20} style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => movePlayer(index, 'down')} disabled={index === lineup.length - 1}>
                    <ArrowUpDown size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeFromLineup(item.id)}>
                    <Trash2 size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 }, // Add this line
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: '700' as const, marginBottom: 10 },
  pickerContainer: { flexDirection: 'row' as const, alignItems: 'center' as const },
  picker: { flex: 1, height: 50 },
  button: { backgroundColor: '#007AFF', padding: 10, borderRadius: 5, marginLeft: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#666' },
  playerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5, marginBottom: 5 },
  buttonGroup: { flexDirection: 'row', alignItems: 'center' },
});
