import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import FormLine, { formFor } from '@/components/FormLine';
import ModalScreen from '@/components/ModalScreen';
import ResultTile from '@/components/ResultTile';
import { Button, EmptyState, WLText } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { sortAtBats } from '@/lib/atbats';
import { halfLabel, opponentBatterLabel, playerLabel, playerShort } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { outcomeLabel, outcomeShort, plainFor } from '@/lib/outcomes';
import { addResult, ZERO } from '@/lib/stats';
import { battingSide, useGame, useGameAtBats, useStore, useTeamGames, useTeamPlayers } from '@/lib/store';
import type { Result, Side } from '@/lib/types';
import { pushUndo } from '@/lib/undo';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/**
 * The batter sheet: one batter's at-bats this game, newest first (each opens
 * the editor), his form across the season (our batters), "Bring up to bat
 * now" while that side is batting, "Substitute…" while he is in the order of
 * a live game, and plain L / W backfill buttons that chart an at-bat in the
 * current half-inning without moving the batting order. Opened from a row
 * body or the dock's AT-BAT name on the CTG tab and from a multi-at-bat cell
 * on the Stats scorebook.
 *
 * Every letter is `ab.result`, the graded player's: the batter's on our side,
 * our pitcher's on an opposing batter's sheet (his rows and W/L are what our
 * pitchers did against him).
 */
export default function BatterSheetScreen() {
  const { gameId, side: rawSide, batterId } = useLocalSearchParams<{ gameId: string; side: string; batterId: string }>();
  const router = useRouter();
  const { data, setNextBatter, recordAtBat } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const games = useTeamGames(game?.teamId);
  const close = useDismiss(game ? `/game/${game.id}` : '/');
  const side: Side = rawSide === 'them' ? 'them' : 'us';

  const mine = useMemo(
    () => sortAtBats(atBats.filter((ab) => ab.side === side && ab.batterId === batterId)).reverse(),
    [atBats, side, batterId],
  );
  const form = useMemo(() => (side === 'us' && batterId ? formFor(data.atBats, games, batterId) : undefined), [side, batterId, data.atBats, games]);

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
  const canSubstitute = !isFinal && index >= 0 && side === 'us';
  const wl = mine.reduce((acc, ab) => addResult(acc, ab.result === 'W'), ZERO);
  /** Our pitcher of record, whom a backfilled opposing at-bat grades (the store stamps `game.pitcherId`). */
  const pitcher = side === 'them' && game.pitcherId ? players.find((p) => p.id === game.pitcherId) : undefined;
  /** The backfill caption names the graded player when it is not the batter: "Charted for Weedon H. (#04), our pitcher, in the …". */
  const gradedFor = side === 'us' ? '' : pitcher ? `for ${playerShort(pitcher)}, our pitcher, ` : 'with no pitcher of record ';

  const bringUp = () => {
    if (!batting) return;
    setNextBatter(game.id, side, index);
    pushUndo(game.id, { kind: 'skip', side, fromBatterId: order[current], toBatterId: batterId });
    close();
  };

  /** The sub sheet takes this sheet's place, so closing it (or making the sub) lands back where this one was opened. */
  const openSubstitute = () => router.replace(`/game/${game.id}/sub/${batterId}`);

  /** A plain at-bat in the current half-inning; the letter grades this side's player (the batter here, our pitcher on theirs). */
  const add = (result: Result) => {
    const ab = recordAtBat(game.id, plainFor(result), { side, batterId, inning: game.inning, half: game.half });
    if (ab) pushUndo(game.id, { kind: 'record', atBat: ab, backfill: true });
  };

  return (
    <ModalScreen title={title} color={colors.orange} onClose={close}>
      <View style={styles.summary}>
        <Text style={styles.sectionLabel}>This game</Text>
        {mine.length > 0 ? <WLText wl={wl} style={styles.summaryValue} /> : <Text style={type.caption}>No at-bats yet this game.</Text>}
      </View>

      {mine.map((ab) => {
        const label = outcomeLabel(ab.outcomeId);
        const text = `${halfLabel(ab.inning, ab.half)} · ${label || 'no play type'}`;
        return (
          <Pressable
            key={ab.id}
            onPress={() => router.push(`/game/${game.id}/atbat/${ab.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${text}, ${ab.result}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed, webCursor]}
          >
            <ResultTile result={ab.result} code={outcomeShort(ab.outcomeId)} />
            <Text style={styles.rowText} numberOfLines={2}>
              {text}
            </Text>
            <FontAwesome6 name="chevron-right" size={16} color={colors.tabLabel} />
          </Pressable>
        );
      })}

      {form ? (
        <View style={styles.actions}>
          <Text style={styles.sectionLabel}>Form</Text>
          <View style={styles.formCard}>
            <FormLine results={form.results} rating={form.rating} season={form.season} lastGame={form.lastGame} />
          </View>
        </View>
      ) : null}

      {batting || canSubstitute ? (
        <View style={styles.actions}>
          {batting ? (
            index === current ? (
              <Text style={styles.upNow}>Up to bat now.</Text>
            ) : (
              <Button title="Bring up to bat now" variant="orange" icon="forward-step" onPress={bringUp} />
            )
          ) : null}
          {canSubstitute ? <Button title="Substitute…" variant="orange" icon="right-left" onPress={openSubstitute} /> : null}
        </View>
      ) : null}

      {!isFinal ? (
        <View style={styles.actions}>
          <Text style={styles.sectionLabel}>Missed one?</Text>
          {/* L on the left and W on the right, like the dock: the letter is the graded player's on both sides. */}
          <View style={styles.addRow}>
            <Button title="Add an L" variant="loss" size="sm" style={styles.addButton} onPress={() => add('L')} />
            <Button title="Add a W" variant="win" size="sm" style={styles.addButton} onPress={() => add('W')} />
          </View>
          <Text style={type.caption}>
            Charted {gradedFor}in the {halfLabel(game.inning, game.half)} with no play type; the batting order does not move. Tap it above to add a play type.
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
  formCard: { backgroundColor: colors.page, borderRadius: radii.md, padding: 12 },
  upNow: { fontFamily: fonts.bold, fontSize: 16, color: colors.orange, textAlign: 'center' },
  addRow: { flexDirection: 'row', gap: 10 },
  addButton: { flex: 1, paddingHorizontal: 8 },
});
