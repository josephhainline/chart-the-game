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

  // Tabs that have never been focused have no params of their own, so seed the
  // team id into every tab; otherwise tapping a fresh tab renders it without a team.
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} activeColor={colors.primary} />}
    >
      <Tabs.Screen name="index" initialParams={{ teamId }} options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="house" color={color} /> }} />
      <Tabs.Screen name="roster" initialParams={{ teamId }} options={{ title: 'Team', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
      <Tabs.Screen name="lineup" initialParams={{ teamId }} options={{ title: 'Lineup', tabBarIcon: ({ color }) => <TabIcon name="rectangle-list" color={color} /> }} />
      <Tabs.Screen name="stats" initialParams={{ teamId }} options={{ title: 'Stats', tabBarIcon: ({ color }) => <TabIcon name="chart-simple" color={color} /> }} />
    </Tabs>
  );
}
