/**
 * The at-bat outcome catalog.
 *
 * Twelve typed outcomes (the grid) plus two "plain" ones (`plain_w`, `plain_l`)
 * for a W or L charted with the big buttons and no play type. The plain pair
 * is NOT part of OUTCOMES / LOSS_OUTCOMES / WIN_OUTCOMES, so the grid and the
 * spec's list of twelve are untouched; `getOutcome` resolves all fourteen.
 *
 * Renderer rule: the letter always comes from `ab.result` (or
 * `pitcherResult(ab)` / `displayResult(ab)` on the pitching side), never
 * re-derived from the outcome. The outcome only supplies `label` and `short`,
 * both '' for a plain at-bat. Use `outcomeShort` / `outcomeLabel` in views:
 * they never throw, so a document written by a newer build cannot crash a
 * screen.
 */
import type { OutcomeId, Result } from './types';

export type Outcome = {
  id: OutcomeId;
  /** Full button label. "\n" marks the line break used on the two-line buttons. */
  label: string;
  /** Abbreviation for the scorebook grid. */
  short: string;
  /** Result from the batter's perspective. */
  result: Result;
};

/** The twelve outcomes from the prototype, in display order (top to bottom). */
export const LOSS_OUTCOMES: Outcome[] = [
  { id: 'k_swinging', label: 'Strikeout\nSwinging', short: 'K', result: 'L' },
  { id: 'walk_2_looking', label: "Walk, Didn't Swing &\nTook 2 Strikes Looking", short: 'BB(2K)', result: 'L' },
  { id: 'error_weak', label: 'Error,\nWeak Hit Ball', short: 'E-', result: 'L' },
  { id: 'fc_weak', label: "Fielder's Choice,\nWeak Hit Ball", short: 'FC-', result: 'L' },
  { id: 'bunt', label: 'Bunt', short: 'BUNT', result: 'L' },
  { id: 'k_looking', label: 'Strikeout\nLooking', short: 'KL', result: 'L' },
];

export const WIN_OUTCOMES: Outcome[] = [
  { id: 'sac_fly', label: 'Sac Fly', short: 'SF', result: 'W' },
  { id: 'walk_clean', label: 'Walk,\nNo Strikes Looking', short: 'BB', result: 'W' },
  { id: 'error_hard', label: 'Error,\nHard Hit Ball', short: 'E+', result: 'W' },
  { id: 'fc_hard', label: "Fielder's Choice,\nHard Hit Ball", short: 'FC+', result: 'W' },
  { id: 'fly_out_hard', label: 'Fly Out,\nHard Hit Ball', short: 'F+', result: 'W' },
  { id: 'hit', label: 'Hit', short: 'H', result: 'W' },
];

export const OUTCOMES: Outcome[] = [...LOSS_OUTCOMES, ...WIN_OUTCOMES];

/** A W with no play type: the big W button. */
export const PLAIN_W: Outcome = { id: 'plain_w', label: 'Win', short: '', result: 'W' };
/** An L with no play type: the big L button. */
export const PLAIN_L: Outcome = { id: 'plain_l', label: 'Loss', short: '', result: 'L' };
/** The plain pair. Not part of OUTCOMES: the grid never shows them. */
export const GENERIC_OUTCOMES: Outcome[] = [PLAIN_L, PLAIN_W];

const BY_ID = new Map([...OUTCOMES, ...GENERIC_OUTCOMES].map((o) => [o.id, o]));

/** true for the two plain ids (a W or L with no play type). */
export function isPlain(id: OutcomeId): boolean {
  return id === 'plain_w' || id === 'plain_l';
}

/** The plain outcome id carrying the given (batter-perspective) result. */
export function plainFor(result: Result): OutcomeId {
  return result === 'W' ? 'plain_w' : 'plain_l';
}

/** Resolves the twelve typed outcomes and the two plain ones; unknown ids throw. */
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
