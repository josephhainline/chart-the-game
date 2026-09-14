import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ScoreText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { playerLabel } from '@/lib/format';
import { totals, type StatRow } from '@/lib/stats';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

export type StatsSort = 'lineup' | 'score';

/**
 * Width of each numeric column (the prototype's ≈64px). The name column takes
 * the rest: 183px at 375px, enough for the longest full name at 14px.
 */
const COL_WIDTH = 64;

type Props = {
  /** Rows in lineup order (see `seasonTable`). */
  rows: StatRow[];
  /** Shown when there are no rows at all. */
  emptyTitle?: string;
  emptyBody?: string;
};

/** Sort bucket for the score order: scored players, then "-" rows, then the removed-players row. */
function sortRank(row: StatRow): number {
  if (row.removed) return 2;
  return row.score === null ? 1 : 0;
}

/**
 * Season stats table: Name · Wins · Losses · Score with a Totals row.
 * Tapping "Score" toggles sorting by score (best first, players with no data
 * last); tapping "Name" returns to lineup order. Scrolls vertically with the
 * header row pinned. A synthetic "removed players" row renders muted and
 * always stays last.
 */
export default function StatsTable({ rows, emptyTitle = 'No players yet', emptyBody }: Props) {
  const [sort, setSort] = useState<StatsSort>('lineup');

  const ordered = useMemo(() => {
    if (sort === 'lineup') return rows;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const rank = sortRank(a.row) - sortRank(b.row);
        if (rank !== 0) return rank;
        return (b.row.score ?? 0) - (a.row.score ?? 0) || a.index - b.index;
      })
      .map((x) => x.row);
  }, [rows, sort]);

  const sum = useMemo(() => totals(rows), [rows]);
  const hasAny = rows.some((r) => r.score !== null);

  return (
    <ScrollView style={styles.scroll} stickyHeaderIndices={[0]} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setSort('lineup')}
          accessibilityRole="button"
          accessibilityLabel="Sort by lineup order"
          accessibilityState={{ selected: sort === 'lineup' }}
          style={[styles.nameCell, webCursor]}
        >
          <Text style={styles.headerText}>Name</Text>
        </Pressable>
        <View style={[styles.numCell, styles.headerSeparator]}>
          <Text style={styles.headerText}>Wins</Text>
        </View>
        <View style={[styles.numCell, styles.headerSeparator]}>
          <Text style={styles.headerText}>Losses</Text>
        </View>
        <Pressable
          onPress={() => setSort((s) => (s === 'score' ? 'lineup' : 'score'))}
          accessibilityRole="button"
          accessibilityLabel={sort === 'score' ? 'Sorted by score. Tap to restore lineup order' : 'Sort by score'}
          accessibilityState={{ selected: sort === 'score' }}
          style={[styles.numCell, styles.headerSeparator, webCursor]}
        >
          <Text style={[styles.headerText, sort === 'score' && styles.headerActive]}>Score</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} />
      ) : (
        <>
          {ordered.map(({ player, wl, score, removed }) => (
            <View key={player.id} style={styles.row}>
              <View style={styles.nameCell}>
                <Text style={[styles.nameText, removed && styles.removedText]} numberOfLines={2}>
                  {playerLabel(player)}
                </Text>
              </View>
              <View style={[styles.numCell, styles.rowSeparator]}>
                <Text style={[styles.numText, removed && styles.removedNum]}>{score === null ? '-' : wl.w}</Text>
              </View>
              <View style={[styles.numCell, styles.rowSeparator]}>
                <Text style={[styles.numText, removed && styles.removedNum]}>{score === null ? '-' : wl.l}</Text>
              </View>
              <View style={[styles.numCell, styles.rowSeparator]}>
                <ScoreText value={score} style={styles.scoreText} />
              </View>
            </View>
          ))}
          <View style={styles.totalsRow}>
            <View style={[styles.nameCell, styles.totalsLabelCell]}>
              <Text style={styles.totalsLabel}>Totals:</Text>
            </View>
            <View style={[styles.numCell, styles.headerSeparator]}>
              <Text style={styles.numText}>{hasAny ? sum.w : '-'}</Text>
            </View>
            <View style={[styles.numCell, styles.headerSeparator]}>
              <Text style={styles.numText}>{hasAny ? sum.l : '-'}</Text>
            </View>
            <View style={[styles.numCell, styles.headerSeparator]}>
              <ScoreText value={hasAny ? sum.w - sum.l : null} style={styles.scoreText} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.band,
    minHeight: 28,
  },
  headerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  headerActive: { color: colors.primaryDark, textDecorationLine: 'underline' },
  headerSeparator: { borderLeftWidth: 1, borderLeftColor: colors.buttonGray },
  rowSeparator: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  nameCell: { flex: 1, justifyContent: 'center', paddingLeft: 12, paddingRight: 6, minHeight: 28 },
  numCell: { width: COL_WIDTH, alignItems: 'center', justifyContent: 'center', minHeight: 28 },
  row: {
    flexDirection: 'row',
    minHeight: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  nameText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  removedText: { fontFamily: fonts.italic, color: colors.textMuted },
  removedNum: { color: colors.textMuted },
  numText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  scoreText: { fontSize: 15 },
  totalsRow: {
    flexDirection: 'row',
    minHeight: 28,
    backgroundColor: colors.band,
  },
  totalsLabelCell: { alignItems: 'flex-end', paddingRight: 12 },
  totalsLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
