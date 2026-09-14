import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import PlayerForm, { isPlayerFormValid, playerFormValue, PlayerFormValue } from '@/components/PlayerForm';
import { Button, EmptyState, ScoreText } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { playerLabel } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { hittingFor, pitchingFor, score, WL } from '@/lib/stats';
import { useStore, useTeam } from '@/lib/store';

/** Modal: edit a player's name and number, see their season line, or remove them. */
export default function PlayerScreen() {
  const { teamId, playerId } = useLocalSearchParams<{ teamId: string; playerId: string }>();
  const team = useTeam(teamId);
  const { data, updatePlayer, removePlayer } = useStore();
  const player = data.players.find((p) => p.id === playerId);

  const [value, setValue] = useState<PlayerFormValue>(() => (player ? playerFormValue(player) : { firstName: '', lastName: '', number: '' }));
  // A stale link to a player who no longer exists, as opposed to the sheet
  // closing right after Remove.
  const [missingAtOpen] = useState(() => !team || !player);
  const valid = isPlayerFormValid(value);
  const close = useDismiss(`/team/${teamId}/roster`);

  // Season line: only at-bats from THIS team's games count.
  const season = useMemo(() => {
    const gameIds = new Set(data.games.filter((g) => g.teamId === teamId).map((g) => g.id));
    const atBats = data.atBats.filter((ab) => gameIds.has(ab.gameId));
    return {
      hitting: hittingFor(atBats, playerId ?? ''),
      pitching: pitchingFor(atBats, playerId ?? ''),
    };
  }, [data.games, data.atBats, teamId, playerId]);

  if (!team || !player) {
    return (
      <ModalScreen title="Player" onClose={close}>
        {missingAtOpen ? <EmptyState title="Player not found" body="They may have been removed from the roster." /> : null}
      </ModalScreen>
    );
  }

  const save = () => {
    if (!valid) return;
    updatePlayer(player.id, { firstName: value.firstName, lastName: value.lastName, number: value.number });
    close();
  };

  const remove = async () => {
    const ok = await confirmAction(
      'Remove player?',
      `${playerLabel(player)} will be removed from ${team.name} and taken out of the lineup. At-bats already charted are kept.`,
      'Remove',
    );
    if (!ok) return;
    removePlayer(player.id);
    close();
  };

  return (
    <ModalScreen title={playerLabel(player)} actionLabel="Save" onAction={save} actionDisabled={!valid} onClose={close}>
      <PlayerForm value={value} onChange={setValue} onSubmit={save} />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={type.h3}>This season</Text>
          <Text style={type.caption}>{team.season} Season</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.rowLabel]} />
          <Text style={[styles.cell, styles.headerCell, { color: colors.win }]}>W</Text>
          <Text style={[styles.cell, styles.headerCell, { color: colors.loss }]}>L</Text>
          <Text style={[styles.cell, styles.headerCell]}>Score</Text>
        </View>
        <StatLine label="Hitting" color={colors.primaryDark} wl={season.hitting} />
        <StatLine label="Pitching" color={colors.pitching} wl={season.pitching} />
      </View>

      <View style={styles.actions}>
        <Button title="Remove from team" variant="gray" icon="user-minus" onPress={remove} />
      </View>
    </ModalScreen>
  );
}

function StatLine({ label, color, wl }: { label: string; color: string; wl: WL }) {
  const has = wl.w + wl.l > 0;
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.rowLabel, { color }]}>{label}</Text>
      <Text style={[styles.cell, styles.num]}>{wl.w}</Text>
      <Text style={[styles.cell, styles.num]}>{wl.l}</Text>
      <ScoreText value={has ? score(wl) : null} style={[styles.cell, styles.scoreCell]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.chip,
    padding: 16,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.band,
    paddingBottom: 6,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  cell: { flex: 1, textAlign: 'center' },
  rowLabel: { flex: 1.6, textAlign: 'left', fontFamily: fonts.bold, fontSize: 17 },
  headerCell: { ...type.label, fontSize: 13, color: colors.text },
  num: { ...type.numeric, fontSize: 20, fontFamily: fonts.bold },
  // No color here: ScoreText picks green / red / gray itself.
  scoreCell: { fontSize: 20 },
  actions: { marginTop: 28, gap: 12 },
});
