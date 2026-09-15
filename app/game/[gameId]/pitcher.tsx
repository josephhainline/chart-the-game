import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { Chip, EmptyState } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { halfLabel, lineupFirstRoster, playerShort } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { Id, Player } from '@/lib/types';

/**
 * The in-game pitcher picker: opened from the inning strip's pitcher chip and
 * the dock's "Set pitcher". One tap picks and closes. When at-bats this half
 * already name a pitcher, an off-by-default switch re-credits them too (a
 * pitching change charted late). The Opponent tab's picker is unchanged.
 */
export default function PitcherPickerScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { setPitcher } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const close = useDismiss(game ? `/game/${game.id}` : '/');
  const [recredit, setRecredit] = useState(false);

  const lineup = game?.lineup;
  const options = useMemo(() => lineupFirstRoster(players, lineup), [players, lineup]);

  if (!game) {
    return (
      <ModalScreen title="Our pitcher" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }

  const current = game.pitcherId ? players.find((p) => p.id === game.pitcherId) : undefined;
  // This half's opponent at-bats that already name a pitcher: only these are
  // affected by the switch (unassigned ones are credited to the pick anyway).
  const credited = atBats.filter(
    (ab) => ab.side === 'them' && ab.inning === game.inning && ab.half === game.half && ab.pitcherId !== undefined,
  ).length;
  const switchLabel = `Also credit the ${credited} at-bat${credited === 1 ? '' : 's'} already charted this half`;

  const pick = (playerId: Id) => {
    setPitcher(game.id, playerId, { recreditHalf: recredit });
    close();
  };

  return (
    <ModalScreen title="Our pitcher" color={colors.orange} onClose={close}>
      <Text style={styles.sectionLabel}>Pitching now</Text>
      <Text style={styles.current}>{current ? playerShort(current) : 'No pitcher set'}</Text>

      {options.length === 0 ? (
        <Text style={type.caption}>No players on the roster yet. Add players on the team's Team tab.</Text>
      ) : (
        <View style={styles.chips}>
          {options.map((p) => (
            <Chip key={p.id} label={playerShort(p)} accessibilityLabel={`Pitcher ${playerShort(p)}`} selected={p.id === game.pitcherId} onPress={() => pick(p.id)} />
          ))}
        </View>
      )}
      <Text style={styles.hint}>Tap a name to make them the pitcher. Their W/L starts with the next at-bat charted.</Text>

      {credited > 0 ? (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{switchLabel}</Text>
            <Text style={type.caption}>
              {current ? `Leave this off if ${playerShort(current)} threw them` : 'Leave this off if the previous pitcher threw them'} ({halfLabel(game.inning, game.half)}).
            </Text>
          </View>
          <Switch
            value={recredit}
            onValueChange={setRecredit}
            trackColor={{ true: colors.primaryDark, false: colors.band }}
            thumbColor={colors.white}
            accessibilityLabel={switchLabel}
          />
        </View>
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 4 },
  current: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { ...type.caption, marginTop: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  switchText: { flex: 1, gap: 4 },
  switchLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.text },
  pressed: { opacity: 0.6 },
});
