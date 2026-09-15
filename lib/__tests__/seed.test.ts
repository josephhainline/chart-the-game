import { describe, expect, it } from '@jest/globals';
import { differenceInCalendarDays } from 'date-fns';

import { getOutcome, isPlain } from '../outcomes';
import { DEMO_TEAM_ID, PLAIN_EVERY, buildDemoData } from '../seed';
import type { Game, Half, Side } from '../types';

const NOW = new Date('2026-09-14T12:00:00');
const data = buildDemoData(NOW);
const demoTeam = data.teams.find((t) => t.id === DEMO_TEAM_ID)!;
const gameById = new Map(data.games.map((g) => [g.id, g]));
const finalGames = data.games.filter((g) => g.status === 'final');
const scheduledGames = data.games.filter((g) => g.status === 'scheduled');
const playerIds = new Set(data.players.map((p) => p.id));

const whoBats = (g: Pick<Game, 'isAway'>, half: Half): Side => ((g.isAway ? half === 'top' : half === 'bottom') ? 'us' : 'them');

describe('buildDemoData: determinism', () => {
  it('produces an identical document on every call for the same date', () => {
    expect(buildDemoData(NOW)).toEqual(data);
    expect(JSON.stringify(buildDemoData(NOW))).toBe(JSON.stringify(data));
  });

  it('keeps the same ids and at-bat sequence when built for a different date', () => {
    const other = buildDemoData(new Date('2027-03-01T08:00:00'));
    expect(other.games.map((g) => g.id)).toEqual(data.games.map((g) => g.id));
    expect(other.atBats.map((x) => [x.id, x.batterId, x.result, x.outcomeId])).toEqual(
      data.atBats.map((x) => [x.id, x.batterId, x.result, x.outcomeId]),
    );
    expect(other.teams[0].season).toBe('2027');
  });

  it('starts un-onboarded with schema version 1', () => {
    expect(data.version).toBe(1);
    expect(data.onboarded).toBe(false);
  });
});

describe('buildDemoData: teams', () => {
  it('has the three prototype teams, season taken from the given date', () => {
    expect(data.teams.map((t) => t.name)).toEqual([
      'STL Bears 12U Floyd 2026',
      'STL Bears 13U Bernstein',
      'STL Bears 15U Floyd 2026',
    ]);
    expect(data.teams.every((t) => t.season === '2026')).toBe(true);
    expect(new Set(data.teams.map((t) => t.id)).size).toBe(3);
  });

  it('only the demo team has a roster and default lineup', () => {
    expect(demoTeam.defaultLineup).toHaveLength(10);
    for (const t of data.teams.filter((x) => x.id !== DEMO_TEAM_ID)) {
      expect(t.defaultLineup).toEqual([]);
      expect(data.players.filter((p) => p.teamId === t.id)).toEqual([]);
    }
  });

  it('default lineup matches the spec order and positions', () => {
    expect(demoTeam.defaultLineup).toEqual([
      { playerId: 'p_owen', position: 'CF' },
      { playerId: 'p_ryder', position: '3B' },
      { playerId: 'p_lucas', position: 'SS' },
      { playerId: 'p_cooper', position: '1B' },
      { playerId: 'p_carsyn', position: 'C' },
      { playerId: 'p_matthew', position: 'EH' },
      { playerId: 'p_knox', position: '2B' },
      { playerId: 'p_weedon', position: 'P' },
      { playerId: 'p_landyn', position: 'RF' },
      { playerId: 'p_ben', position: 'LF' },
    ]);
  });
});

describe('buildDemoData: players', () => {
  it('has the ten roster players with the spec jersey numbers', () => {
    expect(data.players).toHaveLength(10);
    expect(data.players.every((p) => p.teamId === DEMO_TEAM_ID)).toBe(true);
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));
    expect(byId.p_owen).toMatchObject({ firstName: 'Owen', lastName: 'Haynes', number: '7' });
    expect(byId.p_ryder).toMatchObject({ firstName: 'Ryder', lastName: 'Braddy', number: '42' });
    expect(byId.p_lucas).toMatchObject({ firstName: 'Lucas', lastName: 'Kloster', number: '13' });
    expect(byId.p_cooper).toMatchObject({ firstName: 'Cooper', lastName: 'Woollen', number: '50' });
    expect(byId.p_carsyn).toMatchObject({ firstName: 'Carsyn', lastName: 'Griffith', number: '26' });
    expect(byId.p_matthew).toMatchObject({ firstName: 'Matthew', lastName: 'Hume', number: '76' });
    expect(byId.p_knox).toMatchObject({ firstName: 'Knox', lastName: 'Kennedy', number: '8' });
    expect(byId.p_weedon).toMatchObject({ firstName: 'Weedon', lastName: 'Hainline', number: '10' });
    expect(byId.p_landyn).toMatchObject({ firstName: 'Landyn', lastName: 'Durbin' });
    expect(byId.p_landyn.number).toBeUndefined();
    expect(byId.p_ben).toMatchObject({ firstName: 'Ben', lastName: 'Boncek', number: '99' });
  });
});

describe('buildDemoData: games', () => {
  it('has seven games: six final and one scheduled, all for the demo team', () => {
    expect(data.games).toHaveLength(7);
    expect(finalGames).toHaveLength(6);
    expect(scheduledGames).toHaveLength(1);
    expect(data.games.every((g) => g.teamId === DEMO_TEAM_ID)).toBe(true);
    expect(data.games.map((g) => g.id)).toEqual([
      'g_wolves',
      'g_tigers_1',
      'g_rockhounds',
      'g_fury',
      'g_redbirds',
      'g_bandits',
      'g_tigers_2',
    ]);
  });

  it('lists games in chronological order', () => {
    const times = data.games.map((g) => new Date(g.startsAt).getTime());
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('the scheduled game is @ Tigers on the next Saturday at 2:30pm', () => {
    const g = scheduledGames[0];
    expect(g.id).toBe('g_tigers_2');
    expect(g.opponent).toBe('Tigers');
    expect(g.isAway).toBe(true);
    const start = new Date(g.startsAt);
    // NOW is a Monday, so next Saturday is 5 days out.
    expect(start.getDay()).toBe(6);
    expect(differenceInCalendarDays(start, NOW)).toBe(5);
    expect(start.getHours()).toBe(14);
    expect(start.getMinutes()).toBe(30);
    expect(start.getSeconds()).toBe(0);
    expect(g.notes).toBe('On a three game winning streak against the Tigers since April.');
  });

  it('the scheduled game is untouched: 1st inning top, nobody up yet, 0-0, full default lineup', () => {
    const g = scheduledGames[0];
    expect(g.inning).toBe(1);
    expect(g.half).toBe('top');
    expect(g.ourNextBatter).toBe(0);
    expect(g.theirNextBatter).toBe(0);
    expect(g.score).toEqual({ us: 0, them: 0 });
    expect(g.finishedAt).toBeUndefined();
    expect(g.lineup).toEqual(demoTeam.defaultLineup);
    expect(g.pitcherId).toBe('p_weedon');
    expect(data.atBats.some((x) => x.gameId === g.id)).toBe(false);
  });

  it('the two most recent final games are on the most recent past Saturday', () => {
    const redbirds = gameById.get('g_redbirds')!;
    const bandits = gameById.get('g_bandits')!;
    for (const g of [redbirds, bandits]) {
      expect(g.isAway).toBe(true);
      expect(new Date(g.startsAt).getDay()).toBe(6);
      // NOW is a Monday, so the most recent Saturday is 2 days back.
      expect(differenceInCalendarDays(new Date(g.startsAt), NOW)).toBe(-2);
    }
    expect(new Date(redbirds.startsAt).getHours()).toBe(9);
    expect(new Date(redbirds.startsAt).getMinutes()).toBe(0);
    expect(redbirds).toMatchObject({
      opponent: 'Redbirds Red',
      score: { us: 6, them: 7 },
      notes: '4 inning game, lost the lead in the 3rd inning, 1 HR.',
      inning: 4,
    });
    expect(new Date(bandits.startsAt).getHours()).toBe(12);
    expect(new Date(bandits.startsAt).getMinutes()).toBe(30);
    expect(bandits).toMatchObject({
      opponent: 'Midland Bandits',
      score: { us: 19, them: 5 },
      notes: '3 inning game, took the lead in the 1st inning, 1 HR.',
      inning: 3,
    });
  });

  describe('relative dates', () => {
    const finalsOf = (d: ReturnType<typeof buildDemoData>) => d.games.filter((g) => g.status === 'final');
    const nextOf = (d: ReturnType<typeof buildDemoData>) => d.games.find((g) => g.status === 'scheduled')!;

    it('on a Saturday morning every final game is already over and the next game is a week out', () => {
      const sat = new Date('2026-09-19T08:00:00');
      const d = buildDemoData(sat);
      for (const g of finalsOf(d)) {
        expect(new Date(g.finishedAt!).getTime()).toBeLessThan(sat.getTime());
      }
      const latest = finalsOf(d).map((g) => new Date(g.startsAt))[finalsOf(d).length - 1];
      expect(differenceInCalendarDays(latest, sat)).toBe(-7);
      expect(latest.getDay()).toBe(6);
      expect(differenceInCalendarDays(new Date(nextOf(d).startsAt), sat)).toBe(7);
    });

    it('on a Saturday evening the finals still sit on last Saturday, so the seed does not move during the day', () => {
      const morning = buildDemoData(new Date('2026-09-19T08:00:00'));
      const evening = buildDemoData(new Date('2026-09-19T20:00:00'));
      expect(evening.games.map((g) => g.startsAt)).toEqual(morning.games.map((g) => g.startsAt));
    });

    it.each([
      ['Sunday', '2026-09-20T10:00:00', -1, 6],
      ['Wednesday', '2026-09-16T10:00:00', -4, 3],
      ['Friday', '2026-09-18T23:00:00', -6, 1],
    ])('on a %s the finals are on the previous Saturday and the next game on the coming one', (_day, iso, back, ahead) => {
      const now = new Date(iso);
      const d = buildDemoData(now);
      const finals = finalsOf(d);
      const latest = new Date(finals[finals.length - 1].startsAt);
      expect(latest.getDay()).toBe(6);
      expect(differenceInCalendarDays(latest, now)).toBe(back);
      for (const g of finals) expect(new Date(g.finishedAt!).getTime()).toBeLessThan(now.getTime());
      expect(differenceInCalendarDays(new Date(nextOf(d).startsAt), now)).toBe(ahead);
    });
  });

  it('final games have finishedAt after first pitch and end in the bottom of the last inning', () => {
    for (const g of finalGames) {
      expect(g.finishedAt).toBeDefined();
      expect(new Date(g.finishedAt!).getTime()).toBeGreaterThan(new Date(g.startsAt).getTime());
      expect(new Date(g.createdAt).getTime()).toBeLessThan(new Date(g.startsAt).getTime());
      expect(g.half).toBe('bottom');
      expect(g.inning).toBeGreaterThanOrEqual(3);
      expect(g.ourNextBatter).toBeLessThan(g.lineup.length);
      expect(g.theirNextBatter).toBeLessThan(g.opponentLineup.length);
    }
  });

  it('every game has a nine-batter opponent order with ids scoped to the game', () => {
    for (const g of data.games) {
      expect(g.opponentLineup.map((b) => b.name)).toEqual(Array.from({ length: 9 }, (_, i) => `Batter ${i + 1}`));
      for (const b of g.opponentLineup) expect(b.id.startsWith(`${g.id}_`)).toBe(true);
    }
    const allOpponentIds = data.games.flatMap((g) => g.opponentLineup.map((b) => b.id));
    expect(new Set(allOpponentIds).size).toBe(allOpponentIds.length);
  });

  it('Knox Kennedy appears only in the last two final games (and the upcoming one)', () => {
    const withKnox = data.games.filter((g) => g.lineup.some((s) => s.playerId === 'p_knox')).map((g) => g.id);
    expect(withKnox).toEqual(['g_redbirds', 'g_bandits', 'g_tigers_2']);
    for (const g of finalGames.slice(0, 4)) {
      expect(g.lineup).toHaveLength(9);
      expect(g.lineup.map((s) => s.playerId)).toEqual(
        demoTeam.defaultLineup.map((s) => s.playerId).filter((id) => id !== 'p_knox'),
      );
    }
    const knoxGames = new Set(data.atBats.filter((x) => x.batterId === 'p_knox').map((x) => x.gameId));
    expect([...knoxGames].sort()).toEqual(['g_bandits', 'g_redbirds']);
  });

  it('every other game lineup is the default lineup in order', () => {
    for (const g of data.games) {
      const ids = g.lineup.map((s) => s.playerId);
      const expected = demoTeam.defaultLineup.map((s) => s.playerId).filter((id) => ids.includes(id));
      expect(ids).toEqual(expected);
      for (const slot of g.lineup) {
        expect(slot.position).toBe(demoTeam.defaultLineup.find((s) => s.playerId === slot.playerId)!.position);
      }
    }
  });
});

describe('buildDemoData: at-bats', () => {
  it('exist for every final game and none for the scheduled game', () => {
    expect(data.atBats.length).toBeGreaterThan(100);
    for (const g of finalGames) {
      expect(data.atBats.filter((x) => x.gameId === g.id && x.side === 'us').length).toBeGreaterThan(0);
      expect(data.atBats.filter((x) => x.gameId === g.id && x.side === 'them').length).toBeGreaterThan(0);
    }
  });

  it('have unique ids', () => {
    expect(new Set(data.atBats.map((x) => x.id)).size).toBe(data.atBats.length);
  });

  it('reference a valid game, a batter in that game’s order and a valid inning/half', () => {
    for (const x of data.atBats) {
      const g = gameById.get(x.gameId);
      expect(g).toBeDefined();
      expect(x.inning).toBeGreaterThanOrEqual(1);
      expect(x.inning).toBeLessThanOrEqual(g!.inning);
      expect(['top', 'bottom']).toContain(x.half);
      expect(whoBats(g!, x.half)).toBe(x.side);
      if (x.side === 'us') {
        expect(g!.lineup.some((s) => s.playerId === x.batterId)).toBe(true);
        expect(playerIds.has(x.batterId)).toBe(true);
        expect(x.pitcherId).toBeUndefined();
      } else {
        expect(g!.opponentLineup.some((b) => b.id === x.batterId)).toBe(true);
      }
    }
  });

  it('"them" at-bats always name one of our roster players as the pitcher', () => {
    const theirs = data.atBats.filter((x) => x.side === 'them');
    expect(theirs.length).toBeGreaterThan(0);
    for (const x of theirs) {
      expect(x.pitcherId).toBeDefined();
      expect(playerIds.has(x.pitcherId!)).toBe(true);
    }
  });

  it('each final game ends with its last pitcher on the mound', () => {
    for (const g of finalGames) {
      const theirs = data.atBats.filter((x) => x.gameId === g.id && x.side === 'them');
      expect(g.pitcherId).toBe(theirs[theirs.length - 1].pitcherId);
      const pitchers = new Set(theirs.map((x) => x.pitcherId));
      expect(pitchers.size).toBe(2);
    }
  });

  it('result always agrees with the outcome, and W/L is from the batter’s perspective', () => {
    for (const x of data.atBats) {
      expect(x.result).toBe(getOutcome(x.outcomeId).result);
    }
    expect(data.atBats.some((x) => x.side === 'them' && x.result === 'W')).toBe(true);
    expect(data.atBats.some((x) => x.side === 'them' && x.result === 'L')).toBe(true);
  });

  it('are recorded in order, between first pitch and finishedAt', () => {
    for (const g of finalGames) {
      const times = data.atBats.filter((x) => x.gameId === g.id).map((x) => new Date(x.recordedAt).getTime());
      expect(times[0]).toBeGreaterThan(new Date(g.startsAt).getTime());
      expect(times[times.length - 1]).toBeLessThan(new Date(g.finishedAt!).getTime());
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('walk the batting order in sequence within a game', () => {
    for (const g of finalGames) {
      const ours = data.atBats.filter((x) => x.gameId === g.id && x.side === 'us');
      ours.forEach((x, i) => expect(x.batterId).toBe(g.lineup[i % g.lineup.length].playerId));
      expect(g.ourNextBatter).toBe(ours.length % g.lineup.length);
      const theirs = data.atBats.filter((x) => x.gameId === g.id && x.side === 'them');
      theirs.forEach((x, i) => expect(x.batterId).toBe(g.opponentLineup[i % g.opponentLineup.length].id));
      expect(g.theirNextBatter).toBe(theirs.length % g.opponentLineup.length);
    }
  });

  it('every half inning has at least three plate appearances', () => {
    for (const g of finalGames) {
      for (let inning = 1; inning <= g.inning; inning++) {
        for (const half of ['top', 'bottom'] as const) {
          const n = data.atBats.filter((x) => x.gameId === g.id && x.inning === inning && x.half === half).length;
          expect(n).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  describe('plain at-bats (charted with the big W/L and no play type)', () => {
    const plain = data.atBats.filter((x) => isPlain(x.outcomeId));

    it('every 7th at-bat of the dataset is plain and every other one is typed', () => {
      expect(PLAIN_EVERY).toBe(7);
      data.atBats.forEach((x, i) => expect(isPlain(x.outcomeId)).toBe(i % PLAIN_EVERY === PLAIN_EVERY - 1));
      expect(plain).toHaveLength(Math.floor(data.atBats.length / PLAIN_EVERY));
      expect(plain.length).toBeGreaterThanOrEqual(30);
    });

    it('carry the batter’s result in the plain id, for both letters and both sides', () => {
      for (const x of plain) expect(x.outcomeId).toBe(x.result === 'W' ? 'plain_w' : 'plain_l');
      expect(plain.some((x) => x.outcomeId === 'plain_w')).toBe(true);
      expect(plain.some((x) => x.outcomeId === 'plain_l')).toBe(true);
      expect(plain.some((x) => x.side === 'us')).toBe(true);
      expect(plain.some((x) => x.side === 'them')).toBe(true);
    });

    it('appear in every final game so plain tiles and blank codes show on every scorebook', () => {
      for (const g of finalGames) {
        expect(plain.filter((x) => x.gameId === g.id).length).toBeGreaterThanOrEqual(3);
      }
    });

    it('resolve through getOutcome with a blank scorebook code', () => {
      for (const x of plain) {
        const o = getOutcome(x.outcomeId);
        expect(o.result).toBe(x.result);
        expect(o.short).toBe('');
      }
    });
  });
});
