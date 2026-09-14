import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

export type Store = {
  data: AppData;
  /** false until the persisted document has been read. */
  ready: boolean;

  setOnboarded: (value: boolean) => void;

  addTeam: (name: string, season?: string) => Team;
  updateTeam: (teamId: Id, patch: Partial<Pick<Team, 'name' | 'season'>>) => void;
  deleteTeam: (teamId: Id) => void;
  setDefaultLineup: (teamId: Id, lineup: LineupSlot[]) => void;

  addPlayer: (teamId: Id, input: NewPlayerInput) => Player;
  updatePlayer: (playerId: Id, patch: Partial<NewPlayerInput>) => void;
  removePlayer: (playerId: Id) => void;

  addGame: (teamId: Id, input: NewGameInput) => Game;
  updateGame: (gameId: Id, patch: Partial<Omit<Game, 'id' | 'teamId'>>) => void;
  deleteGame: (gameId: Id) => void;
  setGameLineup: (gameId: Id, lineup: LineupSlot[]) => void;
  setOpponentLineup: (gameId: Id, batters: OpponentBatter[]) => void;
  setPitcher: (gameId: Id, playerId: Id | undefined) => void;
  setScore: (gameId: Id, score: Game['score']) => void;
  nextHalfInning: (gameId: Id) => void;
  prevHalfInning: (gameId: Id) => void;
  setNextBatter: (gameId: Id, side: Side, index: number) => void;
  recordAtBat: (gameId: Id, outcomeId: OutcomeId) => AtBat | undefined;
  undoLastAtBat: (gameId: Id) => AtBat | undefined;
  finishGame: (gameId: Id, input: { score: Game['score']; notes?: string }) => void;
  reopenGame: (gameId: Id) => void;

  resetDemoData: () => void;
  clearAllData: () => void;
};

const StoreContext = createContext<Store | undefined>(undefined);

async function readPersisted(): Promise<AppData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (error) {
    console.warn('Could not read saved data; starting fresh.', error);
    return null;
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mirror of the latest document so back-to-back actions in one tick see each other's results. */
  const dataRef = useRef<AppData>(data);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    readPersisted().then((saved) => {
      if (cancelled) return;
      const next = saved ?? buildDemoData();
      dataRef.current = next;
      setData(next);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => writePersisted(data), 150);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, ready]);

  /** Apply a pure update to the document. */
  const update = useCallback((fn: (d: AppData) => AppData) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
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

      // Historical at-bats are kept so past games and season totals stay honest.
      removePlayer: (playerId) =>
        update((d) => ({
          ...d,
          players: d.players.filter((p) => p.id !== playerId),
          teams: d.teams.map((t) => ({ ...t, defaultLineup: t.defaultLineup.filter((s) => s.playerId !== playerId) })),
          games: d.games.map((g) =>
            g.status === 'scheduled'
              ? {
                  ...g,
                  lineup: g.lineup.filter((s) => s.playerId !== playerId),
                  pitcherId: g.pitcherId === playerId ? undefined : g.pitcherId,
                }
              : g,
          ),
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
          ourNextBatter: lineup.length ? Math.min(g.ourNextBatter, lineup.length - 1) : 0,
        })),

      setOpponentLineup: (gameId, batters) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          opponentLineup: batters,
          theirNextBatter: batters.length ? Math.min(g.theirNextBatter, batters.length - 1) : 0,
        })),

      setPitcher: (gameId, playerId) => updateGameIn(gameId, (g) => ({ ...g, pitcherId: playerId })),

      setScore: (gameId, score) =>
        updateGameIn(gameId, (g) => ({ ...g, score: { us: Math.max(0, score.us), them: Math.max(0, score.them) } })),

      nextHalfInning: (gameId) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          ...nextHalf(g.inning, g.half),
          status: g.status === 'scheduled' ? 'in_progress' : g.status,
        })),

      prevHalfInning: (gameId) => updateGameIn(gameId, (g) => ({ ...g, ...prevHalf(g.inning, g.half) })),

      setNextBatter: (gameId, side, index) =>
        updateGameIn(gameId, (g) =>
          side === 'us' ? { ...g, ourNextBatter: index } : { ...g, theirNextBatter: index },
        ),

      recordAtBat: (gameId, outcomeId) => {
        const game = dataRef.current.games.find((g) => g.id === gameId);
        if (!game) return undefined;
        const side = battingSide(game);
        const order = side === 'us' ? game.lineup : game.opponentLineup;
        if (order.length === 0) return undefined;
        const index = side === 'us' ? game.ourNextBatter % order.length : game.theirNextBatter % order.length;
        const batterId = side === 'us' ? game.lineup[index].playerId : game.opponentLineup[index].id;
        const outcome = getOutcome(outcomeId);
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
        return atBat;
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
        return last;
      },

      finishGame: (gameId, input) =>
        updateGameIn(gameId, (g) => ({
          ...g,
          status: 'final',
          score: input.score,
          notes: input.notes?.trim() || undefined,
          finishedAt: now(),
        })),

      reopenGame: (gameId) => updateGameIn(gameId, (g) => ({ ...g, status: 'in_progress', finishedAt: undefined })),

      resetDemoData: () => update((d) => ({ ...buildDemoData(), onboarded: d.onboarded })),

      clearAllData: () => update((d) => ({ ...EMPTY_DATA, onboarded: d.onboarded })),
    };
  }, [data, ready, update, updateGameIn]);

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
