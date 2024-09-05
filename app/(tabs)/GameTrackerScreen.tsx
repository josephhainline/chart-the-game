import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function GameTrackerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Tracker</Text>
      {/* Add your game tracking component here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
