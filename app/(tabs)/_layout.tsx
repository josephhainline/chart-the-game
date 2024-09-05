import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string; }) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="game-tracker"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          let iconName: keyof typeof FontAwesome.glyphMap = 'code';

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
        tabBarActiveTintColor: 'orange',
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
