import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { Button, EmptyState, Field } from '@/components/ui';
import { colors, type } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { useDismiss } from '@/lib/navigation';
import { useStore, useTeam } from '@/lib/store';

/** Modal: rename the team / change its season, or delete it. */
export default function EditTeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const { updateTeam, deleteTeam } = useStore();
  const [name, setName] = useState(team?.name ?? '');
  const [season, setSeason] = useState(team?.season ?? '');
  // A stale link to a team that no longer exists, as opposed to the sheet
  // closing right after Delete.
  const [missingAtOpen] = useState(() => !team);
  const valid = name.trim().length > 0;
  const close = useDismiss(`/team/${teamId}`);

  if (!team) {
    return (
      <ModalScreen title="Edit Team" onClose={() => router.replace('/')}>
        {missingAtOpen ? <EmptyState title="Team not found" body="It may have been deleted." /> : null}
      </ModalScreen>
    );
  }

  const save = () => {
    if (!valid) return;
    updateTeam(team.id, { name: name.trim(), season: season.trim() || team.season });
    close();
  };

  const remove = async () => {
    const ok = await confirmAction(
      'Delete team?',
      `${team.name} will be deleted along with its roster, games and every charted at-bat. This can't be undone.`,
    );
    if (!ok) return;
    deleteTeam(team.id);
    router.replace('/');
  };

  return (
    <ModalScreen title="Edit Team" actionLabel="Save" onAction={save} actionDisabled={!valid} onClose={close}>
      <Field
        label="Team name"
        value={name}
        onChangeText={setName}
        placeholder="STL Bears 12U"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel="Team name"
      />
      <Field
        label="Season"
        value={season}
        onChangeText={setSeason}
        placeholder={String(new Date().getFullYear())}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={12}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Season"
        style={styles.seasonInput}
      />
      <Text style={styles.hint}>The season shows on the Stats tab, e.g. &quot;Statistics: {season.trim() || team.season} Season&quot;.</Text>

      <View style={styles.actions}>
        <Button title="Delete team" variant="gray" icon="trash-can" onPress={remove} />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  seasonInput: { width: 140 },
  hint: { ...type.caption, color: colors.textMuted, marginTop: -4 },
  actions: { marginTop: 32, gap: 12 },
});
