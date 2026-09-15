import { describe, expect, it } from '@jest/globals';

import { isPlain, outcomeShort } from '../outcomes';
import { buildDemoData } from '../seed';
import {
  REMOVED_ROW_ID,
  ZERO,
  addResult,
  gameHitting,
  gamePitching,
  hittingFor,
  leftGameBatterIds,
  pitcherResult,
  pitchingFor,
  rankByHitting,
  scorebook,
  score,
  seasonTable,
  totals,
} from '../stats';
import type { AtBat, Game, Half, Id, Player, Result, Side, Team } from '../types';

let seq = 0;

/** Minimal at-bat factory: everything not given defaults to a sensible 'us' at-bat in the 1st. */
function ab(over: Partial<AtBat> & { batterId: Id; result: Result }): AtBat {
  seq += 1;
  return {
    id: `ab${seq}`,
    gameId: 'g1',
    side: 'us',
    inning: 1,
    half: 'top',
    outcomeId: over.result === 'W' ? 'hit' : 'k_swinging',
    recordedAt: '2026-09-07T14:00:00.000Z',
    ...over,
  };
}

function player(id: Id, teamId: Id, firstName: string, lastName: string): Player {
  return { id, teamId, firstName, lastName };
}

function game(id: Id, teamId: Id): Game {
  return {
    id,
    teamId,
    opponent: 'X',
    isAway: true,
    startsAt: '2026-09-07T14:00:00.000Z',
    status: 'final',
    lineup: [],
    opponentLineup: [],
    inning: 1,
    half: 'top',
    ourNextBatter: 0,
    theirNextBatter: 0,
    score: { us: 0, them: 0 },
    createdAt: '2026-09-01T14:00:00.000Z',
  };
}

describe('score / addResult / pitcherResult', () => {
  it('score is W minus L', () => {
    expect(score({ w: 5, l: 2 })).toBe(3);
    expect(score({ w: 2, l: 5 })).toBe(-3);
    expect(score(ZERO)).toBe(0);
  });

  it('addResult returns a new record without mutating the input', () => {
    const start = { w: 1, l: 1 };
    expect(addResult(start, true)).toEqual({ w: 2, l: 1 });
    expect(addResult(start, false)).toEqual({ w: 1, l: 2 });
    expect(start).toEqual({ w: 1, l: 1 });
    expect(ZERO).toEqual({ w: 0, l: 0 });
  });

  it('pitcherResult is the inverse of the batter result', () => {
    expect(pitcherResult(ab({ batterId: 'b', result: 'W' }))).toBe('L');
    expect(pitcherResult(ab({ batterId: 'b', result: 'L' }))).toBe('W');
  });
});

describe('hittingFor', () => {
  const atBats: AtBat[] = [
    ab({ batterId: 'p1', result: 'W' }),
    ab({ batterId: 'p1', result: 'L' }),
    ab({ batterId: 'p1', result: 'W', gameId: 'g2' }),
    ab({ batterId: 'p2', result: 'W' }),
    // An opposing batter whose id happens to collide must not count as our hitting.
    ab({ batterId: 'p1', result: 'W', side: 'them', pitcherId: 'p2' }),
  ];

  it('counts only our at-bats for that batter across all games', () => {
    expect(hittingFor(atBats, 'p1')).toEqual({ w: 2, l: 1 });
    expect(hittingFor(atBats, 'p2')).toEqual({ w: 1, l: 0 });
  });

  it('limits to one game when a gameId is given', () => {
    expect(hittingFor(atBats, 'p1', 'g1')).toEqual({ w: 1, l: 1 });
    expect(hittingFor(atBats, 'p1', 'g2')).toEqual({ w: 1, l: 0 });
    expect(hittingFor(atBats, 'p1', 'nope')).toEqual(ZERO);
  });

  it('is zero for a player with no at-bats', () => {
    expect(hittingFor(atBats, 'p99')).toEqual(ZERO);
    expect(hittingFor([], 'p1')).toEqual(ZERO);
  });
});

describe('pitchingFor', () => {
  const atBats: AtBat[] = [
    // Their batter lost -> our pitcher won.
    ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p1' }),
    ab({ batterId: 'ob2', result: 'L', side: 'them', pitcherId: 'p1' }),
    // Their batter won -> our pitcher lost.
    ab({ batterId: 'ob3', result: 'W', side: 'them', pitcherId: 'p1' }),
    ab({ batterId: 'ob1', result: 'W', side: 'them', pitcherId: 'p1', gameId: 'g2' }),
    ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p2' }),
    // Our own at-bat with a stray pitcherId must never count as pitching.
    ab({ batterId: 'p1', result: 'L', side: 'us', pitcherId: 'p1' }),
  ];

  it('inverts the batter result: batter L is pitcher W', () => {
    expect(pitchingFor(atBats, 'p1')).toEqual({ w: 2, l: 2 });
    expect(pitchingFor(atBats, 'p2')).toEqual({ w: 1, l: 0 });
  });

  it('limits to one game when a gameId is given', () => {
    expect(pitchingFor(atBats, 'p1', 'g1')).toEqual({ w: 2, l: 1 });
    expect(pitchingFor(atBats, 'p1', 'g2')).toEqual({ w: 0, l: 1 });
  });

  it('ignores at-bats where the player was not the pitcher', () => {
    expect(pitchingFor(atBats, 'ob1')).toEqual(ZERO);
    expect(pitchingFor(atBats, 'p99')).toEqual(ZERO);
  });
});

describe('gameHitting / gamePitching', () => {
  const atBats: AtBat[] = [
    ab({ batterId: 'p1', result: 'W' }),
    ab({ batterId: 'p2', result: 'L' }),
    ab({ batterId: 'p3', result: 'W' }),
    ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p1' }),
    ab({ batterId: 'ob2', result: 'W', side: 'them', pitcherId: 'p1' }),
    ab({ batterId: 'ob3', result: 'L', side: 'them', pitcherId: 'p9' }),
    ab({ batterId: 'p1', result: 'L', gameId: 'g2' }),
    ab({ batterId: 'ob1', result: 'W', side: 'them', pitcherId: 'p1', gameId: 'g2' }),
  ];

  it('gameHitting totals every at-bat where we batted in that game', () => {
    expect(gameHitting(atBats, 'g1')).toEqual({ w: 2, l: 1 });
    expect(gameHitting(atBats, 'g2')).toEqual({ w: 0, l: 1 });
    expect(gameHitting(atBats, 'g3')).toEqual(ZERO);
  });

  it('gamePitching totals their at-bats from the pitcher perspective regardless of who pitched', () => {
    expect(gamePitching(atBats, 'g1')).toEqual({ w: 2, l: 1 });
    expect(gamePitching(atBats, 'g2')).toEqual({ w: 0, l: 1 });
    expect(gamePitching(atBats, 'g3')).toEqual(ZERO);
  });
});

describe('seasonTable', () => {
  const team: Team = {
    id: 't1',
    name: 'Bears',
    season: '2026',
    // Only two of the five roster players are in the default lineup; 'ghost' is not on the roster.
    defaultLineup: [{ playerId: 'p_zed', position: 'P' }, { playerId: 'ghost' }, { playerId: 'p_mia' }, { playerId: 'p_zed' }],
    createdAt: '2026-06-01T00:00:00.000Z',
  };
  const players: Player[] = [
    player('p_amy', 't1', 'Amy', 'Young'),
    player('p_bob', 't1', 'Bob', 'Adams'),
    player('p_mia', 't1', 'Mia', 'Kent'),
    player('p_zed', 't1', 'Zed', 'Baker'),
    player('p_cal', 't1', 'Cal', 'Adams'),
    player('p_other', 't2', 'Other', 'Team'),
  ];
  const games: Game[] = [game('g1', 't1'), game('g2', 't1'), game('g_other', 't2')];
  const atBats: AtBat[] = [
    ab({ batterId: 'p_zed', result: 'W' }),
    ab({ batterId: 'p_zed', result: 'W', gameId: 'g2' }),
    ab({ batterId: 'p_zed', result: 'L', gameId: 'g2' }),
    ab({ batterId: 'p_mia', result: 'L' }),
    ab({ batterId: 'p_mia', result: 'L' }),
    ab({ batterId: 'p_bob', result: 'W' }),
    ab({ batterId: 'p_bob', result: 'L' }),
    // Belongs to another team's game: must not count even though the batter id matches.
    ab({ batterId: 'p_amy', result: 'W', gameId: 'g_other' }),
    ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p_zed' }),
    ab({ batterId: 'ob2', result: 'L', side: 'them', pitcherId: 'p_zed', gameId: 'g2' }),
    ab({ batterId: 'ob3', result: 'W', side: 'them', pitcherId: 'p_amy' }),
    ab({ batterId: 'ob4', result: 'L', side: 'them', pitcherId: 'p_amy', gameId: 'g_other' }),
  ];

  it('orders the default lineup first (deduped, skipping unknown ids), then the rest by last name', () => {
    const rows = seasonTable(team, players, games, atBats, 'hitting');
    expect(rows.map((r) => r.player.id)).toEqual(['p_zed', 'p_mia', 'p_bob', 'p_cal', 'p_amy']);
  });

  it('excludes players from other teams', () => {
    const rows = seasonTable(team, players, games, atBats, 'hitting');
    expect(rows.some((r) => r.player.id === 'p_other')).toBe(false);
  });

  it('hitting mode: W/L per player, score null when there is no data', () => {
    const rows = seasonTable(team, players, games, atBats, 'hitting');
    const byId = Object.fromEntries(rows.map((r) => [r.player.id, r]));
    expect(byId.p_zed.wl).toEqual({ w: 2, l: 1 });
    expect(byId.p_zed.score).toBe(1);
    expect(byId.p_mia.wl).toEqual({ w: 0, l: 2 });
    expect(byId.p_mia.score).toBe(-2);
    expect(byId.p_bob.wl).toEqual({ w: 1, l: 1 });
    expect(byId.p_bob.score).toBe(0);
    expect(byId.p_cal.wl).toEqual(ZERO);
    expect(byId.p_cal.score).toBeNull();
    // Amy's only at-bat was in another team's game.
    expect(byId.p_amy.wl).toEqual(ZERO);
    expect(byId.p_amy.score).toBeNull();
  });

  it('pitching mode: uses the pitcher perspective and only this team’s games', () => {
    const rows = seasonTable(team, players, games, atBats, 'pitching');
    const byId = Object.fromEntries(rows.map((r) => [r.player.id, r]));
    expect(byId.p_zed.wl).toEqual({ w: 2, l: 0 });
    expect(byId.p_zed.score).toBe(2);
    expect(byId.p_amy.wl).toEqual({ w: 0, l: 1 });
    expect(byId.p_amy.score).toBe(-1);
    expect(byId.p_mia.score).toBeNull();
  });

  it('totals sums every row', () => {
    const hitting = seasonTable(team, players, games, atBats, 'hitting');
    expect(totals(hitting)).toEqual({ w: 3, l: 4 });
    const pitching = seasonTable(team, players, games, atBats, 'pitching');
    expect(totals(pitching)).toEqual({ w: 2, l: 1 });
    expect(totals([])).toEqual(ZERO);
  });

  it('adds no synthetic row while every at-bat belongs to a roster player', () => {
    for (const mode of ['hitting', 'pitching'] as const) {
      const rows = seasonTable(team, players, games, atBats, mode);
      expect(rows.some((r) => r.removed)).toBe(false);
      expect(rows.some((r) => r.player.id === REMOVED_ROW_ID)).toBe(false);
    }
  });

  describe('"Removed players" row', () => {
    // Bob left the team: his two at-bats no longer have a roster row.
    const withoutBob = players.filter((p) => p.id !== 'p_bob');

    it('hitting: aggregates the at-bats of batters no longer on the roster, last in the table', () => {
      const rows = seasonTable(team, withoutBob, games, atBats, 'hitting');
      expect(rows.map((r) => r.player.id)).toEqual(['p_zed', 'p_mia', 'p_cal', 'p_amy', REMOVED_ROW_ID]);
      const last = rows[rows.length - 1];
      expect(last).toMatchObject({ removed: true, wl: { w: 1, l: 1 }, score: 0 });
      expect(last.player).toMatchObject({ teamId: 't1', firstName: 'Removed', lastName: 'players' });
      expect(rows.slice(0, -1).every((r) => !r.removed)).toBe(true);
      // The table still adds up to the game lines.
      expect(totals(rows)).toEqual({ w: 3, l: 4 });
    });

    it('pitching: aggregates removed pitchers and at-bats charted with no pitcher', () => {
      const withoutAmy = players.filter((p) => p.id !== 'p_amy');
      const orphaned = [
        ...atBats,
        // Charted while no pitcher was set.
        ab({ batterId: 'ob9', result: 'L', side: 'them' }),
        ab({ batterId: 'ob9', result: 'L', side: 'them', gameId: 'g2' }),
        // Other team's game: never counted.
        ab({ batterId: 'ob9', result: 'W', side: 'them', gameId: 'g_other' }),
      ];
      const rows = seasonTable(team, withoutAmy, games, orphaned, 'pitching');
      const last = rows[rows.length - 1];
      expect(last.player.id).toBe(REMOVED_ROW_ID);
      // Amy's L (batter W) + two batter Ls with no pitcher = 2W 1L from the pitcher's side.
      expect(last).toMatchObject({ removed: true, wl: { w: 2, l: 1 }, score: 1 });
      expect(rows.some((r) => r.player.id === 'p_amy')).toBe(false);
      const sum = games.filter((g) => g.teamId === 't1').map((g) => gamePitching(orphaned, g.id)).reduce((a, b) => ({ w: a.w + b.w, l: a.l + b.l }), ZERO);
      expect(totals(rows)).toEqual(sum);
    });

    it('only counts at-bats from this team’s games', () => {
      // Amy's removed-batter hitting at-bat is in another team's game: no row.
      const rows = seasonTable(team, players.filter((p) => p.id !== 'p_amy'), games, atBats, 'hitting');
      expect(rows.some((r) => r.removed)).toBe(false);
    });
  });
});

describe('scorebook', () => {
  const order = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const atBats: AtBat[] = [
    ab({ batterId: 'p1', result: 'W', inning: 1 }),
    ab({ batterId: 'p2', result: 'L', inning: 1 }),
    ab({ batterId: 'p3', result: 'W', inning: 2 }),
    ab({ batterId: 'p1', result: 'L', inning: 3 }),
    // Same batter twice in one inning (batted around).
    ab({ batterId: 'p2', result: 'W', inning: 3 }),
    ab({ batterId: 'p2', result: 'W', inning: 3 }),
    // Not in the order any more.
    ab({ batterId: 'p_gone', result: 'W', inning: 2 }),
    // Other side / other game must be ignored.
    ab({ batterId: 'p1', result: 'W', inning: 5, side: 'them', pitcherId: 'p3' }),
    ab({ batterId: 'p1', result: 'W', inning: 7, gameId: 'g2' }),
  ];

  it('spans innings 1..max inning seen for that game and side', () => {
    const { innings } = scorebook(atBats, 'g1', 'us', order);
    expect(innings).toEqual([1, 2, 3]);
  });

  it('pads to minInnings when the game has fewer innings', () => {
    expect(scorebook(atBats, 'g1', 'us', order, 5).innings).toEqual([1, 2, 3, 4, 5]);
    expect(scorebook([], 'g1', 'us', order).innings).toEqual([1]);
    expect(scorebook([], 'g1', 'us', order, 6).innings).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('does not truncate when minInnings is smaller than the innings played', () => {
    expect(scorebook(atBats, 'g1', 'us', order, 2).innings).toEqual([1, 2, 3]);
  });

  it('keeps rows in batting order with per-inning cells and a W/L total', () => {
    const { rows } = scorebook(atBats, 'g1', 'us', order);
    expect(rows.map((r) => r.batter.id)).toEqual(['p1', 'p2', 'p3']);
    expect(rows[0].innings.map((cell) => cell.map((x) => x.result))).toEqual([['W'], [], ['L']]);
    expect(rows[0].wl).toEqual({ w: 1, l: 1 });
    expect(rows[1].innings.map((cell) => cell.map((x) => x.result))).toEqual([['L'], [], ['W', 'W']]);
    expect(rows[1].wl).toEqual({ w: 2, l: 1 });
    expect(rows[2].innings.map((cell) => cell.length)).toEqual([0, 1, 0]);
    expect(rows[2].wl).toEqual({ w: 1, l: 0 });
  });

  it('orders a batted-around cell by the clock, not by document order (a restored at-bat is appended)', () => {
    const k = ab({ batterId: 'p1', result: 'L', inning: 1, recordedAt: '2026-09-07T14:05:00.000Z' });
    const hit = ab({ batterId: 'p1', result: 'W', inning: 1, recordedAt: '2026-09-07T14:09:00.000Z' });
    const { rows } = scorebook([hit, k], 'g1', 'us', order);
    expect(rows[0].innings[0].map((x) => x.id)).toEqual([k.id, hit.id]);
    // A backfill stamped into the top sits before a live bottom-half at-bat, whatever the array order.
    const bottom = ab({ batterId: 'p1', result: 'W', inning: 1, half: 'bottom', recordedAt: '2026-09-07T14:20:00.000Z' });
    const backfill = ab({ batterId: 'p1', result: 'L', inning: 1, half: 'top', recordedAt: '2026-09-07T14:40:00.000Z' });
    const mixed = scorebook([bottom, backfill], 'g1', 'us', order);
    expect(mixed.rows[0].innings[0].map((x) => x.id)).toEqual([backfill.id, bottom.id]);
  });

  it('gives every batter a full row of empty cells when nothing was recorded', () => {
    const { rows } = scorebook([], 'g1', 'us', order, 3);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.innings).toEqual([[], [], []]);
      expect(row.wl).toEqual(ZERO);
    }
  });

  it('ignores at-bats by batters who are not in the given order (no crash, no row)', () => {
    // NOTE: the doc comment on scorebook() says such batters are "appended", but the
    // function is generic over the batter type and cannot construct one, so they are
    // dropped. Callers that want them shown must include them in `batters` themselves.
    const { rows } = scorebook(atBats, 'g1', 'us', order);
    expect(rows.some((r) => r.batter.id === 'p_gone')).toBe(false);
    expect(rows).toHaveLength(3);
  });

  it('with an empty batting order returns innings but no rows', () => {
    const { innings, rows } = scorebook(atBats, 'g1', 'us', []);
    expect(innings).toEqual([1, 2, 3]);
    expect(rows).toEqual([]);
  });

  it('for side "them" the row totals are from our pitcher’s perspective', () => {
    const theirs = [{ id: 'ob1' }, { id: 'ob2' }];
    const theirAtBats: AtBat[] = [
      ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p1', inning: 1 }),
      ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'p1', inning: 2 }),
      ab({ batterId: 'ob2', result: 'W', side: 'them', pitcherId: 'p1', inning: 1 }),
      ab({ batterId: 'p1', result: 'W', side: 'us', inning: 4 }),
    ];
    const { innings, rows } = scorebook(theirAtBats, 'g1', 'them', theirs);
    // Our 4th-inning at-bat is the other side, so it does not extend the grid.
    expect(innings).toEqual([1, 2]);
    expect(rows[0].wl).toEqual({ w: 2, l: 0 });
    expect(rows[1].wl).toEqual({ w: 0, l: 1 });
    // Cells still hold the raw at-bats (batter perspective) so the UI can invert the letter.
    expect(rows[0].innings[0][0].result).toBe('L');
  });
});

describe('leftGameBatterIds', () => {
  const order = ['p1', 'p2', 'p3'];
  const atBats: AtBat[] = [
    // Array order is deliberately not game order: p_late's first at-bat is the earliest on the clock.
    ab({ batterId: 'p_gone', result: 'W', inning: 2, recordedAt: '2026-09-07T14:20:00.000Z' }),
    ab({ batterId: 'p1', result: 'W', inning: 1, recordedAt: '2026-09-07T14:00:00.000Z' }),
    ab({ batterId: 'p_late', result: 'L', inning: 3, recordedAt: '2026-09-07T14:40:00.000Z' }),
    ab({ batterId: 'p_late', result: 'W', inning: 1, recordedAt: '2026-09-07T14:05:00.000Z' }),
    ab({ batterId: 'p_gone', result: 'L', inning: 4, recordedAt: '2026-09-07T14:50:00.000Z' }),
    // Other side and other game: never listed.
    ab({ batterId: 'ob_x', result: 'L', side: 'them', pitcherId: 'p1', inning: 1 }),
    ab({ batterId: 'p_other_game', result: 'W', gameId: 'g2', inning: 1 }),
  ];

  it('lists batters with at-bats who are not in the order, once each, by their first at-bat on the clock', () => {
    expect(leftGameBatterIds(atBats, 'g1', 'us', order)).toEqual(['p_late', 'p_gone']);
  });

  it('is empty when everyone with an at-bat is still in the order', () => {
    expect(leftGameBatterIds(atBats, 'g1', 'us', [...order, 'p_gone', 'p_late'])).toEqual([]);
    expect(leftGameBatterIds([], 'g1', 'us', order)).toEqual([]);
  });

  it('only looks at the given game and side', () => {
    expect(leftGameBatterIds(atBats, 'g1', 'them', [])).toEqual(['ob_x']);
    expect(leftGameBatterIds(atBats, 'g1', 'them', ['ob_x'])).toEqual([]);
    expect(leftGameBatterIds(atBats, 'g2', 'us', [])).toEqual(['p_other_game']);
  });

  it('with an empty order every batter who hit is listed, in clock order', () => {
    expect(leftGameBatterIds(atBats, 'g1', 'us', [])).toEqual(['p1', 'p_late', 'p_gone']);
  });
});

describe('plain at-bats (no play type) in the totals', () => {
  const atBats: AtBat[] = [
    ab({ batterId: 'p1', result: 'W', outcomeId: 'plain_w', inning: 1 }),
    ab({ batterId: 'p1', result: 'L', outcomeId: 'plain_l', inning: 2 }),
    ab({ batterId: 'p1', result: 'W', outcomeId: 'hit', inning: 3 }),
    ab({ batterId: 'ob1', result: 'L', outcomeId: 'plain_l', side: 'them', pitcherId: 'p1', inning: 1 }),
    ab({ batterId: 'ob2', result: 'W', outcomeId: 'plain_w', side: 'them', pitcherId: 'p1', inning: 1 }),
    ab({ batterId: 'ob3', result: 'L', outcomeId: 'k_swinging', side: 'them', pitcherId: 'p1', inning: 2 }),
  ];

  it('count exactly like typed ones in hitting and pitching', () => {
    expect(hittingFor(atBats, 'p1')).toEqual({ w: 2, l: 1 });
    expect(gameHitting(atBats, 'g1')).toEqual({ w: 2, l: 1 });
    expect(pitchingFor(atBats, 'p1')).toEqual({ w: 2, l: 1 });
    expect(gamePitching(atBats, 'g1')).toEqual({ w: 2, l: 1 });
  });

  it('appear in the scorebook cells with a blank code', () => {
    const ours = scorebook(atBats, 'g1', 'us', [{ id: 'p1' }]);
    expect(ours.rows[0].innings.map((cell) => cell.map((x) => [x.result, outcomeShort(x.outcomeId)]))).toEqual([
      [['W', '']],
      [['L', '']],
      [['W', 'H']],
    ]);
    expect(ours.rows[0].wl).toEqual({ w: 2, l: 1 });
    const theirs = scorebook(atBats, 'g1', 'them', [{ id: 'ob1' }, { id: 'ob2' }, { id: 'ob3' }]);
    expect(theirs.rows.map((r) => r.wl)).toEqual([{ w: 1, l: 0 }, { w: 0, l: 1 }, { w: 1, l: 0 }]);
    expect(outcomeShort(theirs.rows[0].innings[0][0].outcomeId)).toBe('');
  });

  it('roll into the season table and rank like any other at-bat', () => {
    const team: Team = { id: 't1', name: 'Bears', season: '2026', defaultLineup: [{ playerId: 'p1' }], createdAt: '2026-06-01T00:00:00.000Z' };
    const players = [player('p1', 't1', 'Pat', 'One')];
    const games = [game('g1', 't1')];
    const hitting = seasonTable(team, players, games, atBats, 'hitting');
    expect(hitting[0]).toMatchObject({ wl: { w: 2, l: 1 }, score: 1 });
    const pitching = seasonTable(team, players, games, atBats, 'pitching');
    expect(pitching[0]).toMatchObject({ wl: { w: 2, l: 1 }, score: 1 });
    expect(rankByHitting(['p1', 'p2'], atBats, new Set(['g1']))).toEqual(['p1', 'p2']);
  });
});

describe('rankByHitting', () => {
  const gameIds = new Set<Id>(['g1', 'g2']);
  const atBats: AtBat[] = [
    ab({ batterId: 'a', result: 'W' }),
    ab({ batterId: 'a', result: 'W' }),
    ab({ batterId: 'a', result: 'L' }), // a = +1
    ab({ batterId: 'b', result: 'W', gameId: 'g2' }),
    ab({ batterId: 'b', result: 'W', gameId: 'g2' }), // b = +2
    ab({ batterId: 'c', result: 'L' }),
    ab({ batterId: 'c', result: 'L' }), // c = -2
    ab({ batterId: 'd', result: 'W' }),
    ab({ batterId: 'd', result: 'L' }), // d = 0
    // e has 1 W in a game that is not in the set: should count as 0.
    ab({ batterId: 'e', result: 'W', gameId: 'g_other' }),
    ab({ batterId: 'e', result: 'W', gameId: 'g_other' }),
    // Pitching results for 'c' must not affect hitting rank.
    ab({ batterId: 'ob1', result: 'L', side: 'them', pitcherId: 'c' }),
    ab({ batterId: 'ob2', result: 'L', side: 'them', pitcherId: 'c' }),
    ab({ batterId: 'ob3', result: 'L', side: 'them', pitcherId: 'c' }),
  ];

  it('orders best score first', () => {
    expect(rankByHitting(['a', 'b', 'c', 'd'], atBats, gameIds)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('keeps the given order for ties (stable), including players with no data', () => {
    // d (0), e (0 within the set), f (no at-bats) all tie at 0 and keep their input order.
    expect(rankByHitting(['f', 'd', 'e'], atBats, gameIds)).toEqual(['f', 'd', 'e']);
    expect(rankByHitting(['e', 'f', 'd'], atBats, gameIds)).toEqual(['e', 'f', 'd']);
    expect(rankByHitting(['c', 'f', 'd', 'a'], atBats, gameIds)).toEqual(['a', 'f', 'd', 'c']);
  });

  it('only counts games in the given set', () => {
    expect(rankByHitting(['a', 'e'], atBats, new Set(['g_other']))).toEqual(['e', 'a']);
    expect(rankByHitting(['a', 'b'], atBats, new Set(['g1']))).toEqual(['a', 'b']);
  });

  it('does not mutate the input and returns the same ids', () => {
    const ids = ['c', 'a', 'b'];
    const ranked = rankByHitting(ids, atBats, gameIds);
    expect(ids).toEqual(['c', 'a', 'b']);
    expect([...ranked].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('with the demo data', () => {
  const data = buildDemoData(new Date('2026-09-14T12:00:00'));
  const team = data.teams[0];
  const weBat = (g: Game, half: Half): Side => ((g.isAway ? half === 'top' : half === 'bottom') ? 'us' : 'them');

  it('season hitting totals equal the sum of every game’s hitting line', () => {
    const rows = seasonTable(team, data.players, data.games, data.atBats, 'hitting');
    const sum = data.games.map((g) => gameHitting(data.atBats, g.id)).reduce((a, b) => ({ w: a.w + b.w, l: a.l + b.l }), ZERO);
    expect(totals(rows)).toEqual(sum);
    expect(sum.w + sum.l).toBe(data.atBats.filter((x) => x.side === 'us').length);
  });

  it('season pitching totals equal the sum of every game’s pitching line', () => {
    const rows = seasonTable(team, data.players, data.games, data.atBats, 'pitching');
    const sum = data.games.map((g) => gamePitching(data.atBats, g.id)).reduce((a, b) => ({ w: a.w + b.w, l: a.l + b.l }), ZERO);
    expect(totals(rows)).toEqual(sum);
    expect(sum.w + sum.l).toBe(data.atBats.filter((x) => x.side === 'them').length);
  });

  it('table rows follow the default lineup order', () => {
    const rows = seasonTable(team, data.players, data.games, data.atBats, 'hitting');
    expect(rows.map((r) => r.player.id)).toEqual(team.defaultLineup.map((s) => s.playerId));
  });

  describe('after a player with at-bats is removed from the roster', () => {
    const sumOf = (wls: { w: number; l: number }[]) => wls.reduce((a, b) => ({ w: a.w + b.w, l: a.l + b.l }), ZERO);
    /** Mimic the store's removePlayer: gone from the roster and the default lineup, at-bats kept. */
    const without = (id: string) => ({
      players: data.players.filter((p) => p.id !== id),
      team: { ...team, defaultLineup: team.defaultLineup.filter((s) => s.playerId !== id) },
    });

    it('season hitting totals still equal the sum of every game’s hitting line', () => {
      const { players, team: t } = without('p_owen');
      const rows = seasonTable(t, players, data.games, data.atBats, 'hitting');
      expect(totals(rows)).toEqual(sumOf(data.games.map((g) => gameHitting(data.atBats, g.id))));
      const last = rows[rows.length - 1];
      expect(last.removed).toBe(true);
      expect(last.wl).toEqual(hittingFor(data.atBats, 'p_owen'));
      expect(rows.filter((r) => r.removed)).toHaveLength(1);
      expect(rows.some((r) => r.player.id === 'p_owen')).toBe(false);
    });

    it('season pitching totals still equal the sum of every game’s pitching line', () => {
      const { players, team: t } = without('p_weedon');
      const rows = seasonTable(t, players, data.games, data.atBats, 'pitching');
      expect(totals(rows)).toEqual(sumOf(data.games.map((g) => gamePitching(data.atBats, g.id))));
      const last = rows[rows.length - 1];
      expect(last.removed).toBe(true);
      expect(last.wl).toEqual(pitchingFor(data.atBats, 'p_weedon'));
    });

    it('two removed players share the one synthetic row', () => {
      const players = data.players.filter((p) => p.id !== 'p_owen' && p.id !== 'p_knox');
      const rows = seasonTable(team, players, data.games, data.atBats, 'hitting');
      expect(rows.filter((r) => r.removed)).toHaveLength(1);
      const expected = sumOf([hittingFor(data.atBats, 'p_owen'), hittingFor(data.atBats, 'p_knox')]);
      expect(rows[rows.length - 1].wl).toEqual(expected);
      expect(totals(rows)).toEqual(sumOf(data.games.map((g) => gameHitting(data.atBats, g.id))));
    });
  });

  it('the scorebook for a final game covers every inning and every at-bat', () => {
    for (const g of data.games.filter((x) => x.status === 'final')) {
      const ours = scorebook(data.atBats, g.id, 'us', g.lineup.map((s) => ({ id: s.playerId })));
      const theirs = scorebook(data.atBats, g.id, 'them', g.opponentLineup);
      const cells = (rows: { innings: AtBat[][] }[]) => rows.flatMap((r) => r.innings.flat());
      expect(cells(ours.rows)).toHaveLength(data.atBats.filter((x) => x.gameId === g.id && x.side === 'us').length);
      expect(cells(theirs.rows)).toHaveLength(data.atBats.filter((x) => x.gameId === g.id && x.side === 'them').length);
      expect(Math.max(ours.innings.length, theirs.innings.length)).toBe(g.inning);
      for (const x of cells(ours.rows)) expect(weBat(g, x.half)).toBe('us');
      for (const x of cells(theirs.rows)) expect(weBat(g, x.half)).toBe('them');
    }
  });

  it('rankByHitting agrees with the season table scores', () => {
    const ids = team.defaultLineup.map((s) => s.playerId);
    const gameIds = new Set(data.games.map((g) => g.id));
    const ranked = rankByHitting(ids, data.atBats, gameIds);
    const scores = ranked.map((id) => score(hittingFor(data.atBats, id)));
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    expect(ranked).toHaveLength(ids.length);
  });

  it('the demo’s plain at-bats are counted in the game lines exactly like the typed ones', () => {
    const plain = data.atBats.filter((x) => isPlain(x.outcomeId));
    expect(plain.length).toBeGreaterThan(0);
    const typedOnly = data.atBats.filter((x) => !isPlain(x.outcomeId));
    for (const g of data.games) {
      const all = gameHitting(data.atBats, g.id);
      const typed = gameHitting(typedOnly, g.id);
      const ours = plain.filter((x) => x.gameId === g.id && x.side === 'us');
      expect(all).toEqual({ w: typed.w + ours.filter((x) => x.result === 'W').length, l: typed.l + ours.filter((x) => x.result === 'L').length });
    }
  });

  it('nobody has left the order in the demo games, so no LEFT GAME rows are needed', () => {
    for (const g of data.games) {
      expect(leftGameBatterIds(data.atBats, g.id, 'us', g.lineup.map((s) => s.playerId))).toEqual([]);
      expect(leftGameBatterIds(data.atBats, g.id, 'them', g.opponentLineup.map((b) => b.id))).toEqual([]);
    }
  });
});

describe('outcome catalog', () => {
  it('every outcome has a stable id, a label and a non-empty scorebook code', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OUTCOMES } = require('../outcomes') as typeof import('../outcomes');
    expect(OUTCOMES).toHaveLength(12);
    for (const o of OUTCOMES) {
      expect(o.id).toMatch(/^[a-z_0-9]+$/);
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.short.length).toBeGreaterThan(0);
      // Lato has no glyph for the mirrored K some scorebooks use.
      expect(o.short).toMatch(/^[A-Z0-9()+-]+$/);
    }
  });
});
