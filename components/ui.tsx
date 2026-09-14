import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
  TextStyle,
} from 'react-native';

import { colors, fonts, radii, type } from '@/constants/theme';
import { signed } from '@/lib/format';
import type { WL } from '@/lib/stats';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null;

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'orange' | 'gray' | 'outline' | 'win' | 'loss' | 'ghost';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: React.ComponentProps<typeof FontAwesome6>['name'];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  size?: 'md' | 'lg' | 'sm';
  accessibilityLabel?: string;
};

const variantStyles: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  orange: { bg: colors.orange, fg: colors.white },
  gray: { bg: colors.buttonGray, fg: colors.white },
  outline: { bg: colors.surface, fg: colors.primaryDark, border: colors.primaryDark },
  win: { bg: colors.win, fg: colors.text },
  loss: { bg: colors.loss, fg: colors.white },
  ghost: { bg: 'transparent', fg: colors.primaryDark },
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, style, textStyle, size = 'md', accessibilityLabel }: ButtonProps) {
  const v = variantStyles[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 36 : 46;
  const fontSize = size === 'lg' ? 20 : size === 'sm' ? 14 : 17;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, height, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 2 : 0 },
        pressed && styles.pressed,
        disabled && styles.disabled,
        webCursor,
        style,
      ]}
    >
      {icon ? <FontAwesome6 name={icon} size={fontSize} color={v.fg} style={{ marginRight: 8 }} /> : null}
      <Text style={[{ fontFamily: fonts.bold, fontSize, color: v.fg }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

/** Rounded floating action button used for "+ Add Player" / "+ New Game". */
export function FloatingButton({ title, onPress, style }: { title: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed, webCursor, style]}
    >
      <FontAwesome6 name="plus" size={20} color={colors.white} />
      <Text style={styles.fabText}>{title}</Text>
    </Pressable>
  );
}

/* ---------- Rows & sections ---------- */

/**
 * Full-width band with a heading: the gray "Sept 2026" month bands (regular
 * weight) and the colored "Statistics: 2026 Season" band (bold, the default).
 */
export function SectionBand({
  title,
  color = colors.band,
  textColor = colors.text,
  weight = 'bold',
  style,
}: {
  title: string;
  color?: string;
  textColor?: string;
  weight?: 'regular' | 'bold';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.band, { backgroundColor: color }, style]}>
      <Text style={[styles.bandText, weight === 'bold' && styles.bandTextBold, { color: textColor }]}>{title}</Text>
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

/** A tappable list row with a title and a right chevron. */
export function ListRow({
  title,
  subtitle,
  onPress,
  right,
  chevron = true,
  titleStyle,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
  titleStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, pressed && onPress && styles.rowPressed, onPress && webCursor]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.listRowTitle, titleStyle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={type.caption}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron && onPress ? <FontAwesome6 name="chevron-right" size={22} color={colors.tabLabel} style={{ marginLeft: 12 }} /> : null}
    </Pressable>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { textAlign: 'center', color: colors.textMuted, marginTop: 6 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

/* ---------- Form ---------- */

export function Field({ label, style, accessibilityLabel, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

/** Two-option toggle like Hitting / Pitching. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  colorsFor,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Active color per option (Hitting is blue, Pitching is purple). */
  colorsFor?: (v: T) => string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        const bg = active ? (colorsFor ? colorsFor(o.value) : colors.primaryDark) : colors.band;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.segmentHit, pressed && styles.pressed, webCursor]}
          >
            <View style={[styles.segment, { backgroundColor: bg }]}>
              <Text style={[styles.segmentText, { color: active ? colors.white : colors.text }]}>{o.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Stats text ---------- */

/** "+24" in green, "-6" in red, "0" in gray, "-" when null. */
export function ScoreText({ value, style }: { value: number | null; style?: StyleProp<TextStyle> }) {
  const color = value === null || value === 0 ? colors.text : value > 0 ? colors.win : colors.loss;
  return <Text style={[type.numeric, { fontFamily: fonts.bold, color }, style]}>{value === null ? '-' : signed(value)}</Text>;
}

/** "12W / 10L" colored by whether wins lead. */
export function WLText({ wl, style }: { wl: WL; style?: StyleProp<TextStyle> }) {
  const color = wl.w >= wl.l ? colors.win : colors.loss;
  return (
    <Text style={[type.numeric, { fontFamily: fonts.bold, color, fontSize: 20 }, style]}>
      {wl.w}W / {wl.l}L
    </Text>
  );
}

/** Dark-blue position pill (CF, 3B, …). */
export function PositionBadge({ position, onPress, muted }: { position?: string; onPress?: () => void; muted?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={position ? `Position ${position}` : 'Set position'}
      style={({ pressed }) => [styles.badgeHit, muted && { opacity: 0.5 }, pressed && styles.pressed, onPress && webCursor]}
    >
      <View style={[styles.badge, { backgroundColor: position ? colors.primaryDark : colors.chip }]}>
        <Text style={[styles.badgeText, { color: position ? colors.white : colors.textMuted }]}>{position ?? '—'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingHorizontal: 18,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: 22,
    height: 56,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 6px 18px ${colors.primaryGlow}` } as any)
      : { shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }),
  },
  fabText: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  // 27px tall like the prototype's 25pt month / Statistics bands.
  band: { paddingHorizontal: 16, paddingVertical: 3 },
  bandText: { ...type.band },
  bandTextBold: { fontFamily: fonts.bold },
  divider: { height: 1, backgroundColor: colors.divider },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: colors.pressed },
  listRowTitle: { ...type.rowTitle },
  empty: { padding: 32, alignItems: 'center' },
  field: { marginBottom: 14 },
  fieldLabel: { ...type.label, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: colors.surface,
  },
  segmented: { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingVertical: 4 },
  // Prototype: 147x26pt rounded rectangles with 14pt bold labels; the
  // pressable around each one keeps a 44px-tall target.
  segmentHit: { flex: 1, height: 44, justifyContent: 'center' },
  segment: { height: 28, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: fonts.bold, fontSize: 14 },
  // The pill itself is 44x32 like the prototype; the pressable keeps a 44px-tall target.
  badgeHit: { minHeight: 44, justifyContent: 'center' },
  badge: { minWidth: 44, height: 32, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  badgeText: { fontFamily: fonts.bold, fontSize: 20 },
});
