/**
 * Data model for Chart The Game. See docs/PRODUCT_SPEC.md §4.
 * Everything is persisted as a single AppData JSON document.
 */

export type Id = string;

export type Player = {
  id: Id;
  teamId: Id;
  firstName: string;
  lastName: string;
  /** Jersey number as entered ("7", "00"). Optional: some kids don't have one yet. */
  number?: string;
};

/** One place in a batting order. Older documents also carried a fielding position; the store drops it on load. */
export type LineupSlot = {
  playerId: Id;
};

export type Team = {
  id: Id;
  name: string;
  /** Season label shown on the Stats screen, e.g. "2026". */
  season: string;
  defaultLineup: LineupSlot[];
  createdAt: string;
};

export type OpponentBatter = {
  id: Id;
  name: string;
  number?: string;
};

export type GameStatus = 'scheduled' | 'in_progress' | 'final';

export type Half = 'top' | 'bottom';

export type Side = 'us' | 'them';

/**
 * A substitution in our order: `inId` took over `outId`'s slot from the given
 * half-inning on. Recorded so the scorebook and the finished-game list can show
 * who batted in the slot before the change. Re-entry is allowed: a player may
 * appear as `outId` in one record and `inId` in a later one.
 */
export type Substitution = {
  id: Id;
  /** Index into `lineup` of the slot that changed hands. */
  slot: number;
  outId: Id;
  inId: Id;
  /** The game's clock when the change was made. */
  inning: number;
  half: Half;
  /** ISO datetime the change was recorded. */
  at: string;
};

export type Game = {
  id: Id;
  teamId: Id;
  opponent: string;
  /** true = we are the visiting team ("@ Tigers"), false = home ("vs Tigers"). */
  isAway: boolean;
  /** ISO datetime of first pitch. */
  startsAt: string;
  status: GameStatus;
  /** Our batting order for this game (copied from the team's default lineup at creation). */
  lineup: LineupSlot[];
  opponentLineup: OpponentBatter[];
  /** Our current pitcher. */
  pitcherId?: Id;
  inning: number;
  half: Half;
  /** Index into `lineup` of the next batter due up for us. */
  ourNextBatter: number;
  /** Index into `opponentLineup` of the next batter due up for them. */
  theirNextBatter: number;
  /** Every substitution made in our order, oldest first. Absent on documents written before the feature. */
  substitutions?: Substitution[];
  notes?: string;
  createdAt: string;
  finishedAt?: string;
};

export type Result = 'W' | 'L';

/**
 * The twelve typed outcomes from the prototype plus the two "plain" ids: a
 * W or L recorded with the big buttons and no play type (see lib/outcomes).
 */
export type OutcomeId =
  | 'plain_w'
  | 'plain_l'
  | 'k_swinging'
  | 'walk_2_looking'
  | 'error_weak'
  | 'fc_weak'
  | 'bunt'
  | 'k_looking'
  | 'sac_fly'
  | 'walk_clean'
  | 'error_hard'
  | 'fc_hard'
  | 'fly_out_hard'
  | 'hit';

export type AtBat = {
  id: Id;
  gameId: Id;
  /** Who was batting. */
  side: Side;
  /** Player.id when side === 'us', OpponentBatter.id when side === 'them'. */
  batterId: Id;
  /** Our pitcher (Player.id) when side === 'them'. */
  pitcherId?: Id;
  inning: number;
  half: Half;
  outcomeId: OutcomeId;
  /** Always from the BATTER's perspective. Pitcher perspective is the inverse. */
  result: Result;
  recordedAt: string;
};

export type AppData = {
  version: 1;
  onboarded: boolean;
  teams: Team[];
  players: Player[];
  games: Game[];
  atBats: AtBat[];
};

export const EMPTY_DATA: AppData = {
  version: 1,
  onboarded: false,
  teams: [],
  players: [],
  games: [],
  atBats: [],
};
