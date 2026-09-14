import { byLastName } from './format';
import type { AtBat, Game, Id, Player, Team } from './types';

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
  return ab.result === 'W' ? 'L' : 'W';
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

export type StatMode = 'hitting' | 'pitching';

export type StatRow = {
  player: Player;
  wl: WL;
  /** null when the player has no at-bats in this mode (rendered as "-"). */
  score: number | null;
};

/**
 * Season table rows for a team. Order: the default lineup first, then the rest
 * of the roster by last name. Only games belonging to the team count.
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
  const byId = new Map(roster.map((p) => [p.id, p]));

  const ordered: Player[] = [];
  for (const slot of team.defaultLineup) {
    const p = byId.get(slot.playerId);
    if (p && !ordered.includes(p)) ordered.push(p);
  }
  for (const p of [...roster].sort(byLastName)) {
    if (!ordered.includes(p)) ordered.push(p);
  }

  return ordered.map((player) => {
    const wl = mode === 'hitting' ? hittingFor(teamAtBats, player.id) : pitchingFor(teamAtBats, player.id);
    const has = wl.w + wl.l > 0;
    return { player, wl, score: has ? score(wl) : null };
  });
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
 * Scorebook grid for one side of a game. `batters` should be the game's
 * batting order; players who batted but are no longer in the order are appended.
 */
export function scorebook<T extends { id: Id }>(
  atBats: AtBat[],
  gameId: Id,
  side: 'us' | 'them',
  batters: T[],
  minInnings = 1,
): { innings: number[]; rows: ScorebookRow<T>[] } {
  const relevant = atBats.filter((ab) => ab.gameId === gameId && ab.side === side);
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

/** Rank player ids by season hitting score, best first. Ties keep the given order. */
export function rankByHitting(playerIds: Id[], atBats: AtBat[], gameIds: Set<Id>): Id[] {
  const relevant = atBats.filter((ab) => gameIds.has(ab.gameId));
  const scored = playerIds.map((id, index) => ({ id, index, s: score(hittingFor(relevant, id)) }));
  scored.sort((a, b) => b.s - a.s || a.index - b.index);
  return scored.map((x) => x.id);
}
