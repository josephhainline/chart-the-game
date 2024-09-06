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

          if (route.name === 'team') {
            iconName = 'users';
          } else if (route.name === 'lineup') {
            iconName = 'users';
          } else if (route.name === 'index') {
            iconName = 'house';  
          } else if (route.name === 'games') {
            iconName = 'baseball-bat-ball';
          } else if (route.name === 'statistics') {
            iconName = 'chart-column';
          }

          return <TabBarIcon name={iconName} color={color} />;
        },
        tabBarActiveTintColor: 'orange',
        headerShown: false,
      })}
    >
      <Tabs.Screen name="team" options={{ title: 'Team' }} />
      <Tabs.Screen name="lineup" options={{ title: 'Lineup' }} />
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="games" options={{ title: 'Games' }} />
      <Tabs.Screen name="statistics" options={{ title: 'Statistics' }} />
    </Tabs>
  );
}
