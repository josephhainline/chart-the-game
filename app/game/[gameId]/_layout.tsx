import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/constants/theme';

/** Game-level stack: the in-game tab group plus its modal forms. */
export default function GameStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="finish" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
