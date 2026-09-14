import { Redirect, Tabs, useLocalSearchParams } from 'expo-router';
import React from 'react';

import TabBar, { TabIcon } from '@/components/TabBar';
import { colors } from '@/constants/theme';
import { useTeam } from '@/lib/store';

/** Team level: Home (games) · Team (roster) · Lineup · Stats. Sub-header is dark blue. */
export default function TeamTabsLayout() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const team = useTeam(teamId);
  if (!team) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}
      tabBar={(props) => <TabBar {...props} activeColor={colors.primary} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="house" color={color} /> }} />
      <Tabs.Screen name="roster" options={{ title: 'Team', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup', tabBarIcon: ({ color }) => <TabIcon name="rectangle-list" color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ color }) => <TabIcon name="chart-simple" color={color} /> }} />
    </Tabs>
  );
}
