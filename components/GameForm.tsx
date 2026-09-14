import { addDays, format, isSaturday, isSunday, isValid, nextSaturday, nextSunday, parse, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, Segmented } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { gameDateLine } from '@/lib/format';
import type { NewGameInput } from '@/lib/store';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

export type GameFormValues = {
  opponent: string;
  isAway: boolean;
  /** Free text, normally "2026-10-05". */
  date: string;
  /** Free text, normally "2:30 PM"; "14:30" is accepted too. */
  time: string;
  notes: string;
};

export type GameFormErrors = Partial<Record<'opponent' | 'date' | 'time', string>>;

const DATE_FORMATS = ['yyyy-MM-dd', 'M/d/yy', 'M/d/yyyy', 'M/d', 'MMM d, yyyy', 'MMM d', 'MMMM d, yyyy', 'MMMM d'];
const TIME_FORMATS = ['h:mm a', 'h:mma', 'h a', 'ha', 'H:mm'];

function parseWith(text: string, formats: string[], ref: Date): { date: Date; format: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const f of formats) {
    const d = parse(trimmed, f, ref);
    if (isValid(d)) return { date: d, format: f };
  }
  return null;
}

/** Calendar day from the Date field, or null when it can't be read. */
export function parseGameDate(text: string, now: Date = new Date()): Date | null {
  const hit = parseWith(text, DATE_FORMATS, now);
  return hit ? startOfDay(hit.date) : null;
}

/** Hours and minutes from the Time field, or null when it can't be read. */
export function parseGameTime(text: string): { hours: number; minutes: number } | null {
  const hit = parseWith(text, TIME_FORMATS, new Date(2000, 0, 1));
  if (!hit) return null;
  let hours = hit.date.getHours();
  const minutes = hit.date.getMinutes();
  // A bare "2:30" (no AM/PM) means the afternoon: nobody plays at 2:30 in the morning.
  if (hit.format === 'H:mm' && hours >= 1 && hours <= 7) hours += 12;
  return { hours, minutes };
}

function combine(day: Date, time: { hours: number; minutes: number }): Date {
  return setSeconds(setMinutes(setHours(day, time.hours), time.minutes), 0);
}

export function validateGameForm(values: GameFormValues, now: Date = new Date()): { errors: GameFormErrors; startsAt: Date | null } {
  const errors: GameFormErrors = {};
  if (!values.opponent.trim()) errors.opponent = 'Enter the opponent.';
  const day = parseGameDate(values.date, now);
  if (!day) errors.date = values.date.trim() ? 'Enter a date like 2026-10-05.' : 'Enter the date.';
  const time = parseGameTime(values.time);
  if (!time) errors.time = values.time.trim() ? 'Enter a time like 2:30 PM.' : 'Enter the start time.';
  return { errors, startsAt: day && time ? combine(day, time) : null };
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

type QuickDate = { label: string; date: Date };

/** "Today", "Tomorrow", "This Saturday", "This Sunday", "Next Saturday". */
export function quickDates(now: Date = new Date()): QuickDate[] {
  const today = startOfDay(now);
  const thisSaturday = isSaturday(today) ? today : nextSaturday(today);
  const thisSunday = isSunday(today) ? today : nextSunday(today);
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This Saturday', date: thisSaturday },
    { label: 'This Sunday', date: thisSunday },
    { label: 'Next Saturday', date: addDays(thisSaturday, 7) },
  ];
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
        placeholder="2026-10-05"
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
      {startsAt ? <Text style={styles.preview}>{gameDateLine(startsAt.toISOString())}</Text> : null}

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
