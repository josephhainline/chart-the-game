import {
  addDays,
  addYears,
  differenceInCalendarDays,
  isSaturday,
  isSunday,
  isValid,
  nextSaturday,
  nextSunday,
  parse,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';

import { gameDateLine } from './format';

/**
 * Reading the free-text Date and Time fields of the game form.
 *
 * Coaches type dates the way they say them ("Sept 19", "9/19") and times the
 * way they appear on a schedule ("2:30 PM", "2:30pm", "14:30"), so several
 * spellings are accepted. Everything here is pure so it can be unit tested.
 */

export type ClockTime = { hours: number; minutes: number };

export type QuickDate = { label: string; date: Date };

/** What to tell the coach when the Date field can't be read. */
export const DATE_HINT = 'Enter a date like Sept 19, 9/19 or 2026-09-19.';
/** What to tell the coach when the Time field can't be read. */
export const TIME_HINT = 'Enter a time like 2:30 PM or 14:30.';

const DATE_FORMATS = ['yyyy-MM-dd', 'yyyy/M/d', 'M/d/yy', 'M/d/yyyy', 'M/d', 'MMM d, yyyy', 'MMM d yyyy', 'MMM d', 'MMMM d, yyyy', 'MMMM d yyyy', 'MMMM d'];
/** Formats that carry no year: they resolve to the next occurrence of that day. */
const YEARLESS_FORMATS = new Set(['M/d', 'MMM d', 'MMMM d']);
const TIME_FORMATS = ['h:mm a', 'h:mma', 'h a', 'ha', 'H:mm'];

function parseWith(text: string, formats: string[], ref: Date): { date: Date; format: string } | null {
  for (const f of formats) {
    const d = parse(text, f, ref);
    if (isValid(d)) return { date: d, format: f };
  }
  return null;
}

/** "Sept 19", "Sept. 19" and "Oct. 5" → the "Sep 19" / "Oct 5" spellings date-fns knows. */
function normalizeDateText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    // The app itself prints September AP-style as "Sept" (lib/format.ts).
    .replace(/^sept\b/i, 'Sep')
    .replace(/^([a-z]+)\./i, '$1');
}

/**
 * Calendar day from the Date field, or null when it can't be read.
 *
 * A month and day with no year ("9/19", "Sept 19") means the next time that
 * day comes around: today or later, never a day that has already passed.
 */
export function parseGameDate(text: string, now: Date = new Date()): Date | null {
  const normalized = normalizeDateText(text);
  if (!normalized) return null;
  const hit = parseWith(normalized, DATE_FORMATS, now);
  if (!hit) return null;
  let day = startOfDay(hit.date);
  if (YEARLESS_FORMATS.has(hit.format) && differenceInCalendarDays(day, now) < 0) day = addYears(day, 1);
  return day;
}

/** Hours and minutes from the Time field, or null when it can't be read. */
export function parseGameTime(text: string): ClockTime | null {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  const hit = parseWith(trimmed, TIME_FORMATS, new Date(2000, 0, 1));
  if (!hit) return null;
  let hours = hit.date.getHours();
  const minutes = hit.date.getMinutes();
  // A bare "2:30" (no AM/PM) means the afternoon: nobody plays at 2:30 in the morning.
  if (hit.format === 'H:mm' && hours >= 1 && hours <= 7) hours += 12;
  return { hours, minutes };
}

/** The game's first pitch: the calendar day at the given time, seconds zeroed. */
export function combineDateTime(day: Date, time: ClockTime): Date {
  return setSeconds(setMinutes(setHours(day, time.hours), time.minutes), 0);
}

/**
 * Reads the Date and Time fields together. Each field that can't be read
 * gets a message ready to show under it; `startsAt` is set only when both read.
 */
export function parseSchedule(date: string, time: string, now: Date = new Date()): { startsAt: Date | null; dateError?: string; timeError?: string } {
  const day = parseGameDate(date, now);
  const clock = parseGameTime(time);
  const result: { startsAt: Date | null; dateError?: string; timeError?: string } = {
    startsAt: day && clock ? combineDateTime(day, clock) : null,
  };
  if (!day) result.dateError = date.trim() ? DATE_HINT : 'Enter the date.';
  if (!clock) result.timeError = time.trim() ? TIME_HINT : 'Enter the start time.';
  return result;
}

/**
 * "Saturday, Sept 19th, 2:30pm" — with the year appended when it is not the
 * current one ("Sunday, Jan 10th, 2:30pm (2027)") so the coach can see where
 * a year-less date landed.
 */
export function scheduleLine(startsAt: Date, now: Date = new Date()): string {
  const line = gameDateLine(startsAt.toISOString());
  return startsAt.getFullYear() === now.getFullYear() ? line : `${line} (${startsAt.getFullYear()})`;
}

/** "Today", "Tomorrow", "This Saturday", "This Sunday", "Next Saturday". */
export function quickDates(now: Date = new Date()): QuickDate[] {
  const today = startOfDay(now);
  const thisSaturday = isSaturday(today) ? today : nextSaturday(today);
  const thisSunday = isSunday(today) ? today : nextSunday(today);
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This Saturday', date: thisSaturday },
    { label: 'This Sunday', date: thisSunday },
    { label: 'Next Saturday', date: addDays(thisSaturday, 7) },
  ];
}
