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
