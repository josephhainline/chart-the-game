import React, { useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/constants/theme';
import { answerConfirm, getPendingConfirm, subscribeConfirm } from '@/lib/confirm';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/**
 * The in-app confirmation sheet behind `confirmAction()` on web. Mounted once
 * in the root layout; renders nothing until something asks. Two buttons: a
 * gray Cancel and the destructive action in red.
 */
export default function ConfirmDialog() {
  const request = useSyncExternalStore(subscribeConfirm, getPendingConfirm, getPendingConfirm);
  if (!request) return null;
  const cancel = () => answerConfirm(request.id, false);
  const confirm = () => answerConfirm(request.id, true);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={cancel}>
      {/* Plain pressables (no button role) so the real buttons are not nested inside another button. */}
      <Pressable style={styles.scrim} onPress={cancel}>
        <Pressable style={styles.card} onPress={() => {}} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header">
            {request.title}
          </Text>
          <Text style={styles.message}>{request.message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed, webCursor]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              accessibilityRole="button"
              accessibilityLabel={request.confirmLabel}
              style={({ pressed }) => [styles.button, styles.confirm, pressed && styles.pressed, webCursor]}
            >
              <Text style={styles.confirmText}>{request.confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4, 11, 113, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: 20,
    gap: 10,
  },
  title: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 24, color: colors.text },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  button: {
    minWidth: 96,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: colors.chip },
  confirm: { backgroundColor: colors.loss },
  pressed: { opacity: 0.75 },
  cancelText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  confirmText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
