import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import { AppState } from 'react-native';

import { newestAtBat, sortAtBats } from '../atbats';
import { buildDemoData } from '../seed';
import { gameHitting, gamePitching, hittingFor, pitchingFor, scorebook } from '../stats';
import { BACKUP_KEY, STORAGE_KEY, StoreProvider, battingSide, carryNextBatter, useStore } from '../store';
import type { Store } from '../store';
import type { AppData, AtBat, Game } from '../types';
import { applyUndo, clearAllUndo, peekUndo, popUndo, pushUndo } from '../undo';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-test-renderer ships no type declarations in this project, so type just what we use.
type Renderer = { unmount(): void };
type TestRenderer = {
  create(element: React.ReactElement): Renderer;
  act(callback: () => void): void;
  act(callback: () => Promise<void>): Promise<void>;
};
const { create, act } = require('react-test-renderer') as TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MockStorage = {
  setItem: jest.Mock<(key: string, value: string) => Promise<void>>;
  getItem: jest.Mock<(key: string) => Promise<string | null>>;
  __INTERNAL_MOCK_STORAGE__: Record<string, string>;
};
const storage = require('@react-native-async-storage/async-storage') as MockStorage;

type MockAppState = { addEventListener: jest.Mock<(type: string, handler: (state: string) => void) => { remove(): void }> };
const appState = AppState as unknown as MockAppState;

const NOW = new Date('2026-09-14T12:00:00');
const SCHEDULED = 'g_tigers_2';

let latest: Store | undefined;
let renderer: Renderer | undefined;

/** The store as of the most recent render. Always read through this after an action. */
const store = (): Store => {
  if (!latest) throw new Error('store not mounted');
  return latest;
};
const game = (id: string): Game => {
  const g = store().data.games.find((x) => x.id === id);
  if (!g) throw new Error(`no game ${id}`);
  return g;
};
const run = (fn: (s: Store) => void) => act(() => fn(store()));

function Probe(): null {
  latest = useStore();
  return null;
}

function mount(initialData?: AppData) {
  act(() => {
    renderer = create(React.createElement(StoreProvider, { initialData, children: React.createElement(Probe) }));
  });
}

function unmount() {
  act(() => renderer?.unmount());
  renderer = undefined;
}

/** The document most recently handed to AsyncStorage.setItem under STORAGE_KEY. */
function lastWritten(): AppData | undefined {
  const calls = storage.setItem.mock.calls.filter(([key]) => key === STORAGE_KEY);
  const last = calls[calls.length - 1];
  return last ? (JSON.parse(last[1]) as AppData) : undefined;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Let the async load (getItem/setItem promise chains) settle. Real timers only. */
const settle = () => act(() => sleep(0));
/** Wait out the write debounce. Real timers only. */
const waitForSave = () => act(() => sleep(250));

describe('battingSide', () => {
  it('the away team bats in the top half', () => {
    expect(battingSide({ isAway: true, half: 'top' })).toBe('us');
    expect(battingSide({ isAway: true, half: 'bottom' })).toBe('them');
  });

  it('the home team bats in the bottom half', () => {
    expect(battingSide({ isAway: false, half: 'top' })).toBe('them');
    expect(battingSide({ isAway: false, half: 'bottom' })).toBe('us');
  });
});

describe('carryNextBatter', () => {
  const idOf = (x: string) => x;
  const order = ['a', 'b', 'c', 'd'];

  it('keeps the same batter due after a reorder', () => {
    expect(carryNextBatter(order, 2, ['c', 'a', 'd', 'b'], idOf)).toBe(0);
    expect(carryNextBatter(order, 0, ['d', 'c', 'b', 'a'], idOf)).toBe(3);
  });

  it('keeps the same batter due when someone ahead of them is removed', () => {
    expect(carryNextBatter(order, 2, ['b', 'c', 'd'], idOf)).toBe(1);
  });

  it('moves to the next surviving batter in the old order when the due batter is removed', () => {
    expect(carryNextBatter(order, 1, ['a', 'c', 'd'], idOf)).toBe(1); // b gone -> c
    expect(carryNextBatter(order, 1, ['a', 'd'], idOf)).toBe(1); // b, c gone -> d
    expect(carryNextBatter(order, 3, ['a', 'b', 'c'], idOf)).toBe(0); // last batter gone -> wraps to a
  });

  it('falls back to the top when nobody from the old order remains or an order is empty', () => {
    expect(carryNextBatter(order, 2, ['x', 'y'], idOf)).toBe(0);
    expect(carryNextBatter([], 0, ['x'], idOf)).toBe(0);
    expect(carryNextBatter(order, 2, [], idOf)).toBe(0);
  });

  it('tolerates an out-of-range index by wrapping it like the CTG screen does', () => {
    expect(carryNextBatter(order, 6, order, idOf)).toBe(2);
  });
});

describe('StoreProvider actions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    latest = undefined;
    mount(buildDemoData(NOW));
  });

  afterEach(() => {
    unmount();
    jest.useRealTimers();
  });

  it('is ready immediately with the given initial data (no storage read)', () => {
    expect(store().ready).toBe(true);
    expect(store().loadIssue).toBeUndefined();
    expect(store().data.games).toHaveLength(7);
    expect(store().data.onboarded).toBe(false);
  });

  describe('recordAtBat', () => {
    it('records our batter, advances the order and marks the game in progress', () => {
      const before = store().data.atBats.length;
      let recorded: ReturnType<Store['recordAtBat']>;
      run((s) => {
        recorded = s.recordAtBat(SCHEDULED, 'hit');
      });
      const g = game(SCHEDULED);
      expect(recorded).toMatchObject({
        gameId: SCHEDULED,
        side: 'us',
        batterId: 'p_owen',
        inning: 1,
        half: 'top',
        outcomeId: 'hit',
        result: 'W',
      });
      expect(recorded!.pitcherId).toBeUndefined();
      expect(g.status).toBe('in_progress');
      expect(g.ourNextBatter).toBe(1);
      expect(g.theirNextBatter).toBe(0);
      expect(store().data.atBats).toHaveLength(before + 1);
      expect(store().data.atBats[store().data.atBats.length - 1]).toEqual(recorded);
    });

    it('takes the result from the outcome (L outcomes give the batter an L)', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'k_looking'));
      const last = store().data.atBats[store().data.atBats.length - 1];
      expect(last.result).toBe('L');
      expect(last.outcomeId).toBe('k_looking');
      expect(last.batterId).toBe('p_owen');
    });

    it('wraps back to the top of the order after the last batter', () => {
      const len = game(SCHEDULED).lineup.length;
      run((s) => {
        for (let i = 0; i < len; i++) s.recordAtBat(SCHEDULED, 'hit');
      });
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      run((s) => s.recordAtBat(SCHEDULED, 'bunt'));
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
      const ours = store().data.atBats.filter((x) => x.gameId === SCHEDULED);
      expect(ours).toHaveLength(len + 1);
      expect(ours[len].batterId).toBe('p_owen');
    });

    it('when they bat, charges the at-bat to their batter and our pitcher', () => {
      run((s) => s.nextHalfInning(SCHEDULED)); // bottom 1st: home team (Tigers) bats
      let recorded: ReturnType<Store['recordAtBat']>;
      run((s) => {
        recorded = s.recordAtBat(SCHEDULED, 'k_swinging');
      });
      const g = game(SCHEDULED);
      expect(recorded).toMatchObject({
        side: 'them',
        batterId: g.opponentLineup[0].id,
        pitcherId: 'p_weedon',
        inning: 1,
        half: 'bottom',
        result: 'L',
      });
      expect(g.theirNextBatter).toBe(1);
      expect(g.ourNextBatter).toBe(0);
    });

    it('uses the game’s current pitcher at the moment of the at-bat', () => {
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.setPitcher(SCHEDULED, 'p_owen');
      });
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      const last = store().data.atBats[store().data.atBats.length - 1];
      expect(last.pitcherId).toBe('p_owen');
      expect(last.result).toBe('W');
    });

    it('returns undefined for an unknown game or an empty batting order', () => {
      let created: Game | undefined;
      run((s) => {
        created = s.addGame('t_bears13u', { opponent: 'Nobody', isAway: true, startsAt: NOW.toISOString() });
      });
      expect(created!.lineup).toEqual([]);
      let result: ReturnType<Store['recordAtBat']> = undefined;
      run((s) => {
        result = s.recordAtBat(created!.id, 'hit');
      });
      expect(result).toBeUndefined();
      expect(game(created!.id).status).toBe('scheduled');
      run((s) => {
        result = s.recordAtBat('nope', 'hit');
      });
      expect(result).toBeUndefined();
    });

    it('does not change the status of a final game', () => {
      run((s) => s.recordAtBat('g_bandits', 'hit'));
      expect(game('g_bandits').status).toBe('final');
    });

    describe('a plain at-bat (the big W/L, no play type)', () => {
      it('stores the plain id with the result it carries and advances the order like any at-bat', () => {
        let recorded: ReturnType<Store['recordAtBat']>;
        run((s) => {
          recorded = s.recordAtBat(SCHEDULED, 'plain_w');
        });
        expect(recorded).toMatchObject({ batterId: 'p_owen', outcomeId: 'plain_w', result: 'W', side: 'us' });
        run((s) => s.recordAtBat(SCHEDULED, 'plain_l'));
        const ours = store().data.atBats.filter((x) => x.gameId === SCHEDULED);
        expect(ours.map((x) => [x.batterId, x.outcomeId, x.result])).toEqual([
          ['p_owen', 'plain_w', 'W'],
          ['p_ryder', 'plain_l', 'L'],
        ]);
        expect(game(SCHEDULED)).toMatchObject({ status: 'in_progress', ourNextBatter: 2 });
      });

      it('flows through the hitting totals and the scorebook exactly like a typed one', () => {
        run((s) => {
          s.recordAtBat(SCHEDULED, 'plain_w');
          s.recordAtBat(SCHEDULED, 'plain_l');
          s.recordAtBat(SCHEDULED, 'hit');
        });
        expect(gameHitting(store().data.atBats, SCHEDULED)).toEqual({ w: 2, l: 1 });
        expect(hittingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual({ w: 1, l: 0 });
        expect(hittingFor(store().data.atBats, 'p_ryder', SCHEDULED)).toEqual({ w: 0, l: 1 });
        const book = scorebook(store().data.atBats, SCHEDULED, 'us', game(SCHEDULED).lineup.map((x) => ({ id: x.playerId })));
        expect(book.rows[0].innings[0].map((x) => [x.result, x.outcomeId])).toEqual([['W', 'plain_w']]);
        expect(book.rows[1].innings[0].map((x) => [x.result, x.outcomeId])).toEqual([['L', 'plain_l']]);
        expect(book.rows[0].wl).toEqual({ w: 1, l: 0 });
      });

      it('on the pitching side the stored result stays the batter’s and the pitcher line inverts it', () => {
        run((s) => s.nextHalfInning(SCHEDULED)); // Tigers bat, Weedon pitching
        run((s) => {
          s.recordAtBat(SCHEDULED, 'plain_l'); // our pitcher won
          s.recordAtBat(SCHEDULED, 'plain_w'); // their batter won
        });
        const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
        expect(theirs.map((x) => [x.outcomeId, x.result, x.pitcherId])).toEqual([
          ['plain_l', 'L', 'p_weedon'],
          ['plain_w', 'W', 'p_weedon'],
        ]);
        expect(gamePitching(store().data.atBats, SCHEDULED)).toEqual({ w: 1, l: 1 });
        expect(pitchingFor(store().data.atBats, 'p_weedon', SCHEDULED)).toEqual({ w: 1, l: 1 });
        const book = scorebook(store().data.atBats, SCHEDULED, 'them', game(SCHEDULED).opponentLineup);
        expect(book.rows[0].wl).toEqual({ w: 1, l: 0 });
        expect(book.rows[1].wl).toEqual({ w: 0, l: 1 });
      });
    });

    describe('with a target (a backfill)', () => {
      it('stamps the given batter and half-inning and leaves both pointers and the clock alone', () => {
        run((s) => {
          s.recordAtBat(SCHEDULED, 'hit'); // Owen; Ryder due
          s.nextHalfInning(SCHEDULED);
          s.nextHalfInning(SCHEDULED); // top 2nd
        });
        expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top', ourNextBatter: 1, theirNextBatter: 0 });
        let recorded: ReturnType<Store['recordAtBat']>;
        run((s) => {
          recorded = s.recordAtBat(SCHEDULED, 'plain_l', { side: 'us', batterId: 'p_matthew', inning: 1, half: 'top' });
        });
        expect(recorded).toMatchObject({
          gameId: SCHEDULED,
          side: 'us',
          batterId: 'p_matthew',
          inning: 1,
          half: 'top',
          outcomeId: 'plain_l',
          result: 'L',
        });
        expect(recorded!.pitcherId).toBeUndefined();
        expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top', ourNextBatter: 1, theirNextBatter: 0 });
        expect(store().data.atBats.some((x) => x.id === recorded!.id)).toBe(true);
        // It sits in its own half-inning in every sorted view, even though it was recorded last.
        const sorted = sortAtBats(store().data.atBats.filter((x) => x.gameId === SCHEDULED));
        expect(sorted.map((x) => x.batterId)).toEqual(['p_owen', 'p_matthew']);
      });

      it('credits the current pitcher when the target is their side, and starts a scheduled game', () => {
        expect(game(SCHEDULED).status).toBe('scheduled');
        const ob3 = game(SCHEDULED).opponentLineup[2].id;
        let recorded: ReturnType<Store['recordAtBat']>;
        run((s) => {
          recorded = s.recordAtBat(SCHEDULED, 'k_swinging', { side: 'them', batterId: ob3, inning: 1, half: 'bottom' });
        });
        expect(recorded).toMatchObject({ side: 'them', batterId: ob3, pitcherId: 'p_weedon', inning: 1, half: 'bottom', result: 'L' });
        expect(game(SCHEDULED)).toMatchObject({ status: 'in_progress', inning: 1, half: 'top', ourNextBatter: 0, theirNextBatter: 0 });
      });

      it('does not need the batter to be in the order (a batter who has left the game)', () => {
        run((s) => s.setGameLineup(SCHEDULED, game(SCHEDULED).lineup.filter((x) => x.playerId !== 'p_ben')));
        let recorded: ReturnType<Store['recordAtBat']>;
        run((s) => {
          recorded = s.recordAtBat(SCHEDULED, 'hit', { side: 'us', batterId: 'p_ben', inning: 1, half: 'top' });
        });
        expect(recorded).toMatchObject({ batterId: 'p_ben', result: 'W' });
        expect(game(SCHEDULED).ourNextBatter).toBe(0);
      });

      it('returns undefined for an unknown game', () => {
        let result: ReturnType<Store['recordAtBat']> = undefined;
        run((s) => {
          result = s.recordAtBat('nope', 'hit', { side: 'us', batterId: 'p_owen', inning: 1, half: 'top' });
        });
        expect(result).toBeUndefined();
      });
    });
  });

  describe('setPitcher', () => {
    /** Bottom 1st with no pitcher chosen, then two opponent at-bats nobody is credited for. */
    const chartWithoutPitcher = () => {
      run((s) => {
        s.setPitcher(SCHEDULED, undefined);
        s.nextHalfInning(SCHEDULED);
      });
      run((s) => {
        s.recordAtBat(SCHEDULED, 'k_swinging');
        s.recordAtBat(SCHEDULED, 'hit');
      });
      const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
      expect(theirs).toHaveLength(2);
      expect(theirs.every((x) => x.pitcherId === undefined)).toBe(true);
    };

    it('credits opponent at-bats charted this half-inning before a pitcher was chosen', () => {
      chartWithoutPitcher();
      run((s) => s.setPitcher(SCHEDULED, 'p_owen'));
      expect(game(SCHEDULED).pitcherId).toBe('p_owen');
      const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
      expect(theirs.map((x) => x.pitcherId)).toEqual(['p_owen', 'p_owen']);
      // The pitcher's line now matches the game's pitching line.
      expect(pitchingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual(gamePitching(store().data.atBats, SCHEDULED));
      expect(pitchingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual({ w: 1, l: 1 });
    });

    it('never re-credits at-bats that already name a pitcher (a mid-inning relief change)', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      run((s) => s.recordAtBat(SCHEDULED, 'k_swinging')); // credited to Weedon
      run((s) => s.setPitcher(SCHEDULED, 'p_owen'));
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
      expect(theirs.map((x) => x.pitcherId)).toEqual(['p_weedon', 'p_owen']);
    });

    it('leaves unassigned at-bats from earlier half-innings and other games alone', () => {
      chartWithoutPitcher();
      run((s) => {
        s.nextHalfInning(SCHEDULED); // top 2nd (we bat)
        s.nextHalfInning(SCHEDULED); // bottom 2nd (they bat)
      });
      run((s) => s.recordAtBat(SCHEDULED, 'bunt'));
      const banditsBefore = store().data.atBats.filter((x) => x.gameId === 'g_bandits');
      run((s) => s.setPitcher(SCHEDULED, 'p_lucas'));
      const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
      expect(theirs.map((x) => [x.inning, x.pitcherId])).toEqual([
        [1, undefined],
        [1, undefined],
        [2, 'p_lucas'],
      ]);
      expect(store().data.atBats.filter((x) => x.gameId === 'g_bandits')).toEqual(banditsBefore);
    });

    it('clearing the pitcher changes nothing about recorded at-bats', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      run((s) => s.recordAtBat(SCHEDULED, 'k_swinging'));
      const before = store().data.atBats;
      run((s) => s.setPitcher(SCHEDULED, undefined));
      expect(game(SCHEDULED).pitcherId).toBeUndefined();
      expect(store().data.atBats).toEqual(before);
    });

    it('ignores an unknown game', () => {
      const before = store().data;
      run((s) => s.setPitcher('nope', 'p_owen'));
      expect(store().data).toBe(before);
    });

    describe('with recreditHalf', () => {
      it('re-stamps this half’s opponent at-bats that name a different pitcher, and still credits unassigned ones', () => {
        run((s) => s.nextHalfInning(SCHEDULED)); // bottom 1st, Weedon pitching
        run((s) => {
          s.recordAtBat(SCHEDULED, 'k_swinging'); // Weedon
          s.recordAtBat(SCHEDULED, 'hit'); // Weedon
        });
        run((s) => s.setPitcher(SCHEDULED, undefined));
        run((s) => s.recordAtBat(SCHEDULED, 'bunt')); // nobody
        run((s) => s.setPitcher(SCHEDULED, 'p_owen', { recreditHalf: true }));
        expect(game(SCHEDULED).pitcherId).toBe('p_owen');
        const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
        expect(theirs.map((x) => x.pitcherId)).toEqual(['p_owen', 'p_owen', 'p_owen']);
        expect(pitchingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual(gamePitching(store().data.atBats, SCHEDULED));
        expect(pitchingFor(store().data.atBats, 'p_weedon', SCHEDULED)).toEqual({ w: 0, l: 0 });
      });

      it('leaves earlier half-innings, our at-bats and other games alone', () => {
        run((s) => s.nextHalfInning(SCHEDULED)); // bottom 1st
        run((s) => s.recordAtBat(SCHEDULED, 'k_swinging')); // Weedon, 1st
        run((s) => {
          s.nextHalfInning(SCHEDULED); // top 2nd
          s.recordAtBat(SCHEDULED, 'hit'); // ours
          s.nextHalfInning(SCHEDULED); // bottom 2nd
        });
        run((s) => s.recordAtBat(SCHEDULED, 'fc_weak')); // Weedon, 2nd
        const banditsBefore = store().data.atBats.filter((x) => x.gameId === 'g_bandits');
        run((s) => s.setPitcher(SCHEDULED, 'p_lucas', { recreditHalf: true }));
        const mine = store().data.atBats.filter((x) => x.gameId === SCHEDULED);
        expect(mine.map((x) => [x.side, x.inning, x.pitcherId])).toEqual([
          ['them', 1, 'p_weedon'],
          ['us', 2, undefined],
          ['them', 2, 'p_lucas'],
        ]);
        expect(store().data.atBats.filter((x) => x.gameId === 'g_bandits')).toEqual(banditsBefore);
      });

      it('is the default-off behavior when the option is false or absent', () => {
        run((s) => s.nextHalfInning(SCHEDULED));
        run((s) => s.recordAtBat(SCHEDULED, 'k_swinging')); // Weedon
        run((s) => s.setPitcher(SCHEDULED, 'p_owen', { recreditHalf: false }));
        run((s) => s.setPitcher(SCHEDULED, 'p_lucas', {}));
        const theirs = store().data.atBats.filter((x) => x.gameId === SCHEDULED && x.side === 'them');
        expect(theirs.map((x) => x.pitcherId)).toEqual(['p_weedon']);
        expect(game(SCHEDULED).pitcherId).toBe('p_lucas');
      });

      it('clearing the pitcher with recreditHalf changes no at-bat', () => {
        run((s) => s.nextHalfInning(SCHEDULED));
        run((s) => s.recordAtBat(SCHEDULED, 'k_swinging'));
        const before = store().data.atBats;
        run((s) => s.setPitcher(SCHEDULED, undefined, { recreditHalf: true }));
        expect(store().data.atBats).toEqual(before);
        expect(game(SCHEDULED).pitcherId).toBeUndefined();
      });
    });
  });

  describe('undoLastAtBat', () => {
    it('removes the last at-bat and rolls the batter index back', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit');
        s.recordAtBat(SCHEDULED, 'k_swinging');
      });
      const count = store().data.atBats.length;
      let undone: ReturnType<Store['undoLastAtBat']>;
      run((s) => {
        undone = s.undoLastAtBat(SCHEDULED);
      });
      expect(undone).toMatchObject({ batterId: 'p_ryder', outcomeId: 'k_swinging' });
      expect(store().data.atBats).toHaveLength(count - 1);
      expect(store().data.atBats.some((x) => x.id === undone!.id)).toBe(false);
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
    });

    it('restores the inning and half of the undone at-bat', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit');
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED);
      });
      expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top' });
      run((s) => s.undoLastAtBat(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'top', ourNextBatter: 0 });
    });

    it('rolls back their index when the last at-bat was theirs', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit');
        s.nextHalfInning(SCHEDULED);
        s.recordAtBat(SCHEDULED, 'hit');
      });
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, theirNextBatter: 1, half: 'bottom' });
      run((s) => s.undoLastAtBat(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, theirNextBatter: 0, inning: 1, half: 'bottom' });
    });

    it('wraps the index to the end of the order when undoing from index 0', () => {
      const len = game(SCHEDULED).lineup.length;
      run((s) => {
        for (let i = 0; i < len; i++) s.recordAtBat(SCHEDULED, 'hit');
      });
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      run((s) => s.undoLastAtBat(SCHEDULED));
      expect(game(SCHEDULED).ourNextBatter).toBe(len - 1);
    });

    it('only touches the given game and returns undefined when there is nothing to undo', () => {
      const banditsBefore = store().data.atBats.filter((x) => x.gameId === 'g_bandits').length;
      let result: ReturnType<Store['undoLastAtBat']>;
      run((s) => {
        result = s.undoLastAtBat(SCHEDULED);
      });
      expect(result).toBeUndefined();
      expect(store().data.atBats.filter((x) => x.gameId === 'g_bandits')).toHaveLength(banditsBefore);
    });
  });

  describe('updateAtBat', () => {
    /** Owen (hit), Ryder (K); Lucas due. Returns Owen's at-bat. */
    const chartTwo = (): AtBat => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit');
        s.recordAtBat(SCHEDULED, 'k_swinging');
      });
      return store().data.atBats.find((x) => x.gameId === SCHEDULED && x.batterId === 'p_owen')!;
    };
    const find = (id: string) => store().data.atBats.find((x) => x.id === id)!;

    it('re-judges the outcome and derives the result from it', () => {
      const owen = chartTwo();
      let updated: ReturnType<Store['updateAtBat']>;
      run((s) => {
        updated = s.updateAtBat(owen.id, { outcomeId: 'k_looking' });
      });
      expect(updated).toMatchObject({ id: owen.id, outcomeId: 'k_looking', result: 'L', batterId: 'p_owen' });
      expect(find(owen.id)).toEqual(updated);
      run((s) => s.updateAtBat(owen.id, { outcomeId: 'plain_w' }));
      expect(find(owen.id)).toMatchObject({ outcomeId: 'plain_w', result: 'W' });
      run((s) => s.updateAtBat(owen.id, { outcomeId: 'plain_l' }));
      expect(find(owen.id)).toMatchObject({ outcomeId: 'plain_l', result: 'L' });
    });

    it('never moves the pointers or the clock, and never touches the game document at all', () => {
      const owen = chartTwo();
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED);
      });
      const gamesBefore = store().data.games;
      const before = game(SCHEDULED);
      expect(before).toMatchObject({ inning: 2, half: 'top', ourNextBatter: 2, theirNextBatter: 0 });
      run((s) => s.updateAtBat(owen.id, { outcomeId: 'sac_fly', batterId: 'p_cooper', inning: 1, half: 'bottom' }));
      expect(store().data.games).toBe(gamesBefore);
      expect(game(SCHEDULED)).toBe(before);
      expect(find(owen.id)).toMatchObject({ outcomeId: 'sac_fly', result: 'W', batterId: 'p_cooper', inning: 1, half: 'bottom' });
    });

    it('re-assigning the batter keeps the outcome and result', () => {
      const owen = chartTwo();
      run((s) => s.updateAtBat(owen.id, { batterId: 'p_lucas' }));
      expect(find(owen.id)).toMatchObject({ batterId: 'p_lucas', outcomeId: 'hit', result: 'W' });
      expect(hittingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual({ w: 0, l: 0 });
      expect(hittingFor(store().data.atBats, 'p_lucas', SCHEDULED)).toEqual({ w: 1, l: 0 });
    });

    it('sets or clears the pitcher on an opponent at-bat (explicit undefined clears)', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      run((s) => s.recordAtBat(SCHEDULED, 'k_swinging')); // Weedon
      const theirs = store().data.atBats.find((x) => x.gameId === SCHEDULED && x.side === 'them')!;
      run((s) => s.updateAtBat(theirs.id, { pitcherId: 'p_owen' }));
      expect(find(theirs.id).pitcherId).toBe('p_owen');
      expect(pitchingFor(store().data.atBats, 'p_owen', SCHEDULED)).toEqual({ w: 1, l: 0 });
      run((s) => s.updateAtBat(theirs.id, { pitcherId: undefined }));
      expect(find(theirs.id).pitcherId).toBeUndefined();
      // A patch that does not mention the pitcher leaves it alone.
      run((s) => s.updateAtBat(theirs.id, { pitcherId: 'p_lucas' }));
      run((s) => s.updateAtBat(theirs.id, { outcomeId: 'hit' }));
      expect(find(theirs.id)).toMatchObject({ pitcherId: 'p_lucas', outcomeId: 'hit', result: 'W' });
    });

    it('keeps the inning at 1 or more', () => {
      const owen = chartTwo();
      run((s) => s.updateAtBat(owen.id, { inning: 0 }));
      expect(find(owen.id).inning).toBe(1);
      run((s) => s.updateAtBat(owen.id, { inning: 4 }));
      expect(find(owen.id).inning).toBe(4);
    });

    it('works on a final game (post-game re-judging) without changing its status', () => {
      const bandits = store().data.atBats.find((x) => x.gameId === 'g_bandits' && x.side === 'us')!;
      run((s) => s.updateAtBat(bandits.id, { outcomeId: bandits.result === 'W' ? 'k_swinging' : 'hit' }));
      expect(find(bandits.id).result).toBe(bandits.result === 'W' ? 'L' : 'W');
      expect(game('g_bandits').status).toBe('final');
    });

    it('returns undefined and changes nothing for an unknown id', () => {
      const before = store().data;
      let result: ReturnType<Store['updateAtBat']> = undefined;
      run((s) => {
        result = s.updateAtBat('nope', { outcomeId: 'hit' });
      });
      expect(result).toBeUndefined();
      expect(store().data).toBe(before);
    });
  });

  describe('deleteAtBat', () => {
    const ours = () => store().data.atBats.filter((x) => x.gameId === SCHEDULED);

    it('record-then-remove is an undo: the batter is due up again', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
      const owen = ours()[0];
      let removed: ReturnType<Store['deleteAtBat']>;
      run((s) => {
        removed = s.deleteAtBat(owen.id);
      });
      expect(removed).toEqual(owen);
      expect(ours()).toEqual([]);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 0, inning: 1, half: 'top' });
    });

    it('keepPointer: leaves the pointer alone even in the record-then-remove shape (undoing a backfill)', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due
      // A backfill for Owen while Ryder is due looks exactly like record-then-remove to the pointer rule.
      run((s) => s.recordAtBat(SCHEDULED, 'plain_w', { side: 'us', batterId: 'p_owen', inning: 1, half: 'top' }));
      const backfill = ours()[1];
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
      run((s) => s.deleteAtBat(backfill.id, { keepPointer: true }));
      expect(ours()).toHaveLength(1);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, inning: 1, half: 'top' });
    });

    it('does not roll back after a skip made since (the pointer is not right after the slot)', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due
      run((s) => s.setNextBatter(SCHEDULED, 'us', 3)); // skip to Cooper
      run((s) => s.deleteAtBat(ours()[0].id));
      expect(ours()).toEqual([]);
      expect(game(SCHEDULED).ourNextBatter).toBe(3);
    });

    it('does not roll back when the at-bat is not the game’s newest', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit'); // Owen
        s.recordAtBat(SCHEDULED, 'k_swinging'); // Ryder; Lucas due
      });
      const [owen, ryder] = ours();
      run((s) => s.deleteAtBat(owen.id));
      expect(ours().map((x) => x.id)).toEqual([ryder.id]);
      expect(game(SCHEDULED).ourNextBatter).toBe(2);
    });

    it('never changes the clock, even for the newest at-bat of an earlier half', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen, top 1st; Ryder due
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED); // top 2nd, nothing charted since
      });
      run((s) => s.deleteAtBat(ours()[0].id));
      // Still the newest and the pointer still sits right after Owen, so he is due again ...
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      // ... but the clock stays where the coach put it.
      expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top' });
    });

    it('newest is judged on the game clock, so a backfill into an earlier inning does not count', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen top 1st; Ryder due
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED);
        s.recordAtBat(SCHEDULED, 'hit'); // Ryder top 2nd; Lucas due
      });
      let backfill: ReturnType<Store['recordAtBat']>;
      run((s) => {
        backfill = s.recordAtBat(SCHEDULED, 'plain_l', { side: 'us', batterId: 'p_ryder', inning: 1, half: 'top' });
      });
      expect(newestAtBat(ours())!.batterId).toBe('p_ryder');
      expect(newestAtBat(ours())!.inning).toBe(2);
      run((s) => s.deleteAtBat(backfill!.id));
      expect(game(SCHEDULED).ourNextBatter).toBe(2);
      expect(ours()).toHaveLength(2);
    });

    it('wraps: removing the last batter’s at-bat when the pointer is back at the top', () => {
      const len = game(SCHEDULED).lineup.length;
      run((s) => {
        for (let i = 0; i < len; i++) s.recordAtBat(SCHEDULED, 'hit');
      });
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      const last = ours()[len - 1];
      run((s) => s.deleteAtBat(last.id));
      expect(game(SCHEDULED).ourNextBatter).toBe(len - 1);
    });

    it('rolls their pointer back for an opponent at-bat and leaves ours alone', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit'); // Owen; Ryder due
        s.nextHalfInning(SCHEDULED);
        s.recordAtBat(SCHEDULED, 'k_swinging'); // Batter 1; Batter 2 due
      });
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, theirNextBatter: 1 });
      const theirs = ours().find((x) => x.side === 'them')!;
      run((s) => s.deleteAtBat(theirs.id));
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, theirNextBatter: 0, inning: 1, half: 'bottom' });
    });

    it('leaves the pointer alone when the batter has left the order', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due (index 1)
      run((s) => s.setGameLineup(SCHEDULED, game(SCHEDULED).lineup.filter((x) => x.playerId !== 'p_owen')));
      expect(game(SCHEDULED).ourNextBatter).toBe(0); // Ryder, now slot 0
      run((s) => s.deleteAtBat(ours()[0].id));
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      expect(ours()).toEqual([]);
    });

    it('returns undefined and changes nothing for an unknown id', () => {
      const before = store().data;
      let result: ReturnType<Store['deleteAtBat']> = undefined;
      run((s) => {
        result = s.deleteAtBat('nope');
      });
      expect(result).toBeUndefined();
      expect(store().data).toBe(before);
    });
  });

  describe('restoreAtBat', () => {
    const ours = () => store().data.atBats.filter((x) => x.gameId === SCHEDULED);

    it('puts a removed at-bat back where it was on the clock, pointers and clock untouched', () => {
      run((s) => {
        s.recordAtBat(SCHEDULED, 'hit'); // Owen
        s.recordAtBat(SCHEDULED, 'k_swinging'); // Ryder
        s.recordAtBat(SCHEDULED, 'bunt'); // Lucas; Cooper due
      });
      const [owen, ryder] = ours();
      let removed: ReturnType<Store['deleteAtBat']>;
      run((s) => {
        removed = s.deleteAtBat(ryder.id);
      });
      expect(ours().map((x) => x.id)).toEqual([owen.id, ours()[1].id]);
      expect(game(SCHEDULED).ourNextBatter).toBe(3);
      run((s) => s.restoreAtBat(removed!));
      expect(sortAtBats(ours()).map((x) => x.batterId)).toEqual(['p_owen', 'p_ryder', 'p_lucas']);
      expect(ours().find((x) => x.id === ryder.id)).toEqual(ryder);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 3, inning: 1, half: 'top' });
    });

    it('leaves the pointer where the removal put it (the undo layer puts the batter who was due back up)', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due
      const owen = ours()[0];
      run((s) => s.deleteAtBat(owen.id));
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
      run((s) => s.restoreAtBat(owen));
      expect(ours()).toEqual([owen]);
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
    });

    it('is a no-op when the id already exists', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      const owen = ours()[0];
      const before = store().data;
      run((s) => s.restoreAtBat({ ...owen, outcomeId: 'k_swinging', result: 'L' }));
      expect(store().data).toBe(before);
      expect(ours()).toEqual([owen]);
    });

    it('is a no-op when the game no longer exists', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      const owen = ours()[0];
      run((s) => s.deleteGame(SCHEDULED));
      const before = store().data;
      run((s) => s.restoreAtBat(owen));
      expect(store().data).toBe(before);
    });
  });

  describe('applyUndo against the live document', () => {
    const ours = () => store().data.atBats.filter((x) => x.gameId === SCHEDULED);
    const ids = () => ours().map((x) => x.id);

    afterEach(() => clearAllUndo());

    it('undoing an at-bat charted while reviewing an earlier half puts that batter back up', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen, top 1st; Ryder due
      run((s) => s.nextHalfInning(SCHEDULED)); // bottom 1st: they bat
      run((s) => s.recordAtBat(SCHEDULED, 'k_swinging')); // Batter 1; Batter 2 due
      run((s) => s.prevHalfInning(SCHEDULED)); // back to the top 1st for a missed at-bat
      let ryder: AtBat | undefined;
      run((s) => {
        ryder = s.recordAtBat(SCHEDULED, 'plain_w');
      });
      expect(ryder).toMatchObject({ batterId: 'p_ryder', inning: 1, half: 'top' });
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 2, theirNextBatter: 1 });
      // Not the newest on the clock, so deleteAtBat's own rule would leave Lucas up.
      expect(newestAtBat(ours())!.id).not.toBe(ryder!.id);
      run((s) => applyUndo({ kind: 'record', atBat: ryder! }, game(SCHEDULED), s));
      expect(ids()).not.toContain(ryder!.id);
      expect(ours()).toHaveLength(2);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, theirNextBatter: 1, inning: 1, half: 'top' });
    });

    it('undoing a live at-bat after a re-judge moved an earlier one to a later inning puts that batter back up', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen top 1st; Ryder due
      const owen = ours()[0];
      run((s) => s.updateAtBat(owen.id, { inning: 2 })); // charted in the wrong inning
      let ryder: AtBat | undefined;
      run((s) => {
        ryder = s.recordAtBat(SCHEDULED, 'hit'); // Ryder top 1st; Lucas due
      });
      expect(game(SCHEDULED).ourNextBatter).toBe(2);
      run((s) => applyUndo({ kind: 'record', atBat: ryder! }, game(SCHEDULED), s));
      expect(ids()).toEqual([owen.id]);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, inning: 1, half: 'top' });
    });

    it('undoing a backfill deletes it and leaves the pointer alone', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due
      let backfill: AtBat | undefined;
      run((s) => {
        backfill = s.recordAtBat(SCHEDULED, 'plain_l', { side: 'us', batterId: 'p_owen', inning: 1, half: 'top' });
      });
      run((s) => applyUndo({ kind: 'record', atBat: backfill!, backfill: true }, game(SCHEDULED), s));
      expect(ours()).toHaveLength(1);
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
    });

    it('undoing a remove restores the at-bat and the batter who was due before the remove', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen; Ryder due
      const owen = ours()[0];
      const g = game(SCHEDULED);
      const dueBatterId = g.lineup[g.ourNextBatter % g.lineup.length].playerId; // what the editor captures
      expect(dueBatterId).toBe('p_ryder');
      let removed: AtBat | undefined;
      run((s) => {
        removed = s.deleteAtBat(owen.id);
      });
      expect(game(SCHEDULED).ourNextBatter).toBe(0); // record-then-remove rolled it back
      run((s) => applyUndo({ kind: 'remove', atBat: removed!, dueBatterId }, game(SCHEDULED), s));
      expect(ours()).toEqual([owen]);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 1, inning: 1, half: 'top' });
    });

    it('undoing a remove in the pitching half restores their pointer', () => {
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.recordAtBat(SCHEDULED, 'k_swinging'); // Batter 1; Batter 2 due
      });
      const theirs = ours()[0];
      const g = game(SCHEDULED);
      const dueBatterId = g.opponentLineup[g.theirNextBatter].id;
      let removed: AtBat | undefined;
      run((s) => {
        removed = s.deleteAtBat(theirs.id);
      });
      expect(game(SCHEDULED).theirNextBatter).toBe(0);
      run((s) => applyUndo({ kind: 'remove', atBat: removed!, dueBatterId }, game(SCHEDULED), s));
      expect(ours()).toEqual([theirs]);
      expect(game(SCHEDULED)).toMatchObject({ ourNextBatter: 0, theirNextBatter: 1, inning: 1, half: 'bottom' });
    });

    it('deleteGame empties that game’s undo stack and no other', () => {
      pushUndo(SCHEDULED, { kind: 'half', direction: 'next' });
      pushUndo('g_bandits', { kind: 'half', direction: 'next' });
      run((s) => s.deleteGame('g_bandits'));
      expect(peekUndo('g_bandits')).toBeUndefined();
      expect(peekUndo(SCHEDULED)).toBeDefined();
    });

    it('resetDemoData and clearAllData empty every undo stack, so a stale remove cannot resurrect an at-bat', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      const owen = ours()[0];
      let removed: AtBat | undefined;
      run((s) => {
        removed = s.deleteAtBat(owen.id);
      });
      pushUndo(SCHEDULED, { kind: 'remove', atBat: removed! });
      run((s) => s.resetDemoData());
      expect(store().data.games.some((x) => x.id === SCHEDULED)).toBe(true);
      expect(popUndo(SCHEDULED)).toBeUndefined();
      expect(ours()).toEqual([]);

      pushUndo(SCHEDULED, { kind: 'skip', side: 'us', fromBatterId: 'p_owen', toBatterId: 'p_lucas' });
      run((s) => s.clearAllData());
      expect(peekUndo(SCHEDULED)).toBeUndefined();
    });
  });

  describe('nextHalfInning / prevHalfInning', () => {
    it('top -> bottom of the same inning, bottom -> top of the next', () => {
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'top' });
      run((s) => s.nextHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'bottom' });
      run((s) => s.nextHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top' });
    });

    it('nextHalfInning starts a scheduled game', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      expect(game(SCHEDULED).status).toBe('in_progress');
      expect(game('g_bandits').status).toBe('final');
    });

    it('prevHalfInning walks back and never goes before the top of the 1st', () => {
      run((s) => {
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED);
        s.nextHalfInning(SCHEDULED);
      });
      expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'bottom' });
      run((s) => s.prevHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 2, half: 'top' });
      run((s) => s.prevHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'bottom' });
      run((s) => s.prevHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'top' });
      run((s) => s.prevHalfInning(SCHEDULED));
      expect(game(SCHEDULED)).toMatchObject({ inning: 1, half: 'top' });
    });

    it('prevHalfInning does not change the status', () => {
      run((s) => s.prevHalfInning(SCHEDULED));
      expect(game(SCHEDULED).status).toBe('scheduled');
    });
  });

  describe('addGame', () => {
    it('copies the default lineup and picks the P as the pitcher', () => {
      const team = store().data.teams.find((t) => t.id === 't_bears12u')!;
      let created: Game | undefined;
      run((s) => {
        created = s.addGame('t_bears12u', {
          opponent: '  Rockhounds ',
          isAway: false,
          startsAt: '2026-09-20T17:00:00.000Z',
          notes: '  Home opener  ',
        });
      });
      const g = game(created!.id);
      expect(g).toEqual(created);
      expect(g.lineup).toEqual(team.defaultLineup);
      expect(g.lineup).not.toBe(team.defaultLineup);
      expect(g.pitcherId).toBe('p_weedon');
      expect(g).toMatchObject({
        teamId: 't_bears12u',
        opponent: 'Rockhounds',
        isAway: false,
        startsAt: '2026-09-20T17:00:00.000Z',
        status: 'scheduled',
        inning: 1,
        half: 'top',
        ourNextBatter: 0,
        theirNextBatter: 0,
        score: { us: 0, them: 0 },
        notes: 'Home opener',
      });
      expect(g.opponentLineup.map((b) => b.name)).toEqual(Array.from({ length: 9 }, (_, i) => `Batter ${i + 1}`));
      expect(new Set(g.opponentLineup.map((b) => b.id)).size).toBe(9);
      expect(g.finishedAt).toBeUndefined();
      expect(store().data.games).toHaveLength(8);
    });

    it('is a snapshot: changing the default lineup later does not touch the game', () => {
      let created: Game | undefined;
      run((s) => {
        created = s.addGame('t_bears12u', { opponent: 'X', isAway: true, startsAt: NOW.toISOString() });
      });
      run((s) => s.setDefaultLineup('t_bears12u', [{ playerId: 'p_ben', position: 'P' }]));
      expect(game(created!.id).lineup).toHaveLength(10);
      expect(game(created!.id).pitcherId).toBe('p_weedon');
    });

    it('with no P in the lineup leaves the pitcher unset; blank notes become undefined', () => {
      run((s) =>
        s.setDefaultLineup('t_bears12u', [
          { playerId: 'p_owen', position: 'CF' },
          { playerId: 'p_ryder' },
        ]),
      );
      let created: Game | undefined;
      run((s) => {
        created = s.addGame('t_bears12u', { opponent: 'X', isAway: true, startsAt: NOW.toISOString(), notes: '   ' });
      });
      expect(created!.pitcherId).toBeUndefined();
      expect(created!.notes).toBeUndefined();
      expect(created!.lineup.map((x) => x.playerId)).toEqual(['p_owen', 'p_ryder']);
    });
  });

  describe('removePlayer', () => {
    it('drops the player from the roster, the default lineup and scheduled game lineups', () => {
      run((s) => s.removePlayer('p_knox'));
      expect(store().data.players.some((p) => p.id === 'p_knox')).toBe(false);
      const team = store().data.teams.find((t) => t.id === 't_bears12u')!;
      expect(team.defaultLineup.some((x) => x.playerId === 'p_knox')).toBe(false);
      expect(team.defaultLineup).toHaveLength(9);
      expect(game(SCHEDULED).lineup.some((x) => x.playerId === 'p_knox')).toBe(false);
      expect(game(SCHEDULED).lineup).toHaveLength(9);
    });

    it('keeps final game lineups and every historical at-bat', () => {
      const before = store().data.atBats.length;
      const knoxAtBats = store().data.atBats.filter((x) => x.batterId === 'p_knox').length;
      expect(knoxAtBats).toBeGreaterThan(0);
      run((s) => s.removePlayer('p_knox'));
      expect(store().data.atBats).toHaveLength(before);
      expect(store().data.atBats.filter((x) => x.batterId === 'p_knox')).toHaveLength(knoxAtBats);
      expect(game('g_bandits').lineup.some((x) => x.playerId === 'p_knox')).toBe(true);
      expect(game('g_redbirds').lineup.some((x) => x.playerId === 'p_knox')).toBe(true);
    });

    it('clears the pitcher on scheduled games when the pitcher is removed, but not on final games', () => {
      expect(game(SCHEDULED).pitcherId).toBe('p_weedon');
      expect(game('g_fury').pitcherId).toBe('p_weedon');
      run((s) => s.removePlayer('p_weedon'));
      expect(game(SCHEDULED).pitcherId).toBeUndefined();
      expect(game('g_fury').pitcherId).toBe('p_weedon');
    });

    it('clears the pitcher on an in-progress game too, so later at-bats are not credited to a ghost', () => {
      run((s) => s.nextHalfInning(SCHEDULED)); // Tigers batting, Weedon pitching
      run((s) => s.removePlayer('p_weedon'));
      expect(game(SCHEDULED).status).toBe('in_progress');
      expect(game(SCHEDULED).pitcherId).toBeUndefined();
      let recorded: ReturnType<Store['recordAtBat']>;
      run((s) => {
        recorded = s.recordAtBat(SCHEDULED, 'k_swinging');
      });
      expect(recorded!.side).toBe('them');
      expect(recorded!.pitcherId).toBeUndefined();
      expect(game('g_fury').pitcherId).toBe('p_weedon');
    });

    it('does not prune an in-progress game’s lineup', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      run((s) => s.removePlayer('p_knox'));
      expect(game(SCHEDULED).lineup.some((x) => x.playerId === 'p_knox')).toBe(true);
    });

    describe('keeps the right batter due when a scheduled game’s order is pruned', () => {
      /** Every action that moves the due batter also starts the game, so seed the index directly. */
      const mountScheduledWithDue = (index: number) => {
        unmount();
        const data = buildDemoData(NOW);
        data.games = data.games.map((g) => (g.id === SCHEDULED ? { ...g, ourNextBatter: index } : g));
        mount(data);
      };

      it('the same batter stays due when someone ahead of them is removed', () => {
        mountScheduledWithDue(5); // Matthew
        run((s) => s.removePlayer('p_owen'));
        const g = game(SCHEDULED);
        expect(g.status).toBe('scheduled');
        expect(g.ourNextBatter).toBe(4);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_matthew');
      });

      it('the index stays in range when the last batter in the order is due and gets removed', () => {
        mountScheduledWithDue(9); // Ben, last slot
        run((s) => s.removePlayer('p_ben'));
        const g = game(SCHEDULED);
        expect(g.lineup).toHaveLength(9);
        expect(g.ourNextBatter).toBeLessThan(g.lineup.length);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_owen'); // wraps to the top
      });

      it('the next batter in the old order is due when the due batter is removed', () => {
        mountScheduledWithDue(1); // Ryder
        run((s) => s.removePlayer('p_ryder'));
        const g = game(SCHEDULED);
        expect(g.ourNextBatter).toBe(1);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_lucas');
      });
    });

    it('keeps the due batter of an in-progress game (order untouched)', () => {
      run((s) => s.setNextBatter(SCHEDULED, 'us', 5)); // Matthew; game now in progress
      run((s) => s.removePlayer('p_owen'));
      const g = game(SCHEDULED);
      expect(g.lineup).toHaveLength(10);
      expect(g.ourNextBatter).toBe(5);
      expect(g.lineup[g.ourNextBatter].playerId).toBe('p_matthew');
    });
  });

  describe('resetDemoData / clearAllData', () => {
    it('resetDemoData restores the demo document but keeps onboarded', () => {
      run((s) => {
        s.setOnboarded(true);
        s.deleteGame('g_bandits');
        s.removePlayer('p_knox');
      });
      expect(store().data.games).toHaveLength(6);
      expect(store().data.players).toHaveLength(9);
      run((s) => s.resetDemoData());
      expect(store().data.onboarded).toBe(true);
      expect(store().data.games).toHaveLength(7);
      expect(store().data.players).toHaveLength(10);
      expect(store().data.teams).toHaveLength(3);
      expect(store().data.games.some((g) => g.id === 'g_bandits')).toBe(true);
    });

    it('clearAllData empties everything but keeps onboarded', () => {
      run((s) => s.setOnboarded(true));
      run((s) => s.clearAllData());
      expect(store().data).toEqual({ version: 1, onboarded: true, teams: [], players: [], games: [], atBats: [] });
    });

    it('setOnboarded flips the flag both ways', () => {
      run((s) => s.setOnboarded(true));
      expect(store().data.onboarded).toBe(true);
      run((s) => s.setOnboarded(false));
      expect(store().data.onboarded).toBe(false);
    });
  });

  describe('teams and players', () => {
    it('addTeam trims the name and defaults the season to the current year', () => {
      let team: ReturnType<Store['addTeam']> | undefined;
      run((s) => {
        team = s.addTeam('  New Team ');
      });
      expect(team!.name).toBe('New Team');
      expect(team!.season).toBe(String(new Date().getFullYear()));
      expect(team!.defaultLineup).toEqual([]);
      expect(store().data.teams.some((t) => t.id === team!.id)).toBe(true);
    });

    it('updateTeam patches name and season', () => {
      run((s) => s.updateTeam('t_bears13u', { name: 'Renamed', season: '2027' }));
      expect(store().data.teams.find((t) => t.id === 't_bears13u')).toMatchObject({ name: 'Renamed', season: '2027' });
    });

    it('deleteTeam cascades to players, games and at-bats', () => {
      run((s) => s.deleteTeam('t_bears12u'));
      expect(store().data.teams.map((t) => t.id)).toEqual(['t_bears13u', 't_bears15u']);
      expect(store().data.players).toEqual([]);
      expect(store().data.games).toEqual([]);
      expect(store().data.atBats).toEqual([]);
    });

    it('addPlayer trims, normalises a blank number and appends to the default lineup', () => {
      let p: ReturnType<Store['addPlayer']> | undefined;
      run((s) => {
        p = s.addPlayer('t_bears12u', { firstName: ' Sam ', lastName: ' Jones ', number: '  ' });
      });
      expect(p).toMatchObject({ teamId: 't_bears12u', firstName: 'Sam', lastName: 'Jones' });
      expect(p!.number).toBeUndefined();
      const team = store().data.teams.find((t) => t.id === 't_bears12u')!;
      expect(team.defaultLineup[team.defaultLineup.length - 1]).toEqual({ playerId: p!.id });
      expect(store().data.players).toHaveLength(11);
    });

    it('updatePlayer trims fields and clears a blanked number', () => {
      run((s) => s.updatePlayer('p_owen', { firstName: ' Owen ', number: '' }));
      expect(store().data.players.find((p) => p.id === 'p_owen')).toMatchObject({ firstName: 'Owen', lastName: 'Haynes' });
      expect(store().data.players.find((p) => p.id === 'p_owen')!.number).toBeUndefined();
      run((s) => s.updatePlayer('p_owen', { number: ' 77 ' }));
      expect(store().data.players.find((p) => p.id === 'p_owen')!.number).toBe('77');
    });
  });

  describe('game editing', () => {
    it('updateGame patches fields and deleteGame drops the game with its at-bats', () => {
      run((s) => s.updateGame('g_bandits', { opponent: 'Bandits', notes: 'edited' }));
      expect(game('g_bandits')).toMatchObject({ opponent: 'Bandits', notes: 'edited', teamId: 't_bears12u' });
      expect(store().data.atBats.some((x) => x.gameId === 'g_bandits')).toBe(true);
      run((s) => s.deleteGame('g_bandits'));
      expect(store().data.games.some((g) => g.id === 'g_bandits')).toBe(false);
      expect(store().data.atBats.some((x) => x.gameId === 'g_bandits')).toBe(false);
      expect(store().data.atBats.some((x) => x.gameId === 'g_redbirds')).toBe(true);
    });

    it('updateGame only accepts the game details, never the order, status or progress', () => {
      type Patch = Parameters<Store['updateGame']>[1];
      const details: Patch = { opponent: 'X', isAway: false, startsAt: NOW.toISOString(), notes: 'n' };
      // @ts-expect-error status is owned by finishGame/reopenGame/recordAtBat
      const status: Patch = { status: 'final' };
      // @ts-expect-error the batting order goes through setGameLineup so the due batter is kept
      const lineup: Patch = { lineup: [] };
      // @ts-expect-error progress goes through setNextBatter
      const progress: Patch = { ourNextBatter: 3 };
      expect([details, status, lineup, progress]).toHaveLength(4);
    });

    describe('setGameLineup keeps the same batter due', () => {
      it('after a reorder', () => {
        run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Owen batted; Ryder due
        const order = game(SCHEDULED).lineup;
        const [owen, ryder, lucas, ...rest] = order;
        run((s) => s.setGameLineup(SCHEDULED, [lucas, ryder, owen, ...rest]));
        const g = game(SCHEDULED);
        expect(g.ourNextBatter).toBe(1);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_ryder');
      });

      it('after removing someone ahead of them', () => {
        run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Ryder due
        run((s) => s.setGameLineup(SCHEDULED, game(SCHEDULED).lineup.filter((x) => x.playerId !== 'p_owen')));
        const g = game(SCHEDULED);
        expect(g.ourNextBatter).toBe(0);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_ryder');
      });

      it('and moves to the next surviving batter (in the old order) when the due batter is removed', () => {
        run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Ryder due
        run((s) => s.setGameLineup(SCHEDULED, game(SCHEDULED).lineup.filter((x) => x.playerId !== 'p_ryder')));
        const g = game(SCHEDULED);
        expect(g.ourNextBatter).toBe(1);
        expect(g.lineup[g.ourNextBatter].playerId).toBe('p_lucas');
      });

      it('and stays in range when the order shrinks or empties', () => {
        run((s) => s.setNextBatter(SCHEDULED, 'us', 8)); // Landyn due
        run((s) => s.setGameLineup(SCHEDULED, [{ playerId: 'p_owen' }, { playerId: 'p_ben' }]));
        expect(game(SCHEDULED).ourNextBatter).toBe(1); // Landyn gone -> Ben, who is now slot 2
        run((s) => s.setGameLineup(SCHEDULED, [{ playerId: 'p_lucas' }]));
        expect(game(SCHEDULED).ourNextBatter).toBe(0); // nobody carried over -> top of the order
        run((s) => s.setGameLineup(SCHEDULED, []));
        expect(game(SCHEDULED).ourNextBatter).toBe(0);
      });
    });

    describe('setOpponentLineup keeps the same batter due', () => {
      it('after removing the batter who just hit', () => {
        run((s) => s.nextHalfInning(SCHEDULED));
        run((s) => s.recordAtBat(SCHEDULED, 'hit')); // Batter 1 hit; Batter 2 due
        const [b1, ...rest] = game(SCHEDULED).opponentLineup;
        run((s) => s.setOpponentLineup(SCHEDULED, rest));
        const g = game(SCHEDULED);
        expect(g.theirNextBatter).toBe(0);
        expect(g.opponentLineup[0].name).toBe('Batter 2');
        expect(g.opponentLineup.some((b) => b.id === b1.id)).toBe(false);
      });

      it('after a reorder', () => {
        run((s) => s.setNextBatter(SCHEDULED, 'them', 2)); // Batter 3 due
        const order = game(SCHEDULED).opponentLineup;
        run((s) => s.setOpponentLineup(SCHEDULED, [...order].reverse()));
        const g = game(SCHEDULED);
        expect(g.theirNextBatter).toBe(6);
        expect(g.opponentLineup[g.theirNextBatter].name).toBe('Batter 3');
      });

      it('and starts at the top when nobody from the old order remains', () => {
        run((s) => s.setNextBatter(SCHEDULED, 'them', 5));
        run((s) => s.setOpponentLineup(SCHEDULED, [{ id: 'x1', name: 'A' }, { id: 'x2', name: 'B' }]));
        expect(game(SCHEDULED).theirNextBatter).toBe(0);
        expect(game(SCHEDULED).opponentLineup.map((b) => b.id)).toEqual(['x1', 'x2']);
      });
    });

    it('setScore never stores a negative run total', () => {
      run((s) => s.setScore(SCHEDULED, { us: -1, them: 3 }));
      expect(game(SCHEDULED).score).toEqual({ us: 0, them: 3 });
    });

    it('setScore starts a scheduled game once a run is on the board, but 0-0 leaves it scheduled', () => {
      run((s) => s.setScore(SCHEDULED, { us: 0, them: 0 }));
      expect(game(SCHEDULED).status).toBe('scheduled');
      run((s) => s.setScore(SCHEDULED, { us: 0, them: 1 }));
      expect(game(SCHEDULED).status).toBe('in_progress');
      run((s) => s.setScore('g_bandits', { us: 20, them: 5 }));
      expect(game('g_bandits').status).toBe('final');
    });

    it('setNextBatter starts a scheduled game and never touches a final one', () => {
      run((s) => s.setNextBatter(SCHEDULED, 'us', 3));
      expect(game(SCHEDULED)).toMatchObject({ status: 'in_progress', ourNextBatter: 3 });
      run((s) => s.setNextBatter('g_bandits', 'them', 2));
      expect(game('g_bandits')).toMatchObject({ status: 'final', theirNextBatter: 2 });
    });

    it('finishGame marks the game final with score, notes and finishedAt; reopenGame reverts', () => {
      run((s) => s.finishGame(SCHEDULED, { score: { us: 5, them: 4 }, notes: '  Walk-off  ' }));
      const g = game(SCHEDULED);
      expect(g.status).toBe('final');
      expect(g.score).toEqual({ us: 5, them: 4 });
      expect(g.notes).toBe('Walk-off');
      expect(g.finishedAt).toBeDefined();
      run((s) => s.reopenGame(SCHEDULED));
      expect(game(SCHEDULED).status).toBe('in_progress');
      expect(game(SCHEDULED).finishedAt).toBeUndefined();
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      storage.setItem.mockClear();
    });

    it('persists the document to storage shortly after a change', () => {
      run((s) => s.setOnboarded(true));
      expect(storage.setItem).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      const [key, raw] = storage.setItem.mock.calls[0];
      expect(key).toBe(STORAGE_KEY);
      expect((JSON.parse(raw) as AppData).onboarded).toBe(true);
    });

    it('coalesces a burst of edits into one write', () => {
      run((s) => {
        s.updatePlayer('p_owen', { firstName: 'O' });
        s.updatePlayer('p_owen', { firstName: 'Ow' });
      });
      run((s) => s.updatePlayer('p_owen', { firstName: 'Owe' }));
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(lastWritten()!.players.find((p) => p.id === 'p_owen')!.firstName).toBe('Owe');
    });

    it('writes an at-bat, an undo and a finished game immediately, without waiting for the debounce', () => {
      run((s) => s.recordAtBat(SCHEDULED, 'hit'));
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(lastWritten()!.atBats.some((x) => x.gameId === SCHEDULED && x.batterId === 'p_owen')).toBe(true);

      run((s) => s.undoLastAtBat(SCHEDULED));
      expect(storage.setItem).toHaveBeenCalledTimes(2);
      expect(lastWritten()!.atBats.some((x) => x.gameId === SCHEDULED)).toBe(false);

      run((s) => s.finishGame(SCHEDULED, { score: { us: 1, them: 0 } }));
      expect(storage.setItem).toHaveBeenCalledTimes(3);
      expect(lastWritten()!.games.find((g) => g.id === SCHEDULED)!.status).toBe('final');

      // Nothing is left pending afterwards.
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(3);
    });

    it('writes a backfill, a re-judge, a removal and a restore immediately too', () => {
      let backfill: ReturnType<Store['recordAtBat']>;
      run((s) => {
        backfill = s.recordAtBat(SCHEDULED, 'plain_w', { side: 'us', batterId: 'p_owen', inning: 1, half: 'top' });
      });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(lastWritten()!.atBats.find((x) => x.id === backfill!.id)).toMatchObject({ outcomeId: 'plain_w' });

      run((s) => s.updateAtBat(backfill!.id, { outcomeId: 'sac_fly' }));
      expect(storage.setItem).toHaveBeenCalledTimes(2);
      expect(lastWritten()!.atBats.find((x) => x.id === backfill!.id)).toMatchObject({ outcomeId: 'sac_fly', result: 'W' });

      let removed: ReturnType<Store['deleteAtBat']>;
      run((s) => {
        removed = s.deleteAtBat(backfill!.id);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(3);
      expect(lastWritten()!.atBats.some((x) => x.id === backfill!.id)).toBe(false);

      run((s) => s.restoreAtBat(removed!));
      expect(storage.setItem).toHaveBeenCalledTimes(4);
      expect(lastWritten()!.atBats.find((x) => x.id === backfill!.id)).toMatchObject({ outcomeId: 'sac_fly' });

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(4);
    });

    it('flushes a pending write when the provider unmounts before the debounce fires', () => {
      run((s) => s.updateTeam('t_bears13u', { name: 'Flushed' }));
      expect(storage.setItem).not.toHaveBeenCalled();
      unmount();
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(lastWritten()!.teams.find((t) => t.id === 't_bears13u')!.name).toBe('Flushed');
    });

    it('flushes a pending write when the app goes to the background', () => {
      const handler = appState.addEventListener.mock.calls[appState.addEventListener.mock.calls.length - 1][1];
      run((s) => s.updateTeam('t_bears13u', { name: 'Backgrounded' }));
      expect(storage.setItem).not.toHaveBeenCalled();
      act(() => handler('background'));
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(lastWritten()!.teams.find((t) => t.id === 't_bears13u')!.name).toBe('Backgrounded');
      // A flush with nothing pending writes nothing.
      act(() => handler('background'));
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    });
  });
});

describe('StoreProvider loading', () => {
  const demo = buildDemoData(NOW);
  let warn: ReturnType<typeof jest.spyOn> | undefined;

  beforeEach(() => {
    latest = undefined;
    storage.__INTERNAL_MOCK_STORAGE__ = {};
    storage.setItem.mockClear();
    storage.getItem.mockClear();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    unmount();
    await settle();
    warn?.mockRestore();
  });

  it('is not ready until the saved document has been read, then loads it as-is', async () => {
    const saved: AppData = { ...demo, onboarded: true };
    storage.__INTERNAL_MOCK_STORAGE__[STORAGE_KEY] = JSON.stringify(saved);
    mount();
    expect(store().ready).toBe(false);
    await settle();
    expect(store().ready).toBe(true);
    expect(store().loadIssue).toBeUndefined();
    expect(store().data).toEqual(saved);
    // Nothing changed, so nothing is written back.
    await settle();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBeUndefined();
  });

  it('seeds and persists the demo data on a first launch', async () => {
    mount();
    await settle();
    expect(store().ready).toBe(true);
    expect(store().loadIssue).toBeUndefined();
    expect(store().data.games).toHaveLength(7);
    await waitForSave();
    expect(lastWritten()!.games).toHaveLength(7);
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('backs up a corrupt document under BACKUP_KEY before seeding, and reports it', async () => {
    const raw = '{"version":1,"teams":[';
    storage.__INTERNAL_MOCK_STORAGE__[STORAGE_KEY] = raw;
    mount();
    await settle();
    expect(store().ready).toBe(true);
    expect(store().loadIssue).toBe('backed_up');
    expect(store().data.games).toHaveLength(7);
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBe(raw);
    expect(warn).toHaveBeenCalled();
    // The backup lands before anything is written over the original key.
    const keys = storage.setItem.mock.calls.map(([key]) => key);
    expect(keys[0]).toBe(BACKUP_KEY);
    await waitForSave();
    expect(lastWritten()!.version).toBe(1);
    expect(keys.indexOf(BACKUP_KEY)).toBeLessThan(storage.setItem.mock.calls.findIndex(([key]) => key === STORAGE_KEY));
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBe(raw);
  });

  it('backs up a document from another schema version instead of overwriting it', async () => {
    const raw = JSON.stringify({ ...demo, version: 2 });
    storage.__INTERNAL_MOCK_STORAGE__[STORAGE_KEY] = raw;
    mount();
    await settle();
    expect(store().loadIssue).toBe('backed_up');
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBe(raw);
    expect(store().data.version).toBe(1);
  });

  it('treats a version-1 document with a broken shape as unreadable', async () => {
    const raw = JSON.stringify({ version: 1, onboarded: true });
    storage.__INTERNAL_MOCK_STORAGE__[STORAGE_KEY] = raw;
    mount();
    await settle();
    expect(store().loadIssue).toBe('backed_up');
    expect(storage.__INTERNAL_MOCK_STORAGE__[BACKUP_KEY]).toBe(raw);
    expect(Array.isArray(store().data.teams)).toBe(true);
  });
});
