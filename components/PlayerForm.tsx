import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/constants/theme';
import type { Player } from '@/lib/types';

import { Field } from './ui';

export type PlayerFormValue = {
  firstName: string;
  lastName: string;
  number: string;
};

export const EMPTY_PLAYER_FORM: PlayerFormValue = { firstName: '', lastName: '', number: '' };

/** Form value prefilled from an existing player. */
export function playerFormValue(p: Pick<Player, 'firstName' | 'lastName' | 'number'>): PlayerFormValue {
  return { firstName: p.firstName, lastName: p.lastName, number: p.number ?? '' };
}

/** A first name is the only thing required to add a kid to the roster. */
export function isPlayerFormValid(v: PlayerFormValue): boolean {
  return v.firstName.trim().length > 0;
}

type Props = {
  value: PlayerFormValue;
  onChange: (next: PlayerFormValue) => void;
  /** Focus the first-name field when the form appears (new player). */
  autoFocus?: boolean;
  /** Called when the coach hits return on the last field. */
  onSubmit?: () => void;
};

/**
 * First name (required), last name and jersey number. Shared by the
 * New Player and Player detail sheets.
 */
export default function PlayerForm({ value, onChange, autoFocus, onSubmit }: Props) {
  const set = (patch: Partial<PlayerFormValue>) => onChange({ ...value, ...patch });
  return (
    <View>
      <Field
        label="First name"
        value={value.firstName}
        onChangeText={(firstName) => set({ firstName })}
        placeholder="Required"
        autoFocus={autoFocus}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel="First name"
      />
      <Field
        label="Last name"
        value={value.lastName}
        onChangeText={(lastName) => set({ lastName })}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        accessibilityLabel="Last name"
      />
      <Field
        label="Number"
        value={value.number}
        onChangeText={(number) => set({ number: number.replace(/[^0-9]/g, '').slice(0, 3) })}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Number"
        style={styles.numberInput}
      />
      <Text style={styles.hint}>Number is optional. Leave it blank if they don&apos;t have one yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  numberInput: { width: 120 },
  hint: { ...type.caption, color: colors.textMuted, marginTop: -4 },
});
