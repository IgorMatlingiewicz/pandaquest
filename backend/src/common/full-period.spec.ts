import type { TaskType } from '../generated/prisma/client';
import {
  doneKey,
  doneSet,
  isPeriodFull,
  type DueWindow,
  type FullPeriodTask,
} from './full-period';

// Two periods to check against: Monday 2026-10-05 and ISO week 2026-W41,
// both starting at Monday 00:00 in Warsaw (22:00 UTC the day before).
const MONDAY_START = new Date('2026-10-04T22:00:00Z');
const TODAY: DueWindow = { key: '2026-10-05', start: MONDAY_START };
const THIS_WEEK: DueWindow = { key: '2026-W41', start: MONDAY_START };
const LIFETIME: DueWindow = { key: 'LIFETIME', start: null };

const LONG_AGO = new Date('2026-01-01T00:00:00Z');
const task = (
  id: string,
  type: TaskType = 'DAILY',
  createdAt = LONG_AGO,
): FullPeriodTask => ({ id, type, createdAt });

const today = () => TODAY;
const done = (...pairs: [string, string][]) =>
  new Set(pairs.map(([id, key]) => doneKey(id, key)));

describe('isPeriodFull', () => {
  it('is false without any task', () => {
    expect(isPeriodFull([], done(), today)).toBe(false);
  });

  it('is true when every due task is done in the period', () => {
    const tasks = [task('pills'), task('walk')];
    const all = done(['pills', TODAY.key], ['walk', TODAY.key]);
    expect(isPeriodFull(tasks, all, today)).toBe(true);
  });

  it('is false while one due task is not done', () => {
    const tasks = [task('pills'), task('walk')];
    expect(isPeriodFull(tasks, done(['pills', TODAY.key]), today)).toBe(false);
  });

  it('does not count a completion from another period', () => {
    const yesterday = done(['pills', '2026-10-04']);
    expect(isPeriodFull([task('pills')], yesterday, today)).toBe(false);
  });

  describe('spare period for a task added during it', () => {
    const added = (createdAt: string) =>
      task('read', 'DAILY', new Date(createdAt));

    it('does not require a task added after the period started', () => {
      const tasks = [task('pills'), added('2026-10-05T08:00:00Z')];
      expect(isPeriodFull(tasks, done(['pills', TODAY.key]), today)).toBe(true);
    });

    it('does not require a task added exactly at the start', () => {
      const tasks = [task('pills'), added(MONDAY_START.toISOString())];
      expect(isPeriodFull(tasks, done(['pills', TODAY.key]), today)).toBe(true);
    });

    it('requires a task added a moment before the start', () => {
      const tasks = [task('pills'), added('2026-10-04T21:59:59Z')];
      expect(isPeriodFull(tasks, done(['pills', TODAY.key]), today)).toBe(
        false,
      );
    });

    it('is false when every task was added during the period', () => {
      const tasks = [added('2026-10-05T08:00:00Z')];
      expect(isPeriodFull(tasks, done(['read', TODAY.key]), today)).toBe(false);
    });
  });

  describe('scope with several task types (one category)', () => {
    const windowFor = (type: TaskType) =>
      type === 'DAILY' ? TODAY : type === 'WEEKLY' ? THIS_WEEK : LIFETIME;
    const tasks = [
      task('pills', 'DAILY'),
      task('laundry', 'WEEKLY'),
      // Non-cyclic tasks have no spare period: due as soon as they exist.
      task('paint', 'SIDE_QUEST', new Date('2026-10-05T08:00:00Z')),
    ];

    it('checks each task in the period of its own type', () => {
      const all = done(
        ['pills', TODAY.key],
        ['laundry', THIS_WEEK.key],
        ['paint', LIFETIME.key],
      );
      expect(isPeriodFull(tasks, all, windowFor)).toBe(true);
    });

    it('is false while a non-cyclic task is not done', () => {
      const cyclicOnly = done(['pills', TODAY.key], ['laundry', THIS_WEEK.key]);
      expect(isPeriodFull(tasks, cyclicOnly, windowFor)).toBe(false);
    });

    it('does not accept a weekly task done under the daily key', () => {
      const wrongKey = done(
        ['pills', TODAY.key],
        ['laundry', TODAY.key],
        ['paint', LIFETIME.key],
      );
      expect(isPeriodFull(tasks, wrongKey, windowFor)).toBe(false);
    });
  });
});

describe('doneSet', () => {
  it('keeps completed tasks and drops unchecked ones', () => {
    const set = doneSet([
      { taskId: 'pills', periodKey: '2026-10-05', completedAt: LONG_AGO },
      { taskId: 'walk', periodKey: '2026-10-05', completedAt: null },
    ]);
    expect([...set]).toEqual([doneKey('pills', '2026-10-05')]);
  });
});

describe('doneKey', () => {
  it('tells tasks and periods apart', () => {
    expect(doneKey('a', '2026-10-05')).not.toBe(doneKey('a', '2026-10-06'));
    expect(doneKey('a', '2026-10-05')).not.toBe(doneKey('b', '2026-10-05'));
  });
});
