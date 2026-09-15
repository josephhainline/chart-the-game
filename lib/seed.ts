import { addDays, addHours, addMinutes, addSeconds, setHours, setMinutes, setSeconds } from 'date-fns';

import type {
  AppData,
  AtBat,
  Game,
  Half,
  Id,
  LineupSlot,
  OpponentBatter,
  OutcomeId,
  Player,
  Substitution,
  Team,
} from './types';
import { compareClock } from './atbats';
import { getOutcome } from './outcomes';
import dataset from './demo/bears-floyd-14u.json';

/**
 * The demo is a real season: Bears Floyd 14U, Aug 15 – Sep 13 2026, charted
 * from the coach's GameChanger captures (see scripts/build-demo-dataset.mjs
 * for where lib/demo/bears-floyd-14u.json comes from). Only the calendar is
 * synthetic: the three real weekends are re-dated relative to `now` so the
 * demo always shows a recent past and an upcoming game.
 */

/** Shape of lib/demo/bears-floyd-14u.json. */
export type DemoDataset = {
  source: string;
  /** `[id, first name, last name, jersey number]`, in roster order. */
  players: [Id, string, string, string][];
  games: DemoGame[];
};

export type DemoGame = {
  /** `aug-15-game-1`, `sep-13-game-2`, … */
  key: string;
  /** Scheduled first pitch, ISO UTC. */
  startsAtUtc: string;
  opponent: string;
  isAway: boolean;
  score: { us: number; them: number };
  innings: number;
  /** The STARTING order, before any substitution. */
  lineup: Id[];
  /** In the order they were made; each replaces `outId`'s slot at the time. */
  subs: DemoSub[];
  /** Opponent batters in order of first appearance, by jersey ('?' when unknown). */
  opponentJerseys: string[];
  atBats: DemoAtBat[];
};

export type DemoSub = { outId: Id; inId: Id; at: { inning: number; half: Half } };

export type DemoAtBat =
  | { side: 'us'; batterId: Id; inning: number; half: Half; outcomeId: OutcomeId; offsetS: number }
  | { side: 'them'; batter: number; inning: number; half: Half; outcomeId: OutcomeId; pitcherId: Id; offsetS: number };

const DATASET: DemoDataset = dataset as DemoDataset;

export const DEMO_TEAM_ID = 't_floyd14u';
export const DEMO_SEASON = 'Fall 2026';
/** The upcoming game, next Saturday at 10:00am. */
export const NEXT_GAME_ID = 'g_next';
export const NEXT_GAME_OPPONENT = 'Bears Ken 14U';

/**
 * The default lineup is the starting order of the first game of the most
 * recent weekend (Sep 12, game 1): Hamilton, Brady, Cooper, Owen Haynes, Gabe,
 * Lucas, Ben, Knox, Carsyn, Weedon. The other five are the bench.
 */
const DEFAULT_LINEUP_FROM = 'sep-12-game-1';

/** The three blank teams that share the My Teams list with the demo team. */
const OTHER_TEAMS: { id: Id; name: string }[] = [
  { id: 't_ken14u', name: 'Bears Ken 14U' },
  { id: 't_engelken14u', name: 'Bears Engelken 14U' },
  { id: 't_floyd17u', name: 'Bears Floyd 17U' },
];

/**
 * Where each real game lands on the demo calendar: the Sep 12/13 weekend is
 * weekOffset 0 (the most recent weekend that is over), Aug 22/23 three weeks
 * before it, Aug 15/16 four. Sunday games sit on that Saturday plus one day.
 */
type Placement = { id: Id; weekOffset: number; day: 'sat' | 'sun' };
const PLACEMENT: Record<string, Placement> = {
  'aug-15-game-1': { id: 'g_0815_1', weekOffset: -4, day: 'sat' },
  'aug-15-game-2': { id: 'g_0815_2', weekOffset: -4, day: 'sat' },
  'aug-16-game-1': { id: 'g_0816_1', weekOffset: -4, day: 'sun' },
  'aug-16-game-2': { id: 'g_0816_2', weekOffset: -4, day: 'sun' },
  'aug-22-game-1': { id: 'g_0822_1', weekOffset: -3, day: 'sat' },
  'aug-22-game-2': { id: 'g_0822_2', weekOffset: -3, day: 'sat' },
  'aug-23-game-1': { id: 'g_0823_1', weekOffset: -3, day: 'sun' },
  'aug-23-game-2': { id: 'g_0823_2', weekOffset: -3, day: 'sun' },
  'aug-23-game-3': { id: 'g_0823_3', weekOffset: -3, day: 'sun' },
  'sep-12-game-1': { id: 'g_0912_1', weekOffset: 0, day: 'sat' },
  'sep-12-game-2': { id: 'g_0912_2', weekOffset: 0, day: 'sat' },
  'sep-13-game-1': { id: 'g_0913_1', weekOffset: 0, day: 'sun' },
  'sep-13-game-2': { id: 'g_0913_2', weekOffset: 0, day: 'sun' },
};

/**
 * The games were played in America/Chicago, which is UTC−5 (CDT) for every
 * date in the dataset, so 21:00Z is a 4:00pm first pitch and 13:00Z 8:00am.
 * The demo keeps that local time of day whatever zone it is viewed in.
 */
const CHICAGO_UTC_OFFSET_HOURS = -5;

function localTimeOfDay(startsAtUtc: string): { hour: number; minute: number } {
  const d = new Date(startsAtUtc);
  return { hour: (d.getUTCHours() + CHICAGO_UTC_OFFSET_HOURS + 24) % 24, minute: d.getUTCMinutes() };
}

function at(now: Date, dayOffset: number, hour: number, minute: number): Date {
  return setSeconds(setMinutes(setHours(addDays(now, dayOffset), hour), minute), 0);
}

/**
 * Youth ball is played on weekends. Past games sit on the most recent weekend
 * that is fully behind us (weekOffset 0 = its Saturday; Sunday games are the
 * day after) and earlier ones; the upcoming game is next Saturday. On a
 * Saturday or a Sunday the seeded finals of the current weekend could still be
 * ahead of `now`, so that weekend never counts as played: weekOffset 0 is last
 * weekend's Saturday and the result is the same all weekend long.
 */
export function saturdayOffset(now: Date, weekOffset: number): number {
  const day = now.getDay(); // 0 = Sunday … 6 = Saturday
  const daysSinceSaturday = (day + 1) % 7; // Sat → 0, Sun → 1, … Fri → 6
  if (weekOffset > 0) {
    const daysUntilNext = 7 - daysSinceSaturday; // always in the future, 1..7
    return daysUntilNext + (weekOffset - 1) * 7;
  }
  const daysSinceLastPlayed = daysSinceSaturday <= 1 ? daysSinceSaturday + 7 : daysSinceSaturday; // always in the past, 2..8
  return -daysSinceLastPlayed + weekOffset * 7;
}

function placementDate(now: Date, placement: Placement, startsAtUtc: string): Date {
  const { hour, minute } = localTimeOfDay(startsAtUtc);
  const dayOffset = saturdayOffset(now, placement.weekOffset) + (placement.day === 'sun' ? 1 : 0);
  return at(now, dayOffset, hour, minute);
}

function defaultOpponentLineup(gameId: Id): OpponentBatter[] {
  return Array.from({ length: 9 }, (_, i) => ({ id: `${gameId}_ob${i}`, name: `Batter ${i + 1}` }));
}

/** One opponent batter per jersey seen in the game, in order of first appearance. */
function opponentLineupFor(gameId: Id, jerseys: string[]): OpponentBatter[] {
  return jerseys.map((jersey, i) => {
    const batter: OpponentBatter = { id: `${gameId}_ob${i}`, name: `Batter ${i + 1}` };
    if (jersey !== '?') batter.number = jersey;
    return batter;
  });
}

/**
 * Seconds after first pitch a substitution was made: the incoming player's
 * first plate appearance from that half-inning on or, when he never batted
 * (subbed out again, or the game ended), the first play after the outgoing
 * player's last one. Only plays after the previous substitution count, so the
 * records keep the order they were made in even when a player re-enters in
 * the same half.
 */
function subOffset(game: DemoGame, sub: DemoSub, afterOffset: number): number {
  const later = game.atBats.filter((x) => x.offsetS > afterOffset && compareClock(x, sub.at) >= 0);
  const own = later.find((x) => x.side === 'us' && x.batterId === sub.inId);
  if (own) return own.offsetS;
  const outLast = later.filter((x) => x.side === 'us' && x.batterId === sub.outId).pop();
  const next = later.find((x) => x.offsetS > (outLast?.offsetS ?? -1));
  if (!next) throw new Error(`seed: no play after ${sub.outId} left ${game.key}`);
  return next.offsetS;
}

function buildGame(now: Date, source: DemoGame, players: Map<Id, Player>): { game: Game; atBats: AtBat[] } {
  const placement = PLACEMENT[source.key];
  if (!placement) throw new Error(`seed: no placement for ${source.key}`);
  const gameId = placement.id;
  const startsAt = placementDate(now, placement, source.startsAtUtc);
  const opponentLineup = opponentLineupFor(gameId, source.opponentJerseys);

  // The starting order with every substitution applied in the order it was made.
  const lineup: LineupSlot[] = source.lineup.map((playerId) => ({ playerId }));
  let lastSubOffset = -1;
  const substitutions: Substitution[] = source.subs.map((sub, i) => {
    const slot = lineup.findIndex((s) => s.playerId === sub.outId);
    if (slot < 0) throw new Error(`seed: ${sub.outId} is not in ${source.key}'s order`);
    if (lineup.some((s) => s.playerId === sub.inId)) throw new Error(`seed: ${sub.inId} is already in ${source.key}'s order`);
    lineup[slot] = { playerId: sub.inId };
    lastSubOffset = subOffset(source, sub, lastSubOffset);
    return {
      id: `${gameId}_sub${i + 1}`,
      slot,
      outId: sub.outId,
      inId: sub.inId,
      inning: sub.at.inning,
      half: sub.at.half,
      at: addSeconds(startsAt, lastSubOffset).toISOString(),
    };
  });

  const atBats: AtBat[] = source.atBats.map((x, i) => {
    const base = {
      id: `${gameId}_ab${i}`,
      gameId,
      inning: x.inning,
      half: x.half,
      outcomeId: x.outcomeId,
      result: getOutcome(x.outcomeId).result,
      recordedAt: addSeconds(startsAt, x.offsetS).toISOString(),
    };
    if (x.side === 'us') {
      if (!players.has(x.batterId)) throw new Error(`seed: unknown batter ${x.batterId} in ${source.key}`);
      return { ...base, side: 'us', batterId: x.batterId };
    }
    const batter = opponentLineup[x.batter];
    if (!batter) throw new Error(`seed: no opponent batter ${x.batter} in ${source.key}`);
    if (!players.has(x.pitcherId)) throw new Error(`seed: unknown pitcher ${x.pitcherId} in ${source.key}`);
    return { ...base, side: 'them', batterId: batter.id, pitcherId: x.pitcherId };
  });

  const lastPitcher = [...atBats].reverse().find((x) => x.side === 'them')?.pitcherId;

  const game: Game = {
    id: gameId,
    teamId: DEMO_TEAM_ID,
    opponent: source.opponent,
    isAway: source.isAway,
    startsAt: startsAt.toISOString(),
    status: 'final',
    lineup,
    opponentLineup,
    pitcherId: lastPitcher,
    inning: source.innings,
    half: 'bottom',
    ourNextBatter: 0,
    theirNextBatter: 0,
    score: { us: source.score.us, them: source.score.them },
    createdAt: addDays(startsAt, -1).toISOString(),
    finishedAt: addHours(startsAt, 2).toISOString(),
  };
  if (substitutions.length > 0) game.substitutions = substitutions;
  return { game, atBats };
}

/**
 * Build the demo document. `now` is injected so tests are stable; the games
 * keep their real content and only move on the calendar.
 */
export function buildDemoData(now: Date = new Date()): AppData {
  const players: Player[] = DATASET.players.map(([id, firstName, lastName, number]) => ({
    id,
    teamId: DEMO_TEAM_ID,
    firstName,
    lastName,
    number,
  }));
  const byId = new Map(players.map((p) => [p.id, p]));

  const lineupSource = DATASET.games.find((g) => g.key === DEFAULT_LINEUP_FROM);
  if (!lineupSource) throw new Error(`seed: no game ${DEFAULT_LINEUP_FROM}`);
  const defaultLineup: LineupSlot[] = lineupSource.lineup.map((playerId) => ({ playerId }));

  // Teams were set up the week before the first games, a minute apart so the list order is stable.
  const teamsCreated = at(now, saturdayOffset(now, -4) - 7, 18, 0);
  const teams: Team[] = [
    { id: DEMO_TEAM_ID, name: 'Bears Floyd 14U', season: DEMO_SEASON, defaultLineup, createdAt: teamsCreated.toISOString() },
    ...OTHER_TEAMS.map((t, i) => ({
      id: t.id,
      name: t.name,
      season: DEMO_SEASON,
      defaultLineup: [],
      createdAt: addMinutes(teamsCreated, i + 1).toISOString(),
    })),
  ];

  const games: Game[] = [];
  const atBats: AtBat[] = [];
  for (const source of DATASET.games) {
    const built = buildGame(now, source, byId);
    games.push(built.game);
    atBats.push(...built.atBats);
  }

  const nextStartsAt = at(now, saturdayOffset(now, 1), 10, 0);
  games.push({
    id: NEXT_GAME_ID,
    teamId: DEMO_TEAM_ID,
    opponent: NEXT_GAME_OPPONENT,
    isAway: false,
    startsAt: nextStartsAt.toISOString(),
    status: 'scheduled',
    lineup: defaultLineup.map((slot) => ({ ...slot })),
    opponentLineup: defaultOpponentLineup(NEXT_GAME_ID),
    inning: 1,
    half: 'top',
    ourNextBatter: 0,
    theirNextBatter: 0,
    score: { us: 0, them: 0 },
    createdAt: addDays(nextStartsAt, -1).toISOString(),
  });

  return { version: 1, onboarded: false, teams, players, games, atBats };
}
