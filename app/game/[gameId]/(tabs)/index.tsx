import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import AppHeader from '@/components/AppHeader';
import CaptureDock, { type DockLast, type DockRejudge } from '@/components/CaptureDock';
import type { NeedleSide } from '@/components/CTGGauge';
import InningStrip from '@/components/InningStrip';
import MiniChips, { type MiniChip } from '@/components/MiniChips';
import ResultTile from '@/components/ResultTile';
import Screen from '@/components/Screen';
import { Button, EmptyState, WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { compareClock, displayResult, invertResult, sortAtBats } from '@/lib/atbats';
import { confirmAction } from '@/lib/confirm';
import { gameTitle, halfLabel, opponentBatterLabel, playerLabel, playerShort } from '@/lib/format';
import { isPlain, outcomeLabel, outcomeShort, plainFor } from '@/lib/outcomes';
import { hittingFor, leftGameBatterIds } from '@/lib/stats';
import { battingSide, useGame, useGameAtBats, useStore, useTeamPlayers, type AtBatPatch } from '@/lib/store';
import type { AtBat, Game, Half, OutcomeId, Result, Side } from '@/lib/types';
import { useTypesExpanded } from '@/lib/uiPrefs';
import { applyUndo, popUndo, pushUndo, undoLabel, useUndoStack } from '@/lib/undo';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Batter = {
  id: string;
  label: string;
  short: string;
  /** A finished game: this batter has at-bats but is no longer in the order (a muted "LEFT GAME" row). */
  left?: boolean;
};

/** Which row to bring into view after the next render. */
type PendingScroll = { kind: 'current' } | { kind: 'batter'; batterId: string } | null;

/** How far above the row we scroll, so exactly one previous row stays in view. */
const SCROLL_LEAD = 56;
/** The fourteen record buttons ignore presses this long after a record, so a double tap cannot chart two batters. */
const LOCK_MS = 450;
/**
 * Leaving re-judge mode swaps the dock's context row (▶ Now / More… give way
 * to LAST / Undo) and may collapse a forced-open grid, so the LAST readout and
 * Undo ignore presses this long after the switch: a double tap on ▶ Now or on
 * a type must not land on the control that moved under the finger. The record
 * lockout stays separate and never blocks Undo.
 */
const MODE_SWITCH_MS = 350;
/** Below this window width "IN THE HOLE" breaks onto two lines so the longest names keep their jersey number. */
const TAG_ONE_LINE_MIN_WIDTH = 390;
/** Windows at least this tall open the outcome types by default (until the coach toggles them). */
const TYPES_DEFAULT_OPEN_HEIGHT = 760;
/** Below this window height the grid uses the 'tiny' size. */
const COMPACT_MIN_HEIGHT = 700;
/** An open dock taller than this share of the window collapses its types automatically. */
const DOCK_MAX_SHARE = 0.6;
/** How long a re-judged row keeps its tint. */
const FLASH_MS = 1000;

/** Which side is up on the CTG screen: a final game always shows our lineup. */
function screenSide(game: Game | undefined): Side {
  return game && game.status !== 'final' ? battingSide(game) : 'us';
}

function currentIndex(game: Game | undefined, side: Side): number {
  if (!game) return 0;
  const n = side === 'us' ? game.lineup.length : game.opponentLineup.length;
  return n ? (side === 'us' ? game.ourNextBatter : game.theirNextBatter) % n : 0;
}

/** The half-inning after this one (mirrors the store's clock). */
function advanceClock(clock: { inning: number; half: Half }): { inning: number; half: Half } {
  return clock.half === 'top' ? { inning: clock.inning, half: 'bottom' } : { inning: clock.inning + 1, half: 'top' };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * The CTG charting screen: a fixed header and inning strip, the batting
 * side's order scrolling in the middle (every at-bat a tappable tile or mini
 * chip), and the fixed Capture Dock at the bottom where the big L and W
 * record a plain at-bat in one tap and the twelve types sit underneath.
 * Tapping a tile puts the dock in re-judge mode for that at-bat.
 */
export default function ChartTheGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const store = useStore();
  const { setNextBatter, recordAtBat, updateAtBat, nextHalfInning, prevHalfInning, reopenGame } = store;
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const undoStack = useUndoStack(game?.id);

  /** The at-bat being re-judged, if any. */
  const [selection, setSelection] = useState<string | null>(null);
  const [needle, setNeedle] = useState<NeedleSide>('center');
  const [pulse, setPulse] = useState(0);
  /** A just re-judged at-bat: its row is tinted for a second. */
  const [flash, setFlash] = useState<{ id: string; result: Result } | null>(null);
  const [typesPref, setTypesPref, typesExplicit] = useTypesExpanded(windowHeight >= TYPES_DEFAULT_OPEN_HEIGHT);
  /** "add type ›" opens the grid for that re-judge without changing the saved preference. */
  const [typesForced, setTypesForced] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);
  const lockedUntil = useRef(0);
  const modeSwitchedAt = useRef(0);
  const needleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const rowRefs = useRef<Record<string, View | null>>({});
  const mounted = useRef(false);
  const pendingScroll = useRef<PendingScroll>(null);

  const sorted = useMemo(() => sortAtBats(atBats), [atBats]);
  const selected = selection ? sorted.find((ab) => ab.id === selection) : undefined;
  const isFinal = game?.status === 'final';
  const liveSide = screenSide(game);
  // Selecting an at-bat of the side not batting peeks that side's order until the selection clears.
  const side: Side = selected && !isFinal ? selected.side : liveSide;
  const peeking = side !== liveSide;
  const current = currentIndex(game, side);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const orderFor = useCallback(
    (s: Side): Batter[] => {
      if (!game) return [];
      if (s === 'us') {
        return game.lineup.map((slot) => {
          const p = playersById.get(slot.playerId);
          return { id: slot.playerId, label: p ? playerLabel(p) : 'Removed player', short: p ? playerShort(p) : 'Removed player' };
        });
      }
      return game.opponentLineup.map((b) => ({ id: b.id, label: opponentBatterLabel(b), short: opponentBatterLabel(b) }));
    },
    [game, playersById],
  );
  const order = useMemo(() => orderFor(side), [orderFor, side]);

  useEffect(
    () => () => {
      if (needleTimer.current) clearTimeout(needleTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  // Leaving the screen (a modal route, another tab) ends any selection.
  useFocusEffect(
    useCallback(
      () => () => {
        setSelection(null);
        setTypesForced(false);
      },
      [],
    ),
  );

  // The selected at-bat was removed elsewhere (the editor): back to live.
  useEffect(() => {
    if (selection && !selected) {
      setSelection(null);
      setTypesForced(false);
    }
  }, [selection, selected]);

  // On open, and whenever the list switches sides (Next/Prev half, a peek
  // starting or ending), bring the current batter into view unless a handler
  // already chose a row. A final game has no current batter: it opens at the top.
  useEffect(() => {
    if (!pendingScroll.current && !isFinal) pendingScroll.current = { kind: 'current' };
  }, [game?.id, side, isFinal]);

  // Only the height-based default is ever auto-collapsed: a saved preference is
  // the coach's own choice, and "add type ›" (typesForced) always wins.
  const typesOpen = typesForced || (typesPref && (typesExplicit || !autoCollapsed));
  // Heights come from onLayout: an open dock past 60% of the window collapses the types (large system text).
  useEffect(() => {
    if (typesOpen && !typesForced && !typesExplicit && dockHeight > windowHeight * DOCK_MAX_SHARE) setAutoCollapsed(true);
  }, [typesOpen, typesForced, typesExplicit, dockHeight, windowHeight]);
  useEffect(() => setAutoCollapsed(false), [windowHeight]);

  // The one scroll rule: after a record, undo, skip, half flip or a stepper
  // selection, put the row 56pt below the top so one previous row stays in view.
  useEffect(() => {
    const pending = pendingScroll.current;
    if (!pending) return;
    pendingScroll.current = null;
    const animated = mounted.current;
    mounted.current = true;
    const id = pending.kind === 'current' ? order[current]?.id : pending.batterId;
    const row = id ? rowRefs.current[id] : null;
    const content = contentRef.current;
    if (!row || !content) return;
    row.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_LEAD), animated }),
      () => {},
    );
  });

  if (!game) return null;

  const n = order.length;
  const onDeck = n > 1 ? (current + 1) % n : -1;
  const inHole = n > 2 ? (current + 2) % n : -1;
  const liveOrder = peeking ? orderFor(liveSide) : order;
  const liveCurrent = currentIndex(game, liveSide);
  const currentBatter: Batter | undefined = liveOrder[liveCurrent];
  const pitcher = playersById.get(game.pitcherId ?? '');
  const needsPitcher = !isFinal && liveSide === 'them' && !pitcher;
  const livePerspective = liveSide === 'us' ? 'batter' : 'pitcher';
  const newest = sorted.length ? sorted[sorted.length - 1] : undefined;
  // The clock is behind the newest charted half (Prev half): the strip shows the review line.
  const reviewing = !isFinal && newest && compareClock(game, newest) < 0 ? { inning: newest.inning, half: newest.half } : undefined;
  const inCurrentHalf = (ab: AtBat) => ab.inning === game.inning && ab.half === game.half;

  /** Every at-bat of the displayed side, per batter, in game order. */
  const atBatsByBatter = new Map<string, AtBat[]>();
  for (const ab of sorted) {
    if (ab.side !== side) continue;
    const list = atBatsByBatter.get(ab.batterId);
    if (list) list.push(ab);
    else atBatsByBatter.set(ab.batterId, [ab]);
  }
  const newestThisHalf = (abs: AtBat[]): AtBat | undefined => {
    let found: AtBat | undefined;
    for (const ab of abs) if (inCurrentHalf(ab)) found = ab;
    return found;
  };

  const shortName = (s: Side, batterId: string): string => {
    if (s === 'us') {
      const p = playersById.get(batterId);
      return p ? playerShort(p) : 'Removed player';
    }
    const b = game.opponentLineup.find((x) => x.id === batterId);
    return b ? opponentBatterLabel(b) : 'Removed batter';
  };

  const chipsFor = (abs: AtBat[]): MiniChip[] =>
    abs.map((ab) => ({
      id: ab.id,
      result: displayResult(ab),
      selected: ab.id === selection,
      accessibilityLabel: `Re-judge ${shortName(ab.side, ab.batterId)}: ${displayResult(ab)}, ${halfLabel(ab.inning, ab.half)}`,
    }));

  const locked = () => Date.now() < lockedUntil.current;
  const lock = () => {
    lockedUntil.current = Date.now() + LOCK_MS;
  };

  const swingNeedle = (result: Result) => {
    setNeedle(result);
    setPulse((p) => p + 1);
    if (needleTimer.current) clearTimeout(needleTimer.current);
    needleTimer.current = setTimeout(() => setNeedle('center'), 1500);
  };

  const flashRow = (id: string, result: Result) => {
    setFlash({ id, result });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const clearSelection = () => {
    setSelection(null);
    setTypesForced(false);
  };
  /** Re-judge mode ends from a dock tap (▶ Now, a commit, › past the newest): the context row is about to move. */
  const leaveRejudge = () => {
    modeSwitchedAt.current = Date.now();
    clearSelection();
  };
  const justSwitched = () => Date.now() - modeSwitchedAt.current < MODE_SWITCH_MS;

  /** Puts the dock in re-judge mode for an at-bat; steppers and the readout also scroll its row into view. */
  const selectAtBat = (id: string, opts?: { scroll?: boolean; openTypes?: boolean }) => {
    const ab = sorted.find((x) => x.id === id);
    if (!ab || isFinal) return;
    setSelection(id);
    if (opts?.openTypes) setTypesForced(true);
    if (opts?.scroll) pendingScroll.current = { kind: 'batter', batterId: ab.batterId };
  };

  const openBatter = (batterId: string) => {
    if (locked()) return; // a double tap on a skip target lands here once the row re-renders as current
    router.push(`/game/${game.id}/batter/${side}/${batterId}`);
  };
  const openEditor = (atBatId: string) => router.push(`/game/${game.id}/atbat/${atBatId}`);

  const handleRecord = (outcomeId: OutcomeId) => {
    if (locked() || needsPitcher) return;
    const ab = recordAtBat(game.id, outcomeId);
    if (!ab) return;
    pushUndo(game.id, { kind: 'record', atBat: ab });
    lock();
    swingNeedle(displayResult(ab));
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };

  /** A re-judge commit: apply the patch, remember the previous fields for Undo, and snap back to live. */
  const commitRejudge = (ab: AtBat, patch: AtBatPatch) => {
    if (locked()) return;
    const previous = { outcomeId: ab.outcomeId, result: ab.result, batterId: ab.batterId, pitcherId: ab.pitcherId, inning: ab.inning, half: ab.half };
    const updated = updateAtBat(ab.id, patch);
    if (!updated) return;
    pushUndo(game.id, { kind: 'rejudge', atBatId: ab.id, previous });
    lock();
    swingNeedle(displayResult(updated));
    flashRow(ab.id, displayResult(updated));
    leaveRejudge();
  };

  /** A big button, by the letter shown. Chart mode records a plain at-bat; re-judge flips the outlined letter. */
  const handleBig = (letter: Result) => {
    if (selected) {
      if (letter === displayResult(selected)) return; // the solid letter changes nothing
      const batterResult = selected.side === 'us' ? letter : invertResult(letter);
      commitRejudge(selected, { outcomeId: plainFor(batterResult) });
      return;
    }
    handleRecord(plainFor(liveSide === 'us' ? letter : invertResult(letter)));
  };

  const handleOutcome = (outcomeId: OutcomeId) => {
    if (selected) {
      // The ringed type again drops the at-bat to plain with the same result.
      commitRejudge(selected, { outcomeId: outcomeId === selected.outcomeId ? plainFor(selected.result) : outcomeId });
      return;
    }
    handleRecord(outcomeId);
  };

  const handleUndo = () => {
    if (justSwitched()) return; // Undo just appeared where ▶ Now or a type was; the record lockout never applies here
    const entry = popUndo(game.id);
    if (!entry) return;
    applyUndo(entry, game, store);
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };

  const selectedIndex = selected ? sorted.findIndex((ab) => ab.id === selected.id) : -1;
  const stepBack = () => {
    if (!sorted.length) return;
    const target = selectedIndex === -1 ? sorted[sorted.length - 1] : sorted[selectedIndex - 1];
    if (target) selectAtBat(target.id, { scroll: true });
  };
  const stepForward = () => {
    if (selectedIndex === -1) return;
    const target = sorted[selectedIndex + 1];
    if (target) selectAtBat(target.id, { scroll: true });
    else leaveRejudge(); // past the newest: back to live
  };

  /** The forward-step target on a row brings that batter up now; multi-batter skips are confirmed by name. */
  const skipTo = async (i: number) => {
    // The list scrolls after a skip, so a double tap can land on another row's skip target.
    if (locked() || i === current || peeking) return;
    const target = order[i];
    const from = order[current];
    const forward = (i - current + n) % n;
    let skipped = 0;
    for (let k = 1; k < forward; k++) {
      const abs = atBatsByBatter.get(order[(current + k) % n].id) ?? [];
      if (!newestThisHalf(abs)) skipped++;
    }
    const already = Boolean(newestThisHalf(atBatsByBatter.get(target.id) ?? []));
    let ok = true;
    if (forward !== 1) {
      if (already) {
        ok = await confirmAction(
          'Another at-bat?',
          `${target.label} already batted this half. Give him another at-bat now?${skipped ? ` ${plural(skipped, 'batter')} will be skipped.` : ''}`,
          'Bring up',
        );
      } else if (skipped > 0) {
        ok = await confirmAction('Skip batters?', `Bring ${target.label} up now? ${plural(skipped, 'batter')} will be skipped.`, 'Bring up');
      }
    }
    // Every path locks (a double tap on the skip target would otherwise open the
    // batter sheet once the row is current), set after any dialog resolves, never before.
    lock();
    if (!ok) return;
    pushUndo(game.id, { kind: 'skip', side, fromBatterId: from.id, toBatterId: target.id });
    setNextBatter(game.id, side, i);
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };

  const handleNextHalf = () => {
    nextHalfInning(game.id);
    pushUndo(game.id, { kind: 'half', direction: 'next' });
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };
  const handlePrevHalf = () => {
    if (game.inning === 1 && game.half === 'top') return; // the store would not move either
    prevHalfInning(game.id);
    pushUndo(game.id, { kind: 'half', direction: 'prev' });
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };
  /** Steps the clock forward to the newest charted half, one undoable Next half at a time. */
  const handleJumpAhead = () => {
    if (!reviewing) return;
    let clock = { inning: game.inning, half: game.half };
    let steps = 0;
    while (compareClock(clock, reviewing) < 0 && steps < 100) {
      clock = advanceClock(clock);
      steps++;
    }
    for (let k = 0; k < steps; k++) {
      nextHalfInning(game.id);
      pushUndo(game.id, { kind: 'half', direction: 'next' });
    }
    clearSelection();
    pendingScroll.current = { kind: 'current' };
  };
  const handleEndGame = () => {
    clearSelection();
    router.push(`/game/${game.id}/finish`);
  };

  const toggleTypes = () => {
    setAutoCollapsed(false);
    setTypesForced(false);
    setTypesPref(!typesOpen);
  };

  // ---- Dock content ----

  const top = undoStack.length ? undoStack[undoStack.length - 1] : undefined;
  const last: DockLast | undefined = newest
    ? {
        name: shortName(newest.side, newest.batterId),
        result: displayResult(newest),
        label: outcomeLabel(newest.outcomeId),
        half: inCurrentHalf(newest) ? undefined : halfLabel(newest.inning, newest.half),
        onPress: () => {
          if (justSwitched()) return; // the readout just appeared under ▶ Now's left half
          selectAtBat(newest.id, { scroll: true, openTypes: isPlain(newest.outcomeId) });
        },
      }
    : undefined;
  const rejudge: DockRejudge | undefined = selected
    ? {
        readout: `${shortName(selected.side, selected.batterId)} · ${halfLabel(selected.inning, selected.half)} · ${displayResult(selected)} · ${
          outcomeLabel(selected.outcomeId) || 'no play type'
        }`,
        recorded: displayResult(selected),
        perspective: selected.side === 'us' ? 'batter' : 'pitcher',
        selectedId: isPlain(selected.outcomeId) ? undefined : selected.outcomeId,
        onNow: leaveRejudge,
        onMore: () => openEditor(selected.id),
      }
    : undefined;
  const headerChips = currentBatter ? chipsFor(sorted.filter((ab) => ab.side === liveSide && ab.batterId === currentBatter.id)) : [];
  const header = {
    label: reviewing ? `AT-BAT · ${halfLabel(game.inning, game.half)}` : 'AT-BAT',
    color: reviewing ? colors.amberInk : liveSide === 'us' ? colors.primaryDark : colors.pitching,
    title: currentBatter ? `${liveCurrent + 1}. ${currentBatter.label}` : 'No batters',
    chips: headerChips,
  };
  // While pitching the big W records our pitcher's win (the batter's L), so the
  // labels speak in the pitcher's perspective like everything else on that side.
  const batterName = currentBatter?.label ?? 'batter';
  const pitcherName = pitcher ? playerShort(pitcher) : 'Our pitcher';
  const bigLabels: Record<Result, string> = selected
    ? { L: 'Change to L', W: 'Change to W' }
    : liveSide === 'us'
      ? { L: `Loss for ${batterName}`, W: `Win for ${batterName}` }
      : { L: `${pitcherName} lost to ${batterName}`, W: `${pitcherName} won against ${batterName}` };

  const finalWord = game.score.us > game.score.them ? 'Won' : game.score.us < game.score.them ? 'Lost' : 'Tied';
  const finalColor = finalWord === 'Won' ? colors.win : finalWord === 'Lost' ? colors.loss : colors.text;

  // ---- Rows ----

  // A finished game lists every at-bat: batters who left the order after
  // batting follow the lineup as muted "LEFT GAME" rows, so the tiles add up
  // to the game's hitting line (the Stats grid appends the same rows).
  const leftRows: Batter[] = isFinal
    ? leftGameBatterIds(atBats, game.id, 'us', game.lineup.map((s) => s.playerId)).map((id) => {
        const p = playersById.get(id);
        return { id, label: p ? playerLabel(p) : 'Removed player', short: p ? playerShort(p) : 'Removed player', left: true };
      })
    : [];
  const listed = isFinal ? [...order, ...leftRows] : order;

  const rows = listed.map((batter, i) => {
    const abs = atBatsByBatter.get(batter.id) ?? [];
    const isCurrent = !isFinal && !peeking && i === current;
    const tag = isFinal || peeking ? undefined : isCurrent ? 'AT-BAT' : i === onDeck ? 'ON DECK' : i === inHole ? 'IN THE HOLE' : undefined;
    const tagTwoLines = tag === 'IN THE HOLE' && windowWidth < TAG_ONE_LINE_MIN_WIDTH;
    // This half's newest at-bat: its label under the name and, on untagged rows, its tile at the right.
    const lastHalf = isFinal ? undefined : newestThisHalf(abs);
    const label = lastHalf ? outcomeLabel(lastHalf.outcomeId) : '';
    const chips = isFinal ? [] : chipsFor(abs);
    const showSkip = !isFinal && !peeking && !isCurrent;
    // A finished game reads as a box score: every at-bat as a tile and the game's W/L.
    const gameLine = isFinal ? hittingFor(atBats, batter.id, game.id) : undefined;
    const flashing = flash && abs.some((ab) => ab.id === flash.id) ? flash.result : undefined;
    const slot = batter.left ? '–' : `${i + 1}.`;

    return (
      <View
        key={batter.id}
        ref={(node) => {
          rowRefs.current[batter.id] = node;
        }}
        style={[styles.row, isCurrent && styles.rowCurrent, peeking && styles.rowPeek, flashing && (flashing === 'W' ? styles.rowFlashWin : styles.rowFlashLoss)]}
      >
        {/*
          The row's tap target is a button stretched under the content rather
          than around it: the tile, mini chips and skip target stay siblings, so
          they are never buttons inside a button on web and VoiceOver reaches
          them on iOS. The static text lets taps through (Inert) and is hidden
          from assistive tech because this button already carries the row's label.
        */}
        <Pressable
          onPress={() => openBatter(batter.id)}
          accessibilityRole="button"
          accessibilityLabel={`${slot} ${batter.label}${tag ? `, ${tag.toLowerCase()}` : ''}${batter.left ? ', left game' : ''}`}
          accessibilityHint="Open this batter's at-bats"
          style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.rowPressed, webCursor]}
        />
        <Inert>
          <Text style={styles.num}>{slot}</Text>
        </Inert>
        <View style={styles.rowBody}>
          <BatterName label={batter.label} muted={batter.left} />
          {batter.left ? (
            <Inert>
              <Text style={styles.leftCaption}>LEFT GAME</Text>
            </Inert>
          ) : null}
          {label || chips.length ? (
            <View style={styles.line2}>
              {label ? (
                <Inert style={styles.outcomeWrap}>
                  <Text style={styles.outcome} numberOfLines={1}>
                    {label}
                  </Text>
                </Inert>
              ) : null}
              <MiniChips chips={chips} onPress={(id) => selectAtBat(id)} />
            </View>
          ) : null}
          {isFinal && abs.length ? (
            <View style={styles.tiles}>
              {abs.map((ab) => (
                <ResultTile
                  key={ab.id}
                  result={displayResult(ab)}
                  code={outcomeShort(ab.outcomeId) || undefined}
                  onPress={() => openEditor(ab.id)}
                  accessibilityLabel={`Edit ${batter.label}: ${displayResult(ab)}${outcomeLabel(ab.outcomeId) ? `, ${outcomeLabel(ab.outcomeId)}` : ''}, ${halfLabel(ab.inning, ab.half)}`}
                />
              ))}
            </View>
          ) : null}
        </View>
        {tag ? (
          <Inert>
            <Text style={[styles.tag, tagTwoLines && styles.tagTwoLines]}>{tagTwoLines ? 'IN THE\nHOLE' : tag}</Text>
          </Inert>
        ) : null}
        {!tag && lastHalf ? (
          <ResultTile
            result={displayResult(lastHalf)}
            code={outcomeShort(lastHalf.outcomeId) || undefined}
            selected={lastHalf.id === selection}
            onPress={() => selectAtBat(lastHalf.id)}
            accessibilityLabel={`Re-judge ${batter.label}: ${displayResult(lastHalf)}${label ? `, ${label}` : ''}`}
          />
        ) : null}
        {gameLine ? (
          <Inert>
            {gameLine.w + gameLine.l > 0 ? (
              <WLText wl={gameLine} style={styles.gameLine} />
            ) : (
              <Text style={[styles.gameLine, styles.gameLineEmpty]}>-</Text>
            )}
          </Inert>
        ) : null}
        {showSkip ? (
          <Pressable
            onPress={() => void skipTo(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Bring ${batter.label} up now`}
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed, webCursor]}
          >
            <FontAwesome6 name="forward-step" size={12} color={colors.tabLabel} style={styles.skipIcon} />
          </Pressable>
        ) : null}
      </View>
    );
  });

  return (
    <Screen>
      <AppHeader context={gameTitle(game)} contextColor={colors.orange} backHref={`/team/${game.teamId}`} />

      {isFinal ? (
        <View style={styles.finalBand}>
          <Text style={[styles.finalText, { color: finalColor }]} numberOfLines={1}>
            Final: {finalWord} {game.score.us} - {game.score.them}
          </Text>
          <Button variant="ghost" size="sm" icon="rotate-left" title="Reopen game" onPress={() => reopenGame(game.id)} />
        </View>
      ) : null}

      <InningStrip
        game={game}
        pitcher={pitcher}
        side={liveSide}
        readOnly={isFinal}
        onPrevHalf={handlePrevHalf}
        onNextHalf={handleNextHalf}
        onEndGame={handleEndGame}
        reviewing={reviewing}
        onJumpAhead={handleJumpAhead}
      />

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View ref={contentRef} collapsable={false}>
          {n === 0 ? (
            side === 'us' ? (
              <EmptyState
                title="No batting order yet"
                body="Add players to this game's lineup to start charting."
                action={<Button title="Set up lineup" variant="orange" onPress={() => router.push(`/game/${game.id}/team`)} />}
              />
            ) : (
              <EmptyState
                title="No opponent batters yet"
                body="Add the opposing lineup to chart their at-bats."
                action={<Button title="Set up opponent" variant="orange" onPress={() => router.push(`/game/${game.id}/opponent`)} />}
              />
            )
          ) : (
            rows
          )}
        </View>
      </ScrollView>

      {!isFinal && (liveOrder.length > 0 || selected) ? (
        <CaptureDock
          perspective={livePerspective}
          rejudge={rejudge}
          last={last}
          canStepBack={sorted.length > 0 && selectedIndex !== 0}
          canStepForward={selectedIndex !== -1}
          onStepBack={stepBack}
          onStepForward={stepForward}
          undoLabel={undoLabel(top)}
          canUndo={Boolean(top)}
          onUndo={handleUndo}
          header={header}
          onChipPress={(id) => selectAtBat(id)}
          needsPitcher={needsPitcher}
          onSetPitcher={() => router.push(`/game/${game.id}/pitcher`)}
          needle={needle}
          pulse={pulse}
          bigLabels={bigLabels}
          onBig={handleBig}
          onOutcome={handleOutcome}
          typesOpen={typesOpen}
          onToggleTypes={toggleTypes}
          typesSize={windowHeight >= COMPACT_MIN_HEIGHT ? 'compact' : 'tiny'}
          onHeight={setDockHeight}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Static row content: taps pass through to the row's stretched button
 * beneath, and assistive tech skips it because that button already carries
 * the row's label.
 */
function Inert({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return (
    <View aria-hidden style={[styles.inert, style]}>
      {children}
    </View>
  );
}

/**
 * The batter's name on one line: 20pt bold, dropping to 18pt when the label
 * would not fit its column (the layout spec's rule; React Native Web has no
 * adjustsFontSizeToFit). A hidden copy at 20pt measures the natural width
 * against the column's, so the rule holds for whatever the tag, tile and
 * skip target leave free on this row.
 */
function BatterName({ label, muted }: { label: string; muted?: boolean }) {
  const [natural, setNatural] = useState(0);
  const [available, setAvailable] = useState(0);
  const small = natural > 0 && available > 0 && natural > available;
  return (
    <View aria-hidden style={styles.inert} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
      <Text style={[styles.name, small && styles.nameSmall, muted && styles.nameMuted]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.name, styles.nameMeasure]} numberOfLines={1} onLayout={(e) => setNatural(e.nativeEvent.layout.width)}>
        {label}
      </Text>
    </View>
  );
}

/* Row sizes follow the prototype at 375pt: 56pt rows, 20pt names, 14pt tags, 36x40 tiles. */
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  finalBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.chip,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 2,
    gap: 8,
  },
  finalText: { fontFamily: fonts.bold, fontSize: 18, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    paddingRight: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
    minHeight: 56,
  },
  rowCurrent: { borderLeftWidth: 4, borderLeftColor: colors.currentRail, paddingLeft: 9 },
  rowPeek: { backgroundColor: colors.primaryTint },
  rowFlashWin: { backgroundColor: colors.winTint },
  rowFlashLoss: { backgroundColor: colors.lossTint },
  rowPressed: { backgroundColor: colors.pressed },
  inert: { pointerEvents: 'none' },
  num: { fontFamily: fonts.regular, fontSize: 20, color: colors.textMuted, width: 34, lineHeight: 26 },
  // box-none: the column itself lets taps through to the row button; the chips and tiles inside still take theirs.
  rowBody: { flex: 1, minWidth: 0, gap: 2, pointerEvents: 'box-none' },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, lineHeight: 26 },
  nameSmall: { fontSize: 18 },
  nameMuted: { color: colors.textMuted },
  // Invisible, out of flow, and wider than any column, so its onLayout width is the label's natural width.
  nameMeasure: { position: 'absolute', left: 0, top: 0, opacity: 0, maxWidth: 10000 },
  leftCaption: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, color: colors.textMuted, letterSpacing: 0.6 },
  line2: { flexDirection: 'row', alignItems: 'center', gap: 6, pointerEvents: 'box-none' },
  outcomeWrap: { flexShrink: 1, minWidth: 0 },
  outcome: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingTop: 2, pointerEvents: 'box-none' },
  tag: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, textTransform: 'uppercase', lineHeight: 26, flexShrink: 0 },
  tagTwoLines: { lineHeight: 18, textAlign: 'right' },
  gameLine: { fontSize: 15, lineHeight: 26, marginRight: 8 },
  gameLineEmpty: { fontFamily: fonts.bold, color: colors.textMuted },
  skip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  skipPressed: { backgroundColor: colors.chip },
  skipIcon: { opacity: 0.7 },
});
