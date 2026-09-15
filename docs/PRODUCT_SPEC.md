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
- CTG (the core screen), the "Capture Dock" layout (`docs/UX_REVIEW_ATBAT.md`
  has the reasoning). Header, inning strip and dock are fixed; only the
  batting-order list scrolls.
  - Inning strip, two lines. Line 1: Prev half · "▲ 1st" / "▼ 1st" · Next
    half · a HITTING (blue) or PITCHING (purple) pill · a small outlined
    orange **End Game** at the right. Line 2, left: while pitching the
    pitcher chip "⚾ Weedon H. (#10) ›" (opens the pitcher picker; the number
    is dropped under 390pt) or an orange "Set pitcher" link; when the clock
    is behind the newest charted half (after Prev half) an amber review line
    "Reviewing ▲ 1st · game is in ▼ 2nd · Jump ahead" replaces it. Right:
    "Us N [−][+] · Them N [−][+]" on one line. Away team bats in the top half.
  - Batting-order list: one row per batter of the side at bat — number, name
    and, when the batter has at-bats this game, the label of this half's
    newest at-bat followed by one mini chip per at-bat this game (tinted W/L
    letters in inning order); at the right the AT-BAT / ON DECK / IN THE HOLE
    tag, or this half's newest at-bat as a solid W/L tile (letter over the
    outcome code; letter alone for a plain at-bat). The AT-BAT row has an
    orange left rail. A forward-step target on every other row is the only
    skip control: no dialog for the next batter; "Bring Lucas Kloster (#13) up
    now? 2 batters will be skipped." otherwise (counting batters without a
    result this half); "… already batted this half. Give him another at-bat
    now? …" for a batter who has. Tapping a tile or chip selects that at-bat
    for re-judging; tapping the row body opens the batter sheet.
  - Capture Dock, fixed above the tab bar with a 3pt top border (blue while
    charting, orange while re-judging). Top to bottom: a context row with
    ‹ › steppers that walk the game's at-bats in inning/half/time order
    (‹ from live selects the newest; › past the newest returns to live), the
    LAST readout ("Cooper W. (#50) · W · Fly Out, Hard Hit Ball"; a plain
    at-bat reads "· W · add type ›"; suffix "· ▲ 1st" when it belongs to
    another half; tapping it selects that at-bat) and **Undo**, whose label
    names the top of the stack ("Undo W", "Undo skip", "Undo Next half",
    "Undo Prev half", "Undo re-judge", "Undo remove"); the AT-BAT header
    ("4. Cooper Woollen (#50)" with his chips; "AT-BAT · ▲ 1st" in amber while
    reviewing); the big row — solid red **L** · the CTG gauge (seven chunky
    bars) · solid green **W** (pitching: W left, L right, gauge in the
    pitcher's perspective); the "OUTCOME TYPES" toggle and, when open, the
    twelve outcome buttons in two columns (§5). The types default open on
    windows 760pt and taller and collapsed otherwise; a toggle persists at
    AsyncStorage key `ctg:ui:typesExpanded`; an open dock taller than 60% of
    the window collapses them.
  - Recording: the big L or W charts a plain at-bat (no play type) in one tap;
    an outcome button charts that type. Either swings the needle, advances the
    batter pointer, scrolls the list so one previous row stays above the
    AT-BAT row, and pushes an undo entry. The fourteen buttons ignore presses
    for 450ms after a record so a double tap cannot chart two batters.
  - Re-judging: with an at-bat selected (tile, chip, LAST readout or the
    steppers) the dock reads "RE-JUDGE · Cooper W. (#50) · ▲ 2nd · L ·
    Strikeout Swinging" with "▶ Now" (back to live) and "More…" (the full
    editor); the recorded letter is solid, the other outlined, the current
    type ringed in the grid. The outlined letter flips the at-bat to a plain
    result; a type sets that outcome; the ringed type again drops it to
    plain; each commit flashes the row, pushes "Undo re-judge" and snaps back
    to live. Selecting an at-bat of the side not batting peeks that side's
    order (light-blue rows, no tags or skip targets) until the selection
    clears — on any commit, ▶ Now, Undo, a half change, End Game or leaving
    the screen. Pointer, clock and score never change on a re-judge.
  - Undo is a per-game session stack (20 deep; survives tab switches, not a
    reload): record → delete it (a batter-sheet backfill leaves the pointer
    where it is); skip → the skipped-from batter is due up again; Next/Prev
    half → the other; a re-judge or editor change → the previous fields;
    remove → restore. Undo right after Next half reads "Undo Next half" and
    deletes nothing.
  - Pitching half: the list shows the opponent order and every readout shows
    our pitcher's result (green = our pitcher won the battle); storage stays
    the batter's result. With no pitcher set the record controls are dimmed
    behind an orange **Set pitcher** in the dock header (and the strip's
    link); picking one credits this half's unassigned opponent at-bats.
  - A game becomes "in progress" on the first at-bat, half-inning change,
    score change, or batter skip.
  - **End Game** opens the finish sheet (final score, notes) and marks the
    game final. A finished game's CTG tab shows our lineup with every at-bat
    as a tile (tap to open the editor) and each player's game W/L under the
    "Final: Won 19 - 5" band with **Reopen game**; recording again needs
    Reopen game.
- Game sheets (modal routes beside End Game and Edit Game, orange header):
  - At-bat editor `/game/[gameId]/atbat/[atBatId]`: title "Cooper Woollen
    (#50) · ▲ 2nd" (pitching: "Batter 3 · ▼ 2nd · Weedon H. (#10) pitching"),
    a large tile with "W · Fly Out, Hard Hit Ball" / "W · no play type", two
    result buttons in the perspective shown (the current one solid), the
    twelve types with the current one ringed, a "No play type" chip, Batter
    (an inline picker over that side's order), Pitcher (opponent at-bats
    only; roster chips), Half-inning (▲/▼ and inning −/+) and "Remove at-bat"
    (confirmed: "Remove Ryder Braddy's Strikeout Swinging from the top of the
    2nd? Later at-bats are not affected."). Rules: a type sets the outcome
    (result derived); a result that disagrees with the type clears the type;
    "No play type" keeps the result. Every change applies at once and is
    undoable from the CTG tab; Done closes. Removing the game's newest at-bat
    when the pointer sits right after its batter rolls the pointer back
    (record-then-remove equals undo); otherwise pointers stay put; the clock
    never moves.
  - Batter sheet `/game/[gameId]/batter/[side]/[batterId]`: the batter's game
    W/L and at-bats newest first ("▲ 2nd · Fly Out, Hard Hit Ball" with a
    tile; each opens the editor), **Bring up to bat now** when that side is
    batting (no dialog), and **Add a W** / **Add an L** ("Add a W (pitcher
    won)" for opponents) that chart a plain at-bat in the current half-inning
    without moving the batting order.
  - Pitcher picker `/game/[gameId]/pitcher` ("Our pitcher"): roster chips in
    batting order then by last name, the current one selected; when at-bats
    this half already name a pitcher, an off-by-default switch "Also credit
    the N at-bats already charted this half". One tap picks and closes. The
    Opponent tab's selector is unchanged.
- Stats: scorebook grid — rows are our batters ("Owen H. (#7)"), columns are
  innings, each cell shows a green W or red L with the outcome code under it
  (letter alone for a plain at-bat; a blank diamond when empty). Tapping a
  cell opens the at-bat editor; a cell holding several at-bats opens the
  batter sheet. Batters who left the order mid-game keep their at-bats in
  muted "LEFT GAME" rows so the grid reconciles with the totals. Under the
  HITTING / PITCHING line a caption reads "N at-bats without a play type"
  when N > 0. A second section shows the opponent grid (our pitching). The
  W-L totals column stays pinned on the right; five or more innings scroll
  sideways.

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
  outcomeId: OutcomeId;                            // one of the twelve, or 'plain_w' / 'plain_l' (no play type)
  result: 'W' | 'L';                               // from the BATTER's perspective, derived from the outcome
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

Every view orders at-bats by inning, half, then `recordedAt` (a backfilled
at-bat sits in its own inning). An at-bat can be re-judged in place
(`outcomeId`, `batterId`, `pitcherId`, `inning`, `half`; `result` re-derives)
or removed; neither touches the game document except the remove rule in §3.
The document stays `version: 1`: older documents load unchanged, but a
document that contains the plain ids will not open in a build older than the
Capture Dock.

UI-only state, never in the document: the selected at-bat, the per-game undo
stack, the record lockout, and the outcome-types preference (AsyncStorage
key `ctg:ui:typesExpanded`).

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

Two more ids, `plain_w` and `plain_l` (labels "Win" / "Loss", no short
code), record a result without a play type: the dock's big W and L and the
batter sheet's Add a W / Add an L. They are not in the twelve-button grid.
Season tables, game HITTING/PITCHING lines and lineup ranking are W/L only,
so a plain at-bat counts exactly like a typed one; the scorebook shows its
letter alone. Renderers always take the letter from `result` and use the
outcome only for its label and code.

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
Every seventh seeded at-bat is plain (no play type, same W/L) so plain tiles,
blank scorebook codes and the Stats caption are exercised.

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
