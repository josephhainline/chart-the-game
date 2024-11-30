// File: ./app/(tabs)/statistics.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import CustomHeader from '../../components/CustomHeader';

export default function StatisticsScreen() {
  return (
    <View style={{ flex: 1 }}>
      <CustomHeader title="Statistics" />
      <View style={styles.container}>
        <Text style={styles.title}>Statistics</Text>
        {/* Add your statistics component here */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});