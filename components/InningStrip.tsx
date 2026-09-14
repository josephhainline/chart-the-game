import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { inningOrdinal, playerShort } from '@/lib/format';
import { battingSide, useStore } from '@/lib/store';
import type { Game, Player, Side } from '@/lib/types';

type Props = {
  game: Game;
  /** Our current pitcher, when set. */
  pitcher?: Player;
  /** Which side the screen is showing. Defaults to whoever is batting in the game's current half-inning. */
  side?: Side;
  /** Final games: keep the inning/score readout but hide the steppers and half-inning controls. */
  readOnly?: boolean;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/**
 * The strip under the game header on the CTG screen: which half-inning it is
 * (with Prev half / Next half steppers), who is batting (HITTING / PITCHING)
 * and our pitcher, and the score as "Us N · Them N" with a labeled +/- pair
 * under each side's runs. Kept to two short lines so the at-bat block below
 * fits on a phone.
 */
export default function InningStrip({ game, pitcher, side, readOnly }: Props) {
  const router = useRouter();
  const { setScore, nextHalfInning, prevHalfInning } = useStore();
  const hitting = (side ?? battingSide(game)) === 'us';

  const bump = (who: Side, delta: number) => setScore(game.id, { ...game.score, [who]: game.score[who] + delta });

  return (
    <View style={styles.strip}>
      <View style={styles.left}>
        <View style={styles.inningRow}>
          {!readOnly ? <IconButton icon="backward-step" label="Prev half" onPress={() => prevHalfInning(game.id)} /> : null}
          <View style={styles.inning}>
            <FontAwesome6 name={game.half === 'top' ? 'caret-up' : 'caret-down'} size={18} color={colors.text} />
            <Text style={styles.inningText}>{inningOrdinal(game.inning)}</Text>
          </View>
          {!readOnly ? <IconButton icon="forward-step" label="Next half" onPress={() => nextHalfInning(game.id)} /> : null}
          <View style={[styles.pill, { backgroundColor: hitting ? colors.primaryDark : colors.pitching }]}>
            <Text style={styles.pillText}>{hitting ? 'HITTING' : 'PITCHING'}</Text>
          </View>
        </View>
        {!hitting ? (
          pitcher ? (
            <Text style={styles.caption}>{playerShort(pitcher)} pitching</Text>
          ) : (
            <Pressable
              onPress={() => router.push(`/game/${game.id}/opponent`)}
              accessibilityRole="link"
              accessibilityLabel="Set pitcher"
              hitSlop={8}
              style={[styles.linkWrap, webCursor]}
            >
              <Text style={styles.link}>Set pitcher</Text>
            </Pressable>
          )
        ) : null}
      </View>

      <View style={styles.score}>
        <ScoreBlock label="Us" runs={game.score.us} readOnly={readOnly} onMinus={() => bump('us', -1)} onPlus={() => bump('us', 1)} />
        <Text style={styles.dot}>·</Text>
        <ScoreBlock label="Them" runs={game.score.them} readOnly={readOnly} onMinus={() => bump('them', -1)} onPlus={() => bump('them', 1)} />
      </View>
    </View>
  );
}

/** "Us 3" over its own −/+ pair, so the number never truncates and each stepper says what it changes. */
function ScoreBlock({
  label,
  runs,
  readOnly,
  onMinus,
  onPlus,
}: {
  label: string;
  runs: number;
  readOnly?: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.scoreText}>
        {label} {runs}
      </Text>
      {!readOnly ? (
        <View style={styles.pair}>
          <IconButton icon="minus" label={`${label} minus`} onPress={onMinus} />
          <IconButton icon="plus" label={`${label} plus`} onPress={onPlus} />
        </View>
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  left: { flex: 1, gap: 3 },
  inningRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
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
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 16, color: colors.textMuted },
  linkWrap: { alignSelf: 'flex-start' },
  link: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.primaryDark },
  score: { flexDirection: 'row', alignItems: 'flex-start', flexShrink: 0, gap: 4 },
  dot: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.textMuted, paddingTop: 5 },
  block: { alignItems: 'center', gap: 3, minWidth: 60 },
  scoreText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.text, paddingTop: 5, fontVariant: ['tabular-nums'] },
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
