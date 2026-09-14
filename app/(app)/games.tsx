import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import GameRow, { featuredGameIds, groupGamesByMonth } from '@/components/GameRow';
import Screen from '@/components/Screen';
import { EmptyState, SectionBand } from '@/components/ui';
import { useStore } from '@/lib/store';

/** All Games: every game from every team, grouped by month, each row captioned with its team. */
export default function AllGamesScreen() {
  const router = useRouter();
  const { data } = useStore();

  const groups = useMemo(() => groupGamesByMonth(data.games), [data.games]);
  const featured = useMemo(() => featuredGameIds(data.games), [data.games]);
  const teamNames = useMemo(() => new Map(data.teams.map((t) => [t.id, t.name])), [data.teams]);

  return (
    <Screen>
      <AppHeader subtitle />
      <View style={styles.body}>
        <ScrollView contentContainerStyle={styles.list}>
          {groups.length === 0 ? (
            <EmptyState title="No games yet" body="Open a team and add a game to start charting." />
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
                    teamName={teamNames.get(game.teamId)}
                    onPress={() => router.push(`/game/${game.id}`)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  list: { paddingBottom: 24 },
});
