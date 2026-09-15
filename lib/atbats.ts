/**
 * The one sort key every view uses for at-bats (rows, mini chips, steppers,
 * the batter sheet, scorebook multi-cells): inning, half, recordedAt. Array
 * order in the document is irrelevant, so a backfilled at-bat sits in its own
 * inning and a restored one lands where it was.
 */
import type { AtBat, Half, Result } from './types';

export const HALF_ORDER: Record<Half, number> = { top: 0, bottom: 1 };

/** Orders two half-innings on the game clock. */
export function compareClock(a: { inning: number; half: Half }, b: { inning: number; half: Half }): number {
  return a.inning - b.inning || HALF_ORDER[a.half] - HALF_ORDER[b.half];
}

/** inning, half, recordedAt, then id: a total order, so sorting is deterministic. */
export function compareAtBats(a: AtBat, b: AtBat): number {
  return (
    compareClock(a, b) ||
    (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** A new array in game order (the input is not mutated). */
export function sortAtBats(atBats: AtBat[]): AtBat[] {
  return [...atBats].sort(compareAtBats);
}

/** The last at-bat on the game clock (not the last one in the array). */
export function newestAtBat(atBats: AtBat[]): AtBat | undefined {
  let newest: AtBat | undefined;
  for (const ab of atBats) {
    if (!newest || compareAtBats(ab, newest) > 0) newest = ab;
  }
  return newest;
}

/**
 * The letter a view shows for this at-bat: the batter's result when we bat,
 * our pitcher's (the inverse, same as `pitcherResult` in lib/stats) when they
 * do, so green always means good for us.
 */
/** The other side of a battle: the batter's W is the pitcher's L. */
export function invertResult(result: Result): Result {
  return result === 'W' ? 'L' : 'W';
}

export function displayResult(ab: AtBat): Result {
  if (ab.side === 'us') return ab.result;
  return invertResult(ab.result);
}
