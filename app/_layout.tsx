import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, usePathname, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ConfirmDialog from '@/components/ConfirmDialog';
import PhoneFrame from '@/components/PhoneFrame';
import { introOnly } from '@/constants/gate';
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
  // Require the four faces we use directly; importing the package index would
  // bundle all ten Lato weights.
  const [fontsLoaded, fontError] = useFonts({
    Lato_400Regular: require('@expo-google-fonts/lato/400Regular/Lato_400Regular.ttf'),
    Lato_400Regular_Italic: require('@expo-google-fonts/lato/400Regular_Italic/Lato_400Regular_Italic.ttf'),
    Lato_700Bold: require('@expo-google-fonts/lato/700Bold/Lato_700Bold.ttf'),
    Lato_700Bold_Italic: require('@expo-google-fonts/lato/700Bold_Italic/Lato_700Bold_Italic.ttf'),
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
              <ConfirmDialog />
            </PhoneFrame>
          </ThemeProvider>
        </StoreProvider>
      </SafeAreaProvider>
  );
}

function AppStack() {
  const { ready, data } = useStore();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // First launch: show the intro once, whatever URL the coach arrived on, and
  // then return them to it. This lives at the root (not in the (app) group) so
  // a deep link into a team or game sees the intro too. The Stack stays
  // mounted so the router is ready when the redirect fires; a splash covers
  // the destination screen for the frame it takes.
  // While the site is held on the intro (constants/gate), even an onboarded
  // browser goes back to it, so a return visit cannot walk straight in.
  const needsIntro = ready && (introOnly() || !data.onboarded) && segments[0] !== 'intro';
  useEffect(() => {
    if (!needsIntro) return;
    router.replace(pathname === '/' ? '/intro' : { pathname: '/intro', params: { next: pathname } });
  }, [needsIntro, pathname, router]);

  if (!ready) return <Splash />;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="intro" options={{ animation: 'fade' }} />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="team/[teamId]" />
        <Stack.Screen name="game/[gameId]" />
        <Stack.Screen name="new-team" options={{ presentation: 'modal' }} />
      </Stack>
      {needsIntro ? (
        <View style={styles.cover}>
          <Splash />
        </View>
      ) : null}
    </>
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
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: { fontFamily: fonts.bold, fontSize: 36, color: '#fff' },
  splashSubtitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: 4 },
});
