import { describe, expect, it } from '@jest/globals';
import { format } from 'date-fns';

import { DATE_HINT, TIME_HINT, combineDateTime, parseGameDate, parseGameTime, parseSchedule, quickDates, scheduleLine } from '../dates';

/** Local-time date so the expected strings do not depend on the machine's timezone. */
function local(year: number, month1: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month1 - 1, day, hour, minute, 0, 0);
}

const ymd = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : null);

/** Monday, September 14th 2026, mid-afternoon. */
const NOW = local(2026, 9, 14, 15, 0);

describe('parseGameDate', () => {
  it.each([
    ['2026-09-19', '2026-09-19'],
    ['2026-9-19', '2026-09-19'],
    ['2026/9/19', '2026-09-19'],
    ['9/19', '2026-09-19'],
    ['9/19/26', '2026-09-19'],
    ['9/19/2026', '2026-09-19'],
    ['Sep 19', '2026-09-19'],
    ['Sept 19', '2026-09-19'],
    ['sept 19', '2026-09-19'],
    ['Sept. 19', '2026-09-19'],
    ['September 19', '2026-09-19'],
    ['Sept 19, 2026', '2026-09-19'],
    ['Sept 19 2026', '2026-09-19'],
    ['September 19, 2026', '2026-09-19'],
    ['September 19 2026', '2026-09-19'],
    ['Oct 5', '2026-10-05'],
    ['Oct. 5', '2026-10-05'],
    ['Oct 5 2026', '2026-10-05'],
    ['  Sept   19  ', '2026-09-19'],
  ])('reads %p as %s', (text, expected) => {
    expect(ymd(parseGameDate(text, NOW))).toBe(expected);
  });

  it('returns the start of the day', () => {
    const d = parseGameDate('9/19', NOW)!;
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('resolves a month/day without a year to the next occurrence, never the past', () => {
    expect(ymd(parseGameDate('9/14', NOW))).toBe('2026-09-14'); // today stays today
    expect(ymd(parseGameDate('9/13', NOW))).toBe('2027-09-13'); // yesterday rolls forward
    expect(ymd(parseGameDate('Sept 7', NOW))).toBe('2027-09-07');
    expect(ymd(parseGameDate('January 10', NOW))).toBe('2027-01-10');
    expect(ymd(parseGameDate('1/10', local(2026, 12, 28)))).toBe('2027-01-10');
    expect(ymd(parseGameDate('12/20', local(2026, 12, 28)))).toBe('2027-12-20');
    expect(ymd(parseGameDate('12/28', local(2026, 12, 28)))).toBe('2026-12-28');
  });

  it('keeps an explicit year even when it is in the past', () => {
    expect(ymd(parseGameDate('9/7/2026', NOW))).toBe('2026-09-07');
    expect(ymd(parseGameDate('Sept 7, 2026', NOW))).toBe('2026-09-07');
    expect(ymd(parseGameDate('2025-05-01', NOW))).toBe('2025-05-01');
  });

  it.each(['', '   ', 'abc', 'Saturday', '13/1', '9/31', '2/30', '19', 'Sept', '9/19/2026 extra', '2026-13-01'])(
    'rejects %p',
    (text) => {
      expect(parseGameDate(text, NOW)).toBeNull();
    },
  );
});

describe('parseGameTime', () => {
  it.each([
    ['2:30 PM', 14, 30],
    ['2:30 pm', 14, 30],
    ['2:30PM', 14, 30],
    ['2:30pm', 14, 30],
    ['2:30 p.m.', 14, 30],
    ['9:00 AM', 9, 0],
    ['9:00am', 9, 0],
    ['12:30 PM', 12, 30],
    ['12:30 AM', 0, 30],
    ['2 PM', 14, 0],
    ['2pm', 14, 0],
    ['14:30', 14, 30],
    ['9:00', 9, 0],
    ['09:00', 9, 0],
    ['12:30', 12, 30],
    ['13:00', 13, 0],
    ['23:59', 23, 59],
    [' 2:30 PM ', 14, 30],
  ])('reads %p as %i:%i', (text, hours, minutes) => {
    expect(parseGameTime(text)).toEqual({ hours, minutes });
  });

  it('treats a bare 1:00–7:59 as the afternoon (nobody plays at 2:30 in the morning)', () => {
    expect(parseGameTime('1:00')).toEqual({ hours: 13, minutes: 0 });
    expect(parseGameTime('2:30')).toEqual({ hours: 14, minutes: 30 });
    expect(parseGameTime('7:59')).toEqual({ hours: 19, minutes: 59 });
    expect(parseGameTime('8:00')).toEqual({ hours: 8, minutes: 0 });
    expect(parseGameTime('0:30')).toEqual({ hours: 0, minutes: 30 });
  });

  it('does not apply the afternoon heuristic when AM is explicit', () => {
    expect(parseGameTime('2:30 AM')).toEqual({ hours: 2, minutes: 30 });
    expect(parseGameTime('7am')).toEqual({ hours: 7, minutes: 0 });
  });

  it.each(['', '  ', 'noon', 'abc', '25:00', '24:00', '2:60', '14:30 PM', '2:30:00 PM'])('rejects %p', (text) => {
    expect(parseGameTime(text)).toBeNull();
  });
});

describe('combineDateTime', () => {
  it('puts the time on the day and zeroes the seconds', () => {
    const at = combineDateTime(local(2026, 9, 19, 0, 0), { hours: 14, minutes: 30 });
    expect(format(at, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-09-19 14:30:00');
  });
});

describe('parseSchedule', () => {
  it('combines a readable date and time', () => {
    const { startsAt, dateError, timeError } = parseSchedule('Sept 19', '2:30 PM', NOW);
    expect(format(startsAt!, 'yyyy-MM-dd HH:mm')).toBe('2026-09-19 14:30');
    expect(dateError).toBeUndefined();
    expect(timeError).toBeUndefined();
  });

  it('asks for each blank field', () => {
    const r = parseSchedule('', '  ', NOW);
    expect(r.startsAt).toBeNull();
    expect(r.dateError).toBe('Enter the date.');
    expect(r.timeError).toBe('Enter the start time.');
  });

  it('shows the accepted spellings for nonsense', () => {
    const r = parseSchedule('next week', 'after lunch', NOW);
    expect(r.startsAt).toBeNull();
    expect(r.dateError).toBe(DATE_HINT);
    expect(r.timeError).toBe(TIME_HINT);
    expect(DATE_HINT).toMatch(/Sept 19/);
    expect(TIME_HINT).toMatch(/2:30 PM/);
  });

  it('reports only the field that failed', () => {
    const r = parseSchedule('9/19', 'noon', NOW);
    expect(r.startsAt).toBeNull();
    expect(r.dateError).toBeUndefined();
    expect(r.timeError).toBe(TIME_HINT);
  });
});

describe('scheduleLine', () => {
  it('reads like the game rows for a date in the current year', () => {
    expect(scheduleLine(local(2026, 9, 19, 14, 30), NOW)).toBe('Saturday, Sept 19th, 2:30pm');
  });

  it('appends the year when a date lands in another year', () => {
    expect(scheduleLine(local(2027, 1, 10, 14, 30), NOW)).toBe('Sunday, Jan 10th, 2:30pm (2027)');
    expect(scheduleLine(local(2025, 5, 1, 9, 0), NOW)).toBe('Thursday, May 1st, 9:00am (2025)');
  });
});

describe('quickDates', () => {
  const labels = (now: Date) => quickDates(now).map((q) => [q.label, ymd(q.date)]);

  it('on a weekday points at this coming weekend', () => {
    expect(labels(NOW)).toEqual([
      ['Today', '2026-09-14'],
      ['Tomorrow', '2026-09-15'],
      ['This Saturday', '2026-09-19'],
      ['This Sunday', '2026-09-20'],
      ['Next Saturday', '2026-09-26'],
    ]);
  });

  it('on a Saturday, "This Saturday" is today and "This Sunday" is tomorrow', () => {
    expect(labels(local(2026, 9, 19, 8, 0))).toEqual([
      ['Today', '2026-09-19'],
      ['Tomorrow', '2026-09-20'],
      ['This Saturday', '2026-09-19'],
      ['This Sunday', '2026-09-20'],
      ['Next Saturday', '2026-09-26'],
    ]);
  });

  it('on a Sunday, "This Sunday" is today and "This Saturday" is six days out', () => {
    expect(labels(local(2026, 9, 20, 8, 0))).toEqual([
      ['Today', '2026-09-20'],
      ['Tomorrow', '2026-09-21'],
      ['This Saturday', '2026-09-26'],
      ['This Sunday', '2026-09-20'],
      ['Next Saturday', '2026-10-03'],
    ]);
  });

  it('returns days at midnight', () => {
    for (const q of quickDates(NOW)) expect([q.date.getHours(), q.date.getMinutes()]).toEqual([0, 0]);
  });
});
