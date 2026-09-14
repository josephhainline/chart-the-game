import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import StatsTable from '@/components/StatsTable';
import { Divider, Segmented } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { seasonTable, type StatMode } from '@/lib/stats';
import { useStore, useTeam, useTeamGames, useTeamPlayers } from '@/lib/store';

const MODES: { value: StatMode; label: string }[] = [
  { value: 'hitting', label: 'Hitting' },
  { value: 'pitching', label: 'Pitching' },
];

function modeColor(mode: StatMode): string {
  return mode === 'hitting' ? colors.primaryDark : colors.pitching;
}

/** Team-level Stats tab: Hitting / Pitching season table. */
export default function StatsScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const players = useTeamPlayers(teamId);
  const games = useTeamGames(teamId);
  const { data } = useStore();
  const [mode, setMode] = useState<StatMode>('hitting');

  const rows = useMemo(
    () => (team ? seasonTable(team, players, games, data.atBats, mode) : []),
    [team, players, games, data.atBats, mode],
  );

  if (!team) return null;

  return (
    <Screen>
      <AppHeader context={team.name} onBack={() => router.replace('/')} />
      <Segmented options={MODES} value={mode} onChange={setMode} colorsFor={modeColor} />
      <Divider />
      <View style={[styles.band, { backgroundColor: modeColor(mode) }]}>
        <Text style={styles.bandText}>Statistics: {team.season} Season</Text>
      </View>
      <StatsTable
        rows={rows}
        emptyTitle="No players yet"
        emptyBody="Add players on the Team tab and their season stats will show up here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 16, paddingVertical: 8 },
  bandText: { fontFamily: fonts.bold, fontSize: 24, color: '#fff' },
});
