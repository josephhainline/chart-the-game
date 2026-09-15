import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { Href } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useDismiss } from '@/lib/navigation';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

/** Titles longer than this (the at-bat editor's "Batter 3 · ▼ 2nd · Weedon H. (#10) pitching") drop to 17pt and may wrap to two lines. */
const LONG_TITLE = 22;

type Props = {
  title: string;
  /** Label for the right-side action, e.g. "Save". Hidden when omitted. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /**
   * Where Close lands when there is no history to go back to (a direct link
   * or a reload): the sheet's parent screen. Defaults to My Teams.
   */
  fallbackHref?: Href;
  /** Replaces the default dismiss (back, else `fallbackHref`) entirely. */
  onClose?: () => void;
  /** Header color; modals at game level use orange. */
  color?: string;
  children: React.ReactNode;
};

/**
 * Form/sheet screen presented modally: colored header with Close on the left,
 * a title, and an optional action on the right; scrollable body.
 */
export default function ModalScreen({ title, actionLabel, onAction, actionDisabled, fallbackHref = '/', onClose, color = colors.primaryDark, children }: Props) {
  const insets = useSafeAreaInsets();
  const dismiss = useDismiss(fallbackHref);
  const close = onClose ?? dismiss;
  const long = title.length > LONG_TITLE;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 10 }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={[styles.side, webCursor]}>
          <FontAwesome6 name="xmark" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.title, long && styles.titleLong]} numberOfLines={long ? 2 : 1}>
          {title}
        </Text>
        {actionLabel ? (
          <Pressable
            onPress={onAction}
            disabled={actionDisabled}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={[styles.side, styles.sideRight, webCursor, actionDisabled && { opacity: 0.4 }]}
          >
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : (
          // Keeps the title centered when there is no action.
          <View style={[styles.side, styles.sideRight]} />
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 },
  side: { minWidth: 56, height: 36, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
  titleLong: { fontSize: 17, lineHeight: 21 },
  action: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  body: { padding: 20, paddingBottom: 40 },
});
