/*
 * The time rules of streak goals. Pure functions: the current time always
 * comes in as a parameter, so tests can move it freely. A "full day" is
 * 24 hours of elapsed time, not a calendar day, so midnight, time zones and
 * daylight saving do not matter.
 *
 * The clamps at 0 cover the server clock moving back (e.g. after an NTP
 * correction), the one way "now" can be earlier than a stored time.
 */

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 24 * 60 * 60 * MS_PER_SECOND;

const elapsedMs = (from: Date, to: Date) =>
  Math.max(0, to.getTime() - from.getTime());

/** Whole 24-hour days between the start of an attempt and `now`. */
export function fullDaysElapsed(startedAt: Date, now: Date): number {
  return Math.floor(elapsedMs(startedAt, now) / MS_PER_DAY);
}

/** Full days not paid in XP yet; several after a longer absence. */
export function payableDays(fullDays: number, daysRewarded: number): number {
  return Math.max(0, fullDays - daysRewarded);
}

/** The moment an attempt reaches `days` full days. */
export function milestoneMoment(startedAt: Date, days: number): Date {
  return new Date(startedAt.getTime() + days * MS_PER_DAY);
}

/**
 * The goal whose current attempt started first. It has the most full days,
 * and it was the first to reach any threshold, so one goal answers both what
 * a badge's metric is and when the badge was earned.
 */
export function longestRunning<T extends { startedAt: Date }>(
  goals: readonly T[],
): T | null {
  return goals.reduce<T | null>(
    (best, goal) =>
      best === null || goal.startedAt.getTime() < best.startedAt.getTime()
        ? goal
        : best,
    null,
  );
}

/** How long an attempt lasted, in whole seconds. */
export function attemptDurationSec(startedAt: Date, endedAt: Date): number {
  return Math.floor(elapsedMs(startedAt, endedAt) / MS_PER_SECOND);
}

/** The longest attempt of a goal; null means none was closed yet. */
export function recordSec(
  longestClosedSec: number | null,
  currentSec: number,
): number {
  return Math.max(longestClosedSec ?? 0, currentSec);
}
