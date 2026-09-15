# Chart The Game

A youth-baseball coaching app: every at-bat is a 1-on-1 battle between the
batter and the pitcher, and the coach charts each one as a **W** or an **L**.
Those calls roll up into hitting and pitching records for every player and
can rank the batting order.

This repo holds the Expo (React Native + web) app and the original Marvel
design it was built from.

## Run it

```sh
yarn install
yarn web          # dev server at http://localhost:8081
yarn ios          # or android — the app is React Native throughout
```

First launch shows the intro, then seeds a demo team (STL Bears 12U) with a
season of charted games so every screen has data. **Account → Reset demo
data** brings it back at any time; all data lives in the browser (or the
device) only.

## Check it

```sh
npx tsc --noEmit -p .      # types
npx jest lib --ci          # unit tests for the data layer
```

## Ship a web prototype

```sh
yarn deploy:web            # export + upload to S3/CloudFront (chartthegame.com)
```

`docs/HOSTING.md` covers the one-time AWS setup (`yarn deploy:web:infra`)
and the Squarespace nameserver change. The site is a single-page export, so
every route falls back to `index.html` on the host.

```sh
node scripts/build-web-artifact.mjs dist-artifact
```

Produces a relocatable static build (`index.html` fragment + `bundle/` +
`assets/`) that works under any hosting path. It is what the shared Claude
Artifact prototype is built from.

## Where things are

| Path | What |
|------|------|
| `docs/PRODUCT_SPEC.md` | Screens, palette, copy, data model — the source of truth |
| `MarvelPrototype_v1/` | Offline export of the Marvel prototype (open `index.html`) |
| `app/` | expo-router routes: app level → team level → game level |
| `lib/` | Data model, store + persistence, stats, demo seed, outcomes, at-bat ordering, undo stack, UI prefs |
| `components/` | Header, tab bar, capture dock, inning strip, charting gauge, lineup editor, scorebook, … |
| `constants/theme.ts` | Design tokens sampled from the prototype |
