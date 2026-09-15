import { describe, expect, it } from '@jest/globals';

import { HALF_ORDER, compareAtBats, compareClock, displayResult, newestAtBat, sortAtBats } from '../atbats';
import { pitcherResult } from '../stats';
import type { AtBat, Id, Result } from '../types';

let seq = 0;

function ab(over: Partial<AtBat> & { result: Result }): AtBat {
  seq += 1;
  return {
    id: `ab${seq}`,
    gameId: 'g1',
    side: 'us',
    batterId: 'p1',
    inning: 1,
    half: 'top',
    outcomeId: over.result === 'W' ? 'hit' : 'k_swinging',
    recordedAt: '2026-09-07T14:00:00.000Z',
    ...over,
  };
}

const ids = (list: AtBat[]): Id[] => list.map((x) => x.id);

describe('HALF_ORDER / compareClock', () => {
  it('the top of an inning comes before the bottom', () => {
    expect(HALF_ORDER.top).toBe(0);
    expect(HALF_ORDER.bottom).toBe(1);
    expect(compareClock({ inning: 1, half: 'top' }, { inning: 1, half: 'bottom' })).toBeLessThan(0);
    expect(compareClock({ inning: 1, half: 'bottom' }, { inning: 1, half: 'top' })).toBeGreaterThan(0);
  });

  it('a later inning comes after any half of an earlier one', () => {
    expect(compareClock({ inning: 1, half: 'bottom' }, { inning: 2, half: 'top' })).toBeLessThan(0);
    expect(compareClock({ inning: 3, half: 'top' }, { inning: 2, half: 'bottom' })).toBeGreaterThan(0);
  });

  it('is zero for the same half-inning', () => {
    expect(compareClock({ inning: 2, half: 'bottom' }, { inning: 2, half: 'bottom' })).toBe(0);
  });
});

describe('compareAtBats', () => {
  it('orders by inning, then half, then recordedAt, then id', () => {
    const a = ab({ result: 'W', inning: 1, half: 'top', recordedAt: '2026-09-07T14:05:00.000Z', id: 'z' });
    const b = ab({ result: 'W', inning: 1, half: 'top', recordedAt: '2026-09-07T14:09:00.000Z', id: 'a' });
    const c = ab({ result: 'W', inning: 1, half: 'bottom', recordedAt: '2026-09-07T14:01:00.000Z' });
    const d = ab({ result: 'W', inning: 2, half: 'top', recordedAt: '2026-09-07T13:00:00.000Z' });
    expect(compareAtBats(a, b)).toBeLessThan(0);
    expect(compareAtBats(b, c)).toBeLessThan(0);
    expect(compareAtBats(c, d)).toBeLessThan(0);
    expect(compareAtBats(d, a)).toBeGreaterThan(0);
    expect(compareAtBats(a, a)).toBe(0);
  });

  it('breaks a recordedAt tie by id so the order is total', () => {
    const x = ab({ result: 'W', id: 'ab_x' });
    const y = ab({ result: 'W', id: 'ab_y' });
    expect(compareAtBats(x, y)).toBeLessThan(0);
    expect(compareAtBats(y, x)).toBeGreaterThan(0);
  });

  it('a backfilled at-bat (recorded later, stamped earlier) sits in its own half-inning', () => {
    const live = ab({ result: 'W', inning: 2, half: 'top', recordedAt: '2026-09-07T14:30:00.000Z' });
    const backfill = ab({ result: 'L', inning: 1, half: 'top', recordedAt: '2026-09-07T14:45:00.000Z' });
    expect(compareAtBats(backfill, live)).toBeLessThan(0);
  });
});

describe('sortAtBats', () => {
  const second = ab({ result: 'W', inning: 2, half: 'top', recordedAt: '2026-09-07T14:30:00.000Z' });
  const first = ab({ result: 'L', inning: 1, half: 'top', recordedAt: '2026-09-07T14:02:00.000Z' });
  const bottomFirst = ab({ result: 'W', inning: 1, half: 'bottom', recordedAt: '2026-09-07T14:15:00.000Z' });
  const backfill = ab({ result: 'W', inning: 1, half: 'top', recordedAt: '2026-09-07T14:50:00.000Z' });
  const input = [second, first, bottomFirst, backfill];

  it('returns a new array in game order and leaves the input alone', () => {
    const before = ids(input);
    const sorted = sortAtBats(input);
    expect(sorted).not.toBe(input);
    expect(ids(sorted)).toEqual(ids([first, backfill, bottomFirst, second]));
    expect(ids(input)).toEqual(before);
  });

  it('copes with an empty list and orders equal clocks and timestamps by id', () => {
    expect(sortAtBats([])).toEqual([]);
    const same1 = ab({ result: 'W', id: 'ab_same_1' });
    const same2 = ab({ result: 'W', id: 'ab_same_2' });
    expect(ids(sortAtBats([same2, same1]))).toEqual(['ab_same_1', 'ab_same_2']);
    expect(ids(sortAtBats([same1, same2]))).toEqual(['ab_same_1', 'ab_same_2']);
  });
});

describe('newestAtBat', () => {
  it('is undefined for no at-bats', () => {
    expect(newestAtBat([])).toBeUndefined();
  });

  it('picks the last at-bat on the game clock, not the last in the array', () => {
    const live = ab({ result: 'W', inning: 2, half: 'bottom', recordedAt: '2026-09-07T14:30:00.000Z' });
    const earlier = ab({ result: 'L', inning: 2, half: 'top', recordedAt: '2026-09-07T14:20:00.000Z' });
    const backfill = ab({ result: 'W', inning: 1, half: 'top', recordedAt: '2026-09-07T14:59:00.000Z' });
    expect(newestAtBat([earlier, live, backfill])).toBe(live);
    expect(newestAtBat([backfill, live, earlier])).toBe(live);
  });

  it('within a half-inning the most recently recorded wins', () => {
    const a = ab({ result: 'W', recordedAt: '2026-09-07T14:01:00.000Z' });
    const b = ab({ result: 'W', recordedAt: '2026-09-07T14:03:00.000Z' });
    expect(newestAtBat([b, a])).toBe(b);
  });
});

describe('displayResult', () => {
  it('is the batter result when we bat', () => {
    expect(displayResult(ab({ result: 'W' }))).toBe('W');
    expect(displayResult(ab({ result: 'L' }))).toBe('L');
  });

  it('is our pitcher’s result (the inverse) when they bat, matching pitcherResult', () => {
    const theirW = ab({ result: 'W', side: 'them', batterId: 'ob1', pitcherId: 'p1' });
    const theirL = ab({ result: 'L', side: 'them', batterId: 'ob1', pitcherId: 'p1' });
    expect(displayResult(theirW)).toBe('L');
    expect(displayResult(theirL)).toBe('W');
    expect(displayResult(theirW)).toBe(pitcherResult(theirW));
    expect(displayResult(theirL)).toBe(pitcherResult(theirL));
  });
});
