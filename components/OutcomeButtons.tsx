import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { LOSS_OUTCOMES, outcomeLabel, WIN_OUTCOMES, type Outcome } from '@/lib/outcomes';
import type { OutcomeId } from '@/lib/types';

export type Perspective = 'batter' | 'pitcher';

type Props = {
  /**
   * 'batter': left column (batter losses) is red, right column (batter wins) is green.
   * 'pitcher': the opponent is batting, so the colors flip — our pitcher won the
   * battles in the left column, so it is green and the right column is red.
   */
  perspective: Perspective;
  onPress: (outcomeId: OutcomeId) => void;
  disabled?: boolean;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/** Below this window width the labels drop to the prototype's 12px so the longest one stays on two lines. */
const ROOMY_WIDTH = 410;

/**
 * The twelve outcome buttons from the prototype: six rows of two, losses on
 * the left and wins on the right. Rendering by row (not two independent
 * columns) keeps each pair the same height, so a label that wraps never
 * knocks the grid out of alignment.
 */
export default function OutcomeButtons({ perspective, onPress, disabled }: Props) {
  const { width } = useWindowDimensions();
  const roomy = width >= ROOMY_WIDTH;
  const leftTone = perspective === 'pitcher' ? 'win' : 'loss';
  const rightTone = perspective === 'pitcher' ? 'loss' : 'win';
  return (
    <View style={styles.rows}>
      {LOSS_OUTCOMES.map((loss, i) => (
        <View key={loss.id} style={styles.row}>
          <OutcomeButton outcome={loss} tone={leftTone} roomy={roomy} onPress={onPress} disabled={disabled} />
          <OutcomeButton outcome={WIN_OUTCOMES[i]} tone={rightTone} roomy={roomy} onPress={onPress} disabled={disabled} />
        </View>
      ))}
    </View>
  );
}

function OutcomeButton({
  outcome,
  tone,
  roomy,
  onPress,
  disabled,
}: {
  outcome: Outcome;
  tone: 'win' | 'loss';
  roomy: boolean;
  onPress: (outcomeId: OutcomeId) => void;
  disabled?: boolean;
}) {
  const win = tone === 'win';
  return (
    <Pressable
      onPress={() => onPress(outcome.id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={outcomeLabel(outcome.id)}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: win ? colors.win : colors.loss },
        pressed && styles.pressed,
        disabled && styles.disabled,
        webCursor,
      ]}
    >
      <Text style={[styles.label, roomy && styles.labelRoomy, { color: win ? colors.text : colors.white }]}>{outcome.label}</Text>
    </Pressable>
  );
}

/* Sampled from the prototype at 375pt: 132x39 buttons, 9pt row gap, 50pt between columns, 29pt side margins. */
const styles = StyleSheet.create({
  rows: {
    gap: 8,
    paddingHorizontal: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 44,
  },
  button: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  labelRoomy: { fontSize: 13 },
});
