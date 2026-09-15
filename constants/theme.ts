import { Platform, TextStyle } from 'react-native';

/**
 * Design tokens sampled from the Marvel prototype (see docs/PRODUCT_SPEC.md §2).
 * Every screen derives its colors, type and radii from here.
 */
export const colors = {
  primary: '#00A6FF',
  primaryDark: '#0A47AC',
  orange: '#FF9052',
  win: '#77D353',
  loss: '#F95F62',
  /** Darker win/loss for text on light tints (mini chips, captions). */
  winInk: '#2E7A14',
  lossInk: '#B3262A',
  /** Amber review line on the inning strip. */
  amberBg: '#FFF3D6',
  amberInk: '#8A5A00',
  /** Left rail on the AT-BAT row and the re-judge border. */
  currentRail: '#FF9052',
  /** Translucent tints for row states: peeking the other side's order, a re-judged W or L. */
  primaryTint: 'rgba(0, 166, 255, 0.08)',
  winTint: 'rgba(119, 211, 83, 0.15)',
  lossTint: 'rgba(249, 95, 98, 0.15)',
  pitching: '#976DD0',
  navy: '#040B71',
  text: '#495460',
  textMuted: '#99A2AD',
  tabLabel: '#8694A8',
  band: '#DBDBDB',
  chip: '#E5E9F2',
  buttonGray: '#969FAA',
  surface: '#FFFFFF',
  page: '#EEF1F5',
  divider: '#E6E8EC',
  amber: '#F5B335',
  white: '#FFFFFF',
  black: '#000000',
  /** Background of a list row while it is pressed. */
  pressed: '#F4F6FA',
  inputBorder: '#CFD5DE',
  tabBorder: '#D9DCF0',
  /** Navy with alpha: the backdrop behind bottom sheets. */
  scrim: 'rgba(4, 11, 113, 0.35)',
  /** Primary with alpha: the floating button's glow. */
  primaryGlow: 'rgba(0, 166, 255, 0.35)',
  /** Black with alpha: the drop shadow under the "Chart The Game" panel. */
  shadow: 'rgba(0, 0, 0, 0.25)',
} as const;

export const fonts = {
  regular: Platform.select({ web: 'Lato_400Regular, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_400Regular' })!,
  bold: Platform.select({ web: 'Lato_700Bold, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_700Bold' })!,
  italic: Platform.select({ web: 'Lato_400Regular_Italic, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_400Regular_Italic' })!,
  boldItalic: Platform.select({ web: 'Lato_700Bold_Italic, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_700Bold_Italic' })!,
} as const;

export const type = {
  appTitle: { fontFamily: fonts.bold, fontSize: 26, color: colors.white },
  appSubtitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  subheader: { fontFamily: fonts.bold, fontSize: 20, color: colors.white },
  h1: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  h3: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6 },
  tab: { fontFamily: fonts.bold, fontSize: 12, color: colors.tabLabel },
  numeric: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },

  // List scale, measured at 3x on the prototype PNGs (rows are 56pt tall).
  /** Screen-section title above a list: "Team Roster:", "Default Lineup:". */
  screenTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, lineHeight: 24 },
  /** Player / team name in a list row, and the opponent in a game row (18). */
  rowTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, lineHeight: 24 },
  /** Secondary line under a row title: dates, notes. */
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, lineHeight: 15 },
  /** Emphasised secondary line: "Final Score: Won 19 - 5", "Next Game in 4 Days". */
  rowMetaBold: { fontFamily: fonts.bold, fontSize: 12, color: colors.text, lineHeight: 15 },
  /** Text in a gray or colored section band ("Sept 2026", "Statistics: 2026 Season"). */
  band: { fontFamily: fonts.regular, fontSize: 17, color: colors.text, lineHeight: 21 },
} satisfies Record<string, TextStyle>;

export const radii = { sm: 6, md: 10, lg: 14, xl: 18, pill: 999 } as const;

/** Width of the phone-shaped column the app renders in on wide screens. */
export const PHONE_MAX_WIDTH = 430;

export const shadow = Platform.select({
  web: { boxShadow: '0 12px 40px rgba(10, 71, 172, 0.15)' } as any,
  default: {
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
});
