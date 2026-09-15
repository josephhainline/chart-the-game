import { describe, expect, it } from '@jest/globals';
import { differenceInCalendarDays } from 'date-fns';

import { compareClock } from '../atbats';
import { getOutcome, isPlain } from '../outcomes';
import { DEMO_TEAM_ID, PLAIN_EVERY, buildDemoData } from '../seed';
import { FORM_WINDOW, formRating, formScore, hittingFor, recentForm } from '../stats';
import type { Game, Half, Id, Side } from '../types';

const NOW = new Date('2026-09-14T12:00:00');
const data = buildDemoData(NOW);
const demoTeam = data.teams.find((t) => t.id === DEMO_TEAM_ID)!;
const gameById = new Map(data.games.map((g) => [g.id, g]));
const finalGames = data.games.filter((g) => g.status === 'final');
const scheduledGames = data.games.filter((g) => g.status === 'scheduled');
const playerIds = new Set(data.players.map((p) => p.id));

const whoBats = (g: Pick<Game, 'isAway'>, half: Half): Side => ((g.isAway ? half === 'top' : half === 'bottom') ? 'us' : 'them');

const BENCH = ['p_mason', 'p_eli', 'p_theo'];
const STARTERS = ['p_owen', 'p_ryder', 'p_lucas', 'p_cooper', 'p_carsyn', 'p_matthew', 'p_knox', 'p_weedon', 'p_landyn', 'p_ben'];

/** The order the game started with: the current one with every recorded substitution reversed. */
function startingOrder(g: Game): Id[] {
  const ids = g.lineup.map((s) => s.playerId);
  for (const sub of [...(g.substitutions ?? [])].reverse()) ids[sub.slot] = sub.outId;
  return ids;
}

/** Who held the slot in that half-inning: the starter until a substitution at or before it. */
function occupantAt(g: Game, slot: number, inning: number, half: Half): Id {
  let id = startingOrder(g)[slot];
  for (const sub of g.substitutions ?? []) {
    if (sub.slot === slot && compareClock(sub, { inning, half }) <= 0) id = sub.inId;
  }
  return id;
}

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

  it('default lineup matches the spec order, one bare playerId per slot (no positions)', () => {
    expect(demoTeam.defaultLineup).toEqual(STARTERS.map((playerId) => ({ playerId })));
    for (const slot of demoTeam.defaultLineup) expect(Object.keys(slot)).toEqual(['playerId']);
  });
});

describe('buildDemoData: players', () => {
  it('has the ten starters plus the three bench players, all on the demo team', () => {
    expect(data.players).toHaveLength(13);
    expect(data.players.every((p) => p.teamId === DEMO_TEAM_ID)).toBe(true);
    expect(data.players.map((p) => p.id)).toEqual([...STARTERS, ...BENCH]);
  });

  it('has the ten roster players with the spec jersey numbers', () => {
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

  describe('the bench', () => {
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));

    it('is three fictional players with jersey numbers', () => {
      expect(byId.p_mason).toMatchObject({ firstName: 'Mason', lastName: 'Reed', number: '4' });
      expect(byId.p_eli).toMatchObject({ firstName: 'Eli', lastName: 'Park', number: '21' });
      expect(byId.p_theo).toMatchObject({ firstName: 'Theo', lastName: 'Alvarez', number: '15' });
    });

    it('is not in the default lineup nor in the upcoming game’s order', () => {
      for (const id of BENCH) {
        expect(demoTeam.defaultLineup.some((s) => s.playerId === id)).toBe(false);
        expect(scheduledGames[0].lineup.some((s) => s.playerId === id)).toBe(false);
      }
    });

    it('never started a game: a bench player only enters through a recorded substitution', () => {
      for (const g of data.games) {
        for (const id of BENCH) expect(startingOrder(g)).not.toContain(id);
      }
    });
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
      expect(startingOrder(g)).toEqual(demoTeam.defaultLineup.map((s) => s.playerId).filter((id) => id !== 'p_knox'));
    }
    const knoxGames = new Set(data.atBats.filter((x) => x.batterId === 'p_knox').map((x) => x.gameId));
    expect([...knoxGames].sort()).toEqual(['g_bandits', 'g_redbirds']);
  });

  it('every game started with the default lineup in order (minus Knox before he joined), slots without positions', () => {
    for (const g of data.games) {
      const ids = startingOrder(g);
      const expected = demoTeam.defaultLineup.map((s) => s.playerId).filter((id) => ids.includes(id));
      expect(ids).toEqual(expected);
      for (const slot of g.lineup) expect(Object.keys(slot)).toEqual(['playerId']);
    }
  });

  describe('seeded substitutions', () => {
    const withSubs = data.games.filter((g) => (g.substitutions ?? []).length > 0);

    it('Mason comes in for Cooper in the top of the 4th against the Rockhounds', () => {
      const g = gameById.get('g_rockhounds')!;
      expect(g.substitutions).toEqual([
        { id: 'g_rockhounds_sub1', slot: 3, outId: 'p_cooper', inId: 'p_mason', inning: 4, half: 'top', at: expect.any(String) },
      ]);
      expect(g.lineup[3]).toEqual({ playerId: 'p_mason' });
      expect(g.lineup.some((s) => s.playerId === 'p_cooper')).toBe(false);
    });

    it('Eli comes in for Landyn in the top of the 2nd against the Redbirds', () => {
      const g = gameById.get('g_redbirds')!;
      expect(g.substitutions).toEqual([
        { id: 'g_redbirds_sub1', slot: 8, outId: 'p_landyn', inId: 'p_eli', inning: 2, half: 'top', at: expect.any(String) },
      ]);
      expect(g.lineup[8]).toEqual({ playerId: 'p_eli' });
      expect(g.lineup.some((s) => s.playerId === 'p_landyn')).toBe(false);
    });

    it('Mason also comes in against the Fury and the Bandits; Eli only against the Redbirds; nobody else is ever subbed in', () => {
      expect(withSubs.map((g) => g.id)).toEqual(['g_rockhounds', 'g_fury', 'g_redbirds', 'g_bandits']);
      const inIds = withSubs.flatMap((g) => g.substitutions!.map((sub) => `${g.id}:${sub.inId}`));
      expect(inIds).toEqual(['g_rockhounds:p_mason', 'g_fury:p_mason', 'g_redbirds:p_eli', 'g_bandits:p_mason']);
      expect(scheduledGames[0].substitutions).toBeUndefined();
    });

    it('every record names the slot the sub now holds, a clock inside the game and a timestamp during it', () => {
      const ids = withSubs.flatMap((g) => g.substitutions!.map((sub) => sub.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const g of withSubs) {
        for (const sub of g.substitutions!) {
          expect(g.lineup[sub.slot].playerId).toBe(sub.inId);
          expect(g.lineup.some((s) => s.playerId === sub.outId)).toBe(false);
          expect(sub.inning).toBeGreaterThanOrEqual(1);
          expect(sub.inning).toBeLessThanOrEqual(g.inning);
          expect(new Date(sub.at).getTime()).toBeGreaterThan(new Date(g.startsAt).getTime());
          expect(new Date(sub.at).getTime()).toBeLessThan(new Date(g.finishedAt!).getTime());
          // The change is made between half-innings: no at-bat of that half comes before it.
          const halfAtBats = data.atBats.filter((x) => x.gameId === g.id && x.inning === sub.inning && x.half === sub.half);
          for (const x of halfAtBats) expect(x.recordedAt > sub.at).toBe(true);
        }
      }
    });

    it('the sub bats in the slot from the change on, never before it; the outgoing player never after it', () => {
      for (const g of withSubs) {
        for (const sub of g.substitutions!) {
          const ours = data.atBats.filter((x) => x.gameId === g.id && x.side === 'us');
          const before = ours.filter((x) => compareClock(x, sub) < 0);
          const after = ours.filter((x) => compareClock(x, sub) >= 0);
          expect(before.some((x) => x.batterId === sub.inId)).toBe(false);
          expect(after.some((x) => x.batterId === sub.inId)).toBe(true);
          expect(after.some((x) => x.batterId === sub.outId)).toBe(false);
        }
      }
      // Cooper had batted before Mason took his slot, so the Rockhounds scorebook shows an OUT row with at-bats.
      const rockhounds = gameById.get('g_rockhounds')!;
      const sub = rockhounds.substitutions![0];
      const cooper = data.atBats.filter((x) => x.gameId === rockhounds.id && x.batterId === 'p_cooper');
      expect(cooper.length).toBeGreaterThan(0);
      for (const x of cooper) expect(compareClock(x, sub)).toBeLessThan(0);
    });

    it('Mason has a full form window of at-bats and reads HOT; Eli is about even; Theo has never batted', () => {
      const mason = recentForm(data.atBats, data.games, 'p_mason');
      expect(mason).toHaveLength(FORM_WINDOW);
      expect(formScore(mason)).toBeGreaterThanOrEqual(3);
      expect(formRating(mason)).toBe('hot');
      const masonAll = hittingFor(data.atBats, 'p_mason');
      expect(masonAll.w + masonAll.l).toBeGreaterThanOrEqual(FORM_WINDOW);

      const eli = recentForm(data.atBats, data.games, 'p_eli');
      expect(eli.length).toBeGreaterThanOrEqual(1);
      expect(Math.abs(formScore(eli))).toBeLessThanOrEqual(1);
      expect(formRating(eli)).toBeUndefined();

      expect(data.atBats.some((x) => x.batterId === 'p_theo')).toBe(false);
      expect(recentForm(data.atBats, data.games, 'p_theo')).toEqual([]);
    });
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
        // In the order now, or in it before a recorded substitution took him out.
        const held = g!.lineup.some((s) => s.playerId === x.batterId) || (g!.substitutions ?? []).some((sub) => sub.outId === x.batterId);
        expect(held).toBe(true);
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

  it('walk the batting order in sequence within a game, each slot batted by whoever held it at the time', () => {
    for (const g of finalGames) {
      const ours = data.atBats.filter((x) => x.gameId === g.id && x.side === 'us');
      ours.forEach((x, i) => expect(x.batterId).toBe(occupantAt(g, i % g.lineup.length, x.inning, x.half)));
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
