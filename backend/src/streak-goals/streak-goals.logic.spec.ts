import {
  attemptDurationSec,
  fullDaysElapsed,
  longestRunning,
  milestoneMoment,
  payableDays,
  recordSec,
} from './streak-goals.logic';

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

const START = new Date('2026-11-01T10:00:00Z');
const afterStart = (ms: number) => new Date(START.getTime() + ms);

describe('fullDaysElapsed', () => {
  it('is 0 at the moment the attempt starts', () => {
    expect(fullDaysElapsed(START, START)).toBe(0);
  });

  it('is still 0 one second before 24 hours have passed', () => {
    expect(fullDaysElapsed(START, afterStart(DAY - SECOND))).toBe(0);
  });

  it('is 1 at exactly 24 hours', () => {
    expect(fullDaysElapsed(START, afterStart(DAY))).toBe(1);
  });

  it('is still 1 one second before 48 hours have passed', () => {
    expect(fullDaysElapsed(START, afterStart(2 * DAY - SECOND))).toBe(1);
  });

  it('counts elapsed days, dropping the unfinished one', () => {
    expect(fullDaysElapsed(START, afterStart(12 * DAY + 7 * HOUR))).toBe(12);
  });

  it('is not moved by the calendar date changing at midnight', () => {
    const lateEvening = new Date('2026-11-01T22:00:00Z');
    const nextMorning = new Date('2026-11-02T09:00:00Z');

    expect(fullDaysElapsed(lateEvening, nextMorning)).toBe(0);
  });

  it('is never negative, even if the server clock moved back', () => {
    expect(fullDaysElapsed(START, afterStart(-3 * DAY))).toBe(0);
  });

  describe('across a daylight saving change in Warsaw', () => {
    it('reaches a full day an hour early by the wall clock in autumn', () => {
      // 25 October 2026 has 25 hours: clocks go from 03:00 back to 02:00.
      const start = new Date('2026-10-24T12:00:00+02:00');

      expect(
        fullDaysElapsed(start, new Date('2026-10-25T10:59:59+01:00')),
      ).toBe(0);
      expect(
        fullDaysElapsed(start, new Date('2026-10-25T11:00:00+01:00')),
      ).toBe(1);
    });

    it('needs an hour longer by the wall clock in spring', () => {
      // 29 March 2026 has 23 hours: clocks go from 02:00 forward to 03:00.
      const start = new Date('2026-03-28T12:00:00+01:00');

      expect(
        fullDaysElapsed(start, new Date('2026-03-29T12:59:59+02:00')),
      ).toBe(0);
      expect(
        fullDaysElapsed(start, new Date('2026-03-29T13:00:00+02:00')),
      ).toBe(1);
    });
  });
});

describe('payableDays', () => {
  it('is 0 when every full day has been paid', () => {
    expect(payableDays(3, 3)).toBe(0);
  });

  it('is the days not paid yet, however many have piled up', () => {
    expect(payableDays(12, 2)).toBe(10);
  });

  it('is never negative, even if the server clock moved back', () => {
    expect(payableDays(5, 7)).toBe(0);
  });
});

describe('milestoneMoment', () => {
  it('is the start plus the given number of 24-hour days', () => {
    expect(milestoneMoment(START, 7)).toEqual(new Date('2026-11-08T10:00:00Z'));
  });

  it('is the first moment the attempt counts that many full days', () => {
    const moment = milestoneMoment(START, 30);

    expect(fullDaysElapsed(START, moment)).toBe(30);
    expect(fullDaysElapsed(START, new Date(moment.getTime() - 1))).toBe(29);
  });
});

describe('longestRunning', () => {
  const goal = (name: string, startedAt: string) => ({
    name,
    startedAt: new Date(startedAt),
  });

  it('is null without goals', () => {
    expect(longestRunning([])).toBeNull();
  });

  it('is the only goal there is', () => {
    const only = goal('only', '2026-11-01T10:00:00Z');

    expect(longestRunning([only])).toBe(only);
  });

  it('is the goal that started first, wherever it is in the list', () => {
    const oldest = goal('oldest', '2026-10-01T10:00:00Z');
    const middle = goal('middle', '2026-10-15T10:00:00Z');
    const newest = goal('newest', '2026-11-01T10:00:00Z');

    expect(longestRunning([oldest, middle, newest])).toBe(oldest);
    expect(longestRunning([newest, oldest, middle])).toBe(oldest);
    expect(longestRunning([middle, newest, oldest])).toBe(oldest);
  });

  it('keeps the first of two goals started at the same moment', () => {
    const first = goal('first', '2026-11-01T10:00:00Z');
    const second = goal('second', '2026-11-01T10:00:00Z');

    expect(longestRunning([first, second])).toBe(first);
  });
});

describe('attemptDurationSec', () => {
  it('is 0 for an attempt closed right away', () => {
    expect(attemptDurationSec(START, START)).toBe(0);
  });

  it('counts whole seconds, dropping the unfinished one', () => {
    expect(attemptDurationSec(START, afterStart(1999))).toBe(1);
  });

  it('measures a long attempt', () => {
    const ended = afterStart(12 * DAY + 2 * HOUR + 5 * 60 * SECOND);

    expect(attemptDurationSec(START, ended)).toBe(1_044_300);
  });

  it('is never negative, even if the server clock moved back', () => {
    expect(attemptDurationSec(START, afterStart(-HOUR))).toBe(0);
  });
});

describe('recordSec', () => {
  it('is the current attempt before any attempt was closed', () => {
    expect(recordSec(null, 500)).toBe(500);
  });

  it('is the longest closed attempt while the current one is shorter', () => {
    expect(recordSec(900, 500)).toBe(900);
  });

  it('moves up as soon as the current attempt is longer', () => {
    expect(recordSec(900, 901)).toBe(901);
  });
});
