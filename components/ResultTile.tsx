import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts } from '@/constants/theme';
import type { Result } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Props = {
  /** Already from the perspective being shown (W = green). */
  result: Result;
  /** Outcome abbreviation under the letter ("SF"); omit for a plain at-bat. */
  code?: string;
  /** 'row' (36×40) sits at the right of a batting-order row; 'large' (40×44) heads the editor. */
  size?: 'row' | 'large';
  /** Orange ring: this at-bat is selected for re-judging. */
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * One charted at-bat as a solid tile: a big W on green or L on red, with the
 * outcome code under the letter when the at-bat has a play type. Reads in
 * glare where a colored letter on white does not. Pressable when `onPress`
 * is given (tap to re-judge).
 */
export default function ResultTile({ result, code, size = 'row', selected, onPress, accessibilityLabel, style }: Props) {
  const win = result === 'W';
  const box = [
    styles.tile,
    size === 'large' ? styles.large : styles.row,
    { backgroundColor: win ? colors.win : colors.loss },
    selected && styles.selected,
  ];
  const body = (
    <>
      <Text style={[styles.letter, size === 'large' && styles.letterLarge, { color: win ? colors.text : colors.white }]}>{result}</Text>
      {code ? <Text style={[styles.code, { color: win ? colors.text : colors.white }]} numberOfLines={1}>{code}</Text> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[box, style]} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Re-judge ${result}`}
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [box, pressed && styles.pressed, webCursor, style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexShrink: 0,
  },
  row: { width: 36, height: 40 },
  large: { width: 40, height: 44 },
  selected: { borderWidth: 3, borderColor: colors.currentRail },
  pressed: { opacity: 0.75 },
  letter: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 24 },
  letterLarge: { fontSize: 24, lineHeight: 26 },
  code: { fontFamily: fonts.bold, fontSize: 9, lineHeight: 10, marginTop: 1 },
});
