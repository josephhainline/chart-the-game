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
| `primaryDark`    | `#0A47AC` | Team-level sub-header, Hitting toggle, stats band, COLD tag ink |
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
  - final: "Final after 4 innings" + notes line, and on the right
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
- Lineup: "Default Lineup:" numbered rows — number, name, move up/down
  controls and a red remove control (circle-minus) that sends the player to
  the bench. "Rank by CTG" button sorts by season hitting score. Players not
  in the lineup listed below as "Bench" with an add control (adds to the end
  of the order). There are no fielding positions in the app; the only role a
  game tracks is the pitcher.
- Stats: Hitting / Pitching segmented toggle (blue vs purple), "Statistics:
  2026 Season" band, table Name · Wins · Losses · Score with a Totals row.
  Score is green with "+" when positive, red when negative, gray "0", and "-"
  for players with no data. Rows in lineup order; tapping the Score header
  sorts by score descending.

**Game level** (`/game/[gameId]`) tabs: Home · Team · Opponent · CTG · Stats.
Orange sub-header "@ Tigers, Oct 5 2:30pm". The Home tab leaves the game and
returns to the team's Home.
- Team: this game's batting order (copied from the default lineup when the game
  is created), same row style as Lineup — number, name, an orange swap control
  ("Substitute for …", opens the substitution sheet; hidden on a final game),
  reorder and the remove control — and "Use default lineup" under the list.
  The pitcher is set on the Opponent tab or from the CTG screen, never from
  the order. Reordering or removing batters mid-game keeps the same batter
  due up. Removing a batter who has at-bats this game asks first ("Remove
  Cooper Woollen? He has 2 at-bats this game. They stay in the stats; his row
  moves to the bottom of the scorebook." — or, for one: "He has 1 at-bat this
  game. It stays in the stats; …"); a remove is not a substitution and
  records nothing.
- Opponent: opponent batting order (default "Batter 1…9", editable names and
  numbers, add/remove) and **Our pitcher** selector (any roster player).
- CTG (the core screen), the "Capture Dock" layout (`docs/UX_REVIEW_ATBAT.md`
  has the reasoning). Header, inning strip and dock are fixed; only the
  batting-order list scrolls.
  - Inning strip, two lines. Line 1: Prev half · "▲ 1st" / "▼ 1st" · Next
    half · a HITTING (blue) or PITCHING (purple) pill · a small outlined
    orange **End Game** at the right. Line 2, left: while pitching the
    pitcher chip "⚾ Weedon H. (#04) ›" (opens the pitcher picker; the number
    is dropped under 390pt) or an orange "Set pitcher" link; when the clock
    is behind the newest charted half (after Prev half, or after the editor
    moves an at-bat to a later half than the clock) an amber review line
    "Reviewing ▲ 1st · game is in ▼ 2nd · Jump ahead" replaces it; Jump ahead
    steps Next half until the clock reaches that half. The second line is
    left out while we are hitting with nothing to review. Runs are not
    tracked anywhere: the app is about each player's battles, not the
    scoreboard. Away team bats in the top half.
  - Batting-order list: one row per batter of the side at bat — number, name
    and, when the batter has at-bats this game, the label of this half's
    newest at-bat followed by one mini chip per at-bat this game (tinted W/L
    letters in inning order); at the right the AT-BAT / ON DECK / IN THE HOLE
    tag, or this half's newest at-bat as a solid W/L tile (letter over the
    outcome code; letter alone for a plain at-bat). The AT-BAT row has an
    orange left rail. A forward-step target on every other row is the only
    skip control. The next batter comes up with no dialog, even if he already
    batted this half. A farther target asks first unless nothing is skipped:
    "Bring Lucas Kloster (#13) up now? 2 batters will be skipped." counts only
    passed-over batters without a result this half (no dialog when that count
    is 0 and the target has not batted this half); a farther target who
    already has a result this half asks "… already batted this half. Give him
    another at-bat now?" followed by "N batters will be skipped." only when
    N > 0. Tapping a tile or chip selects that at-bat for re-judging; tapping
    the row body opens the batter sheet. While a live (not final) game's list
    shows OUR order and the bench is not empty, a "BENCH · LAST 6 AT-BATS"
    band follows the order with one compact row per bench player (roster
    players not in this game's order, hottest first — see §4 form): name, a
    HOT / COLD tag, the form line, and "Started · out ▲ 4th" when he left
    this game through a substitution and the player who replaced him still
    holds a slot. Bench rows are display only; a finished game's box score
    has no bench band.
  - Capture Dock, fixed above the tab bar with a 3pt top border (blue while
    charting, orange while re-judging). Top to bottom: a context row with
    ‹ › steppers that walk the game's at-bats in inning/half/time order
    (‹ from live selects the newest; › past the newest returns to live), the
    LAST readout ("Cooper W. (#50) · W · Fly Out, Hard Hit Ball"; a plain
    at-bat reads "· W · add type ›"; suffix "· ▲ 1st" when it belongs to
    another half; tapping it selects that at-bat) and **Undo**, whose label
    names the top of the stack ("Undo W", "Undo skip", "Undo Next half",
    "Undo Prev half", "Undo re-judge", "Undo remove", "Undo sub") — while an at-bat is
    selected the LAST readout and Undo give way to the RE-JUDGE readout with
    "▶ Now" and "More…", and Undo is not shown until ▶ Now or a commit
    returns the dock to live; the AT-BAT header ("4. Cooper Woollen (#50)"
    with his chips — the name opens his batter sheet; "AT-BAT · ▲ 1st" in
    amber while reviewing); the big row —
    solid red **L** · the CTG gauge (seven chunky
    bars) · solid green **W** (pitching: W left, L right, gauge in the
    pitcher's perspective); the "OUTCOME TYPES" toggle and, when open, the
    twelve outcome buttons in two columns (§5): 36pt buttons and 64pt big L/W
    on windows 700pt and taller, 28pt and 56pt below. The types default open
    on windows 760pt and taller and collapsed otherwise; a toggle persists at
    AsyncStorage key `ctg:ui:typesExpanded`; tapping the LAST readout of a
    plain at-bat also opens the types for that re-judge without saving the
    preference (they close again when the selection clears); an open dock
    taller than 60% of the window collapses them until the coach toggles the
    types at that window height (a resize re-arms the rule).
  - Recording: the big L or W charts a plain at-bat (no play type) in one tap;
    an outcome button charts that type. Either swings the needle, advances the
    batter pointer, scrolls the list so one previous row stays above the
    AT-BAT row, and pushes an undo entry. Recording stays live while reviewing
    and charts into the reviewed half (the clock's half, which the dock header
    names as "AT-BAT · ▲ 1st" in amber). The fourteen buttons ignore presses
    for 450ms after a record, after a re-judge commit, and after a
    farther-target skip resolves (with or without its dialog, confirmed or
    cancelled), so a double tap cannot chart two batters; the skip targets and
    the row tap honour the same lockout, which never blocks Undo, the steppers
    or the inning strip. Leaving re-judge mode from the dock (▶ Now, a commit,
    › past the newest) makes the LAST readout and Undo ignore presses for
    350ms, since they appear where ▶ Now and the types were.
  - Re-judging: with an at-bat selected (tile, chip, LAST readout or the
    steppers; a stepper or LAST selection scrolls that at-bat's row into
    view, a tile or chip tap does not) the dock reads "RE-JUDGE · Cooper W.
    (#50) · ▲ 2nd · L · Strikeout Swinging" with "▶ Now" (back to live) and
    "More…" (the full editor); the recorded letter is solid, the other
    outlined, the current
    type ringed in the grid. The outlined letter flips the at-bat to a plain
    result; a type sets that outcome; the ringed type again drops it to
    plain; each commit flashes the row, pushes "Undo re-judge" and snaps back
    to live. Selecting an at-bat of the side not batting peeks that side's
    order (light-blue rows, no tags or skip targets) until the selection
    clears — on any commit, ▶ Now, a half change, End Game or leaving the
    screen. Pointer and clock never change on a re-judge.
  - Undo is a per-game session stack (20 deep; survives tab switches, not a
    reload): record → delete it (a batter-sheet backfill leaves the pointer
    where it is); skip → the skipped-from batter is due up again; Next/Prev
    half → the other (Jump ahead pushes one Next half entry per half stepped,
    so Undo walks back one half at a time); a re-judge or editor change → the
    previous fields; remove → restore (the batter who was due before the
    remove is due again); sub → the outgoing player gets his slot back and
    the record is dropped (only while the sub still holds the slot). Undo
    right after Next half reads "Undo Next half" and deletes nothing. The stack is emptied by Reset demo data, Clear all
    data and deleting the game.
  - Pitching half: the list shows the opponent order and every readout shows
    our pitcher's result (green = our pitcher won the battle); storage stays
    the batter's result. The big buttons' accessibility labels speak in the
    pitcher's perspective too: "Knox K. (#8) won against Batter 1" / "Knox K.
    (#8) lost to Batter 1" ("Our pitcher …" until one is set), where hitting
    reads "Win for Owen Haynes (#7)" / "Loss for …". With no pitcher set the
    record controls are dimmed
    behind an orange **Set pitcher** in the dock header (and the strip's
    link); picking one credits this half's unassigned opponent at-bats.
  - A game becomes "in progress" on the first at-bat, half-inning change,
    or batter skip.
  - **End Game** opens the finish sheet (the game's HITTING and PITCHING
    W/L as a recap, notes) and marks the
    game final. A finished game's CTG tab shows our lineup with every at-bat
    as a tile (tap to open the editor) and each player's game W/L under the
    "Final" band (which carries the game's hitting W/L) with **Reopen game**. A player who left his slot
    through a substitution keeps a muted row at that slot number right above
    the player who took it, captioned "OUT ▲ 4th"; the replacement's row reads
    "IN ▲ 4th" (a re-entered player appears once, with his latest entry).
    Batters with at-bats who have since left the order any other way follow
    the lineup as muted "LEFT GAME" rows (a dash for the slot number), so the
    tiles add up to the game's hitting line; recording again needs Reopen
    game.
- Game sheets (modal routes beside End Game and Edit Game, orange header):
  - Pitcher sheet `/game/[gameId]/pitching/[playerId]`: "Weedon Hainline
    (#04) · pitching", his W/L and innings this game, then every batter he
    faced, newest first ("▲ 2nd · Batter 6 (#11) · Strikeout Swinging" with a
    tile from the pitcher's side), each opening the at-bat editor. This is how
    an opposing at-bat is re-judged after the game.
  - At-bat editor `/game/[gameId]/atbat/[atBatId]`: title "Cooper Woollen
    (#50) · ▲ 2nd" (pitching: "Batter 3 · ▼ 2nd · Weedon H. (#04) pitching"),
    a large tile with "W · Fly Out, Hard Hit Ball" / "W · no play type", two
    result buttons in the perspective shown (the current one solid), the
    twelve types with the current one ringed, a "No play type" chip, Batter
    (an inline picker over that side's order), Pitcher (opponent at-bats
    only; roster chips), Half-inning (▲/▼ and inning −/+) and "Remove at-bat"
    (confirmed: "Remove Brady Felton's Strikeout Swinging from the top of the
    2nd? Later at-bats are not affected."). Rules: a type sets the outcome
    (result derived); a result that disagrees with the type clears the type;
    "No play type" keeps the result. Every change applies at once and is
    undoable from the CTG tab; Done closes. Removing the game's newest at-bat
    when the pointer sits right after its batter rolls the pointer back
    (record-then-remove equals undo); otherwise pointers stay put; the clock
    never moves.
  - Batter sheet `/game/[gameId]/batter/[side]/[batterId]`: the batter's game
    W/L and at-bats newest first ("▲ 2nd · Fly Out, Hard Hit Ball" with a
    tile; each opens the editor); for our batters a **Form** card (§4: the
    last six at-bats as mini chips with a HOT / COLD tag, then "Season +5 ·
    last game 3W / 0L", or "No at-bats yet this season"); **Bring up to bat
    now** when that side is batting (no dialog); **Add a W** / **Add an L**
    ("Add a W (pitcher won)" for opponents) that chart a plain at-bat in the
    current half-inning without moving the batting order; and, for our
    batters in the order while the game is not final, an orange
    **Substitute…** (swap icon) that opens the substitution sheet.
  - Substitution sheet `/game/[gameId]/sub/[batterId]` ("Substitute"): an OUT
    card for the batter leaving ("4. Cooper Woollen (#50)", this game's chips,
    his form line), then "BENCH · TAP TO SUB IN · HOTTEST FIRST": one row per
    bench player (roster players not in this game's order, ordered by form
    score, then season score, players without at-bats last, then last name)
    with name, HOT / COLD tag, form line and "Started · out ▲ 4th" when he
    left this game earlier. Tapping a row puts him in the outgoing batter's
    slot — nothing else in the order moves, the batter due up stays due up,
    and the clock and pitcher are untouched — records the substitution
    at the game's current half-inning, pushes "Undo sub", and closes; when the
    outgoing batter was our pitcher the pitcher picker opens instead of
    closing. A caption under the list explains: "The sub takes slot N. Cooper
    goes to the bench and can come back in later. Nothing else in the order
    moves." Re-entry is allowed with no warning (a player can go out and come
    back in any number of times). With no one on the bench: "No one on the
    bench" / "Players not in this game's order appear here. Add players on
    the team's Team tab."; on a final game or for a batter no longer in the
    order: "Nothing to substitute". A game that was scheduled becomes in
    progress on a substitution.
  - Pitcher picker `/game/[gameId]/pitcher` ("Our pitcher"): roster chips in
    batting order then by last name, the current one selected; when at-bats
    this half already name a pitcher, an off-by-default switch "Also credit
    the N at-bats already charted this half". One tap picks and closes. The
    Opponent tab's selector is unchanged.
- Stats: scorebook grid — "#" slot column, "Line Up" name column ("Owen H.
  (#7)"), one column per inning, each cell a green W or red L with the outcome
  code under it (letter alone for a plain at-bat; a blank diamond when empty).
  Tapping a cell opens the at-bat editor; a cell holding several at-bats opens
  the batter sheet. A substitution shows as two rows with the same slot
  number: the player who left, muted with "OUT ▲ 4TH" under his name, right
  above the player who took the slot, whose note reads "IN ▲ 4TH". Batters
  removed from the order any other way keep their at-bats in muted "LEFT
  GAME" rows ("–" for the slot) after the order, so the grid reconciles with
  the totals. Under the
  HITTING / PITCHING line a caption reads "N at-bats without a play type"
  when N > 0. The W-L totals column stays pinned on the right; five or more
  innings scroll sideways. The **Pitching** section (purple band) is a list
  of our pitchers only, in the order they pitched: Pitcher · Innings
  ("1st–3rd") · W / L (pitcher's side) · Score, with a Totals row; the game's
  current pitcher is listed before he has faced anyone ("Not yet"). Opposing
  batters are never tracked as individuals. Tapping a pitcher opens the
  pitcher sheet.
  The team-level Stats tab (outside a game) covers every game of the season;
  this tab covers the one game.

## 4. Data model (persisted as one JSON document in AsyncStorage)

```ts
type Id = string;

type Player = { id: Id; teamId: Id; firstName: string; lastName: string; number?: string };

type LineupSlot = { playerId: Id };                 // no fielding positions; only the pitcher is tracked (Game.pitcherId)

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
  substitutions?: Substitution[];                  // oldest first; absent on older documents and on games with none
  notes?: string;
  createdAt: string; finishedAt?: string;
};

type Substitution = {
  id: Id;
  slot: number;                                    // index into `lineup` that changed hands
  outId: Id; inId: Id;                             // Player.ids; re-entry allowed (a player may be outId once and inId later)
  inning: number; half: 'top' | 'bottom';          // the game's clock when the change was made
  at: string;                                      // ISO
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
The document stays `version: 1`: older documents open in this build (lineup
slots are normalized on load, see below), but a document that contains the
plain ids will not open in a build older than the Capture Dock.

Documents written before substitutions existed carried a `position` key on
lineup slots; the store drops every key but `playerId` on load and rewrites
the document only when something changed.

**Form** (derived in `lib/stats.ts`): a batter's *recent form* is his last
`FORM_WINDOW = 6` our-side at-bats across the team's games (final and in
progress), ordered by game start then inning, half and time; the *form score*
is W − L over that window. The rating is **HOT** at `FORM_HOT = +3` or better
and **COLD** at −3 or worse, and no rating at all with fewer than
`FORM_MIN_AT_BATS = 4` at-bats in the window. The *last game line* is the
player's W/L in his most recent final game with an at-bat. The bench of a
game is the roster minus the game's order (roster order); the substitution
sheet and the CTG bench band order it players with at-bats first, then by form
score, season hitting score and last name. The season Stats table lists the
bench after the lineup, by last name.

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

Seeded on first launch (and by "Reset demo data"). The demo is a real
season: **Bears Floyd 14U**, Fall 2026, thirteen games charted from the
coach's GameChanger captures (the BearsVideoFiles project). The dataset is
committed as `lib/demo/bears-floyd-14u.json` and regenerated by
`scripts/build-demo-dataset.mjs` (see the script header and README); `lib/seed.ts`
builds the document from it. Nothing about the games is invented: no notes,
no generated at-bats.

Only the calendar is synthetic. The three real weekends are re-dated
relative to today so the demo always shows a recent past and an upcoming
game: Sep 12/13 becomes the most recent weekend that is fully over (its
Saturday is "last Saturday" from Monday to Friday; on a Saturday or a Sunday
the previous weekend, so the finals never sit in the future), Aug 22/23 the
weekend three weeks before it and Aug 15/16 four weeks before. Sunday games
land on that Saturday plus one day. Each game keeps its real local
(America/Chicago) time of day.

Team: **Bears Floyd 14U**, season "Fall 2026" (`t_floyd14u`). Roster (ids are
stable):

1. Hamilton Case #18 (`p_hamilton`) · 2. Brady Felton #23 (`p_brady`) ·
3. Cooper Woollen #50 (`p_cooper`) · 4. Owen Haynes #7 (`p_owen_haynes`) ·
5. Gabe Brown #10 (`p_gabe`) · 6. Lucas Kloster #13 (`p_lucas`) ·
7. Ben Boncek #99 (`p_ben`) · 8. Knox Kennedy #8 (`p_knox`) ·
9. Carsyn Griffith #26 (`p_carsyn`) · 10. Weedon Hainline #04 (`p_weedon`) ·
11. Owen Clark #24 (`p_owen_clark`) · 12. JD Etter #6 (`p_jd`) ·
13. Chase Baker #2 (`p_chase`) · 14. Rhett Frausto #3 (`p_rhett`) ·
15. Angel Ruiz #12 (`p_angel`)

The default lineup is the starting order of the first Sep 12 game: players
1–10 above, in that order; the bench is Owen Clark, JD, Chase, Rhett and
Angel. Jersey numbers are kept as captured ("04" stays "04").

Games (all `final`, in this order; `@` = away, `vs` = home):

| id | weekend | opponent | inn. |
|----|---------|----------|------|
| `g_0815_1` | Sat −4, 4:00pm | @ Kypher Redbirds 13U | 4 |
| `g_0815_2` | Sat −4, 5:45pm | @ Sturgeon Bulldogs 14U | 3 |
| `g_0816_1` | Sun −4, 10:45am | vs Southside Prospects 14U | 3 |
| `g_0816_2` | Sun −4, 2:15pm | @ Rawlings Tigers Bottorff 14U | 3 |
| `g_0822_1` | Sat −3, 2:15pm | @ Redbirds STL 14U | 5 |
| `g_0822_2` | Sat −3, 5:45pm | vs Bears Ken 14U | 4 |
| `g_0823_1` | Sun −3, 9:00am | vs Bears Ken 14U | 2 |
| `g_0823_2` | Sun −3, 12:30pm | @ Rawlings Tigers Meyer 14U | 4 |
| `g_0823_3` | Sun −3, 4:00pm | @ Redbirds STL 14U | 4 |
| `g_0912_1` | Sat 0, 8:00am | vs Rawlings Tigers Meyer 14U | 4 |
| `g_0912_2` | Sat 0, 12:00pm | @ Midwest Rebels Layne 14U | 4 |
| `g_0913_1` | Sun 0, 12:00pm | vs PSA Chiesa 14U | 5 |
| `g_0913_2` | Sun 0, 4:00pm | vs Missouri Gators Carmi 14U | 4 |

Each final game carries its real starting order with the captured
substitutions applied (twelve games have them; `g_0823_1` has three in one
half-inning, `g_0913_1` a re-entry: JD for Chase and Chase back for JD), the
`substitutions` records, an opponent order of one "Batter N" per jersey
number seen (in order of first appearance, jersey as the number, unknown
jerseys without one), the last pitcher who faced a batter as `pitcherId`, the
clock at the bottom of the last inning, `finishedAt` two hours after first
pitch and `createdAt` the day before. At-bats (`g_0815_1_ab0`, …) keep their
real spacing after first pitch; each is the captured play mapped to a CTG
outcome (hits, walks with or without called strikes, strikeouts swinging or
looking, hard-hit line-outs; every other out is plain) with `result` derived
from it, so the season has typed and plain at-bats on both sides: 314 of our
plate appearances and 265 of theirs. Cooper ends the season +19 and Owen
Haynes +17.

The builder replays GameChanger's lineup events, so a slot the scorer
cleared and refilled counts as a substitution and every batter is in the
order; home/away comes from the half we batted in (the scorer's flag was
wrong for `g_0822_2`). No game keeps its run totals.

One scheduled game, `g_next`: **vs Bears Ken 14U**, next Saturday 10:00am,
the default lineup, a default opponent order ("Batter 1…9"), no pitcher and
no at-bats, so the CTG screen starts from Set pitcher.

Three more teams appear in My Teams with empty rosters, no games and empty
default lineups, all season "Fall 2026": **Bears Ken 14U** (`t_ken14u`),
**Bears Engelken 14U** (`t_engelken14u`), **Bears Floyd 17U** (`t_floyd17u`).

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

Runs and the scoreboard (the app scores battles, not innings), real
authentication, multi-device sync, opponent scouting, pitch counts,
box-score stats (AVG/OBP), exporting. Everything is local to the browser.
