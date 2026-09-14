import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';

type Props = {
  title: string;
  /** Label for the right-side action, e.g. "Save". Hidden when omitted. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Defaults to router.back(). */
  onClose?: () => void;
  /** Header color; modals at game level use orange. */
  color?: string;
  children: React.ReactNode;
  /** Set false for screens that manage their own scrolling. */
  scroll?: boolean;
};

/**
 * Form/sheet screen presented modally: colored header with Close on the left,
 * a title, and an optional action on the right; scrollable body.
 */
export default function ModalScreen({ title, actionLabel, onAction, actionDisabled, onClose, color = colors.primaryDark, children, scroll = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (onClose) return onClose();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const body = scroll ? <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={styles.bodyFixed}>{children}</View>;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { backgroundColor: color, paddingTop: insets.top + 10 }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.side}>
          <FontAwesome6 name="xmark" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Pressable
          onPress={onAction}
          disabled={!actionLabel || actionDisabled}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.side, styles.sideRight, actionDisabled && { opacity: 0.4 }]}
        >
          {actionLabel ? <Text style={styles.action}>{actionLabel}</Text> : null}
        </Pressable>
      </View>
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 },
  side: { minWidth: 56, height: 36, justifyContent: 'center', ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null) },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
  action: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  body: { padding: 20, paddingBottom: 40 },
  bodyFixed: { flex: 1 },
});
