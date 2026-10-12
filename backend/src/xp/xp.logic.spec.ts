import type { TaskType } from '../generated/prisma/client';
import { LEVEL_CURVE, STREAK_RULES } from './xp.config';
import {
  buildLevelTable,
  computeStreak,
  levelForXp,
  levelProgress,
  streakMultiplier,
  xpForCompletion,
  type StreakCompletion,
  type StreakTask,
} from './xp.logic';

describe('buildLevelTable', () => {
  let table: number[];

  beforeAll(() => {
    table = buildLevelTable();
  });

  it('has one threshold per level, starting at 0 for level 1', () => {
    expect(table).toHaveLength(LEVEL_CURVE.MAX_LEVEL);
    expect(table[0]).toBe(0);
  });

  it('matches the thresholds from the design doc', () => {
    expect(table.slice(0, 6)).toEqual([0, 100, 200, 310, 430, 550]);
    expect(table[LEVEL_CURVE.MAX_LEVEL - 1]).toBe(150_060);
  });

  it('is strictly increasing and rounded to ROUND_TO', () => {
    for (let i = 1; i < table.length; i++) {
      expect(table[i]).toBeGreaterThan(table[i - 1]);
      expect(table[i] % LEVEL_CURVE.ROUND_TO).toBe(0);
    }
  });

  it('agrees with the geometric series sum for the last level', () => {
    const { BASE, GROWTH, MAX_LEVEL, ROUND_TO } = LEVEL_CURVE;
    const n = MAX_LEVEL - 1; // increments from level 1 up to MAX_LEVEL
    const exact = (BASE * (GROWTH ** n - 1)) / (GROWTH - 1);

    const last = table[MAX_LEVEL - 1];
    expect(Math.abs(last - exact)).toBeLessThanOrEqual(ROUND_TO / 2);
  });

  it('works for any curve passed in', () => {
    // 10 + 20 + 40 = 10 * (2^3 - 1) / (2 - 1) = 70
    const curve = { BASE: 10, GROWTH: 2, MAX_LEVEL: 4, ROUND_TO: 1 };
    expect(buildLevelTable(curve)).toEqual([0, 10, 30, 70]);
  });
});

describe('levelForXp', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [199, 2],
    [200, 3],
    [309, 3],
    [310, 4],
    [150_059, 99],
    [150_060, 100],
    [10_000_000, 100],
  ])('%i XP is level %i', (xp, level) => {
    expect(levelForXp(xp)).toBe(level);
  });

  it('treats negative XP as level 1', () => {
    expect(levelForXp(-5)).toBe(1);
  });

  it('puts every threshold exactly at the start of its level', () => {
    const table = buildLevelTable();
    for (let level = 2; level <= LEVEL_CURVE.MAX_LEVEL; level++) {
      expect(levelForXp(table[level - 1])).toBe(level);
      expect(levelForXp(table[level - 1] - 1)).toBe(level - 1);
    }
  });
});

describe('levelProgress', () => {
  it('starts at level 1 with an empty bar', () => {
    expect(levelProgress(0)).toEqual({
      level: 1,
      xpIntoLevel: 0,
      xpForNextLevel: 100,
      isMax: false,
    });
  });

  it('measures progress from the start of the current level', () => {
    // Level 3 spans 200..310, so 250 XP is 50 of 110.
    expect(levelProgress(250)).toEqual({
      level: 3,
      xpIntoLevel: 50,
      xpForNextLevel: 110,
      isMax: false,
    });
  });

  it('empties the bar exactly at a threshold', () => {
    expect(levelProgress(310)).toEqual({
      level: 4,
      xpIntoLevel: 0,
      xpForNextLevel: 120,
      isMax: false,
    });
  });

  it('has no next level at MAX_LEVEL', () => {
    expect(levelProgress(150_100)).toEqual({
      level: 100,
      xpIntoLevel: 40,
      xpForNextLevel: null,
      isMax: true,
    });
  });
});

describe('computeStreak', () => {
  const WARSAW = 'Europe/Warsaw';
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');
  // October 2026, Warsaw (UTC+2): Wed 7th, Thu 8th, Fri 9th, Sat 10th.
  const FRIDAY = new Date('2026-10-09T10:00:00Z');
  const SATURDAY = new Date('2026-10-10T10:00:00Z');

  const task = (id: string, overrides: Partial<StreakTask> = {}) => ({
    id,
    type: 'DAILY' as TaskType,
    parentTaskId: null,
    createdAt: LONG_AGO,
    ...overrides,
  });

  // completedAt only matters as "set or not", so any date will do.
  const done = (taskId: string, ...periodKeys: string[]) =>
    periodKeys.map((periodKey) => ({
      taskId,
      periodKey,
      completedAt: LONG_AGO,
    }));

  const streak = (
    tasks: StreakTask[],
    completions: StreakCompletion[],
    now = FRIDAY,
    type: TaskType = 'DAILY',
  ) => computeStreak(tasks, completions, now, WARSAW, type);

  it('is 0 when no task qualifies', () => {
    expect(streak([], [])).toBe(0);
  });

  it('counts full days in a row before today', () => {
    const completions = done('pills', '2026-10-08', '2026-10-07', '2026-10-05');
    expect(streak([task('pills')], completions)).toBe(2);
  });

  it('ignores whether today is already done', () => {
    const completions = done('pills', '2026-10-09', '2026-10-08');
    expect(streak([task('pills')], completions)).toBe(1);
  });

  it('needs every task of the type done for a full day', () => {
    const tasks = [task('pills'), task('walk')];
    expect(streak(tasks, done('pills', '2026-10-08'))).toBe(0);
  });

  it('does not count a completion that was unchecked', () => {
    const unchecked = {
      taskId: 'pills',
      periodKey: '2026-10-08',
      completedAt: null,
    };
    expect(streak([task('pills')], [unchecked])).toBe(0);
  });

  it('ignores subtasks and other task types', () => {
    const tasks = [
      task('pills'),
      task('step', { parentTaskId: 'pills' }),
      task('laundry', { type: 'WEEKLY' }),
    ];
    expect(streak(tasks, done('pills', '2026-10-08'))).toBe(1);
  });

  it('looks back at most `lookback` days', () => {
    const days = Array.from({ length: 15 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 8 - i)).toISOString().slice(0, 10),
    );
    expect(streak([task('pills')], done('pills', ...days))).toBe(
      STREAK_RULES.DAILY!.lookback,
    );
  });

  describe('spare day for a newly added task', () => {
    // "read" is added on Thursday at 10:00 Warsaw time.
    const tasks = [
      task('pills'),
      task('read', { createdAt: new Date('2026-10-08T08:00:00Z') }),
    ];
    const pills = done('pills', '2026-10-07', '2026-10-08', '2026-10-09');

    it('does not break the streak on the day it was added', () => {
      expect(streak(tasks, pills, FRIDAY)).toBe(2);
    });

    it('breaks the streak the next day if it is not done', () => {
      expect(streak(tasks, pills, SATURDAY)).toBe(0);
    });

    it('keeps the streak the next day if it is done', () => {
      const all = [...pills, ...done('read', '2026-10-09')];
      expect(streak(tasks, all, SATURDAY)).toBe(3);
    });

    it('treats a task added exactly at midnight as optional that day', () => {
      const atMidnight = [
        task('pills'),
        task('read', { createdAt: new Date('2026-10-07T22:00:00Z') }),
      ];
      expect(streak(atMidnight, pills, FRIDAY)).toBe(2);
    });
  });

  it('counts full ISO weeks for WEEKLY tasks', () => {
    // FRIDAY is in 2026-W41.
    const laundry = task('laundry', { type: 'WEEKLY' });
    const completions = done('laundry', '2026-W40', '2026-W39', '2026-W37');
    expect(streak([laundry], completions, FRIDAY, 'WEEKLY')).toBe(2);
  });

  it('is 0 for types without a streak rule', () => {
    const house = task('house', { type: 'LIFE' });
    expect(streak([house], done('house', 'LIFETIME'), FRIDAY, 'LIFE')).toBe(0);
  });
});

describe('streakMultiplier', () => {
  it.each([
    [0, 1],
    [1, 1.1],
    [2, 1.2],
    [7, 1.7],
    [10, 2],
    [15, 2],
  ])('DAILY streak %i gives x%p', (streak, multiplier) => {
    expect(streakMultiplier('DAILY', streak)).toBe(multiplier);
  });

  it.each([
    [1, 1.25],
    [2, 1.5],
    [3, 1.75],
    [4, 2],
    [6, 2],
  ])('WEEKLY streak %i gives x%p', (streak, multiplier) => {
    expect(streakMultiplier('WEEKLY', streak)).toBe(multiplier);
  });

  it('is always 1 for LIFE and SIDE_QUEST', () => {
    expect(streakMultiplier('LIFE', 5)).toBe(1);
    expect(streakMultiplier('SIDE_QUEST', 5)).toBe(1);
  });

  it('reaches the cap exactly at `lookback`, not earlier or later', () => {
    for (const type of Object.keys(STREAK_RULES) as TaskType[]) {
      const rule = STREAK_RULES[type]!;
      expect(streakMultiplier(type, rule.lookback)).toBe(rule.maxMultiplier);
      expect(streakMultiplier(type, rule.lookback - 1)).toBeLessThan(
        rule.maxMultiplier,
      );
    }
  });
});

describe('xpForCompletion', () => {
  it.each([
    ['DAILY', 0, { baseXp: 10, multiplier: 1, amount: 10 }],
    ['DAILY', 3, { baseXp: 10, multiplier: 1.3, amount: 13 }],
    ['DAILY', 10, { baseXp: 10, multiplier: 2, amount: 20 }],
    ['WEEKLY', 0, { baseXp: 30, multiplier: 1, amount: 30 }],
    // 37.5 and 52.5 round up.
    ['WEEKLY', 1, { baseXp: 30, multiplier: 1.25, amount: 38 }],
    ['WEEKLY', 3, { baseXp: 30, multiplier: 1.75, amount: 53 }],
    ['LIFE', 7, { baseXp: 1000, multiplier: 1, amount: 1000 }],
    ['SIDE_QUEST', 7, { baseXp: 20, multiplier: 1, amount: 20 }],
  ] as const)('%s at streak %i', (type, streak, expected) => {
    expect(xpForCompletion(type, streak)).toEqual(expected);
  });
});
