import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from 'react-native';

// Import your screens
import TeamsScreen from '@/app/(tabs)/teams';
import PlayersScreen from '@/app/(tabs)/players';
import GameTrackerScreen from '@/app/(tabs)/game-tracker';
import StatisticsScreen from '@/app/(tabs)/statistics';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string; }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof FontAwesome.glyphMap = 'code'; // default icon

          if (route.name === 'teams') {
            iconName = 'users';
          } else if (route.name === 'players') {
            iconName = 'user';
          } else if (route.name === 'game-tracker') {
            iconName = 'gamepad';
          } else if (route.name === 'statistics') {
            iconName = 'bar-chart';
          }

          return <TabBarIcon name={iconName} color={color} />;
        },
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      })}
    >
      <Tabs.Screen name="teams" options={{ title: 'Teams' }} />
      <Tabs.Screen name="players" options={{ title: 'Players' }} />
      <Tabs.Screen name="game-tracker" options={{ title: 'Game Tracker' }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistics' }} />
    </Tabs>
  );
}
