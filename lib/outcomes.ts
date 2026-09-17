/**
 * The at-bat outcome catalogs.
 *
 * Two grids, one per side of the game: the thirteen BATTER outcomes (charted
 * on a `side: 'us'` at-bat, grading our batter) and the eight PITCHER
 * outcomes (charted on a `side: 'them'` at-bat, grading our pitcher). The
 * "plain" pair (`plain_w`, `plain_l`) is a W or L charted with the big buttons
 * and no play type; it is not part of either grid and is valid on both sides.
 * `getOutcome` resolves all twenty-three.
 *
 * `Outcome.result` is the GRADED player's letter in both catalogs: `hit` is a
 * batter W, `p_walk` is a pitcher L. Nothing is ever inverted for the pitching
 * side. Codes may repeat across the catalogs (K, KL, BB, HBP, O+ name the same
 * play on either side); ids are unique.
 *
 * Renderer rule: the letter always comes from `ab.result`, never re-derived
 * from the outcome. The outcome only supplies `label` and `short`, both ''
 * for a plain at-bat. Use `outcomeShort` / `outcomeLabel` in views: they never
 * throw, so a document written by a newer build cannot crash a screen.
 */
import type { OutcomeId, Result, Side } from './types';

/** Who an outcome grades. 'either' is the plain pair, which both sides' big buttons share. */
export type OutcomeSide = 'batter' | 'pitcher' | 'either';

export type Outcome = {
  id: OutcomeId;
  /** Full button label. "\n" marks the line break used on the two-line buttons. */
  label: string;
  /** Abbreviation for the scorebook grid. */
  short: string;
  side: OutcomeSide;
  /** The graded player's letter. */
  result: Result;
};

/** The batter L column, in display order (top to bottom). */
export const LOSS_OUTCOMES: Outcome[] = [
  { id: 'k_swinging', label: 'Strikeout\nSwinging', short: 'K', side: 'batter', result: 'L' },
  { id: 'walk_2_looking', label: "Walk, Didn't Swing &\nTook 2 Strikes Looking", short: 'BB(2K)', side: 'batter', result: 'L' },
  { id: 'error_weak', label: 'Error,\nWeak Hit Ball', short: 'E-', side: 'batter', result: 'L' },
  { id: 'fc_weak', label: "Fielder's Choice,\nWeak Hit Ball", short: 'FC-', side: 'batter', result: 'L' },
  { id: 'bunt', label: 'Bunt', short: 'BUNT', side: 'batter', result: 'L' },
  { id: 'k_looking', label: 'Strikeout\nLooking', short: 'KL', side: 'batter', result: 'L' },
];

/** The batter W column. Hit by Pitch is last so the rows above stay paired with the L column; row 7 has no L. */
export const WIN_OUTCOMES: Outcome[] = [
  { id: 'sac_fly', label: 'Sac Fly', short: 'SF', side: 'batter', result: 'W' },
  { id: 'walk_clean', label: 'Walk,\nNo Strikes Looking', short: 'BB', side: 'batter', result: 'W' },
  { id: 'error_hard', label: 'Error,\nHard Hit Ball', short: 'E+', side: 'batter', result: 'W' },
  { id: 'fc_hard', label: "Fielder's Choice,\nHard Hit Ball", short: 'FC+', side: 'batter', result: 'W' },
  { id: 'fly_out_hard', label: 'Out,\nHard Hit Ball', short: 'F+', side: 'batter', result: 'W' },
  { id: 'hit', label: 'Hit', short: 'H', side: 'batter', result: 'W' },
  { id: 'hbp', label: 'Hit by\nPitch', short: 'HBP', side: 'batter', result: 'W' },
];

/** The thirteen batter outcomes: the hitting grid. */
export const OUTCOMES: Outcome[] = [...LOSS_OUTCOMES, ...WIN_OUTCOMES];

/** The pitcher L column, in display order (top to bottom). */
export const PITCHER_LOSS_OUTCOMES: Outcome[] = [
  { id: 'p_walk', label: 'Walk', short: 'BB', side: 'pitcher', result: 'L' },
  { id: 'p_hbp', label: 'Hit by\nPitch', short: 'HBP', side: 'pitcher', result: 'L' },
  { id: 'p_hard_reached', label: 'Hard Hit Ball,\nReached', short: 'R+', side: 'pitcher', result: 'L' },
  { id: 'p_hard_out', label: 'Hard Hit Ball,\nOut', short: 'O+', side: 'pitcher', result: 'L' },
];

/** The pitcher W column. */
export const PITCHER_WIN_OUTCOMES: Outcome[] = [
  { id: 'p_k_swinging', label: 'Strikeout\nSwinging', short: 'K', side: 'pitcher', result: 'W' },
  { id: 'p_k_looking', label: 'Strikeout\nLooking', short: 'KL', side: 'pitcher', result: 'W' },
  { id: 'p_weak_out', label: 'Weak Hit Ball,\nOut', short: 'O-', side: 'pitcher', result: 'W' },
  { id: 'p_weak_reached', label: 'Weak Hit Ball,\nReached', short: 'R-', side: 'pitcher', result: 'W' },
];

/** The eight pitcher outcomes: the pitching grid. */
export const PITCHER_OUTCOMES: Outcome[] = [...PITCHER_LOSS_OUTCOMES, ...PITCHER_WIN_OUTCOMES];

/** A W with no play type: the big W button. */
export const PLAIN_W: Outcome = { id: 'plain_w', label: 'Win', short: '', side: 'either', result: 'W' };
/** An L with no play type: the big L button. */
export const PLAIN_L: Outcome = { id: 'plain_l', label: 'Loss', short: '', side: 'either', result: 'L' };
/** The plain pair. Not part of either grid: the grids never show them. */
export const GENERIC_OUTCOMES: Outcome[] = [PLAIN_L, PLAIN_W];

const BY_ID = new Map([...OUTCOMES, ...PITCHER_OUTCOMES, ...GENERIC_OUTCOMES].map((o) => [o.id, o]));

/** The grid for the side that is batting: the batter catalog when we bat, the pitcher catalog when they do. */
export function catalogFor(side: Side): { loss: Outcome[]; win: Outcome[] } {
  return side === 'us' ? { loss: LOSS_OUTCOMES, win: WIN_OUTCOMES } : { loss: PITCHER_LOSS_OUTCOMES, win: PITCHER_WIN_OUTCOMES };
}

/** Who the outcome grades; 'either' for the plain pair and for an id this build does not know. Never throws. */
export function outcomeSide(id: OutcomeId): OutcomeSide {
  return BY_ID.get(id)?.side ?? 'either';
}

/** true for the two plain ids (a W or L with no play type). */
export function isPlain(id: OutcomeId): boolean {
  return id === 'plain_w' || id === 'plain_l';
}

/** The plain outcome id carrying the given letter (the graded player's, on either side). */
export function plainFor(result: Result): OutcomeId {
  return result === 'W' ? 'plain_w' : 'plain_l';
}

/** Resolves every batter, pitcher and plain outcome; unknown ids throw. */
export function getOutcome(id: OutcomeId): Outcome {
  const o = BY_ID.get(id);
  if (!o) throw new Error(`Unknown outcome ${id}`);
  return o;
}

/** Scorebook code ("K", "BB", "H", …). '' for a plain at-bat or an unknown id; never throws. */
export function outcomeShort(id: OutcomeId): string {
  return BY_ID.get(id)?.short ?? '';
}

/**
 * Single-line version of the label, used under a batter's name after the at-bat.
 * '' for a plain at-bat (the letter alone tells the story); the raw id for an
 * unknown one so a newer document still renders something; never throws.
 */
export function outcomeLabel(id: OutcomeId): string {
  if (isPlain(id)) return '';
  const o = BY_ID.get(id);
  return o ? o.label.replace('\n', ' ') : String(id);
}
