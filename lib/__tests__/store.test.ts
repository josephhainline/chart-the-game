import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import { buildDemoData } from '../seed';
import { StoreProvider, battingSide, useStore } from '../store';
import type { Store } from '../store';
import type { AppData, Game } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-test-renderer ships no type declarations in this project, so type just what we use.
type Renderer = { unmount(): void };
type TestRenderer = {
  create(element: React.ReactElement): Renderer;
  act(callback: () => void): void;
};
const { create, act } = require('react-test-renderer') as TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date('2026-09-14T12:00:00');
const SCHEDULED = 'g_tigers_2';

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

describe('StoreProvider actions', () => {
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

  function mount(initialData: AppData) {
    act(() => {
      renderer = create(React.createElement(StoreProvider, { initialData, children: React.createElement(Probe) }));
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    latest = undefined;
    mount(buildDemoData(NOW));
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    jest.useRealTimers();
  });

  it('is ready immediately with the given initial data (no storage read)', () => {
    expect(store().ready).toBe(true);
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

    it('does not prune an in-progress game’s lineup', () => {
      run((s) => s.nextHalfInning(SCHEDULED));
      run((s) => s.removePlayer('p_knox'));
      expect(game(SCHEDULED).lineup.some((x) => x.playerId === 'p_knox')).toBe(true);
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

    it('setGameLineup clamps our next batter to the new order', () => {
      run((s) => s.setNextBatter(SCHEDULED, 'us', 8));
      run((s) => s.setGameLineup(SCHEDULED, [{ playerId: 'p_owen' }, { playerId: 'p_ben' }]));
      expect(game(SCHEDULED).ourNextBatter).toBe(1);
      run((s) => s.setGameLineup(SCHEDULED, []));
      expect(game(SCHEDULED).ourNextBatter).toBe(0);
    });

    it('setOpponentLineup clamps their next batter to the new order', () => {
      run((s) => s.setNextBatter(SCHEDULED, 'them', 5));
      run((s) => s.setOpponentLineup(SCHEDULED, [{ id: 'x1', name: 'A' }, { id: 'x2', name: 'B' }]));
      expect(game(SCHEDULED).theirNextBatter).toBe(1);
      expect(game(SCHEDULED).opponentLineup.map((b) => b.id)).toEqual(['x1', 'x2']);
    });

    it('setScore never stores a negative run total', () => {
      run((s) => s.setScore(SCHEDULED, { us: -1, them: 3 }));
      expect(game(SCHEDULED).score).toEqual({ us: 0, them: 3 });
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

  it('persists the document to storage shortly after a change', () => {
    const storage = require('@react-native-async-storage/async-storage') as {
      setItem: jest.Mock;
    };
    storage.setItem.mockClear();
    run((s) => s.setOnboarded(true));
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const [key, raw] = storage.setItem.mock.calls[0] as [string, string];
    expect(key).toBe('ctg:data:v1');
    expect((JSON.parse(raw) as AppData).onboarded).toBe(true);
  });
});
