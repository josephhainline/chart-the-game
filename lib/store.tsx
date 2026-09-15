import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { newestAtBat } from './atbats';
import { newId } from './ids';
import { getOutcome } from './outcomes';
import { buildDemoData } from './seed';
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
  Side,
  Team,
} from './types';
import { EMPTY_DATA } from './types';

export const STORAGE_KEY = 'ctg:data:v1';
/** Where a saved document that could not be read is parked before demo data replaces it. */
export const BACKUP_KEY = 'ctg:data:backup';
/** Back-to-back changes (e.g. typing a name) are coalesced into one write. */
const SAVE_DEBOUNCE_MS = 150;

/** Why the saved document was not loaded on launch. */
export type LoadIssue = 'backed_up';

/** Which side is batting given the game's half-inning. The away team bats in the top. */
export function battingSide(game: Pick<Game, 'isAway' | 'half'>): Side {
  const weBat = game.isAway ? game.half === 'top' : game.half === 'bottom';
  return weBat ? 'us' : 'them';
}

function nextHalf(inning: number, half: Half): { inning: number; half: Half } {
  return half === 'top' ? { inning, half: 'bottom' } : { inning: inning + 1, half: 'top' };
}

function prevHalf(inning: number, half: Half): { inning: number; half: Half } {
  if (half === 'bottom') return { inning, half: 'top' };
  return inning > 1 ? { inning: inning - 1, half: 'bottom' } : { inning, half };
}

/**
 * Keep the same batter due after a batting order changes. If the batter who
 * was due is gone, the next one after them (in the old order) who is still
 * present is due; falls back to the top of the order.
 */
export function carryNextBatter<T>(oldOrder: T[], oldIndex: number, newOrder: T[], idOf: (x: T) => Id): number {
  const n = oldOrder.length;
  if (n === 0 || newOrder.length === 0) return 0;
  const start = ((oldIndex % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const id = idOf(oldOrder[(start + k) % n]);
    const idx = newOrder.findIndex((x) => idOf(x) === id);
    if (idx >= 0) return idx;
  }
  return 0;
}

function defaultOpponentLineup(): OpponentBatter[] {
  return Array.from({ length: 9 }, (_, i) => ({ id: newId('ob'), name: `Batter ${i + 1}` }));
}

export type NewGameInput = {
  opponent: string;
  isAway: boolean;
  startsAt: string;
  notes?: string;
};

export type NewPlayerInput = {
  firstName: string;
  lastName: string;
  number?: string;
};

/** Where a backfilled at-bat goes: the batter and half-inning it belongs to. */
export type AtBatTarget = { side: Side; batterId: Id; inning: number; half: Half };

/** The fields of an at-bat the editor and the re-judge path may change; `result` is always derived. */
export type AtBatPatch = Partial<Pick<AtBat, 'outcomeId' | 'batterId' | 'pitcherId' | 'inning' | 'half'>>;

export type Store = {
  data: AppData;
  /** false until the persisted document has been read. */
  ready: boolean;
  /** Set when the saved document could not be read on launch and was moved to BACKUP_KEY. */
  loadIssue?: LoadIssue;

  setOnboarded: (value: boolean) => void;

  addTeam: (name: string, season?: string) => Team;
  updateTeam: (teamId: Id, patch: Partial<Pick<Team, 'name' | 'season'>>) => void;
  deleteTeam: (teamId: Id) => void;
  setDefaultLineup: (teamId: Id, lineup: LineupSlot[]) => void;

  addPlayer: (teamId: Id, input: NewPlayerInput) => Player;
  updatePlayer: (playerId: Id, patch: Partial<NewPlayerInput>) => void;
  removePlayer: (playerId: Id) => void;

  addGame: (teamId: Id, input: NewGameInput) => Game;
  /** Edits the game's details only; the order, status and progress go through the dedicated actions. */
  updateGame: (gameId: Id, patch: Partial<Pick<Game, 'opponent' | 'isAway' | 'startsAt' | 'notes'>>) => void;
  deleteGame: (gameId: Id) => void;
  setGameLineup: (gameId: Id, lineup: LineupSlot[]) => void;
  setOpponentLineup: (gameId: Id, batters: OpponentBatter[]) => void;
  /**
   * Sets our pitcher and credits this half's opponent at-bats that have no
   * pitcher yet. With `recreditHalf`, this half's opponent at-bats that name a
   * different pitcher are re-stamped too (a pitching change charted late).
   */
  setPitcher: (gameId: Id, playerId: Id | undefined, opts?: { recreditHalf?: boolean }) => void;
  setScore: (gameId: Id, score: Game['score']) => void;
  nextHalfInning: (gameId: Id) => void;
  prevHalfInning: (gameId: Id) => void;
  setNextBatter: (gameId: Id, side: Side, index: number) => void;
  /**
   * Without `target`: charts the batter due up in the current half-inning and
   * advances that side's pointer. With `target` (a backfill): stamps those
   * four fields and leaves both pointers and the clock alone.
   */
  recordAtBat: (gameId: Id, outcomeId: OutcomeId, target?: AtBatTarget) => AtBat | undefined;
  /** Re-judges an at-bat in place: `result` is derived from the outcome; the game document is never touched. */
  updateAtBat: (atBatId: Id, patch: AtBatPatch) => AtBat | undefined;
  /**
   * Removes an at-bat. That side's pointer rolls back to the batter's slot
   * only when the at-bat is the game's newest and the pointer sits right after
   * the slot (record-then-remove equals undo; a skip made since is kept).
   * The clock never changes. Returns the removed copy for `restoreAtBat`.
   * `keepPointer` skips the roll-back (undoing a backfill, which never moved
   * the pointer in the first place).
   */
  deleteAtBat: (atBatId: Id, opts?: { keepPointer?: boolean }) => AtBat | undefined;
  /** Puts a removed at-bat back (no-op if its id exists); pointers and clock untouched. */
  restoreAtBat: (atBat: AtBat) => void;
  undoLastAtBat: (gameId: Id) => AtBat | undefined;
  finishGame: (gameId: Id, input: { score: Game['score']; notes?: string }) => void;
  reopenGame: (gameId: Id) => void;

  resetDemoData: () => void;
  clearAllData: () => void;
};

const StoreContext = createContext<Store | undefined>(undefined);

type Persisted =
  | { kind: 'none' }
  | { kind: 'ok'; data: AppData }
  /** The key holds something this build cannot use (corrupt JSON, another schema version). */
  | { kind: 'unreadable'; raw: string };

function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<AppData>;
  return (
    doc.version === 1 &&
    Array.isArray(doc.teams) &&
    Array.isArray(doc.players) &&
    Array.isArray(doc.games) &&
    Array.isArray(doc.atBats)
  );
}

async function readPersisted(): Promise<Persisted> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not read saved data; starting fresh.', error);
    return { kind: 'none' };
  }
  if (!raw) return { kind: 'none' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAppData(parsed)) return { kind: 'ok', data: parsed };
    const version = parsed && typeof parsed === 'object' ? (parsed as { version?: unknown }).version : undefined;
    console.warn(`Saved data is not a version 1 document (version ${String(version)}); keeping a backup.`);
  } catch (error) {
    console.warn('Could not parse saved data; keeping a backup.', error);
  }
  return { kind: 'unreadable', raw };
}

async function backupUnreadable(raw: string): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKUP_KEY, raw);
  } catch (error) {
    console.warn('Could not back up the unreadable saved data.', error);
  }
}

async function writePersisted(data: AppData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Could not save data.', error);
  }
}

export function StoreProvider({ children, initialData }: { children: React.ReactNode; initialData?: AppData }) {
  const [data, setData] = useState<AppData>(initialData ?? EMPTY_DATA);
  const [ready, setReady] = useState(Boolean(initialData));
  const [loadIssue, setLoadIssue] = useState<LoadIssue | undefined>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mirror of the latest document so back-to-back actions in one tick see each other's results. */
  const dataRef = useRef<AppData>(data);
  const readyRef = useRef(ready);
  /** true when `dataRef.current` has changes that are not yet on disk. */
  const dirty = useRef(false);

  /** Write the document now if anything is pending (cancels the debounce). */
  const flushNow = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!dirty.current || !readyRef.current) return;
    dirty.current = false;
    void writePersisted(dataRef.current);
  }, []);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    (async () => {
      const saved = await readPersisted();
      if (cancelled) return;
      let next: AppData;
      if (saved.kind === 'ok') {
        next = saved.data;
      } else {
        if (saved.kind === 'unreadable') {
          // Never overwrite something we could not read: park it first.
          await backupUnreadable(saved.raw);
          if (cancelled) return;
          setLoadIssue('backed_up');
        }
        next = buildDemoData();
        // Persist the seed so its relative dates stop moving from day to day.
        dirty.current = true;
      }
      dataRef.current = next;
      readyRef.current = true;
      setData(next);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  // Debounced write after every change; flushNow() short-circuits it.
  useEffect(() => {
    if (!ready || !dirty.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushNow, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [data, ready, flushNow]);

  // Flush before the page/app goes away so the last tap is never lost. On web
  // localStorage writes are synchronous, so pagehide/beforeunload complete.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') flushNow();
      };
      window.addEventListener('pagehide', flushNow);
      window.addEventListener('beforeunload', flushNow);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        window.removeEventListener('pagehide', flushNow);
        window.removeEventListener('beforeunload', flushNow);
        document.removeEventListener('visibilitychange', onVisibility);
        flushNow();
      };
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flushNow();
    });
    return () => {
      subscription.remove();
      flushNow();
    };
  }, [flushNow]);

  /** Apply a pure update to the document. */
  const update = useCallback((fn: (d: AppData) => AppData) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    dirty.current = true;
    setData(next);
  }, []);

  const updateGameIn = useCallback(
    (gameId: Id, fn: (g: Game, d: AppData) => Game) => {
      update((d) => ({ ...d, games: d.games.map((g) => (g.id === gameId ? fn(g, d) : g)) }));
    },
    [update],
  );

  const store = useMemo<Store>(() => {
    const now = () => new Date().toISOString();

    return {
      data,
      ready,
      loadIssue,

      setOnboarded: (value) => update((d) => ({ ...d, onboarded: value })),

      addTeam: (name, season) => {
        const team: Team = {
          id: newId('t'),
          name: name.trim(),
          season: season ?? String(new Date().getFullYear()),
          defaultLineup: [],
          createdAt: now(),
        };
        update((d) => ({ ...d, teams: [...d.teams, team] }));
        return team;
      },

      updateTeam: (teamId, patch) =>
        update((d) => ({ ...d, teams: d.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)) })),

      deleteTeam: (teamId) =>
        update((d) => {
          const gameIds = new Set(d.games.filter((g) => g.teamId === teamId).map((g) => g.id));
          return {
            ...d,
            teams: d.teams.filter((t) => t.id !== teamId),
            players: d.players.filter((p) => p.teamId !== teamId),
            games: d.games.filter((g) => g.teamId !== teamId),
            atBats: d.atBats.filter((ab) => !gameIds.has(ab.gameId)),
          };
        }),

      setDefaultLineup: (teamId, lineup) =>
        update((d) => ({ ...d, teams: d.teams.map((t) => (t.id === teamId ? { ...t, defaultLineup: lineup } : t)) })),

      addPlayer: (teamId, input) => {
        const player: Player = {
          id: newId('p'),
          teamId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          number: input.number?.trim() || undefined,
        };
        update((d) => ({
          ...d,
          players: [...d.players, player],
          // New players go to the bottom of the default lineup so they show up right away.
          teams: d.teams.map((t) =>
            t.id === teamId ? { ...t, defaultLineup: [...t.defaultLineup, { playerId: player.id }] } : t,
          ),
        }));
        return player;
      },

      updatePlayer: (playerId, patch) =>
        update((d) => ({
          ...d,
          players: d.players.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  ...(patch.firstName !== undefined ? { firstName: patch.firstName.trim() } : {}),
                  ...(patch.lastName !== undefined ? { lastName: patch.lastName.trim() } : {}),
                  ...(patch.number !== undefined ? { number: patch.number.trim() || undefined } : {}),
                }
              : p,
          ),
        })),

      // Historical at-bats are kept so past games and season totals stay honest
      // (the season table shows them under a "Removed players" row).
      removePlayer: (playerId) =>
        update((d) => ({
          ...d,
          players: d.players.filter((p) => p.id !== playerId),
          teams: d.teams.map((t) => ({ ...t, defaultLineup: t.defaultLineup.filter((s) => s.playerId !== playerId) })),
          games: d.games.map((g) => {
            if (g.status === 'final') return g;
            // Upcoming games drop the slot. A game in progress keeps its order
            // (the CTG screen shows the slot as "Removed player"), but no
            // further at-bat is ever credited to the missing pitcher.
            const lineup = g.status === 'scheduled' ? g.lineup.filter((s) => s.playerId !== playerId) : g.lineup;
            return {
              ...g,
              lineup,
              ourNextBatter: carryNextBatter(g.lineup, g.ourNextBatter, lineup, (s) => s.playerId),
              pitcherId: g.pitcherId === playerId ? undefined : g.pitcherId,
            };
          }),
        })),

      addGame: (teamId, input) => {
        const team = dataRef.current.teams.find((t) => t.id === teamId);
        const lineup = team ? [...team.defaultLineup] : [];
        const pitcher = lineup.find((s) => s.position === 'P')?.playerId;
        const game: Game = {
          id: newId('g'),
          teamId,
          opponent: input.opponent.trim(),
          isAway: input.isAway,
          startsAt: input.startsAt,
          status: 'scheduled',
          lineup,
          opponentLineup: defaultOpponentLineup(),
          pitcherId: pitcher,
          inning: 1,
          half: 'top',
          ourNextBatter: 0,
          theirNextBatter: 0,
          score: { us: 0, them: 0 },
          notes: input.notes?.trim() || undefined,
          createdAt: now(),
        };
        update((d) => ({ ...d, games: [...d.games, game] }));
        return game;
      },

      updateGame: (gameId, patch) => updateGameIn(gameId, (g) => ({ ...g, ...patch })),

      deleteGame: (gameId) =>
        update((d) => ({
          ...d,
          games: d.games.filter((g) => g.id !== gameId),
          atBats: d.atBats.filter((ab) => ab.gameId !== gameId),
        })),

      setGameLineup: (gameId, lineup) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          lineup,
          ourNextBatter: carryNextBatter(g.lineup, g.ourNextBatter, lineup, (s) => s.playerId),
        })),

      setOpponentLineup: (gameId, batters) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          opponentLineup: batters,
          theirNextBatter: carryNextBatter(g.opponentLineup, g.theirNextBatter, batters, (b) => b.id),
        })),

      setPitcher: (gameId, playerId, opts) =>
        update((d) => {
          const game = d.games.find((g) => g.id === gameId);
          if (!game) return d;
          // Opponent at-bats charted this half-inning before a pitcher was
          // chosen were thrown by this pitcher: credit them now. At-bats that
          // already name a pitcher are only re-credited when asked to
          // (`recreditHalf`: the change happened before they were charted).
          const recredit = Boolean(opts?.recreditHalf);
          const atBats =
            playerId === undefined
              ? d.atBats
              : d.atBats.map((ab) =>
                  ab.gameId === gameId &&
                  ab.side === 'them' &&
                  (ab.pitcherId === undefined || (recredit && ab.pitcherId !== playerId)) &&
                  ab.inning === game.inning &&
                  ab.half === game.half
                    ? { ...ab, pitcherId: playerId }
                    : ab,
                );
          return { ...d, atBats, games: d.games.map((g) => (g.id === gameId ? { ...g, pitcherId: playerId } : g)) };
        }),

      // Any run on the board means the game is under way.
      setScore: (gameId, score) =>
        updateGameIn(gameId, (g) => {
          const next = { us: Math.max(0, score.us), them: Math.max(0, score.them) };
          const started = next.us > 0 || next.them > 0;
          return { ...g, score: next, status: g.status === 'scheduled' && started ? 'in_progress' : g.status };
        }),

      nextHalfInning: (gameId) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          ...nextHalf(g.inning, g.half),
          status: g.status === 'scheduled' ? 'in_progress' : g.status,
        })),

      prevHalfInning: (gameId) => updateGameIn(gameId, (g) => ({ ...g, ...prevHalf(g.inning, g.half) })),

      setNextBatter: (gameId, side, index) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          status: g.status === 'scheduled' ? 'in_progress' : g.status,
          ...(side === 'us' ? { ourNextBatter: index } : { theirNextBatter: index }),
        })),

      recordAtBat: (gameId, outcomeId, target) => {
        const game = dataRef.current.games.find((g) => g.id === gameId);
        if (!game) return undefined;
        const outcome = getOutcome(outcomeId);

        if (target) {
          // A backfill: the at-bat goes where the coach says; nothing else moves.
          const atBat: AtBat = {
            id: newId('ab'),
            gameId,
            side: target.side,
            batterId: target.batterId,
            pitcherId: target.side === 'them' ? game.pitcherId : undefined,
            inning: target.inning,
            half: target.half,
            outcomeId,
            result: outcome.result,
            recordedAt: now(),
          };
          update((d) => ({
            ...d,
            atBats: [...d.atBats, atBat],
            games: d.games.map((g) =>
              g.id === gameId ? { ...g, status: g.status === 'scheduled' ? 'in_progress' : g.status } : g,
            ),
          }));
          flushNow();
          return atBat;
        }

        const side = battingSide(game);
        const order = side === 'us' ? game.lineup : game.opponentLineup;
        if (order.length === 0) return undefined;
        const index = side === 'us' ? game.ourNextBatter % order.length : game.theirNextBatter % order.length;
        const batterId = side === 'us' ? game.lineup[index].playerId : game.opponentLineup[index].id;
        const atBat: AtBat = {
          id: newId('ab'),
          gameId,
          side,
          batterId,
          pitcherId: side === 'them' ? game.pitcherId : undefined,
          inning: game.inning,
          half: game.half,
          outcomeId,
          result: outcome.result,
          recordedAt: now(),
        };
        update((d) => ({
          ...d,
          atBats: [...d.atBats, atBat],
          games: d.games.map((g) => {
            if (g.id !== gameId) return g;
            const nextIndex = (index + 1) % order.length;
            return {
              ...g,
              status: g.status === 'scheduled' ? 'in_progress' : g.status,
              ...(side === 'us' ? { ourNextBatter: nextIndex } : { theirNextBatter: nextIndex }),
            };
          }),
        }));
        // One tap every few seconds: write it straight away.
        flushNow();
        return atBat;
      },

      updateAtBat: (atBatId, patch) => {
        const current = dataRef.current.atBats.find((ab) => ab.id === atBatId);
        if (!current) return undefined;
        const next: AtBat = { ...current };
        if (patch.outcomeId !== undefined) next.outcomeId = patch.outcomeId;
        if (patch.batterId !== undefined) next.batterId = patch.batterId;
        // An explicit `pitcherId: undefined` clears the pitcher (and restores an at-bat that had none).
        if ('pitcherId' in patch) next.pitcherId = patch.pitcherId;
        if (patch.inning !== undefined) next.inning = Math.max(1, Math.round(patch.inning));
        if (patch.half !== undefined) next.half = patch.half;
        // The letter is always derived from the outcome, never stored on its own.
        next.result = getOutcome(next.outcomeId).result;
        update((d) => ({ ...d, atBats: d.atBats.map((ab) => (ab.id === atBatId ? next : ab)) }));
        flushNow();
        return next;
      },

      deleteAtBat: (atBatId, opts) => {
        const removed = dataRef.current.atBats.find((ab) => ab.id === atBatId);
        if (!removed) return undefined;
        update((d) => {
          const gameAtBats = d.atBats.filter((ab) => ab.gameId === removed.gameId);
          const isNewest = newestAtBat(gameAtBats)?.id === atBatId;
          return {
            ...d,
            atBats: d.atBats.filter((ab) => ab.id !== atBatId),
            games: d.games.map((g) => {
              if (g.id !== removed.gameId || !isNewest || opts?.keepPointer) return g;
              // Record-then-remove is an undo: the batter is due up again. Any
              // other pointer position (a skip since, an earlier at-bat, a
              // batter who left the order) is left exactly where it is.
              const slot =
                removed.side === 'us'
                  ? g.lineup.findIndex((s) => s.playerId === removed.batterId)
                  : g.opponentLineup.findIndex((b) => b.id === removed.batterId);
              if (slot < 0) return g;
              const n = removed.side === 'us' ? g.lineup.length : g.opponentLineup.length;
              const pointer = removed.side === 'us' ? g.ourNextBatter : g.theirNextBatter;
              if (pointer !== (slot + 1) % n) return g;
              return { ...g, ...(removed.side === 'us' ? { ourNextBatter: slot } : { theirNextBatter: slot }) };
            }),
          };
        });
        flushNow();
        return removed;
      },

      restoreAtBat: (atBat) => {
        const d = dataRef.current;
        if (d.atBats.some((ab) => ab.id === atBat.id)) return;
        if (!d.games.some((g) => g.id === atBat.gameId)) return;
        // Array order is irrelevant: every view sorts by inning, half, recordedAt.
        update((doc) => ({ ...doc, atBats: [...doc.atBats, atBat] }));
        flushNow();
      },

      undoLastAtBat: (gameId) => {
        const last = [...dataRef.current.atBats].reverse().find((ab) => ab.gameId === gameId);
        if (!last) return undefined;
        update((d) => ({
          ...d,
          atBats: d.atBats.filter((ab) => ab.id !== last.id),
          games: d.games.map((g) => {
            if (g.id !== gameId) return g;
            const order = last.side === 'us' ? g.lineup : g.opponentLineup;
            const len = Math.max(1, order.length);
            const current = last.side === 'us' ? g.ourNextBatter : g.theirNextBatter;
            // The undone batter is due up again. Fall back to stepping back one
            // slot if they have since left the order.
            const undoneIndex =
              last.side === 'us'
                ? g.lineup.findIndex((s) => s.playerId === last.batterId)
                : g.opponentLineup.findIndex((b) => b.id === last.batterId);
            const rolledBack = undoneIndex >= 0 ? undoneIndex : (current - 1 + len) % len;
            return {
              ...g,
              inning: last.inning,
              half: last.half,
              ...(last.side === 'us' ? { ourNextBatter: rolledBack } : { theirNextBatter: rolledBack }),
            };
          }),
        }));
        flushNow();
        return last;
      },

      finishGame: (gameId, input) => {
        updateGameIn(gameId, (g) => ({
          ...g,
          status: 'final',
          score: input.score,
          notes: input.notes?.trim() || undefined,
          finishedAt: now(),
        }));
        flushNow();
      },

      reopenGame: (gameId) => updateGameIn(gameId, (g) => ({ ...g, status: 'in_progress', finishedAt: undefined })),

      resetDemoData: () => {
        update((d) => ({ ...buildDemoData(), onboarded: d.onboarded }));
        flushNow();
      },

      clearAllData: () => {
        update((d) => ({ ...EMPTY_DATA, onboarded: d.onboarded }));
        flushNow();
      },
    };
  }, [data, ready, loadIssue, update, updateGameIn, flushNow]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}

export function useTeam(teamId: Id | undefined): Team | undefined {
  const { data } = useStore();
  return data.teams.find((t) => t.id === teamId);
}

export function useGame(gameId: Id | undefined): Game | undefined {
  const { data } = useStore();
  return data.games.find((g) => g.id === gameId);
}

export function useTeamPlayers(teamId: Id | undefined): Player[] {
  const { data } = useStore();
  return useMemo(() => data.players.filter((p) => p.teamId === teamId), [data.players, teamId]);
}

export function useTeamGames(teamId: Id | undefined): Game[] {
  const { data } = useStore();
  return useMemo(() => data.games.filter((g) => g.teamId === teamId), [data.games, teamId]);
}

export function useGameAtBats(gameId: Id | undefined): AtBat[] {
  const { data } = useStore();
  return useMemo(() => data.atBats.filter((ab) => ab.gameId === gameId), [data.atBats, gameId]);
}
