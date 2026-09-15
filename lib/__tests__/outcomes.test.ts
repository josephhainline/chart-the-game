import { describe, expect, it } from '@jest/globals';

import {
  GENERIC_OUTCOMES,
  LOSS_OUTCOMES,
  OUTCOMES,
  PLAIN_L,
  PLAIN_W,
  WIN_OUTCOMES,
  getOutcome,
  isPlain,
  outcomeLabel,
  outcomeShort,
  plainFor,
} from '../outcomes';
import type { OutcomeId } from '../types';

/** An id from a newer build this one does not know about. */
const UNKNOWN = 'hr_bomb' as OutcomeId;

describe('the plain pair', () => {
  it('is a W and an L with no label for the grid and no scorebook code', () => {
    expect(PLAIN_W).toEqual({ id: 'plain_w', label: 'Win', short: '', result: 'W' });
    expect(PLAIN_L).toEqual({ id: 'plain_l', label: 'Loss', short: '', result: 'L' });
    expect(GENERIC_OUTCOMES).toEqual([PLAIN_L, PLAIN_W]);
  });

  it('is not part of the twelve, so the grid and the spec list are untouched', () => {
    expect(OUTCOMES).toHaveLength(12);
    expect(LOSS_OUTCOMES).toHaveLength(6);
    expect(WIN_OUTCOMES).toHaveLength(6);
    expect(OUTCOMES.some((o) => isPlain(o.id))).toBe(false);
  });

  it('isPlain is true only for the two plain ids', () => {
    expect(isPlain('plain_w')).toBe(true);
    expect(isPlain('plain_l')).toBe(true);
    for (const o of OUTCOMES) expect(isPlain(o.id)).toBe(false);
    expect(isPlain(UNKNOWN)).toBe(false);
  });

  it('plainFor maps a result to the plain id carrying that result', () => {
    expect(plainFor('W')).toBe('plain_w');
    expect(plainFor('L')).toBe('plain_l');
    expect(getOutcome(plainFor('W')).result).toBe('W');
    expect(getOutcome(plainFor('L')).result).toBe('L');
  });
});

describe('getOutcome', () => {
  it('resolves every typed outcome to its catalog entry', () => {
    for (const o of OUTCOMES) expect(getOutcome(o.id)).toBe(o);
  });

  it('resolves the plain ids too', () => {
    expect(getOutcome('plain_w')).toBe(PLAIN_W);
    expect(getOutcome('plain_l')).toBe(PLAIN_L);
  });

  it('still throws for an unknown id', () => {
    expect(() => getOutcome(UNKNOWN)).toThrow('Unknown outcome hr_bomb');
  });
});

describe('outcomeShort', () => {
  it('is the scorebook code for a typed outcome', () => {
    expect(outcomeShort('k_swinging')).toBe('K');
    expect(outcomeShort('walk_2_looking')).toBe('BB(2K)');
    expect(outcomeShort('hit')).toBe('H');
    for (const o of OUTCOMES) expect(outcomeShort(o.id)).toBe(o.short);
  });

  it('is blank for a plain at-bat (the letter alone is the record)', () => {
    expect(outcomeShort('plain_w')).toBe('');
    expect(outcomeShort('plain_l')).toBe('');
  });

  it('is blank, not a throw, for an id this build does not know', () => {
    expect(() => outcomeShort(UNKNOWN)).not.toThrow();
    expect(outcomeShort(UNKNOWN)).toBe('');
  });
});

describe('outcomeLabel', () => {
  it('is the single-line label for a typed outcome', () => {
    expect(outcomeLabel('k_swinging')).toBe('Strikeout Swinging');
    expect(outcomeLabel('fly_out_hard')).toBe('Fly Out, Hard Hit Ball');
    expect(outcomeLabel('walk_2_looking')).toBe("Walk, Didn't Swing & Took 2 Strikes Looking");
    for (const o of OUTCOMES) expect(outcomeLabel(o.id)).not.toContain('\n');
  });

  it('is blank for a plain at-bat', () => {
    expect(outcomeLabel('plain_w')).toBe('');
    expect(outcomeLabel('plain_l')).toBe('');
  });

  it('falls back to the raw id, not a throw, for an unknown id', () => {
    expect(() => outcomeLabel(UNKNOWN)).not.toThrow();
    expect(outcomeLabel(UNKNOWN)).toBe('hr_bomb');
  });
});
