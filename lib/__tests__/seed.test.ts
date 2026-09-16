import { describe, expect, it } from '@jest/globals';
import { differenceInCalendarDays } from 'date-fns';

import { compareClock } from '../atbats';
import dataset from '../demo/bears-floyd-14u.json';
import { getOutcome, isPlain } from '../outcomes';
import { DEMO_SEASON, DEMO_TEAM_ID, NEXT_GAME_ID, buildDemoData, saturdayOffset } from '../seed';
import type { DemoDataset, DemoGame } from '../seed';
import { hittingFor, pitchingFor, score } from '../stats';
import type { Game, Half, Id, Side } from '../types';

const SOURCE = dataset as DemoDataset;

/** A Monday: the most recent weekend is two days (Saturday) and one day (Sunday) back. */
const NOW = new Date('2026-09-14T12:00:00');
const data = buildDemoData(NOW);
const demoTeam = data.teams.find((t) => t.id === DEMO_TEAM_ID)!;
const gameById = new Map(data.games.map((g) => [g.id, g]));
const finalGames = data.games.filter((g) => g.status === 'final');
const scheduledGames = data.games.filter((g) => g.status === 'scheduled');
const playerIds = new Set(data.players.map((p) => p.id));
const nextGame = gameById.get(NEXT_GAME_ID)!;

const whoBats = (g: Pick<Game, 'isAway'>, half: Half): Side => ((g.isAway ? half === 'top' : half === 'bottom') ? 'us' : 'them');

const PLAYER_IDS = [
  'p_hamilton',
  'p_brady',
  'p_cooper',
  'p_owen_haynes',
  'p_gabe',
  'p_lucas',
  'p_ben',
  'p_knox',
  'p_carsyn',
  'p_weedon',
  'p_owen_clark',
  'p_jd',
  'p_chase',
  'p_rhett',
  'p_angel',
];
const STARTERS = ['p_hamilton', 'p_brady', 'p_cooper', 'p_owen_haynes', 'p_gabe', 'p_lucas', 'p_ben', 'p_knox', 'p_carsyn', 'p_weedon'];
const BENCH = ['p_owen_clark', 'p_jd', 'p_chase', 'p_rhett', 'p_angel'];

/**
 * Every real game: its id, the source key, where its weekend sits relative to
 * `now` (0 = the most recent weekend that is over), the day of that weekend and
 * the local (America/Chicago) time of first pitch.
 */
const REAL_GAMES: { id: Id; key: string; weekOffset: number; day: 'sat' | 'sun'; hour: number; minute: number }[] = [
  { id: 'g_0815_1', key: 'aug-15-game-1', weekOffset: -4, day: 'sat', hour: 16, minute: 0 },
  { id: 'g_0815_2', key: 'aug-15-game-2', weekOffset: -4, day: 'sat', hour: 17, minute: 45 },
  { id: 'g_0816_1', key: 'aug-16-game-1', weekOffset: -4, day: 'sun', hour: 10, minute: 45 },
  { id: 'g_0816_2', key: 'aug-16-game-2', weekOffset: -4, day: 'sun', hour: 14, minute: 15 },
  { id: 'g_0822_1', key: 'aug-22-game-1', weekOffset: -3, day: 'sat', hour: 14, minute: 15 },
  { id: 'g_0822_2', key: 'aug-22-game-2', weekOffset: -3, day: 'sat', hour: 17, minute: 45 },
  { id: 'g_0823_1', key: 'aug-23-game-1', weekOffset: -3, day: 'sun', hour: 9, minute: 0 },
  { id: 'g_0823_2', key: 'aug-23-game-2', weekOffset: -3, day: 'sun', hour: 12, minute: 30 },
  { id: 'g_0823_3', key: 'aug-23-game-3', weekOffset: -3, day: 'sun', hour: 16, minute: 0 },
  { id: 'g_0912_1', key: 'sep-12-game-1', weekOffset: 0, day: 'sat', hour: 8, minute: 0 },
  { id: 'g_0912_2', key: 'sep-12-game-2', weekOffset: 0, day: 'sat', hour: 12, minute: 0 },
  { id: 'g_0913_1', key: 'sep-13-game-1', weekOffset: 0, day: 'sun', hour: 12, minute: 0 },
  { id: 'g_0913_2', key: 'sep-13-game-2', weekOffset: 0, day: 'sun', hour: 16, minute: 0 },
];

const sourceByKey = new Map(SOURCE.games.map((g) => [g.key, g]));
const sourceOf = (id: Id): DemoGame => sourceByKey.get(REAL_GAMES.find((r) => r.id === id)!.key)!;

/** The starting order with every substitution applied in the order it was made. */
function withSubsApplied(source: DemoGame): Id[] {
  const ids = [...source.lineup];
  for (const sub of source.subs) ids[ids.indexOf(sub.outId)] = sub.inId;
  return ids;
}

/** The order the game started with: the current one with every recorded substitution reversed. */
function startingOrder(g: Game): Id[] {
  const ids = g.lineup.map((s) => s.playerId);
  for (const sub of [...(g.substitutions ?? [])].reverse()) ids[sub.slot] = sub.outId;
  return ids;
}

const at = (iso: string) => new Date(iso).getTime();

describe('buildDemoData: determinism', () => {
  it('produces an identical document on every call for the same date', () => {
    expect(buildDemoData(NOW)).toEqual(data);
    expect(JSON.stringify(buildDemoData(NOW))).toBe(JSON.stringify(data));
  });

  it('keeps every id, batter, result and outcome when built for a different date: only the calendar moves', () => {
    const other = buildDemoData(new Date('2027-03-01T08:00:00'));
    expect(other.games.map((g) => g.id)).toEqual(data.games.map((g) => g.id));
    expect(other.games.map((g) => [g.lineup, g.substitutions?.map(({ at: _at, ...rest }) => rest), g.pitcherId])).toEqual(
      data.games.map((g) => [g.lineup, g.substitutions?.map(({ at: _at, ...rest }) => rest), g.pitcherId]),
    );
    expect(other.atBats.map((x) => [x.id, x.batterId, x.pitcherId, x.result, x.outcomeId, x.inning, x.half])).toEqual(
      data.atBats.map((x) => [x.id, x.batterId, x.pitcherId, x.result, x.outcomeId, x.inning, x.half]),
    );
    expect(other.games.map((g) => g.startsAt)).not.toEqual(data.games.map((g) => g.startsAt));
    expect(other.teams.map((t) => t.season)).toEqual(data.teams.map((t) => t.season));
  });

  it('starts un-onboarded with schema version 1', () => {
    expect(data.version).toBe(1);
    expect(data.onboarded).toBe(false);
  });
});

describe('buildDemoData: teams', () => {
  it('has the four Bears teams, all in the Fall 2026 season, the demo team first', () => {
    expect(data.teams.map((t) => [t.id, t.name])).toEqual([
      ['t_floyd14u', 'Bears Floyd 14U'],
      ['t_ken14u', 'Bears Ken 14U'],
      ['t_engelken14u', 'Bears Engelken 14U'],
      ['t_floyd17u', 'Bears Floyd 17U'],
    ]);
    expect(DEMO_SEASON).toBe('Fall 2026');
    expect(data.teams.every((t) => t.season === DEMO_SEASON)).toBe(true);
    expect(DEMO_TEAM_ID).toBe('t_floyd14u');
  });

  it('lists the teams in creation order (My Teams sorts by createdAt), all created before the first game', () => {
    const created = data.teams.map((t) => at(t.createdAt));
    for (let i = 1; i < created.length; i++) expect(created[i]).toBeGreaterThan(created[i - 1]);
    expect(created[created.length - 1]).toBeLessThan(at(data.games[0].startsAt));
  });

  it('only the demo team has a roster, games and a default lineup', () => {
    expect(demoTeam.defaultLineup).toHaveLength(10);
    for (const t of data.teams.filter((x) => x.id !== DEMO_TEAM_ID)) {
      expect(t.defaultLineup).toEqual([]);
      expect(data.players.filter((p) => p.teamId === t.id)).toEqual([]);
      expect(data.games.filter((g) => g.teamId === t.id)).toEqual([]);
    }
    expect(data.games.every((g) => g.teamId === DEMO_TEAM_ID)).toBe(true);
  });

  it('default lineup is the starting order of the first Sep 12 game, one bare playerId per slot', () => {
    expect(demoTeam.defaultLineup).toEqual(STARTERS.map((playerId) => ({ playerId })));
    expect(demoTeam.defaultLineup.map((s) => s.playerId)).toEqual(sourceByKey.get('sep-12-game-1')!.lineup);
    for (const slot of demoTeam.defaultLineup) expect(Object.keys(slot)).toEqual(['playerId']);
  });
});

describe('buildDemoData: players', () => {
  it('has the fifteen players of the dataset with their stable ids, all on the demo team', () => {
    expect(data.players).toHaveLength(15);
    expect(data.players.every((p) => p.teamId === DEMO_TEAM_ID)).toBe(true);
    expect(data.players.map((p) => p.id)).toEqual(PLAYER_IDS);
    expect(data.players.map((p) => p.id)).toEqual(SOURCE.players.map((p) => p[0]));
  });

  it('carries the names and jersey numbers as captured (a leading zero stays)', () => {
    expect(data.players.map((p) => [p.id, p.firstName, p.lastName, p.number])).toEqual(SOURCE.players);
    const byId = Object.fromEntries(data.players.map((p) => [p.id, p]));
    expect(byId.p_hamilton).toMatchObject({ firstName: 'Hamilton', lastName: 'Case', number: '18' });
    expect(byId.p_cooper).toMatchObject({ firstName: 'Cooper', lastName: 'Woollen', number: '50' });
    expect(byId.p_owen_haynes).toMatchObject({ firstName: 'Owen', lastName: 'Haynes', number: '7' });
    expect(byId.p_owen_clark).toMatchObject({ firstName: 'Owen', lastName: 'Clark', number: '24' });
    expect(byId.p_weedon).toMatchObject({ firstName: 'Weedon', lastName: 'Hainline', number: '04' });
    expect(byId.p_jd).toMatchObject({ firstName: 'JD', lastName: 'Etter', number: '6' });
  });

  it('the bench (not in the default lineup nor in the upcoming game) is Owen Clark, JD, Chase, Rhett and Angel', () => {
    const inDefault = new Set(demoTeam.defaultLineup.map((s) => s.playerId));
    expect(data.players.filter((p) => !inDefault.has(p.id)).map((p) => p.id)).toEqual(BENCH);
    for (const id of BENCH) expect(nextGame.lineup.some((s) => s.playerId === id)).toBe(false);
  });
});

describe('buildDemoData: games', () => {
  it('has the thirteen real games (final) and one scheduled, in chronological order', () => {
    expect(data.games).toHaveLength(14);
    expect(finalGames).toHaveLength(13);
    expect(scheduledGames).toHaveLength(1);
    expect(data.games.map((g) => g.id)).toEqual([...REAL_GAMES.map((r) => r.id), NEXT_GAME_ID]);
    const times = data.games.map((g) => at(g.startsAt));
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('every real game carries its opponent, home/away, score and innings from the dataset', () => {
    for (const r of REAL_GAMES) {
      const g = gameById.get(r.id)!;
      const s = sourceOf(r.id);
      expect(g).toMatchObject({ opponent: s.opponent, isAway: s.isAway, inning: s.innings, half: 'bottom', status: 'final' });
      expect('score' in g).toBe(false);
      expect(g.ourNextBatter).toBe(0);
      expect(g.theirNextBatter).toBe(0);
      expect(g.notes).toBeUndefined();
    }
    expect(gameById.get('g_0823_1')).toMatchObject({ opponent: 'Bears Ken 14U', isAway: false, inning: 2 });
    expect(gameById.get('g_0913_2')).toMatchObject({ opponent: 'Missouri Gators Carmi 14U', isAway: false, inning: 4 });
  });

  describe('the calendar', () => {
    it.each(REAL_GAMES)('$id is on the $day of weekend $weekOffset at $hour:$minute local time', (r) => {
      const start = new Date(gameById.get(r.id)!.startsAt);
      const expectedDay = saturdayOffset(NOW, r.weekOffset) + (r.day === 'sun' ? 1 : 0);
      expect(differenceInCalendarDays(start, NOW)).toBe(expectedDay);
      expect(start.getDay()).toBe(r.day === 'sat' ? 6 : 0);
      expect(start.getHours()).toBe(r.hour);
      expect(start.getMinutes()).toBe(r.minute);
      expect(start.getSeconds()).toBe(0);
    });

    it('for a Monday the weekends are 2/1, 23/22 and 30/29 days back', () => {
      const back = (id: Id) => differenceInCalendarDays(new Date(gameById.get(id)!.startsAt), NOW);
      expect([back('g_0912_1'), back('g_0913_1')]).toEqual([-2, -1]);
      expect([back('g_0822_1'), back('g_0823_1')]).toEqual([-23, -22]);
      expect([back('g_0815_1'), back('g_0816_1')]).toEqual([-30, -29]);
    });

    it('the scheduled game is vs Bears Ken 14U next Saturday at 10:00am', () => {
      expect(nextGame).toMatchObject({ id: 'g_next', opponent: 'Bears Ken 14U', isAway: false, status: 'scheduled' });
      const start = new Date(nextGame.startsAt);
      expect(start.getDay()).toBe(6);
      expect(differenceInCalendarDays(start, NOW)).toBe(5);
      expect(start.getHours()).toBe(10);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    describe('relative to other days of the week', () => {
      const finalsOf = (d: ReturnType<typeof buildDemoData>) => d.games.filter((g) => g.status === 'final');
      const nextOf = (d: ReturnType<typeof buildDemoData>) => d.games.find((g) => g.status === 'scheduled')!;

      it.each([
        ['Saturday morning', '2026-09-19T08:00:00', -7, 7],
        ['Saturday evening', '2026-09-19T20:00:00', -7, 7],
        ['Sunday morning', '2026-09-20T10:00:00', -8, 6],
        ['Sunday night', '2026-09-20T23:00:00', -8, 6],
        ['Monday', '2026-09-21T00:30:00', -2, 5],
        ['Wednesday', '2026-09-16T10:00:00', -4, 3],
        ['Friday', '2026-09-18T23:00:00', -6, 1],
      ])('on a %s the last weekend is fully over and the next game is on the coming Saturday', (_day, iso, saturdayBack, ahead) => {
        const now = new Date(iso);
        const d = buildDemoData(now);
        const finals = finalsOf(d);
        const saturday = new Date(finals.find((g) => g.id === 'g_0912_1')!.startsAt);
        const sunday = new Date(finals.find((g) => g.id === 'g_0913_2')!.startsAt);
        expect(saturday.getDay()).toBe(6);
        expect(sunday.getDay()).toBe(0);
        expect(differenceInCalendarDays(saturday, now)).toBe(saturdayBack);
        expect(differenceInCalendarDays(sunday, now)).toBe(saturdayBack + 1);
        for (const g of finals) expect(at(g.finishedAt!)).toBeLessThan(now.getTime());
        const next = new Date(nextOf(d).startsAt);
        expect(next.getDay()).toBe(6);
        expect(differenceInCalendarDays(next, now)).toBe(ahead);
        expect(next.getTime()).toBeGreaterThan(now.getTime());
      });

      it('does not move during a weekend: Saturday morning, Saturday night and Sunday give the same calendar', () => {
        const saturday = buildDemoData(new Date('2026-09-19T08:00:00'));
        const night = buildDemoData(new Date('2026-09-19T23:30:00'));
        const sunday = buildDemoData(new Date('2026-09-20T15:00:00'));
        expect(night.games.map((g) => g.startsAt)).toEqual(saturday.games.map((g) => g.startsAt));
        expect(sunday.games.map((g) => g.startsAt)).toEqual(saturday.games.map((g) => g.startsAt));
      });
    });
  });

  it('the scheduled game is untouched: top of the 1st, nobody up, the default lineup, no pitcher, no at-bats', () => {
    expect(nextGame.inning).toBe(1);
    expect(nextGame.half).toBe('top');
    expect(nextGame.ourNextBatter).toBe(0);
    expect(nextGame.theirNextBatter).toBe(0);
    expect(nextGame.finishedAt).toBeUndefined();
    expect(nextGame.notes).toBeUndefined();
    expect(nextGame.substitutions).toBeUndefined();
    expect(nextGame.lineup).toEqual(demoTeam.defaultLineup);
    expect(nextGame.lineup).not.toBe(demoTeam.defaultLineup);
    expect(nextGame.pitcherId).toBeUndefined();
    expect(nextGame.opponentLineup).toEqual(Array.from({ length: 9 }, (_, i) => ({ id: `g_next_ob${i}`, name: `Batter ${i + 1}` })));
    expect(data.atBats.some((x) => x.gameId === nextGame.id)).toBe(false);
    expect(at(nextGame.createdAt)).toBeLessThan(at(nextGame.startsAt));
  });

  it('final games were created the day before, finish two hours after first pitch and end in the bottom of the last inning', () => {
    for (const g of finalGames) {
      expect(at(g.createdAt)).toBe(at(g.startsAt) - 24 * 60 * 60 * 1000);
      expect(at(g.finishedAt!)).toBe(at(g.startsAt) + 2 * 60 * 60 * 1000);
      expect(g.half).toBe('bottom');
      expect(g.inning).toBeGreaterThanOrEqual(2);
    }
  });

  it('every game started with the starting order of the dataset and now shows it with the subs applied', () => {
    for (const r of REAL_GAMES) {
      const g = gameById.get(r.id)!;
      const s = sourceOf(r.id);
      expect(startingOrder(g)).toEqual(s.lineup);
      expect(g.lineup.map((x) => x.playerId)).toEqual(withSubsApplied(s));
      expect(g.lineup).toHaveLength(10);
      expect(new Set(g.lineup.map((x) => x.playerId)).size).toBe(10);
      for (const slot of g.lineup) expect(Object.keys(slot)).toEqual(['playerId']);
    }
  });

  it('the opponent order is one batter per jersey seen, in order of first appearance, unknown jerseys without a number', () => {
    for (const r of REAL_GAMES) {
      const g = gameById.get(r.id)!;
      const s = sourceOf(r.id);
      expect(g.opponentLineup).toHaveLength(s.opponentJerseys.length);
      g.opponentLineup.forEach((b, i) => {
        expect(b.id).toBe(`${g.id}_ob${i}`);
        expect(b.name).toBe(`Batter ${i + 1}`);
        if (s.opponentJerseys[i] === '?') expect(b.number).toBeUndefined();
        else expect(b.number).toBe(s.opponentJerseys[i]);
      });
    }
    expect(gameById.get('g_0913_2')!.opponentLineup.map((b) => b.number)).toEqual(['0', '10', '1', '9', '43', '11', '21', '19', '6', '18']);
    expect(gameById.get('g_0816_1')!.opponentLineup[4].number).toBeUndefined();
    const allOpponentIds = data.games.flatMap((g) => g.opponentLineup.map((b) => b.id));
    expect(new Set(allOpponentIds).size).toBe(allOpponentIds.length);
  });

  it('ends each final game with the last pitcher who faced a batter on the mound', () => {
    for (const g of finalGames) {
      const theirs = data.atBats.filter((x) => x.gameId === g.id && x.side === 'them');
      expect(g.pitcherId).toBe(theirs[theirs.length - 1].pitcherId);
    }
    // Sep 13 game 2: Carsyn started, Lucas and Chase pitched the 3rd, Weedon finished.
    const g = gameById.get('g_0913_2')!;
    const seen: Id[] = [];
    for (const x of data.atBats.filter((y) => y.gameId === g.id && y.side === 'them')) {
      if (seen[seen.length - 1] !== x.pitcherId) seen.push(x.pitcherId!);
    }
    expect(seen).toEqual(['p_carsyn', 'p_lucas', 'p_chase', 'p_weedon']);
    expect(g.pitcherId).toBe('p_weedon');
  });

  describe('substitutions', () => {
    const withSubs = finalGames.filter((g) => (g.substitutions ?? []).length > 0);

    it('match the dataset record for record: slot at the time, half-inning, ids scoped to the game', () => {
      for (const r of REAL_GAMES) {
        const g = gameById.get(r.id)!;
        const s = sourceOf(r.id);
        if (s.subs.length === 0) {
          expect(g.substitutions).toBeUndefined();
          continue;
        }
        const ids = [...s.lineup];
        const expected = s.subs.map((sub, i) => {
          const slot = ids.indexOf(sub.outId);
          ids[slot] = sub.inId;
          return { id: `${g.id}_sub${i + 1}`, slot, outId: sub.outId, inId: sub.inId, inning: sub.at.inning, half: sub.at.half, at: expect.any(String) };
        });
        expect(g.substitutions).toEqual(expected);
      }
      expect(withSubs.map((g) => g.id)).toEqual([
        'g_0815_2',
        'g_0816_1',
        'g_0816_2',
        'g_0822_1',
        'g_0822_2',
        'g_0823_1',
        'g_0823_2',
        'g_0823_3',
        'g_0912_1',
        'g_0912_2',
        'g_0913_1',
        'g_0913_2',
      ]);
    });

    it('three subs at once against Bears Ken: Knox for Carsyn, Hamilton for Brady, Weedon for Cooper in the bottom of the 2nd', () => {
      const g = gameById.get('g_0823_1')!;
      expect(g.substitutions).toEqual([
        { id: 'g_0823_1_sub1', slot: 8, outId: 'p_carsyn', inId: 'p_knox', inning: 2, half: 'bottom', at: expect.any(String) },
        { id: 'g_0823_1_sub2', slot: 0, outId: 'p_brady', inId: 'p_hamilton', inning: 2, half: 'bottom', at: expect.any(String) },
        { id: 'g_0823_1_sub3', slot: 2, outId: 'p_cooper', inId: 'p_weedon', inning: 2, half: 'bottom', at: expect.any(String) },
      ]);
      expect(g.lineup.map((s) => s.playerId)).toEqual([
        'p_hamilton',
        'p_ben',
        'p_weedon',
        'p_owen_haynes',
        'p_owen_clark',
        'p_gabe',
        'p_jd',
        'p_lucas',
        'p_knox',
        'p_chase',
      ]);
    });

    it('a re-entry: JD for Chase and then Chase back for JD in the same half against PSA Chiesa', () => {
      const g = gameById.get('g_0913_1')!;
      expect(g.substitutions!.map((s) => [s.slot, s.outId, s.inId])).toEqual([
        [8, 'p_carsyn', 'p_weedon'],
        [9, 'p_chase', 'p_jd'],
        [9, 'p_jd', 'p_chase'],
      ]);
      expect(g.lineup[9]).toEqual({ playerId: 'p_chase' });
      expect(g.lineup.some((s) => s.playerId === 'p_jd')).toBe(false);
    });

    it('every record is timestamped during the game, in the order the changes were made, and the slot ends with its last sub', () => {
      const ids = withSubs.flatMap((g) => g.substitutions!.map((sub) => sub.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const g of withSubs) {
        let previous = at(g.startsAt);
        const lastOnSlot = new Map(g.substitutions!.map((sub) => [sub.slot, sub.inId]));
        for (const [slot, inId] of lastOnSlot) expect(g.lineup[slot].playerId).toBe(inId);
        for (const sub of g.substitutions!) {
          expect(sub.inning).toBeGreaterThanOrEqual(1);
          expect(sub.inning).toBeLessThanOrEqual(g.inning);
          expect(at(sub.at)).toBeGreaterThan(previous);
          expect(at(sub.at)).toBeLessThan(at(g.finishedAt!));
          previous = at(sub.at);
        }
      }
    });

    it('is stamped at the incoming player’s first at-bat from that half on, else the first play after the outgoing player’s last', () => {
      for (const g of withSubs) {
        const plays = data.atBats.filter((x) => x.gameId === g.id);
        let previous = -Infinity;
        for (const sub of g.substitutions!) {
          const later = plays.filter((x) => at(x.recordedAt) > previous && compareClock(x, sub) >= 0);
          const own = later.find((x) => x.side === 'us' && x.batterId === sub.inId);
          const outLast = later.filter((x) => x.side === 'us' && x.batterId === sub.outId).pop();
          const next = later.find((x) => at(x.recordedAt) > (outLast ? at(outLast.recordedAt) : -Infinity));
          expect(sub.at).toBe((own ?? next)!.recordedAt);
          previous = at(sub.at);
        }
      }
      // Chase re-entered for JD without batting again: stamped at the next play after JD's at-bat.
      const psa = gameById.get('g_0913_1')!;
      const [, jdIn, chaseBack] = psa.substitutions!;
      const jd = data.atBats.find((x) => x.gameId === psa.id && x.batterId === 'p_jd')!;
      expect(jdIn.at).toBe(jd.recordedAt);
      expect(at(chaseBack.at)).toBeGreaterThan(at(jd.recordedAt));
    });

    it('a player who was subbed out and stayed out never bats after the change', () => {
      for (const g of withSubs) {
        const ours = data.atBats.filter((x) => x.gameId === g.id && x.side === 'us');
        for (const sub of g.substitutions!) {
          const stayedOut = !g.lineup.some((s) => s.playerId === sub.outId);
          if (!stayedOut) continue;
          const after = ours.filter((x) => compareClock(x, sub) > 0);
          expect(after.some((x) => x.batterId === sub.outId)).toBe(false);
        }
      }
    });
  });
});

describe('buildDemoData: at-bats', () => {
  it('has 314 of ours and 265 of theirs, every final game with both sides, none for the scheduled game', () => {
    expect(data.atBats.filter((x) => x.side === 'us')).toHaveLength(314);
    expect(data.atBats.filter((x) => x.side === 'them')).toHaveLength(265);
    for (const g of finalGames) {
      const s = sourceOf(g.id);
      expect(data.atBats.filter((x) => x.gameId === g.id)).toHaveLength(s.atBats.length);
      expect(data.atBats.filter((x) => x.gameId === g.id && x.side === 'us').length).toBeGreaterThan(0);
      expect(data.atBats.filter((x) => x.gameId === g.id && x.side === 'them').length).toBeGreaterThan(0);
    }
  });

  it('have ids indexed in dataset order, unique across the document', () => {
    expect(new Set(data.atBats.map((x) => x.id)).size).toBe(data.atBats.length);
    for (const g of finalGames) {
      const mine = data.atBats.filter((x) => x.gameId === g.id);
      mine.forEach((x, i) => expect(x.id).toBe(`${g.id}_ab${i}`));
    }
  });

  it('reference their game, a batter of that game (ours: on the roster; theirs: in the opponent order) and a valid half-inning', () => {
    for (const x of data.atBats) {
      const g = gameById.get(x.gameId);
      expect(g).toBeDefined();
      expect(x.inning).toBeGreaterThanOrEqual(1);
      expect(x.inning).toBeLessThanOrEqual(g!.inning);
      expect(['top', 'bottom']).toContain(x.half);
      // Aug 22 game 2 is "@ Bears Ken 14U" on the schedule but was scored with us batting in the bottom: kept as captured.
      if (g!.id !== 'g_0822_2') expect(whoBats(g!, x.half)).toBe(x.side);
      if (x.side === 'us') {
        expect(playerIds.has(x.batterId)).toBe(true);
        expect(x.pitcherId).toBeUndefined();
      } else {
        expect(g!.opponentLineup.some((b) => b.id === x.batterId)).toBe(true);
        expect(x.pitcherId).toBeDefined();
        expect(playerIds.has(x.pitcherId!)).toBe(true);
      }
    }
  });

  it('every at-bat falls in the half its side bats in (home/away comes from the halves, not the scorer\'s flag)', () => {
    for (const g of finalGames) {
      const mine = data.atBats.filter((x) => x.gameId === g.id);
      expect(mine.filter((x) => whoBats(g, x.half) !== x.side)).toEqual([]);
    }
    // The scorer flagged this one as away, but we batted in the bottom: it is a home game.
    expect(gameById.get('g_0822_2')).toMatchObject({ opponent: 'Bears Ken 14U', isAway: false });
  });

  it('every one of our batters is in the order or was subbed out of it: nobody batted from outside the order', () => {
    for (const g of finalGames) {
      const held = new Set([...g.lineup.map((s) => s.playerId), ...(g.substitutions ?? []).map((sub) => sub.outId)]);
      const outside = data.atBats.filter((x) => x.gameId === g.id && x.side === 'us' && !held.has(x.batterId));
      expect(outside).toEqual([]);
    }
  });

  it('carry the dataset’s batters, outcomes and pitchers one for one', () => {
    for (const g of finalGames) {
      const s = sourceOf(g.id);
      const mine = data.atBats.filter((x) => x.gameId === g.id);
      mine.forEach((x, i) => {
        const src = s.atBats[i];
        expect([x.side, x.inning, x.half, x.outcomeId]).toEqual([src.side, src.inning, src.half, src.outcomeId]);
        if (src.side === 'us') expect(x.batterId).toBe(src.batterId);
        else {
          expect(x.batterId).toBe(g.opponentLineup[src.batter].id);
          expect(x.pitcherId).toBe(src.pitcherId);
        }
      });
    }
  });

  it('result always derives from the outcome, from the batter’s perspective on both sides', () => {
    for (const x of data.atBats) expect(x.result).toBe(getOutcome(x.outcomeId).result);
    expect(data.atBats.some((x) => x.side === 'them' && x.result === 'W')).toBe(true);
    expect(data.atBats.some((x) => x.side === 'them' && x.result === 'L')).toBe(true);
    // The real season mixes typed outcomes and plain ones (a walk without pitch data, an out in play).
    expect(data.atBats.some((x) => isPlain(x.outcomeId) && x.result === 'W')).toBe(true);
    expect(data.atBats.some((x) => isPlain(x.outcomeId) && x.result === 'L')).toBe(true);
    expect(data.atBats.some((x) => x.outcomeId === 'hit')).toBe(true);
    expect(data.atBats.some((x) => x.outcomeId === 'k_looking')).toBe(true);
  });

  it('are recorded at first pitch plus the dataset offset, in order, before the game finished', () => {
    for (const g of finalGames) {
      const s = sourceOf(g.id);
      const mine = data.atBats.filter((x) => x.gameId === g.id);
      mine.forEach((x, i) => expect(at(x.recordedAt)).toBe(at(g.startsAt) + s.atBats[i].offsetS * 1000));
      const times = mine.map((x) => at(x.recordedAt));
      expect(times[0]).toBeGreaterThan(at(g.startsAt));
      expect(times[times.length - 1]).toBeLessThan(at(g.finishedAt!));
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      // The clock never runs backwards either.
      for (let i = 1; i < mine.length; i++) expect(compareClock(mine[i], mine[i - 1])).toBeGreaterThanOrEqual(0);
    }
  });

  it('give Cooper a season hitting score of +19 and Owen Haynes +17', () => {
    expect(hittingFor(data.atBats, 'p_cooper')).toEqual({ w: 25, l: 6 });
    expect(score(hittingFor(data.atBats, 'p_cooper'))).toBe(19);
    expect(hittingFor(data.atBats, 'p_owen_haynes')).toEqual({ w: 24, l: 7 });
    expect(score(hittingFor(data.atBats, 'p_owen_haynes'))).toBe(17);
  });

  it('give every player at least one at-bat and the season its real pitching lines', () => {
    for (const p of data.players) {
      const wl = hittingFor(data.atBats, p.id);
      expect(wl.w + wl.l).toBeGreaterThan(0);
    }
    expect(pitchingFor(data.atBats, 'p_carsyn')).toEqual({ w: 34, l: 23 });
    expect(pitchingFor(data.atBats, 'p_cooper')).toEqual({ w: 39, l: 33 });
    expect(pitchingFor(data.atBats, 'p_hamilton')).toEqual({ w: 0, l: 0 });
  });
});
