import type { XpSource } from '../generated/prisma/client';
import { ACTIVITY_WEEKS, XP_WEEKS } from './stats.config';
import {
  activityDays,
  activityWindowStart,
  buildStats,
  currentDailyStreak,
  dayKeysBetween,
  longestStreak,
  monthKey,
  monthTotals,
  nextDayKey,
  weeklyXp,
  type StatsEvent,
} from './stats.logic';

const WARSAW = 'Europe/Warsaw';
const NEW_YORK = 'America/New_York';

// Wednesday of 2026-W46, 12:00 in Warsaw (UTC+1 in November).
const NOW = new Date('2026-11-11T11:00:00Z');

const event = (
  at: string,
  source: XpSource = 'TASK',
  amount = 10,
): StatsEvent => ({ createdAt: new Date(at), source, amount });

const weekday = (key: string) => new Date(`${key}T00:00:00Z`).getUTCDay();

describe('nextDayKey', () => {
  it.each([
    ['2026-11-11', '2026-11-12'],
    ['2026-11-30', '2026-12-01'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
    ['2027-02-28', '2027-03-01'],
    // The days the clocks change in Poland: still one calendar day each.
    ['2026-03-29', '2026-03-30'],
    ['2026-10-25', '2026-10-26'],
  ])('follows %s with %s', (key, next) => {
    expect(nextDayKey(key)).toBe(next);
  });
});

describe('dayKeysBetween', () => {
  it('lists every day from the first to the last, both included', () => {
    expect(dayKeysBetween('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('lists one day when both ends are the same', () => {
    expect(dayKeysBetween('2026-11-11', '2026-11-11')).toEqual(['2026-11-11']);
  });
});

describe('activityWindowStart', () => {
  it('is local midnight of the Monday 25 weeks before the current week', () => {
    // 2026-05-18 is a Monday; Warsaw is UTC+2 then, so midnight is 22:00 UTC
    // the day before, although NOW is in winter time.
    expect(activityWindowStart(NOW, WARSAW)).toEqual(
      new Date('2026-05-17T22:00:00Z'),
    );
  });
});

describe('activityDays', () => {
  it('runs without gaps from a Monday to today', () => {
    const days = activityDays([], [], NOW, WARSAW);
    const keys = days.map((day) => day.date);

    expect(weekday(keys[0])).toBe(1);
    expect(keys[keys.length - 1]).toBe('2026-11-11');
    expect(keys).toEqual(dayKeysBetween(keys[0], '2026-11-11'));
    // 25 full weeks, then Monday to Wednesday of this one.
    expect(days).toHaveLength((ACTIVITY_WEEKS - 1) * 7 + 3);
  });

  it.each([
    ['on Monday at midnight', '2026-11-08T23:00:00Z', 1],
    ['on Sunday just before midnight', '2026-11-15T22:59:59Z', 7],
  ])('starts on a Monday %s', (_, now, daysThisWeek) => {
    const days = activityDays([], [], new Date(now), WARSAW);

    expect(weekday(days[0].date)).toBe(1);
    expect(days).toHaveLength((ACTIVITY_WEEKS - 1) * 7 + daysThisWeek);
  });

  it('fills days without events with zeros', () => {
    const days = activityDays([], [], NOW, WARSAW);

    expect(days.every((day) => day.completions === 0 && !day.fullDay)).toBe(
      true,
    );
  });

  it('puts 23:30 and 00:30 local time into their own days, not by UTC', () => {
    const days = activityDays(
      [
        event('2026-11-09T22:30:00Z'), // 23:30 on 9 November in Warsaw
        event('2026-11-09T23:30:00Z'), // 00:30 on 10 November
      ],
      [],
      NOW,
      WARSAW,
    );
    const on = (date: string) => days.find((day) => day.date === date);

    expect(on('2026-11-09')?.completions).toBe(1);
    expect(on('2026-11-10')?.completions).toBe(1);
  });

  it("uses the user's own timezone", () => {
    // 04:30 UTC is still 23:30 on the day before in New York.
    const days = activityDays(
      [event('2026-11-10T04:30:00Z')],
      [],
      NOW,
      NEW_YORK,
    );

    expect(days.find((day) => day.date === '2026-11-09')?.completions).toBe(1);
  });

  it('counts only task completions, not badges or streak goals', () => {
    const days = activityDays(
      [
        event('2026-11-10T10:00:00Z', 'TASK'),
        event('2026-11-10T10:00:01Z', 'TASK'),
        event('2026-11-10T10:00:02Z', 'BADGE'),
        event('2026-11-10T10:00:03Z', 'STREAK_GOAL'),
      ],
      [],
      NOW,
      WARSAW,
    );

    expect(days.find((day) => day.date === '2026-11-10')?.completions).toBe(2);
  });

  it('marks the days whose daily tasks were all completed', () => {
    const days = activityDays([], ['2026-11-10', '2020-01-01'], NOW, WARSAW);

    expect(days.filter((day) => day.fullDay).map((day) => day.date)).toEqual([
      '2026-11-10',
    ]);
  });

  describe('when the clocks change', () => {
    it('keeps the 23-hour day of spring as one day', () => {
      const now = new Date('2026-04-01T10:00:00Z');
      const days = activityDays(
        [
          event('2026-03-28T23:30:00Z'), // 00:30 on 29 March, winter time
          event('2026-03-29T21:30:00Z'), // 23:30 on 29 March, summer time
          event('2026-03-29T22:30:00Z'), // 00:30 on 30 March
        ],
        [],
        now,
        WARSAW,
      );
      const keys = days.map((day) => day.date);

      expect(keys.filter((key) => key === '2026-03-29')).toHaveLength(1);
      expect(keys).toEqual(dayKeysBetween(keys[0], '2026-04-01'));
      expect(days.find((day) => day.date === '2026-03-29')?.completions).toBe(
        2,
      );
      expect(days.find((day) => day.date === '2026-03-30')?.completions).toBe(
        1,
      );
    });

    it('keeps the 25-hour day of autumn as one day', () => {
      const days = activityDays(
        [
          event('2026-10-24T22:30:00Z'), // 00:30 on 25 October, summer time
          event('2026-10-25T22:30:00Z'), // 23:30 on 25 October, winter time
          event('2026-10-25T23:30:00Z'), // 00:30 on 26 October
        ],
        [],
        NOW,
        WARSAW,
      );

      expect(days.find((day) => day.date === '2026-10-25')?.completions).toBe(
        2,
      );
      expect(days.find((day) => day.date === '2026-10-26')?.completions).toBe(
        1,
      );
    });
  });
});

describe('weeklyXp', () => {
  it('has exactly 8 weeks, oldest first, the current one last', () => {
    const weeks = weeklyXp([], NOW, WARSAW);

    expect(weeks).toHaveLength(XP_WEEKS);
    expect(weeks[0]).toEqual({
      weekKey: '2026-W39',
      weekStart: '2026-09-21',
      xp: 0,
    });
    expect(weeks[XP_WEEKS - 1]).toEqual({
      weekKey: '2026-W46',
      weekStart: '2026-11-09',
      xp: 0,
    });
    expect(weeks.every((week) => weekday(week.weekStart) === 1)).toBe(true);
  });

  it('adds up the XP of every source and leaves the other weeks at zero', () => {
    const weeks = weeklyXp(
      [
        event('2026-11-09T10:00:00Z', 'TASK', 10),
        event('2026-11-10T10:00:00Z', 'BADGE', 50),
        event('2026-11-11T10:00:00Z', 'STREAK_GOAL', 5),
        event('2026-10-28T10:00:00Z', 'TASK', 30),
      ],
      NOW,
      WARSAW,
    );

    expect(weeks.map((week) => week.xp)).toEqual([0, 0, 0, 0, 0, 30, 0, 65]);
  });

  it('ignores weeks older than the chart', () => {
    const weeks = weeklyXp([event('2026-08-01T10:00:00Z')], NOW, WARSAW);

    expect(weeks.every((week) => week.xp === 0)).toBe(true);
  });

  it('splits the turn of the ISO year into 2026-W53 and 2027-W01', () => {
    const now = new Date('2027-01-06T11:00:00Z');
    const weeks = weeklyXp(
      [
        event('2027-01-01T11:00:00Z', 'TASK', 10), // Friday of 2026-W53
        event('2027-01-03T22:30:00Z', 'TASK', 20), // Sunday 23:30, still W53
        event('2027-01-03T23:30:00Z', 'TASK', 7), // Monday 00:30, 2027-W01
      ],
      now,
      WARSAW,
    );

    expect(weeks.slice(-2)).toEqual([
      { weekKey: '2026-W53', weekStart: '2026-12-28', xp: 30 },
      { weekKey: '2027-W01', weekStart: '2027-01-04', xp: 7 },
    ]);
  });
});

describe('monthKey', () => {
  it("is the month in the user's timezone", () => {
    // 23:30 UTC on 30 November is already 1 December in Warsaw.
    expect(monthKey(new Date('2026-11-30T23:30:00Z'), WARSAW)).toBe('2026-12');
    expect(monthKey(new Date('2026-11-30T22:30:00Z'), WARSAW)).toBe('2026-11');
  });
});

describe('monthTotals', () => {
  it('counts from the first local minute of the month', () => {
    const now = new Date('2026-12-01T10:00:00Z');
    const totals = monthTotals(
      [
        event('2026-11-30T22:30:00Z', 'TASK', 10), // 23:30 on 30 November
        event('2026-11-30T23:30:00Z', 'TASK', 20), // 00:30 on 1 December
      ],
      now,
      WARSAW,
    );

    expect(totals).toEqual({ xpThisMonth: 20, completionsThisMonth: 1 });
  });

  it('counts up to the last local minute of the month', () => {
    const now = new Date('2026-11-30T22:59:00Z'); // 23:59 on 30 November
    const totals = monthTotals(
      [
        event('2026-10-31T22:30:00Z', 'TASK', 10), // 23:30 on 31 October
        event('2026-10-31T23:30:00Z', 'TASK', 20), // 00:30 on 1 November
        event('2026-11-30T22:58:00Z', 'TASK', 40), // 23:58 on 30 November
      ],
      now,
      WARSAW,
    );

    expect(totals).toEqual({ xpThisMonth: 60, completionsThisMonth: 2 });
  });

  it('adds the XP of every source but counts only tasks as completions', () => {
    const totals = monthTotals(
      [
        event('2026-11-02T10:00:00Z', 'TASK', 10),
        event('2026-11-03T10:00:00Z', 'BADGE', 50),
        event('2026-11-04T10:00:00Z', 'STREAK_GOAL', 5),
      ],
      NOW,
      WARSAW,
    );

    expect(totals).toEqual({ xpThisMonth: 65, completionsThisMonth: 1 });
  });
});

describe('longestStreak', () => {
  it.each([
    ['no days', [], 0],
    ['one day', ['2026-11-01'], 1],
    ['a gap', ['2026-11-01', '2026-11-02', '2026-11-04'], 2],
    [
      'several runs',
      [
        '2026-10-01',
        '2026-10-02',
        '2026-10-10',
        '2026-10-11',
        '2026-10-12',
        '2026-10-20',
      ],
      3,
    ],
    ['the turn of a month', ['2026-10-30', '2026-10-31', '2026-11-01'], 3],
    ['the turn of a year', ['2026-12-31', '2027-01-01'], 2],
    ['a leap day', ['2028-02-28', '2028-02-29', '2028-03-01'], 3],
    ['duplicates', ['2026-11-01', '2026-11-01', '2026-11-02'], 2],
    ['any order', ['2026-11-03', '2026-11-01', '2026-11-02'], 3],
  ])('handles %s', (_, keys, expected) => {
    expect(longestStreak(keys)).toBe(expected);
  });
});

describe('currentDailyStreak', () => {
  it('ends today when today is complete', () => {
    const keys = ['2026-11-09', '2026-11-10', '2026-11-11'];

    expect(currentDailyStreak(keys, NOW, WARSAW)).toBe(3);
  });

  it('ends yesterday while today is still open', () => {
    expect(currentDailyStreak(['2026-11-09', '2026-11-10'], NOW, WARSAW)).toBe(
      2,
    );
  });

  it('counts only the days after the last gap', () => {
    const keys = [
      '2026-11-05',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ];

    expect(currentDailyStreak(keys, NOW, WARSAW)).toBe(4);
  });

  it('is zero once yesterday was missed', () => {
    expect(currentDailyStreak(['2026-11-09'], NOW, WARSAW)).toBe(0);
  });

  it('is not stopped at the top badge threshold of 365 days', () => {
    const keys = dayKeysBetween('2025-01-01', '2026-11-11').slice(-400);

    expect(currentDailyStreak(keys, NOW, WARSAW)).toBe(400);
    expect(longestStreak(keys)).toBe(400);
  });
});

describe('buildStats', () => {
  it('puts everything into the fixed shape', () => {
    const stats = buildStats({
      events: [event('2026-11-11T08:00:00Z', 'TASK', 10)],
      fullDayKeys: ['2026-11-01', '2026-11-10', '2026-11-11'],
      now: NOW,
      timezone: WARSAW,
    });

    expect(stats.serverNow).toBe('2026-11-11T11:00:00.000Z');
    expect(stats.timezone).toBe(WARSAW);
    expect(stats.activity.days[stats.activity.days.length - 1]).toEqual({
      date: '2026-11-11',
      completions: 1,
      fullDay: true,
    });
    expect(stats.weeklyXp).toHaveLength(XP_WEEKS);
    expect(stats.summary).toEqual({
      fullDaysTotal: 3,
      currentStreak: 2,
      longestStreak: 2,
      xpThisMonth: 10,
      completionsThisMonth: 1,
    });
  });
});
