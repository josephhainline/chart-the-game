import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

/** Page indicator for the intro carousel. Each dot is tappable. */
export default function Dots({ count, index, onSelect }: { count: number; index: number; onSelect: (i: number) => void }) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, i) => {
        const active = i === index;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            aria-selected={active}
            accessibilityLabel={`Page ${i + 1} of ${count}`}
            style={({ pressed }) => [styles.hit, pressed && styles.pressed, webCursor]}
          >
            <View style={[styles.dot, active && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.band },
  dotActive: { width: 26, backgroundColor: colors.orange },
});
