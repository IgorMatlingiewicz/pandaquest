import { BadgeTier } from '../generated/prisma/client';
import { BADGE_XP, BADGES, isEventMetric, tierXp } from './badges.config';

// Tiers in the order they are declared in the schema, lowest first.
const TIER_ORDER = Object.values(BadgeTier);
const rank = (tier: BadgeTier) => TIER_ORDER.indexOf(tier);

const isPositiveInteger = (n: number) => Number.isInteger(n) && n > 0;

describe('badge catalog', () => {
  it('has unique keys', () => {
    const keys = BADGES.map((badge) => badge.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has positive whole XP for every tier, growing with the tier', () => {
    const amounts = TIER_ORDER.map((tier) => BADGE_XP[tier]);

    expect(amounts.every(isPositiveInteger)).toBe(true);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeGreaterThan(amounts[i - 1]);
    }
  });

  describe.each(BADGES)('$key', (badge) => {
    it('uses a snake_case key, as in the client translations', () => {
      expect(badge.key).toMatch(/^[a-z]+(_[a-z]+)*$/);
    });

    it('has at least one tier', () => {
      expect(badge.tiers.length).toBeGreaterThan(0);
    });

    it('lists its tiers from lowest to highest, each at most once', () => {
      const ranks = badge.tiers.map((rule) => rank(rule.tier));

      expect(ranks.every((r) => r >= 0)).toBe(true);
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
      }
    });

    it('has positive whole thresholds that grow with the tier', () => {
      const thresholds = badge.tiers.map((rule) => rule.threshold);

      expect(thresholds.every(isPositiveInteger)).toBe(true);
      for (let i = 1; i < thresholds.length; i++) {
        expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
      }
    });

    it('is worth positive whole XP for every tier', () => {
      expect(badge.tiers.map(tierXp).every(isPositiveInteger)).toBe(true);
    });
  });

  // An event metric is only ever 0 or 1, so any other threshold could
  // never be reached, or would be reached by every event.
  describe.each(BADGES.filter((badge) => isEventMetric(badge.metric)))(
    'event badge $key',
    (badge) => {
      it('has a single tier at threshold 1', () => {
        expect(badge.tiers).toHaveLength(1);
        expect(badge.tiers[0].threshold).toBe(1);
      });
    },
  );
});

describe('the catalog size', () => {
  // Every tier counts in "badges: X of Y" (profile, friend's profile,
  // achievements). Pinned, so a badge added or removed shows up here and
  // the change is deliberate.
  it('has 27 tiers in all', () => {
    const tiers = BADGES.reduce((sum, badge) => sum + badge.tiers.length, 0);
    expect(tiers).toBe(27);
  });
});

describe('bright_start', () => {
  const badge = BADGES.find((b) => b.key === 'bright_start')!;

  it('is one Bronze tier for finishing the tutorial, worth 10 XP', () => {
    expect(badge).toEqual({
      key: 'bright_start',
      metric: 'tutorialCompleted',
      tiers: [{ tier: 'BRONZE', threshold: 1, xp: 10 }],
    });
    expect(tierXp(badge.tiers[0])).toBe(10);
    expect(isEventMetric(badge.metric)).toBe(true);
  });

  it('stands with the starter badges, right after first_week', () => {
    const keys = BADGES.map((b) => b.key);
    expect(keys.indexOf('bright_start')).toBe(keys.indexOf('first_week') + 1);
  });
});

describe('isEventMetric', () => {
  it('tells event metrics from counted ones', () => {
    expect(isEventMetric('lifeGoalCompleted')).toBe(true);
    expect(isEventMetric('dailyStreak')).toBe(false);
  });
});

describe('tierXp', () => {
  it('takes the amount from the XP table by default', () => {
    expect(tierXp({ tier: 'GOLD', threshold: 100 })).toBe(BADGE_XP.GOLD);
  });

  it('prefers the override set on the tier', () => {
    expect(tierXp({ tier: 'GOLD', threshold: 100, xp: 7 })).toBe(7);
  });
});
