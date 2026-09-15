/**
 * The CTG screen's undo stack: pure helpers plus a tiny in-memory per-game
 * stack shared by the CTG screen and the modal routes (editor, batter sheet).
 * Not persisted: it survives tab switches, not a reload, as the spec states.
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
   * A recorded at-bat. Inverse: delete it. A backfill (the batter sheet's
   * "Add a W / L") never moved the batter pointer, so its inverse must not
   * roll the pointer back either.
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
  /** Remove at-bat. Inverse: put the copy back. */
  | { kind: 'remove'; atBat: AtBat };

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
  }
}

export type UndoActions = Pick<
  Store,
  'deleteAtBat' | 'setNextBatter' | 'nextHalfInning' | 'prevHalfInning' | 'updateAtBat' | 'restoreAtBat'
>;

/** Reverts one entry against the current document. `game` is the game as it is now. */
export function applyUndo(entry: UndoEntry, game: Game, actions: UndoActions): void {
  switch (entry.kind) {
    case 'record':
      if (entry.backfill) actions.deleteAtBat(entry.atBat.id, { keepPointer: true });
      else actions.deleteAtBat(entry.atBat.id);
      return;
    case 'skip': {
      const index =
        entry.side === 'us'
          ? game.lineup.findIndex((s) => s.playerId === entry.fromBatterId)
          : game.opponentLineup.findIndex((b) => b.id === entry.fromBatterId);
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
    case 'remove':
      actions.restoreAtBat(entry.atBat);
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

/** Empties the game's stack (End Game, leaving the game). */
export function clearUndo(gameId: Id): void {
  if (!stacks.has(gameId)) return;
  stacks.delete(gameId);
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
