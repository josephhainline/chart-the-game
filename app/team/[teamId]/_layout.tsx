import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/constants/theme';

/** Team-level stack: the tab group plus its modal forms. */
export default function TeamStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-game" options={{ presentation: 'modal' }} />
      <Stack.Screen name="new-player" options={{ presentation: 'modal' }} />
      <Stack.Screen name="player/[playerId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
