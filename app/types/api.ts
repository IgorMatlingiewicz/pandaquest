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

// What a change that can earn something returns next to the changed item:
// PATCH /tasks/:id has both fields, POST /categories only badgesEarned.
export type RewardOutcome = {
  xpAward?: XpAward | null;
  badgesEarned?: BadgeAward[];
};
