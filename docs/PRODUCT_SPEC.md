# Chart The Game (CTG) — Product Spec

_Source of truth for the web prototype build. Derived from the Marvel prototype in
`MarvelPrototype_v1/` (26 screens, Sept 2024) and the existing Expo app._

## 1. What the product is

Chart The Game is a youth-baseball coaching app ("a Coach Rob Floyd app"). The
premise: every plate appearance is a 1-on-1 battle between the batter and the
pitcher. The final score doesn't tell you who won those battles. So the coach
charts every at-bat as a **W** or an **L** for the batter, using judgment about
*how* the at-bat went (a hard-hit fly out is a W; a bunt or a weak-contact error
is an L).

Those W/L records accumulate across games and seasons. They produce:

- **Hitting stats** per player: W, L, Score (= W − L).
- **Pitching stats** per player: when our pitcher faces an opposing batter, the
  batter's L is the pitcher's W and vice versa.
- **Lineup ranking**: the app can rank the batting order by CTG hitting score.

Primary user: a coach standing at a youth game with a phone, one hand free.
Big tap targets, one tap per at-bat, nothing modal in the way.

## 2. Visual language (sampled from the prototype PNGs)

| Token            | Hex       | Use |
|------------------|-----------|-----|
| `primary`        | `#00A6FF` | App title band, primary buttons, active tab tint |
| `primaryDark`    | `#0A47AC` | Team-level sub-header, position badges, Hitting toggle, stats band |
| `orange`         | `#FF9052` | Game-level sub-header, "Chart The Game" CTA, CTG accent, Sign Up |
| `win`            | `#77D353` | W buttons, W letters, positive scores |
| `loss`           | `#F95F62` | L buttons, L letters, negative scores |
| `pitching`       | `#976DD0` | Pitching toggle + band on Stats |
| `navy`           | `#040B71` | Subscribe CTA panel on About |
| `text`           | `#495460` | Body/heading text (dark slate, never pure black) |
| `textMuted`      | `#99A2AD` | Dates, secondary lines |
| `tabLabel`       | `#8694A8` | Tab labels |
| `band`           | `#DBDBDB` | Month bands, table header row, inactive toggle |
| `chip`           | `#E5E9F2` | Tab icon backgrounds, search field |
| `buttonGray`     | `#969FAA` | Log In button |
| `surface`        | `#FFFFFF` | Screen background |
| `divider`        | `#E6E8EC` | Row separators |

Typography: **Lato** (Regular 400, Bold 700, Italic for teaser copy). Headings
are bold slate; numbers in tables are regular. Title band text is white bold.

Layout: iPhone-shaped single column. On desktop web the app renders inside a
centered 430px-wide column on a light gray page background so it reads as a
phone prototype.

Header pattern (every screen except intro):
1. Light-blue band, white bold "Chart The Game" centered (with "a Coach Rob
   Floyd app" subtitle on app-level screens).
2. Context sub-header with a white back chevron on the left and a centered
   title: **dark blue** at team level (team name), **orange** at game level
   ("@ Tigers, Oct 5 2:30pm").

Bottom tab bar: white, thin top border, each tab is a rounded light-gray chip
with an icon and a label below. Active tab tints its icon `primary` (team
level) or `orange` (game level).

## 3. Navigation

Three nesting levels, each with its own bottom tab bar, exactly as the
prototype:

```
Intro (first launch only)  →  App level  →  Team level  →  Game level
```

**Intro / onboarding** (`/intro`): blue splash ("Chart The Game / a Coach Rob
Floyd app"), then three swipeable teaser cards over the coach's photos
(`assets/images/intro/`: the ball field, the batter, the chalked home plate).
The photos were recovered from the prototype screens by inverting Marvel's
white overlay (`-level` in ImageMagick) and re-faded lightly (25–46% white)
so the copy stays legible:
1. "Are you *really* winning the game of baseball?"
2. "*Every game* is a series of 1-on-1 battles: **Batter vs. Pitcher**"
3. "Master the game within the game — and take your baseball journey further
   than you thought possible!" with **Log In** (gray) and **Sign Up** (orange).
Both buttons go to the app (no real auth in the prototype). Intro is skipped
after the first visit; the Account screen has "Replay intro".

**App level** tabs: Home · Games · About · Account
- Home (`/`): search field, "My Teams" list (name + chevron), "+ Add Team"
  button. Tapping a team opens team level.
- Games: every game across all teams, grouped by month, tap to open.
- About: the "What is Chart The Game (CTG)?" page (copy in §7), navy
  "Ready to discover the real game within the game?" panel, Privacy Policy /
  Contact Us links (no-op).
- Account: demo coach card, **Replay intro**, **Reset demo data**, **Clear all
  data**.

**Team level** (`/team/[teamId]`) tabs: Home · Team · Lineup · Stats. Sub-header
shows the team name; back chevron returns to My Teams.
- Home: games grouped by month bands ("Sept 2026"). Each row: "@ Opponent" or
  "vs Opponent", weekday/date/time, then either
  - final: "Final Score: Won 19 - 5" + notes line, and on the right
    "HITTING: 29W / 7L" and "PITCHING: 9W / 3L" (green when W ≥ L, red
    otherwise), or
  - upcoming: "Next Game in 4 Days" ("Game Day: Today", "Next Game:
    Tomorrow", "Next Game in 3 Weeks") + notes, and the orange **Chart The
    Game** button (gauge icon) on the nearest upcoming game. Later upcoming
    games read "In N Days" and get a smaller outlined button.
  The list opens scrolled to the next game (or the latest final one).
  - in progress: "Charting in progress" + running W/L, orange button reads
    **Continue Charting**.
  Floating "+ New Game" button opens the new-game form.
- Team: "Team Roster:" list sorted by last name, "Name (#num)" + chevron,
  floating "+ Add Player", and an "Edit team" row under the list (name,
  season, delete team). Tapping a player opens a player sheet (edit name,
  number, season hitting/pitching line, Remove player). Removing a player
  keeps their charted at-bats; season tables show them on a muted "Removed
  players" row so totals still equal the sum of the game lines.
- Lineup: "Default Lineup:" numbered rows, position badge (dark blue pill,
  tap to change), move up/down controls (drag handle visual). "Rank by CTG"
  button sorts by season hitting score. Players not in the lineup listed below
  as "Bench" with an add control.
- Stats: Hitting / Pitching segmented toggle (blue vs purple), "Statistics:
  2026 Season" band, table Name · Wins · Losses · Score with a Totals row.
  Score is green with "+" when positive, red when negative, gray "0", and "-"
  for players with no data. Rows in lineup order; tapping the Score header
  sorts by score descending.

**Game level** (`/game/[gameId]`) tabs: Home · Team · Opponent · CTG · Stats.
Orange sub-header "@ Tigers, Oct 5 2:30pm". The Home tab leaves the game and
returns to the team's Home.
- Team: this game's batting order (copied from the default lineup when the game
  is created), same row style as Lineup with position badges and reorder, and
  "Use default lineup" under the list. Giving a batter the P position makes
  them the game's pitcher. Reordering or removing batters mid-game keeps the
  same batter due up.
- Opponent: opponent batting order (default "Batter 1…9", editable names and
  numbers, add/remove) and **Our pitcher** selector (any roster player).
- CTG (the core screen):
  - Inning strip at the top: "▲ 1st" / "▼ 1st" with previous/next-half
    steppers, a HITTING (blue) or PITCHING (purple) pill for who's batting,
    the pitcher's name when pitching, and "Us N · Them N" with labeled +/-
    steppers. Away team bats in the top half.
  - Scrollable list of the batting team's order. At-bats completed in the
    current half-inning show the outcome label under the name and a big W
    or L on the right. The current batter row is expanded: "AT-BAT" label,
    the CTG gauge (seven chunky bars), a big red **L** on the left and green
    **W** on the right, and the outcome buttons in two columns (see §5).
    Next two batters show "ON DECK" and "IN THE HOLE". The whole block plus
    the next two batters fits a 375×812 phone.
  - Tapping an outcome records the at-bat, animates the gauge needle to the
    L or W side briefly, and advances to the next batter. Tapping another
    batter's row skips to them (pinch hitter); skipping more than one asks
    first. A fixed footer holds **Undo** (naming the at-bat it removes) and
    **End Game**, so neither depends on scroll position.
  - When the opponent is batting, the same buttons record their batter's
    result but the colors flip to the pitcher's perspective: green = our
    pitcher won the battle. If no pitcher is set the buttons are disabled
    behind a "Set pitcher" prompt; choosing a pitcher credits any
    unassigned opponent at-bats of the current half-inning.
  - A game becomes "in progress" on the first at-bat, half-inning change,
    score change, or batter skip.
  - **End Game** opens the finish sheet (final score, notes) and marks the
    game final. A finished game's CTG tab shows our lineup with each
    player's game W/L and a "Reopen game" action.
- Stats: scorebook grid — rows are our batters ("Owen H. (#7)"), columns are
  innings, each cell shows a green W or red L with the outcome code under it
  (or a blank diamond). A second section shows the opponent grid (our
  pitching). The W-L totals column stays pinned on the right; five or more
  innings scroll sideways.

## 4. Data model (persisted as one JSON document in AsyncStorage)

```ts
type Id = string;

type Player = { id: Id; teamId: Id; firstName: string; lastName: string; number?: string };

type Position = 'P'|'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'|'EH'|'DH';

type LineupSlot = { playerId: Id; position?: Position };

type Team = {
  id: Id; name: string; season: string;            // "2026"
  defaultLineup: LineupSlot[];
  createdAt: string;                               // ISO
};

type OpponentBatter = { id: Id; name: string; number?: string };

type Game = {
  id: Id; teamId: Id;
  opponent: string; isAway: boolean;
  startsAt: string;                                // ISO
  status: 'scheduled' | 'in_progress' | 'final';
  lineup: LineupSlot[];                            // our batting order for this game
  opponentLineup: OpponentBatter[];
  pitcherId?: Id;                                  // our current pitcher
  inning: number; half: 'top' | 'bottom';
  ourNextBatter: number; theirNextBatter: number;  // indices into the orders
  score: { us: number; them: number };
  notes?: string;
  createdAt: string; finishedAt?: string;
};

type AtBat = {
  id: Id; gameId: Id;
  side: 'us' | 'them';                             // who was batting
  batterId: Id;                                    // Player.id or OpponentBatter.id
  pitcherId?: Id;                                  // our pitcher when side === 'them'
  inning: number; half: 'top' | 'bottom';
  outcomeId: OutcomeId;
  result: 'W' | 'L';                               // from the BATTER's perspective
  recordedAt: string;
};

type AppData = {
  version: 1;
  onboarded: boolean;
  teams: Team[]; players: Player[]; games: Game[]; atBats: AtBat[];
};
```

Derived, never stored: hitting W/L per player = at-bats with `side:'us'`;
pitching W/L per player = at-bats with `side:'them'` and `pitcherId` = player,
where pitcher W = batter `L`.

## 5. At-bat outcomes (exactly the prototype's twelve, in this order)

Batter **L** (left column, red):
1. Strikeout Swinging
2. Walk, Didn't Swing & Took 2 Strikes Looking
3. Error, Weak Hit Ball
4. Fielder's Choice, Weak Hit Ball
5. Bunt
6. Strikeout Looking

Batter **W** (right column, green):
1. Sac Fly
2. Walk, No Strikes Looking
3. Error, Hard Hit Ball
4. Fielder's Choice, Hard Hit Ball
5. Fly Out, Hard Hit Ball
6. Hit

Each has a stable `OutcomeId` (`k_swinging`, `walk_2_looking`, `error_weak`,
`fc_weak`, `bunt`, `k_looking`, `sac_fly`, `walk_clean`, `error_hard`,
`fc_hard`, `fly_out_hard`, `hit`) and a short label for the scorebook
("K", "BB(2K)", "E-", "FC-", "BUNT", "KL", "SF", "BB", "E+", "FC+", "F+",
"H").

## 6. Demo data

Seeded on first launch (and by "Reset demo data"). Dates are relative to
today and land on Saturdays (youth ball is a weekend game) so the prototype
always shows a recent past and an upcoming game.

Team: **STL Bears 12U Floyd 2026**, season 2026. Roster and default lineup
(order, position):

1. Owen Haynes #7 CF · 2. Ryder Braddy #42 3B · 3. Lucas Kloster #13 SS ·
4. Cooper Woollen #50 1B · 5. Carsyn Griffith #26 C · 6. Matthew Hume #76 EH ·
7. Knox Kennedy #8 2B · 8. Weedon Hainline #10 P · 9. Landyn Durbin RF ·
10. Ben Boncek #99 LF

Games (most recent past Saturday = "last Saturday"):
- `@ Redbirds Red`, last Saturday 9:00am, final, Lost 6-7, notes "4 inning
  game, lost the lead in the 3rd inning, 1 HR."
- `@ Midland Bandits`, last Saturday 12:30pm, final, Won 19-5, notes "3 inning
  game, took the lead in the 1st inning, 1 HR." (a blowout: many more of our
  plate appearances than theirs).
- `@ Tigers`, next Saturday 2:30pm, scheduled, notes "On a three game
  winning streak against the Tigers since April."
- Four earlier finals spread over the previous nine Saturdays (Eureka Wolves,
  Tigers, Rockhounds, Fenton Fury) so the season stats and month bands have
  some depth.

Two more teams appear in My Teams with empty rosters so the list matches the
prototype: **STL Bears 13U Bernstein**, **STL Bears 15U Floyd 2026**.

Seeded at-bats are generated deterministically (seeded PRNG) so the stats
tables look like the prototype: varied per-player records, some negative.

## 7. Copy

About page body (verbatim from prototype):

> **What is Chart The Game (CTG)?**
>
> Chart The Game (CTG) is more than just a baseball analysis tool—it's your key
> to unlocking the true essence of the game.
>
> Every at-bat is a battle between the pitcher and the batter, and while the
> final score tells part of the story, it doesn't capture who really won these
> crucial encounters.
>
> For coaches, understanding these battles will transform your strategy and
> player development. CTG allows you to dig deeper, tracking and recording
> each at-bat to reveal the players' true performance.
>
> **With CTG you get:**
> - ⚾ **Detailed At-Bat Analysis:** Rank your players based on our proprietary
>   CTG metrics: the game within the game.
> - 📊 **Player Evaluation:** See who excelled in every situation.
> - 🏅 **Winning Insights:** Use this data to make smarter decisions on training
>   and strategy, building a winning team from the ground up.
>
> _Ready to discover the real game within the game? Subscribe to CTG and
> elevate your baseball strategy!_

## 8. Out of scope for this prototype

Real authentication, multi-device sync, opponent scouting, pitch counts,
box-score stats (AVG/OBP), exporting. Everything is local to the browser.
