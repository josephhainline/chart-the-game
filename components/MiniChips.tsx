import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { Result } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

export type MiniChip = {
  /** AtBat id. */
  id: string;
  /** Already from the perspective being shown (W = green). */
  result: Result;
  /** Orange ring: this at-bat is selected for re-judging. */
  selected?: boolean;
  accessibilityLabel?: string;
};

type Props = {
  /** One chip per at-bat, in game order. */
  chips: MiniChip[];
  /** Tap a chip to select that at-bat; chips are inert without it. */
  onPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A batter's game so far as a row of 18×16 tinted chips, one letter each,
 * shown under the name on every batting-order row and in the dock's AT-BAT
 * header. Renders nothing when there are no chips.
 */
export default function MiniChips({ chips, onPress, style }: Props) {
  if (chips.length === 0) return null;
  return (
    <View style={[styles.row, style]} accessibilityRole={onPress ? undefined : 'text'}>
      {chips.map((chip) => {
        const win = chip.result === 'W';
        const tone = [styles.chip, win ? styles.win : styles.loss, chip.selected && styles.selected];
        const letter = <Text style={[styles.letter, { color: win ? colors.winInk : colors.lossInk }]}>{chip.result}</Text>;
        if (!onPress) {
          return (
            <View key={chip.id} style={tone}>
              {letter}
            </View>
          );
        }
        return (
          <Pressable
            key={chip.id}
            onPress={() => onPress(chip.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={chip.accessibilityLabel ?? `Re-judge ${chip.result}`}
            accessibilityState={{ selected: Boolean(chip.selected) }}
            style={({ pressed }) => [tone, pressed && styles.pressed, webCursor]}
          >
            {letter}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  chip: { width: 18, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  win: { backgroundColor: 'rgba(119, 211, 83, 0.24)' },
  loss: { backgroundColor: 'rgba(249, 95, 98, 0.20)' },
  selected: { borderWidth: 2, borderColor: colors.currentRail },
  pressed: { opacity: 0.7 },
  letter: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13 },
});
