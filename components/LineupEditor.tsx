import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import PositionPicker from '@/components/PositionPicker';
import { EmptyState, PositionBadge } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { byLastName, playerLabel } from '@/lib/format';
import type { LineupSlot, Player, Position } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

type Props = {
  slots: LineupSlot[];
  /** The team's roster; anyone not in `slots` is listed on the bench. */
  players: Player[];
  onChange: (slots: LineupSlot[]) => void;
  /** Heading above the list, e.g. "Default Lineup:". Omit it (and headerRight) to start the list at the top. */
  title?: string;
  /** Rendered to the right of the title (an action button). */
  headerRight?: React.ReactNode;
  benchTitle?: string;
  /** Optional one-line note under the title. */
  caption?: string;
  /** Rendered after the bench, inside the scroll view (a secondary action). */
  footer?: React.ReactNode;
};

type Row = { slot: LineupSlot; index: number; player: Player };

/**
 * Numbered batting order with a position badge (tap to change) and up/down
 * controls on each row, followed by the bench of players not in the lineup.
 * Shared by the team's Default Lineup screen and the in-game Team tab.
 */
export default function LineupEditor({ slots, players, onChange, title, headerRight, benchTitle = 'Bench', caption, footer }: Props) {
  const [editing, setEditing] = useState<number | null>(null);

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const out: Row[] = [];
    slots.forEach((slot, index) => {
      const player = byId.get(slot.playerId);
      if (player) out.push({ slot, index, player });
    });
    return out;
  }, [slots, players]);

  const bench = useMemo(() => {
    const inLineup = new Set(slots.map((s) => s.playerId));
    return players.filter((p) => !inLineup.has(p.id)).sort(byLastName);
  }, [slots, players]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= slots.length || from === to) return;
    const next = [...slots];
    const [slot] = next.splice(from, 1);
    next.splice(to, 0, slot);
    onChange(next);
  };

  const setPosition = (index: number, position: Position | undefined) => {
    onChange(
      slots.map((s, i) => {
        if (i === index) return position ? { playerId: s.playerId, position } : { playerId: s.playerId };
        // Only one pitcher at a time: giving this slot P takes it off any other slot.
        if (position === 'P' && s.position === 'P') return { playerId: s.playerId };
        return s;
      }),
    );
    setEditing(null);
  };

  const remove = (index: number) => {
    onChange(slots.filter((_, i) => i !== index));
    setEditing(null);
  };

  const add = (playerId: string) => onChange([...slots, { playerId }]);

  const editingRow = editing === null ? undefined : rows.find((r) => r.index === editing);

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {title || headerRight ? (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {headerRight}
            </View>
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
            <View style={styles.rule} />
          </>
        ) : null}

        {rows.length === 0 ? (
          players.length === 0 ? (
            <EmptyState title="No players yet" body="Add players on the Team tab to build a lineup." />
          ) : (
            <EmptyState title="No one in the lineup yet" body="Tap + next to a player below to add them." />
          )
        ) : (
          rows.map(({ slot, index, player }) => {
            const label = playerLabel(player);
            return (
              <View key={slot.playerId} style={styles.row}>
                <Text style={styles.num}>{index + 1}.</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {label}
                </Text>
                <PositionBadge position={slot.position} onPress={() => setEditing(index)} />
                <View style={styles.arrows}>
                  <ArrowButton
                    direction="up"
                    disabled={index === 0}
                    onPress={() => move(index, index - 1)}
                    label={`Move ${label} up`}
                  />
                  <ArrowButton
                    direction="down"
                    disabled={index === slots.length - 1}
                    onPress={() => move(index, index + 1)}
                    label={`Move ${label} down`}
                  />
                </View>
              </View>
            );
          })
        )}

        {bench.length > 0 ? (
          <View style={styles.bench}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{benchTitle}</Text>
            </View>
            <Text style={styles.caption}>Not in the lineup</Text>
            <View style={styles.rule} />
            {bench.map((player) => {
              const label = playerLabel(player);
              return (
                <View key={player.id} style={styles.row}>
                  <Text style={[styles.name, styles.benchName]} numberOfLines={1}>
                    {label}
                  </Text>
                  <Pressable
                    onPress={() => add(player.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${label} to lineup`}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed, webCursor]}
                  >
                    <FontAwesome6 name="plus" size={20} color={colors.white} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>

      <PositionPicker
        visible={Boolean(editingRow)}
        playerName={editingRow ? playerLabel(editingRow.player) : ''}
        position={editingRow?.slot.position}
        onSelect={(position) => editingRow && setPosition(editingRow.index, position)}
        onRemove={() => editingRow && remove(editingRow.index)}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

function ArrowButton({
  direction,
  disabled,
  onPress,
  label,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.arrow, pressed && !disabled && styles.pressed, disabled && styles.arrowDisabled, !disabled && webCursor]}
    >
      <FontAwesome6 name={direction === 'up' ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingTop: 4,
    minHeight: 50,
  },
  title: { ...type.screenTitle, flexShrink: 1 },
  caption: { ...type.caption, paddingHorizontal: 16, paddingBottom: 8 },
  rule: { height: 1, backgroundColor: colors.divider },
  // Prototype (6a45802c…): 56pt rows, 20pt number and name, name at x=59, 44pt badge.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 16,
    paddingRight: 4,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  num: { fontFamily: fonts.regular, fontSize: 20, lineHeight: 24, color: colors.text, width: 38 },
  name: { ...type.rowTitle, flex: 1 },
  benchName: { marginLeft: 44, color: colors.textMuted },
  // Up/down stacked in the 56px row: two 44x28 halves (the row height caps them).
  arrows: { width: 44 },
  arrow: { width: 44, height: 28, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: 0.25 },
  pressed: { opacity: 0.6 },
  bench: { marginTop: 12 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  footer: { paddingHorizontal: 16, paddingTop: 16, alignItems: 'flex-start' },
});
