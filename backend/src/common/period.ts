import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addWeeks,
  format,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfISOWeek,
} from 'date-fns';
import type { TaskType } from '../generated/prisma/client';

/**
 * Identifies the period a cyclic task's state belongs to, in the user's
 * timezone. A new key means the task has "reset". Non-cyclic types have none.
 */
export function getPeriodKey(
  type: TaskType,
  now: Date,
  timezone: string,
): string | null {
  if (type !== 'DAILY' && type !== 'WEEKLY') return null;

  const zoned = new TZDate(now.getTime(), timezone);

  if (type === 'DAILY') {
    return format(zoned, 'yyyy-MM-dd');
  }

  // ISO week-numbering year, not the calendar year: 2027-01-01 is 2026-W53.
  const week = String(getISOWeek(zoned)).padStart(2, '0');
  return `${getISOWeekYear(zoned)}-W${week}`;
}

/**
 * The instant the current period ends (and the next one starts): the next
 * local midnight for DAILY, the next local Monday midnight for WEEKLY.
 */
export function getPeriodEnd(
  type: TaskType,
  now: Date,
  timezone: string,
): Date | null {
  if (type !== 'DAILY' && type !== 'WEEKLY') return null;

  const zoned = new TZDate(now.getTime(), timezone);
  const end =
    type === 'DAILY'
      ? startOfDay(addDays(zoned, 1))
      : startOfISOWeek(addWeeks(zoned, 1));

  return new Date(end.getTime());
}

export type Period = { key: string; start: Date };

/**
 * The instant the period containing `now` started: the last local midnight
 * for DAILY, the last local Monday midnight for WEEKLY.
 */
export function getPeriodStart(
  type: TaskType,
  now: Date,
  timezone: string,
): Date | null {
  if (type !== 'DAILY' && type !== 'WEEKLY') return null;

  const zoned = new TZDate(now.getTime(), timezone);
  const start = type === 'DAILY' ? startOfDay(zoned) : startOfISOWeek(zoned);

  return new Date(start.getTime());
}

/**
 * The periods before the one containing `now`, newest first, without end.
 * Lazy: each period is worked out only when the caller asks for the next
 * one, so a caller that stops early pays only for what it read.
 * Steps back to "1 ms before the current start" instead of subtracting
 * 24 h or 7 days, so 23- and 25-hour DST days need no special case.
 */
export function* periodsBefore(
  type: TaskType,
  now: Date,
  timezone: string,
): Generator<Period> {
  if (type !== 'DAILY' && type !== 'WEEKLY') return;

  // Non-null: the type is cyclic, checked above.
  let start = getPeriodStart(type, now, timezone)!;
  for (;;) {
    const inPrevious = new Date(start.getTime() - 1);
    start = getPeriodStart(type, inPrevious, timezone)!;
    yield { key: getPeriodKey(type, inPrevious, timezone)!, start };
  }
}

/** The `count` periods right before the one containing `now`, newest first. */
export function getPreviousPeriods(
  type: TaskType,
  now: Date,
  timezone: string,
  count: number,
): Period[] {
  const periods: Period[] = [];
  if (count <= 0) return periods;
  for (const period of periodsBefore(type, now, timezone)) {
    periods.push(period);
    if (periods.length === count) break;
  }
  return periods;
}
