import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ScoreText, WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { inningOrdinal, playerLabel } from '@/lib/format';
import { score, totals, type PitcherLine } from '@/lib/stats';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Props = {
  lines: PitcherLine[];
  /** Tap a pitcher to open his at-bats for the game. */
  onPress?: (playerId: string) => void;
};

/** "1st" / "1st–3rd" for the innings a pitcher worked. */
export function inningsLabel(innings: PitcherLine['innings']): string {
  if (!innings) return 'Not yet';
  return innings.from === innings.to ? inningOrdinal(innings.from) : `${inningOrdinal(innings.from)}–${inningOrdinal(innings.to)}`;
}

/**
 * The pitching side of a game's Stats tab: our pitchers as a list, in the
 * order they pitched, each with the innings he worked, his W/L and score.
 * Opposing batters are not shown; the game is about our pitchers' battles.
 */
export default function PitcherList({ lines, onPress }: Props) {
  if (lines.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No pitcher yet. Set one from the pitcher chip on the CTG tab.</Text>
      </View>
    );
  }
  const sum = totals(lines.map((l) => ({ player: l.player, wl: l.wl, score: score(l.wl) })));
  return (
    <View style={styles.list}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, styles.nameCol]}>Pitcher</Text>
        <Text style={[styles.headerText, styles.inningsCol]}>Innings</Text>
        <Text style={[styles.headerText, styles.wlCol]}>W / L</Text>
        <Text style={[styles.headerText, styles.scoreCol]}>Score</Text>
        <View style={styles.chevronCol} />
      </View>
      {lines.map((line) => {
        const faced = line.wl.w + line.wl.l;
        const label = playerLabel(line.player);
        return (
          <Pressable
            key={line.player.id}
            onPress={onPress ? () => onPress(line.player.id) : undefined}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityLabel={`${label}, pitched ${inningsLabel(line.innings)}, ${line.wl.w} W ${line.wl.l} L`}
            accessibilityHint={onPress ? 'Open his at-bats this game' : undefined}
            style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed, onPress && webCursor]}
          >
            <Text style={[styles.name, styles.nameCol]} numberOfLines={2}>
              {label}
            </Text>
            <Text style={[styles.innings, styles.inningsCol]}>{inningsLabel(line.innings)}</Text>
            {faced > 0 ? (
              <WLText wl={line.wl} style={[styles.wl, styles.wlCol]} />
            ) : (
              <Text style={[styles.wl, styles.wlCol, styles.muted]}>-</Text>
            )}
            <ScoreText value={faced > 0 ? score(line.wl) : null} style={[styles.scoreText, styles.scoreCol]} />
            <View style={styles.chevronCol}>{onPress ? <FontAwesome6 name="chevron-right" size={14} color={colors.tabLabel} /> : null}</View>
          </Pressable>
        );
      })}
      <View style={styles.totalsRow}>
        <Text style={[styles.totalsLabel, styles.nameCol]}>Totals:</Text>
        <Text style={styles.inningsCol} />
        {sum.w + sum.l > 0 ? <WLText wl={sum} style={[styles.wl, styles.wlCol]} /> : <Text style={[styles.wl, styles.wlCol, styles.muted]}>-</Text>}
        <ScoreText value={sum.w + sum.l > 0 ? sum.w - sum.l : null} style={[styles.scoreText, styles.scoreCol]} />
        <View style={styles.chevronCol} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1, borderTopColor: colors.divider },
  headerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.band, minHeight: 28, paddingHorizontal: 16 },
  headerText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.pressed },
  nameCol: { flex: 1, minWidth: 0, paddingRight: 8 },
  inningsCol: { width: 72 },
  wlCol: { width: 78, textAlign: 'right' },
  scoreCol: { width: 48, textAlign: 'right' },
  chevronCol: { width: 22, alignItems: 'flex-end' },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.text },
  innings: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  wl: { fontSize: 15 },
  scoreText: { fontSize: 15 },
  muted: { fontFamily: fonts.bold, color: colors.textMuted },
  totalsRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 16, backgroundColor: colors.chip },
  totalsLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textAlign: 'right', paddingRight: 8 },
  empty: { paddingHorizontal: 16, paddingVertical: 16 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
});
