import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { inningOrdinal, playerShort } from '@/lib/format';
import { battingSide, useStore } from '@/lib/store';
import type { Game, Player } from '@/lib/types';

type Props = {
  game: Game;
  /** Our current pitcher, when set. */
  pitcher?: Player;
  /** Final games: keep the inning/score readout but hide the steppers and half-inning controls. */
  readOnly?: boolean;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/**
 * The strip under the game header on the CTG screen: which half-inning it is,
 * who is batting (HITTING / PITCHING), the score with +/- steppers, and the
 * Prev half / Next half controls.
 */
export default function InningStrip({ game, pitcher, readOnly }: Props) {
  const router = useRouter();
  const { setScore, nextHalfInning, prevHalfInning } = useStore();
  const hitting = battingSide(game) === 'us';

  const bump = (who: 'us' | 'them', delta: number) =>
    setScore(game.id, { ...game.score, [who]: game.score[who] + delta });

  return (
    <View style={styles.strip}>
      <View style={styles.row}>
        <View style={styles.inning}>
          <FontAwesome6 name={game.half === 'top' ? 'caret-up' : 'caret-down'} size={20} color={colors.text} />
          <Text style={styles.inningText}>{inningOrdinal(game.inning)}</Text>
        </View>

        <View style={styles.center}>
          <View style={[styles.pill, { backgroundColor: hitting ? colors.primaryDark : colors.pitching }]}>
            <Text style={styles.pillText}>{hitting ? 'HITTING' : 'PITCHING'}</Text>
          </View>
          {!hitting ? (
            pitcher ? (
              <Text style={styles.caption} numberOfLines={1}>
                {playerShort(pitcher)} pitching
              </Text>
            ) : (
              <Pressable
                onPress={() => router.push(`/game/${game.id}/opponent`)}
                accessibilityRole="link"
                accessibilityLabel="Set pitcher"
                hitSlop={8}
                style={webCursor}
              >
                <Text style={styles.link}>Set pitcher</Text>
              </Pressable>
            )
          ) : null}
        </View>

        <View style={styles.score}>
          <Text style={styles.scoreText} numberOfLines={1}>
            Us {game.score.us} · {game.opponent} {game.score.them}
          </Text>
          {!readOnly ? (
            <View style={styles.steppers}>
              <StepperPair label="Us" onMinus={() => bump('us', -1)} onPlus={() => bump('us', 1)} />
              <StepperPair label={game.opponent} onMinus={() => bump('them', -1)} onPlus={() => bump('them', 1)} />
            </View>
          ) : null}
        </View>
      </View>

      {!readOnly ? (
        <View style={styles.halves}>
          <Button variant="ghost" size="sm" icon="backward-step" title="Prev half" onPress={() => prevHalfInning(game.id)} />
          <Button variant="ghost" size="sm" icon="forward-step" title="Next half" onPress={() => nextHalfInning(game.id)} />
        </View>
      ) : null}
    </View>
  );
}

function StepperPair({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.pair}>
      <StepButton icon="minus" label={`${label} minus`} onPress={onMinus} />
      <StepButton icon="plus" label={`${label} plus`} onPress={onPlus} />
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, webCursor]}
    >
      <FontAwesome6 name={icon} size={12} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  inning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 58,
    paddingTop: 4,
  },
  inningText: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  center: { flex: 1, alignItems: 'center', gap: 4 },
  pill: {
    paddingHorizontal: 16,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF', letterSpacing: 0.8 },
  caption: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.primaryDark },
  score: { alignItems: 'flex-end', maxWidth: 150, gap: 6, paddingTop: 4 },
  scoreText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  steppers: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', gap: 12 },
  pair: { flexDirection: 'row', gap: 6 },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  halves: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
});
