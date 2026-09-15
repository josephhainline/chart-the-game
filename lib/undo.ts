/**
 * The CTG screen's undo stack: pure helpers plus a tiny in-memory per-game
 * stack shared by the CTG screen and the modal routes (editor, batter sheet).
 * Not persisted: it survives tab switches, not a reload, as the spec states.
 * The store empties a game's stack when the game is deleted and every stack
 * when the document is reset or cleared, so a stale entry can never act on a
 * re-seeded game that reuses the same id.
 *
 * Entries store ids, never indices, and every inverse is resolved against the
 * current document at undo time (`applyUndo`), so an entry whose batter has
 * since left the order simply does nothing.
 */
import { useSyncExternalStore } from 'react';

import { displayResult } from './atbats';
import type { Store } from './store';
import type { AtBat, Game, Id, Side } from './types';

export type UndoEntry =
  /**
   * A recorded at-bat. Inverse: delete it and put the batter back up (undo is
   * LIFO and every pointer move is on the stack, so the batter is due again
   * even when the at-bat was charted while reviewing an earlier half). A
   * backfill (the batter sheet's "Add a W / L") never moved the batter
   * pointer, so its inverse must not roll the pointer back either.
   */
  | { kind: 'record'; atBat: AtBat; backfill?: boolean }
  /** A forward skip. Inverse: put `fromBatterId` back up, if still in the order. */
  | { kind: 'skip'; side: Side; fromBatterId: Id; toBatterId: Id }
  /** Next half / Prev half. Inverse: the other one. */
  | { kind: 'half'; direction: 'next' | 'prev' }
  /** A re-judge or editor change. Inverse: restore the previous fields (result re-derives). */
  | {
      kind: 'rejudge';
      atBatId: Id;
      previous: Pick<AtBat, 'outcomeId' | 'result' | 'batterId' | 'pitcherId' | 'inning' | 'half'>;
    }
  /**
   * Remove at-bat. Inverse: put the copy back, and put `dueBatterId` (whoever
   * was due before the remove, which may have rolled the pointer back) up
   * again if still in the order. The editor captures it from that side's
   * pointer before calling `deleteAtBat`.
   */
  | { kind: 'remove'; atBat: AtBat; dueBatterId?: Id }
  /**
   * A substitution. Inverse: `undoSubstitution`, which puts `outId` back only
   * while the slot still holds `inId` (a later lineup edit makes it a no-op).
   * `slot`, `outId` and `inId` are carried for labels and for callers that
   * describe the entry; the store resolves everything from the record.
   */
  | { kind: 'sub'; substitutionId: Id; slot: number; outId: Id; inId: Id };

export const UNDO_LIMIT = 20;

/** What the Undo button says: names the top entry, or plain "Undo" (disabled) when the stack is empty. */
export function undoLabel(entry: UndoEntry | undefined): string {
  if (!entry) return 'Undo';
  switch (entry.kind) {
    case 'record':
      return `Undo ${displayResult(entry.atBat)}`;
    case 'skip':
      return 'Undo skip';
    case 'half':
      return entry.direction === 'next' ? 'Undo Next half' : 'Undo Prev half';
    case 'rejudge':
      return 'Undo re-judge';
    case 'remove':
      return 'Undo remove';
    case 'sub':
      return 'Undo sub';
  }
}

export type UndoActions = Pick<
  Store,
  | 'deleteAtBat'
  | 'setNextBatter'
  | 'nextHalfInning'
  | 'prevHalfInning'
  | 'updateAtBat'
  | 'restoreAtBat'
  | 'undoSubstitution'
>;

/** The batter's slot in that side's current order, or -1 once they have left it. */
function slotOf(game: Game, side: Side, batterId: Id): number {
  return side === 'us'
    ? game.lineup.findIndex((s) => s.playerId === batterId)
    : game.opponentLineup.findIndex((b) => b.id === batterId);
}

/** Reverts one entry against the current document. `game` is the game as it is now. */
export function applyUndo(entry: UndoEntry, game: Game, actions: UndoActions): void {
  switch (entry.kind) {
    case 'record': {
      // The entry, not deleteAtBat's newest-on-the-clock rule, knows whether
      // the pointer moved: an at-bat charted while reviewing an earlier half
      // is never the newest, yet its batter is due again all the same.
      actions.deleteAtBat(entry.atBat.id, { keepPointer: true });
      if (entry.backfill) return;
      const index = slotOf(game, entry.atBat.side, entry.atBat.batterId);
      // The batter has left the order since: nothing sensible to put back.
      if (index < 0) return;
      actions.setNextBatter(game.id, entry.atBat.side, index);
      return;
    }
    case 'skip': {
      const index = slotOf(game, entry.side, entry.fromBatterId);
      // The batter has left the order since: nothing sensible to put back.
      if (index < 0) return;
      actions.setNextBatter(game.id, entry.side, index);
      return;
    }
    case 'half':
      if (entry.direction === 'next') actions.prevHalfInning(game.id);
      else actions.nextHalfInning(game.id);
      return;
    case 'rejudge': {
      const { outcomeId, batterId, pitcherId, inning, half } = entry.previous;
      actions.updateAtBat(entry.atBatId, { outcomeId, batterId, pitcherId, inning, half });
      return;
    }
    case 'remove': {
      actions.restoreAtBat(entry.atBat);
      if (entry.dueBatterId === undefined) return;
      // restoreAtBat leaves the pointer alone; only the snapshot taken before
      // the remove says where it was (the remove may have rolled it back).
      const side = entry.atBat.side;
      const index = slotOf(game, side, entry.dueBatterId);
      const pointer = side === 'us' ? game.ourNextBatter : game.theirNextBatter;
      if (index < 0 || index === pointer) return;
      actions.setNextBatter(game.id, side, index);
      return;
    }
    case 'sub':
      actions.undoSubstitution(game.id, entry.substitutionId);
      return;
  }
}

// ---------------------------------------------------------------------------
// The in-memory stacks. Arrays are replaced, never mutated, so a snapshot is
// referentially stable until something changes (what useSyncExternalStore
// needs) and a hook consumer can keep the array it was handed.

const EMPTY: UndoEntry[] = [];
const stacks = new Map<Id, UndoEntry[]>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pushes an entry for the game, dropping the oldest beyond UNDO_LIMIT. */
export function pushUndo(gameId: Id, entry: UndoEntry): void {
  const current = stacks.get(gameId) ?? EMPTY;
  const next = [...current, entry];
  stacks.set(gameId, next.length > UNDO_LIMIT ? next.slice(next.length - UNDO_LIMIT) : next);
  notify();
}

/** Removes and returns the top entry, or undefined when there is nothing to undo. */
export function popUndo(gameId: Id): UndoEntry | undefined {
  const current = stacks.get(gameId);
  if (!current || current.length === 0) return undefined;
  const top = current[current.length - 1];
  const next = current.slice(0, -1);
  if (next.length === 0) stacks.delete(gameId);
  else stacks.set(gameId, next);
  notify();
  return top;
}

/** The top entry without removing it. */
export function peekUndo(gameId: Id): UndoEntry | undefined {
  const current = stacks.get(gameId);
  return current && current.length > 0 ? current[current.length - 1] : undefined;
}

/** Empties the game's stack. The store calls it when the game is deleted. */
export function clearUndo(gameId: Id): void {
  if (!stacks.has(gameId)) return;
  stacks.delete(gameId);
  notify();
}

/**
 * Empties every stack. The store calls it on Reset demo data / Clear all
 * data: the seeded game ids come back, the at-bats the entries refer to do not.
 */
export function clearAllUndo(): void {
  if (stacks.size === 0) return;
  stacks.clear();
  notify();
}

/** The game's stack, bottom to top; re-renders on every push/pop/clear. */
export function useUndoStack(gameId: Id | undefined): UndoEntry[] {
  return useSyncExternalStore(
    subscribe,
    () => (gameId === undefined ? EMPTY : stacks.get(gameId) ?? EMPTY),
    () => (gameId === undefined ? EMPTY : stacks.get(gameId) ?? EMPTY),
  );
}
