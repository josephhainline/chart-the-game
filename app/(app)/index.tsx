import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AppHeader from '@/components/AppHeader';
import Screen from '@/components/Screen';
import { EmptyState, ListRow } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { useStore } from '@/lib/store';
import type { Team } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

export default function MyTeamsScreen() {
  const router = useRouter();
  const { data } = useStore();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const teams = useMemo(() => {
    const sorted = [...data.teams].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((t) => t.name.toLowerCase().includes(q)) : sorted;
  }, [data.teams, query]);

  const hasTeams = data.teams.length > 0;

  return (
    <Screen>
      <AppHeader subtitle />

      <View style={styles.searchWrap}>
        <View style={[styles.search, searchFocused && styles.searchFocused]}>
          <FontAwesome6 name="magnifying-glass" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Search teams"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={webCursor}
            >
              <FontAwesome6 name="circle-xmark" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.headingRow}>
        <Text style={type.h1}>My Teams</Text>
      </View>

      <FlatList
        data={teams}
        keyExtractor={(t) => t.id}
        style={styles.list}
        contentContainerStyle={teams.length === 0 ? styles.listEmpty : undefined}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <TeamRow team={item} onPress={() => router.push(`/team/${item.id}`)} />}
        ListEmptyComponent={
          hasTeams ? (
            <EmptyState title={`No teams match "${query.trim()}"`} body="Try a different name." />
          ) : (
            <EmptyState title="No teams yet" body="Add your first team to start charting games." />
          )
        }
      />

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.push('/new-team')}
          accessibilityRole="button"
          accessibilityLabel="Add Team"
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed, webCursor]}
        >
          <FontAwesome6 name="plus" size={24} color="#fff" style={styles.addIcon} />
          <Text style={styles.addText}>Add Team</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function TeamRow({ team, onPress }: { team: Team; onPress: () => void }) {
  return <ListRow title={team.name} onPress={onPress} titleStyle={styles.teamName} />;
}

const styles = StyleSheet.create({
  searchWrap: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    // The border is always there (in the chip's own color) so focusing does
    // not shift the content; focus only recolors it.
    borderWidth: 2,
    borderColor: colors.chip,
    backgroundColor: colors.chip,
  },
  searchFocused: {
    borderColor: colors.primary,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontFamily: fonts.regular,
    fontSize: 19,
    color: colors.text,
    // The focus ring is drawn on the rounded chip instead of the inner input.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  headingRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  list: { flex: 1 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  teamName: { fontSize: 22 },
  footer: {
    paddingHorizontal: 50,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.surface,
  },
  addButton: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { position: 'absolute', left: 36 },
  addText: { fontFamily: fonts.bold, fontSize: 22, color: '#fff' },
  pressed: { opacity: 0.75 },
});
