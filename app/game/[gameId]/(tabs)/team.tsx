import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import AppHeader from '@/components/AppHeader';
import LineupEditor from '@/components/LineupEditor';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { gameTitle } from '@/lib/format';
import { useGame, useStore, useTeam, useTeamPlayers } from '@/lib/store';

/** Game level › Team: this game's batting order (starts as a copy of the default lineup). */
export default function GameTeamScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { setGameLineup } = useStore();
  const game = useGame(gameId);
  const team = useTeam(game?.teamId);
  const players = useTeamPlayers(game?.teamId);

  if (!game) return null;

  const useDefaultLineup = async () => {
    if (!team) return;
    const ok = await confirmAction(
      'Use default lineup?',
      "This replaces this game's batting order with the team's default lineup.",
      'Replace',
    );
    if (ok) setGameLineup(game.id, team.defaultLineup.map((s) => ({ ...s })));
  };

  return (
    <Screen>
      <AppHeader
        context={gameTitle(game)}
        contextColor={colors.orange}
        onBack={() => router.replace(`/team/${game.teamId}`)}
      />
      <LineupEditor
        slots={game.lineup}
        players={players}
        onChange={(slots) => setGameLineup(game.id, slots)}
        title="Batting Order"
        caption="Changes only apply to this game"
        headerRight={
          <Button
            title="Use default lineup"
            variant="ghost"
            textStyle={{ color: colors.orange }}
            onPress={useDefaultLineup}
            disabled={!team}
          />
        }
      />
    </Screen>
  );
}
