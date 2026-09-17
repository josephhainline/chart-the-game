import { describe, expect, it } from '@jest/globals';

import {
  GENERIC_OUTCOMES,
  LOSS_OUTCOMES,
  OUTCOMES,
  PITCHER_LOSS_OUTCOMES,
  PITCHER_OUTCOMES,
  PITCHER_WIN_OUTCOMES,
  PLAIN_L,
  PLAIN_W,
  WIN_OUTCOMES,
  catalogFor,
  getOutcome,
  isPlain,
  outcomeLabel,
  outcomeShort,
  outcomeSide,
  plainFor,
} from '../outcomes';
import type { OutcomeId } from '../types';

/** An id from a newer build this one does not know about. */
const UNKNOWN = 'hr_bomb' as OutcomeId;

const ALL = [...OUTCOMES, ...PITCHER_OUTCOMES, ...GENERIC_OUTCOMES];

describe('the plain pair', () => {
  it('is a W and an L for either side with no label for the grid and no scorebook code', () => {
    expect(PLAIN_W).toEqual({ id: 'plain_w', label: 'Win', short: '', side: 'either', result: 'W' });
    expect(PLAIN_L).toEqual({ id: 'plain_l', label: 'Loss', short: '', side: 'either', result: 'L' });
    expect(GENERIC_OUTCOMES).toEqual([PLAIN_L, PLAIN_W]);
  });

  it('is not part of either grid', () => {
    expect(OUTCOMES.some((o) => isPlain(o.id))).toBe(false);
    expect(PITCHER_OUTCOMES.some((o) => isPlain(o.id))).toBe(false);
  });

  it('isPlain is true only for the two plain ids', () => {
    expect(isPlain('plain_w')).toBe(true);
    expect(isPlain('plain_l')).toBe(true);
    for (const o of [...OUTCOMES, ...PITCHER_OUTCOMES]) expect(isPlain(o.id)).toBe(false);
    expect(isPlain(UNKNOWN)).toBe(false);
  });

  it('plainFor maps the graded player’s letter to the plain id carrying it, on either side', () => {
    expect(plainFor('W')).toBe('plain_w');
    expect(plainFor('L')).toBe('plain_l');
    expect(getOutcome(plainFor('W')).result).toBe('W');
    expect(getOutcome(plainFor('L')).result).toBe('L');
  });
});

describe('the batter catalog', () => {
  it('is the thirteen batter outcomes: six L, seven W with Hit by Pitch last', () => {
    expect(OUTCOMES).toHaveLength(13);
    expect(LOSS_OUTCOMES).toHaveLength(6);
    expect(WIN_OUTCOMES).toHaveLength(7);
    expect(OUTCOMES).toEqual([...LOSS_OUTCOMES, ...WIN_OUTCOMES]);
    expect(LOSS_OUTCOMES.map((o) => o.id)).toEqual(['k_swinging', 'walk_2_looking', 'error_weak', 'fc_weak', 'bunt', 'k_looking']);
    expect(WIN_OUTCOMES.map((o) => o.id)).toEqual(['sac_fly', 'walk_clean', 'error_hard', 'fc_hard', 'fly_out_hard', 'hit', 'hbp']);
    for (const o of LOSS_OUTCOMES) expect(o).toMatchObject({ side: 'batter', result: 'L' });
    for (const o of WIN_OUTCOMES) expect(o).toMatchObject({ side: 'batter', result: 'W' });
  });

  it('Hit by Pitch is a batter W with the HBP code', () => {
    expect(getOutcome('hbp')).toEqual({ id: 'hbp', label: 'Hit by\nPitch', short: 'HBP', side: 'batter', result: 'W' });
  });

  it('the hard-hit out keeps its id, its F+ code and its W under the wider label', () => {
    expect(getOutcome('fly_out_hard')).toEqual({ id: 'fly_out_hard', label: 'Out,\nHard Hit Ball', short: 'F+', side: 'batter', result: 'W' });
  });
});

describe('the pitcher catalog', () => {
  it('is the eight pitcher outcomes: four L, four W, in grid order', () => {
    expect(PITCHER_OUTCOMES).toHaveLength(8);
    expect(PITCHER_LOSS_OUTCOMES).toHaveLength(4);
    expect(PITCHER_WIN_OUTCOMES).toHaveLength(4);
    expect(PITCHER_OUTCOMES).toEqual([...PITCHER_LOSS_OUTCOMES, ...PITCHER_WIN_OUTCOMES]);
    expect(PITCHER_LOSS_OUTCOMES.map((o) => [o.id, o.label, o.short])).toEqual([
      ['p_walk', 'Walk', 'BB'],
      ['p_hbp', 'Hit by\nPitch', 'HBP'],
      ['p_hard_reached', 'Hard Hit Ball,\nReached', 'R+'],
      ['p_hard_out', 'Hard Hit Ball,\nOut', 'O+'],
    ]);
    expect(PITCHER_WIN_OUTCOMES.map((o) => [o.id, o.label, o.short])).toEqual([
      ['p_k_swinging', 'Strikeout\nSwinging', 'K'],
      ['p_k_looking', 'Strikeout\nLooking', 'KL'],
      ['p_weak_out', 'Weak Hit Ball,\nOut', 'O-'],
      ['p_weak_reached', 'Weak Hit Ball,\nReached', 'R-'],
    ]);
    for (const o of PITCHER_LOSS_OUTCOMES) expect(o).toMatchObject({ side: 'pitcher', result: 'L' });
    for (const o of PITCHER_WIN_OUTCOMES) expect(o).toMatchObject({ side: 'pitcher', result: 'W' });
  });

  it('carries the PITCHER’s letter: a walk is his L, a strikeout his W, nothing is inverted', () => {
    expect(getOutcome('p_walk').result).toBe('L');
    expect(getOutcome('p_hbp').result).toBe('L');
    expect(getOutcome('p_k_swinging').result).toBe('W');
    expect(getOutcome('p_weak_reached').result).toBe('W');
  });
});

describe('the catalogs together', () => {
  it('hold twenty-three unique ids, each a stable lowercase id', () => {
    expect(ALL).toHaveLength(23);
    expect(new Set(ALL.map((o) => o.id)).size).toBe(23);
    for (const o of ALL) expect(o.id).toMatch(/^[a-z_0-9]+$/);
  });

  it('every grid entry has a non-empty label and a scorebook code Lato can render', () => {
    for (const o of [...OUTCOMES, ...PITCHER_OUTCOMES]) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.short.length).toBeGreaterThan(0);
      // Lato has no glyph for the mirrored K some scorebooks use.
      expect(o.short).toMatch(/^[A-Z0-9()+-]+$/);
      expect(outcomeLabel(o.id)).not.toContain('\n');
      expect(outcomeLabel(o.id).length).toBeGreaterThan(0);
    }
  });

  it('a code may name the same play on both sides (K, KL, BB, HBP) while the ids stay apart', () => {
    for (const [batter, pitcher] of [
      ['k_swinging', 'p_k_swinging'],
      ['k_looking', 'p_k_looking'],
      ['hbp', 'p_hbp'],
    ] as const) {
      expect(outcomeShort(batter)).toBe(outcomeShort(pitcher));
      expect(outcomeLabel(batter)).toBe(outcomeLabel(pitcher));
    }
    expect(outcomeShort('walk_clean')).toBe(outcomeShort('p_walk'));
  });

  it('catalogFor gives the batter grid when we bat and the pitcher grid when they do', () => {
    expect(catalogFor('us')).toEqual({ loss: LOSS_OUTCOMES, win: WIN_OUTCOMES });
    expect(catalogFor('them')).toEqual({ loss: PITCHER_LOSS_OUTCOMES, win: PITCHER_WIN_OUTCOMES });
    expect(catalogFor('us').loss).toBe(LOSS_OUTCOMES);
    expect(catalogFor('them').win).toBe(PITCHER_WIN_OUTCOMES);
  });

  it('outcomeSide says who an id grades, and "either" for the plain pair and for an unknown id, never throwing', () => {
    for (const o of OUTCOMES) expect(outcomeSide(o.id)).toBe('batter');
    for (const o of PITCHER_OUTCOMES) expect(outcomeSide(o.id)).toBe('pitcher');
    expect(outcomeSide('plain_w')).toBe('either');
    expect(outcomeSide('plain_l')).toBe('either');
    expect(() => outcomeSide(UNKNOWN)).not.toThrow();
    expect(outcomeSide(UNKNOWN)).toBe('either');
  });
});

describe('getOutcome', () => {
  it('resolves every batter and pitcher outcome to its catalog entry', () => {
    for (const o of OUTCOMES) expect(getOutcome(o.id)).toBe(o);
    for (const o of PITCHER_OUTCOMES) expect(getOutcome(o.id)).toBe(o);
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
  it('is the scorebook code for a typed outcome on either side', () => {
    expect(outcomeShort('k_swinging')).toBe('K');
    expect(outcomeShort('walk_2_looking')).toBe('BB(2K)');
    expect(outcomeShort('hit')).toBe('H');
    expect(outcomeShort('hbp')).toBe('HBP');
    expect(outcomeShort('p_walk')).toBe('BB');
    expect(outcomeShort('p_hard_reached')).toBe('R+');
    expect(outcomeShort('p_weak_out')).toBe('O-');
    for (const o of [...OUTCOMES, ...PITCHER_OUTCOMES]) expect(outcomeShort(o.id)).toBe(o.short);
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
  it('is the single-line label for a typed outcome on either side', () => {
    expect(outcomeLabel('k_swinging')).toBe('Strikeout Swinging');
    expect(outcomeLabel('fly_out_hard')).toBe('Out, Hard Hit Ball');
    expect(outcomeLabel('hbp')).toBe('Hit by Pitch');
    expect(outcomeLabel('walk_2_looking')).toBe("Walk, Didn't Swing & Took 2 Strikes Looking");
    expect(outcomeLabel('p_walk')).toBe('Walk');
    expect(outcomeLabel('p_hard_reached')).toBe('Hard Hit Ball, Reached');
    expect(outcomeLabel('p_weak_reached')).toBe('Weak Hit Ball, Reached');
    expect(outcomeLabel('p_k_looking')).toBe('Strikeout Looking');
    for (const o of [...OUTCOMES, ...PITCHER_OUTCOMES]) expect(outcomeLabel(o.id)).not.toContain('\n');
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
