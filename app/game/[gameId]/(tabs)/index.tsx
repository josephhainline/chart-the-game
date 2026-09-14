import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import CTGGauge, { type NeedleSide } from '@/components/CTGGauge';
import InningStrip from '@/components/InningStrip';
import OutcomeButtons from '@/components/OutcomeButtons';
import Screen from '@/components/Screen';
import { Button, EmptyState } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { gameTitle, opponentBatterLabel, playerLabel } from '@/lib/format';
import { outcomeLabel } from '@/lib/outcomes';
import { pitcherResult } from '@/lib/stats';
import { battingSide, useGame, useGameAtBats, useStore, useTeamPlayers } from '@/lib/store';
import type { AtBat, OutcomeId, Result } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Batter = { id: string; label: string };

/** How far above the current batter's row we scroll, so the previous result stays in view. */
const SCROLL_LEAD = 84;

/**
 * The CTG charting screen: inning strip, the batting side's order with each
 * batter's latest result, and the expanded AT-BAT block (gauge + outcome
 * buttons) under the current batter.
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

  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const rowRefs = useRef<Record<number, View | null>>({});
  /** Row index to bring into view after the next render. */
  const pendingScroll = useRef<number | null>(null);

  const side = game ? battingSide(game) : 'us';

  useEffect(() => () => {
    if (needleTimer.current) clearTimeout(needleTimer.current);
  }, []);

  // When the batting side flips (Next/Prev half) start the new order at the top.
  useEffect(() => {
    if (pendingScroll.current === null) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [side]);

  // After a record/undo, scroll so the new current batter (and the row above it) is visible.
  useEffect(() => {
    const index = pendingScroll.current;
    if (index === null) return;
    pendingScroll.current = null;
    const row = rowRefs.current[index];
    const content = contentRef.current;
    if (!row || !content) return;
    row.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_LEAD), animated: true }),
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
  const current = n ? (side === 'us' ? game.ourNextBatter : game.theirNextBatter) % n : 0;
  const onDeck = n > 1 ? (current + 1) % n : -1;
  const inHole = n > 2 ? (current + 2) % n : -1;
  const pitcher = playersById.get(game.pitcherId ?? '');

  // Latest at-bat per batter on the side that's up (atBats are in recording order).
  const lastByBatter = new Map<string, AtBat>();
  for (const ab of atBats) if (ab.side === side) lastByBatter.set(ab.batterId, ab);

  /** Big letters flanking the gauge follow the button columns: left = left column's result for us. */
  const left = perspective === 'batter' ? { letter: 'L', color: colors.loss } : { letter: 'W', color: colors.win };
  const right = perspective === 'batter' ? { letter: 'W', color: colors.win } : { letter: 'L', color: colors.loss };

  const swingNeedle = (result: Result) => {
    setNeedle(result);
    setPulse((p) => p + 1);
    if (needleTimer.current) clearTimeout(needleTimer.current);
    needleTimer.current = setTimeout(() => setNeedle('center'), 1500);
  };

  const handleOutcome = (outcomeId: OutcomeId) => {
    const ab = recordAtBat(game.id, outcomeId);
    if (!ab) return;
    swingNeedle(ab.side === 'us' ? ab.result : pitcherResult(ab));
    pendingScroll.current = (current + 1) % n;
  };

  const handleUndo = () => {
    const ab = undoLastAtBat(game.id);
    if (!ab) return;
    const index =
      ab.side === 'us'
        ? game.lineup.findIndex((s) => s.playerId === ab.batterId)
        : game.opponentLineup.findIndex((b) => b.id === ab.batterId);
    pendingScroll.current = index >= 0 ? index : null;
  };

  const finalWord = game.score.us > game.score.them ? 'Won' : game.score.us < game.score.them ? 'Lost' : 'Tied';
  const finalColor = finalWord === 'Won' ? colors.win : finalWord === 'Lost' ? colors.loss : colors.text;

  const rows: React.ReactNode[] = [];
  order.forEach((batter, i) => {
    const isCurrent = !isFinal && i === current;
    const last = lastByBatter.get(batter.id);
    const result: Result | undefined = last ? (side === 'us' ? last.result : pitcherResult(last)) : undefined;
    const tag = isFinal ? undefined : isCurrent ? 'AT-BAT' : i === onDeck ? 'ON DECK' : i === inHole ? 'IN THE HOLE' : undefined;
    const selectable = !isFinal && !isCurrent;

    rows.push(
      <Pressable
        key={batter.id}
        ref={(node) => {
          rowRefs.current[i] = node;
        }}
        onPress={selectable ? () => setNextBatter(game.id, side, i) : undefined}
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
        {result && !isCurrent ? (
          <Text style={[styles.result, { color: result === 'W' ? colors.win : colors.loss }]}>{result}</Text>
        ) : null}
      </Pressable>,
    );

    if (isCurrent) {
      // Keyed as a stable sibling so the gauge (and its animation) survives moving between batters.
      rows.push(
        <View key="atbat" style={styles.atBat}>
          <View style={styles.gaugeRow}>
            <Text style={[styles.bigLetter, { color: left.color }]}>{left.letter}</Text>
            <CTGGauge needle={needle} pulse={pulse} perspective={perspective} />
            <Text style={[styles.bigLetter, { color: right.color }]}>{right.letter}</Text>
          </View>
          <OutcomeButtons perspective={perspective} onPress={handleOutcome} />
        </View>,
      );
    }
  });

  return (
    <Screen>
      <AppHeader context={gameTitle(game)} contextColor={colors.orange} onBack={() => router.replace(`/team/${game.teamId}`)} />

      {isFinal ? (
        <View style={styles.finalBand}>
          <Text style={[styles.finalText, { color: finalColor }]} numberOfLines={1}>
            Final: {finalWord} {game.score.us} - {game.score.them}
          </Text>
          <Button variant="ghost" size="sm" icon="rotate-left" title="Reopen game" onPress={() => reopenGame(game.id)} />
        </View>
      ) : null}

      <InningStrip game={game} pitcher={pitcher} readOnly={isFinal} />

      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View ref={contentRef} collapsable={false}>
          {!isFinal && atBats.length > 0 ? (
            <View style={styles.undoRow}>
              <Button variant="ghost" size="sm" icon="rotate-left" title="Undo last at-bat" onPress={handleUndo} />
            </View>
          ) : null}

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

          {!isFinal ? (
            <View style={styles.endRow}>
              <Button
                title="End Game"
                variant="outline"
                size="lg"
                style={styles.endButton}
                textStyle={{ color: colors.orange }}
                onPress={() => router.push(`/game/${game.id}/finish`)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  finalBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.chip,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  finalText: { fontFamily: fonts.bold, fontSize: 20, flexShrink: 1 },
  undoRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
    minHeight: 64,
  },
  rowCurrent: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: '#F4F6FA' },
  num: { fontFamily: fonts.regular, fontSize: 24, color: colors.textMuted, width: 40, lineHeight: 30 },
  rowBody: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, lineHeight: 30 },
  outcome: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 2 },
  tag: { fontFamily: fonts.regular, fontSize: 18, color: colors.text, textTransform: 'uppercase', lineHeight: 30, flexShrink: 0 },
  result: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 44, width: 44, textAlign: 'right', marginTop: -7 },
  atBat: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 12,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 44,
    paddingHorizontal: 16,
  },
  bigLetter: { fontFamily: fonts.bold, fontSize: 44, lineHeight: 50, width: 48, textAlign: 'center' },
  endRow: { paddingHorizontal: 24, paddingTop: 24 },
  endButton: { borderColor: colors.orange },
});
