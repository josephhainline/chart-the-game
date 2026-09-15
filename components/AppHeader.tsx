import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { Href } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, type } from '@/constants/theme';
import { useDismiss } from '@/lib/navigation';

type Props = {
  /** Show the "a Coach Rob Floyd app" line under the title (app-level screens). */
  subtitle?: boolean;
  /** Context sub-header (team name or game title). Omit for app-level screens. */
  context?: string;
  /** Sub-header color: team level is dark blue, game level is orange. */
  contextColor?: string;
  /**
   * Where the back chevron lands when there is no history to go back to (a
   * direct link or a reload): the parent screen, e.g. "/" at team level and
   * `/team/${teamId}` at game level. Defaults to My Teams.
   */
  backHref?: Href;
  /** Replaces the default back behavior (back, else `backHref`) entirely. */
  onBack?: () => void;
  /** Optional element rendered on the right side of the sub-header (e.g. an edit button). */
  right?: React.ReactNode;
};

/**
 * The two-band header used on every screen except the intro:
 * a light-blue "Chart The Game" title band, then an optional context band.
 */
export default function AppHeader({ subtitle, context, contextColor = colors.primaryDark, backHref = '/', onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  const compact = Boolean(context);
  const dismiss = useDismiss(backHref);
  const goBack = onBack ?? dismiss;
  // Game titles ("@ Rawlings Tigers Meyer 14U, Aug 23 12:30pm") are long: the orange
  // band uses the prototype's 17px and may wrap to a second line.
  const gameLevel = contextColor === colors.orange;

  return (
    <View>
      <View style={[styles.titleBand, { paddingTop: insets.top + (compact ? 10 : 18) }, compact && styles.titleBandCompact]}>
        <Text style={[type.appTitle, compact && styles.compactTitle]}>Chart The Game</Text>
        {subtitle && !compact ? <Text style={type.appSubtitle}>a Coach Rob Floyd app</Text> : null}
      </View>
      {context ? (
        <View style={[styles.contextBand, { backgroundColor: contextColor }]}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <FontAwesome6 name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <Text style={[type.subheader, styles.contextTitle, gameLevel && styles.gameTitle, !right && styles.contextTitleCentered]} numberOfLines={2}>
            {context}
          </Text>
          {right ? <View style={styles.right}>{right}</View> : null}
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
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  back: {
    width: 36,
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
  // With nothing on the right, balance the back chevron so the title sits on
  // the band's center line like the prototype.
  contextTitleCentered: {
    paddingRight: 36,
  },
  gameTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
  right: {
    width: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
