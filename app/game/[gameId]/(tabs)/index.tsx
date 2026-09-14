import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import CTGGauge, { type NeedleSide } from '@/components/CTGGauge';
import InningStrip from '@/components/InningStrip';
import OutcomeButtons from '@/components/OutcomeButtons';
import Screen from '@/components/Screen';
import { Button, EmptyState, WLText } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { gameTitle, inningOrdinal, opponentBatterLabel, playerLabel, playerShort } from '@/lib/format';
import { outcomeLabel } from '@/lib/outcomes';
import { hittingFor, pitcherResult } from '@/lib/stats';
import { battingSide, useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { AtBat, Game, OutcomeId, Result, Side } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Batter = { id: string; label: string };

/** A skip made by tapping a batter row; Undo puts `from` back at bat. */
type Skip = { side: Side; from: number; to: number };

/** How far above the current batter's row we scroll when there is room, so the previous result stays in view. */
const SCROLL_LEAD = 56;

/** Which side is up on the CTG screen: a final game always shows our lineup. */
function screenSide(game: Game | undefined): Side {
  return game && game.status !== 'final' ? battingSide(game) : 'us';
}

function currentIndex(game: Game | undefined, side: Side): number {
  if (!game) return 0;
  const n = side === 'us' ? game.lineup.length : game.opponentLineup.length;
  return n ? (side === 'us' ? game.ourNextBatter : game.theirNextBatter) % n : 0;
}

/**
 * The CTG charting screen: inning strip, the batting side's order with each
 * batter's result this half-inning, the expanded AT-BAT block (gauge +
 * outcome buttons) under the current batter, and a fixed Undo / End Game
 * footer that is reachable without scrolling.
 */
export default function ChartTheGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { setNextBatter, recordAtBat, undoLastAtBat, reopenGame } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);

  const [needle, setNeedle] = useState<NeedleSide>('center');
  const [pulse, setPulse] = useState(0);
  const needleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Short-lived footer message, e.g. after an undo that crossed a half-inning. */
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSkip, setLastSkip] = useState<Skip | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const atBatRef = useRef<View>(null);
  const rowRefs = useRef<Record<number, View | null>>({});
  const viewportHeight = useRef(0);
  const mounted = useRef(false);

  const side = screenSide(game);
  const current = currentIndex(game, side);

  /** Row index to bring into view after the next render. */
  const pendingScroll = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (needleTimer.current) clearTimeout(needleTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // On open, and when the batting side flips (Next/Prev half), bring that
  // side's current batter into view unless a record/undo already chose a row.
  useEffect(() => {
    if (pendingScroll.current === null) pendingScroll.current = current;
    setLastSkip(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id, side]);

  // After a record/undo/skip, scroll so the current batter's row, the outcome
  // grid and the next two batters are visible, keeping the previous row on
  // screen only when there is room for it.
  useEffect(() => {
    const animated = mounted.current;
    mounted.current = true;
    const index = pendingScroll.current;
    if (index === null) return;
    pendingScroll.current = null;
    const row = rowRefs.current[index];
    const content = contentRef.current;
    const block = atBatRef.current;
    if (!row || !content) return;
    const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
    row.measureLayout(
      content,
      (_x, rowY, _w, rowH) => {
        if (!block) return scrollTo(rowY - SCROLL_LEAD);
        block.measureLayout(
          content,
          (_bx, _by, _bw, blockH) => {
            const needed = rowH + blockH + 2 * rowH; // AT-BAT row, the grid, ON DECK and IN THE HOLE
            // Show as much of that as fits, but never push the current batter's own row off the top.
            scrollTo(Math.min(rowY, Math.max(rowY - SCROLL_LEAD, rowY + needed - viewportHeight.current)));
          },
          () => scrollTo(rowY - SCROLL_LEAD),
        );
      },
      () => {},
    );
  });

  if (!game) return null;

  const isFinal = game.status === 'final';
  const perspective = side === 'us' ? 'batter' : 'pitcher';
  const playersById = new Map(players.map((p) => [p.id, p]));
  const order: Batter[] =
    side === 'us'
      ? game.lineup.map((slot) => {
          const p = playersById.get(slot.playerId);
          return { id: slot.playerId, label: p ? playerLabel(p) : 'Removed player' };
        })
      : game.opponentLineup.map((b) => ({ id: b.id, label: opponentBatterLabel(b) }));
  const n = order.length;
  const onDeck = n > 1 ? (current + 1) % n : -1;
  const inHole = n > 2 ? (current + 2) % n : -1;
  const pitcher = playersById.get(game.pitcherId ?? '');
  const needsPitcher = !isFinal && side === 'them' && !pitcher;

  // Each batter's latest at-bat in the current half-inning (atBats are in recording order).
  const lastByBatter = new Map<string, AtBat>();
  for (const ab of atBats) {
    if (ab.side === side && ab.inning === game.inning && ab.half === game.half) lastByBatter.set(ab.batterId, ab);
  }

  /** Short name for a batter on either side, for the footer caption. */
  const shortLabel = (ab: Pick<AtBat, 'side' | 'batterId'>): string => {
    if (ab.side === 'us') {
      const p = playersById.get(ab.batterId);
      return p ? playerShort(p) : 'Removed player';
    }
    const b = game.opponentLineup.find((x) => x.id === ab.batterId);
    return b ? opponentBatterLabel(b) : 'Removed batter';
  };
  const halfLabel = (ab: Pick<AtBat, 'inning' | 'half'>) => `${ab.half === 'top' ? '▲' : '▼'} ${inningOrdinal(ab.inning)}`;

  const lastAtBat = atBats.length ? atBats[atBats.length - 1] : undefined;
  const canUndo = Boolean(lastSkip) || Boolean(lastAtBat);
  let undoCaption = 'Tap a batter to skip to them';
  if (lastSkip) {
    undoCaption = `Skipped to ${order[lastSkip.to]?.label ?? 'batter'}`;
  } else if (lastAtBat) {
    const crossesHalf = lastAtBat.inning !== game.inning || lastAtBat.half !== game.half;
    undoCaption = `${shortLabel(lastAtBat)} · ${outcomeLabel(lastAtBat.outcomeId)}${crossesHalf ? ` · ${halfLabel(lastAtBat)}` : ''}`;
  }

  /** Big letters flanking the gauge follow the button columns: left = left column's result for us. */
  const left = perspective === 'batter' ? { letter: 'L', color: colors.loss } : { letter: 'W', color: colors.win };
  const right = perspective === 'batter' ? { letter: 'W', color: colors.win } : { letter: 'L', color: colors.loss };

  const swingNeedle = (result: Result) => {
    setNeedle(result);
    setPulse((p) => p + 1);
    if (needleTimer.current) clearTimeout(needleTimer.current);
    needleTimer.current = setTimeout(() => setNeedle('center'), 1500);
  };

  const flashNotice = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };

  const handleOutcome = (outcomeId: OutcomeId) => {
    const ab = recordAtBat(game.id, outcomeId);
    if (!ab) return;
    setLastSkip(null);
    swingNeedle(ab.side === 'us' ? ab.result : pitcherResult(ab));
    pendingScroll.current = (current + 1) % n;
  };

  const handleUndo = () => {
    if (lastSkip) {
      // Undo the skip: put the batter who was due up back at bat.
      setNextBatter(game.id, lastSkip.side, lastSkip.from);
      setLastSkip(null);
      pendingScroll.current = lastSkip.from;
      return;
    }
    const ab = undoLastAtBat(game.id);
    if (!ab) return;
    if (ab.inning !== game.inning || ab.half !== game.half) {
      flashNotice(`Back to ${halfLabel(ab)} — tap Next half when you are done`);
    }
    const index =
      ab.side === 'us'
        ? game.lineup.findIndex((s) => s.playerId === ab.batterId)
        : game.opponentLineup.findIndex((b) => b.id === ab.batterId);
    pendingScroll.current = index >= 0 ? index : null;
  };

  /** Tapping a row makes that batter current (pinch hitter, missed batter). Skipping past more than one asks first. */
  const skipTo = async (i: number) => {
    const skipped = (i - current + n) % n;
    if (skipped > 1) {
      const ok = await confirmAction('Skip batters?', `Skip ${skipped} batters and bring ${order[i].label} up now?`, 'Skip');
      if (!ok) return;
    }
    setLastSkip({ side, from: current, to: i });
    setNextBatter(game.id, side, i);
    pendingScroll.current = i;
  };

  const finalWord = game.score.us > game.score.them ? 'Won' : game.score.us < game.score.them ? 'Lost' : 'Tied';
  const finalColor = finalWord === 'Won' ? colors.win : finalWord === 'Lost' ? colors.loss : colors.text;

  const rows: React.ReactNode[] = [];
  order.forEach((batter, i) => {
    const isCurrent = !isFinal && i === current;
    // This half-inning's result; the AT-BAT row shows only the name and tag like the prototype.
    const last = isFinal || isCurrent ? undefined : lastByBatter.get(batter.id);
    const result: Result | undefined = last ? (side === 'us' ? last.result : pitcherResult(last)) : undefined;
    const tag = isFinal ? undefined : isCurrent ? 'AT-BAT' : i === onDeck ? 'ON DECK' : i === inHole ? 'IN THE HOLE' : undefined;
    const selectable = !isFinal && !isCurrent;
    // Skip affordance on the rows that would otherwise look inert; tagged rows are obviously next up.
    const showSkip = selectable && !tag && !result;
    // A finished game reads as a box score: each of our players' W/L for the game.
    const gameLine = isFinal ? hittingFor(atBats, batter.id, game.id) : undefined;

    rows.push(
      <Pressable
        key={batter.id}
        ref={(node) => {
          rowRefs.current[i] = node;
        }}
        onPress={selectable ? () => void skipTo(i) : undefined}
        disabled={!selectable}
        accessibilityRole="button"
        accessibilityLabel={`${i + 1}. ${batter.label}${tag ? `, ${tag.toLowerCase()}` : ''}`}
        accessibilityHint={selectable ? 'Make this batter current' : undefined}
        style={({ pressed }) => [styles.row, isCurrent && styles.rowCurrent, pressed && selectable && styles.rowPressed, selectable && webCursor]}
      >
        <Text style={styles.num}>{i + 1}.</Text>
        <View style={styles.rowBody}>
          <Text style={styles.name}>{batter.label}</Text>
          {last ? <Text style={styles.outcome}>{outcomeLabel(last.outcomeId)}</Text> : null}
        </View>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
        {result ? <Text style={[styles.result, { color: result === 'W' ? colors.win : colors.loss }]}>{result}</Text> : null}
        {gameLine ? (
          gameLine.w + gameLine.l > 0 ? (
            <WLText wl={gameLine} style={styles.gameLine} />
          ) : (
            <Text style={[styles.gameLine, styles.gameLineEmpty]}>-</Text>
          )
        ) : null}
        {showSkip ? <FontAwesome6 name="forward-step" size={12} color={colors.tabLabel} style={styles.skipIcon} /> : null}
      </Pressable>,
    );

    if (isCurrent) {
      // Keyed as a stable sibling so the gauge (and its animation) survives moving between batters.
      rows.push(
        <View key="atbat" ref={atBatRef} collapsable={false} style={styles.atBat}>
          <View style={styles.gaugeRow}>
            <Text style={[styles.bigLetter, { color: left.color }]}>{left.letter}</Text>
            <CTGGauge needle={needle} pulse={pulse} perspective={perspective} />
            <Text style={[styles.bigLetter, { color: right.color }]}>{right.letter}</Text>
          </View>
          {needsPitcher ? (
            <View style={styles.pitcherPrompt}>
              <Text style={styles.pitcherPromptText}>Pick who is pitching so their W/L is credited.</Text>
              <Button variant="orange" title="Set pitcher" icon="baseball" onPress={() => router.push(`/game/${game.id}/opponent`)} />
            </View>
          ) : null}
          <OutcomeButtons perspective={perspective} onPress={handleOutcome} disabled={needsPitcher} />
        </View>,
      );
    }
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

      <InningStrip game={game} pitcher={pitcher} side={side} readOnly={isFinal} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
      >
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

      {!isFinal ? (
        <View style={styles.footer}>
          <Button
            variant="ghost"
            size="sm"
            icon="rotate-left"
            title="Undo"
            accessibilityLabel={canUndo ? `Undo: ${undoCaption}` : 'Undo'}
            disabled={!canUndo}
            onPress={handleUndo}
          />
          <Text style={[styles.footerNote, notice ? styles.footerNotice : null]} numberOfLines={2}>
            {notice ?? undoCaption}
          </Text>
          <Button
            title="End Game"
            variant="outline"
            size="sm"
            style={styles.endButton}
            textStyle={{ color: colors.orange }}
            onPress={() => router.push(`/game/${game.id}/finish`)}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/* Row and block sizes follow the prototype at 375pt: 53pt rows, 20pt names, 14pt tags, an 80pt gauge flanked by ~34pt letters. */
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
    alignItems: 'flex-start',
    paddingLeft: 13,
    paddingRight: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
    minHeight: 53,
  },
  rowCurrent: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.pressed },
  num: { fontFamily: fonts.regular, fontSize: 20, color: colors.textMuted, width: 34, lineHeight: 26 },
  rowBody: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, lineHeight: 26 },
  outcome: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text },
  tag: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, textTransform: 'uppercase', lineHeight: 26, flexShrink: 0 },
  result: { fontFamily: fonts.bold, fontSize: 36, lineHeight: 40, width: 36, textAlign: 'right', marginTop: -6 },
  gameLine: { fontSize: 15, lineHeight: 26 },
  gameLineEmpty: { fontFamily: fonts.bold, color: colors.textMuted },
  skipIcon: { lineHeight: 26, marginLeft: -2, opacity: 0.7 },
  atBat: {
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 36,
    paddingHorizontal: 16,
  },
  // Sits on the gauge's baseline like the prototype: the letters' feet line up with the arc ends, above the caption.
  bigLetter: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 38, width: 40, textAlign: 'center', marginBottom: 12 },
  pitcherPrompt: { alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingBottom: 4 },
  pitcherPromptText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: colors.text, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  footerNote: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 15, color: colors.textMuted },
  footerNotice: { fontFamily: fonts.bold, color: colors.orange },
  endButton: { borderColor: colors.orange, paddingHorizontal: 14 },
});
