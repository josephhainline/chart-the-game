import { Redirect, Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import TabBar, { TabIcon } from '@/components/TabBar';
import { colors } from '@/constants/theme';
import { useGame } from '@/lib/store';

/**
 * Game level: Home · Team · Opponent · CTG · Stats. Sub-header is orange.
 * The Home tab leaves the game and returns to the team's Home.
 * CTG (index) is the default screen when a game is opened.
 */
export default function GameTabsLayout() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = useGame(gameId);
  const router = useRouter();
  if (!game) return <Redirect href="/" />;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orange }}
      tabBar={(props) => <TabBar {...props} activeColor={colors.orange} />}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon name="house" color={color} /> }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.navigate(`/team/${game.teamId}`);
          },
        }}
      />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
      <Tabs.Screen name="opponent" options={{ title: 'Opponent', tabBarIcon: ({ color }) => <TabIcon name="people-group" color={color} /> }} />
      <Tabs.Screen name="index" options={{ title: 'CTG', tabBarIcon: ({ color }) => <TabIcon name="gauge-high" color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ color }) => <TabIcon name="chart-simple" color={color} /> }} />
    </Tabs>
  );
}
