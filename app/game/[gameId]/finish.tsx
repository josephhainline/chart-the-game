import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import { Button, Field } from '@/components/ui';
import { colors, fonts, type } from '@/constants/theme';
import { useGame, useStore } from '@/lib/store';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

/** End Game sheet: confirm the final score and notes, then mark the game final. */
export default function FinishGameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { finishGame } = useStore();
  const game = useGame(gameId);

  const [us, setUs] = useState(game?.score.us ?? 0);
  const [them, setThem] = useState(game?.score.them ?? 0);
  const [notes, setNotes] = useState(game?.notes ?? '');

  if (!game) return null;

  const save = () => {
    finishGame(game.id, { score: { us, them }, notes });
    router.replace(`/team/${game.teamId}`);
  };

  return (
    <ModalScreen title="End Game" color={colors.orange} actionLabel="Save & Finish" onAction={save}>
      <Text style={styles.sectionLabel}>Final score</Text>
      <View style={styles.scoreRow}>
        <BigStepper label="Us" value={us} onChange={setUs} />
        <BigStepper label={game.opponent} value={them} onChange={setThem} />
      </View>

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

function BigStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <StepButton icon="minus" label={`${label} minus`} onPress={() => onChange(Math.max(0, value - 1))} />
        <Text style={styles.stepperValue}>{value}</Text>
        <StepButton icon="plus" label={`${label} plus`} onPress={() => onChange(value + 1)} />
      </View>
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, webCursor]}
    >
      <FontAwesome6 name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 10 },
  scoreRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  stepper: { flex: 1, alignItems: 'center', gap: 8 },
  stepperLabel: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperValue: {
    fontFamily: fonts.bold,
    fontSize: 44,
    color: colors.text,
    minWidth: 60,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  notes: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  saveButton: { marginTop: 8 },
});
