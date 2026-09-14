import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { colors, fonts, radii, spacing, type } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { byLastName, gameTitle, playerShort } from '@/lib/format';
import { newId } from '@/lib/ids';
import { useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { Id, OpponentBatter, Player } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

const DEFAULT_BATTER_COUNT = 9;

/** "Batter 3" — the generic name for the batter in the given slot (0-based). */
function genericName(index: number): string {
  return `Batter ${index + 1}`;
}

/** True once the coach has typed names or numbers, reordered, or changed the count. */
function isCustomized(batters: OpponentBatter[]): boolean {
  if (batters.length !== DEFAULT_BATTER_COUNT) return true;
  return batters.some((b, i) => b.name !== genericName(i) || Boolean(b.number));
}

/**
 * Opponent tab: who is pitching for us this game, and the other team's
 * batting order (generic "Batter 1…9" by default, editable in place).
 */
export default function OpponentScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const game = useGame(gameId);
  const players = useTeamPlayers(game?.teamId);
  const atBats = useGameAtBats(gameId);
  const { setPitcher, setOpponentLineup } = useStore();

  // Pitcher choices: this game's batting order first, then the rest of the roster by last name.
  const lineup = game?.lineup;
  const pitcherOptions = useMemo(() => {
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
  }, [players, lineup]);

  if (!game) return <Redirect href="/" />;

  const batters = game.opponentLineup;

  const hasAtBats = (batterId: Id) => atBats.some((ab) => ab.side === 'them' && ab.batterId === batterId);

  const replaceBatter = (index: number, next: OpponentBatter) => {
    setOpponentLineup(game.id, batters.map((b, i) => (i === index ? next : b)));
  };

  const moveBatter = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= batters.length) return;
    const next = [...batters];
    [next[index], next[target]] = [next[target], next[index]];
    setOpponentLineup(game.id, next);
  };

  const removeBatter = async (index: number) => {
    if (batters.length <= 1) return;
    const batter = batters[index];
    if (hasAtBats(batter.id)) {
      const ok = await confirmAction(
        `Remove ${batter.name}?`,
        'This batter already has at-bats charted in this game. Remove anyway?',
        'Remove',
      );
      if (!ok) return;
    }
    setOpponentLineup(game.id, batters.filter((_, i) => i !== index));
  };

  const addBatter = () => {
    setOpponentLineup(game.id, [...batters, { id: newId('ob'), name: genericName(batters.length) }]);
  };

  const resetBatters = async () => {
    if (isCustomized(batters)) {
      const ok = await confirmAction(
        'Reset the batting order?',
        `This replaces the names and numbers you entered with Batter 1–${DEFAULT_BATTER_COUNT}.`,
        'Reset',
      );
      if (!ok) return;
    }
    // Keep existing ids where we can so at-bats already charted stay attached to their slot.
    const next: OpponentBatter[] = Array.from({ length: DEFAULT_BATTER_COUNT }, (_, i) => ({
      id: batters[i]?.id ?? newId('ob'),
      name: genericName(i),
    }));
    setOpponentLineup(game.id, next);
  };

  return (
    <Screen>
      <AppHeader
        context={gameTitle(game)}
        contextColor={colors.orange}
        onBack={() => router.replace(`/team/${game.teamId}`)}
      />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={type.h1}>Our Pitcher</Text>
            {pitcherOptions.length === 0 ? (
              <Text style={type.caption}>No players on the roster yet. Add players on the team's Team tab.</Text>
            ) : (
              <View style={styles.chips}>
                {pitcherOptions.map((p) => (
                  <PitcherChip
                    key={p.id}
                    player={p}
                    selected={p.id === game.pitcherId}
                    onPress={() => setPitcher(game.id, p.id)}
                  />
                ))}
              </View>
            )}
            <Text style={type.caption}>Pitching W/L is credited to the selected pitcher.</Text>
          </View>

          <View style={styles.section}>
            <Text style={type.h1}>{game.opponent} Batting Order</Text>
            <View>
              {batters.map((batter, index) => (
                <BatterRow
                  key={batter.id}
                  index={index}
                  batter={batter}
                  count={batters.length}
                  onChange={(next) => replaceBatter(index, next)}
                  onMoveUp={() => moveBatter(index, -1)}
                  onMoveDown={() => moveBatter(index, 1)}
                  onRemove={() => removeBatter(index)}
                />
              ))}
            </View>
            <Button title="Add batter" icon="plus" variant="outline" onPress={addBatter} />
            <Text style={type.caption}>
              You can leave the generic names — CTG only needs the order. Add names and numbers if you know them.
            </Text>
          </View>

          <Button title={`Reset to Batter 1–${DEFAULT_BATTER_COUNT}`} variant="ghost" onPress={resetBatters} />
        </ScrollView>
      </View>
    </Screen>
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

function BatterRow({
  index,
  batter,
  count,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  batter: OpponentBatter;
  count: number;
  onChange: (next: OpponentBatter) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const label = batter.name || genericName(index);

  const commitName = () => {
    const trimmed = batter.name.trim();
    const name = trimmed || genericName(index);
    if (name !== batter.name) onChange({ ...batter, name });
  };

  return (
    <View style={styles.row}>
      <Text style={styles.rowNumber}>{index + 1}.</Text>
      <TextInput
        value={batter.name}
        onChangeText={(name) => onChange({ ...batter, name })}
        onBlur={commitName}
        placeholder={genericName(index)}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={`Batter ${index + 1} name`}
        autoCapitalize="words"
        autoCorrect={false}
        style={[styles.input, styles.nameInput]}
      />
      <TextInput
        value={batter.number ?? ''}
        onChangeText={(text) => onChange({ ...batter, number: text.replace(/[^0-9]/g, '').slice(0, 3) || undefined })}
        placeholder="#"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={`Batter ${index + 1} number`}
        keyboardType="number-pad"
        maxLength={3}
        style={[styles.input, styles.numberInput]}
      />
      <View style={styles.controls}>
        <IconButton name="chevron-up" label={`Move ${label} up`} disabled={index === 0} onPress={onMoveUp} />
        <IconButton name="chevron-down" label={`Move ${label} down`} disabled={index === count - 1} onPress={onMoveDown} />
        <IconButton name="trash-can" label={`Remove ${label}`} color={colors.loss} disabled={count <= 1} onPress={onRemove} />
      </View>
    </View>
  );
}

function IconButton({
  name,
  label,
  onPress,
  disabled,
  color = colors.primaryDark,
}: {
  name: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled, !disabled && webCursor]}
    >
      <FontAwesome6 name={name} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40, gap: spacing.xxl },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  chipTextSelected: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowNumber: { width: 32, fontFamily: fonts.regular, fontSize: 18, color: colors.textMuted },
  input: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
    borderWidth: 1,
    borderColor: '#CFD5DE',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: colors.surface,
  },
  nameInput: { flex: 1, minWidth: 0 },
  numberInput: { width: 52, textAlign: 'center', paddingHorizontal: 4 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.25 },
});
