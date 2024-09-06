import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Trash2 } from 'lucide-react-native';

type Player = {
  id: string;
  name: string;
  number: string;
};

// Helper function to capitalize only fully lowercase words
const capitalizeWords = (str: string) => {
  return str.replace(/\b[a-z]+\b/g, word => word.charAt(0).toUpperCase() + word.slice(1));
};

export default function TeamScreen() {
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [isEditingTeamName, setIsEditingTeamName] = useState(false);

  const addPlayer = () => {
    if (newPlayerName && newPlayerNumber) {
      const capitalizedName = capitalizeWords(newPlayerName.trim());
      setPlayers([...players, { id: Date.now().toString(), name: capitalizedName, number: newPlayerNumber }]);
      setNewPlayerName("");
      setNewPlayerNumber("");
    }
  };

  const removePlayer = (id: string) => {
    setPlayers(players.filter(player => player.id !== id));
  };

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Team Information</Text>
        {isEditingTeamName ? (
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Enter team name"
            />
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setTeamName(capitalizeWords(teamName.trim()));
                setIsEditingTeamName(false);
              }}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.formRow}>
            <Text style={styles.teamName}>{teamName || "Unnamed Team"}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setIsEditingTeamName(true)}
            >
              <Text style={styles.buttonText}>Edit Team Name</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Player</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Player Name</Text>
          <TextInput
            style={styles.input}
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            placeholder="Enter player name"
          />
          <Text style={styles.label}>Player Number</Text>
          <TextInput
            style={styles.input}
            value={newPlayerNumber}
            onChangeText={setNewPlayerNumber}
            placeholder="Enter player number"
          />
          <TouchableOpacity style={styles.button} onPress={addPlayer}>
            <Text style={styles.buttonText}>Add Player</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Player Roster</Text>
        {sortedPlayers.length === 0 ? (
          <Text style={styles.emptyRoster}>No players added yet.</Text>
        ) : (
          <FlatList
            data={sortedPlayers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.playerItem}>
                <Text>{item.name} (#{item.number})</Text>
                <TouchableOpacity onPress={() => removePlayer(item.id)}>
                  <Trash2 size={20} color="#000" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  form: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyRoster: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
});
