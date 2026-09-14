import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { Button } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { useStore } from '@/lib/store';

export default function AccountScreen() {
  const router = useRouter();
  const { setOnboarded, resetDemoData, clearAllData, loadIssue } = useStore();

  const replayIntro = () => {
    setOnboarded(false);
    router.replace('/intro');
  };

  const resetDemo = async () => {
    const ok = await confirmAction(
      'Reset demo data?',
      'This replaces every team, player, game and at-bat with the sample data.',
      'Reset',
    );
    if (ok) resetDemoData();
  };

  const clearAll = async () => {
    const ok = await confirmAction(
      'Clear all data?',
      'This removes every team, player, game and at-bat from this browser. It cannot be undone.',
      'Clear',
    );
    if (ok) clearAllData();
  };

  return (
    <Screen>
      <AppHeader subtitle />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <FontAwesome6 name="circle-user" size={40} color={colors.primaryDark} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.role}>COACH</Text>
            <Text style={styles.name}>Demo coach</Text>
            <Text style={styles.caption}>Signed in locally — data stays in this browser</Text>
            {loadIssue === 'backed_up' ? (
              <Text style={[styles.caption, { color: colors.loss }]}>Saved data couldn't be read; a backup was kept and the demo was reloaded.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <Button title="Replay intro" variant="outline" icon="play" size="lg" onPress={replayIntro} />
          <Button title="Reset demo data" variant="primary" icon="rotate-left" size="lg" onPress={resetDemo} />
          <Button title="Clear all data" variant="gray" icon="trash-can" size="lg" onPress={clearAll} />
        </View>

        <Text style={styles.footer}>Chart The Game prototype</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { padding: 20, paddingTop: 24, paddingBottom: 32, gap: 28 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  role: { ...type.label },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  caption: { ...type.caption, marginTop: 2 },
  actions: { gap: 14 },
  footer: { ...type.caption, textAlign: 'center' },
});
