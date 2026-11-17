import { randomUUID } from 'node:crypto';
import type { PeriodCompletion } from '../common/full-period';
import { currentDailyStreak } from '../stats/stats.logic';
import { MAX_REMINDERS } from './reminders.config';
import {
  REMINDER_KEY_PATTERN,
  buildReminders,
  cyclePayload,
  dailyKey,
  friendInviteKey,
  isEvening,
  isLastDayOfWeek,
  shownCutoff,
  weeklyKey,
  type CycleState,
  type ReminderInput,
} from './reminders.logic';

const WARSAW = 'Europe/Warsaw';
const NEW_YORK = 'America/New_York';
const at = (iso: string) => new Date(iso);

// Wednesday 2026-11-11 in Warsaw, UTC+1: local time = UTC + 1 h.
const WED_18_59_59 = at('2026-11-11T17:59:59Z');
const WED_19_00 = at('2026-11-11T18:00:00Z');
const WED_23_59_59 = at('2026-11-11T22:59:59Z');
const THU_00_00 = at('2026-11-11T23:00:00Z');
const THU_19_00 = at('2026-11-12T18:00:00Z');
// Sunday 2026-11-15, the last day of 2026-W46.
const SUN_19_00 = at('2026-11-15T18:00:00Z');

const LONG_AGO = at('2026-01-01T00:00:00Z');
const daily = (id: string, createdAt = LONG_AGO) => ({
  id,
  type: 'DAILY' as const,
  createdAt,
});
const weekly = (id: string) => ({
  id,
  type: 'WEEKLY' as const,
  createdAt: LONG_AGO,
});
const doneIn = (periodKey: string, ...ids: string[]): PeriodCompletion[] =>
  ids.map((taskId) => ({ taskId, periodKey, completedAt: LONG_AGO }));

const NOTHING: CycleState = { tasks: [], completions: [], completedKeys: [] };

const input = (over: Partial<ReminderInput>): ReminderInput => ({
  now: WED_19_00,
  timezone: WARSAW,
  daily: NOTHING,
  weekly: NOTHING,
  pendingInviteIds: [],
  shownKeys: new Set(),
  ...over,
});

describe('REMINDER_KEY_PATTERN', () => {
  const FRIENDSHIP = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';

  it('accepts every key the builders make', () => {
    for (const key of [
      dailyKey(WED_19_00, WARSAW),
      weeklyKey(WED_19_00, WARSAW),
      // ISO week 53 and a week number below 10.
      weeklyKey(at('2027-01-01T12:00:00Z'), WARSAW),
      weeklyKey(at('2026-03-04T12:00:00Z'), WARSAW),
      friendInviteKey(FRIENDSHIP),
      friendInviteKey(randomUUID()),
    ]) {
      expect(key).toMatch(REMINDER_KEY_PATTERN);
    }
  });

  it.each([
    ['nothing', ''],
    ['no prefix', '2026-11-11'],
    ['an unknown prefix', 'monthly:2026-11'],
    ['capital letters', 'DAILY:2026-11-11'],
    ['a day without zero padding', 'daily:2026-11-1'],
    ['a week key under daily', 'daily:2026-W46'],
    ['a week without the W', 'weekly:2026-46'],
    ['a week without zero padding', 'weekly:2026-W6'],
    ['something after the key', 'daily:2026-11-11x'],
    ['a space around the key', ' daily:2026-11-11'],
    ['a second line', 'daily:2026-11-11\ndaily:2026-11-12'],
    ['a friend request that is not a UUID', 'friend_invite:abc'],
    ['a UUID in capitals', `friend_invite:${FRIENDSHIP.toUpperCase()}`],
    ['a UUID without dashes', `friend_invite:${FRIENDSHIP.replace(/-/g, '')}`],
  ])('refuses %s', (_, key) => {
    expect(key).not.toMatch(REMINDER_KEY_PATTERN);
  });
});

describe('shownCutoff', () => {
  it('is 30 days of 24 hours before now, whatever the clocks did', () => {
    // 25 October lies in between: still exactly 30 × 24 h.
    expect(shownCutoff(at('2026-11-11T18:00:00Z'))).toEqual(
      at('2026-10-12T18:00:00Z'),
    );
  });
});

describe('isEvening', () => {
  it.each([
    ['18:59:59', WED_18_59_59, false],
    ['19:00:00', WED_19_00, true],
    ['23:59:59', WED_23_59_59, true],
    ['00:00:00 the next day', THU_00_00, false],
  ])('at %s local time is %s', (_, now, expected) => {
    expect(isEvening(now, WARSAW)).toBe(expected);
  });

  // Local midnight + 19 h would be 20:00 on the 23-hour day of spring and
  // 18:00 on the 25-hour day of autumn; the local hour is right on both.
  describe('on the last Sunday of March, a 23-hour day (UTC+1 → UTC+2)', () => {
    it.each([
      ['18:59:59', '2026-03-29T16:59:59Z', false],
      ['19:00:00', '2026-03-29T17:00:00Z', true],
      ['23:59:59', '2026-03-29T21:59:59Z', true],
      ['00:00:00 the next day', '2026-03-29T22:00:00Z', false],
    ])('at %s local time is %s', (_, now, expected) => {
      expect(isEvening(at(now), WARSAW)).toBe(expected);
    });
  });

  describe('on the last Sunday of October, a 25-hour day (UTC+2 → UTC+1)', () => {
    it.each([
      [
        '18:00:00, which midnight + 19 h would call 19:00',
        '2026-10-25T17:00:00Z',
        false,
      ],
      ['18:59:59', '2026-10-25T17:59:59Z', false],
      ['19:00:00', '2026-10-25T18:00:00Z', true],
      ['23:59:59', '2026-10-25T22:59:59Z', true],
      ['00:00:00 the next day', '2026-10-25T23:00:00Z', false],
    ])('at %s local time is %s', (_, now, expected) => {
      expect(isEvening(at(now), WARSAW)).toBe(expected);
    });
  });

  it("uses the user's own timezone", () => {
    // 19:00 in New York is 01:00 the next night in Warsaw.
    const nyEvening = at('2026-11-12T00:00:00Z');
    expect(isEvening(nyEvening, NEW_YORK)).toBe(true);
    expect(isEvening(nyEvening, WARSAW)).toBe(false);
  });
});

describe('isLastDayOfWeek', () => {
  it.each([
    ['Saturday 23:59:59', '2026-11-14T22:59:59Z', false],
    ['Sunday 00:00:00', '2026-11-14T23:00:00Z', true],
    ['Sunday 23:59:59', '2026-11-15T22:59:59Z', true],
    ['Monday 00:00:00', '2026-11-15T23:00:00Z', false],
    ['Wednesday', '2026-11-11T18:00:00Z', false],
  ])('on %s local time is %s', (_, now, expected) => {
    expect(isLastDayOfWeek(at(now), WARSAW)).toBe(expected);
  });

  it.each([
    [
      'the 23-hour last Sunday of March',
      '2026-03-29T00:30:00Z',
      '2026-03-29T21:59:59Z',
    ],
    [
      'the 25-hour last Sunday of October',
      '2026-10-24T22:30:00Z',
      '2026-10-25T22:59:59Z',
    ],
  ])('holds for all of %s', (_, firstMinutes, lastSecond) => {
    expect(isLastDayOfWeek(at(firstMinutes), WARSAW)).toBe(true);
    expect(isLastDayOfWeek(at(lastSecond), WARSAW)).toBe(true);
  });

  it('holds on the Sunday that ends 2026-W53, in the next calendar year', () => {
    expect(isLastDayOfWeek(at('2027-01-03T12:00:00Z'), WARSAW)).toBe(true);
  });

  it("uses the user's own timezone", () => {
    // Sunday 20:00 in New York is already Monday 02:00 in Warsaw.
    const nySunday = at('2026-11-16T01:00:00Z');
    expect(isLastDayOfWeek(nySunday, NEW_YORK)).toBe(true);
    expect(isLastDayOfWeek(nySunday, WARSAW)).toBe(false);
  });
});

describe('cyclePayload', () => {
  const TODAY = '2026-11-11';
  const payload = (state: Partial<CycleState>) =>
    cyclePayload('DAILY', { ...NOTHING, ...state }, WED_19_00, WARSAW);

  it('is null without daily tasks', () => {
    expect(payload({})).toBeNull();
  });

  it('is null once every daily task is done', () => {
    expect(
      payload({
        tasks: [daily('pills'), daily('walk')],
        completions: doneIn(TODAY, 'pills', 'walk'),
      }),
    ).toBeNull();
  });

  it('counts the due tasks not done yet', () => {
    expect(
      payload({
        tasks: [daily('pills'), daily('walk'), daily('water')],
        completions: doneIn(TODAY, 'pills'),
      }),
    ).toEqual({ remaining: 2 });
  });

  it('does not count a completion from yesterday', () => {
    expect(
      payload({
        tasks: [daily('pills')],
        completions: doneIn('2026-11-10', 'pills'),
      }),
    ).toEqual({ remaining: 1 });
  });

  it('counts an unchecked task as not done', () => {
    expect(
      payload({
        tasks: [daily('pills')],
        completions: [{ taskId: 'pills', periodKey: TODAY, completedAt: null }],
      }),
    ).toEqual({ remaining: 1 });
  });

  it('leaves out a task added today: today is its spare day', () => {
    const addedToday = at('2026-11-11T08:00:00Z');
    expect(payload({ tasks: [daily('read', addedToday)] })).toBeNull();
    expect(
      payload({ tasks: [daily('pills'), daily('read', addedToday)] }),
    ).toEqual({ remaining: 1 });
  });

  it('is null once today is in the history, even if a task is open again', () => {
    expect(
      payload({ tasks: [daily('pills')], completedKeys: [TODAY] }),
    ).toBeNull();
  });

  describe('atRiskStreak', () => {
    it('is left out without a streak to lose', () => {
      expect(
        payload({ tasks: [daily('pills')], completedKeys: ['2026-11-09'] }),
      ).toEqual({ remaining: 1 });
    });

    it('is the streak up to yesterday, the same number as the statistics', () => {
      const completedKeys = ['2026-11-07', '2026-11-09', '2026-11-10'];

      expect(payload({ tasks: [daily('pills')], completedKeys })).toEqual({
        remaining: 1,
        atRiskStreak: { unit: 'DAY', length: 2 },
      });
      expect(currentDailyStreak(completedKeys, WED_19_00, WARSAW)).toBe(2);
    });

    it('counts weeks for the weekly reminder', () => {
      const state: CycleState = {
        tasks: [weekly('laundry')],
        completions: [],
        completedKeys: ['2026-W44', '2026-W45'],
      };

      expect(cyclePayload('WEEKLY', state, SUN_19_00, WARSAW)).toEqual({
        remaining: 1,
        atRiskStreak: { unit: 'WEEK', length: 2 },
      });
    });
  });
});

describe('buildReminders', () => {
  const openDay: CycleState = { ...NOTHING, tasks: [daily('pills')] };
  const openWeek: CycleState = { ...NOTHING, tasks: [weekly('laundry')] };

  it('shows nothing when there is nothing to remind of', () => {
    expect(buildReminders(input({}))).toEqual([]);
  });

  it.each([
    ['18:59:59', WED_18_59_59, []],
    ['19:00:00', WED_19_00, ['daily:2026-11-11']],
    ['23:59:59', WED_23_59_59, ['daily:2026-11-11']],
    ['00:00:00 the next day', THU_00_00, []],
  ])('shows the daily reminder at %s as %j', (_, now, keys) => {
    const reminders = buildReminders(input({ now, daily: openDay }));
    expect(reminders.map((r) => r.key)).toEqual(keys);
  });

  it('describes the daily reminder by type and numbers only', () => {
    expect(buildReminders(input({ daily: openDay }))).toEqual([
      {
        key: 'daily:2026-11-11',
        type: 'DAILY_EVENING',
        payload: { remaining: 1 },
      },
    ]);
  });

  it('does not show a confirmed reminder again that day, but does the next', () => {
    const shownKeys = new Set(['daily:2026-11-11']);

    expect(buildReminders(input({ daily: openDay, shownKeys }))).toEqual([]);
    expect(
      buildReminders(input({ now: THU_19_00, daily: openDay, shownKeys })),
    ).toEqual([
      {
        key: 'daily:2026-11-12',
        type: 'DAILY_EVENING',
        payload: { remaining: 1 },
      },
    ]);
  });

  it('shows the weekly reminder all Sunday, the daily one from 19:00', () => {
    const morning = buildReminders(
      input({
        now: at('2026-11-15T08:00:00Z'),
        daily: openDay,
        weekly: openWeek,
      }),
    );
    const evening = buildReminders(
      input({ now: SUN_19_00, daily: openDay, weekly: openWeek }),
    );

    expect(morning.map((r) => r.key)).toEqual(['weekly:2026-W46']);
    expect(evening.map((r) => [r.key, r.type])).toEqual([
      ['daily:2026-11-15', 'DAILY_EVENING'],
      ['weekly:2026-W46', 'WEEKLY_LAST_DAY'],
    ]);
  });

  it('does not show the weekly reminder before the last day', () => {
    expect(buildReminders(input({ weekly: openWeek }))).toEqual([]);
  });

  describe('friend requests', () => {
    it('gives one reminder per new request, each with the count of all', () => {
      expect(buildReminders(input({ pendingInviteIds: ['f2', 'f1'] }))).toEqual(
        [
          {
            key: 'friend_invite:f2',
            type: 'FRIEND_INVITE',
            payload: { count: 2 },
          },
          {
            key: 'friend_invite:f1',
            type: 'FRIEND_INVITE',
            payload: { count: 2 },
          },
        ],
      );
    });

    it('counts only the requests not confirmed yet', () => {
      const reminders = buildReminders(
        input({
          pendingInviteIds: ['f3', 'f2', 'f1'],
          shownKeys: new Set(['friend_invite:f2', 'friend_invite:f1']),
        }),
      );

      expect(reminders).toEqual([
        {
          key: 'friend_invite:f3',
          type: 'FRIEND_INVITE',
          payload: { count: 1 },
        },
      ]);
    });

    it('shows them at any hour', () => {
      const reminders = buildReminders(
        input({ now: at('2026-11-11T07:00:00Z'), pendingInviteIds: ['f1'] }),
      );
      expect(reminders).toHaveLength(1);
    });
  });

  it(`returns at most ${MAX_REMINDERS}, daily and weekly first, with the true count`, () => {
    const ids = Array.from({ length: 15 }, (_, i) => `f${15 - i}`);
    const reminders = buildReminders(
      input({
        now: SUN_19_00,
        daily: openDay,
        weekly: openWeek,
        pendingInviteIds: ids,
      }),
    );

    expect(reminders).toHaveLength(MAX_REMINDERS);
    expect(reminders.slice(0, 3).map((r) => r.key)).toEqual([
      'daily:2026-11-15',
      'weekly:2026-W46',
      'friend_invite:f15',
    ]);
    expect(reminders[2].payload).toEqual({ count: 15 });
  });

  it('puts only numbers into the payloads', () => {
    const reminders = buildReminders(
      input({
        now: SUN_19_00,
        daily: { ...openDay, completedKeys: ['2026-11-14'] },
        weekly: openWeek,
        pendingInviteIds: ['f1'],
      }),
    );
    const leaves = (value: unknown): unknown[] =>
      typeof value === 'object' && value !== null
        ? Object.values(value).flatMap(leaves)
        : [value];

    expect(reminders).toHaveLength(3);
    for (const { payload } of reminders) {
      const values = leaves(payload).filter((v) => v !== 'DAY' && v !== 'WEEK');
      expect(values.every((v) => typeof v === 'number')).toBe(true);
    }
  });
});
