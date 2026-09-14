import { Tabs } from 'expo-router';
import React from 'react';

import TabBar, { TabIcon } from '@/components/TabBar';
import { colors } from '@/constants/theme';

/** App level: Home (My Teams) · Games · About · Account. The first-launch intro gate lives in app/_layout.tsx. */
export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} activeColor={colors.primary} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="house" color={color} /> }} />
      <Tabs.Screen name="games" options={{ title: 'Games', tabBarIcon: ({ color }) => <TabIcon name="baseball" color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: 'About', tabBarIcon: ({ color }) => <TabIcon name="circle-info" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <TabIcon name="circle-user" color={color} /> }} />
    </Tabs>
  );
}
