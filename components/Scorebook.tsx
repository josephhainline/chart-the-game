import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PHONE_MAX_WIDTH, colors, fonts } from '@/constants/theme';
import type { WL } from '@/lib/stats';
import type { Result } from '@/lib/types';

/** One charted at-bat as shown in a scorebook cell. */
export type ScorebookCell = {
  /** Already from the perspective being shown (W = green). */
  result: Result;
  /** Outcome abbreviation ("K", "BB", "H", …) from `lib/outcomes`. */
  short: string;
};

export type ScorebookRowView = {
  id: string;
  /** Batting-order slot shown in the "#" column ("1", "2", …). */
  slot: string;
  /** "Owen H. (#7)" or "Batter 3". */
  name: string;
  /** Fielding position for the "Pos" column; blank for opponents. */
  position?: string;
  /** One entry per inning, each holding that batter's at-bats in the inning. */
  innings: ScorebookCell[][];
  wl: WL;
};

type Props = {
  /** Optional thin label band above the grid ("Pitching"); omit to start the grid flush. */
  title?: string;
  /** Band color behind the title. */
  color?: string;
  innings: number[];
  rows: ScorebookRowView[];
};

/*
 * Column sizing: the #, Pos and W-L columns are fixed; the name and inning
 * columns are sized from the measured width so that up to four innings fit a
 * 430px column and three fit a 375px phone without scrolling. With more
 * innings the inning columns scroll horizontally (with an indicator and a
 * right-edge fade) while the W-L column stays pinned on the right.
 */
const SLOT_W = 22;
const POS_W = 32;
const TOTAL_W = 54;
const NAME_MIN = 130;
const CELL_MIN = 44;
const CELL_MAX = 60;
const CELL_H = 60;
const HEADER_H = 26;

/**
 * Paper-scorebook grid: one row per batter, one column per inning, a big
 * W or L over the outcome code in each cell (over a faint diamond), and a
 * W-L total pinned on the right.
 */
export default function Scorebook({ title, color = colors.primaryDark, innings, rows }: Props) {
  const dims = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const gridW = measured || Math.min(dims.width, PHONE_MAX_WIDTH);
  const showPos = rows.some((r) => r.position);

  const count = Math.max(innings.length, 1);
  const avail = gridW - 2 - SLOT_W - (showPos ? POS_W : 0) - TOTAL_W;
  const cellW = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor((avail - NAME_MIN) / count)));
  const nameW = Math.max(NAME_MIN, avail - cellW * count);
  const overflows = SLOT_W + (showPos ? POS_W : 0) + nameW + cellW * count + 2 > gridW - TOTAL_W;
  const nameFont = nameW >= 136 ? 16 : 15;

  return (
    <View onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}>
      {title ? (
        <View style={[styles.band, { backgroundColor: color }]}>
          <Text style={styles.bandText}>{title}</Text>
        </View>
      ) : null}
      <View style={styles.gridWrap}>
        <View style={styles.scrollRegion}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={overflows}
            contentContainerStyle={styles.gridContent}
          >
            <View style={styles.grid}>
              <View style={styles.headerRow}>
                <View style={[styles.cell, styles.headerCell, { width: SLOT_W }]}>
                  <Text style={styles.headerText}>#</Text>
                </View>
                <View style={[styles.cell, styles.headerCell, { width: nameW }]}>
                  <Text style={styles.headerText}>Line Up</Text>
                </View>
                {showPos ? (
                  <View style={[styles.cell, styles.headerCell, { width: POS_W }]}>
                    <Text style={styles.headerText}>Pos</Text>
                  </View>
                ) : null}
                {innings.map((n) => (
                  <View key={n} style={[styles.cell, styles.headerCell, { width: cellW }]}>
                    <Text style={styles.headerText}>{n}</Text>
                  </View>
                ))}
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
                  <View style={[styles.cell, styles.nameCell, { width: nameW }]}>
                    <Text style={[styles.nameText, { fontSize: nameFont }]} numberOfLines={2}>
                      {row.name}
                    </Text>
                  </View>
                  {showPos ? (
                    <View style={[styles.cell, { width: POS_W }]}>
                      <Text style={styles.posText}>{row.position ?? ''}</Text>
                    </View>
                  ) : null}
                  {innings.map((n, i) => (
                    <InningCell key={n} atBats={row.innings[i] ?? []} width={cellW} />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          {overflows ? (
            <View pointerEvents="none" style={styles.fade}>
              <View style={[styles.fadeStrip, { opacity: 0.25 }]} />
              <View style={[styles.fadeStrip, { opacity: 0.5 }]} />
              <View style={[styles.fadeStrip, { opacity: 0.8 }]} />
            </View>
          ) : null}
        </View>

        <View style={styles.totalsCol}>
          <View style={[styles.cell, styles.headerCell, styles.totalsCell, { height: HEADER_H }]}>
            <Text style={styles.headerText}>W-L</Text>
          </View>
          {rows.length === 0 ? <View style={[styles.cell, styles.totalsCell, { height: CELL_H }]} /> : null}
          {rows.map((row) => (
            <View key={row.id} style={[styles.cell, styles.totalsCell, { height: CELL_H }]}>
              <Text style={[styles.totalText, { color: totalColor(row.wl) }]}>
                {row.wl.w}-{row.wl.l}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Green when the wins lead, red when the losses do, muted before anyone has batted. */
function totalColor(wl: WL): string {
  if (wl.w + wl.l === 0) return colors.textMuted;
  return wl.w >= wl.l ? colors.win : colors.loss;
}

function resultColor(result: Result): string {
  return result === 'W' ? colors.win : colors.loss;
}

function InningCell({ atBats, width }: { atBats: ScorebookCell[]; width: number }) {
  return (
    <View style={[styles.cell, styles.inningCell, { width }]}>
      <View style={styles.countBox}>
        <View style={styles.countBoxLine} />
      </View>
      <View style={styles.diamond} />
      {atBats.length === 1 ? (
        <>
          <Text style={[styles.bigResult, { color: resultColor(atBats[0].result) }]}>{atBats[0].result}</Text>
          <Text style={[styles.code, { color: resultColor(atBats[0].result) }]} numberOfLines={1}>
            {atBats[0].short}
          </Text>
        </>
      ) : atBats.length > 1 ? (
        <View style={styles.multi}>
          {atBats.map((ab, i) => (
            <View key={i} style={styles.multiRow}>
              <Text style={[styles.smallResult, { color: resultColor(ab.result) }]}>{ab.result}</Text>
              <Text style={[styles.smallCode, { color: resultColor(ab.result) }]} numberOfLines={1}>
                {ab.short}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const BORDER = colors.text;

const styles = StyleSheet.create({
  band: { paddingHorizontal: 16, paddingVertical: 4 },
  bandText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  gridWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  scrollRegion: { flex: 1, minWidth: 0 },
  gridContent: { minWidth: '100%' },
  grid: { borderWidth: 1, borderColor: BORDER, backgroundColor: colors.surface },
  fade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row',
  },
  fadeStrip: { width: 8, backgroundColor: colors.surface },
  totalsCol: {
    width: TOTAL_W,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: BORDER,
    backgroundColor: colors.surface,
  },
  totalsCell: { width: '100%' },
  headerRow: { flexDirection: 'row', height: HEADER_H },
  headerCell: { borderBottomWidth: 2 },
  headerText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCell: { alignItems: 'flex-start', paddingHorizontal: 4 },
  emptyCell: { flex: 1, paddingHorizontal: 12 },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  slotText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  nameText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.text },
  posText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryDark },
  inningCell: { overflow: 'hidden' },
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
  bigResult: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 32, marginTop: 4 },
  code: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, marginTop: 1 },
  multi: { justifyContent: 'center', gap: 1 },
  multiRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  smallResult: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 16 },
  smallCode: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 12 },
  totalText: { fontFamily: fonts.bold, fontSize: 18, fontVariant: ['tabular-nums'] },
});
