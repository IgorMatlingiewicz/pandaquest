import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { currentStreak } from '../badges/badges.logic';
import {
  getPeriodKey,
  getPeriodStart,
  getPreviousPeriods,
} from '../common/period';
import type { XpSource } from '../generated/prisma/client';
import { ACTIVITY_WEEKS, XP_WEEKS } from './stats.config';

/*
 * The statistics screen, computed from append-only rows: XP events and
 * completed periods outlive the tasks they came from. Pure functions: the
 * moment and the timezone are parameters, and every day, week and month is
 * the user's local one, keyed by the same helpers as the rest of the app.
 */

export type StatsEvent = { createdAt: Date; amount: number; source: XpSource };

export type ActivityDay = {
  date: string;
  /** Task completions that day: one XP event of source TASK each. */
  completions: number;
  /** Every daily task was completed that day. */
  fullDay: boolean;
};

export type WeekXp = { weekKey: string; weekStart: string; xp: number };

export type StatsSummary = {
  fullDaysTotal: number;
  currentStreak: number;
  longestStreak: number;
  xpThisMonth: number;
  completionsThisMonth: number;
};

export type Stats = {
  serverNow: string;
  timezone: string;
  activity: { days: ActivityDay[] };
  weeklyXp: WeekXp[];
  summary: StatsSummary;
};

// Non-null: DAILY and WEEKLY always have a key and a start.
const dayKey = (at: Date, timezone: string) =>
  getPeriodKey('DAILY', at, timezone)!;
const weekKey = (at: Date, timezone: string) =>
  getPeriodKey('WEEKLY', at, timezone)!;

/**
 * The day after a 'yyyy-MM-dd' key. Counted on the calendar in UTC, which
 * has no clock changes, so 23- and 25-hour days need no special case.
 */
export function nextDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

/** Every day key from `fromKey` to `toKey`, both included. */
export function dayKeysBetween(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  // Zero-padded keys sort as the days they name.
  for (let key = fromKey; key <= toKey; key = nextDayKey(key)) {
    keys.push(key);
  }
  return keys;
}

export function monthKey(at: Date, timezone: string): string {
  return format(new TZDate(at.getTime(), timezone), 'yyyy-MM');
}

/**
 * Local midnight of the Monday that opens the activity window: the current
 * week and the ACTIVITY_WEEKS - 1 weeks before it.
 */
export function activityWindowStart(now: Date, timezone: string): Date {
  const weeks = getPreviousPeriods('WEEKLY', now, timezone, ACTIVITY_WEEKS - 1);
  return weeks[weeks.length - 1].start;
}

/** One entry per day of the window, up to today, days without events too. */
export function activityDays(
  events: readonly StatsEvent[],
  fullDayKeys: readonly string[],
  now: Date,
  timezone: string,
): ActivityDay[] {
  const completions = new Map<string, number>();
  for (const event of events) {
    if (event.source !== 'TASK') continue;
    const key = dayKey(event.createdAt, timezone);
    completions.set(key, (completions.get(key) ?? 0) + 1);
  }
  const full = new Set(fullDayKeys);

  const first = dayKey(activityWindowStart(now, timezone), timezone);
  return dayKeysBetween(first, dayKey(now, timezone)).map((date) => ({
    date,
    completions: completions.get(date) ?? 0,
    fullDay: full.has(date),
  }));
}

/** XP of every source per week, the current week last, empty weeks at 0. */
export function weeklyXp(
  events: readonly StatsEvent[],
  now: Date,
  timezone: string,
): WeekXp[] {
  const totals = new Map<string, number>();
  for (const event of events) {
    const key = weekKey(event.createdAt, timezone);
    totals.set(key, (totals.get(key) ?? 0) + event.amount);
  }

  const weeks = [
    ...getPreviousPeriods('WEEKLY', now, timezone, XP_WEEKS - 1).reverse(),
    {
      key: weekKey(now, timezone),
      start: getPeriodStart('WEEKLY', now, timezone)!,
    },
  ];
  return weeks.map(({ key, start }) => ({
    weekKey: key,
    weekStart: dayKey(start, timezone),
    xp: totals.get(key) ?? 0,
  }));
}

/** The current local month: XP of every source, completions of tasks only. */
export function monthTotals(
  events: readonly StatsEvent[],
  now: Date,
  timezone: string,
): Pick<StatsSummary, 'xpThisMonth' | 'completionsThisMonth'> {
  const month = monthKey(now, timezone);
  let xpThisMonth = 0;
  let completionsThisMonth = 0;
  for (const event of events) {
    if (monthKey(event.createdAt, timezone) !== month) continue;
    xpThisMonth += event.amount;
    if (event.source === 'TASK') completionsThisMonth++;
  }
  return { xpThisMonth, completionsThisMonth };
}

/** The most consecutive calendar days among `dayKeys`, in any order. */
export function longestStreak(dayKeys: readonly string[]): number {
  const days = [...new Set(dayKeys)].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of days) {
    run = previous !== null && nextDayKey(previous) === key ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }
  return longest;
}

/**
 * The same count as the daily_streak badge, from the same function: an open
 * today does not break the streak yet. The badge stops counting at its top
 * threshold; the statistics do not, so the limit is the number of completed
 * days, which no streak can exceed.
 */
export function currentDailyStreak(
  fullDayKeys: readonly string[],
  now: Date,
  timezone: string,
): number {
  return currentStreak(fullDayKeys, 'DAILY', now, timezone, fullDayKeys.length);
}

export function buildStats(input: {
  events: readonly StatsEvent[];
  fullDayKeys: readonly string[];
  now: Date;
  timezone: string;
}): Stats {
  const { events, fullDayKeys, now, timezone } = input;
  return {
    serverNow: now.toISOString(),
    timezone,
    activity: { days: activityDays(events, fullDayKeys, now, timezone) },
    weeklyXp: weeklyXp(events, now, timezone),
    summary: {
      // One row per day: the unique index rules out duplicates.
      fullDaysTotal: fullDayKeys.length,
      currentStreak: currentDailyStreak(fullDayKeys, now, timezone),
      longestStreak: longestStreak(fullDayKeys),
      ...monthTotals(events, now, timezone),
    },
  };
}
