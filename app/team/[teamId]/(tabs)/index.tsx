import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import GameRow, { featuredGameIds, groupGamesByMonth } from '@/components/GameRow';
import Screen from '@/components/Screen';
import { EmptyState, FloatingButton, SectionBand } from '@/components/ui';
import { useStore, useTeam, useTeamGames } from '@/lib/store';

/** Team Home: this team's games grouped by month, with the "+ New Game" button. */
export default function TeamHomeScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const games = useTeamGames(teamId);
  const { data } = useStore();

  const groups = useMemo(() => groupGamesByMonth(games), [games]);
  const featured = useMemo(() => featuredGameIds(games), [games]);

  const newGame = () => router.push(`/team/${teamId}/new-game`);

  return (
    <Screen>
      <AppHeader context={team?.name ?? 'Team'} onBack={() => router.replace('/')} />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.list}>
          {groups.length === 0 ? (
            <EmptyState title="No games yet" body="Add your first game and chart every at-bat as a W or an L." />
          ) : (
            groups.map((group) => (
              <View key={group.key}>
                <SectionBand title={group.title} />
                {group.games.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    atBats={data.atBats}
                    featured={featured.has(game.id)}
                    onPress={() => router.push(`/game/${game.id}`)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
        <FloatingButton title="New Game" onPress={newGame} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  list: { paddingBottom: 96 },
});
