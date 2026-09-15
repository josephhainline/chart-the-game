import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { EmptyState } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { byLastName, halfLabel, playerShort } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { Id, LineupSlot, Player } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/** Pitcher choices ordered like the Opponent tab: this game's batting order first, then the rest of the roster by last name. */
function orderedRoster(players: Player[], lineup: LineupSlot[] | undefined): Player[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ordered: Player[] = [];
  for (const slot of lineup ?? []) {
    const p = byId.get(slot.playerId);
    if (p && !ordered.includes(p)) ordered.push(p);
  }
  for (const p of [...players].sort(byLastName)) {
    if (!ordered.includes(p)) ordered.push(p);
  }
  return ordered;
}

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
  const options = useMemo(() => orderedRoster(players, lineup), [players, lineup]);

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
            <PitcherChip key={p.id} player={p} selected={p.id === game.pitcherId} onPress={() => pick(p.id)} />
          ))}
        </View>
      )}
      <Text style={styles.hint}>Tap a name to make them the pitcher. Their W/L starts with the next at-bat charted.</Text>

      {credited > 0 ? (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>
              Also credit the {credited} at-bat{credited === 1 ? '' : 's'} already charted this half
            </Text>
            <Text style={type.caption}>
              {current ? `Leave this off if ${playerShort(current)} threw them` : 'Leave this off if the previous pitcher threw them'} ({halfLabel(game.inning, game.half)}).
            </Text>
          </View>
          <Switch
            value={recredit}
            onValueChange={setRecredit}
            trackColor={{ true: colors.primaryDark, false: colors.band }}
            thumbColor={colors.white}
            accessibilityLabel={`Also credit the ${credited} at-bats already charted this half`}
          />
        </View>
      ) : null}
    </ModalScreen>
  );
}

function PitcherChip({ player, selected, onPress }: { player: Player; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pitcher ${playerShort(player)}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed, webCursor]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{playerShort(player)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 4 },
  current: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primaryDark },
  chipText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  chipTextSelected: { color: colors.white },
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
