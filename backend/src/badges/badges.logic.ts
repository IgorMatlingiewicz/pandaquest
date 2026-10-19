import type { BadgeTier, CycleType } from '../generated/prisma/client';
import { getPeriodKey, getPreviousPeriods } from '../common/period';
import {
  BADGES,
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
