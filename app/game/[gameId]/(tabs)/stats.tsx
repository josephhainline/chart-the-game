import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import PitcherList from '@/components/PitcherList';
import Scorebook, { type ScorebookRowView } from '@/components/Scorebook';
import Screen from '@/components/Screen';
import { SectionBand, WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { gameTitle, halfLabel, playerShort } from '@/lib/format';
import { isPlain, outcomeShort } from '@/lib/outcomes';
import { gameHitting, gamePitcherLines, gamePitching, orderWithLeavers, scorebook, type OrderRow } from '@/lib/stats';
import { useGame, useGameAtBats, useStore } from '@/lib/store';
import type { Player } from '@/lib/types';

const EMPTY_BOOK = { innings: [] as number[], rows: [] as ScorebookRowView[] };

/** "1", "2", … for a row in the order (a slot repeats across an OUT/IN pair); "–" for one who left it. */
function slotLabel(row: OrderRow): string {
  return row.status === 'left' ? '–' : String(row.slot + 1);
}

/** The small note under a name: "OUT ▲ 4TH" / "IN ▲ 4TH" around a substitution, "LEFT GAME" for a batter removed from the order. */
function rowNote(row: OrderRow): string | undefined {
  if (row.status === 'left') return 'LEFT GAME';
  if (!row.at) return undefined;
  return `${row.status === 'out' ? 'OUT' : 'IN'} ${halfLabel(row.at.inning, row.at.half).toUpperCase()}`;
}

/**
 * Game-level Stats tab: the hitting scorebook grid and our pitchers as a list.
 * Every grid cell with an at-bat opens the editor (a multi-at-bat cell opens
 * the batter sheet). A batter who left his slot through a substitution keeps a
 * muted "OUT" row right above the "IN" row of the player who took it (same
 * slot number); batters removed from the order with the lineup editor keep
 * their at-bats in muted "LEFT GAME" rows so the grid reconciles with the totals.
 * The pitching side lists our pitchers only (innings, W/L, score); tapping one
 * opens the pitcher sheet with his at-bats. Opposing batters are not tracked.
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
    const book = scorebook(atBats, game.id, 'us', orderWithLeavers(game, atBats, 'us'), minInnings);
    const rows: ScorebookRowView[] = book.rows.map((r) => {
      const player = byId.get(r.batter.id);
      return {
        id: r.batter.id,
        slot: slotLabel(r.batter),
        name: player ? playerShort(player) : 'Removed player',
        innings: r.innings.map((abs) => abs.map((ab) => ({ atBatId: ab.id, result: ab.result, short: outcomeShort(ab.outcomeId) }))),
        wl: r.wl,
        muted: r.batter.status !== 'in',
        note: rowNote(r.batter),
      };
    });
    return { innings: book.innings, rows };
  }, [game, atBats, data.players, minInnings]);

  const pitchers = useMemo(() => (game ? gamePitcherLines(atBats, game.id, data.players, game.pitcherId) : []), [game, atBats, data.players]);

  if (!game) return null;

  const teamHitting = gameHitting(atBats, game.id);
  const teamPitching = gamePitching(atBats, game.id);
  const plainCount = atBats.filter((ab) => isPlain(ab.outcomeId)).length;

  /** One at-bat opens the editor; a cell with several opens the batter sheet listing them. */
  const openCell = (atBatIds: string[], rowId: string) => {
    if (atBatIds.length === 1) router.push(`/game/${game.id}/atbat/${atBatIds[0]}`);
    else router.push(`/game/${game.id}/batter/us/${rowId}`);
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

        <Scorebook innings={hitting.innings} rows={hitting.rows} onPressCell={openCell} />
        <View style={styles.gap} />
        <SectionBand title="Pitching" color={colors.pitching} textColor={colors.white} />
        <PitcherList lines={pitchers} onPress={(playerId) => router.push(`/game/${game.id}/pitching/${playerId}`)} />
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
