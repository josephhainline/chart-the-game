import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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

/** The twelve outcome buttons from the prototype, two columns of six. */
export default function OutcomeButtons({ perspective, onPress, disabled }: Props) {
  const leftTone = perspective === 'pitcher' ? 'win' : 'loss';
  const rightTone = perspective === 'pitcher' ? 'loss' : 'win';
  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        {LOSS_OUTCOMES.map((o) => (
          <OutcomeButton key={o.id} outcome={o} tone={leftTone} onPress={onPress} disabled={disabled} />
        ))}
      </View>
      <View style={styles.column}>
        {WIN_OUTCOMES.map((o) => (
          <OutcomeButton key={o.id} outcome={o} tone={rightTone} onPress={onPress} disabled={disabled} />
        ))}
      </View>
    </View>
  );
}

function OutcomeButton({
  outcome,
  tone,
  onPress,
  disabled,
}: {
  outcome: Outcome;
  tone: 'win' | 'loss';
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
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: win ? colors.win : colors.loss },
        pressed && styles.pressed,
        disabled && styles.disabled,
        webCursor,
      ]}
    >
      <Text style={[styles.label, { color: win ? colors.text : '#FFFFFF' }]}>{outcome.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 24,
  },
  column: {
    flex: 1,
    gap: 10,
  },
  button: {
    minHeight: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
