import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Scorebook, { type ScorebookRowView } from '@/components/Scorebook';
import Screen from '@/components/Screen';
import { WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { gameTitle, opponentBatterLabel, playerShort } from '@/lib/format';
import { gameHitting, gamePitching, pitcherResult, scorebook } from '@/lib/stats';
import { useGame, useGameAtBats, useStore } from '@/lib/store';
import type { Player } from '@/lib/types';

/** Game-level Stats tab: the scorebook grids for our hitting and our pitching. */
export default function GameStatsScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const { data } = useStore();

  const minInnings = Math.max(game?.inning ?? 1, 3);

  const hitting = useMemo(() => {
    if (!game) return { innings: [] as number[], rows: [] as ScorebookRowView[] };
    const byId = new Map<string, Player>(data.players.map((p) => [p.id, p]));
    const batters = game.lineup.map((slot, index) => ({ id: slot.playerId, slot, index }));
    const book = scorebook(atBats, game.id, 'us', batters, minInnings);
    const rows: ScorebookRowView[] = book.rows.map((r) => {
      const player = byId.get(r.batter.id);
      return {
        id: r.batter.id,
        slot: String(r.batter.index + 1),
        name: player ? playerShort(player) : 'Removed player',
        position: r.batter.slot.position,
        innings: r.innings.map((abs) => abs.map((ab) => ab.result)),
        wl: r.wl,
      };
    });
    return { innings: book.innings, rows };
  }, [game, atBats, data.players, minInnings]);

  const pitching = useMemo(() => {
    if (!game) return { innings: [] as number[], rows: [] as ScorebookRowView[] };
    const book = scorebook(atBats, game.id, 'them', game.opponentLineup, minInnings);
    const rows: ScorebookRowView[] = book.rows.map((r, index) => ({
      id: r.batter.id,
      slot: String(index + 1),
      name: opponentBatterLabel(r.batter),
      // Shown from our pitcher's side: green when our pitcher won the battle.
      innings: r.innings.map((abs) => abs.map(pitcherResult)),
      wl: r.wl,
    }));
    return { innings: book.innings, rows };
  }, [game, atBats, minInnings]);

  if (!game) return null;

  const teamHitting = gameHitting(atBats, game.id);
  const teamPitching = gamePitching(atBats, game.id);

  return (
    <Screen>
      <AppHeader
        context={gameTitle(game)}
        contextColor={colors.orange}
        onBack={() => router.replace(`/team/${game.teamId}`)}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>HITTING</Text>
            <WLText wl={teamHitting} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>PITCHING</Text>
            <WLText wl={teamPitching} />
          </View>
        </View>

        <Scorebook title="Hitting" color={colors.primaryDark} innings={hitting.innings} rows={hitting.rows} />
        <View style={styles.gap} />
        <Scorebook title="Pitching" color={colors.pitching} innings={pitching.innings} rows={pitching.rows} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  summaryItem: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  summaryLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, letterSpacing: 0.5 },
  summaryDivider: { width: 1, height: 28, backgroundColor: colors.divider },
  gap: { height: 16 },
});
