import type { TaskType } from '../generated/prisma/client';

/**
 * Level curve: going from level n to n+1 costs BASE * GROWTH^(n-1) XP.
 * Thresholds are cumulative sums rounded to ROUND_TO.
 */
export const LEVEL_CURVE = {
  BASE: 100,
  GROWTH: 1.0432,
  MAX_LEVEL: 100,
  ROUND_TO: 10,
} as const;

/** XP for completing a top-level task, before the streak multiplier. */
export const BASE_XP: Record<TaskType, number> = {
  DAILY: 10,
  WEEKLY: 30,
  LIFE: 1000,
  SIDE_QUEST: 20,
};

type StreakRule = { step: number; maxMultiplier: number; lookback: number };

/**
 * Streak bonus: multiplier = min(maxMultiplier, 1 + step * S), where S is
 * the number of full periods in a row before the current one, counted at
 * most `lookback` periods back. Types without a rule always get x1.0.
 */
export const STREAK_RULES: Partial<Record<TaskType, StreakRule>> = {
  DAILY: { step: 0.1, maxMultiplier: 2.0, lookback: 10 },
  WEEKLY: { step: 0.25, maxMultiplier: 2.0, lookback: 4 },
};

/** XpEvent.periodKey for types awarded once per task lifetime. */
export const LIFETIME_PERIOD_KEY = 'LIFETIME';
