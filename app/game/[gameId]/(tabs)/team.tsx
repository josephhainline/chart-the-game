import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import AppHeader from '@/components/AppHeader';
import LineupEditor from '@/components/LineupEditor';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { colors } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { gameTitle } from '@/lib/format';
import { useGame, useStore, useTeam, useTeamPlayers } from '@/lib/store';
import type { LineupSlot } from '@/lib/types';

/** Game level › Team: this game's batting order (starts as a copy of the default lineup). */
export default function GameTeamScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { setGameLineup, setPitcher } = useStore();
  const game = useGame(gameId);
  const team = useTeam(game?.teamId);
  const players = useTeamPlayers(game?.teamId);

  if (!game) return null;

  // The P badge and the pitcher are one thing during a game: giving a batter
  // the P position makes them the pitcher that pitching W/L are credited to.
  const applyLineup = (slots: LineupSlot[]) => {
    setGameLineup(game.id, slots);
    const wasP = new Set(game.lineup.filter((s) => s.position === 'P').map((s) => s.playerId));
    const newP = slots.find((s) => s.position === 'P' && !wasP.has(s.playerId));
    if (newP && newP.playerId !== game.pitcherId) setPitcher(game.id, newP.playerId);
  };

  const useDefaultLineup = async () => {
    if (!team) return;
    const ok = await confirmAction(
      'Use default lineup?',
      "This replaces this game's batting order with the team's default lineup.",
      'Replace',
    );
    if (ok) applyLineup(team.defaultLineup.map((s) => ({ ...s })));
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
