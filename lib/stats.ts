import { compareAtBats, invertResult } from './atbats';
import { byLastName, lineupFirstRoster } from './format';
import type { AtBat, Game, Half, Id, LineupSlot, Player, Result, Side, Team } from './types';

export type WL = { w: number; l: number };

export const ZERO: WL = { w: 0, l: 0 };

export function score(wl: WL): number {
  return wl.w - wl.l;
}

export function addResult(wl: WL, batterWon: boolean): WL {
  return batterWon ? { w: wl.w + 1, l: wl.l } : { w: wl.w, l: wl.l + 1 };
}

/** A pitcher wins the battle when the batter loses it. */
export function pitcherResult(ab: AtBat): 'W' | 'L' {
  return invertResult(ab.result);
}

/** Hitting W/L for one of our players, optionally limited to one game. */
export function hittingFor(atBats: AtBat[], playerId: Id, gameId?: Id): WL {
  let wl = ZERO;
  for (const ab of atBats) {
    if (ab.side !== 'us' || ab.batterId !== playerId) continue;
    if (gameId && ab.gameId !== gameId) continue;
    wl = addResult(wl, ab.result === 'W');
  }
  return wl;
}

/** Pitching W/L for one of our players (as the pitcher facing their batters). */
export function pitchingFor(atBats: AtBat[], playerId: Id, gameId?: Id): WL {
  let wl = ZERO;
  for (const ab of atBats) {
    if (ab.side !== 'them' || ab.pitcherId !== playerId) continue;
    if (gameId && ab.gameId !== gameId) continue;
    wl = addResult(wl, ab.result === 'L');
  }
  return wl;
}

/** Team hitting W/L for a game: every at-bat where we batted. */
export function gameHitting(atBats: AtBat[], gameId: Id): WL {
  let wl = ZERO;
  for (const ab of atBats) {
    if (ab.gameId !== gameId || ab.side !== 'us') continue;
    wl = addResult(wl, ab.result === 'W');
  }
  return wl;
}

/** Team pitching W/L for a game: every at-bat where they batted, from our pitcher's side. */
export function gamePitching(atBats: AtBat[], gameId: Id): WL {
  let wl = ZERO;
  for (const ab of atBats) {
    if (ab.gameId !== gameId || ab.side !== 'them') continue;
    wl = addResult(wl, ab.result === 'L');
  }
  return wl;
}

/** One of our pitchers' line for a game (see `gamePitcherLines`). */
export type PitcherLine = {
  player: Player;
  /** From our pitcher's side: W = the batter lost the battle. */
  wl: WL;
  /** First and last inning he faced a batter; undefined before his first at-bat. */
  innings?: { from: number; to: number };
};

/**
 * Our pitchers in a game, in the order they first faced a batter, each with
 * his W/L and the innings he pitched. The game's current pitcher is listed
 * even before he has faced anyone. Opposing batters are not tracked as
 * individuals: the pitching side of a game is our pitchers' battles only.
 */
export function gamePitcherLines(atBats: AtBat[], gameId: Id, players: Player[], currentPitcherId?: Id): PitcherLine[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const lines = new Map<Id, PitcherLine>();
  const theirs = atBats.filter((ab) => ab.gameId === gameId && ab.side === 'them' && ab.pitcherId !== undefined).sort(compareAtBats);
  for (const ab of theirs) {
    const player = byId.get(ab.pitcherId!);
    if (!player) continue;
    const line = lines.get(player.id) ?? { player, wl: ZERO };
    line.wl = addResult(line.wl, ab.result === 'L');
    line.innings = line.innings ? { from: line.innings.from, to: Math.max(line.innings.to, ab.inning) } : { from: ab.inning, to: ab.inning };
    lines.set(player.id, line);
  }
  const current = currentPitcherId ? byId.get(currentPitcherId) : undefined;
  if (current && !lines.has(current.id)) lines.set(current.id, { player: current, wl: ZERO });
  return [...lines.values()];
}

export type StatMode = 'hitting' | 'pitching';

export type StatRow = {
  player: Player;
  wl: WL;
  /** null when the player has no at-bats in this mode (rendered as "-"). */
  score: number | null;
  /** Synthetic row aggregating at-bats of players no longer on the roster. */
  removed?: boolean;
};

/** `player.id` of the synthetic "Removed players" row (see `seasonTable`). */
export const REMOVED_ROW_ID = '__removed__';

/**
 * Season table rows for a team. Order: the default lineup first, then the rest
 * of the roster by last name. Only games belonging to the team count.
 *
 * At-bats that no roster player claims (the batter or pitcher was removed from
 * the team, or an opponent at-bat was charted with no pitcher set) still count
 * in every game line, so they are appended as one last "Removed players" row
 * (`removed: true`) and `totals()` always equals the sum of the game lines.
 */
export function seasonTable(
  team: Team,
  players: Player[],
  games: Game[],
  atBats: AtBat[],
  mode: StatMode,
): StatRow[] {
  const gameIds = new Set(games.filter((g) => g.teamId === team.id).map((g) => g.id));
  const teamAtBats = atBats.filter((ab) => gameIds.has(ab.gameId));
  const roster = players.filter((p) => p.teamId === team.id);
  const ordered = lineupFirstRoster(roster, team.defaultLineup);
  const rosterIds = new Set(roster.map((p) => p.id));

  const rows: StatRow[] = ordered.map((player) => {
    const wl = mode === 'hitting' ? hittingFor(teamAtBats, player.id) : pitchingFor(teamAtBats, player.id);
    const has = wl.w + wl.l > 0;
    return { player, wl, score: has ? score(wl) : null };
  });

  const side = mode === 'hitting' ? 'us' : 'them';
  let orphan = ZERO;
  for (const ab of teamAtBats) {
    if (ab.side !== side) continue;
    const owner = mode === 'hitting' ? ab.batterId : ab.pitcherId;
    if (owner !== undefined && rosterIds.has(owner)) continue;
    orphan = addResult(orphan, mode === 'hitting' ? ab.result === 'W' : ab.result === 'L');
  }
  if (orphan.w + orphan.l > 0) {
    rows.push({
      player: { id: REMOVED_ROW_ID, teamId: team.id, firstName: 'Removed', lastName: 'players' },
      wl: orphan,
      score: score(orphan),
      removed: true,
    });
  }
  return rows;
}

export function totals(rows: StatRow[]): WL {
  return rows.reduce((acc, r) => ({ w: acc.w + r.wl.w, l: acc.l + r.wl.l }), ZERO);
}

export type ScorebookRow<T> = {
  batter: T;
  /** Innings 1..N, each holding the at-bats that batter had in that inning (usually 0 or 1). */
  innings: AtBat[][];
  wl: WL;
};

/**
 * Scorebook grid for one side of a game, one row per entry of `batters` in
 * the order given. The app passes `orderWithLeavers(game, atBats, side)` so a
 * player who was subbed out or removed mid-game keeps his row (any list of
 * `{ id }` works); at-bats whose batter is not in the list are dropped.
 */
export function scorebook<T extends { id: Id }>(
  atBats: AtBat[],
  gameId: Id,
  side: 'us' | 'them',
  batters: T[],
  minInnings = 1,
): { innings: number[]; rows: ScorebookRow<T>[] } {
  const relevant = atBats.filter((ab) => ab.gameId === gameId && ab.side === side);
  // Document order is history (a restore appends); a multi-at-bat cell follows the clock.
  relevant.sort(compareAtBats);
  const maxInning = relevant.reduce((m, ab) => Math.max(m, ab.inning), minInnings);
  const innings = Array.from({ length: maxInning }, (_, i) => i + 1);

  const rows: ScorebookRow<T>[] = batters.map((batter) => ({
    batter,
    innings: innings.map(() => []),
    wl: ZERO,
  }));
  const rowByBatter = new Map(rows.map((r) => [r.batter.id, r]));

  for (const ab of relevant) {
    const row = rowByBatter.get(ab.batterId);
    if (!row) continue;
    row.innings[ab.inning - 1].push(ab);
    const batterWon = ab.result === 'W';
    row.wl = addResult(row.wl, side === 'us' ? batterWon : !batterWon);
  }
  return { innings, rows };
}

/**
 * Batters who have at-bats in this game on this side but are not in
 * `orderIds` (removed from the order mid-game with the lineup editor), in the
 * order their first at-bat happened. This is the 'left' half of
 * `orderWithLeavers()`, which appends these ids as status 'left' rows after
 * the order (shown as "LEFT GAME") so the grid reconciles with the totals.
 */
export function leftGameBatterIds(atBats: AtBat[], gameId: Id, side: Side, orderIds: Id[]): Id[] {
  const inOrder = new Set(orderIds);
  const relevant = atBats.filter((ab) => ab.gameId === gameId && ab.side === side && !inOrder.has(ab.batterId));
  relevant.sort(compareAtBats);
  const seen: Id[] = [];
  for (const ab of relevant) {
    if (!seen.includes(ab.batterId)) seen.push(ab.batterId);
  }
  return seen;
}

/** Rank player ids by season hitting score, best first. Ties keep the given order. */
export function rankByHitting(playerIds: Id[], atBats: AtBat[], gameIds: Set<Id>): Id[] {
  const relevant = atBats.filter((ab) => gameIds.has(ab.gameId));
  const scored = playerIds.map((id, index) => ({ id, index, s: score(hittingFor(relevant, id)) }));
  scored.sort((a, b) => b.s - a.s || a.index - b.index);
  return scored.map((x) => x.id);
}

// ---------------------------------------------------------------------------
// Form: how a batter has been doing lately. Drives the HOT/COLD tags and the
// hottest-first bench on the substitution sheet.

/** How many of a batter's latest at-bats count as his form (shown as chips). */
export const FORM_WINDOW = 6;
/** A form score at or above this is 'hot'; at or below its negative, 'cold'. */
export const FORM_HOT = 3;
/** No rating until the window holds this many at-bats (three hits in a row is too few to call). */
export const FORM_MIN_AT_BATS = 4;

export type FormRating = 'hot' | 'cold' | undefined;

/** Games ordered by first pitch; a tie keeps the given order. */
function byStartsAt(games: Game[]): Game[] {
  return [...games].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/**
 * The batter's last `n` our-side at-bats across every game in `games`
 * (in-progress ones included), oldest first. Games follow their `startsAt`;
 * within a game the at-bats follow the clock (`compareAtBats`). At-bats of a
 * game not in `games` are ignored.
 */
export function recentForm(atBats: AtBat[], games: Game[], playerId: Id, n = FORM_WINDOW): Result[] {
  const gameRank = new Map(byStartsAt(games).map((g, i) => [g.id, i]));
  const mine = atBats.filter((ab) => ab.side === 'us' && ab.batterId === playerId && gameRank.has(ab.gameId));
  mine.sort((a, b) => gameRank.get(a.gameId)! - gameRank.get(b.gameId)! || compareAtBats(a, b));
  return mine.slice(Math.max(0, mine.length - n)).map((ab) => ab.result);
}

/** W minus L over the given results. */
export function formScore(results: Result[]): number {
  let total = 0;
  for (const r of results) total += r === 'W' ? 1 : -1;
  return total;
}

/** 'hot' / 'cold' by `FORM_HOT`, or undefined in between or with fewer than `FORM_MIN_AT_BATS` results. */
export function formRating(results: Result[]): FormRating {
  if (results.length < FORM_MIN_AT_BATS) return undefined;
  const total = formScore(results);
  if (total >= FORM_HOT) return 'hot';
  if (total <= -FORM_HOT) return 'cold';
  return undefined;
}

/** The batter's W/L in the most recent FINAL game (by `startsAt`) where he had an our-side at-bat. */
export function lastGameLine(atBats: AtBat[], games: Game[], playerId: Id): { gameId: Id; wl: WL } | undefined {
  const finals = byStartsAt(games.filter((g) => g.status === 'final'));
  for (let i = finals.length - 1; i >= 0; i--) {
    const wl = hittingFor(atBats, playerId, finals[i].id);
    if (wl.w + wl.l > 0) return { gameId: finals[i].id, wl };
  }
  return undefined;
}

/** Roster players who are not in the order, in the order given. */
export function benchFor(players: Player[], lineup: Pick<LineupSlot, 'playerId'>[]): Player[] {
  const inOrder = new Set(lineup.map((s) => s.playerId));
  return players.filter((p) => !inOrder.has(p.id));
}

/**
 * The bench hottest first: form score, then season hitting score (both over
 * the given games, best first); players with no at-bats at all come last;
 * ties by last name. The input is not mutated.
 */
export function benchOrder(bench: Player[], atBats: AtBat[], games: Game[]): Player[] {
  const gameIds = new Set(games.map((g) => g.id));
  const relevant = atBats.filter((ab) => gameIds.has(ab.gameId));
  const keyed = bench.map((player) => {
    const season = hittingFor(relevant, player.id);
    return {
      player,
      has: season.w + season.l > 0 ? 1 : 0,
      form: formScore(recentForm(relevant, games, player.id)),
      season: score(season),
    };
  });
  keyed.sort((a, b) => b.has - a.has || b.form - a.form || b.season - a.season || byLastName(a.player, b.player));
  return keyed.map((k) => k.player);
}

// ---------------------------------------------------------------------------
// Display order for the scorebook and the finished-game list.

export type OrderRow = {
  id: Id;
  /** The row's place in the order (0-based). -1 for a 'left' row, which is not in the order. */
  slot: number;
  /**
   * 'in': in the order now. 'out': left it through a recorded substitution,
   * listed at his slot before the player who replaced him. 'left': has
   * at-bats but is in neither (removed with the lineup editor), appended last.
   */
  status: 'in' | 'out' | 'left';
  /** The half-inning of the substitution that put the player in ('in') or took him out ('out'). Starters have none. */
  at?: { inning: number; half: Half };
};

/**
 * The rows a scorebook or a finished-game list shows for one side: the
 * current order in slot order, with everyone who left a slot through a
 * recorded substitution inserted (status 'out') right before the player who
 * took it, and everyone else with at-bats who is no longer in the order
 * appended (status 'left', in first-at-bat order). Each player appears once:
 * a re-entered player is an 'in' row stamped with his latest entry. A record
 * whose incoming player is no longer in the order (undone with the lineup
 * editor) is ignored. The opponent side never has substitutions.
 */
export function orderWithLeavers(game: Game, atBats: AtBat[], side: Side): OrderRow[] {
  const rows: OrderRow[] =
    side === 'us'
      ? game.lineup.map((s, slot) => ({ id: s.playerId, slot, status: 'in' }))
      : game.opponentLineup.map((b, slot) => ({ id: b.id, slot, status: 'in' }));

  if (side === 'us' && game.substitutions && game.substitutions.length > 0) {
    // Newest first, by the order the records were made (`game.substitutions`
    // is appended to, oldest first) rather than by their clock: a sub made
    // while reviewing an earlier half carries an earlier clock than a sub made
    // before it. The player a record put in is found by id (so a reorder since
    // does not matter), stamped with that entry unless a later record already
    // did, and the player he replaced is inserted just before him.
    const records = [...game.substitutions].reverse();
    for (const record of records) {
      const index = rows.findIndex((r) => r.id === record.inId);
      if (index < 0) continue;
      const at = { inning: record.inning, half: record.half };
      const row = rows[index];
      if (!row.at) row.at = at;
      if (rows.some((r) => r.id === record.outId)) continue;
      rows.splice(index, 0, { id: record.outId, slot: row.slot, status: 'out', at });
    }
  }

  const listed = rows.map((r) => r.id);
  for (const id of leftGameBatterIds(atBats, game.id, side, listed)) {
    rows.push({ id, slot: -1, status: 'left' });
  }
  return rows;
}
