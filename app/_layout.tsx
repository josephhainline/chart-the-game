import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import {
  Lato_400Regular,
  Lato_400Regular_Italic,
  Lato_700Bold,
  Lato_700Bold_Italic,
} from '@expo-google-fonts/lato';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import PhoneFrame from '@/components/PhoneFrame';
import { colors, fonts } from '@/constants/theme';
import { StoreProvider, useStore } from '@/lib/store';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.surface,
    card: colors.surface,
    text: colors.text,
    border: colors.divider,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lato_400Regular,
    Lato_400Regular_Italic,
    Lato_700Bold,
    Lato_700Bold_Italic,
    ...FontAwesome6.font,
  });

  useEffect(() => {
    if (fontError) console.warn('Font loading failed', fontError);
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  return (
    <SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider value={navTheme}>
            <PhoneFrame>
              <StatusBar style="light" />
              {fontsLoaded || fontError ? <AppStack /> : <Splash />}
            </PhoneFrame>
          </ThemeProvider>
        </StoreProvider>
      </SafeAreaProvider>
  );
}

function AppStack() {
  const { ready } = useStore();
  if (!ready) return <Splash />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="intro" options={{ animation: 'fade' }} />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="team/[teamId]" />
      <Stack.Screen name="game/[gameId]" />
      <Stack.Screen name="new-team" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

/** Blue splash matching the prototype's first screen, shown while fonts and data load. */
function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashTitle}>Chart The Game</Text>
      <Text style={styles.splashSubtitle}>a Coach Rob Floyd app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { fontFamily: fonts.bold, fontSize: 36, color: '#fff' },
  splashSubtitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: 4 },
});
