import {
  achievementProgress,
  describedThreshold,
  highestEarnedTier,
  nextTier,
} from "@/lib/achievements";
import type { Achievement, AchievementTier, BadgeTier } from "@/types/api";

const EARNED_AT = "2026-10-14T06:00:00.000Z";

const tier = (
  name: BadgeTier,
  threshold: number,
  earned = false,
): AchievementTier => ({
  tier: name,
  threshold,
  xp: 50,
  earnedAt: earned ? EARNED_AT : null,
});

const achievement = (
  current: number,
  ...tiers: AchievementTier[]
): Achievement => ({ key: "daily_streak", current, tiers });

describe("nextTier", () => {
  it("is the lowest tier not earned yet", () => {
    const a = achievement(
      12,
      tier("BRONZE", 10, true),
      tier("SILVER", 30),
      tier("GOLD", 100),
    );

    expect(nextTier(a)?.tier).toBe("SILVER");
  });

  it("is null once every tier is earned", () => {
    expect(nextTier(achievement(10, tier("BRONZE", 10, true)))).toBeNull();
  });
});

describe("highestEarnedTier", () => {
  it("is null before the first tier", () => {
    expect(highestEarnedTier(achievement(0, tier("BRONZE", 10)))).toBeNull();
  });

  it("is the last earned tier, not the first", () => {
    const a = achievement(
      40,
      tier("BRONZE", 10, true),
      tier("SILVER", 30, true),
      tier("GOLD", 100),
    );

    expect(highestEarnedTier(a)?.tier).toBe("SILVER");
  });
});

describe("achievementProgress", () => {
  it("is maxed once every tier is earned", () => {
    const a = achievement(365, tier("DIAMOND", 365, true));

    expect(achievementProgress(a)).toEqual({ kind: "maxed" });
  });

  it("says nothing numeric for a one-time badge", () => {
    expect(achievementProgress(achievement(0, tier("DIAMOND", 1)))).toEqual({
      kind: "notYet",
    });
  });

  it("measures progress toward the next tier", () => {
    const a = achievement(12, tier("BRONZE", 10, true), tier("SILVER", 30));

    expect(achievementProgress(a)).toEqual({
      kind: "progress",
      current: 12,
      target: 30,
      ratio: 0.4,
    });
  });

  it("shows a reached but not stored tier as full, not as 8 / 7", () => {
    expect(achievementProgress(achievement(8, tier("SILVER", 7)))).toEqual({
      kind: "progress",
      current: 7,
      target: 7,
      ratio: 1,
    });
  });
});

describe("describedThreshold", () => {
  it("is the next tier's threshold", () => {
    const a = achievement(12, tier("BRONZE", 10, true), tier("SILVER", 30));

    expect(describedThreshold(a)).toBe(30);
  });

  it("is the top threshold once every tier is earned", () => {
    const a = achievement(
      365,
      tier("BRONZE", 10, true),
      tier("DIAMOND", 365, true),
    );

    expect(describedThreshold(a)).toBe(365);
  });
});
