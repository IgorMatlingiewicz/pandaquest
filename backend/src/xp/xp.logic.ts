import type { TaskType } from '../generated/prisma/client';
import { getPreviousPeriods } from '../common/period';
import { BASE_XP, LEVEL_CURVE, STREAK_RULES } from './xp.config';

export type LevelCurve = {
  BASE: number;
  GROWTH: number;
  MAX_LEVEL: number;
  ROUND_TO: number;
};

export type LevelProgress = {
  level: number;
  /** XP earned since the current level started. */
  xpIntoLevel: number;
  /** XP the current level spans; null at MAX_LEVEL. */
  xpForNextLevel: number | null;
  isMax: boolean;
};

/**
 * table[i] is the total XP needed to reach level i + 1, so table[0] = 0.
 * Each threshold is rounded once here, and every lookup reads the same
 * rounded values.
 */
export function buildLevelTable(curve: LevelCurve = LEVEL_CURVE): number[] {
  const { BASE, GROWTH, MAX_LEVEL, ROUND_TO } = curve;
  const table = [0];
  let sum = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    sum += BASE * GROWTH ** (level - 1);
    table.push(Math.round(sum / ROUND_TO) * ROUND_TO);
  }
  return table;
}

const LEVEL_TABLE: readonly number[] = buildLevelTable();

export function levelForXp(
  xp: number,
  table: readonly number[] = LEVEL_TABLE,
): number {
  let level = 1;
  while (level < table.length && table[level] <= xp) level++;
  return level;
}

export function levelProgress(
  xp: number,
  table: readonly number[] = LEVEL_TABLE,
): LevelProgress {
  const level = levelForXp(xp, table);
  const start = table[level - 1];
  const isMax = level === table.length;
  return {
    level,
    xpIntoLevel: xp - start,
    xpForNextLevel: isMax ? null : table[level] - start,
    isMax,
  };
}

export type StreakTask = {
  id: string;
  type: TaskType;
  parentTaskId: string | null;
  createdAt: Date;
};

export type StreakCompletion = {
  taskId: string;
  periodKey: string;
  completedAt: Date | null;
};

/**
 * Full periods in a row right before the one containing `now`. A period is
 * full when at least one top-level task of `type` was due in it and every
 * due task was completed. A task is due only in periods that start after
 * it was created, so the day (or week) it is added is a free one.
 */
export function computeStreak(
  tasks: StreakTask[],
  completions: StreakCompletion[],
  now: Date,
  timezone: string,
  type: TaskType,
): number {
  const rule = STREAK_RULES[type];
  if (!rule) return 0;

  const candidates = tasks.filter(
    (t) => t.type === type && t.parentTaskId === null,
  );
  const done = new Set(
    completions
      .filter((c) => c.completedAt !== null)
      .map((c) => `${c.taskId}|${c.periodKey}`),
  );

  let streak = 0;
  for (const period of getPreviousPeriods(type, now, timezone, rule.lookback)) {
    const due = candidates.filter(
      (t) => t.createdAt.getTime() < period.start.getTime(),
    );
    const full =
      due.length > 0 && due.every((t) => done.has(`${t.id}|${period.key}`));
    if (!full) break;
    streak++;
  }
  return streak;
}

/** min(maxMultiplier, 1 + step * streak); x1 for types without a rule. */
export function streakMultiplier(type: TaskType, streak: number): number {
  const rule = STREAK_RULES[type];
  if (!rule) return 1;

  const multiplier = Math.min(rule.maxMultiplier, 1 + rule.step * streak);
  // Two decimals: 1 + 0.1 * 7 is 1.7000000000000002 in floating point.
  return Math.round(multiplier * 100) / 100;
}

/** What one completion of a top-level task is worth at the given streak. */
export function xpForCompletion(type: TaskType, streak: number) {
  const baseXp = BASE_XP[type];
  const multiplier = streakMultiplier(type, streak);
  return { baseXp, multiplier, amount: Math.round(baseXp * multiplier) };
}
