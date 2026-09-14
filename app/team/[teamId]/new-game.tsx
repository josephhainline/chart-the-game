import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import GameForm, { useGameForm } from '@/components/GameForm';
import ModalScreen from '@/components/ModalScreen';
import { Button } from '@/components/ui';
import { useDismiss } from '@/lib/navigation';
import { useStore } from '@/lib/store';

/** Modal form that schedules a new game for the team. */
export default function NewGameScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { addGame } = useStore();
  const form = useGameForm();
  const close = useDismiss(`/team/${teamId}`);

  const save = () => {
    const input = form.submit();
    if (!input || !teamId) return;
    addGame(teamId, input);
    close();
  };

  return (
    <ModalScreen title="New Game" actionLabel="Save" onAction={save} onClose={close}>
      <GameForm form={form} />
      <View style={styles.actions}>
        <Button title="Save Game" onPress={save} />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 8, gap: 12 },
});
