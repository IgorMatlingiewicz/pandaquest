import type { StreakGoal, StreakGoalTier } from "@/types/api";

/*
 * How a streak goal is shown, derived from the GET /streak-goals data alone.
 * Pure functions: the moment is always a parameter. All of this is for display
 * only; the server alone decides what a day is worth, whatever is shown here.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * What to add to the device clock to read the server's. A response arrives a
 * moment after it was made, so the result errs slightly behind the server:
 * the counter can lag, but it does not announce a day the server has not
 * reached yet.
 */
export function clockOffset(serverNow: string, deviceNowMs: number): number {
  return Date.parse(serverNow) - deviceNowMs;
}

// A new goal starts ahead of the lagging clock above, hence the 0.
function elapsedMs(startedAt: string, nowMs: number): number {
  return Math.max(0, nowMs - Date.parse(startedAt));
}

export function fullDaysAt(startedAt: string, nowMs: number): number {
  return Math.floor(elapsedMs(startedAt, nowMs) / DAY);
}

export type ElapsedParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function elapsedParts(startedAt: string, nowMs: number): ElapsedParts {
  const elapsed = elapsedMs(startedAt, nowMs);
  return {
    days: Math.floor(elapsed / DAY),
    hours: Math.floor((elapsed % DAY) / HOUR),
    minutes: Math.floor((elapsed % HOUR) / MINUTE),
    seconds: Math.floor((elapsed % MINUTE) / SECOND),
  };
}

/** Whether any goal completed a full day between the two moments. */
export function crossedFullDay(
  goals: readonly Pick<StreakGoal, "startedAt">[],
  fromMs: number,
  toMs: number,
): boolean {
  return goals.some(
    ({ startedAt }) =>
      fullDaysAt(startedAt, toMs) > fullDaysAt(startedAt, fromMs),
  );
}

export type TierProgress = {
  reached: number;
  /** The lowest tier not reached yet; null once every tier is reached. */
  next: StreakGoalTier | null;
  /** Toward `next` from zero days, from 0 to 1, like the achievements bar. */
  ratio: number;
};

/** The current attempt of one goal against the tiers, lowest first. */
export function tierProgress(
  fullDays: number,
  tiers: readonly StreakGoalTier[],
): TierProgress {
  const next = tiers.find((tier) => tier.threshold > fullDays) ?? null;
  return {
    reached: tiers.filter((tier) => tier.threshold <= fullDays).length,
    next,
    ratio: next ? fullDays / next.threshold : 1,
  };
}

export function randomIndex(
  length: number,
  random: () => number = Math.random,
): number {
  return Math.floor(random() * length);
}
