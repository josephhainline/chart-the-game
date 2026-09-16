import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/constants/theme';

/** Game-level stack: the in-game tab group plus its modal forms and sheets. */
export default function GameStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="finish" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="atbat/[atBatId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="batter/[side]/[batterId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="pitching/[playerId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sub/[batterId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="pitcher" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
