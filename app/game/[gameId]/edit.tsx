import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import GameForm, { useGameForm } from '@/components/GameForm';
import ModalScreen from '@/components/ModalScreen';
import { Button, EmptyState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { confirmAction } from '@/lib/confirm';
import { useGame, useStore } from '@/lib/store';

/** Modal form that edits a game's opponent, home/away, date & time and notes, or deletes it. */
export default function EditGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { updateGame, deleteGame } = useStore();
  const game = useGame(gameId);
  const form = useGameForm(game);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(game ? `/game/${game.id}` : '/');
  };

  const save = () => {
    const input = form.submit();
    if (!input || !game) return;
    updateGame(game.id, { opponent: input.opponent, isAway: input.isAway, startsAt: input.startsAt, notes: input.notes });
    close();
  };

  const remove = async () => {
    if (!game) return;
    const teamId = game.teamId;
    const ok = await confirmAction('Delete game?', 'This removes the game and every at-bat charted in it.', 'Delete');
    if (!ok) return;
    deleteGame(game.id);
    router.replace(`/team/${teamId}`);
  };

  if (!game) {
    return (
      <ModalScreen title="Edit Game" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }

  return (
    <ModalScreen title="Edit Game" actionLabel="Save" onAction={save} onClose={close} color={colors.orange}>
      <GameForm form={form} />
      <View style={styles.actions}>
        <Button title="Save Changes" variant="orange" onPress={save} />
        <Button title="Delete game" variant="gray" onPress={remove} />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 8, gap: 12 },
});
