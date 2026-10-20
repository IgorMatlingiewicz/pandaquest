import type { BadgeAward } from "@/types/api";

// Something big enough for a window the user has to close. Plain XP is a
// toast instead.
export type Reward =
  { kind: "badge"; badge: BadgeAward } | { kind: "levelUp"; level: number };

/**
 * The windows to show for one server response, in order: every badge it
 * earned, then a level-up if the level is now above the last one announced.
 * A jump of several levels at once is announced once, with the new level.
 */
export function rewardsToAnnounce(
  badges: readonly BadgeAward[],
  announcedLevel: number,
  currentLevel: number,
): Reward[] {
  const rewards: Reward[] = badges.map((badge) => ({ kind: "badge", badge }));
  if (currentLevel > announcedLevel) {
    rewards.push({ kind: "levelUp", level: currentLevel });
  }
  return rewards;
}
