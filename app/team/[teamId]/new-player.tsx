import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import PlayerForm, { EMPTY_PLAYER_FORM, isPlayerFormValid, PlayerFormValue } from '@/components/PlayerForm';
import { Button } from '@/components/ui';
import { useStore, useTeam } from '@/lib/store';

/** Modal: add a player to the team roster. */
export default function NewPlayerScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const team = useTeam(teamId);
  const { addPlayer } = useStore();
  const [value, setValue] = useState<PlayerFormValue>(EMPTY_PLAYER_FORM);
  const valid = isPlayerFormValid(value);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/team/${teamId}/roster`);
  };

  const save = () => {
    if (!valid || !team) return;
    addPlayer(team.id, { firstName: value.firstName, lastName: value.lastName, number: value.number });
    close();
  };

  return (
    <ModalScreen title="New Player" actionLabel="Save" onAction={save} actionDisabled={!valid} onClose={close}>
      <PlayerForm value={value} onChange={setValue} autoFocus onSubmit={save} />
      <View style={styles.actions}>
        <Button title="Add to roster" icon="plus" onPress={save} disabled={!valid} />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 24, gap: 12 },
});
