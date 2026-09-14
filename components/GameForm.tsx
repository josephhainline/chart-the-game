import { format } from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Segmented } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { parseGameDate, parseSchedule, quickDates, scheduleLine } from '@/lib/dates';
import type { NewGameInput } from '@/lib/store';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

type GameFormValues = {
  opponent: string;
  isAway: boolean;
  /** Free text: "2026-10-05", "Sept 19" or "9/19" (see lib/dates.ts). */
  date: string;
  /** Free text: "2:30 PM", "2:30pm" or "14:30" (see lib/dates.ts). */
  time: string;
  notes: string;
};

type GameFormErrors = Partial<Record<'opponent' | 'date' | 'time', string>>;

function validateGameForm(values: GameFormValues, now: Date = new Date()): { errors: GameFormErrors; startsAt: Date | null } {
  const errors: GameFormErrors = {};
  if (!values.opponent.trim()) errors.opponent = 'Enter the opponent.';
  const { startsAt, dateError, timeError } = parseSchedule(values.date, values.time, now);
  if (dateError) errors.date = dateError;
  if (timeError) errors.time = timeError;
  return { errors, startsAt };
}

function valuesFrom(initial?: Partial<NewGameInput>): GameFormValues {
  const d = initial?.startsAt ? new Date(initial.startsAt) : null;
  return {
    opponent: initial?.opponent ?? '',
    isAway: initial?.isAway ?? true,
    date: d ? format(d, 'yyyy-MM-dd') : '',
    time: d ? format(d, 'h:mm a') : '',
    notes: initial?.notes ?? '',
  };
}

export type GameFormState = {
  values: GameFormValues;
  errors: GameFormErrors;
  /** Errors are only shown after the first Save attempt (or for non-empty invalid text). */
  showErrors: boolean;
  startsAt: Date | null;
  set: <K extends keyof GameFormValues>(key: K, value: GameFormValues[K]) => void;
  /** Returns the input for the store when valid, otherwise reveals the errors and returns null. */
  submit: () => NewGameInput | null;
};

/** Owns the form state so the screen can wire Save into the modal header and a button alike. */
export function useGameForm(initial?: Partial<NewGameInput>): GameFormState {
  const [values, setValues] = useState<GameFormValues>(() => valuesFrom(initial));
  const [showErrors, setShowErrors] = useState(false);
  const { errors, startsAt } = useMemo(() => validateGameForm(values), [values]);

  const set = useCallback(<K extends keyof GameFormValues>(key: K, value: GameFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const submit = useCallback((): NewGameInput | null => {
    const { errors: e, startsAt: at } = validateGameForm(values);
    if (Object.keys(e).length > 0 || !at) {
      setShowErrors(true);
      return null;
    }
    return {
      opponent: values.opponent.trim(),
      isAway: values.isAway,
      startsAt: at.toISOString(),
      notes: values.notes.trim() || undefined,
    };
  }, [values]);

  return { values, errors, showErrors, startsAt, set, submit };
}

type Side = 'home' | 'away';

/** Opponent, home/away, date & time, notes. Pair with `useGameForm`. */
export default function GameForm({ form }: { form: GameFormState }) {
  const { values, errors, showErrors, startsAt, set } = form;
  const chips = useMemo(() => quickDates(), []);
  const selectedDay = parseGameDate(values.date);
  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : '';

  const errorFor = (key: keyof GameFormErrors, text: string) => {
    const message = errors[key];
    if (!message) return null;
    if (!showErrors && !text.trim()) return null;
    return <Text style={styles.error}>{message}</Text>;
  };

  return (
    <View>
      <Field
        label="Opponent"
        value={values.opponent}
        onChangeText={(t) => set('opponent', t)}
        placeholder="Tigers"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel="Opponent"
      />
      {errorFor('opponent', values.opponent)}

      <Text style={styles.label}>HOME / AWAY</Text>
      <View style={styles.segmentedWrap}>
        <Segmented<Side>
          options={[
            { value: 'home', label: 'vs Home' },
            { value: 'away', label: '@ Away' },
          ]}
          value={values.isAway ? 'away' : 'home'}
          onChange={(side) => set('isAway', side === 'away')}
        />
      </View>

      <Text style={styles.label}>DATE</Text>
      <View style={styles.chips}>
        {chips.map((chip) => {
          const key = format(chip.date, 'yyyy-MM-dd');
          const active = key === selectedKey;
          return (
            <Pressable
              key={chip.label}
              onPress={() => set('date', key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={chip.label}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed, webCursor]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field
        value={values.date}
        onChangeText={(t) => set('date', t)}
        placeholder="Sept 19 or 9/19"
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
        accessibilityLabel="Date"
      />
      {errorFor('date', values.date)}

      <Field
        label="Time"
        value={values.time}
        onChangeText={(t) => set('time', t)}
        placeholder="2:30 PM"
        autoCorrect={false}
        autoCapitalize="characters"
        accessibilityLabel="Time"
      />
      {errorFor('time', values.time)}
      {startsAt ? <Text style={styles.preview}>{scheduleLine(startsAt)}</Text> : null}

      <View style={styles.notes}>
        <Field
          label="Notes"
          value={values.notes}
          onChangeText={(t) => set('notes', t)}
          placeholder="Anything to remember about this game"
          multiline
          style={styles.notesInput}
          accessibilityLabel="Notes"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, marginBottom: 6, textTransform: 'uppercase' },
  // Segmented carries its own 16px side padding; pull it back to the form edge.
  segmentedWrap: { marginHorizontal: -16, marginTop: -12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primaryDark },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryDark },
  chipTextActive: { color: '#fff' },
  pressed: { opacity: 0.75 },
  preview: { ...type.caption, marginTop: -6, marginBottom: 14 },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.loss, marginTop: -8, marginBottom: 12 },
  notes: { marginTop: 4 },
  notesInput: { height: 96, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
});
