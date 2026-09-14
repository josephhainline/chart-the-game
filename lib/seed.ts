import { addDays, setHours, setMinutes, setSeconds, addMinutes } from 'date-fns';

import type { AppData, AtBat, Game, Id, LineupSlot, OpponentBatter, OutcomeId, Player, Team } from './types';
import { LOSS_OUTCOMES, WIN_OUTCOMES } from './outcomes';

/** Deterministic PRNG so the demo looks the same on every reset. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_TEAM_ID = 't_bears12u';

type SeedPlayer = {
  id: Id;
  first: string;
  last: string;
  number?: string;
  position: LineupSlot['position'];
  /** Probability this batter wins an at-bat. */
  hit: number;
  /** Probability this pitcher wins an at-bat. */
  pitch: number;
  /** Only appears in the last N games (a late roster addition). */
  lastGamesOnly?: number;
};

const ROSTER: SeedPlayer[] = [
  { id: 'p_owen', first: 'Owen', last: 'Haynes', number: '7', position: 'CF', hit: 0.62, pitch: 0.7 },
  { id: 'p_ryder', first: 'Ryder', last: 'Braddy', number: '42', position: '3B', hit: 0.66, pitch: 0.5 },
  { id: 'p_lucas', first: 'Lucas', last: 'Kloster', number: '13', position: 'SS', hit: 0.62, pitch: 0.4 },
  { id: 'p_cooper', first: 'Cooper', last: 'Woollen', number: '50', position: '1B', hit: 0.64, pitch: 0.63 },
  { id: 'p_carsyn', first: 'Carsyn', last: 'Griffith', number: '26', position: 'C', hit: 0.53, pitch: 0.55 },
  { id: 'p_matthew', first: 'Matthew', last: 'Hume', number: '76', position: 'EH', hit: 0.72, pitch: 0.2 },
  { id: 'p_knox', first: 'Knox', last: 'Kennedy', number: '8', position: '2B', hit: 0.42, pitch: 0.5, lastGamesOnly: 2 },
  { id: 'p_weedon', first: 'Weedon', last: 'Hainline', number: '10', position: 'P', hit: 0.58, pitch: 0.7 },
  { id: 'p_landyn', first: 'Landyn', last: 'Durbin', position: 'RF', hit: 0.54, pitch: 0.52 },
  { id: 'p_ben', first: 'Ben', last: 'Boncek', number: '99', position: 'LF', hit: 0.45, pitch: 0.48 },
];

type SeedGame = {
  id: Id;
  opponent: string;
  isAway: boolean;
  /**
   * Saturdays relative to today: negative = that many Saturdays back from the
   * most recent past Saturday (-0 is the most recent), +1 = the next Saturday.
   */
  weekOffset: number;
  hour: number;
  minute: number;
  status: Game['status'];
  score?: { us: number; them: number };
  notes: string;
  innings?: number;
  /** Pitchers in order; the second takes over after `switchAfter` innings. */
  pitchers?: Id[];
  switchAfter?: number;
  /** Plate appearances per half inning for us / them, roughly. */
  tempo?: { us: number; them: number };
};

const GAMES: SeedGame[] = [
  {
    id: 'g_wolves',
    opponent: 'Eureka Wolves',
    isAway: false,
    weekOffset: -8,
    hour: 9,
    minute: 0,
    status: 'final',
    score: { us: 7, them: 2 },
    notes: 'Season opener. Bats woke up in the 3rd.',
    innings: 5,
    pitchers: ['p_owen', 'p_cooper'],
    switchAfter: 3,
    tempo: { us: 4.5, them: 3.8 },
  },
  {
    id: 'g_tigers_1',
    opponent: 'Tigers',
    isAway: true,
    weekOffset: -6,
    hour: 11,
    minute: 0,
    status: 'final',
    score: { us: 11, them: 6 },
    notes: 'Came back from down 4 in the 2nd.',
    innings: 5,
    pitchers: ['p_weedon', 'p_lucas'],
    switchAfter: 3,
    tempo: { us: 5, them: 4.5 },
  },
  {
    id: 'g_rockhounds',
    opponent: 'Rockhounds',
    isAway: false,
    weekOffset: -3,
    hour: 13,
    minute: 0,
    status: 'final',
    score: { us: 4, them: 9 },
    notes: 'Too many strikeouts looking. Work on two-strike approach.',
    innings: 5,
    pitchers: ['p_cooper', 'p_carsyn'],
    switchAfter: 2,
    tempo: { us: 3.8, them: 5.2 },
  },
  {
    id: 'g_fury',
    opponent: 'Fenton Fury',
    isAway: false,
    weekOffset: -2,
    hour: 10,
    minute: 0,
    status: 'final',
    score: { us: 8, them: 3 },
    notes: 'Solid pitching from Owen and Weedon.',
    innings: 6,
    pitchers: ['p_owen', 'p_weedon'],
    switchAfter: 3,
    tempo: { us: 4.5, them: 3.5 },
  },
  {
    id: 'g_redbirds',
    opponent: 'Redbirds Red',
    isAway: true,
    weekOffset: 0,
    hour: 9,
    minute: 0,
    status: 'final',
    score: { us: 6, them: 7 },
    notes: '4 inning game, lost the lead in the 3rd inning, 1 HR.',
    innings: 4,
    pitchers: ['p_weedon', 'p_ben'],
    switchAfter: 2,
    tempo: { us: 5.5, them: 4 },
  },
  {
    id: 'g_bandits',
    opponent: 'Midland Bandits',
    isAway: true,
    weekOffset: 0,
    hour: 12,
    minute: 30,
    status: 'final',
    score: { us: 19, them: 5 },
    notes: '3 inning game, took the lead in the 1st inning, 1 HR.',
    innings: 3,
    pitchers: ['p_owen', 'p_cooper'],
    switchAfter: 2,
    tempo: { us: 11, them: 4 },
  },
  {
    id: 'g_tigers_2',
    opponent: 'Tigers',
    isAway: true,
    weekOffset: 1,
    hour: 14,
    minute: 30,
    status: 'scheduled',
    notes: 'On a three game winning streak against the Tigers since April.',
  },
];

function at(now: Date, dayOffset: number, hour: number, minute: number): Date {
  return setSeconds(setMinutes(setHours(addDays(now, dayOffset), hour), minute), 0);
}

/**
 * Youth ball is played on Saturdays. Past games sit on the most recent past
 * Saturday (weekOffset 0) and earlier ones; the upcoming game is next Saturday.
 */
function saturdayOffset(now: Date, weekOffset: number): number {
  const day = now.getDay(); // 0 = Sunday … 6 = Saturday
  const daysSinceSaturday = (day + 1) % 7; // Sat → 0, Sun → 1, … Fri → 6
  if (weekOffset > 0) {
    const daysUntilNext = 7 - daysSinceSaturday; // always in the future, 1..7
    return daysUntilNext + (weekOffset - 1) * 7;
  }
  // weekOffset 0 → most recent past Saturday; today counts only if it is Saturday.
  return -daysSinceSaturday + weekOffset * 7;
}

function opponentLineup(prefix: string): OpponentBatter[] {
  return Array.from({ length: 9 }, (_, i) => ({ id: `${prefix}_ob${i + 1}`, name: `Batter ${i + 1}` }));
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)];
}

/** Choose an outcome id consistent with the result, weighting the common ones. */
function outcomeFor(rand: () => number, batterWon: boolean): OutcomeId {
  if (batterWon) {
    const r = rand();
    if (r < 0.5) return 'hit';
    if (r < 0.65) return 'walk_clean';
    if (r < 0.8) return 'fly_out_hard';
    return pick(rand, WIN_OUTCOMES).id;
  }
  const r = rand();
  if (r < 0.3) return 'k_swinging';
  if (r < 0.5) return 'k_looking';
  if (r < 0.7) return 'fc_weak';
  return pick(rand, LOSS_OUTCOMES).id;
}

/**
 * Build the demo dataset. `now` is injected so tests are stable and the
 * prototype always shows one game "in 4 days".
 */
export function buildDemoData(now: Date = new Date()): AppData {
  const rand = mulberry32(20240908);
  const season = String(now.getFullYear());

  const players: Player[] = ROSTER.map((r) => ({
    id: r.id,
    teamId: DEMO_TEAM_ID,
    firstName: r.first,
    lastName: r.last,
    number: r.number,
  }));

  const defaultLineup: LineupSlot[] = ROSTER.map((r) => ({ playerId: r.id, position: r.position }));

  const teams: Team[] = [
    {
      id: DEMO_TEAM_ID,
      name: `STL Bears 12U Floyd ${season}`,
      season,
      defaultLineup,
      createdAt: at(now, -90, 18, 0).toISOString(),
    },
    {
      id: 't_bears13u',
      name: 'STL Bears 13U Bernstein',
      season,
      defaultLineup: [],
      createdAt: at(now, -80, 18, 0).toISOString(),
    },
    {
      id: 't_bears15u',
      name: `STL Bears 15U Floyd ${season}`,
      season,
      defaultLineup: [],
      createdAt: at(now, -70, 18, 0).toISOString(),
    },
  ];

  const games: Game[] = [];
  const atBats: AtBat[] = [];
  const pastCount = GAMES.filter((g) => g.status === 'final').length;

  GAMES.forEach((sg, gameIndex) => {
    const startsAt = at(now, saturdayOffset(now, sg.weekOffset), sg.hour, sg.minute);
    const gamesFromEnd = pastCount - gameIndex; // 1 for the most recent past game
    const lineup = defaultLineup.filter((slot) => {
      const sp = ROSTER.find((r) => r.id === slot.playerId)!;
      if (sg.status !== 'final') return true;
      return !sp.lastGamesOnly || gamesFromEnd <= sp.lastGamesOnly;
    });
    const theirOrder = opponentLineup(sg.id);
    const pitchers = sg.pitchers ?? ['p_weedon'];

    const game: Game = {
      id: sg.id,
      teamId: DEMO_TEAM_ID,
      opponent: sg.opponent,
      isAway: sg.isAway,
      startsAt: startsAt.toISOString(),
      status: sg.status,
      lineup,
      opponentLineup: theirOrder,
      pitcherId: pitchers[0],
      inning: 1,
      half: 'top',
      ourNextBatter: 0,
      theirNextBatter: 0,
      score: sg.score ?? { us: 0, them: 0 },
      notes: sg.notes,
      createdAt: addDays(startsAt, -10).toISOString(),
    };

    if (sg.status === 'final') {
      const innings = sg.innings ?? 5;
      let ourIdx = 0;
      let theirIdx = 0;
      let clock = startsAt;
      for (let inning = 1; inning <= innings; inning++) {
        for (const half of ['top', 'bottom'] as const) {
          const weBat = sg.isAway ? half === 'top' : half === 'bottom';
          const tempo = weBat ? sg.tempo!.us : sg.tempo!.them;
          const pas = Math.max(3, Math.round(tempo + (rand() - 0.5) * 2));
          const pitcherId = inning > (sg.switchAfter ?? 99) && pitchers[1] ? pitchers[1] : pitchers[0];
          for (let k = 0; k < pas; k++) {
            clock = addMinutes(clock, 2 + Math.floor(rand() * 3));
            if (weBat) {
              const slot = lineup[ourIdx % lineup.length];
              ourIdx++;
              const sp = ROSTER.find((r) => r.id === slot.playerId)!;
              const won = rand() < sp.hit;
              atBats.push({
                id: `${sg.id}_ab${atBats.length}`,
                gameId: sg.id,
                side: 'us',
                batterId: sp.id,
                inning,
                half,
                outcomeId: outcomeFor(rand, won),
                result: won ? 'W' : 'L',
                recordedAt: clock.toISOString(),
              });
            } else {
              const batter = theirOrder[theirIdx % theirOrder.length];
              theirIdx++;
              const pitcher = ROSTER.find((r) => r.id === pitcherId)!;
              const pitcherWon = rand() < pitcher.pitch;
              atBats.push({
                id: `${sg.id}_ab${atBats.length}`,
                gameId: sg.id,
                side: 'them',
                batterId: batter.id,
                pitcherId,
                inning,
                half,
                outcomeId: outcomeFor(rand, !pitcherWon),
                result: pitcherWon ? 'L' : 'W',
                recordedAt: clock.toISOString(),
              });
            }
          }
        }
      }
      game.inning = innings;
      game.half = 'bottom';
      game.ourNextBatter = ourIdx % lineup.length;
      game.theirNextBatter = theirIdx % theirOrder.length;
      game.pitcherId = pitchers[1] ?? pitchers[0];
      game.finishedAt = addMinutes(clock, 5).toISOString();
    }

    games.push(game);
  });

  return { version: 1, onboarded: false, teams, players, games, atBats };
}
