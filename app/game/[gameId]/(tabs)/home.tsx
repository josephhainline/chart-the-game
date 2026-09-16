import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { useGame } from '@/lib/store';

/**
 * The Games tab leaves the game: the tab layout intercepts the tab press and
 * navigates to the team's Games. This screen only handles direct navigation
 * (a typed URL or a stale link) and sends the coach to the same place.
 */
export default function GameHomeTab() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useGame(gameId);
  return <Redirect href={game ? `/team/${game.teamId}` : '/'} />;
}
