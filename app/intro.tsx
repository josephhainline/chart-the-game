// File: ./app/intro.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
    // Navigate to the main app after 3 seconds
    const timer = setTimeout(() => {
      router.replace({ pathname: '/(tabs)' });
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.introText}>Welcome to Chart The Game!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0000FF', // Blue background
    justifyContent: 'center',
    alignItems: 'center',
  },
  introText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
});