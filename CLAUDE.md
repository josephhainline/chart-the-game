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
- `yarn typecheck` — `tsc --noEmit` (must be clean)
- `yarn test` — `jest lib --ci`, unit tests for `lib/`
- `node scripts/build-web-artifact.mjs <outDir>` — relocatable static web build
  for hosting as a Claude Artifact (see script header)
- `yarn deploy:web` / `yarn deploy:web:infra` — S3 + CloudFront + Route 53
  hosting for chartthegame.com (`infra/web-hosting.yaml`, `docs/HOSTING.md`).
  Deploying is Joe's call: run these only when he asks.

## Layout
- `app/` — expo-router routes. Three nesting levels, each a Tabs group:
  `(app)` (My Teams · Games · About · Account), `team/[teamId]/(tabs)`
  (Home · Team · Lineup · Stats), `game/[gameId]/(tabs)` (Home · Team ·
  Opponent · CTG · Stats). Modal forms sit beside each `(tabs)` group.
- `lib/` — `types.ts` (data model), `store.tsx` (single-document state +
  AsyncStorage persistence + every action), `stats.ts` (derived W/L),
  `seed.ts` (deterministic demo data, games on Saturdays relative to today),
  `outcomes.ts` (the twelve typed outcomes plus `plain_w`/`plain_l`),
  `atbats.ts` (the one at-bat sort key + `displayResult`/`newestAtBat`),
  `undo.ts` (in-memory per-game undo stack: `pushUndo`/`popUndo`/`applyUndo`/
  `undoLabel`), `uiPrefs.ts` (AsyncStorage UI preferences, key
  `ctg:ui:typesExpanded`), `format.ts`, `dates.ts` (game date/time parsing),
  `navigation.ts` (shared back/dismiss rule), `confirm.ts`.
- `components/` — `AppHeader` (two-band header), `TabBar` (chip tabs),
  `ModalScreen`, `PhoneFrame` (430px column on wide web), `ui.tsx` primitives,
  plus feature components (`CaptureDock`, `InningStrip`, `CTGGauge`,
  `OutcomeButtons`, `ResultTile`, `MiniChips`, `LineupEditor`, `StatsTable`,
  `Scorebook`, `GameRow`, …).
- `constants/theme.ts` — every color/font/size token (sampled from the PNGs).

## Conventions
- All state changes go through `useStore()` actions; never mutate documents.
- `AtBat.result` is always from the batter's perspective; pitching stats invert it.
- Views take the at-bat letter from `result` via `displayResult` (lib/atbats)
  and use `outcomeLabel`/`outcomeShort` from lib/outcomes (they never throw);
  `getOutcome` is for lib/store result derivation only.
- Any ordered display or newest-at-bat lookup uses lib/atbats
  (`sortAtBats`/`newestAtBat`/`compareAtBats`), never document array order;
  unordered aggregates (counts, filters, `some`) need no sort.
- The CTG tab, at-bat editor and batter sheet push a lib/undo entry for the
  five undoable actions — record (`record`), skip via a row's forward-step
  target or the sheet's "Bring up to bat now" (`skip`), Next/Prev half and
  Jump ahead (`half`, one entry per half stepped), re-judge/editor field
  changes (`rejudge`), Remove at-bat (`remove`). `setPitcher` (incl.
  `recreditHalf`) and End Game are not undoable; `undoLastAtBat` stays in
  the store but the screen no longer calls it.
- React Native Web's `Alert` is a no-op: use `confirmAction()` from `lib/confirm.ts`.
- Reorder controls are up/down arrows (web drag-and-drop is unreliable).
- Tab layouts must pass `initialParams={{ teamId }}` / `{{ gameId }}` to every
  `Tabs.Screen`, or unvisited tabs render without their route id.
- Headless QA: puppeteer-core driving the local Chrome works well (see the
  session scratchpad pattern); the Metro dev server needs
  `NODE_OPTIONS=--max-old-space-size=8192` under parallel browser load.
- Keep `docs/PRODUCT_SPEC.md` and this file's Layout section in sync when
  behavior or the lib/components map changes.
