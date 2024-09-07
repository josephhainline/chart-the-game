import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { ArrowUpDown, Trash2, Plus, GripVertical } from 'lucide-react-native';
import { useTeam, Player } from '../context/team-context';
import { StyleSheet } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';

export default function LineupScreen() {
  const { team, updateLineupOrder } = useTeam();
  const [lineup, setLineup] = useState<Player[]>([]);

  useEffect(() => {
    if (team && team.players) {
      const lineupPlayers = team.lineupOrder
        ? team.lineupOrder
            .map(id => team.players.find(p => p.id === id))
            .filter((p): p is Player => p !== undefined)
        : team.players; // If lineupOrder doesn't exist, use all players
      setLineup(lineupPlayers);
    }
  }, [team]);

  const removeFromLineup = (playerId: string) => {
    const newLineup = lineup.filter(p => p.id !== playerId);
    setLineup(newLineup);
    updateLineupOrder(newLineup.map(p => p.id));
  };

  const addToLineup = (player: Player) => {
    if (!lineup.some(p => p.id === player.id)) {
      const newLineup = [...lineup, player];
      setLineup(newLineup);
      updateLineupOrder(newLineup.map(p => p.id));
    }
  };

  const onDragEnd = ({ data }: { data: Player[] }) => {
    setLineup(data);
    updateLineupOrder(data.map(p => p.id));
  };

  const availablePlayers = team?.players.filter(p => !lineup.some(lp => lp.id === p.id)) || [];

  const renderLineupItem = ({ item, drag, isActive }: RenderItemParams<Player>) => (
    <TouchableOpacity
      onLongPress={drag}
      disabled={isActive}
      style={[styles.playerItem, isActive && styles.activeItem]}
    >
      <View style={styles.playerInfo}>
        <GripVertical size={20} color="#666" />
        <Text style={styles.playerText}>{item.name} (#{item.number})</Text>
      </View>
      <TouchableOpacity onPress={() => removeFromLineup(item.id)}>
        <Trash2 size={20} color="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
          <DraggableFlatList
            data={lineup}
            renderItem={renderLineupItem}
            keyExtractor={(item) => item.id}
            onDragEnd={onDragEnd}
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
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerText: {
    marginLeft: 10,
  },
  activeItem: {
    backgroundColor: '#e0e0e0',
  },
});
