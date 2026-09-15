import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import MiniChips, { type MiniChip } from '@/components/MiniChips';
import { colors, fonts } from '@/constants/theme';
import { halfLabel, signed } from '@/lib/format';
import { formRating, hittingFor, lastGameLine, recentForm, score, type FormRating, type WL } from '@/lib/stats';
import type { AtBat, Game, Id, Result, Substitution } from '@/lib/types';


/** Everything a FormLine shows for one player. */
export type Form = {
  /** His last six our-side at-bats, oldest first. */
  results: Result[];
  rating: FormRating;
  /** Season hitting W/L over the team's games. */
  season: WL;
  /** His W/L in the most recent final game he batted in. */
  lastGame?: WL;
};

/**
 * A player's form from the team's games: pass the team's games and every
 * at-bat (those of games not in `games` are ignored, so the store's whole
 * list is fine).
 */
export function formFor(atBats: AtBat[], games: Game[], playerId: Id): Form {
  const gameIds = new Set(games.map((g) => g.id));
  const relevant = atBats.filter((ab) => gameIds.has(ab.gameId));
  const results = recentForm(relevant, games, playerId);
  return {
    results,
    rating: formRating(results),
    season: hittingFor(relevant, playerId),
    lastGame: lastGameLine(relevant, games, playerId)?.wl,
  };
}

/**
 * "Started · out ▲ 4th" (or "Came in ▲ 2nd · out ▲ 4th") for a bench player
 * whose latest recorded change in this game took him out of the order;
 * undefined for anyone else (never in, or removed with the lineup editor,
 * which records nothing). Records are read in the order they were made. A
 * record is only reported while the player it put in still holds a slot —
 * the rule `orderWithLeavers` and Undo apply — so once that player has been
 * removed with the lineup editor the outgoing player is a plain bench row,
 * as the scorebook (LEFT GAME) and the refused Undo already treat him.
 */
export function benchNote(game: Game, playerId: Id): string | undefined {
  let entered: { inning: number; half: Game['half'] } | undefined;
  let last: 'in' | 'out' | undefined;
  let out: Substitution | undefined;
  for (const r of game.substitutions ?? []) {
    if (r.inId === playerId) {
      entered = { inning: r.inning, half: r.half };
      last = 'in';
    }
    if (r.outId === playerId) {
      out = r;
      last = 'out';
    }
  }
  if (last !== 'out' || !out) return undefined;
  const inId = out.inId;
  if (!game.lineup.some((s) => s.playerId === inId)) return undefined;
  const from = entered ? `Came in ${halfLabel(entered.inning, entered.half)}` : 'Started';
  return `${from} · out ${halfLabel(out.inning, out.half)}`;
}

/**
 * A player's form in words for assistive tech, since the chips and the pill
 * are read one letter at a time or not at all: "Hot, last 6 W W L W W W,
 * season +4, last game 3W / 0L" ("No at-bats yet this season" for a player
 * with none), with the bench note appended ("… , started · out ▲ 4th").
 */
export function describeForm(form: Omit<Form, 'rating'> & { rating?: FormRating }, note?: string): string {
  const parts: string[] = [];
  if (form.results.length === 0) {
    parts.push('No at-bats yet this season');
  } else {
    if (form.rating) parts.push(form.rating === 'hot' ? 'Hot' : 'Cold');
    parts.push(`last ${form.results.length} ${form.results.join(' ')}`);
    parts.push(`season ${signed(score(form.season))}`);
    if (form.lastGame) parts.push(`last game ${form.lastGame.w}W / ${form.lastGame.l}L`);
  }
  if (note) parts.push(note.toLowerCase());
  const text = parts.join(', ');
  return text[0].toUpperCase() + text.slice(1);
}

/**
 * Words for assistive tech only. On web it renders out of sight (a
 * transparent, clipped 1pt box that stays in the accessibility tree), so a
 * display-only row can be read as one sentence while its visual parts are
 * aria-hidden, or a button can point its aria-describedby at it (an
 * accessibilityHint is dropped by React Native Web, and a label on a plain
 * view is not announced). Native renders nothing: there the row's
 * accessibilityLabel or accessibilityHint carries the same words.
 */
export function HiddenText({ id, children }: { id?: string; children: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <Text id={id} style={styles.hidden}>
      {children}
    </Text>
  );
}

/** The HOT / COLD tag; renders nothing without a rating. */
export function RatingPill({ rating, style }: { rating: FormRating; style?: StyleProp<ViewStyle> }) {
  if (!rating) return null;
  const hot = rating === 'hot';
  return (
    <View style={[styles.pill, { backgroundColor: hot ? colors.hotTint : colors.coldTint }, style]} accessibilityRole="text">
      <Text style={[styles.pillText, { color: hot ? colors.orange : colors.primaryDark }]}>{hot ? 'HOT' : 'COLD'}</Text>
    </View>
  );
}

/** "+5" green, "-2" red, "0" muted: the season score in caption-sized text. */
function SignedScore({ value }: { value: number }) {
  const color = value > 0 ? colors.winInk : value < 0 ? colors.lossInk : colors.textMuted;
  return <Text style={[styles.score, { color }]}>{signed(value)}</Text>;
}

type Props = Omit<Form, 'rating'> & {
  rating?: FormRating;
  /** One line for list rows: the chips, "season +5" and the pill. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * How a batter has been doing lately: his last six at-bats as mini chips
 * with a HOT / COLD pill, then "Season +5 · last game 3W / 0L". Shown on the
 * batter sheet's Form card, the substitution sheet and (compact) the CTG
 * screen's bench rows. Reads "No at-bats yet this season" for a player with
 * none.
 */
export default function FormLine({ results, rating, season, lastGame, compact, style }: Props) {
  if (results.length === 0) {
    return (
      <Text style={[styles.empty, style]} accessibilityRole="text">
        No at-bats yet this season
      </Text>
    );
  }
  const chips: MiniChip[] = results.map((result, i) => ({ id: String(i), result }));
  const seasonScore = score(season);

  if (compact) {
    return (
      <View style={[styles.line, style]}>
        <MiniChips chips={chips} />
        <Text style={styles.compactText}>
          season <SignedScore value={seasonScore} />
        </Text>
        <RatingPill rating={rating} />
      </View>
    );
  }

  return (
    <View style={[styles.block, style]}>
      <View style={styles.line}>
        <Text style={styles.key}>Last 6</Text>
        <MiniChips chips={chips} />
        <RatingPill rating={rating} />
      </View>
      <View style={styles.line}>
        <Text style={styles.key}>Season</Text>
        <Text style={styles.value}>
          <SignedScore value={seasonScore} />
          {lastGame ? (
            <>
              {' · last game '}
              <Text style={styles.valueBold}>
                {lastGame.w}W / {lastGame.l}L
              </Text>
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  key: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, width: 64 },
  value: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, flexShrink: 1 },
  valueBold: { fontFamily: fonts.bold, color: colors.text },
  score: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  compactText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  pill: { height: 18, paddingHorizontal: 6, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  hidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
