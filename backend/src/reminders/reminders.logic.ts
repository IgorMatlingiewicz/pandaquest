import { TZDate } from '@date-fns/tz';
import {
  doneSet,
  undoneDueTasks,
  type FullPeriodTask,
  type PeriodCompletion,
} from '../common/full-period';
import { getPeriodEnd, getPeriodKey, getPeriodStart } from '../common/period';
import type { CycleType } from '../generated/prisma/client';
import { streakWithoutCap } from '../stats/stats.logic';
import {
  EVENING_REMINDER_HOUR,
  MAX_REMINDERS,
  SHOWN_RETENTION_DAYS,
} from './reminders.config';

/*
 * In-app reminders, worked out when the app asks: no job runs in the
 * background. Pure functions: the moment and the timezone are parameters,
 * and every day and week is the user's local one, keyed by the same helpers
 * as tasks and statistics. Payloads hold only numbers; the app writes the
 * text, and no task, category, streak goal or friend is ever named.
 */

export type ReminderType =
  'DAILY_EVENING' | 'WEEKLY_LAST_DAY' | 'FRIEND_INVITE';

/** The streak that ends unless the current period becomes full. */
export type AtRiskStreak = { unit: 'DAY' | 'WEEK'; length: number };

/** What is left of the current day or week. */
export type CyclePayload = {
  /** Due tasks not done yet. */
  remaining: number;
  /** Only when there is a streak to lose, at least 1 period long. */
  atRiskStreak?: AtRiskStreak;
};

export type Reminder =
  | { key: string; type: 'DAILY_EVENING'; payload: CyclePayload }
  | { key: string; type: 'WEEKLY_LAST_DAY'; payload: CyclePayload }
  | { key: string; type: 'FRIEND_INVITE'; payload: { count: number } };

/** One cycle type of a user, as the database holds it. */
export type CycleState = {
  /** Top-level tasks of this type; subtasks do not count, as everywhere. */
  tasks: readonly FullPeriodTask[];
  /** Their completions in the current period. */
  completions: readonly PeriodCompletion[];
  /** Keys of the CompletedPeriod rows of this type. */
  completedKeys: readonly string[];
};

/** A friend request waiting for the user's answer. */
export type PendingInvite = {
  id: string;
  /** When it was sent: Friendship.createdAt, set again by a re-send. */
  sentAt: Date;
};

export type ReminderInput = {
  now: Date;
  timezone: string;
  daily: CycleState;
  weekly: CycleState;
  /** Incoming friend requests still PENDING, newest first. */
  pendingInvites: readonly PendingInvite[];
  /** Keys the user has already confirmed (ReminderShown rows). */
  shownKeys: ReadonlySet<string>;
};

const UNIT: Record<CycleType, AtRiskStreak['unit']> = {
  DAILY: 'DAY',
  WEEKLY: 'WEEK',
};

// Non-null: DAILY and WEEKLY always have a key, a start and an end.
const periodKey = (cycle: CycleType, now: Date, timezone: string) =>
  getPeriodKey(cycle, now, timezone)!;

export const dailyKey = (now: Date, timezone: string) =>
  `daily:${periodKey('DAILY', now, timezone)}`;
export const weeklyKey = (now: Date, timezone: string) =>
  `weekly:${periodKey('WEEKLY', now, timezone)}`;
/**
 * One key per sending, not per friendship: a pair of users has one
 * Friendship row for good, and asking again after a decline puts the same
 * row (the same id) back to PENDING with a new createdAt. With the id alone
 * the confirmed key of the first request would hide the reminder of the
 * new one. The moment, in milliseconds as stored, tells the two apart.
 */
export const friendInviteKey = (invite: PendingInvite) =>
  `friend_invite:${invite.id}:${invite.sentAt.getTime()}`;

/**
 * Every key the three builders above can make, and nothing else: the shape
 * POST /reminders/ack accepts. Only the shape is checked, not that the day
 * or the friend request exists; a key nobody is shown hides nothing.
 */
export const REMINDER_KEY_PATTERN =
  /^(daily:\d{4}-\d{2}-\d{2}|weekly:\d{4}-W\d{2}|friend_invite:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{1,15})$/;

/** Confirmed keys from before this instant may be removed. */
export function shownCutoff(now: Date): Date {
  // Plain milliseconds: "about a month ago" needs no calendar or timezone.
  return new Date(now.getTime() - SHOWN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** From EVENING_REMINDER_HOUR local time until midnight. */
export function isEvening(now: Date, timezone: string): boolean {
  return (
    new TZDate(now.getTime(), timezone).getHours() >= EVENING_REMINDER_HOUR
  );
}

/**
 * The last local day of the week: the day of the moment just before the
 * next week starts. Derived from the week itself rather than written as
 * "Sunday", so it follows wherever the week is defined to start.
 */
export function isLastDayOfWeek(now: Date, timezone: string): boolean {
  const lastMoment = new Date(
    getPeriodEnd('WEEKLY', now, timezone)!.getTime() - 1,
  );
  return (
    periodKey('DAILY', lastMoment, timezone) ===
    periodKey('DAILY', now, timezone)
  );
}

/**
 * What is left of the current period, or null when there is nothing to
 * remind of: no due task, every due task done, or the period already in the
 * history (CompletedPeriod rows are only added, so a period that was full
 * once stays full even after a task is added or unchecked).
 */
export function cyclePayload(
  cycle: CycleType,
  state: CycleState,
  now: Date,
  timezone: string,
): CyclePayload | null {
  const key = periodKey(cycle, now, timezone);
  if (state.completedKeys.includes(key)) return null;

  const window = { key, start: getPeriodStart(cycle, now, timezone)! };
  const remaining = undoneDueTasks(
    state.tasks,
    doneSet(state.completions),
    () => window,
  ).length;
  if (remaining === 0) return null;

  // The current period is not in the history (checked above), so the
  // streak ends with the previous one: "without today", as on the screen.
  const length = streakWithoutCap(state.completedKeys, cycle, now, timezone);
  return length > 0
    ? { remaining, atRiskStreak: { unit: UNIT[cycle], length } }
    : { remaining };
}

/**
 * The reminders the user has not confirmed yet: the daily one, the weekly
 * one, then one per new friend request, newest first, at most MAX_REMINDERS.
 * Each friend request reminder carries the count of every new one, so the
 * app can show a single message for all of them.
 */
export function buildReminders(input: ReminderInput): Reminder[] {
  const { now, timezone, shownKeys } = input;
  const reminders: Reminder[] = [];

  if (isEvening(now, timezone)) {
    const payload = cyclePayload('DAILY', input.daily, now, timezone);
    if (payload) {
      reminders.push({
        key: dailyKey(now, timezone),
        type: 'DAILY_EVENING',
        payload,
      });
    }
  }

  if (isLastDayOfWeek(now, timezone)) {
    const payload = cyclePayload('WEEKLY', input.weekly, now, timezone);
    if (payload) {
      reminders.push({
        key: weeklyKey(now, timezone),
        type: 'WEEKLY_LAST_DAY',
        payload,
      });
    }
  }

  const newInviteKeys = input.pendingInvites
    .map(friendInviteKey)
    .filter((key) => !shownKeys.has(key));
  for (const key of newInviteKeys) {
    reminders.push({
      key,
      type: 'FRIEND_INVITE',
      payload: { count: newInviteKeys.length },
    });
  }

  return reminders
    .filter((reminder) => !shownKeys.has(reminder.key))
    .slice(0, MAX_REMINDERS);
}
