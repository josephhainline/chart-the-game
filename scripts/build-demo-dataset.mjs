#!/usr/bin/env node
/**
 * Regenerate lib/demo/bears-floyd-14u.json, the real season the demo team is
 * seeded from (see lib/seed.ts and docs/PRODUCT_SPEC.md §6).
 *
 * Provenance: the Bears Floyd 14U games of Aug 15 – Sep 13 2026 as captured in
 * the BearsVideoFiles project (Joe's game-footage site). For every game that
 * project holds a GameChanger HAR (`<month> <day> game <n>.har`, the
 * scorekeeping stream: roster, starting lineup, substitutions) and a footage
 * manifest (`footage/<yyyy-mm-dd>/manifest.json`) whose `games[i].plays` is the
 * play-by-play reconstructed from that stream by `tools/reconstruct_plays.py`
 * and whose `games[i].meta` carries the opponent, home/away and scheduled start.
 *
 * What this script does with them:
 *   - roster: the 15 players who appeared for the Bears in those games, with
 *     the stable ids the app uses (`p_cooper`, `p_owen_haynes`, …);
 *   - lineup + subs per game: replayed from the HAR event stream (`undo` pops
 *     the previous event; `fill_lineup_index` gives the starting order,
 *     `sub_players` the substitutions in order, courtesy runners skipped);
 *   - plate appearances: every play mapped to a CTG outcome id, the batter to
 *     a roster id (ours) or a jersey-number index (theirs), our pitcher carried
 *     forward from the "(#13 Lucas pitching)" mentions;
 *   - each sub is placed at the half-inning of the incoming player's first
 *     plate appearance after the outgoing player's last one (else the next
 *     play, else the last inning);
 *   - times become `offsetS`, seconds after the scheduled first pitch, with the
 *     real spacing kept and the first play five minutes in.
 *
 * Usage: node scripts/build-demo-dataset.mjs <path to BearsVideoFiles>
 * Writes: lib/demo/bears-floyd-14u.json (1-space indented, as committed) and
 * prints one line per game plus any unmapped plays. The output is
 * deterministic: rebuilding from the same captures gives the same bytes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VID = process.argv[2];
if (!VID) {
  console.error('usage: node scripts/build-demo-dataset.mjs <path to BearsVideoFiles>');
  process.exit(1);
}
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'demo', 'bears-floyd-14u.json');
const BEARS = 'STL Bears Floyd 14U';

// --- roster: the 15 players who appeared for the Bears in the August/September games ---
const PLAYERS = [
  ['p_hamilton', 'Hamilton', 'Case', '18'],
  ['p_brady', 'Brady', 'Felton', '23'],
  ['p_cooper', 'Cooper', 'Woollen', '50'],
  ['p_owen_haynes', 'Owen', 'Haynes', '7'],
  ['p_gabe', 'Gabe', 'Brown', '10'],
  ['p_lucas', 'Lucas', 'Kloster', '13'],
  ['p_ben', 'Ben', 'Boncek', '99'],
  ['p_knox', 'Knox', 'Kennedy', '8'],
  ['p_carsyn', 'Carsyn', 'Griffith', '26'],
  ['p_weedon', 'Weedon', 'Hainline', '04'],
  ['p_owen_clark', 'Owen', 'Clark', '24'],
  ['p_jd', 'JD', 'Etter', '6'],
  ['p_chase', 'Chase', 'Baker', '2'],
  ['p_rhett', 'Rhett', 'Frausto', '3'],
  ['p_angel', 'Angel', 'Ruiz', '12'],
];
const byName = new Map(PLAYERS.map((p) => [`${p[1]} ${p[2]}`, p[0]]));
const byJersey = new Map(PLAYERS.map((p) => [String(Number(p[3])), p[0]]));

// --- outcome mapping: GameChanger play → CTG outcome id ---
function calledStrikes(pitches) {
  return (pitches || []).filter((p) => p.result === 'called_strike').length;
}
function lastPitch(pitches) {
  const a = pitches || [];
  return a.length ? a[a.length - 1] : null;
}
function outcomeFor(p) {
  const t = p.play_type;
  const n = p.name || '';
  const pitches = p.pitches || [];
  if (['single', 'double', 'triple', 'home_run'].includes(t)) return 'hit';
  if (t === 'walk') return pitches.length ? (calledStrikes(pitches) >= 2 ? 'walk_2_looking' : 'walk_clean') : 'plain_w';
  if (t === 'hit_by_pitch') return 'plain_w';
  if (t === 'strikeout' || t === 'dropped_third_strike_batter_out' || t === 'dropped_third_strike') {
    const lp = lastPitch(pitches);
    if (!lp) return 'plain_l';
    return lp.result === 'called_strike' ? 'k_looking' : 'k_swinging';
  }
  if (t === 'batter_out') return /lineout/i.test(n) ? 'fly_out_hard' : 'plain_l';
  if (t === 'batter_out_advance_runners') return 'plain_l';
  if (t === 'fielders_choice') return 'plain_l';
  if (t === 'error') return 'plain_l';
  if (t === 'infield_fly') return 'plain_l';
  if (t === 'bunt' || /bunt/i.test(n)) return 'bunt';
  if (/sac/i.test(n)) return 'sac_fly';
  return null;
}

// --- HAR helpers: the Bears team id, roster names and the scorekeeping event stream ---
function readHar(file) {
  return JSON.parse(fs.readFileSync(path.join(VID, file), 'utf8'));
}
function harInfo(har) {
  let bearsTeamId = null;
  const roster = new Map();
  let events = null;
  for (const e of har.log.entries) {
    const u = e.request.url;
    const t = e.response.content && e.response.content.text;
    if (!t) continue;
    let m;
    if ((m = u.match(/\/teams\/([0-9a-f-]+)(\?|$)/))) {
      try {
        const a = JSON.parse(t);
        const o = a.team || a;
        if (o && o.name === BEARS) bearsTeamId = m[1];
      } catch {}
    }
    if (u.match(/\/teams\/([0-9a-f-]+)\/players$/)) {
      try {
        const a = JSON.parse(t);
        const arr = Array.isArray(a) ? a : Object.values(a).find(Array.isArray) || [];
        for (const p of arr) roster.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
      } catch {}
    }
    if (u.match(/\/game-streams\/([0-9a-f-]+)\/events$/)) {
      try {
        events = JSON.parse(t);
      } catch {}
    }
  }
  return { bearsTeamId, roster, events };
}
function lineupAndSubs(info) {
  const items = Array.isArray(info.events)
    ? info.events
    : info.events.events || info.events.items || Object.values(info.events).find(Array.isArray) || [];
  // Replay the stream in sequence order; `undo` pops the previous applied event.
  const applied = [];
  for (const it of items.slice().sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))) {
    let d = it.event_data;
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        d = {};
      }
    }
    if (d && d.code === 'undo') applied.pop();
    else applied.push(d);
  }
  const find = (d, code, out) => {
    if (!d || typeof d !== 'object') return;
    if (d.code === code) out.push(d);
    for (const v of Object.values(d)) {
      if (Array.isArray(v)) v.forEach((x) => find(x, code, out));
      else if (v && typeof v === 'object') find(v, code, out);
    }
  };
  // Walk the applied events in order, tracking the Bears order slot by slot. GameChanger
  // records a substitution two ways: `sub_players`, or clearing a slot and filling it with
  // someone else (`clear_lineup_index` + `fill_lineup_index`). Slots filled before the first
  // pitch are the starting order; a slot that changes occupant afterwards is a substitution.
  // A `sub_players` whose incoming player already holds a slot is a swap the app cannot
  // express: the outgoing player simply leaves the order (a removal).
  const teamId = info.bearsTeamId;
  const name = (id) => byName.get(info.roster.get(id));
  const slots = [];
  const subList = [];
  const removals = [];
  let pitched = false;
  const walk = (d) => {
    if (!d || typeof d !== 'object') return;
    if (d.code === 'pitch') pitched = true;
    const a = d.attributes || {};
    if (a.teamId === teamId) {
      if (d.code === 'fill_lineup_index') {
        const id = name(a.playerId);
        const prev = slots[a.index];
        if (!pitched || slots[a.index] === undefined) {
          if (slots.includes(id)) slots[slots.indexOf(id)] = null; // moved from another slot
          slots[a.index] = id;
        } else if (prev !== id && id) {
          if (slots.includes(id)) slots[slots.indexOf(id)] = null;
          subList.push({ outId: prev, inId: id });
          slots[a.index] = id;
        }
      } else if (d.code === 'clear_lineup_index') {
        // Keep the occupant until the slot is refilled; the refill decides what it was.
      } else if (d.code === 'sub_players' && !a.applyToBaserunners) {
        const outId = name(a.outgoingPlayerId);
        const inId = name(a.incomingPlayerId);
        const slot = slots.indexOf(outId);
        if (slot < 0 || !inId) return;
        if (slots.includes(inId)) {
          removals.push(outId);
          slots[slot] = null;
        } else {
          subList.push({ outId, inId });
          slots[slot] = inId;
        }
      }
    }
    for (const v of Object.values(d)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  };
  for (const d of applied) walk(d);
  // The starting order: the first occupant of every slot, in slot order.
  const starting = [];
  const seen = new Set();
  const firstOccupant = [];
  const replay = (d) => {
    if (!d || typeof d !== 'object') return;
    const a = d.attributes || {};
    if (d.code === 'fill_lineup_index' && a.teamId === teamId && firstOccupant[a.index] === undefined) firstOccupant[a.index] = name(a.playerId);
    for (const v of Object.values(d)) {
      if (Array.isArray(v)) v.forEach(replay);
      else if (v && typeof v === 'object') replay(v);
    }
  };
  for (const d of applied) replay(d);
  for (const id of firstOccupant) if (id && !seen.has(id)) { seen.add(id); starting.push(id); }
  return { lineup: starting, subs: subList, removals };
}

// --- games: [HAR file, footage date, index into that day's manifest.games] ---
const SPEC = [
  ['aug 15 game 1.har', '2026-08-15', 0],
  ['aug 15 game 2.har', '2026-08-15', 1],
  ['aug 16 game 1.har', '2026-08-16', 0],
  ['aug 16 game 2.har', '2026-08-16', 1],
  ['aug 22 game 1.har', '2026-08-22', 0],
  ['aug 22 game 2.har', '2026-08-22', 1],
  ['aug 23 game 1.har', '2026-08-23', 0],
  ['aug 23 game 2.har', '2026-08-23', 1],
  ['aug 23 game 3.har', '2026-08-23', 2],
  ['sep 12 game 1.har', '2026-09-12', 0],
  ['sep 12 game 2.har', '2026-09-12', 1],
  ['sep 13 game 1.har', '2026-09-13', 0],
  ['sep 13 game 2.har', '2026-09-13', 1],
];
const OPP = {
  'STURGEON BULLDOGS 14U': 'Sturgeon Bulldogs 14U',
  'Southside Prospects 14u': 'Southside Prospects 14U',
  'Rawlings Tigers- Meyer 14U': 'Rawlings Tigers Meyer 14U',
  'Midwest Rebels - Layne 14U': 'Midwest Rebels Layne 14U',
  'Stl Bears Ken 14U': 'Bears Ken 14U',
  'Psa-14u chiesa': 'PSA Chiesa 14U',
  'Redbirds STL Baseball 14U': 'Redbirds STL 14U',
};

const games = [];
const warnings = [];
for (const [harFile, date, index] of SPEC) {
  const info = harInfo(readHar(harFile));
  const { lineup, subs, removals } = lineupAndSubs(info);
  for (const id of removals) warnings.push(`${harFile}: ${id} was swapped out of the order (not expressible as a substitution; he is left in)`);
  const manifest = JSON.parse(fs.readFileSync(path.join(VID, 'footage', date, 'manifest.json'), 'utf8'));
  const { plays, meta } = manifest.games[index];
  const ordered = plays.slice().sort((a, b) => (a.t_utc || '').localeCompare(b.t_utc || ''));
  // Opponent batters by jersey, in order of first appearance.
  const oppOrder = [];
  const oppIndex = new Map();
  // Pitcher carry-forward from "(#13 Lucas pitching)" mentions.
  let pitcher = null;
  const firstMention = ordered.map((p) => (p.description || '').match(/#(\d+) \w+ pitching/)).find(Boolean);
  if (firstMention) pitcher = byJersey.get(String(Number(firstMention[1])));
  const atBats = [];
  let maxInning = 1;
  for (const p of ordered) {
    const outcomeId = outcomeFor(p);
    if (!outcomeId) {
      warnings.push(`${harFile}: unmapped ${p.play_side} ${p.play_type} ${p.name}`);
      continue;
    }
    if (p.inning) maxInning = Math.max(maxInning, p.inning);
    if (p.play_side === 'offensive') {
      const id = byName.get(p.player);
      if (!id) {
        warnings.push(`${harFile}: unknown batter ${p.player}`);
        continue;
      }
      atBats.push({ side: 'us', batterId: id, inning: p.inning, half: p.inning_half, outcomeId, t: p.t_utc });
    } else {
      const m = (p.description || '').match(/#(\d+) \w+ pitching/);
      if (m) pitcher = byJersey.get(String(Number(m[1]))) || pitcher;
      const j = p.opp_number == null ? '?' : String(Number(p.opp_number));
      if (!oppIndex.has(j)) {
        oppIndex.set(j, oppOrder.length);
        oppOrder.push(j);
      }
      atBats.push({ side: 'them', batter: oppIndex.get(j), inning: p.inning, half: p.inning_half, outcomeId, pitcherId: pitcher, t: p.t_utc });
    }
  }
  const usHalf = atBats.find((a) => a.side === 'us');
  const ourHalf = usHalf ? usHalf.half : meta.home_away === 'home' ? 'bottom' : 'top';
  // Place each sub (stream order) after the outgoing player's last plate appearance since the previous sub,
  // at the incoming player's next plate appearance when he batted, else the next play, else the last inning.
  const ours = atBats.filter((a) => a.side === 'us');
  let cursor = '';
  const subsOut = [];
  for (const s of subs) {
    if (!s.outId || !s.inId) continue;
    const outPAs = ours.filter((a) => a.batterId === s.outId && a.t >= cursor);
    const outLast = outPAs.length ? outPAs[outPAs.length - 1].t : cursor;
    const inFirst = ours.find((a) => a.batterId === s.inId && a.t > outLast);
    const nextPlay = atBats.find((a) => a.t > outLast);
    const at = inFirst
      ? { inning: inFirst.inning, half: inFirst.half }
      : nextPlay
        ? { inning: nextPlay.inning, half: nextPlay.half }
        : { inning: maxInning, half: ourHalf };
    subsOut.push({ outId: s.outId, inId: s.inId, at });
    cursor = outLast;
  }
  games.push({
    key: harFile.replace('.har', '').replace(/ /g, '-'),
    startsAtUtc: meta.scheduled_start,
    opponent: OPP[meta.opponent] || meta.opponent,
    // Which half we batted in is the truth; the scorer's home/away flag is wrong for one game.
    isAway: ourHalf === 'top',
    innings: maxInning,
    lineup,
    subs: subsOut,
    opponentJerseys: oppOrder,
    atBats,
  });
}
for (const g of games) {
  const first = g.atBats.length ? Math.min(...g.atBats.map((a) => Date.parse(a.t))) : 0;
  // Plays start a few minutes after the scheduled first pitch; keep their real spacing.
  g.atBats = g.atBats.map(({ t, ...rest }) => ({ ...rest, offsetS: Math.round((Date.parse(t) - first) / 1000) + 300 }));
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ source: 'BearsVideoFiles GameChanger captures, Aug 15 - Sep 13 2026', players: PLAYERS, games }, null, 1),
);
console.log('wrote', path.relative(process.cwd(), OUT));
console.log('games:', games.length, 'warnings:', warnings.length);
warnings.slice(0, 10).forEach((w) => console.log('  !', w));
for (const g of games) {
  const us = g.atBats.filter((a) => a.side === 'us').length;
  const them = g.atBats.filter((a) => a.side === 'them').length;
  const subs = g.subs.map((s) => `${s.inId}>${s.outId}@${s.at.inning}`).join(' ');
  console.log(
    `${g.key} | ${g.startsAtUtc} ${g.isAway ? '@' : 'vs'} ${g.opponent} | inn ${g.innings} | us PAs ${us} them ${them} | lineup ${g.lineup.length} | subs ${subs}`,
  );
}
