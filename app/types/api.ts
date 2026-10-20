// Shapes of the backend responses the app reads, kept in step with
// backend/src by hand.

// The xpAward field of a PATCH /tasks/:id response.
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

// What a change that can earn something returns next to the changed item:
// PATCH /tasks/:id has both fields, POST /categories only badgesEarned.
export type RewardOutcome = {
  xpAward?: XpAward | null;
  badgesEarned?: BadgeAward[];
};
