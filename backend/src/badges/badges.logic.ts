import type {
  BadgeTier,
  CycleType,
  TaskType,
} from '../generated/prisma/client';
import { getPeriodKey, getPreviousPeriods } from '../common/period';
import {
  BADGES,
  isEventMetric,
  tierXp,
  type BadgeDefinition,
  type BadgeMetric,
} from './badges.config';

/**
 * The metric values measured for one evaluation. A metric that is missing
 * was not measured by this trigger, so badges that use it are skipped.
 */
export type Metrics = Partial<Record<BadgeMetric, number>>;

/** Same field names as a UserBadge row, so rows can be passed in as they are. */
export type EarnedTier = { badgeKey: string; tier: BadgeTier };

export type BadgeAward = { key: string; tier: BadgeTier; xp: number };

/**
 * Tiers whose threshold the metrics reach and that the user does not have
 * yet, in catalog order with the lowest tier first. Several tiers, also of
 * several badges, can be earned at once.
 */
export function newlyEarned(
  metrics: Metrics,
  earned: readonly EarnedTier[],
  catalog: readonly BadgeDefinition[] = BADGES,
): BadgeAward[] {
  const owned = new Set(earned.map((e) => `${e.badgeKey}|${e.tier}`));
  const awards: BadgeAward[] = [];

  for (const badge of catalog) {
    const value = metrics[badge.metric];
    if (value === undefined) continue;

    for (const rule of badge.tiers) {
      if (value >= rule.threshold && !owned.has(`${badge.key}|${rule.tier}`)) {
        awards.push({ key: badge.key, tier: rule.tier, xp: tierXp(rule) });
      }
    }
  }
  return awards;
}

/**
 * Completed periods in a row, counted back from the current one if it is
 * completed, otherwise from the previous one: an open period does not break
 * the streak until it is over. Counts at most `limit` periods.
 */
export function currentStreak(
  completedKeys: readonly string[],
  cycle: CycleType,
  now: Date,
  timezone: string,
  limit: number,
): number {
  const completed = new Set(completedKeys);
  // Non-null: DAILY and WEEKLY always have a period key.
  const current = getPeriodKey(cycle, now, timezone)!;

  const candidates = [
    ...(completed.has(current) ? [current] : []),
    ...getPreviousPeriods(cycle, now, timezone, limit).map((p) => p.key),
  ].slice(0, limit);

  let streak = 0;
  for (const key of candidates) {
    if (!completed.has(key)) break;
    streak++;
  }
  return streak;
}

export type TaskCompletedEvent = {
  taskType: TaskType;
  isOwnCategory: boolean;
  /** Every due task of the task's category is done in its current period. */
  categoryAllDone: boolean;
};

/**
 * The event badges as 0/1 metrics, so they go through the same
 * "metric >= threshold" rule as every other badge.
 */
export function taskEventMetrics(event: TaskCompletedEvent): Metrics {
  const { taskType, isOwnCategory, categoryAllDone } = event;
  return {
    lifeGoalCompleted: taskType === 'LIFE' ? 1 : 0,
    ownCategoryTaskCompleted: isOwnCategory ? 1 : 0,
    ownCategoryAllDone: isOwnCategory && categoryAllDone ? 1 : 0,
  };
}

export type EarnedBadge = EarnedTier & { earnedAt: Date };

export type AchievementTier = {
  tier: BadgeTier;
  threshold: number;
  xp: number;
  /** When the user earned this tier; null while not earned. */
  earnedAt: Date | null;
};

export type Achievement = {
  key: string;
  /**
   * The metric's value now; event badges show 1 once earned, else 0.
   * Streaks are counted up to the highest threshold only (365 days, 48
   * weeks), so a value at the top tier means "at least this many".
   */
  current: number;
  tiers: AchievementTier[];
};

/**
 * The achievements view: every badge of the catalog with its tiers, the
 * current value of its metric and when each tier was earned. Stored badges
 * that are no longer in the catalog are left out.
 */
export function buildAchievements(
  metrics: Metrics,
  earned: readonly EarnedBadge[],
  catalog: readonly BadgeDefinition[] = BADGES,
): Achievement[] {
  const earnedAt = new Map(
    earned.map((e) => [`${e.badgeKey}|${e.tier}`, e.earnedAt]),
  );

  return catalog.map((badge) => {
    const tiers = badge.tiers.map((rule) => ({
      tier: rule.tier,
      threshold: rule.threshold,
      xp: tierXp(rule),
      earnedAt: earnedAt.get(`${badge.key}|${rule.tier}`) ?? null,
    }));
    // An event is not stored anywhere but in the badge it earned.
    // Stryker disable next-line MethodExpression: equivalent mutant; event badges have a single tier (badges.config.spec), so some() and every() agree.
    const anyEarned = tiers.some((t) => t.earnedAt !== null);
    const current = isEventMetric(badge.metric)
      ? Number(anyEarned)
      : (metrics[badge.metric] ?? 0);

    return { key: badge.key, current, tiers };
  });
}

/**
 * The highest threshold among badges using `metric`: counting beyond it
 * cannot earn anything, so it bounds how much history has to be read.
 */
export function metricCap(
  metric: BadgeMetric,
  catalog: readonly BadgeDefinition[] = BADGES,
): number {
  const thresholds = catalog
    .filter((badge) => badge.metric === metric)
    .flatMap((badge) => badge.tiers.map((rule) => rule.threshold));
  return Math.max(0, ...thresholds);
}
