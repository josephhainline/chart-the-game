import { Platform, TextStyle } from 'react-native';

/**
 * Design tokens sampled from the Marvel prototype (see docs/PRODUCT_SPEC.md §2).
 * Every screen derives its colors, type and spacing from here.
 */
export const colors = {
  primary: '#00A6FF',
  primaryDark: '#0A47AC',
  orange: '#FF9052',
  win: '#77D353',
  loss: '#F95F62',
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
  winSoft: '#E4F6DC',
  lossSoft: '#FEE3E3',
  amber: '#F5B335',
} as const;

export const fonts = {
  regular: Platform.select({ web: 'Lato_400Regular, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_400Regular' })!,
  bold: Platform.select({ web: 'Lato_700Bold, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_700Bold' })!,
  italic: Platform.select({ web: 'Lato_400Regular_Italic, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_400Regular_Italic' })!,
  boldItalic: Platform.select({ web: 'Lato_700Bold_Italic, Lato, "Helvetica Neue", Arial, sans-serif', default: 'Lato_700Bold_Italic' })!,
} as const;

export const type = {
  appTitle: { fontFamily: fonts.bold, fontSize: 26, color: '#FFFFFF' },
  appSubtitle: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  subheader: { fontFamily: fonts.bold, fontSize: 20, color: '#FFFFFF' },
  h1: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  h3: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted, letterSpacing: 0.6 },
  tab: { fontFamily: fonts.bold, fontSize: 12, color: colors.tabLabel },
  numeric: { fontFamily: fonts.regular, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

/** Width of the phone-shaped column the app renders in on wide screens. */
export const PHONE_MAX_WIDTH = 430;

export const shadow = Platform.select({
  web: { boxShadow: '0 12px 40px rgba(10, 71, 172, 0.15)' } as any,
  default: {
    shadowColor: '#0A47AC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
});
