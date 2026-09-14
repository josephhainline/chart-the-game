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

const BY_ID = new Map(OUTCOMES.map((o) => [o.id, o]));

export function getOutcome(id: OutcomeId): Outcome {
  const o = BY_ID.get(id);
  if (!o) throw new Error(`Unknown outcome ${id}`);
  return o;
}

/** Single-line version of the label, used under a batter's name after the at-bat. */
export function outcomeLabel(id: OutcomeId): string {
  return getOutcome(id).label.replace('\n', ' ');
}
