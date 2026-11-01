import { BADGES } from '../badges/badges.config';
import { STREAK_GOAL_DAY_XP } from '../xp/xp.config';

/** Active goals one user can have at a time. */
export const MAX_STREAK_GOALS = 5;

/** Longest goal name, counted after trimming. */
export const STREAK_GOAL_NAME_MAX_LENGTH = 40;

/** Sent with the goals, so the app shows these rules without copying them. */
export const STREAK_GOAL_RULES = {
  maxGoals: MAX_STREAK_GOALS,
  nameMaxLength: STREAK_GOAL_NAME_MAX_LENGTH,
  dayXp: STREAK_GOAL_DAY_XP,
  tiers: BADGES.find((badge) => badge.key === 'streak_days')!.tiers.map(
    ({ tier, threshold }) => ({ tier, threshold }),
  ),
};
