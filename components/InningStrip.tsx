import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { halfLabel, inningOrdinal, playerShort } from '@/lib/format';
import { battingSide } from '@/lib/store';
import type { Game, Half, Player, Side } from '@/lib/types';

type Props = {
  game: Game;
  /** Our current pitcher, when set. */
  pitcher?: Player;
  /** Which side the screen is showing. Defaults to whoever is batting in the game's current half-inning. */
  side?: Side;
  /** Final games: keep the inning readout but hide the steppers, half-inning controls and End Game. */
  readOnly?: boolean;
  /** The screen owns the half-inning flips (it pushes the undo entry with each one). */
  onPrevHalf: () => void;
  onNextHalf: () => void;
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

/** Below this window width the pitcher chip drops the jersey number so the line stays short at 375pt. */
const CHIP_NUMBER_MIN_WIDTH = 390;

/**
 * The strip under the game header on the CTG screen, two lines. Line 1:
 * Prev half · "▲ 2nd" · Next half · HITTING/PITCHING pill · End Game at the
 * right. Line 2: the pitcher chip (or "Set pitcher") while pitching, or the
 * amber review line when the clock is behind the newest charted half. The
 * second line is left out while we are hitting with nothing to review.
 */
export default function InningStrip({ game, pitcher, side, readOnly, onPrevHalf, onNextHalf, onEndGame, reviewing, onJumpAhead }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const hitting = (side ?? battingSide(game)) === 'us';
  const pitcherRoute = `/game/${game.id}/pitcher` as const;

  let secondLeft: React.ReactNode = null;
  if (reviewing && !readOnly) {
    // "Jump ahead" is a sibling button, not a nested Text onPress: on web a
    // nested Text only wires click, so Enter/Space could never activate it.
    secondLeft = (
      <View style={styles.review}>
        <Text style={styles.reviewText}>
          Reviewing {halfLabel(game.inning, game.half)} · game is in {halfLabel(reviewing.inning, reviewing.half)} ·
        </Text>
        <Pressable
          onPress={onJumpAhead}
          accessibilityRole="button"
          accessibilityLabel="Jump ahead"
          hitSlop={6}
          style={({ pressed }) => [pressed && styles.pressed, webCursor]}
        >
          <Text style={[styles.reviewText, styles.reviewLink]}>Jump ahead</Text>
        </Pressable>
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
        {!readOnly ? <IconButton icon="backward-step" label="Prev half" onPress={onPrevHalf} /> : null}
        <View style={styles.inning}>
          <FontAwesome6 name={game.half === 'top' ? 'caret-up' : 'caret-down'} size={18} color={colors.text} />
          <Text style={styles.inningText}>{inningOrdinal(game.inning)}</Text>
        </View>
        {!readOnly ? <IconButton icon="forward-step" label="Next half" onPress={onNextHalf} /> : null}
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

      {secondLeft ? <View style={styles.line}>{secondLeft}</View> : null}
    </View>
  );
}

function IconButton({ icon, label, onPress }: { icon: 'backward-step' | 'forward-step'; label: string; onPress: () => void }) {
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
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', paddingVertical: 4 },
  chipText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text, flexShrink: 1 },
  linkWrap: { alignSelf: 'flex-start', paddingVertical: 4 },
  link: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.orange },
  // A wrapping row: the sentence fills the box and "Jump ahead" follows it, or drops under it, like inline text.
  review: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 3,
    backgroundColor: colors.amberBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  reviewText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14, color: colors.amberInk, flexShrink: 1 },
  reviewLink: { fontFamily: fonts.bold, textDecorationLine: 'underline' },
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
