import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import AppHeader from '@/components/AppHeader';
import LineupEditor from '@/components/LineupEditor';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { gameTitle, playerName } from '@/lib/format';
import { useGame, useGameAtBats, useStore, useTeam, useTeamPlayers } from '@/lib/store';
import type { Id, LineupSlot } from '@/lib/types';

/** Game level › Team: this game's batting order (starts as a copy of the default lineup). */
export default function GameTeamScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { setGameLineup } = useStore();
  const game = useGame(gameId);
  const team = useTeam(game?.teamId);
  const players = useTeamPlayers(game?.teamId);
  const atBats = useGameAtBats(gameId);

  if (!game) return null;

  const applyLineup = (slots: LineupSlot[]) => setGameLineup(game.id, slots);

  // Taking a batter out with the remove control keeps his at-bats; when he has
  // some, say so before his row drops to the bottom of the scorebook.
  const confirmRemove = (playerId: Id): Promise<boolean> => {
    const player = players.find((p) => p.id === playerId);
    const count = atBats.filter((ab) => ab.side === 'us' && ab.batterId === playerId).length;
    if (!player || count === 0) return Promise.resolve(true);
    const noun = count === 1 ? '1 at-bat' : `${count} at-bats`;
    const stays = count === 1 ? 'It stays' : 'They stay';
    return confirmAction(
      `Remove ${playerName(player)}?`,
      `He has ${noun} this game. ${stays} in the stats; his row moves to the bottom of the scorebook.`,
      'Remove',
    );
  };

  const useDefaultLineup = async () => {
    if (!team) return;
    const ok = await confirmAction(
      'Use default lineup?',
      "This replaces this game's batting order with the team's default lineup.",
      'Replace',
    );
    if (ok) applyLineup(team.defaultLineup.map((s) => ({ playerId: s.playerId })));
  };

  return (
    <Screen>
      <AppHeader
        context={gameTitle(game)}
        contextColor={colors.orange}
        backHref={`/team/${game.teamId}`}
      />
      {/* No title block: like the prototype (cecb2d5c…) the order starts right under the game band. */}
      <LineupEditor
        slots={game.lineup}
        players={players}
        onChange={applyLineup}
        confirmRemove={confirmRemove}
        onSubstitute={game.status === 'final' ? undefined : (playerId) => router.push(`/game/${game.id}/sub/${playerId}`)}
        footer={
          <Button
            title="Use default lineup"
            variant="ghost"
            textStyle={styles.footerText}
            onPress={useDefaultLineup}
            disabled={!team}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerText: { color: colors.orange },
});
