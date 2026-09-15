import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { Button, Field } from '@/components/ui';
import { colors, type } from '@/constants/theme';
import { useStore } from '@/lib/store';

export default function NewTeamScreen() {
  const router = useRouter();
  const { addTeam } = useStore();
  const [name, setName] = useState('');
  const [season, setSeason] = useState(String(new Date().getFullYear()));

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const team = addTeam(name, season.trim() || String(new Date().getFullYear()));
    // Send the coach straight to the roster so the next step is adding players.
    router.replace(`/team/${team.id}/roster`);
  };

  return (
    <ModalScreen title="New Team" actionLabel="Save" onAction={save} actionDisabled={!canSave}>
      <Field
        label="Team name"
        value={name}
        onChangeText={setName}
        placeholder="Bears Floyd 14U"
        autoFocus
        autoCapitalize="words"
        returnKeyType="next"
        accessibilityLabel="Team name"
      />
      <Field
        label="Season"
        value={season}
        onChangeText={setSeason}
        placeholder={String(new Date().getFullYear())}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Season"
      />
      <Text style={styles.hint}>You'll add players to the roster next.</Text>
      <View style={styles.actions}>
        <Button title="Save Team" onPress={save} disabled={!canSave} size="lg" />
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  hint: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  actions: { marginTop: 28 },
});
