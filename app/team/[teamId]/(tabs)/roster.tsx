import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { Button, Divider, EmptyState, FloatingButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { byLastName, playerLabel } from '@/lib/format';
import { useTeam, useTeamPlayers } from '@/lib/store';
import type { Player } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

/** Team tab: the roster sorted by last name, with a floating "+ Add Player". */
export default function RosterScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const players = useTeamPlayers(teamId);
  const roster = useMemo(() => [...players].sort(byLastName), [players]);

  if (!team) return <Screen>{null}</Screen>;

  const addPlayer = () => router.push(`/team/${teamId}/new-player`);
  const openPlayer = (p: Player) => router.push(`/team/${teamId}/player/${p.id}`);

  return (
    <Screen>
      <AppHeader
        context={team.name}
        onBack={() => router.replace('/')}
        right={
          <Pressable
            onPress={() => router.push(`/team/${teamId}/edit`)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit team"
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <FontAwesome6 name="pen" size={18} color="#fff" />
          </Pressable>
        }
      />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Team Roster:</Text>
          {roster.length === 0 ? (
            <EmptyState
              title="No players yet"
              body="Add your players to start charting at-bats."
              action={<Button title="Add Player" icon="plus" onPress={addPlayer} />}
            />
          ) : (
            roster.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => openPlayer(p)}
                  accessibilityRole="button"
                  accessibilityLabel={playerLabel(p)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed, webCursor]}
                >
                  <Text style={styles.name} numberOfLines={1}>
                    {playerLabel(p)}
                  </Text>
                  <FontAwesome6 name="chevron-right" size={24} color={colors.tabLabel} />
                </Pressable>
              </React.Fragment>
            ))
          )}
          {roster.length > 0 ? <Divider /> : null}
        </ScrollView>
        {roster.length > 0 ? <FloatingButton title="Add Player" onPress={addPlayer} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { paddingTop: 20, paddingBottom: 96 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
    textDecorationLine: 'underline',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingLeft: 64,
    paddingRight: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: '#F4F6FA' },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 24, color: colors.text, marginRight: 12 },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  pressed: { opacity: 0.6 },
});
