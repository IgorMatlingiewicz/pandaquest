// Shapes of the backend responses the app reads, kept in step with
// backend/src by hand.

// The xpAward field of PATCH /tasks/:id and of the streak goal responses.
export type XpAward = {
  amount: number;
  baseXp: number;
  multiplier: number;
  leveledUp: boolean;
  level: number;
};

export type BadgeTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

// One badge tier earned by a request.
export type BadgeAward = { key: string; tier: BadgeTier; xp: number };

// One tier in GET /achievements; earnedAt is an ISO date, null until earned.
export type AchievementTier = {
  tier: BadgeTier;
  threshold: number;
  xp: number;
  earnedAt: string | null;
};

// One badge in GET /achievements. Tiers come lowest first; `current` is the
// metric's value now (event badges: 1 once earned, else 0; streaks counted
// up to the highest threshold only).
export type Achievement = {
  key: string;
  current: number;
  tiers: AchievementTier[];
};

// One badge tier the user earned, as the profile showcase and the badge
// picker show it (FavoriteSlot in backend/src/profile).
export type EarnedBadge = {
  badgeKey: string;
  tier: BadgeTier;
  earnedAt: string;
};

// One slot of PUT /profile/favorite-badges; null there is an empty slot.
export type FavoritePick = { badgeKey: string; tier: BadgeTier };

// What a change that can earn something returns next to the changed item:
// PATCH /tasks/:id and the streak goal sync and relapse have both fields,
// POST /categories only badgesEarned.
export type RewardOutcome = {
  xpAward?: XpAward | null;
  badgesEarned?: BadgeAward[];
};

// One goal in GET /streak-goals; startedAt is an ISO date set by the server.
export type StreakGoal = {
  id: string;
  name: string;
  startedAt: string;
  fullDays: number;
  recordSec: number;
  relapseCount: number;
};

export type StreakGoalTier = { tier: BadgeTier; threshold: number };

export type StreakGoalRules = {
  maxGoals: number;
  nameMaxLength: number;
  dayXp: number;
  tiers: StreakGoalTier[];
};

// serverNow is the moment the response was made, to correct the device clock.
export type StreakGoalsResponse = {
  serverNow: string;
  rules: StreakGoalRules;
  goals: StreakGoal[];
};

// One day of GET /stats, in the user's timezone; date is 'yyyy-MM-dd'.
export type ActivityDay = {
  date: string;
  completions: number;
  fullDay: boolean;
};

// weekKey is 'yyyy-Www', weekStart the Monday as 'yyyy-MM-dd'.
export type WeekXp = { weekKey: string; weekStart: string; xp: number };

export type StatsSummary = {
  fullDaysTotal: number;
  currentStreak: number;
  longestStreak: number;
  xpThisMonth: number;
  completionsThisMonth: number;
};

// GET /stats. activity.days runs without gaps from a Monday to today, 26
// ISO weeks in all; weeklyXp has 8 weeks, the current one last.
export type StatsResponse = {
  serverNow: string;
  timezone: string;
  activity: { days: ActivityDay[] };
  weeklyXp: WeekXp[];
  summary: StatsSummary;
};
