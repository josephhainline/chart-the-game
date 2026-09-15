import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import FormLine, { benchNote, describeForm, formFor, HiddenText, RatingPill } from '@/components/FormLine';
import MiniChips, { type MiniChip } from '@/components/MiniChips';
import ModalScreen from '@/components/ModalScreen';
import { EmptyState } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { displayResult, sortAtBats } from '@/lib/atbats';
import { playerLabel, playerShort } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { benchFor, benchOrder } from '@/lib/stats';
import { useGame, useGameAtBats, useStore, useTeamGames, useTeamPlayers } from '@/lib/store';
import type { Id } from '@/lib/types';
import { pushUndo } from '@/lib/undo';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;
/**
 * Web only: a button's description comes from aria-describedby (React Native
 * Web forwards it, drops accessibilityHint, and its types lack the prop).
 */
const describedBy = (id: string) => (Platform.OS === 'web' ? { 'aria-describedby': id } : null);

/**
 * The substitution sheet: the outgoing batter at the top (this game's chips
 * and his form) and the bench hottest first; tapping a bench player puts him
 * in the outgoing batter's slot. Nothing else in the order moves and the
 * pointers stay put, so the sub is up whenever the slot is. Re-entry is
 * allowed: a player who came out earlier is listed with when he left. When
 * the outgoing batter is the pitcher, the pitcher picker opens next. Opened
 * from the batter sheet's Substitute… and the Team tab's swap control.
 */
export default function SubstituteSheetScreen() {
  const { gameId, batterId } = useLocalSearchParams<{ gameId: string; batterId: string }>();
  const router = useRouter();
  const { data, substitute } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const games = useTeamGames(game?.teamId);
  const close = useDismiss(game ? `/game/${game.id}` : '/');
  /** Set once a sub is made: the batter has left the order, so the sheet keeps its last content while it closes. */
  const leaving = useRef(false);

  const lineup = game?.lineup;
  const bench = useMemo(() => (lineup ? benchOrder(benchFor(players, lineup), data.atBats, games) : []), [players, lineup, data.atBats, games]);
  const forms = useMemo(() => new Map(bench.map((p) => [p.id, formFor(data.atBats, games, p.id)])), [bench, data.atBats, games]);

  if (!game) {
    return (
      <ModalScreen title="Substitute" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }

  const outId = batterId ?? '';
  const out = players.find((p) => p.id === outId);
  const slot = game.lineup.findIndex((s) => s.playerId === outId);
  const isFinal = game.status === 'final';

  if (leaving.current) {
    return <ModalScreen title="Substitute" color={colors.orange} onClose={close}>{null}</ModalScreen>;
  }

  if (isFinal || slot < 0 || !out) {
    return (
      <ModalScreen title="Substitute" color={colors.orange} onClose={close}>
        <EmptyState title="Nothing to substitute" body={isFinal ? 'This game is final.' : 'He is not in this game’s order.'} />
      </ModalScreen>
    );
  }

  const outForm = formFor(data.atBats, games, out.id);
  const thisGame: MiniChip[] = sortAtBats(atBats.filter((ab) => ab.side === 'us' && ab.batterId === out.id)).map((ab) => ({
    id: ab.id,
    result: displayResult(ab),
  }));
  const pitching = game.pitcherId === out.id;

  const pick = (inId: Id) => {
    if (leaving.current) return;
    const record = substitute(game.id, out.id, inId);
    if (!record) return;
    leaving.current = true;
    pushUndo(game.id, { kind: 'sub', substitutionId: record.id, slot: record.slot, outId: record.outId, inId: record.inId });
    // The sheet replaced the batter sheet, so dismissing lands on the screen that opened it.
    if (pitching) router.replace(`/game/${game.id}/pitcher`);
    else close();
  };

  return (
    <ModalScreen title="Substitute" color={colors.orange} onClose={close}>
      <Text style={styles.sectionLabel}>Out</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {slot + 1}. {playerLabel(out)}
        </Text>
        <View style={styles.line}>
          <Text style={styles.key}>This game</Text>
          {thisGame.length ? <MiniChips chips={thisGame} /> : <Text style={styles.value}>No at-bats yet</Text>}
        </View>
        <FormLine results={outForm.results} rating={outForm.rating} season={outForm.season} lastGame={outForm.lastGame} />
      </View>

      <Text style={[styles.sectionLabel, styles.benchLabel]}>Bench · Tap to sub in · Hottest first</Text>
      {bench.length === 0 ? (
        <EmptyState title="No one on the bench" body="Players not in this game's order appear here. Add players on the team's Team tab." />
      ) : (
        bench.map((p) => {
          const form = forms.get(p.id)!;
          const note = benchNote(game, p.id);
          // The button's label is the action; its rating, note and form are its
          // description (the hint on native, the hidden text on web), since a
          // button's children are presentational to assistive tech.
          const description = describeForm(form, note);
          const descriptionId = `sub-${p.id}-form`;
          return (
            <Pressable
              key={p.id}
              onPress={() => pick(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`Sub in ${playerLabel(p)} for ${playerLabel(out)}`}
              accessibilityHint={description}
              {...describedBy(descriptionId)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed, webCursor]}
            >
              <HiddenText id={descriptionId}>{description}</HiddenText>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {playerLabel(p)}
                </Text>
                <RatingPill rating={form.rating} />
              </View>
              {note ? <Text style={styles.note}>{note}</Text> : null}
              <FormLine results={form.results} season={form.season} lastGame={form.lastGame} />
            </Pressable>
          );
        })
      )}

      <Text style={styles.caption}>
        The sub takes slot {slot + 1}. {out.firstName} goes to the bench and can come back in later. Nothing else in the order moves.
        {pitching ? ` ${playerShort(out)} is pitching, so the pitcher picker opens next.` : ''}
      </Text>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 8 },
  benchLabel: { marginTop: 24 },
  card: {
    backgroundColor: colors.page,
    borderRadius: radii.md,
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.text },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  key: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, width: 64 },
  value: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  row: {
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.pressed },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.text, flexShrink: 1 },
  note: { ...type.caption, lineHeight: 18 },
  caption: { ...type.caption, lineHeight: 19, marginTop: 16 },
});
