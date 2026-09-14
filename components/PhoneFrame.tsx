import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, PHONE_MAX_WIDTH, shadow } from '@/constants/theme';

/**
 * On wide web viewports, render the app inside a centered phone-width column
 * on a light gray page so it reads as a phone prototype. On native and narrow
 * screens it is invisible.
 */
export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow,
  },
});
