import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { colors, fonts, PHONE_MAX_WIDTH, radii, type } from '@/constants/theme';
import type { Position } from '@/lib/types';
import { POSITIONS } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

type Props = {
  visible: boolean;
  /** Who the sheet is about, e.g. "Owen Haynes (#7)". */
  playerName: string;
  position?: Position;
  /** Called with the chosen position, or undefined for "No position". */
  onSelect: (position: Position | undefined) => void;
  onRemove: () => void;
  onClose: () => void;
};

/**
 * Bottom sheet for one lineup row: pick a fielding position, clear it, or
 * take the player out of the lineup (they go back to the bench).
 */
export default function PositionPicker({ visible, playerName, position, onSelect, onRemove, onClose }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close position picker" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.grabber} />
          <Text style={styles.title} numberOfLines={2}>
            {playerName}
          </Text>
          <Text style={styles.subtitle}>POSITION</Text>

          <View style={styles.chips}>
            {POSITIONS.map((p) => {
              const active = p === position;
              return (
                <Pressable
                  key={p}
                  onPress={() => onSelect(p)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set position ${p}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed, webCursor]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => onSelect(undefined)}
              accessibilityRole="button"
              accessibilityLabel="No position"
              accessibilityState={{ selected: !position }}
              style={({ pressed }) => [styles.chip, styles.chipWide, !position && styles.chipActive, pressed && styles.pressed, webCursor]}
            >
              <Text style={[styles.chipText, !position && styles.chipTextActive]}>No position</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="Remove from lineup"
            style={({ pressed }) => [styles.remove, pressed && styles.pressed, webCursor]}
          >
            <FontAwesome6 name="user-minus" size={18} color={colors.loss} />
            <Text style={styles.removeText}>Remove from lineup</Text>
          </Pressable>

          <Button title="Cancel" variant="ghost" onPress={onClose} style={styles.cancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 11, 113, 0.35)' },
  sheet: {
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.band },
  title: { ...type.h2, marginTop: 4 },
  subtitle: { ...type.label, marginTop: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minWidth: 64,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipWide: { flexGrow: 1 },
  chipActive: { backgroundColor: colors.primaryDark },
  chipText: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  chipTextActive: { color: '#fff' },
  divider: { height: 1, backgroundColor: colors.divider },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  removeText: { fontFamily: fonts.bold, fontSize: 18, color: colors.loss },
  cancel: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
});
