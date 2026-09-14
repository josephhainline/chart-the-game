import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { startOfDay } from 'date-fns';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, WLText } from '@/components/ui';
import { colors, fonts, radii } from '@/constants/theme';
import { gameDateLine, inningOrdinal, monthBand, monthKey, opponentLabel, upcomingLabel } from '@/lib/format';
import { gameHitting, gamePitching } from '@/lib/stats';
import type { AtBat, Game } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

type Props = {
  game: Game;
  /** At-bats to derive the game's W/L from (the whole document's list is fine). */
  atBats: AtBat[];
  /** True for the nearest upcoming game: it gets the big orange "Chart The Game" button. */
  featured?: boolean;
  /** Shown as a small caption above the opponent (the app-level All Games list). */
  teamName?: string;
  onPress: () => void;
};

export type MonthGroup = { key: string; title: string; games: Game[] };

/** Games sorted by first pitch and grouped into month bands ("Sept 2026"). */
export function groupGamesByMonth(games: Game[]): MonthGroup[] {
  const sorted = [...games].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups: MonthGroup[] = [];
  for (const game of sorted) {
    const key = monthKey(game.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.games.push(game);
    else groups.push({ key, title: monthBand(game.startsAt), games: [game] });
  }
  return groups;
}

/**
 * For each team, the scheduled game that gets the big "Chart The Game" button:
 * the first one on or after today, otherwise the most recent unplayed one.
 */
export function featuredGameIds(games: Game[], now: Date = new Date()): Set<string> {
  const today = startOfDay(now).toISOString();
  const byTeam = new Map<string, Game[]>();
  for (const g of games) {
    if (g.status !== 'scheduled') continue;
    const list = byTeam.get(g.teamId) ?? [];
    list.push(g);
    byTeam.set(g.teamId, list);
  }
  const ids = new Set<string>();
  for (const list of byTeam.values()) {
    list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const next = list.find((g) => g.startsAt >= today) ?? list[list.length - 1];
    ids.add(next.id);
  }
  return ids;
}

/** "Final Score: Won 19 - 5" / "Lost 6 - 7" / "Tied 4 - 4" */
export function finalScoreLabel(game: Pick<Game, 'score'>): string {
  const { us, them } = game.score;
  const word = us > them ? 'Won' : us < them ? 'Lost' : 'Tied';
  return `Final Score: ${word} ${us} - ${them}`;
}

/** "Charting in progress · Top 3rd" */
export function inProgressLabel(game: Pick<Game, 'inning' | 'half'>): string {
  return `Charting in progress · ${game.half === 'top' ? 'Top' : 'Bottom'} ${inningOrdinal(game.inning)}`;
}

function statusLine(game: Game): string {
  if (game.status === 'final') return finalScoreLabel(game);
  if (game.status === 'in_progress') return inProgressLabel(game);
  return upcomingLabel(game.startsAt) || 'Not charted yet';
}

/**
 * One game in a games list: opponent, date, status and notes on the left;
 * hitting/pitching W/L or the "Chart The Game" call to action on the right.
 */
export default function GameRow({ game, atBats, featured, teamName, onPress }: Props) {
  const showWL = game.status !== 'scheduled';
  const label = `${opponentLabel(game)}, ${gameDateLine(game.startsAt)}`;
  // Rows with an inner call-to-action button must not themselves be buttons
  // (nested <button> elements are invalid on web); the inner button is the
  // accessible control and the row press is a convenience.
  const hasInnerButton = game.status !== 'final';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={hasInnerButton ? undefined : 'button'}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, webCursor]}
    >
      <View style={styles.left}>
        {teamName ? (
          <Text style={styles.teamName} numberOfLines={1}>
            {teamName}
          </Text>
        ) : null}
        <Text style={styles.opponent}>{opponentLabel(game)}</Text>
        <View style={styles.details}>
          <Text style={styles.date}>{gameDateLine(game.startsAt)}</Text>
          <View style={styles.status}>
            <Text style={styles.statusLine}>{statusLine(game)}</Text>
            {game.notes ? <Text style={styles.notes}>{game.notes}</Text> : null}
          </View>
        </View>
      </View>

      <View style={[styles.right, !showWL && styles.rightCentered]}>
        {showWL ? (
          <>
            <Text style={styles.wlLabel}>HITTING:</Text>
            <WLText wl={gameHitting(atBats, game.id)} style={styles.wl} />
            <Text style={[styles.wlLabel, styles.wlLabelSpaced]}>PITCHING:</Text>
            <WLText wl={gamePitching(atBats, game.id)} style={styles.wl} />
            {game.status === 'in_progress' ? (
              <Button title="Continue" variant="orange" size="sm" onPress={onPress} accessibilityLabel="Continue Charting" style={styles.continueButton} />
            ) : null}
          </>
        ) : featured ? (
          <ChartTheGameButton onPress={onPress} />
        ) : (
          <Button title="Chart" variant="outline" size="sm" onPress={onPress} accessibilityLabel={`Chart ${opponentLabel(game)}`} />
        )}
      </View>
    </Pressable>
  );
}

/** The big orange call to action from the prototype: gauge icon over "Chart The Game". */
function ChartTheGameButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Chart The Game"
      style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, webCursor]}
    >
      <FontAwesome6 name="gauge-high" size={44} color="#fff" />
      <Text style={styles.ctaText}>Chart The Game</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The divider and the detail lines are inset 36px like the prototype; the
  // opponent title hangs 18px back into that margin.
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginLeft: 36,
    paddingRight: 12,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
    gap: 8,
  },
  rowPressed: { backgroundColor: '#F4F6FA' },
  left: { flex: 1, minWidth: 0 },
  teamName: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.4, marginLeft: -18, marginBottom: 2 },
  opponent: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, marginLeft: -18, lineHeight: 30 },
  details: { marginTop: 6, gap: 12 },
  date: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, lineHeight: 20 },
  status: { gap: 2 },
  statusLine: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, lineHeight: 20 },
  notes: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, lineHeight: 19 },
  right: { width: 150, alignItems: 'center', paddingTop: 6 },
  rightCentered: { justifyContent: 'center', paddingTop: 0 },
  wlLabel: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    letterSpacing: 0.2,
  },
  wlLabelSpaced: { marginTop: 14 },
  wl: { fontSize: 22, marginTop: 4, lineHeight: 26 },
  continueButton: { marginTop: 12, alignSelf: 'stretch' },
  cta: {
    width: 140,
    height: 82,
    borderRadius: radii.sm,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '2px 3px 4px rgba(0, 0, 0, 0.25)' } as any)
      : { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 2, height: 3 }, elevation: 4 }),
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
});
