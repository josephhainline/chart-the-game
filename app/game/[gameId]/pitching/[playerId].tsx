import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { inningsLabel } from '@/components/PitcherList';
import ResultTile from '@/components/ResultTile';
import { EmptyState, WLText } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { displayResult, sortAtBats } from '@/lib/atbats';
import { halfLabel, opponentBatterLabel, playerLabel } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { outcomeLabel, outcomeShort } from '@/lib/outcomes';
import { gamePitcherLines } from '@/lib/stats';
import { useGame, useGameAtBats, useTeamPlayers } from '@/lib/store';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/**
 * The pitcher sheet: one of our pitchers' battles in a game, newest first,
 * each opening the editor, so an opposing at-bat can be re-judged after the
 * game without a grid of opposing batters. Opened from the Stats tab's
 * pitcher list.
 */
export default function PitcherSheetScreen() {
  const { gameId, playerId } = useLocalSearchParams<{ gameId: string; playerId: string }>();
  const router = useRouter();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const close = useDismiss(game ? `/game/${game.id}/stats` : '/');

  const mine = useMemo(
    () => sortAtBats(atBats.filter((ab) => ab.side === 'them' && ab.pitcherId === playerId)).reverse(),
    [atBats, playerId],
  );

  if (!game) {
    return (
      <ModalScreen title="Pitcher" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }

  const player = players.find((p) => p.id === playerId);
  const line = gamePitcherLines(atBats, game.id, players, game.pitcherId).find((l) => l.player.id === playerId);
  const batters = new Map(game.opponentLineup.map((b) => [b.id, b]));

  return (
    <ModalScreen title={player ? `${playerLabel(player)} · pitching` : 'Removed player'} color={colors.orange} onClose={close}>
      <View style={styles.summary}>
        <Text style={styles.sectionLabel}>This game</Text>
        {line && line.wl.w + line.wl.l > 0 ? (
          <>
            <WLText wl={line.wl} style={styles.summaryValue} />
            <Text style={styles.innings}>{inningsLabel(line.innings)}</Text>
          </>
        ) : (
          <Text style={type.caption}>No batters faced yet.</Text>
        )}
      </View>

      {mine.map((ab) => {
        const shown = displayResult(ab);
        const batter = batters.get(ab.batterId);
        const label = outcomeLabel(ab.outcomeId);
        const text = `${halfLabel(ab.inning, ab.half)} · ${batter ? opponentBatterLabel(batter) : 'Batter (left)'} · ${label || 'no play type'}`;
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
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  sectionLabel: { ...type.label, textTransform: 'uppercase' },
  summaryValue: { fontSize: 17 },
  innings: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
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
});
