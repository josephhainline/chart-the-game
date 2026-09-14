import { differenceInCalendarDays, format } from 'date-fns';

import type { Game, OpponentBatter, Player } from './types';

/** AP-style month abbreviations, matching the prototype ("Sept 2024"). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export function monthName(d: Date): string {
  return MONTHS[d.getMonth()];
}

/** "Sept 2026" — used for the gray month bands on game lists. */
export function monthBand(iso: string): string {
  const d = new Date(iso);
  return `${monthName(d)} ${d.getFullYear()}`;
}

/** Key for grouping games by month, sorts chronologically. */
export function monthKey(iso: string): string {
  return format(new Date(iso), 'yyyy-MM');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Saturday, Sept 7th, 9:00am" */
export function gameDateLine(iso: string): string {
  const d = new Date(iso);
  return `${format(d, 'EEEE')}, ${monthName(d)} ${ordinal(d.getDate())}, ${timeShort(d)}`;
}

/** "9:00am" / "2:30pm" */
export function timeShort(d: Date): string {
  return format(d, 'h:mmaaa');
}

/** "@ Tigers" or "vs Tigers" */
export function opponentLabel(game: Pick<Game, 'opponent' | 'isAway'>): string {
  return `${game.isAway ? '@' : 'vs'} ${game.opponent}`;
}

/** "@ Tigers, Oct 5 2:30pm" — the orange in-game sub-header. */
export function gameTitle(game: Pick<Game, 'opponent' | 'isAway' | 'startsAt'>): string {
  const d = new Date(game.startsAt);
  return `${opponentLabel(game)}, ${monthName(d)} ${d.getDate()} ${timeShort(d)}`;
}

/** "4 Days" / "3 Weeks" for a game two or more calendar days out. */
function spanLabel(days: number): string {
  return days < 14 ? `${days} Days` : `${Math.round(days / 7)} Weeks`;
}

/**
 * "Today", "Tomorrow", "In 4 Days", "In 3 Weeks", or "" when in the past.
 * The plain countdown for upcoming games that are not the team's next one.
 */
export function countdownLabel(iso: string, now: Date = new Date()): string {
  const days = differenceInCalendarDays(new Date(iso), now);
  if (days < 0) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${spanLabel(days)}`;
}

/**
 * "Next Game in 4 Days", "Game Day: Today", "Next Game: Tomorrow", "Next Game in 3 Weeks", or "" when in the past.
 * Only the team's next game says "Next Game"; see `countdownLabel` for the others.
 */
export function upcomingLabel(iso: string, now: Date = new Date()): string {
  const days = differenceInCalendarDays(new Date(iso), now);
  if (days < 0) return '';
  if (days === 0) return 'Game Day: Today';
  if (days === 1) return 'Next Game: Tomorrow';
  return `Next Game in ${spanLabel(days)}`;
}

export function playerName(p: Pick<Player, 'firstName' | 'lastName'>): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** "Owen Haynes (#7)" or "Landyn Durbin" when there's no number. */
export function playerLabel(p: Pick<Player, 'firstName' | 'lastName' | 'number'>): string {
  const name = playerName(p);
  return p.number ? `${name} (#${p.number})` : name;
}

/** "Owen H. (#7)" — for tight columns like the scorebook. */
export function playerShort(p: Pick<Player, 'firstName' | 'lastName' | 'number'>): string {
  const initial = p.lastName ? ` ${p.lastName[0]}.` : '';
  const name = `${p.firstName}${initial}`;
  return p.number ? `${name} (#${p.number})` : name;
}

/** "Batter 3" or "J. Smith (#12)" for the opponent's order. */
export function opponentBatterLabel(b: OpponentBatter): string {
  return b.number ? `${b.name} (#${b.number})` : b.name;
}

/** Roster order: by last name, then first name. */
export function byLastName(a: Player, b: Player): number {
  return a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
}

/** "+24", "-6", "0" */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

/** "1st", "2nd", "3rd", "4th" */
export function inningOrdinal(n: number): string {
  return ordinal(n);
}
