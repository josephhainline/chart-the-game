import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { halfLabel, inningOrdinal, playerShort } from '@/lib/format';
import { battingSide, useStore } from '@/lib/store';
import type { Game, Half, Player, Side } from '@/lib/types';

type Props = {
  game: Game;
  /** Our current pitcher, when set. */
  pitcher?: Player;
  /** Which side the screen is showing. Defaults to whoever is batting in the game's current half-inning. */
  side?: Side;
  /** Final games: keep the inning/score readout but hide the steppers, half-inning controls and End Game. */
  readOnly?: boolean;
  /** Replace the default (store) half-inning steps, e.g. to push an undo entry first. */
  onPrevHalf?: () => void;
  onNextHalf?: () => void;
  /** End Game at the right end of the first line; hidden when omitted or readOnly. */
  onEndGame?: () => void;
  /**
   * The newest charted half-inning when it is AHEAD of the game clock (the
   * coach stepped back): line 2 shows the amber review line instead of the
   * pitcher chip, with "Jump ahead" calling `onJumpAhead`.
   */
  reviewing?: { inning: number; half: Half };
  onJumpAhead?: () => void;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/** Below this window width the pitcher chip drops the jersey number so the score keeps one line at 375pt. */
const CHIP_NUMBER_MIN_WIDTH = 390;

/**
 * The strip under the game header on the CTG screen, two lines. Line 1:
 * Prev half · "▲ 2nd" · Next half · HITTING/PITCHING pill · End Game at the
 * right. Line 2: the pitcher chip (or "Set pitcher") while pitching, or the
 * amber review line when the clock is behind the newest charted half; the
 * score "Us N [−][+] · Them N [−][+]" on one line at the right.
 */
export default function InningStrip({ game, pitcher, side, readOnly, onPrevHalf, onNextHalf, onEndGame, reviewing, onJumpAhead }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { setScore, nextHalfInning, prevHalfInning } = useStore();
  const hitting = (side ?? battingSide(game)) === 'us';

  const bump = (who: Side, delta: number) => setScore(game.id, { ...game.score, [who]: Math.max(0, game.score[who] + delta) });
  const prev = onPrevHalf ?? (() => prevHalfInning(game.id));
  const next = onNextHalf ?? (() => nextHalfInning(game.id));
  const pitcherRoute = `/game/${game.id}/pitcher` as const;

  let secondLeft: React.ReactNode = null;
  if (reviewing && !readOnly) {
    secondLeft = (
      <View style={styles.review} accessibilityRole="text">
        <Text style={styles.reviewText}>
          Reviewing {halfLabel(game.inning, game.half)} · game is in {halfLabel(reviewing.inning, reviewing.half)} ·{' '}
          <Text onPress={onJumpAhead} accessibilityRole="link" accessibilityLabel="Jump ahead" style={[styles.reviewLink, webCursor]}>
            Jump ahead
          </Text>
        </Text>
      </View>
    );
  } else if (!hitting && !readOnly) {
    secondLeft = pitcher ? (
      <Pressable
        onPress={() => router.push(pitcherRoute)}
        accessibilityRole="button"
        accessibilityLabel={`Pitcher: ${playerShort(pitcher)}. Change pitcher`}
        hitSlop={6}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed, webCursor]}
      >
        <FontAwesome6 name="baseball" size={12} color={colors.text} />
        <Text style={styles.chipText} numberOfLines={1}>
          {width >= CHIP_NUMBER_MIN_WIDTH ? playerShort(pitcher) : playerShort({ ...pitcher, number: undefined })}
        </Text>
        <FontAwesome6 name="chevron-right" size={10} color={colors.textMuted} />
      </Pressable>
    ) : (
      <Pressable
        onPress={() => router.push(pitcherRoute)}
        accessibilityRole="link"
        accessibilityLabel="Set pitcher"
        hitSlop={8}
        style={({ pressed }) => [styles.linkWrap, pressed && styles.pressed, webCursor]}
      >
        <Text style={styles.link}>Set pitcher</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.strip}>
      <View style={styles.line}>
        {!readOnly ? <IconButton icon="backward-step" label="Prev half" onPress={prev} /> : null}
        <View style={styles.inning}>
          <FontAwesome6 name={game.half === 'top' ? 'caret-up' : 'caret-down'} size={18} color={colors.text} />
          <Text style={styles.inningText}>{inningOrdinal(game.inning)}</Text>
        </View>
        {!readOnly ? <IconButton icon="forward-step" label="Next half" onPress={next} /> : null}
        <View style={[styles.pill, { backgroundColor: hitting ? colors.primaryDark : colors.pitching }]}>
          <Text style={styles.pillText}>{hitting ? 'HITTING' : 'PITCHING'}</Text>
        </View>
        {!readOnly && onEndGame ? (
          <Pressable
            onPress={onEndGame}
            accessibilityRole="button"
            accessibilityLabel="End Game"
            style={({ pressed }) => [styles.endGame, pressed && styles.pressed, webCursor]}
          >
            <Text style={styles.endGameText}>End Game</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.line}>
        <View style={styles.secondLeft}>{secondLeft}</View>
        <View style={styles.score}>
          <Text style={styles.scoreText}>Us {game.score.us}</Text>
          {!readOnly ? (
            <View style={styles.pair}>
              <IconButton icon="minus" label="Us minus" onPress={() => bump('us', -1)} />
              <IconButton icon="plus" label="Us plus" onPress={() => bump('us', 1)} />
            </View>
          ) : null}
          <Text style={styles.dot}>·</Text>
          <Text style={styles.scoreText}>Them {game.score.them}</Text>
          {!readOnly ? (
            <View style={styles.pair}>
              <IconButton icon="minus" label="Them minus" onPress={() => bump('them', -1)} />
              <IconButton icon="plus" label="Them plus" onPress={() => bump('them', 1)} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: 'minus' | 'plus' | 'backward-step' | 'forward-step'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, webCursor]}
    >
      <FontAwesome6 name={icon} size={12} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  inning: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  inningText: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  pill: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  pillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white, letterSpacing: 0.6 },
  endGame: {
    marginLeft: 'auto',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endGameText: { fontFamily: fonts.bold, fontSize: 12, color: colors.orange },
  secondLeft: { flex: 1, minWidth: 0, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 4 },
  chipText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text, flexShrink: 1 },
  linkWrap: { alignSelf: 'flex-start', paddingVertical: 4 },
  link: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.orange },
  review: { backgroundColor: colors.amberBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  reviewText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14, color: colors.amberInk },
  reviewLink: { fontFamily: fonts.bold, textDecorationLine: 'underline' },
  score: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 4, marginLeft: 8 },
  scoreText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  dot: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.textMuted, paddingHorizontal: 2 },
  pair: { flexDirection: 'row', gap: 4 },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
