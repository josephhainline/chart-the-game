import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { colors, type } from '@/constants/theme';
import { gameTitle } from '@/lib/format';
import { useGame, useTeam } from '@/lib/store';

export default function AllGamesScreen() {
  const { teamId, gameId } = useLocalSearchParams<{ teamId?: string; gameId?: string }>();
  const team = useTeam(teamId);
  const game = useGame(gameId);
  return (
    <Screen>
      <AppHeader subtitle />
      <Text style={[type.body, { padding: 20, color: colors.textMuted }]}>AllGamesScreen — coming soon</Text>
    </Screen>
  );
}
