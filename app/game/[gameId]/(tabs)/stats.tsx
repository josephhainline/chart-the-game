import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Scorebook, { type ScorebookRowView } from '@/components/Scorebook';
import Screen from '@/components/Screen';
import { WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { gameTitle, opponentBatterLabel, playerShort } from '@/lib/format';
import { isPlain, outcomeShort } from '@/lib/outcomes';
import { gameHitting, gamePitching, leftGameBatterIds, pitcherResult, scorebook } from '@/lib/stats';
import { useGame, useGameAtBats, useStore } from '@/lib/store';
import type { Player, Position, Side } from '@/lib/types';

const EMPTY_BOOK = { innings: [] as number[], rows: [] as ScorebookRowView[] };

/** A row of our grid: a lineup slot, or a batter who left the order mid-game (`left`). */
type OurBatter = { id: string; position?: Position; index: number; left: boolean };
/** A row of their grid: a batter in the order, or one who left it mid-game. */
type TheirBatter = { id: string; label: string; left: boolean };

/**
 * Game-level Stats tab: the scorebook grids for our hitting and our pitching.
 * Every cell with an at-bat opens the editor (a multi-at-bat cell opens the
 * batter sheet); batters who left the order mid-game keep their at-bats in
 * muted "LEFT GAME" rows so the grid reconciles with the totals.
 */
export default function GameStatsScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const { data } = useStore();

  const minInnings = Math.max(game?.inning ?? 1, 3);

  const hitting = useMemo(() => {
    if (!game) return EMPTY_BOOK;
    const byId = new Map<string, Player>(data.players.map((p) => [p.id, p]));
    const inOrder: OurBatter[] = game.lineup.map((slot, index) => ({ id: slot.playerId, position: slot.position, index, left: false }));
    const left: OurBatter[] = leftGameBatterIds(atBats, game.id, 'us', game.lineup.map((s) => s.playerId)).map((id) => ({
      id,
      index: -1,
      left: true,
    }));
    const book = scorebook(atBats, game.id, 'us', [...inOrder, ...left], minInnings);
    const rows: ScorebookRowView[] = book.rows.map((r) => {
      const player = byId.get(r.batter.id);
      return {
        id: r.batter.id,
        slot: r.batter.left ? '–' : String(r.batter.index + 1),
        name: player ? playerShort(player) : 'Removed player',
        position: r.batter.position,
        innings: r.innings.map((abs) => abs.map((ab) => ({ atBatId: ab.id, result: ab.result, short: outcomeShort(ab.outcomeId) }))),
        wl: r.wl,
        muted: r.batter.left,
        note: r.batter.left ? 'LEFT GAME' : undefined,
      };
    });
    return { innings: book.innings, rows };
  }, [game, atBats, data.players, minInnings]);

  const pitching = useMemo(() => {
    if (!game) return EMPTY_BOOK;
    const inOrder: TheirBatter[] = game.opponentLineup.map((b) => ({ id: b.id, label: opponentBatterLabel(b), left: false }));
    const left: TheirBatter[] = leftGameBatterIds(atBats, game.id, 'them', game.opponentLineup.map((b) => b.id)).map((id) => ({
      id,
      label: 'Batter (left)',
      left: true,
    }));
    const book = scorebook(atBats, game.id, 'them', [...inOrder, ...left], minInnings);
    const rows: ScorebookRowView[] = book.rows.map((r, index) => ({
      id: r.batter.id,
      slot: r.batter.left ? '–' : String(index + 1),
      name: r.batter.label,
      // Shown from our pitcher's side: green when our pitcher won the battle.
      innings: r.innings.map((abs) => abs.map((ab) => ({ atBatId: ab.id, result: pitcherResult(ab), short: outcomeShort(ab.outcomeId) }))),
      wl: r.wl,
      muted: r.batter.left,
      note: r.batter.left ? 'LEFT GAME' : undefined,
    }));
    return { innings: book.innings, rows };
  }, [game, atBats, minInnings]);

  if (!game) return null;

  const teamHitting = gameHitting(atBats, game.id);
  const teamPitching = gamePitching(atBats, game.id);
  const plainCount = atBats.filter((ab) => isPlain(ab.outcomeId)).length;

  /** One at-bat opens the editor; a cell with several opens the batter sheet listing them. */
  const openCell = (side: Side) => (atBatIds: string[], rowId: string) => {
    if (atBatIds.length === 1) router.push(`/game/${game.id}/atbat/${atBatIds[0]}`);
    else router.push(`/game/${game.id}/batter/${side}/${rowId}`);
  };

  return (
    <Screen>
      <AppHeader
        context={gameTitle(game)}
        contextColor={colors.orange}
        backHref={`/team/${game.teamId}`}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>HITTING</Text>
            <WLText wl={teamHitting} style={styles.summaryValue} />
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>PITCHING</Text>
            <WLText wl={teamPitching} style={styles.summaryValue} />
          </View>
        </View>
        {plainCount > 0 ? (
          <Text style={styles.plainCaption}>
            {plainCount} at-bat{plainCount === 1 ? '' : 's'} without a play type
          </Text>
        ) : null}

        <Scorebook innings={hitting.innings} rows={hitting.rows} onPressCell={openCell('us')} />
        <View style={styles.gap} />
        <Scorebook title="Pitching" color={colors.pitching} innings={pitching.innings} rows={pitching.rows} onPressCell={openCell('them')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  /** One compact line of the game's W/L totals; the grids start right under it. */
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 28,
    paddingHorizontal: 16,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  summaryLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
  summaryValue: { fontSize: 15 },
  /** The counter to type erosion: how many at-bats were charted with the big buttons alone. */
  plainCaption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted, textAlign: 'center', marginTop: -2, marginBottom: 4 },
  gap: { height: 16 },
});
