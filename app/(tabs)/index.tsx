import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Chart The Game</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What is Chart The Game?</Text>
        <Text style={styles.paragraph}>
          CTG is a way to track and analyze baseball performance.
          To Chart The Game, every at-bat is a battle between the batter and the pitcher. 
          The coach judges each at-bat as either a win or a loss for the batter, based on various 
          factors and their expert judgment.
        </Text>
        <Text style={styles.paragraph}>
          These W/L stats are recorded across games and seasons, providing a unique perspective 
          on player performance. They help with automatically ranking players in their team's 
          batting order for future games.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  paragraph: { fontSize: 16, marginBottom: 10 },
});
