import { BADGE_XP, BADGES, type BadgeDefinition } from './badges.config';
import { currentStreak, metricCap, newlyEarned } from './badges.logic';

// A small catalog of its own, so these tests do not change when the real
// thresholds are tuned.
const CATALOG: BadgeDefinition[] = [
  {
    key: 'streak',
    metric: 'dailyStreak',
    tiers: [
      { tier: 'BRONZE', threshold: 3 },
      { tier: 'SILVER', threshold: 5 },
      { tier: 'GOLD', threshold: 10 },
    ],
  },
  {
    key: 'first',
    metric: 'dailyTotal',
    tiers: [{ tier: 'BRONZE', threshold: 1 }],
  },
  {
    key: 'total',
    metric: 'dailyTotal',
    tiers: [
      { tier: 'BRONZE', threshold: 2 },
      { tier: 'SILVER', threshold: 4 },
    ],
  },
  {
    key: 'goal',
    metric: 'lifeGoalCompleted',
    tiers: [{ tier: 'DIAMOND', threshold: 1, xp: 7 }],
  },
];

describe('newlyEarned', () => {
  // Just the (key, tier) pairs, in the order they were returned.
  const earn = (...args: Parameters<typeof newlyEarned>) =>
    newlyEarned(args[0], args[1], args[2] ?? CATALOG).map(
      ({ key, tier }) => `${key}:${tier}`,
    );

  it('earns nothing when no metric was measured', () => {
    expect(earn({}, [])).toEqual([]);
  });

  it('earns a tier exactly at its threshold, not one below', () => {
    expect(earn({ dailyStreak: 3 }, [])).toEqual(['streak:BRONZE']);
    expect(earn({ dailyStreak: 2 }, [])).toEqual([]);
  });

  it('earns every reached tier of a badge at once', () => {
    expect(earn({ dailyStreak: 5 }, [])).toEqual([
      'streak:BRONZE',
      'streak:SILVER',
    ]);
  });

  it('earns tiers of several badges that share a metric', () => {
    expect(earn({ dailyTotal: 4 }, [])).toEqual([
      'first:BRONZE',
      'total:BRONZE',
      'total:SILVER',
    ]);
  });

  it('skips tiers the user already has', () => {
    const earned = [{ badgeKey: 'streak', tier: 'BRONZE' as const }];
    expect(earn({ dailyStreak: 5 }, earned)).toEqual(['streak:SILVER']);
  });

  it('does not mistake the same tier of another badge for this one', () => {
    const earned = [{ badgeKey: 'first', tier: 'BRONZE' as const }];
    expect(earn({ dailyTotal: 2 }, earned)).toEqual(['total:BRONZE']);
  });

  it('only looks at the metrics it was given', () => {
    expect(earn({ dailyStreak: 10 }, [])).not.toContain('first:BRONZE');
    expect(earn({ lifeGoalCompleted: 0 }, [])).toEqual([]);
  });

  it('earns an event badge when its event happened', () => {
    expect(earn({ lifeGoalCompleted: 1 }, [])).toEqual(['goal:DIAMOND']);
  });

  it('attaches the XP each tier is worth, honouring overrides', () => {
    const awards = newlyEarned(
      { dailyStreak: 3, lifeGoalCompleted: 1 },
      [],
      CATALOG,
    );
    expect(awards).toEqual([
      { key: 'streak', tier: 'BRONZE', xp: BADGE_XP.BRONZE },
      { key: 'goal', tier: 'DIAMOND', xp: 7 },
    ]);
  });

  it('uses the real catalog by default', () => {
    const keys = newlyEarned({ weeklyTotal: 1 }, []).map((a) => a.key);
    expect(keys).toEqual(['first_week']);
  });
});

describe('currentStreak', () => {
  const WARSAW = 'Europe/Warsaw';
  // Friday 2026-10-09, 12:00 in Warsaw (UTC+2), in ISO week 2026-W41.
  const FRIDAY = new Date('2026-10-09T10:00:00Z');

  const daily = (keys: string[], now = FRIDAY, limit = 365) =>
    currentStreak(keys, 'DAILY', now, WARSAW, limit);
  const weekly = (keys: string[], now = FRIDAY, limit = 48) =>
    currentStreak(keys, 'WEEKLY', now, WARSAW, limit);

  it('is 0 without any completed period', () => {
    expect(daily([])).toBe(0);
  });

  it('counts from today when today is already completed', () => {
    expect(daily(['2026-10-09', '2026-10-08', '2026-10-07'])).toBe(3);
  });

  it('counts from yesterday while today is still open', () => {
    // The streak lives until the end of today.
    expect(daily(['2026-10-08', '2026-10-07'])).toBe(2);
  });

  it('stops at the first period without an entry', () => {
    expect(daily(['2026-10-09', '2026-10-08', '2026-10-06'])).toBe(2);
  });

  it('is 0 when neither today nor yesterday is completed', () => {
    expect(daily(['2026-10-07', '2026-10-06'])).toBe(0);
  });

  it('ignores the order of the keys it is given', () => {
    expect(daily(['2026-10-07', '2026-10-09', '2026-10-08'])).toBe(3);
  });

  it('counts at most `limit` periods, today included', () => {
    const tenDays = Array.from({ length: 10 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 9 - i)).toISOString().slice(0, 10),
    );
    expect(daily(tenDays, FRIDAY, 5)).toBe(5);
    expect(daily(tenDays.slice(1), FRIDAY, 5)).toBe(5);
  });

  it('counts the days across New Year', () => {
    const newYearsDay = new Date('2027-01-01T12:00:00Z');
    expect(daily(['2027-01-01', '2026-12-31'], newYearsDay)).toBe(2);
  });

  it('follows local midnight across the 23-hour DST day', () => {
    const monday = new Date('2026-03-30T10:00:00Z');
    expect(daily(['2026-03-30', '2026-03-29', '2026-03-28'], monday)).toBe(3);
  });

  it('counts ISO weeks for WEEKLY', () => {
    expect(weekly(['2026-W41', '2026-W40', '2026-W39'])).toBe(3);
    expect(weekly(['2026-W40', '2026-W39'])).toBe(2);
  });

  describe('across the ISO year boundary', () => {
    // Wed 2027-01-06 is in 2027-W01; 2026 has 53 ISO weeks.
    const wednesday = new Date('2027-01-06T12:00:00Z');

    it('steps from 2027-W01 back to 2026-W53', () => {
      const keys = ['2027-W01', '2026-W53', '2026-W52'];
      expect(weekly(keys, wednesday)).toBe(3);
    });

    it('treats a missing 2026-W53 as a break, not as a skipped number', () => {
      expect(weekly(['2027-W01', '2026-W52'], wednesday)).toBe(1);
    });
  });
});

describe('metricCap', () => {
  it('is the highest threshold among badges using the metric', () => {
    expect(metricCap('dailyTotal', CATALOG)).toBe(4);
    expect(metricCap('dailyStreak', CATALOG)).toBe(10);
  });

  it('is 0 for a metric no badge uses', () => {
    expect(metricCap('weeklyStreak', CATALOG)).toBe(0);
  });

  it('matches the longest streak badges in the real catalog', () => {
    const highest = (key: string) =>
      Math.max(
        ...BADGES.find((b) => b.key === key)!.tiers.map((t) => t.threshold),
      );
    expect(metricCap('dailyStreak')).toBe(highest('daily_streak'));
    expect(metricCap('weeklyStreak')).toBe(highest('weekly_streak'));
  });
});
