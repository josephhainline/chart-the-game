import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';

import AppHeader from '@/components/AppHeader';
import LineupEditor from '@/components/LineupEditor';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { rankByHitting } from '@/lib/stats';
import { useStore, useTeam, useTeamGames, useTeamPlayers } from '@/lib/store';
import type { LineupSlot } from '@/lib/types';

/** Team level › Lineup: the default batting order every new game starts from. */
export default function LineupScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { data, setDefaultLineup } = useStore();
  const team = useTeam(teamId);
  const players = useTeamPlayers(teamId);
  const games = useTeamGames(teamId);
  const [ranked, setRanked] = useState(false);

  if (!team) return null;

  const change = (slots: LineupSlot[]) => {
    setRanked(false);
    setDefaultLineup(team.id, slots);
  };

  const rankByCtg = () => {
    const gameIds = new Set(games.map((g) => g.id));
    const ordered = rankByHitting(
      team.defaultLineup.map((s) => s.playerId),
      data.atBats,
      gameIds,
    );
    setDefaultLineup(team.id, ordered.map((playerId) => ({ playerId })));
    setRanked(true);
  };

  return (
    <Screen>
      <AppHeader context={team.name}  />
      <LineupEditor
        slots={team.defaultLineup}
        players={players}
        onChange={change}
        title="Default Lineup:"
        caption={ranked ? 'Ranked by hitting score (W − L) this season' : undefined}
        headerRight={
          <Button
            title="Rank by CTG"
            variant="ghost"
            onPress={rankByCtg}
            disabled={team.defaultLineup.length < 2}
          />
        }
      />
    </Screen>
  );
}
