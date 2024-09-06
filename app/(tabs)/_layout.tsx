import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome6';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string; }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  useEffect(() => {
    console.log("Initial Route:", "index");
  }, []);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof FontAwesome.glyphMap = 'code';

          if (route.name === 'teams') {
            iconName = 'people-group';
          } else if (route.name === 'players') {
            iconName = 'users';
          } else if (route.name === 'index') {
            iconName = 'house';  // Changed from 'home' to 'house'
          } else if (route.name === 'game-tracker') {
            iconName = 'baseball-bat-ball';
          } else if (route.name === 'statistics') {
            iconName = 'chart-column';  // Changed from 'bar-chart' to 'chart-column'
          }

          return <TabBarIcon name={iconName} color={color} />;
        },
        tabBarActiveTintColor: 'orange',
        headerShown: false,
      })}
    >
      <Tabs.Screen name="teams" options={{ title: 'Teams' }} />
      <Tabs.Screen name="players" options={{ title: 'Players' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="game-tracker" options={{ title: 'Game Tracker' }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistics' }} />
    </Tabs>
  );
}
