import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, type } from '@/constants/theme';

type Props = {
  /** Show the "a Coach Rob Floyd app" line under the title (app-level screens). */
  subtitle?: boolean;
  /** Context sub-header (team name or game title). Omit for app-level screens. */
  context?: string;
  /** Sub-header color: team level is dark blue, game level is orange. */
  contextColor?: string;
  /** Where the back chevron goes. Defaults to router.back(). */
  onBack?: () => void;
  /** Hide the back chevron even when a context is shown. */
  hideBack?: boolean;
  /** Optional element rendered on the right side of the sub-header (e.g. an edit button). */
  right?: React.ReactNode;
};

/**
 * The two-band header used on every screen except the intro:
 * a light-blue "Chart The Game" title band, then an optional context band.
 */
export default function AppHeader({ subtitle, context, contextColor = colors.primaryDark, onBack, hideBack, right }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const compact = Boolean(context);

  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View>
      <View style={[styles.titleBand, { paddingTop: insets.top + (compact ? 10 : 18) }, compact && styles.titleBandCompact]}>
        <Text style={[type.appTitle, compact && styles.compactTitle]}>Chart The Game</Text>
        {subtitle && !compact ? <Text style={type.appSubtitle}>a Coach Rob Floyd app</Text> : null}
      </View>
      {context ? (
        <View style={[styles.contextBand, { backgroundColor: contextColor }]}>
          {!hideBack ? (
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            >
              <FontAwesome6 name="chevron-left" size={22} color="#fff" />
            </Pressable>
          ) : null}
          <Text style={[type.subheader, styles.contextTitle]} numberOfLines={1}>
            {context}
          </Text>
          <View style={styles.right}>{right}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBand: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  titleBandCompact: {
    paddingBottom: 10,
  },
  compactTitle: {
    fontSize: 22,
  },
  contextBand: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  pressed: {
    opacity: 0.6,
  },
  contextTitle: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
