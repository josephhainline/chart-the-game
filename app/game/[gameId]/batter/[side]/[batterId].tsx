import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import ResultTile from '@/components/ResultTile';
import { Button, EmptyState, WLText } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { displayResult, sortAtBats } from '@/lib/atbats';
import { halfLabel, opponentBatterLabel, playerLabel } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { outcomeLabel, outcomeShort, plainFor } from '@/lib/outcomes';
import { addResult, ZERO } from '@/lib/stats';
import { battingSide, useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { Result, Side } from '@/lib/types';
import { pushUndo } from '@/lib/undo';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

function invert(r: Result): Result {
  return r === 'W' ? 'L' : 'W';
}

/**
 * The batter sheet: one batter's at-bats this game, newest first (each opens
 * the editor), "Bring up to bat now" while that side is batting, and plain
 * W / L backfill buttons that chart an at-bat in the current half-inning
 * without moving the batting order. Opened from a row body on the CTG tab
 * and from a multi-at-bat cell on the Stats scorebook.
 */
export default function BatterSheetScreen() {
  const { gameId, side: rawSide, batterId } = useLocalSearchParams<{ gameId: string; side: string; batterId: string }>();
  const router = useRouter();
  const { setNextBatter, recordAtBat } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const close = useDismiss(game ? `/game/${game.id}` : '/');
  const side: Side = rawSide === 'them' ? 'them' : 'us';

  const mine = useMemo(
    () => sortAtBats(atBats.filter((ab) => ab.side === side && ab.batterId === batterId)).reverse(),
    [atBats, side, batterId],
  );

  if (!game) {
    return (
      <ModalScreen title="Batter" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }

  const player = side === 'us' ? players.find((p) => p.id === batterId) : undefined;
  const opponentBatter = side === 'them' ? game.opponentLineup.find((b) => b.id === batterId) : undefined;
  const title =
    side === 'us' ? (player ? playerLabel(player) : 'Removed player') : opponentBatter ? opponentBatterLabel(opponentBatter) : 'Batter (left)';

  const order = side === 'us' ? game.lineup.map((s) => s.playerId) : game.opponentLineup.map((b) => b.id);
  const index = order.indexOf(batterId ?? '');
  const n = order.length;
  const current = n ? (side === 'us' ? game.ourNextBatter : game.theirNextBatter) % n : -1;
  const isFinal = game.status === 'final';
  const batting = !isFinal && index >= 0 && current >= 0 && battingSide(game) === side;
  const wl = mine.reduce((acc, ab) => addResult(acc, displayResult(ab) === 'W'), ZERO);

  const bringUp = () => {
    if (!batting) return;
    setNextBatter(game.id, side, index);
    pushUndo(game.id, { kind: 'skip', side, fromBatterId: order[current], toBatterId: batterId });
    close();
  };

  /** A plain at-bat in the current half-inning; the letter is in the perspective shown (our pitcher's for them). */
  const add = (shownResult: Result) => {
    const batterResult = side === 'them' ? invert(shownResult) : shownResult;
    const ab = recordAtBat(game.id, plainFor(batterResult), { side, batterId, inning: game.inning, half: game.half });
    if (ab) pushUndo(game.id, { kind: 'record', atBat: ab, backfill: true });
  };

  return (
    <ModalScreen title={title} color={colors.orange} onClose={close}>
      <View style={styles.summary}>
        <Text style={styles.sectionLabel}>This game</Text>
        {mine.length > 0 ? <WLText wl={wl} style={styles.summaryValue} /> : <Text style={type.caption}>No at-bats yet this game.</Text>}
      </View>

      {mine.map((ab) => {
        const shown = displayResult(ab);
        const label = outcomeLabel(ab.outcomeId);
        const text = `${halfLabel(ab.inning, ab.half)} · ${label || 'no play type'}`;
        return (
          <Pressable
            key={ab.id}
            onPress={() => router.push(`/game/${game.id}/atbat/${ab.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${text}, ${shown}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed, webCursor]}
          >
            <ResultTile result={shown} code={outcomeShort(ab.outcomeId)} />
            <Text style={styles.rowText} numberOfLines={2}>
              {text}
            </Text>
            <FontAwesome6 name="chevron-right" size={16} color={colors.tabLabel} />
          </Pressable>
        );
      })}

      {batting ? (
        <View style={styles.actions}>
          {index === current ? (
            <Text style={styles.upNow}>Up to bat now.</Text>
          ) : (
            <Button title="Bring up to bat now" variant="orange" icon="forward-step" onPress={bringUp} />
          )}
        </View>
      ) : null}

      {!isFinal ? (
        <View style={styles.actions}>
          <Text style={styles.sectionLabel}>Missed one?</Text>
          <View style={styles.addRow}>
            <Button
              title={side === 'them' ? 'Add a W (pitcher won)' : 'Add a W'}
              variant="win"
              size="sm"
              style={styles.addButton}
              onPress={() => add('W')}
            />
            <Button
              title={side === 'them' ? 'Add an L (pitcher lost)' : 'Add an L'}
              variant="loss"
              size="sm"
              style={styles.addButton}
              onPress={() => add('L')}
            />
          </View>
          <Text style={type.caption}>
            Charted in the {halfLabel(game.inning, game.half)} with no play type; the batting order does not move. Tap it above to add a play type.
          </Text>
        </View>
      ) : null}
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  sectionLabel: { ...type.label, textTransform: 'uppercase' },
  summaryValue: { fontSize: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.pressed },
  rowText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.text },
  actions: { marginTop: 24, gap: 10 },
  upNow: { fontFamily: fonts.bold, fontSize: 16, color: colors.orange, textAlign: 'center' },
  addRow: { flexDirection: 'row', gap: 10 },
  addButton: { flex: 1, paddingHorizontal: 8 },
});
