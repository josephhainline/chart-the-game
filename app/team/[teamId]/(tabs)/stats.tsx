import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import StatsTable from '@/components/StatsTable';
import { Divider, SectionBand, Segmented } from '@/components/ui';
import { colors } from '@/constants/theme';
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
      <AppHeader context={team.name}  />
      <Segmented options={MODES} value={mode} onChange={setMode} colorsFor={modeColor} />
      <Divider />
      <SectionBand title={`Statistics: ${team.season} Season`} color={modeColor(mode)} textColor={colors.white} />
      <StatsTable
        rows={rows}
        emptyTitle="No players yet"
        emptyBody="Add players on the Team tab and their season stats will show up here."
      />
    </Screen>
  );
}
