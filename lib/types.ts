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
 * Every outcome id: the thirteen batter outcomes (the hitting grid), the eight
 * pitcher outcomes (the pitching grid) and the two "plain" ids for a W or L
 * recorded with the big buttons and no play type (see lib/outcomes).
 */
export type OutcomeId =
  | 'plain_w'
  | 'plain_l'
  // Batter outcomes: recorded on a `side: 'us'` at-bat.
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
  | 'hit'
  | 'hbp'
  // Pitcher outcomes: recorded on a `side: 'them'` at-bat.
  | 'p_walk'
  | 'p_hbp'
  | 'p_hard_reached'
  | 'p_hard_out'
  | 'p_k_swinging'
  | 'p_k_looking'
  | 'p_weak_out'
  | 'p_weak_reached';

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
  /** A batter outcome when side === 'us', a pitcher outcome when side === 'them', or a plain id on either. */
  outcomeId: OutcomeId;
  /**
   * The GRADED player's letter: the batter's when side === 'us', our
   * pitcher's when side === 'them'. Nothing inverts it anywhere; it is always
   * derived from the outcome (`getOutcome(outcomeId).result`).
   */
  result: Result;
  recordedAt: string;
};

export type AppData = {
  /** 2 since pitching at-bats store the pitcher's own grade; version 1 stored the batter's (see `migrateV1` in lib/store). */
  version: 2;
  onboarded: boolean;
  teams: Team[];
  players: Player[];
  games: Game[];
  atBats: AtBat[];
};

/** A document as it may sit in storage: this build's shape, or a version-1 one waiting for `migrateV1`. */
export type StoredDocument = Omit<AppData, 'version'> & { version: 1 | 2 };

export const EMPTY_DATA: AppData = {
  version: 2,
  onboarded: false,
  teams: [],
  players: [],
  games: [],
  atBats: [],
};
