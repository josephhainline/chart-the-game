import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { WL } from '@/lib/stats';
import type { Result } from '@/lib/types';

export type ScorebookRowView = {
  id: string;
  /** Batting-order slot shown in the "#" column ("1", "2", …). */
  slot: string;
  /** "Owen H. (#7)" or "Batter 3". */
  name: string;
  /** Fielding position for the "Pos" column; blank for opponents. */
  position?: string;
  /**
   * One entry per inning, each holding the results of that batter's at-bats
   * in the inning, already from the perspective being shown (W = green).
   */
  innings: Result[][];
  wl: WL;
};

type Props = {
  /** "Hitting" or "Pitching". */
  title: string;
  /** Band color behind the title. */
  color: string;
  innings: number[];
  rows: ScorebookRowView[];
};

/* Column widths: three innings plus W-L fit the 430px phone column exactly; more innings scroll horizontally. */
const SLOT_W = 24;
const NAME_W = 150;
const POS_W = 36;
const CELL_W = 54;
const CELL_H = 56;
const TOTAL_W = 56;

/**
 * Paper-scorebook grid: one row per batter, one column per inning, a big
 * W or L in each cell over a faint diamond, and a W-L total on the right.
 * Scrolls horizontally when there are more innings than fit.
 */
export default function Scorebook({ title, color, innings, rows }: Props) {
  const showPos = rows.some((r) => r.position);
  return (
    <View>
      <View style={[styles.band, { backgroundColor: color }]}>
        <Text style={styles.bandText}>{title}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridContent}>
        <View style={styles.grid}>
          <View style={styles.headerRow}>
            <View style={[styles.cell, styles.headerCell, { width: SLOT_W }]}>
              <Text style={styles.headerText}>#</Text>
            </View>
            <View style={[styles.cell, styles.headerCell, { width: NAME_W }]}>
              <Text style={styles.headerText}>Line Up</Text>
            </View>
            {showPos ? (
              <View style={[styles.cell, styles.headerCell, { width: POS_W }]}>
                <Text style={styles.headerText}>Pos</Text>
              </View>
            ) : null}
            {innings.map((n) => (
              <View key={n} style={[styles.cell, styles.headerCell, { width: CELL_W }]}>
                <Text style={styles.headerText}>{n}</Text>
              </View>
            ))}
            <View style={[styles.cell, styles.headerCell, { width: TOTAL_W }]}>
              <Text style={styles.headerText}>W-L</Text>
            </View>
          </View>

          {rows.length === 0 ? (
            <View style={[styles.row, { height: CELL_H }]}>
              <View style={[styles.cell, styles.emptyCell]}>
                <Text style={styles.emptyText}>No batters in the order yet.</Text>
              </View>
            </View>
          ) : null}

          {rows.map((row) => (
            <View key={row.id} style={[styles.row, { height: CELL_H }]}>
              <View style={[styles.cell, { width: SLOT_W }]}>
                <Text style={styles.slotText}>{row.slot}</Text>
              </View>
              <View style={[styles.cell, styles.nameCell, { width: NAME_W }]}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {row.name}
                </Text>
              </View>
              {showPos ? (
                <View style={[styles.cell, { width: POS_W }]}>
                  <Text style={styles.posText}>{row.position ?? ''}</Text>
                </View>
              ) : null}
              {innings.map((n, i) => (
                <InningCell key={n} results={row.innings[i] ?? []} />
              ))}
              <View style={[styles.cell, { width: TOTAL_W }]}>
                <Text style={[styles.totalText, { color: totalColor(row.wl) }]}>
                  {row.wl.w}-{row.wl.l}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Green when the wins lead, red when the losses do, muted before anyone has batted. */
function totalColor(wl: WL): string {
  if (wl.w + wl.l === 0) return colors.textMuted;
  return wl.w >= wl.l ? colors.win : colors.loss;
}

function InningCell({ results }: { results: Result[] }) {
  return (
    <View style={[styles.cell, styles.inningCell]}>
      <View style={styles.countBox}>
        <View style={styles.countBoxLine} />
      </View>
      <View style={styles.diamond} />
      {results.length === 1 ? (
        <Text style={[styles.bigResult, { color: results[0] === 'W' ? colors.win : colors.loss }]}>{results[0]}</Text>
      ) : results.length > 1 ? (
        <View style={styles.multi}>
          {results.map((r, i) => (
            <Text key={i} style={[styles.smallResult, { color: r === 'W' ? colors.win : colors.loss }]}>
              {r}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const BORDER = colors.text;

const styles = StyleSheet.create({
  band: { paddingHorizontal: 16, paddingVertical: 8 },
  bandText: { fontFamily: fonts.bold, fontSize: 22, color: '#fff' },
  gridContent: { minWidth: '100%' },
  grid: { borderWidth: 1, borderColor: BORDER, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', height: 34 },
  headerCell: { borderBottomWidth: 2 },
  headerText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCell: { alignItems: 'flex-start', paddingHorizontal: 5 },
  emptyCell: { flex: 1, paddingHorizontal: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  slotText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  nameText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  posText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryDark },
  inningCell: { width: CELL_W, overflow: 'hidden' },
  countBox: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 18,
    height: 12,
    borderWidth: 1,
    borderColor: colors.band,
    justifyContent: 'center',
  },
  countBoxLine: { height: 1, backgroundColor: colors.band },
  diamond: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: colors.band,
    transform: [{ rotate: '45deg' }],
  },
  bigResult: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, color: colors.win },
  multi: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  smallResult: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22 },
  totalText: { fontFamily: fonts.bold, fontSize: 18, fontVariant: ['tabular-nums'] },
});
