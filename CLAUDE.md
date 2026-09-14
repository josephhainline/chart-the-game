# Chart The Game — project notes

Youth-baseball coaching app: the coach charts every at-bat as a W or L for the
batter; W/L roll up into hitting and pitching stats and lineup ranking.
`docs/PRODUCT_SPEC.md` is the source of truth for screens, palette, copy and
the data model. The original design is the Marvel export in `MarvelPrototype_v1/`
(open `index.html` in a browser; `data.js` lists the 26 screens).

## Stack
Expo SDK 51 · expo-router 3 · React Native 0.74 · React Native Web · TypeScript
strict · Node 18 · yarn 1. Fonts: Lato via `@expo-google-fonts/lato`; icons:
FontAwesome6 from `@expo/vector-icons` only. No react-native-paper, no lucide.

## Commands
- `yarn web` — dev server at http://localhost:8081 (web)
- `npx tsc --noEmit -p .` — type check (must be clean)
- `npx jest lib --ci` — unit tests for `lib/`
- `node scripts/build-web-artifact.mjs <outDir>` — relocatable static web build
  for hosting as a Claude Artifact (see script header)

## Layout
- `app/` — expo-router routes. Three nesting levels, each a Tabs group:
  `(app)` (My Teams · Games · About · Account), `team/[teamId]/(tabs)`
  (Home · Team · Lineup · Stats), `game/[gameId]/(tabs)` (Home · Team ·
  Opponent · CTG · Stats). Modal forms sit beside each `(tabs)` group.
- `lib/` — `types.ts` (data model), `store.tsx` (single-document state +
  AsyncStorage persistence + every action), `stats.ts` (derived W/L),
  `seed.ts` (deterministic demo data, dates relative to today),
  `outcomes.ts` (the twelve at-bat outcomes), `format.ts`, `confirm.ts`.
- `components/` — `AppHeader` (two-band header), `TabBar` (chip tabs),
  `ModalScreen`, `PhoneFrame` (430px column on wide web), `ui.tsx` primitives,
  plus feature components (`CTGGauge`, `OutcomeButtons`, `LineupEditor`,
  `StatsTable`, `Scorebook`, `GameRow`, …).
- `constants/theme.ts` — every color/font/size token (sampled from the PNGs).

## Conventions
- All state changes go through `useStore()` actions; never mutate documents.
- `AtBat.result` is always from the batter's perspective; pitching stats invert it.
- React Native Web's `Alert` is a no-op: use `confirmAction()` from `lib/confirm.ts`.
- Reorder controls are up/down arrows (web drag-and-drop is unreliable).
- Keep `docs/PRODUCT_SPEC.md` in sync when behavior changes.
