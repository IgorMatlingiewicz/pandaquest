import type { LevelProgress } from "@/types/api";

/** What the level bar shows, worked out from the server's numbers. */
export type LevelBarView =
  | {
      isMax: false;
      level: number;
      /** 0-100, the filled part of the bar. */
      percent: number;
      current: number;
      total: number;
      /** XP still missing for the next level. */
      remaining: number;
      nextLevel: number;
    }
  | { isMax: true; level: number; percent: 100 };

export function levelBarView(progress: LevelProgress): LevelBarView {
  const { level, xpIntoLevel, xpForNextLevel } = progress;
  if (progress.isMax || xpForNextLevel === null) {
    return { isMax: true, level, percent: 100 };
  }
  // Clamped: a profile read in the middle of an award could be off by a
  // little, and a bar never goes past its ends.
  const current = Math.min(Math.max(xpIntoLevel, 0), xpForNextLevel);
  return {
    isMax: false,
    level,
    percent: xpForNextLevel > 0 ? (current / xpForNextLevel) * 100 : 0,
    current,
    total: xpForNextLevel,
    remaining: xpForNextLevel - current,
    nextLevel: level + 1,
  };
}
