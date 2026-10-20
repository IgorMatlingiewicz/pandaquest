import type { Achievement, AchievementTier } from "@/types/api";

/*
 * How one achievement is shown, derived from the GET /achievements data
 * alone. Pure functions: no React, no fetching, no translations.
 */

/** The lowest tier not earned yet; null once every tier is earned. */
export function nextTier(achievement: Achievement): AchievementTier | null {
  return achievement.tiers.find((tier) => tier.earnedAt === null) ?? null;
}

/** The highest tier earned so far; null before the first one. */
export function highestEarnedTier(
  achievement: Achievement,
): AchievementTier | null {
  const earned = achievement.tiers.filter((tier) => tier.earnedAt !== null);
  return earned[earned.length - 1] ?? null;
}

export type AchievementProgress =
  // Every tier earned (option c: "MAX" instead of a number that stops
  // counting at the top threshold).
  | { kind: "maxed" }
  // The next tier needs just one occurrence, so "0 / 1" would say nothing.
  | { kind: "notYet" }
  // Toward the next tier: `current` of `target`, `ratio` from 0 to 1.
  | { kind: "progress"; current: number; target: number; ratio: number };

export function achievementProgress(
  achievement: Achievement,
): AchievementProgress {
  const next = nextTier(achievement);
  if (!next) return { kind: "maxed" };
  if (next.threshold === 1) return { kind: "notYet" };

  // The value can already be at the threshold before the badge is stored,
  // e.g. categories created before badges existed: shown as full, not as
  // "8 / 7".
  const current = Math.min(achievement.current, next.threshold);
  return {
    kind: "progress",
    current,
    target: next.threshold,
    ratio: current / next.threshold,
  };
}

/**
 * The threshold the badge's description talks about: the next tier's, or
 * the top one's once all are earned ("Complete 365 days in a row").
 */
export function describedThreshold(achievement: Achievement): number {
  const tiers = achievement.tiers;
  return (nextTier(achievement) ?? tiers[tiers.length - 1]).threshold;
}
