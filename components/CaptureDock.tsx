import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import CTGGauge, { type NeedleSide } from '@/components/CTGGauge';
import MiniChips, { type MiniChip } from '@/components/MiniChips';
import OutcomeButtons, { type OutcomeButtonsSize, type Perspective } from '@/components/OutcomeButtons';
import { Button } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import type { OutcomeId, Result } from '@/lib/types';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;
/* touchAction stops the double-tap zoom delay on mobile browsers so a second tap is a second press. */
const webPress = Platform.OS === 'web' ? ({ cursor: 'pointer', touchAction: 'manipulation' } as const) : null;

/** The LAST readout: the game's newest at-bat. */
export type DockLast = {
  /** "Cooper W. (#50)" */
  name: string;
  /** Already in the perspective being shown (W = green). */
  result: Result;
  /** Outcome label; '' for a plain at-bat, which the readout shows as "add type ›". */
  label: string;
  /** "▲ 1st" when the at-bat belongs to a half other than the current one. */
  half?: string;
  /** Selects the at-bat (the screen also opens the types for a plain one). */
  onPress: () => void;
};

/** Re-judge mode: the dock names a selected at-bat instead of recording. */
export type DockRejudge = {
  /** "Cooper W. (#50) · ▲ 2nd · L · Strikeout Swinging" */
  readout: string;
  /** The recorded letter in `perspective`: shown solid; the other letter is outlined. */
  recorded: Result;
  /** The selected at-bat's side decides which letter is on the left. */
  perspective: Perspective;
  /** The at-bat's current type (ringed in the grid); omit for a plain at-bat. */
  selectedId?: OutcomeId;
  onNow: () => void;
  onMore: () => void;
};

type Props = {
  /** The live batting side's perspective (chart mode). */
  perspective: Perspective;
  rejudge?: DockRejudge;
  last?: DockLast;
  canStepBack: boolean;
  canStepForward: boolean;
  onStepBack: () => void;
  onStepForward: () => void;
  /** From lib/undo's undoLabel: "Undo W", "Undo skip", …, or "Undo" when there is nothing to undo. */
  undoLabel: string;
  canUndo: boolean;
  onUndo: () => void;
  /**
   * The AT-BAT header: label ("AT-BAT" / "AT-BAT · ▲ 1st"), its color,
   * "4. Cooper Woollen (#50)" and his game so far. With `onTitlePress` the
   * name is a button (the screen opens the batter sheet) labelled
   * `titleLabel` ("Cooper Woollen (#50), open batter sheet").
   */
  header: { label: string; color: string; title: string; chips: MiniChip[]; onTitlePress?: () => void; titleLabel?: string };
  onChipPress?: (atBatId: string) => void;
  /** Pitching with no pitcher: the record controls are dimmed and disabled behind "Set pitcher". */
  needsPitcher?: boolean;
  onSetPitcher?: () => void;
  needle: NeedleSide;
  pulse: number;
  /**
   * Accessibility labels for the big buttons, by the letter shown. Hitting:
   * "Win for <batter>" / "Loss for <batter>"; pitching, in the pitcher's
   * perspective like everything else on that side: "<pitcher> won against
   * <batter>" / "<pitcher> lost to <batter>"; re-judge: "Change to W/L".
   */
  bigLabels: Record<Result, string>;
  /** A big button, by the letter shown (already in the dock's perspective). */
  onBig: (letter: Result) => void;
  onOutcome: (outcomeId: OutcomeId) => void;
  typesOpen: boolean;
  onToggleTypes: () => void;
  typesSize: OutcomeButtonsSize;
  /** The dock's rendered height, so the screen can collapse the types when it would take too much of the window. */
  onHeight?: (height: number) => void;
};

/**
 * The Capture Dock: the fixed block above the tab bar on the CTG screen.
 * Top to bottom: the context row (‹ › steppers, the LAST or RE-JUDGE
 * readout, Undo), the AT-BAT header, the big L · gauge · W row, the
 * "OUTCOME TYPES" toggle and the grid. Presentational: the screen owns every
 * piece of state and decides what each press means.
 */
export default function CaptureDock({
  perspective: livePerspective,
  rejudge,
  last,
  canStepBack,
  canStepForward,
  onStepBack,
  onStepForward,
  undoLabel,
  canUndo,
  onUndo,
  header,
  onChipPress,
  needsPitcher,
  onSetPitcher,
  needle,
  pulse,
  bigLabels,
  onBig,
  onOutcome,
  typesOpen,
  onToggleTypes,
  typesSize,
  onHeight,
}: Props) {
  const perspective = rejudge ? rejudge.perspective : livePerspective;
  const leftLetter: Result = perspective === 'batter' ? 'L' : 'W';
  const rightLetter: Result = perspective === 'batter' ? 'W' : 'L';
  const disabled = !rejudge && Boolean(needsPitcher);

  return (
    <View onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}>
      <View style={styles.divider} />
      <View style={[styles.dock, { borderTopColor: rejudge ? colors.orange : colors.primaryDark }]}>
        <View style={styles.context}>
          <Stepper icon="chevron-left" label="Previous at-bat" disabled={!canStepBack} onPress={onStepBack} />
          <Stepper icon="chevron-right" label="Next at-bat" disabled={!canStepForward} onPress={onStepForward} />
          {rejudge ? (
            <>
              <View style={styles.readout} accessibilityRole="text">
                <Text style={[styles.readoutLabel, { color: colors.orange }]}>RE-JUDGE</Text>
                <Text style={styles.readoutText} numberOfLines={2}>
                  {rejudge.readout}
                </Text>
              </View>
              <Chip title="▶ Now" label="Back to now" onPress={rejudge.onNow} />
              <Chip title="More…" label="More options for this at-bat" onPress={rejudge.onMore} />
            </>
          ) : (
            <>
              <Pressable
                onPress={last?.onPress}
                disabled={!last}
                accessibilityRole="button"
                accessibilityLabel={
                  last
                    ? `Last at-bat: ${last.name}, ${last.result}${last.label ? `, ${last.label}` : ', no play type'}${last.half ? `, ${last.half}` : ''}`
                    : 'No at-bats yet this game'
                }
                style={({ pressed }) => [styles.readout, pressed && last && styles.pressed, last && webCursor]}
              >
                <Text style={styles.readoutLabel}>LAST</Text>
                {last ? (
                  <Text style={styles.readoutText} numberOfLines={2}>
                    {last.name} · {last.result} ·{' '}
                    {last.label ? (
                      last.label
                    ) : (
                      <>
                        {/* No-break spaces keep "add type ›" together as one unit when the readout wraps (at 375pt from the first record, or behind a wide Undo label). */}
                        <Text style={styles.link}>add{'\u00A0'}type</Text>
                        {'\u00A0›'}
                      </>
                    )}
                    {last.half ? ` · ${last.half}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.readoutEmpty}>No at-bats yet this game</Text>
                )}
              </Pressable>
              <Button
                variant="ghost"
                size="sm"
                icon="rotate-left"
                title={undoLabel}
                disabled={!canUndo}
                onPress={onUndo}
                style={styles.undo}
                textStyle={styles.undoText}
              />
            </>
          )}
        </View>

        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: header.color }]}>{header.label}</Text>
          {header.onTitlePress ? (
            <Pressable
              onPress={header.onTitlePress}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={header.titleLabel ?? `${header.title}, open batter sheet`}
              style={({ pressed }) => [styles.headerTitleHit, pressed && styles.pressed, webCursor]}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {header.title}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>
              {header.title}
            </Text>
          )}
          <MiniChips chips={header.chips} onPress={onChipPress} style={styles.headerChips} />
          {needsPitcher ? (
            <Button variant="orange" size="sm" icon="baseball" title="Set pitcher" onPress={onSetPitcher} style={styles.setPitcher} textStyle={styles.setPitcherText} />
          ) : null}
        </View>

        <View style={styles.bigRow}>
          <BigButton
            letter={leftLetter}
            solid={!rejudge || rejudge.recorded === leftLetter}
            selected={rejudge?.recorded === leftLetter}
            disabled={disabled}
            short={typesSize === 'tiny'}
            label={bigLabels[leftLetter]}
            onPress={() => onBig(leftLetter)}
          />
          <CTGGauge needle={needle} pulse={pulse} perspective={perspective} rest={rejudge ? rejudge.recorded : 'center'} width={80} />
          <BigButton
            letter={rightLetter}
            solid={!rejudge || rejudge.recorded === rightLetter}
            selected={rejudge?.recorded === rightLetter}
            disabled={disabled}
            short={typesSize === 'tiny'}
            label={bigLabels[rightLetter]}
            onPress={() => onBig(rightLetter)}
          />
        </View>

        <Pressable
          onPress={onToggleTypes}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={typesOpen ? 'Hide outcome types' : 'Show outcome types'}
          accessibilityState={{ expanded: typesOpen }}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed, webCursor]}
        >
          <Text style={styles.toggleText}>OUTCOME TYPES</Text>
          <FontAwesome6 name={typesOpen ? 'chevron-up' : 'chevron-down'} size={10} color={colors.textMuted} />
        </Pressable>

        {typesOpen ? <OutcomeButtons perspective={perspective} onPress={onOutcome} disabled={disabled} size={typesSize} selectedId={rejudge?.selectedId} /> : null}
      </View>
    </View>
  );
}

function Stepper({ icon, label, disabled, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepper, pressed && styles.pressed, disabled && styles.stepperDisabled, !disabled && webCursor]}
    >
      <FontAwesome6 name={icon} size={16} color={colors.primaryDark} />
    </Pressable>
  );
}

function Chip({ title, label, onPress }: { title: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed, webCursor]}
    >
      <Text style={styles.chipText}>{title}</Text>
    </Pressable>
  );
}

/**
 * A big L or W: solid in its color while charting (or when it is the recorded
 * letter), outlined otherwise. `selected` is only the recorded letter in
 * re-judge mode (the fill alone would tell screen readers both letters are
 * selected while charting). `short` is the SE-class 56pt height.
 */
function BigButton({
  letter,
  solid,
  selected,
  disabled,
  short,
  label,
  onPress,
}: {
  letter: Result;
  solid: boolean;
  selected: boolean;
  disabled: boolean;
  short: boolean;
  label: string;
  onPress: () => void;
}) {
  const win = letter === 'W';
  const color = win ? colors.win : colors.loss;
  const ink = solid ? (win ? colors.text : colors.white) : color;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [
        styles.big,
        short && styles.bigShort,
        solid ? { backgroundColor: color } : { backgroundColor: colors.white, borderWidth: 2, borderColor: color },
        pressed && styles.bigPressed,
        disabled && styles.disabled,
        webPress,
      ]}
    >
      <Text style={[styles.bigLetter, { color: ink }]}>{letter}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.divider },
  dock: { backgroundColor: colors.surface, borderTopWidth: 3, paddingBottom: 12 },
  context: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 2, paddingRight: 8, gap: 2 },
  stepper: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepperDisabled: { opacity: 0.3 },
  readout: { flex: 1, minWidth: 0, paddingHorizontal: 4, paddingVertical: 2, justifyContent: 'center' },
  readoutLabel: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13, color: colors.textMuted, letterSpacing: 0.6 },
  readoutText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 17, color: colors.text },
  readoutEmpty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17, color: colors.textMuted },
  link: { color: colors.primaryDark },
  chip: { height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  undo: { paddingHorizontal: 8, marginLeft: 2 },
  undoText: { fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingHorizontal: 16, gap: 8 },
  // flexShrink 0: the name gives way to the chips, never the label (web Text shrinks by default).
  headerLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, flexShrink: 0 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.text, flexShrink: 1 },
  // The name's button shrinks with the name so the chips stay beside it; its hit area is the header's full 36pt.
  headerTitleHit: { flexShrink: 1, minWidth: 0, minHeight: 36, justifyContent: 'center' },
  headerChips: { flexShrink: 0 },
  setPitcher: { marginLeft: 'auto', height: 32, paddingHorizontal: 12 },
  setPitcherText: { fontSize: 13 },
  bigRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 12, paddingTop: 2 },
  big: { flex: 1, maxWidth: 118, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bigShort: { height: 56 },
  bigPressed: { opacity: 0.75 },
  bigLetter: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 46 },
  disabled: { opacity: 0.4 },
  toggle: { alignSelf: 'center', height: 26, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6 },
  pressed: { opacity: 0.6 },
});
