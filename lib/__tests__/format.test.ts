import { describe, expect, it } from '@jest/globals';

import {
  byLastName,
  lineupFirstRoster,
  countdownLabel,
  gameDateLine,
  gameTitle,
  halfLabel,
  inningOrdinal,
  monthBand,
  monthKey,
  monthName,
  opponentBatterLabel,
  opponentLabel,
  playerLabel,
  playerName,
  playerShort,
  signed,
  timeShort,
  upcomingLabel,
} from '../format';
import type { Player } from '../types';

/** Local-time date so the expected strings do not depend on the machine's timezone. */
function local(year: number, month1: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month1 - 1, day, hour, minute, 0, 0);
}

const owen: Player = { id: 'p_owen', teamId: 't', firstName: 'Owen', lastName: 'Haynes', number: '7' };
const landyn: Player = { id: 'p_landyn', teamId: 't', firstName: 'Landyn', lastName: 'Durbin' };

describe('playerName / playerLabel / playerShort', () => {
  it('playerLabel shows the jersey number in parentheses when present', () => {
    expect(playerLabel(owen)).toBe('Owen Haynes (#7)');
  });

  it('playerLabel omits the number block when there is no number', () => {
    expect(playerLabel(landyn)).toBe('Landyn Durbin');
    expect(playerLabel({ ...owen, number: '' })).toBe('Owen Haynes');
  });

  it('playerLabel keeps a leading-zero number as entered', () => {
    expect(playerLabel({ ...owen, number: '00' })).toBe('Owen Haynes (#00)');
  });

  it('playerShort abbreviates the last name to an initial', () => {
    expect(playerShort(owen)).toBe('Owen H. (#7)');
    expect(playerShort(landyn)).toBe('Landyn D.');
  });

  it('playerShort copes with a missing last name', () => {
    expect(playerShort({ firstName: 'Owen', lastName: '', number: '7' })).toBe('Owen (#7)');
    expect(playerShort({ firstName: 'Owen', lastName: '' })).toBe('Owen');
  });

  it('playerName joins first and last and trims when one side is empty', () => {
    expect(playerName(owen)).toBe('Owen Haynes');
    expect(playerName({ firstName: 'Owen', lastName: '' })).toBe('Owen');
    expect(playerName({ firstName: '', lastName: 'Haynes' })).toBe('Haynes');
  });
});

describe('opponentLabel / gameTitle / opponentBatterLabel', () => {
  it('uses "@" for away games and "vs" for home games', () => {
    expect(opponentLabel({ opponent: 'Tigers', isAway: true })).toBe('@ Tigers');
    expect(opponentLabel({ opponent: 'Tigers', isAway: false })).toBe('vs Tigers');
  });

  it('gameTitle matches the orange sub-header format', () => {
    const startsAt = local(2026, 10, 5, 14, 30).toISOString();
    expect(gameTitle({ opponent: 'Tigers', isAway: true, startsAt })).toBe('@ Tigers, Oct 5 2:30pm');
  });

  it('gameTitle uses AP month names and no leading zero on the day', () => {
    const startsAt = local(2026, 9, 7, 9, 0).toISOString();
    expect(gameTitle({ opponent: 'Redbirds Red', isAway: false, startsAt })).toBe('vs Redbirds Red, Sept 7 9:00am');
  });

  it('opponentBatterLabel shows the number only when present', () => {
    expect(opponentBatterLabel({ id: 'ob3', name: 'Batter 3' })).toBe('Batter 3');
    expect(opponentBatterLabel({ id: 'ob1', name: 'J. Smith', number: '12' })).toBe('J. Smith (#12)');
  });
});

describe('monthName / monthBand / monthKey', () => {
  const expected = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

  it.each(expected.map((name, i): [number, string] => [i + 1, name]))('month %i is "%s" (AP style)', (month, name) => {
    expect(monthName(local(2026, month, 14))).toBe(name);
    expect(monthBand(local(2026, month, 14).toISOString())).toBe(`${name} 2026`);
  });

  it('monthBand spells out September as "Sept"', () => {
    expect(monthBand('2026-09-14T12:00:00')).toBe('Sept 2026');
  });

  it('monthKey is a zero-padded yyyy-MM that sorts chronologically', () => {
    expect(monthKey('2026-09-14T12:00:00')).toBe('2026-09');
    expect(monthKey('2026-01-02T12:00:00')).toBe('2026-01');
    expect(monthKey('2025-12-31T12:00:00') < monthKey('2026-01-02T12:00:00')).toBe(true);
  });
});

describe('gameDateLine / timeShort / inningOrdinal', () => {
  it('formats the weekday, AP month, ordinal day and short time', () => {
    expect(gameDateLine(local(2026, 9, 18, 14, 30).toISOString())).toBe('Friday, Sept 18th, 2:30pm');
    expect(gameDateLine(local(2026, 9, 7, 9, 0).toISOString())).toBe('Monday, Sept 7th, 9:00am');
  });

  it('timeShort uses 12-hour time with a lowercase am/pm and no leading zero', () => {
    expect(timeShort(local(2026, 9, 14, 9, 0))).toBe('9:00am');
    expect(timeShort(local(2026, 9, 14, 12, 30))).toBe('12:30pm');
    expect(timeShort(local(2026, 9, 14, 0, 5))).toBe('12:05am');
    expect(timeShort(local(2026, 9, 14, 23, 59))).toBe('11:59pm');
  });

  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [31, '31st'],
  ])('inningOrdinal(%i) is "%s"', (n, s) => {
    expect(inningOrdinal(n)).toBe(s);
  });
});

describe('halfLabel', () => {
  it('is a caret for the half followed by the inning ordinal', () => {
    expect(halfLabel(1, 'top')).toBe('▲ 1st');
    expect(halfLabel(2, 'bottom')).toBe('▼ 2nd');
    expect(halfLabel(3, 'top')).toBe('▲ 3rd');
    expect(halfLabel(11, 'bottom')).toBe('▼ 11th');
  });

  it('uses the same ordinal as inningOrdinal', () => {
    for (const n of [1, 2, 3, 4, 12, 21]) {
      expect(halfLabel(n, 'top')).toBe(`▲ ${inningOrdinal(n)}`);
      expect(halfLabel(n, 'bottom')).toBe(`▼ ${inningOrdinal(n)}`);
    }
  });
});

describe('upcomingLabel', () => {
  const now = local(2026, 9, 14, 12, 0);

  it('is "Game Day: Today" for any time on the same calendar day', () => {
    expect(upcomingLabel(local(2026, 9, 14, 23, 59).toISOString(), now)).toBe('Game Day: Today');
    expect(upcomingLabel(local(2026, 9, 14, 8, 0).toISOString(), now)).toBe('Game Day: Today');
  });

  it('is "Next Game: Tomorrow" for the next calendar day, even just after midnight', () => {
    expect(upcomingLabel(local(2026, 9, 15, 0, 1).toISOString(), now)).toBe('Next Game: Tomorrow');
  });

  it('counts days for games under two weeks out', () => {
    expect(upcomingLabel(local(2026, 9, 16, 12, 0).toISOString(), now)).toBe('Next Game in 2 Days');
    expect(upcomingLabel(local(2026, 9, 18, 14, 30).toISOString(), now)).toBe('Next Game in 4 Days');
    expect(upcomingLabel(local(2026, 9, 27, 12, 0).toISOString(), now)).toBe('Next Game in 13 Days');
  });

  it('switches to rounded weeks from 14 days out', () => {
    expect(upcomingLabel(local(2026, 9, 28, 12, 0).toISOString(), now)).toBe('Next Game in 2 Weeks');
    expect(upcomingLabel(local(2026, 10, 1, 12, 0).toISOString(), now)).toBe('Next Game in 2 Weeks'); // 17 days
    expect(upcomingLabel(local(2026, 10, 5, 12, 0).toISOString(), now)).toBe('Next Game in 3 Weeks');
    expect(upcomingLabel(local(2026, 10, 12, 12, 0).toISOString(), now)).toBe('Next Game in 4 Weeks');
  });

  it('is empty for games in the past', () => {
    expect(upcomingLabel(local(2026, 9, 13, 23, 0).toISOString(), now)).toBe('');
    expect(upcomingLabel(local(2026, 9, 7, 9, 0).toISOString(), now)).toBe('');
  });
});

describe('countdownLabel', () => {
  const now = local(2026, 9, 14, 12, 0);

  it('is the plain relative day, without the "Next Game" prefix', () => {
    expect(countdownLabel(local(2026, 9, 14, 8, 0).toISOString(), now)).toBe('Today');
    expect(countdownLabel(local(2026, 9, 15, 0, 1).toISOString(), now)).toBe('Tomorrow');
    expect(countdownLabel(local(2026, 9, 19, 9, 0).toISOString(), now)).toBe('In 5 Days');
    expect(countdownLabel(local(2026, 9, 27, 12, 0).toISOString(), now)).toBe('In 13 Days');
    expect(countdownLabel(local(2026, 10, 5, 12, 0).toISOString(), now)).toBe('In 3 Weeks');
  });

  it('is empty for games in the past', () => {
    expect(countdownLabel(local(2026, 9, 13, 23, 0).toISOString(), now)).toBe('');
  });

  it('gives two games on the same day distinct lines when only one is the next game', () => {
    const morning = local(2026, 9, 19, 9, 0).toISOString();
    const afternoon = local(2026, 9, 19, 12, 30).toISOString();
    expect(upcomingLabel(morning, now)).toBe('Next Game in 5 Days');
    expect(countdownLabel(afternoon, now)).toBe('In 5 Days');
    expect(upcomingLabel(morning, now)).not.toBe(countdownLabel(afternoon, now));
  });
});

describe('signed', () => {
  it('prefixes positives with "+", leaves negatives and zero alone', () => {
    expect(signed(24)).toBe('+24');
    expect(signed(-6)).toBe('-6');
    expect(signed(0)).toBe('0');
  });
});

describe('lineupFirstRoster', () => {
  const p = (id: string, lastName: string) => ({ id, teamId: 't', firstName: id.toUpperCase(), lastName });
  it('lists the lineup in batting order, then the rest of the roster by last name', () => {
    const roster = [p('z', 'Young'), p('a', 'Adams'), p('m', 'Miller'), p('b', 'Baker')];
    const lineup = [{ playerId: 'm' }, { playerId: 'z' }, { playerId: 'ghost' }];
    expect(lineupFirstRoster(roster, lineup).map((x) => x.id)).toEqual(['m', 'z', 'a', 'b']);
  });
  it('never repeats a player and tolerates no lineup', () => {
    const roster = [p('b', 'Baker'), p('a', 'Adams')];
    expect(lineupFirstRoster(roster, [{ playerId: 'a' }, { playerId: 'a' }]).map((x) => x.id)).toEqual(['a', 'b']);
    expect(lineupFirstRoster(roster, undefined).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('byLastName', () => {
  it('sorts by last name, then first name', () => {
    const a: Player = { id: 'a', teamId: 't', firstName: 'Zed', lastName: 'Adams' };
    const b: Player = { id: 'b', teamId: 't', firstName: 'Amy', lastName: 'Baker' };
    const c: Player = { id: 'c', teamId: 't', firstName: 'Bob', lastName: 'Baker' };
    expect([c, b, a].sort(byLastName).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders the demo roster Boncek, Braddy, Durbin, Griffith, Hainline, Haynes, Hume, Kennedy, Kloster, Woollen', () => {
    const roster: Player[] = [
      ['Owen', 'Haynes'],
      ['Ryder', 'Braddy'],
      ['Lucas', 'Kloster'],
      ['Cooper', 'Woollen'],
      ['Carsyn', 'Griffith'],
      ['Matthew', 'Hume'],
      ['Knox', 'Kennedy'],
      ['Weedon', 'Hainline'],
      ['Landyn', 'Durbin'],
      ['Ben', 'Boncek'],
    ].map(([firstName, lastName], i) => ({ id: String(i), teamId: 't', firstName, lastName }));
    expect(roster.sort(byLastName).map((p) => p.lastName)).toEqual([
      'Boncek',
      'Braddy',
      'Durbin',
      'Griffith',
      'Hainline',
      'Haynes',
      'Hume',
      'Kennedy',
      'Kloster',
      'Woollen',
    ]);
  });
});
