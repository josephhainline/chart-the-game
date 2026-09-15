import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useLocalSearchParams, useRootNavigationState } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import ModalScreen from '@/components/ModalScreen';
import OutcomeButtons from '@/components/OutcomeButtons';
import ResultTile from '@/components/ResultTile';
import { Chip, EmptyState } from '@/components/ui';
import { colors, fonts, radii, type } from '@/constants/theme';
import { displayResult, invertResult } from '@/lib/atbats';
import { confirmAction } from '@/lib/confirm';
import { halfLabel, inningOrdinal, lineupFirstRoster, opponentBatterLabel, playerLabel, playerName, playerShort } from '@/lib/format';
import { useDismiss } from '@/lib/navigation';
import { isPlain, outcomeLabel, outcomeShort, plainFor } from '@/lib/outcomes';
import { useGame, useGameAtBats, useStore, useTeamPlayers, type AtBatPatch } from '@/lib/store';
import type { AtBat, Half, Id, OutcomeId, Result } from '@/lib/types';
import { pushUndo, type UndoEntry } from '@/lib/undo';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null;

type Previous = Extract<UndoEntry, { kind: 'rejudge' }>['previous'];

/** The fields an undo entry restores, captured before a change. */
function previousOf(ab: AtBat): Previous {
  return { outcomeId: ab.outcomeId, result: ab.result, batterId: ab.batterId, pitcherId: ab.pitcherId, inning: ab.inning, half: ab.half };
}

/**
 * The full at-bat editor: result, play type, batter, pitcher and half-inning
 * of one charted at-bat, plus Remove. Every change applies immediately through
 * `updateAtBat` and lands on the game's undo stack; Done just closes. Reached
 * from "More…" in the dock, a Stats scorebook cell and the batter sheet.
 *
 * The big letters and the grid read in the perspective being shown (our
 * pitcher's for their at-bats); storage is always the batter's result.
 */
export default function AtBatEditorScreen() {
  const { gameId, atBatId } = useLocalSearchParams<{ gameId: string; atBatId: string }>();
  const { updateAtBat, deleteAtBat } = useStore();
  const game = useGame(gameId);
  const atBats = useGameAtBats(gameId);
  const players = useTeamPlayers(game?.teamId);
  const atBat = atBats.find((ab) => ab.id === atBatId);
  const close = useDismiss(game ? `/game/${game.id}` : '/');

  const [pickingBatter, setPickingBatter] = useState(false);
  const [pickingPitcher, setPickingPitcher] = useState(false);
  /** Set once this screen has started dismissing itself, so a store change cannot dismiss it twice. */
  const closing = useRef(false);

  // Deleted elsewhere (Undo on the CTG tab, another sheet) or a stale URL on a
  // cold load (bookmark, reload, deep link): nothing left to edit, so dismiss.
  // A cold load mounts this sheet in the same commit as the navigators and its
  // effect runs before theirs, when the router cannot navigate yet; the root
  // navigation state only gets a key once the root navigator is mounted.
  const rootState = useRootNavigationState();
  const navigatorReady = Boolean(rootState?.key);
  const hasGame = Boolean(game);
  useEffect(() => {
    if (!navigatorReady || !hasGame || closing.current || atBat) return;
    closing.current = true;
    close();
  }, [navigatorReady, hasGame, atBat, close]);

  const lineup = game?.lineup;
  const roster = useMemo(() => lineupFirstRoster(players, lineup), [players, lineup]);

  if (!game) {
    return (
      <ModalScreen title="At-bat" color={colors.orange} onClose={close}>
        <EmptyState title="Game not found" body="It may have been deleted." />
      </ModalScreen>
    );
  }
  // Dismissing (the effect above): nothing to draw while the router gets ready.
  if (!atBat) return null;

  const side = atBat.side;
  const perspective = side === 'us' ? 'batter' : 'pitcher';
  const playersById = new Map(players.map((p) => [p.id, p]));
  const player = side === 'us' ? playersById.get(atBat.batterId) : undefined;
  const opponentBatter = side === 'them' ? game.opponentLineup.find((b) => b.id === atBat.batterId) : undefined;
  const batterLabel =
    side === 'us' ? (player ? playerLabel(player) : 'Removed player') : opponentBatter ? opponentBatterLabel(opponentBatter) : 'Batter (left)';
  const batterName = side === 'us' ? (player ? playerName(player) : 'Removed player') : opponentBatter?.name ?? 'Batter (left)';
  const pitcher = atBat.pitcherId ? playersById.get(atBat.pitcherId) : undefined;

  const shown = displayResult(atBat);
  const label = outcomeLabel(atBat.outcomeId);
  const plain = isPlain(atBat.outcomeId);
  const when = halfLabel(atBat.inning, atBat.half);
  const title = `${batterLabel} · ${when}${side === 'them' && pitcher ? ` · ${playerShort(pitcher)} pitching` : ''}`;

  /** Applies a change and records how to undo it. */
  const apply = (patch: AtBatPatch) => {
    const previous = previousOf(atBat);
    if (!updateAtBat(atBat.id, patch)) return;
    pushUndo(game.id, { kind: 'rejudge', atBatId: atBat.id, previous });
  };

  /** A result that disagrees with the current type drops the type: the at-bat becomes plain. */
  const chooseResult = (shownResult: Result) => {
    if (shownResult === shown) return;
    apply({ outcomeId: plainFor(perspective === 'pitcher' ? invertResult(shownResult) : shownResult) });
  };

  const chooseType = (outcomeId: OutcomeId) => {
    if (outcomeId !== atBat.outcomeId) apply({ outcomeId });
  };

  const clearType = () => {
    if (!plain) apply({ outcomeId: plainFor(atBat.result) });
  };

  const chooseBatter = (batterId: Id) => {
    setPickingBatter(false);
    if (batterId !== atBat.batterId) apply({ batterId });
  };

  const choosePitcher = (pitcherId: Id) => {
    setPickingPitcher(false);
    if (pitcherId !== atBat.pitcherId) apply({ pitcherId });
  };

  const chooseHalf = (half: Half) => {
    if (half !== atBat.half) apply({ half });
  };

  const stepInning = (delta: 1 | -1) => {
    const inning = atBat.inning + delta;
    if (inning >= 1) apply({ inning });
  };

  const remove = async () => {
    const ok = await confirmAction(
      'Remove this at-bat?',
      `Remove ${batterName}'s ${label || 'at-bat'} from the ${atBat.half} of the ${inningOrdinal(atBat.inning)}? Later at-bats are not affected.`,
      'Remove',
    );
    if (!ok) return;
    // Whoever is due before the remove (which may roll the pointer back): Undo puts them up again.
    const sideOrder = side === 'us' ? game.lineup.map((slot) => slot.playerId) : game.opponentLineup.map((b) => b.id);
    const pointer = side === 'us' ? game.ourNextBatter : game.theirNextBatter;
    const dueBatterId = sideOrder.length > 0 ? sideOrder[pointer % sideOrder.length] : undefined;
    const removed = deleteAtBat(atBat.id);
    if (removed) pushUndo(game.id, { kind: 'remove', atBat: removed, dueBatterId });
    closing.current = true;
    close();
  };

  // Pitching: W (our pitcher won the battle) on the left, like the dock and the grid.
  const leftResult: Result = perspective === 'pitcher' ? 'W' : 'L';
  const rightResult = invertResult(leftResult);
  const order =
    side === 'us'
      ? game.lineup.map((slot) => {
          const p = playersById.get(slot.playerId);
          return { id: slot.playerId, label: p ? playerLabel(p) : 'Removed player' };
        })
      : game.opponentLineup.map((b) => ({ id: b.id, label: opponentBatterLabel(b) }));

  return (
    <ModalScreen title={title} color={colors.orange} actionLabel="Done" onAction={close} onClose={close}>
      <View style={styles.state}>
        <ResultTile
          result={shown}
          code={outcomeShort(atBat.outcomeId)}
          size="large"
          accessibilityLabel={`${shown}, ${label || 'no play type'}`}
        />
        <Text style={styles.stateText}>
          {shown} · {label || 'no play type'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>{perspective === 'pitcher' ? 'Result for our pitcher' : 'Result'}</Text>
      <View style={styles.resultRow}>
        <ResultButton result={leftResult} current={shown === leftResult} onPress={() => chooseResult(leftResult)} />
        <ResultButton result={rightResult} current={shown === rightResult} onPress={() => chooseResult(rightResult)} />
      </View>

      <Text style={styles.sectionLabel}>Play type</Text>
      <View style={styles.grid}>
        <OutcomeButtons perspective={perspective} onPress={chooseType} selectedId={atBat.outcomeId} />
      </View>
      <Pressable
        onPress={clearType}
        accessibilityRole="button"
        accessibilityLabel="No play type"
        accessibilityState={{ selected: plain }}
        style={({ pressed }) => [styles.ghostChip, plain && styles.ghostChipSelected, pressed && styles.pressed, webCursor]}
      >
        {plain ? <FontAwesome6 name="check" size={12} color={colors.primaryDark} /> : null}
        <Text style={styles.ghostChipText}>No play type</Text>
      </Pressable>

      <FieldRow label="Batter" value={batterLabel} open={pickingBatter} onPress={() => setPickingBatter((v) => !v)} />
      {pickingBatter ? (
        <View style={styles.pickerList}>
          {order.map((b, i) => (
            <PickRow key={b.id} label={`${i + 1}. ${b.label}`} selected={b.id === atBat.batterId} onPress={() => chooseBatter(b.id)} />
          ))}
          {order.length === 0 ? <Text style={type.caption}>No batting order for this side yet.</Text> : null}
        </View>
      ) : null}

      {side === 'them' ? (
        <>
          <FieldRow
            label="Pitcher"
            value={pitcher ? playerShort(pitcher) : 'Not set'}
            open={pickingPitcher}
            onPress={() => setPickingPitcher((v) => !v)}
          />
          {pickingPitcher ? (
            <View style={styles.chips}>
              {roster.map((p) => (
                <Chip
                  key={p.id}
                  label={playerShort(p)}
                  accessibilityLabel={`Pitcher ${playerShort(p)}`}
                  selected={p.id === atBat.pitcherId}
                  onPress={() => choosePitcher(p.id)}
                />
              ))}
              {roster.length === 0 ? <Text style={type.caption}>No players on the roster yet.</Text> : null}
            </View>
          ) : null}
        </>
      ) : null}

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Half-inning</Text>
        <Text style={styles.fieldValue}>{when}</Text>
      </View>
      <View style={styles.halfControls}>
        <View style={styles.segment}>
          <SegmentButton label="▲" accessibilityLabel="Top of the inning" selected={atBat.half === 'top'} onPress={() => chooseHalf('top')} />
          <SegmentButton label="▼" accessibilityLabel="Bottom of the inning" selected={atBat.half === 'bottom'} onPress={() => chooseHalf('bottom')} />
        </View>
        <View style={styles.stepper}>
          <StepButton icon="minus" label="Earlier inning" disabled={atBat.inning <= 1} onPress={() => stepInning(-1)} />
          <Text style={styles.stepperValue}>{inningOrdinal(atBat.inning)}</Text>
          <StepButton icon="plus" label="Later inning" onPress={() => stepInning(1)} />
        </View>
      </View>

      <Pressable
        onPress={() => void remove()}
        accessibilityRole="button"
        accessibilityLabel="Remove at-bat"
        style={({ pressed }) => [styles.remove, pressed && styles.pressed, webCursor]}
      >
        <FontAwesome6 name="trash-can" size={16} color={colors.loss} />
        <Text style={styles.removeText}>Remove at-bat</Text>
      </Pressable>
    </ModalScreen>
  );
}

/** One of the two 56pt result buttons: solid when it is the at-bat's result, outlined in its color otherwise. */
function ResultButton({ result, current, onPress }: { result: Result; current: boolean; onPress: () => void }) {
  const win = result === 'W';
  const color = win ? colors.win : colors.loss;
  const solidInk = win ? colors.text : colors.white;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={current ? `${result}, current result` : `Change to ${result}`}
      accessibilityState={{ selected: current }}
      style={({ pressed }) => [
        styles.resultButton,
        { borderColor: color, backgroundColor: current ? color : colors.surface },
        pressed && styles.pressed,
        webCursor,
      ]}
    >
      <Text style={[styles.resultLetter, { color: current ? solidInk : color }]}>{result}</Text>
    </Pressable>
  );
}

/** "Batter: Cooper Woollen (#50) ›" — tapping toggles the inline picker under it. */
function FieldRow({ label, value, open, onPress }: { label: string; value: string; open: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.fieldRow, pressed && styles.rowPressed, webCursor]}
    >
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
      <FontAwesome6 name={open ? 'chevron-down' : 'chevron-right'} size={16} color={colors.tabLabel} />
    </Pressable>
  );
}

function PickRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.pickRow, selected && styles.pickRowSelected, pressed && styles.rowPressed, webCursor]}
    >
      <Text style={[styles.pickRowText, selected && styles.pickRowTextSelected]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? <FontAwesome6 name="check" size={14} color={colors.primaryDark} /> : null}
    </Pressable>
  );
}

function SegmentButton({ label, accessibilityLabel, selected, onPress }: { label: string; accessibilityLabel: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.segmentButton, selected && styles.segmentButtonSelected, pressed && styles.pressed, webCursor]}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: 'minus' | 'plus'; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, disabled && styles.disabled, !disabled && webCursor]}
    >
      <FontAwesome6 name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  state: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  stateText: { flex: 1, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.text },
  sectionLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 8 },
  resultRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  resultButton: {
    flex: 1,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLetter: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32 },
  /** Reclaims the sheet's side padding so the grid is as wide as it is on the CTG tab. */
  grid: { marginHorizontal: -20 },
  ghostChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    marginTop: 10,
    marginBottom: 20,
  },
  ghostChipSelected: { borderColor: colors.primaryDark, backgroundColor: colors.chip },
  ghostChipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryDark },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowPressed: { backgroundColor: colors.pressed },
  fieldLabel: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, width: 96 },
  fieldValue: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  pickerList: { paddingBottom: 8 },
  pickRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, borderRadius: radii.md, gap: 8 },
  pickRowSelected: { backgroundColor: colors.chip },
  pickRowText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  pickRowTextSelected: { fontFamily: fonts.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  halfControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 16 },
  segment: { flexDirection: 'row', gap: 6 },
  segmentButton: { width: 48, height: 40, borderRadius: radii.sm, backgroundColor: colors.band, alignItems: 'center', justifyContent: 'center' },
  segmentButtonSelected: { backgroundColor: colors.primaryDark },
  segmentText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  segmentTextSelected: { color: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  removeText: { fontFamily: fonts.bold, fontSize: 17, color: colors.loss },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.3 },
});
