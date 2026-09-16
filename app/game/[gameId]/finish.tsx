import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { Button, Field, WLText } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { gameHitting, gamePitching } from '@/lib/stats';
import { useGame, useGameAtBats, useStore } from '@/lib/store';

/**
 * End Game sheet: the game's hitting and pitching lines as a recap, a notes
 * field, then Save & Finish marks the game final. Runs are not tracked: the
 * app is about each player's battles, not the scoreboard.
 */
export default function FinishGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { finishGame } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);

  const [notes, setNotes] = useState(game?.notes ?? '');

  if (!game) return null;

  const save = () => {
    finishGame(game.id, { notes });
    // Back to the team's Games, where the game now shows as a final.
    router.replace(`/team/${game.teamId}`);
  };

  const hitting = gameHitting(atBats, game.id);
  const pitching = gamePitching(atBats, game.id);
  const charted = hitting.w + hitting.l + pitching.w + pitching.l;

  return (
    <ModalScreen title="End Game" color={colors.orange} actionLabel="Save & Finish" onAction={save} fallbackHref={`/game/${game.id}`}>
      <Text style={styles.sectionLabel}>This game</Text>
      {charted > 0 ? (
        <View style={styles.recap}>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>HITTING</Text>
            <WLText wl={hitting} style={styles.recapValue} />
          </View>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>PITCHING</Text>
            <WLText wl={pitching} style={styles.recapValue} />
          </View>
        </View>
      ) : (
        <Text style={styles.recapEmpty}>No at-bats charted yet.</Text>
      )}

      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="How did it go?"
        style={styles.notes}
      />

      <Button title="Save & Finish" variant="orange" size="lg" onPress={save} style={styles.saveButton} />
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 10 },
  recap: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  recapItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.chip },
  recapLabel: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
  recapValue: { fontSize: 22 },
  recapEmpty: { ...type.caption, marginBottom: 24 },
  notes: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { marginTop: 8 },
});
