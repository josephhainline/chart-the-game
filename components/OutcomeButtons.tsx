import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { LOSS_OUTCOMES, outcomeLabel, WIN_OUTCOMES, type Outcome } from '@/lib/outcomes';
import type { OutcomeId } from '@/lib/types';

export type Perspective = 'batter' | 'pitcher';

/**
 * 'regular' is the prototype's 38pt grid (the default). The Capture Dock uses
 * 'compact' (36pt buttons, 6pt row gaps) and, on short phones, 'tiny'
 * (28pt / 4pt) so the grid fits under the big buttons.
 */
export type OutcomeButtonsSize = 'regular' | 'compact' | 'tiny';

type Props = {
  /**
   * 'batter': left column (batter losses) is red, right column (batter wins) is green.
   * 'pitcher': the opponent is batting, so the colors flip — our pitcher won the
   * battles in the left column, so it is green and the right column is red.
   */
  perspective: Perspective;
  onPress: (outcomeId: OutcomeId) => void;
  disabled?: boolean;
  size?: OutcomeButtonsSize;
  /** Re-judge mode: the at-bat's current type gets a navy ring and a check. */
  selectedId?: OutcomeId;
};

/* touchAction stops the double-tap zoom delay on mobile browsers so a second tap is a second press. */
const webPress = Platform.OS === 'web' ? ({ cursor: 'pointer', touchAction: 'manipulation' } as const) : null;

/** Below this window width the labels drop to the prototype's 12px so the longest one stays on two lines. */
const ROOMY_WIDTH = 410;

/* Per-size metrics. Regular is sampled from the prototype at 375pt: 132x39 buttons, 9pt row gap, 50pt between columns, 29pt side margins. */
const METRICS: Record<OutcomeButtonsSize, { rowGap: number; columnGap: number; sides: number; minHeight: number; fontSize: number; lineHeight: number; padV: number }> = {
  regular: { rowGap: 8, columnGap: 44, sides: 28, minHeight: 38, fontSize: 12, lineHeight: 16, padV: 3 },
  compact: { rowGap: 6, columnGap: 12, sides: 16, minHeight: 36, fontSize: 11, lineHeight: 13, padV: 2 },
  tiny: { rowGap: 4, columnGap: 12, sides: 16, minHeight: 28, fontSize: 10, lineHeight: 11, padV: 1 },
};

/**
 * The twelve outcome buttons from the prototype: six rows of two, losses on
 * the left and wins on the right. Rendering by row (not two independent
 * columns) keeps each pair the same height, so a label that wraps never
 * knocks the grid out of alignment.
 */
export default function OutcomeButtons({ perspective, onPress, disabled, size = 'regular', selectedId }: Props) {
  const { width } = useWindowDimensions();
  const m = METRICS[size];
  const roomy = size === 'regular' && width >= ROOMY_WIDTH;
  const leftTone = perspective === 'pitcher' ? 'win' : 'loss';
  const rightTone = perspective === 'pitcher' ? 'loss' : 'win';
  return (
    <View style={[styles.rows, { gap: m.rowGap, paddingHorizontal: m.sides }]}>
      {LOSS_OUTCOMES.map((loss, i) => (
        <View key={loss.id} style={[styles.row, { gap: m.columnGap }]}>
          <OutcomeButton outcome={loss} tone={leftTone} roomy={roomy} size={size} selected={loss.id === selectedId} onPress={onPress} disabled={disabled} />
          <OutcomeButton
            outcome={WIN_OUTCOMES[i]}
            tone={rightTone}
            roomy={roomy}
            size={size}
            selected={WIN_OUTCOMES[i].id === selectedId}
            onPress={onPress}
            disabled={disabled}
          />
        </View>
      ))}
    </View>
  );
}

function OutcomeButton({
  outcome,
  tone,
  roomy,
  size,
  selected,
  onPress,
  disabled,
}: {
  outcome: Outcome;
  tone: 'win' | 'loss';
  roomy: boolean;
  size: OutcomeButtonsSize;
  selected: boolean;
  onPress: (outcomeId: OutcomeId) => void;
  disabled?: boolean;
}) {
  const win = tone === 'win';
  const m = METRICS[size];
  const ink = win ? colors.text : colors.white;
  return (
    <Pressable
      onPress={() => onPress(outcome.id)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={outcomeLabel(outcome.id)}
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: win ? colors.win : colors.loss, minHeight: m.minHeight, paddingVertical: m.padV },
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
        webPress,
      ]}
    >
      <Text style={[styles.label, { fontSize: roomy ? 13 : m.fontSize, lineHeight: m.lineHeight, color: ink }]}>{outcome.label}</Text>
      {selected ? <FontAwesome6 name="check" size={size === 'tiny' ? 8 : 10} color={ink} style={styles.check} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: {},
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  button: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  selected: { borderWidth: 3, borderColor: colors.navy },
  check: { position: 'absolute', top: 2, right: 4 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
});
