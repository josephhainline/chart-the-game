import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import { LOSS_OUTCOMES, WIN_OUTCOMES, catalogFor, outcomeLabel, type Outcome } from '@/lib/outcomes';
import type { OutcomeId } from '@/lib/types';

/** Which grid to show: the batter outcomes while we hit, the pitcher outcomes while we pitch. */
export type OutcomeButtonsMode = 'hitting' | 'pitching';

/**
 * 'regular' is the prototype's 38pt grid (the default). The Capture Dock uses
 * 'compact' (34pt rows, 4pt row gaps) and, on short phones, 'tiny'
 * (28pt / 4pt) so the grid fits under the big buttons.
 */
export type OutcomeButtonsSize = 'regular' | 'compact' | 'tiny';

type Props = {
  mode: OutcomeButtonsMode;
  onPress: (outcomeId: OutcomeId) => void;
  disabled?: boolean;
  size?: OutcomeButtonsSize;
  /** Re-judge mode: the at-bat's current type gets a navy ring and a check. */
  selectedId?: OutcomeId;
  /**
   * The dock's grid: one box height per size in both modes (the batter
   * grid's seven rows), the rows sharing it evenly, so the big buttons above
   * never move when the half changes. Off (the editor), rows sit at their
   * natural height.
   */
  fixedBox?: boolean;
};

/* touchAction stops the double-tap zoom delay on mobile browsers so a second tap is a second press. */
const webPress = Platform.OS === 'web' ? ({ cursor: 'pointer', touchAction: 'manipulation' } as const) : null;

/** Below this window width the labels drop to the prototype's 12px so the longest one stays on two lines. */
const ROOMY_WIDTH = 410;

/* Per-size metrics. Regular is sampled from the prototype at 375pt: 132x39 buttons, 9pt row gap, 50pt between columns, 29pt side margins. */
const METRICS: Record<OutcomeButtonsSize, { rowGap: number; columnGap: number; sides: number; minHeight: number; fontSize: number; lineHeight: number; padV: number }> = {
  regular: { rowGap: 8, columnGap: 44, sides: 28, minHeight: 38, fontSize: 12, lineHeight: 16, padV: 3 },
  compact: { rowGap: 4, columnGap: 12, sides: 16, minHeight: 34, fontSize: 11, lineHeight: 13, padV: 2 },
  tiny: { rowGap: 4, columnGap: 12, sides: 16, minHeight: 28, fontSize: 10, lineHeight: 11, padV: 1 },
};

/**
 * The fixed box is the height of the batter grid (seven rows at `minHeight`
 * plus the gaps): 314pt regular, 262pt compact, 220pt tiny.
 */
const BOX_ROWS = Math.max(LOSS_OUTCOMES.length, WIN_OUTCOMES.length);

function boxHeight(size: OutcomeButtonsSize): number {
  const m = METRICS[size];
  return BOX_ROWS * m.minHeight + (BOX_ROWS - 1) * m.rowGap;
}

/**
 * The outcome grid: the side's catalog in rows of two, L column on the left
 * (red) and W column on the right (green), in both modes. Rendering by row
 * (not two independent columns) keeps each pair the same height, so a label
 * that wraps never knocks the grid out of alignment. In a fixed box the rows
 * share it evenly (`flex: 1`): the seven batter rows fill it at `minHeight`
 * (row 7 is a blank L cell beside Hit by Pitch); the four pitcher rows
 * stretch to fill the same box, so a pitcher button is taller.
 */
export default function OutcomeButtons({ mode, onPress, disabled, size = 'regular', selectedId, fixedBox = false }: Props) {
  const { width } = useWindowDimensions();
  const m = METRICS[size];
  const roomy = size === 'regular' && width >= ROOMY_WIDTH;
  const { loss, win } = catalogFor(mode === 'hitting' ? 'us' : 'them');
  const rows = Array.from({ length: Math.max(loss.length, win.length) }, (_, i) => [loss[i], win[i]] as const);
  return (
    <View style={[styles.rows, fixedBox && { height: boxHeight(size) }, { gap: m.rowGap, paddingHorizontal: m.sides }]}>
      {rows.map(([l, w], i) => (
        <View key={l?.id ?? w?.id ?? i} style={[styles.row, fixedBox && styles.rowFill, { gap: m.columnGap }]}>
          {l ? (
            <OutcomeButton outcome={l} tone="loss" roomy={roomy} size={size} selected={l.id === selectedId} onPress={onPress} disabled={disabled} />
          ) : (
            <View style={styles.blank} />
          )}
          {w ? (
            <OutcomeButton outcome={w} tone="win" roomy={roomy} size={size} selected={w.id === selectedId} onPress={onPress} disabled={disabled} />
          ) : (
            <View style={styles.blank} />
          )}
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
  rowFill: { flex: 1 },
  button: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  /** An empty cell keeps the other column at its width (the batter grid's seventh row has no L). */
  blank: { flex: 1 },
  selected: { borderWidth: 3, borderColor: colors.navy },
  check: { position: 'absolute', top: 2, right: 4 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.bold,
    textAlign: 'center',
  },
});
