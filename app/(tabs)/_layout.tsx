import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
            iconName = 'users';
          } else if (route.name === 'players') {
            iconName = 'user';
          } else if (route.name === 'index') {
            iconName = 'home';
          } else if (route.name === 'game-tracker') {
            iconName = 'gamepad';
          } else if (route.name === 'statistics') {
            iconName = 'bar-chart';
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
