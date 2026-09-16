import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import GameRow, { featuredGameIds, groupGamesByMonth } from '@/components/GameRow';
import Screen from '@/components/Screen';
import { EmptyState, FloatingButton, SectionBand } from '@/components/ui';
import { useStore, useTeam, useTeamGames } from '@/lib/store';

/** Team Games: this team's games grouped by month, with the "+ New Game" button. */
export default function TeamHomeScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const games = useTeamGames(teamId);
  const { data } = useStore();

  const groups = useMemo(() => groupGamesByMonth(games), [games]);
  const featured = useMemo(() => featuredGameIds(games), [games]);

  // The season list is chronological, so open it at the game the coach cares
  // about: the next one to chart, or the most recent one just finished.
  const focusId = useMemo(() => {
    const next = [...featured][0];
    if (next) return next;
    const finals = games.filter((g) => g.status === 'final').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return finals[finals.length - 1]?.id;
  }, [featured, games]);
  const scrollRef = useRef<ScrollView>(null);
  // Rows report their y within their month group and groups within the list;
  // both arrive in either order, so combine them in an effect.
  const [groupYs, setGroupYs] = useState<Record<string, number>>({});
  const [focusLocal, setFocusLocal] = useState<{ groupKey: string; y: number } | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || !focusLocal) return;
    const groupY = groupYs[focusLocal.groupKey];
    if (groupY === undefined) return;
    scrolled.current = true;
    // Leave the month band above the game visible.
    scrollRef.current?.scrollTo({ y: Math.max(0, groupY + focusLocal.y - 44), animated: false });
  }, [focusLocal, groupYs]);
  const onGroupLayout = (key: string) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setGroupYs((prev) => (prev[key] === y ? prev : { ...prev, [key]: y }));
  };
  const onFocusLayout = (groupKey: string) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setFocusLocal((prev) => (prev && prev.groupKey === groupKey && prev.y === y ? prev : { groupKey, y }));
  };

  const newGame = () => router.push(`/team/${teamId}/new-game`);

  return (
    <Screen>
      <AppHeader context={team?.name ?? 'Team'} />
      <View style={styles.body}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
          {groups.length === 0 ? (
            <EmptyState title="No games yet" body="Add your first game and chart every at-bat as a W or an L." />
          ) : (
            groups.map((group) => (
              <View key={group.key} onLayout={onGroupLayout(group.key)}>
                <SectionBand title={group.title} weight="regular" />
                {group.games.map((game) => (
                  <View key={game.id} onLayout={game.id === focusId ? onFocusLayout(group.key) : undefined}>
                    <GameRow
                      game={game}
                      atBats={data.atBats}
                      featured={featured.has(game.id)}
                      onPress={() => router.push(`/game/${game.id}`)}
                    />
                  </View>
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
