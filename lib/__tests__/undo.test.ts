import { afterEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { buildDemoData } from '../seed';
import type { AtBat, Game } from '../types';
import {
  UNDO_LIMIT,
  applyUndo,
  clearAllUndo,
  clearUndo,
  peekUndo,
  popUndo,
  pushUndo,
  undoLabel,
  useUndoStack,
} from '../undo';
import type { UndoActions, UndoEntry } from '../undo';

// react-test-renderer ships no type declarations in this project, so type just what we use.
type Renderer = { unmount(): void };
type TestRenderer = {
  create(element: React.ReactElement): Renderer;
  act(callback: () => void): void;
};
const { create, act } = require('react-test-renderer') as TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-09-14T12:00:00');
const demo = buildDemoData(NOW);
/** The upcoming game: the default order (Hamilton, Brady, Cooper, Owen Haynes, Gabe, Lucas, …) and nobody up yet. */
const upcoming: Game = demo.games.find((g) => g.id === 'g_next')!;

function ab(over: Partial<AtBat> = {}): AtBat {
  return {
    id: 'ab_1',
    gameId: upcoming.id,
    side: 'us',
    batterId: 'p_hamilton',
    inning: 1,
    half: 'top',
    outcomeId: 'hit',
    result: 'W',
    recordedAt: '2026-09-19T14:35:00.000Z',
    ...over,
  };
}

const record = (over: Partial<AtBat> = {}): UndoEntry => ({ kind: 'record', atBat: ab(over) });

function mockActions(): UndoActions {
  return {
    deleteAtBat: jest.fn(),
    setNextBatter: jest.fn(),
    nextHalfInning: jest.fn(),
    prevHalfInning: jest.fn(),
    updateAtBat: jest.fn(),
    restoreAtBat: jest.fn(),
    undoSubstitution: jest.fn(),
  } as unknown as UndoActions;
}

const calls = (actions: UndoActions) =>
  Object.entries(actions).filter(([, fn]) => (fn as jest.Mock).mock.calls.length > 0).map(([name]) => name);

/** The actions that were called, in the order they were called. */
const callOrder = (actions: UndoActions) =>
  Object.entries(actions)
    .flatMap(([name, fn]) => (fn as jest.Mock).mock.invocationCallOrder.map((n) => ({ name, n })))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.name);

describe('undoLabel', () => {
  it('is plain "Undo" (the disabled state) when there is nothing to undo', () => {
    expect(undoLabel(undefined)).toBe('Undo');
  });

  it('names a recorded at-bat by the letter the coach saw', () => {
    expect(undoLabel(record({ result: 'W' }))).toBe('Undo W');
    expect(undoLabel(record({ result: 'L', outcomeId: 'k_swinging' }))).toBe('Undo L');
    // A plain at-bat reads the same as a typed one: the letter comes from `result`.
    expect(undoLabel(record({ result: 'W', outcomeId: 'plain_w' }))).toBe('Undo W');
  });

  it('shows the pitcher’s letter for an opponent at-bat', () => {
    const theirs = record({ side: 'them', batterId: upcoming.opponentLineup[0].id, pitcherId: 'p_weedon', result: 'L' });
    expect(undoLabel(theirs)).toBe('Undo W');
    const theirW = record({ side: 'them', batterId: upcoming.opponentLineup[0].id, pitcherId: 'p_weedon', result: 'W' });
    expect(undoLabel(theirW)).toBe('Undo L');
  });

  it('names the other kinds', () => {
    expect(undoLabel({ kind: 'skip', side: 'us', fromBatterId: 'p_hamilton', toBatterId: 'p_lucas' })).toBe('Undo skip');
    expect(undoLabel({ kind: 'half', direction: 'next' })).toBe('Undo Next half');
    expect(undoLabel({ kind: 'half', direction: 'prev' })).toBe('Undo Prev half');
    expect(
      undoLabel({
        kind: 'rejudge',
        atBatId: 'ab_1',
        previous: { outcomeId: 'hit', result: 'W', batterId: 'p_hamilton', pitcherId: undefined, inning: 1, half: 'top' },
      }),
    ).toBe('Undo re-judge');
    expect(undoLabel({ kind: 'remove', atBat: ab() })).toBe('Undo remove');
    expect(undoLabel({ kind: 'sub', substitutionId: 'sub_1', slot: 2, outId: 'p_cooper', inId: 'p_owen_clark' })).toBe('Undo sub');
  });
});

describe('applyUndo', () => {
  it('record: deletes that at-bat by id and puts the batter back up at his slot in the CURRENT order', () => {
    const actions = mockActions();
    applyUndo(record({ id: 'ab_recorded' }), upcoming, actions);
    expect(actions.deleteAtBat).toHaveBeenCalledTimes(1);
    // The pointer is set from the entry, never by deleteAtBat's newest-on-the-clock rule.
    expect(actions.deleteAtBat).toHaveBeenCalledWith('ab_recorded', { keepPointer: true });
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'us', 0);
    expect(callOrder(actions)).toEqual(['deleteAtBat', 'setNextBatter']);
    // The order changed since: the batter's id is resolved again, not a stale index.
    const reordered: Game = { ...upcoming, lineup: [...upcoming.lineup].reverse() };
    const again = mockActions();
    applyUndo(record({ id: 'ab_recorded' }), reordered, again);
    expect(again.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'us', upcoming.lineup.length - 1);
  });

  it('record (them): resolves the opponent order', () => {
    const actions = mockActions();
    const theirs = record({ id: 'ab_theirs', side: 'them', batterId: upcoming.opponentLineup[2].id, pitcherId: 'p_weedon' });
    applyUndo(theirs, upcoming, actions);
    expect(actions.deleteAtBat).toHaveBeenCalledWith('ab_theirs', { keepPointer: true });
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'them', 2);
  });

  it('record: only deletes when the batter has left the order', () => {
    const actions = mockActions();
    const without: Game = { ...upcoming, lineup: upcoming.lineup.filter((s) => s.playerId !== 'p_hamilton') };
    applyUndo(record({ id: 'ab_recorded' }), without, actions);
    expect(actions.deleteAtBat).toHaveBeenCalledWith('ab_recorded', { keepPointer: true });
    expect(calls(actions)).toEqual(['deleteAtBat']);
  });

  it('record (backfill): deletes the at-bat but keeps the batter pointer where it is', () => {
    const actions = mockActions();
    applyUndo({ kind: 'record', atBat: ab({ id: 'ab_backfill' }), backfill: true }, upcoming, actions);
    expect(actions.deleteAtBat).toHaveBeenCalledTimes(1);
    expect(actions.deleteAtBat).toHaveBeenCalledWith('ab_backfill', { keepPointer: true });
    expect(calls(actions)).toEqual(['deleteAtBat']);
  });

  it('skip (us): puts the skipped-from batter back up at his slot in the CURRENT order', () => {
    const actions = mockActions();
    applyUndo({ kind: 'skip', side: 'us', fromBatterId: 'p_brady', toBatterId: 'p_lucas' }, upcoming, actions);
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'us', 1);
    expect(calls(actions)).toEqual(['setNextBatter']);
    // The order changed since the skip: the id is resolved again, not a stale index.
    const reordered: Game = { ...upcoming, lineup: [...upcoming.lineup].reverse() };
    const again = mockActions();
    applyUndo({ kind: 'skip', side: 'us', fromBatterId: 'p_brady', toBatterId: 'p_lucas' }, reordered, again);
    expect(again.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'us', upcoming.lineup.length - 2);
  });

  it('skip (them): resolves the opponent order', () => {
    const actions = mockActions();
    const from = upcoming.opponentLineup[4].id;
    applyUndo({ kind: 'skip', side: 'them', fromBatterId: from, toBatterId: upcoming.opponentLineup[7].id }, upcoming, actions);
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'them', 4);
  });

  it('skip: does nothing when the batter has left the order', () => {
    const actions = mockActions();
    const without: Game = { ...upcoming, lineup: upcoming.lineup.filter((s) => s.playerId !== 'p_brady') };
    applyUndo({ kind: 'skip', side: 'us', fromBatterId: 'p_brady', toBatterId: 'p_lucas' }, without, actions);
    expect(calls(actions)).toEqual([]);
  });

  it('half: Next half is undone by prevHalfInning and Prev half by nextHalfInning', () => {
    const next = mockActions();
    applyUndo({ kind: 'half', direction: 'next' }, upcoming, next);
    expect(next.prevHalfInning).toHaveBeenCalledWith(upcoming.id);
    expect(calls(next)).toEqual(['prevHalfInning']);
    const prev = mockActions();
    applyUndo({ kind: 'half', direction: 'prev' }, upcoming, prev);
    expect(prev.nextHalfInning).toHaveBeenCalledWith(upcoming.id);
    expect(calls(prev)).toEqual(['nextHalfInning']);
  });

  it('rejudge: restores the previous fields without the stored result (the store re-derives it)', () => {
    const actions = mockActions();
    applyUndo(
      {
        kind: 'rejudge',
        atBatId: 'ab_7',
        previous: { outcomeId: 'sac_fly', result: 'W', batterId: 'p_cooper', pitcherId: undefined, inning: 2, half: 'top' },
      },
      upcoming,
      actions,
    );
    expect(actions.updateAtBat).toHaveBeenCalledTimes(1);
    const [id, patch] = (actions.updateAtBat as jest.Mock).mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('ab_7');
    expect(patch).toEqual({ outcomeId: 'sac_fly', batterId: 'p_cooper', pitcherId: undefined, inning: 2, half: 'top' });
    expect('result' in patch).toBe(false);
    // An explicit undefined pitcher is part of the restore (it clears one set since).
    expect('pitcherId' in patch).toBe(true);
    expect(calls(actions)).toEqual(['updateAtBat']);
  });

  it('remove: puts the removed copy back, then the batter who was due before the remove', () => {
    const actions = mockActions();
    const removed = ab({ id: 'ab_gone', outcomeId: 'k_looking', result: 'L' });
    // Hamilton's at-bat was removed while Brady was due; the remove rolled the pointer back to Hamilton (0).
    applyUndo({ kind: 'remove', atBat: removed, dueBatterId: 'p_brady' }, { ...upcoming, ourNextBatter: 0 }, actions);
    expect(actions.restoreAtBat).toHaveBeenCalledWith(removed);
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'us', 1);
    expect(callOrder(actions)).toEqual(['restoreAtBat', 'setNextBatter']);
  });

  it('remove (them): resolves the due batter in the opponent order', () => {
    const actions = mockActions();
    const removed = ab({ id: 'ab_gone', side: 'them', batterId: upcoming.opponentLineup[2].id, pitcherId: 'p_weedon' });
    const due = upcoming.opponentLineup[3].id;
    applyUndo({ kind: 'remove', atBat: removed, dueBatterId: due }, { ...upcoming, theirNextBatter: 2 }, actions);
    expect(actions.setNextBatter).toHaveBeenCalledWith(upcoming.id, 'them', 3);
    expect(callOrder(actions)).toEqual(['restoreAtBat', 'setNextBatter']);
  });

  it('remove: restores only, when no due batter was captured', () => {
    const actions = mockActions();
    const removed = ab({ id: 'ab_gone' });
    applyUndo({ kind: 'remove', atBat: removed }, upcoming, actions);
    expect(actions.restoreAtBat).toHaveBeenCalledWith(removed);
    expect(calls(actions)).toEqual(['restoreAtBat']);
  });

  it('remove: restores only, when the due batter has left the order', () => {
    const actions = mockActions();
    const without: Game = { ...upcoming, lineup: upcoming.lineup.filter((s) => s.playerId !== 'p_brady') };
    applyUndo({ kind: 'remove', atBat: ab({ id: 'ab_gone' }), dueBatterId: 'p_brady' }, without, actions);
    expect(calls(actions)).toEqual(['restoreAtBat']);
  });

  it('remove: restores only, when the due batter is already up (the remove had not moved the pointer)', () => {
    const actions = mockActions();
    applyUndo({ kind: 'remove', atBat: ab({ id: 'ab_gone' }), dueBatterId: 'p_brady' }, { ...upcoming, ourNextBatter: 1 }, actions);
    expect(calls(actions)).toEqual(['restoreAtBat']);
  });

  it('sub: hands the record id to undoSubstitution and nothing else (the store checks the slot still holds the sub)', () => {
    const actions = mockActions();
    const entry: UndoEntry = { kind: 'sub', substitutionId: 'sub_1', slot: 2, outId: 'p_cooper', inId: 'p_owen_clark' };
    const subbed: Game = {
      ...upcoming,
      lineup: upcoming.lineup.map((s) => (s.playerId === 'p_cooper' ? { playerId: 'p_owen_clark' } : s)),
      substitutions: [{ id: 'sub_1', slot: 2, outId: 'p_cooper', inId: 'p_owen_clark', inning: 1, half: 'top', at: '2026-09-19T14:40:00.000Z' }],
    };
    applyUndo(entry, subbed, actions);
    expect(actions.undoSubstitution).toHaveBeenCalledTimes(1);
    expect(actions.undoSubstitution).toHaveBeenCalledWith(upcoming.id, 'sub_1');
    expect(calls(actions)).toEqual(['undoSubstitution']);
    // Even when the sub has since left the order: the store's own check decides, the entry never touches the pointer.
    const gone = mockActions();
    applyUndo(entry, upcoming, gone);
    expect(calls(gone)).toEqual(['undoSubstitution']);
  });
});

describe('the per-game stack', () => {
  afterEach(() => {
    clearUndo('g_a');
    clearUndo('g_b');
  });

  it('starts empty: peek and pop give undefined', () => {
    expect(peekUndo('g_a')).toBeUndefined();
    expect(popUndo('g_a')).toBeUndefined();
  });

  it('push / peek / pop are last in, first out', () => {
    const first = record({ id: 'ab_first' });
    const second: UndoEntry = { kind: 'half', direction: 'next' };
    pushUndo('g_a', first);
    pushUndo('g_a', second);
    expect(peekUndo('g_a')).toBe(second);
    expect(popUndo('g_a')).toBe(second);
    expect(peekUndo('g_a')).toBe(first);
    expect(popUndo('g_a')).toBe(first);
    expect(popUndo('g_a')).toBeUndefined();
  });

  it('keeps games apart', () => {
    pushUndo('g_a', record({ id: 'ab_a' }));
    pushUndo('g_b', record({ id: 'ab_b' }));
    expect(peekUndo('g_a')).toMatchObject({ atBat: { id: 'ab_a' } });
    expect(peekUndo('g_b')).toMatchObject({ atBat: { id: 'ab_b' } });
    clearUndo('g_a');
    expect(peekUndo('g_a')).toBeUndefined();
    expect(peekUndo('g_b')).toMatchObject({ atBat: { id: 'ab_b' } });
  });

  it('is capped at UNDO_LIMIT, dropping the oldest entries', () => {
    expect(UNDO_LIMIT).toBe(20);
    for (let i = 0; i < UNDO_LIMIT + 5; i++) pushUndo('g_a', record({ id: `ab_${i}` }));
    const popped: string[] = [];
    for (let e = popUndo('g_a'); e; e = popUndo('g_a')) popped.push((e as { atBat: AtBat }).atBat.id);
    expect(popped).toHaveLength(UNDO_LIMIT);
    expect(popped[0]).toBe(`ab_${UNDO_LIMIT + 4}`);
    expect(popped[popped.length - 1]).toBe('ab_5');
  });

  it('clearUndo empties the stack', () => {
    pushUndo('g_a', record());
    pushUndo('g_a', record({ id: 'ab_2' }));
    clearUndo('g_a');
    expect(peekUndo('g_a')).toBeUndefined();
    expect(() => clearUndo('g_never')).not.toThrow();
  });

  it('clearAllUndo empties every game’s stack', () => {
    pushUndo('g_a', record({ id: 'ab_a' }));
    pushUndo('g_b', record({ id: 'ab_b' }));
    clearAllUndo();
    expect(peekUndo('g_a')).toBeUndefined();
    expect(peekUndo('g_b')).toBeUndefined();
    expect(() => clearAllUndo()).not.toThrow();
  });
});

describe('useUndoStack', () => {
  let renders: UndoEntry[][] = [];
  let renderer: Renderer | undefined;

  function Probe({ gameId }: { gameId?: string }): null {
    renders.push(useUndoStack(gameId));
    return null;
  }

  const mount = (gameId?: string) => {
    renders = [];
    act(() => {
      renderer = create(React.createElement(Probe, { gameId }));
    });
  };
  const latest = () => renders[renders.length - 1];

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    clearUndo('g_hook');
    clearUndo('g_other');
  });

  it('starts empty and re-renders on push, pop and clear', () => {
    mount('g_hook');
    expect(latest()).toEqual([]);
    const entry = record({ id: 'ab_hook' });
    act(() => pushUndo('g_hook', entry));
    expect(latest()).toEqual([entry]);
    const second: UndoEntry = { kind: 'half', direction: 'next' };
    act(() => pushUndo('g_hook', second));
    expect(latest()).toEqual([entry, second]);
    act(() => {
      popUndo('g_hook');
    });
    expect(latest()).toEqual([entry]);
    act(() => clearUndo('g_hook'));
    expect(latest()).toEqual([]);
    act(() => pushUndo('g_hook', entry));
    expect(latest()).toEqual([entry]);
    act(() => clearAllUndo());
    expect(latest()).toEqual([]);
  });

  it('hands back the same array until something changes, and a fresh one after', () => {
    mount('g_hook');
    const before = latest();
    act(() => pushUndo('g_other', record({ id: 'ab_elsewhere' })));
    expect(latest()).toBe(before);
    act(() => pushUndo('g_hook', record({ id: 'ab_here' })));
    expect(latest()).not.toBe(before);
    expect(latest()).toHaveLength(1);
  });

  it('is empty for no game id', () => {
    mount(undefined);
    expect(latest()).toEqual([]);
    act(() => pushUndo('g_hook', record()));
    expect(latest()).toEqual([]);
  });
});
