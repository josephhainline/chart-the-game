import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, type } from '@/constants/theme';

type TabIconName = React.ComponentProps<typeof FontAwesome6>['name'];

/**
 * Bottom tab bar matching the prototype: each tab is a rounded light-gray chip
 * holding an icon, with the label underneath. The active tab tints its icon.
 */
export default function TabBar({ state, descriptors, navigation, activeColor = colors.primary }: BottomTabBarProps & { activeColor?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const color = focused ? activeColor : colors.text;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            aria-selected={focused}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={styles.chip}>
              {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 26 }) : null}
            </View>
            <Text style={[type.tab, focused && { color: activeColor }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TabIcon({ name, color }: { name: TabIconName; color: string }) {
  return <FontAwesome6 name={name} size={26} color={color} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#D9DCF0',
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: {
    alignItems: 'center',
    minWidth: 64,
    gap: 4,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  pressed: {
    opacity: 0.7,
  },
  chip: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
