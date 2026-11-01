import type { BadgeTier, CycleType } from '../generated/prisma/client';

/*
 * Badge catalog: the single source of truth for which badges exist, what
 * earns them and what they are worth. The database stores only the tiers a
 * user has earned (UserBadge), by `key`; names and descriptions live in the
 * client's translation files under the same key.
 *
 * Every badge follows one rule: a tier is earned once its metric reaches the
 * tier's threshold (metric >= threshold).
 *
 * Deliberate decision: no protection against cheating beyond what already
 * exists. Badges unlock nothing except the XP they add toward the level, so
 * their worth comes from the user being honest with themselves. Guarding
 * them harder would add complexity without protecting anything of value.
 */

/**
 * Counted from the user's data: CompletedPeriod rows, categories, and the
 * full days of the longest running streak goal attempt.
 */
export type CounterMetric =
  | 'dailyTotal'
  | 'dailyStreak'
  | 'weeklyTotal'
  | 'weeklyStreak'
  | 'ownCategoryCount'
  | 'streakGoalDays';

/** The two metrics each cycle's CompletedPeriod rows are counted into. */
export const CYCLE_METRICS: Record<
  CycleType,
  { total: CounterMetric; streak: CounterMetric }
> = {
  DAILY: { total: 'dailyTotal', streak: 'dailyStreak' },
  WEEKLY: { total: 'weeklyTotal', streak: 'weeklyStreak' },
};

/** 0 or 1, read from the event that triggered the evaluation. */
export const EVENT_METRICS = [
  'lifeGoalCompleted',
  'ownCategoryTaskCompleted',
  'ownCategoryAllDone',
] as const;

export type EventMetric = (typeof EVENT_METRICS)[number];

export type BadgeMetric = CounterMetric | EventMetric;

export function isEventMetric(metric: BadgeMetric): metric is EventMetric {
  return (EVENT_METRICS as readonly string[]).includes(metric);
}

export type BadgeTierRule = {
  tier: BadgeTier;
  threshold: number;
  /** Overrides BADGE_XP for this tier (e.g. first_day, too easy for 50). */
  xp?: number;
};

export type BadgeDefinition = {
  key: string;
  metric: BadgeMetric;
  /** Lowest tier first. A single-tier badge names its tier explicitly. */
  tiers: readonly BadgeTierRule[];
};

/** XP for earning a tier: fixed, without a streak multiplier, once per account. */
export const BADGE_XP: Record<BadgeTier, number> = {
  BRONZE: 50,
  SILVER: 150,
  GOLD: 400,
  DIAMOND: 1000,
};

export const BADGES: readonly BadgeDefinition[] = [
  {
    key: 'daily_total',
    metric: 'dailyTotal',
    tiers: [
      { tier: 'BRONZE', threshold: 30 },
      { tier: 'SILVER', threshold: 100 },
      { tier: 'GOLD', threshold: 500 },
      { tier: 'DIAMOND', threshold: 1000 },
    ],
  },
  {
    key: 'daily_streak',
    metric: 'dailyStreak',
    tiers: [
      { tier: 'BRONZE', threshold: 10 },
      { tier: 'SILVER', threshold: 30 },
      { tier: 'GOLD', threshold: 100 },
      { tier: 'DIAMOND', threshold: 365 },
    ],
  },
  {
    key: 'weekly_total',
    metric: 'weeklyTotal',
    tiers: [
      { tier: 'BRONZE', threshold: 10 },
      { tier: 'SILVER', threshold: 25 },
      { tier: 'GOLD', threshold: 50 },
      { tier: 'DIAMOND', threshold: 100 },
    ],
  },
  {
    key: 'weekly_streak',
    metric: 'weeklyStreak',
    tiers: [
      { tier: 'BRONZE', threshold: 4 },
      { tier: 'SILVER', threshold: 12 },
      { tier: 'GOLD', threshold: 24 },
      { tier: 'DIAMOND', threshold: 48 },
    ],
  },
  {
    key: 'life_goal',
    metric: 'lifeGoalCompleted',
    tiers: [{ tier: 'DIAMOND', threshold: 1 }],
  },
  {
    key: 'first_day',
    metric: 'dailyTotal',
    tiers: [{ tier: 'BRONZE', threshold: 1, xp: 25 }],
  },
  {
    key: 'first_week',
    metric: 'weeklyTotal',
    tiers: [{ tier: 'BRONZE', threshold: 1 }],
  },
  {
    key: 'own_category_first_task',
    metric: 'ownCategoryTaskCompleted',
    tiers: [{ tier: 'BRONZE', threshold: 1 }],
  },
  {
    key: 'own_category_all_done',
    metric: 'ownCategoryAllDone',
    tiers: [{ tier: 'SILVER', threshold: 1 }],
  },
  {
    // "Dużo na głowie": counts the user's own categories that exist now.
    key: 'many_categories',
    metric: 'ownCategoryCount',
    tiers: [{ tier: 'SILVER', threshold: 7 }],
  },
  {
    // One badge across all streak goals: a tier is earned by the first goal
    // to reach it, and a second goal reaching it earns nothing more.
    key: 'streak_days',
    metric: 'streakGoalDays',
    tiers: [
      { tier: 'BRONZE', threshold: 7 },
      { tier: 'SILVER', threshold: 30 },
      { tier: 'GOLD', threshold: 100 },
      { tier: 'DIAMOND', threshold: 365 },
    ],
  },
  // Planned, not added yet because its module does not exist:
  // - tutorial: BRONZE for finishing the onboarding tutorial (event).
];

/** What earning this tier is worth: its own override, else the XP table. */
export function tierXp(rule: BadgeTierRule): number {
  return rule.xp ?? BADGE_XP[rule.tier];
}
