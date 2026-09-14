import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { Button, Divider, EmptyState, FloatingButton } from '@/components/ui';
import { colors, type } from '@/constants/theme';
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
  const editTeam = () => router.push(`/team/${teamId}/edit`);
  // Team settings live in the body (like the player sheet), not in the header
  // band, which the prototype keeps to a back chevron and the team name.
  const editTeamRow = (
    <View style={styles.footer}>
      <Button title="Edit team" variant="ghost" icon="pen" onPress={editTeam} />
    </View>
  );

  return (
    <Screen>
      <AppHeader context={team.name}  />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Team Roster:</Text>
          {roster.length === 0 ? (
            <>
              <EmptyState
                title="No players yet"
                body="Add your players to start charting at-bats."
                action={<Button title="Add Player" icon="plus" onPress={addPlayer} />}
              />
              {editTeamRow}
            </>
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
          {roster.length > 0 ? (
            <>
              <Divider />
              {editTeamRow}
            </>
          ) : null}
        </ScrollView>
        {roster.length > 0 ? <FloatingButton title="Add Player" onPress={addPlayer} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  content: { paddingTop: 14, paddingBottom: 96 },
  // Prototype (5cc002e9…): 20pt underlined title, 56pt rows, names at x=59, chevron 24pt from the edge.
  title: {
    ...type.screenTitle,
    textDecorationLine: 'underline',
    paddingHorizontal: 12,
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: 60,
    paddingRight: 24,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.pressed },
  name: { ...type.rowTitle, flex: 1, marginRight: 12 },
  footer: { paddingHorizontal: 8, paddingTop: 12, alignItems: 'flex-start' },
});
