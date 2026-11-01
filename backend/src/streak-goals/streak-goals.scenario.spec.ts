import { BadgesService } from '../badges/badges.service';
import { BADGE_XP } from '../badges/badges.config';
import type { PrismaService } from '../prisma/prisma.service';
import { createFakePrisma, OWNER } from '../testing/fake-prisma';
import { STREAK_GOAL_DAY_XP } from '../xp/xp.config';
import { StreakGoalsService } from './streak-goals.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START = new Date('2026-11-01T10:00:00Z').getTime();

/*
 * Whole-flow scenarios on the in-memory database, with a simulated clock:
 * goals are created, synced and closed on chosen days through the service,
 * and the achievements view is read the way GET /achievements reads it.
 */
describe('streak goal scenarios', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let goals: StreakGoalsService;
  let badges: BadgesService;

  // n full days after the first goal was created.
  const day = (n: number, extraMs = 0) => new Date(START + n * DAY + extraMs);
  const onDay = (n: number, extraMs = 0) => jest.setSystemTime(day(n, extraMs));

  const createGoal = async (name: string) =>
    (await goals.create(OWNER, { name })).id;

  const streakBadge = async () => {
    const all = await badges.getAchievements(OWNER);
    return all.find((a) => a.key === 'streak_days')!;
  };
  const earnedDates = () =>
    Object.fromEntries(fake.userBadges.map((b) => [b.tier, b.earnedAt]));

  beforeEach(() => {
    jest.useFakeTimers({ now: START });
    fake = createFakePrisma();
    const prisma = fake.prisma as unknown as PrismaService;
    badges = new BadgesService(prisma);
    goals = new StreakGoalsService(prisma, badges);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pays the days of an absence and dates the badge when it was reached', async () => {
    await createGoal('Papierosy');
    onDay(1);
    const first = await goals.sync(OWNER);
    expect(first.xpAward).toMatchObject({ amount: STREAK_GOAL_DAY_XP });
    expect(first.badgesEarned).toEqual([]);

    // Ten days without opening the app, seven-day mark passed meanwhile.
    onDay(11, 2 * HOUR);
    const second = await goals.sync(OWNER);

    expect(second.xpAward).toMatchObject({ amount: 10 * STREAK_GOAL_DAY_XP });
    expect(second.badgesEarned).toEqual([
      { key: 'streak_days', tier: 'BRONZE', xp: BADGE_XP.BRONZE },
    ]);
    expect(earnedDates()).toEqual({ BRONZE: day(7) });
    expect(fake.user.xpTotal).toBe(11 * STREAK_GOAL_DAY_XP + BADGE_XP.BRONZE);
  });

  it('pays nothing for a second sync right after the first', async () => {
    await createGoal('Papierosy');
    onDay(8);
    await goals.sync(OWNER);
    const xpBefore = fake.user.xpTotal;

    const repeated = await goals.sync(OWNER);

    expect(repeated).toEqual({ xpAward: null, badgesEarned: [] });
    expect(fake.user.xpTotal).toBe(xpBefore);
  });

  it('settles a slip past a threshold when nothing synced before it', async () => {
    const id = await createGoal('Papierosy');

    onDay(8);
    const slip = await goals.relapse(OWNER, id);

    expect(slip.xpAward).toMatchObject({ amount: 8 * STREAK_GOAL_DAY_XP });
    expect(slip.badgesEarned).toEqual([
      { key: 'streak_days', tier: 'BRONZE', xp: BADGE_XP.BRONZE },
    ]);
    expect(earnedDates()).toEqual({ BRONZE: day(7) });
  });

  it('earns each tier once, also when the next attempt reaches it again', async () => {
    const id = await createGoal('Papierosy');
    onDay(8);
    await goals.relapse(OWNER, id);

    onDay(16);
    const next = await goals.sync(OWNER);

    expect(next.xpAward).toMatchObject({ amount: 8 * STREAK_GOAL_DAY_XP });
    expect(next.badgesEarned).toEqual([]);
  });

  it('earns a tier once across goals', async () => {
    await createGoal('Papierosy');
    onDay(8);
    await goals.sync(OWNER);
    await createGoal('Alkohol');

    onDay(16);
    const later = await goals.sync(OWNER);

    expect(later.badgesEarned).toEqual([]);
    expect(fake.userBadges).toHaveLength(1);
  });

  it('pays all goals as one award and dates the badge by the oldest', async () => {
    await createGoal('Papierosy');
    onDay(3);
    await createGoal('Alkohol');

    onDay(8);
    const { xpAward } = await goals.sync(OWNER);

    expect(xpAward).toMatchObject({ amount: 13 * STREAK_GOAL_DAY_XP });
    expect(
      fake.xpEvents.filter((event) => event.source === 'STREAK_GOAL'),
    ).toHaveLength(1);
    expect(earnedDates()).toEqual({ BRONZE: day(7) });
  });

  it('measures the badge by running attempts, not by closed ones', async () => {
    const first = await createGoal('Papierosy');
    onDay(1);
    await createGoal('Alkohol');
    onDay(6);
    await goals.relapse(OWNER, first);

    onDay(7);
    expect((await goals.sync(OWNER)).badgesEarned).toEqual([]);

    onDay(8);
    const { badgesEarned } = await goals.sync(OWNER);

    expect(badgesEarned.map((badge) => badge.tier)).toEqual(['BRONZE']);
    expect(earnedDates()).toEqual({ BRONZE: day(8) });
  });

  it('earns every tier reached during a long absence, each with its own date', async () => {
    await createGoal('Papierosy');

    onDay(150);
    const { xpAward, badgesEarned } = await goals.sync(OWNER);

    expect(badgesEarned.map((badge) => badge.tier)).toEqual([
      'BRONZE',
      'SILVER',
      'GOLD',
    ]);
    expect(earnedDates()).toEqual({
      BRONZE: day(7),
      SILVER: day(30),
      GOLD: day(100),
    });
    expect(xpAward).toMatchObject({ amount: 150 * STREAK_GOAL_DAY_XP });
    expect(fake.user.xpTotal).toBe(
      150 * STREAK_GOAL_DAY_XP +
        BADGE_XP.BRONZE +
        BADGE_XP.SILVER +
        BADGE_XP.GOLD,
    );

    onDay(365);
    const diamond = await goals.sync(OWNER);
    expect(diamond.badgesEarned.map((badge) => badge.tier)).toEqual([
      'DIAMOND',
    ]);
    expect(earnedDates().DIAMOND).toEqual(day(365));
  });

  it('is not moved by a daylight saving change', async () => {
    // The clocks in Poland go back on 25 October, so this week has one
    // calendar day of 25 hours; the moment is still 7 times 24 hours later.
    jest.setSystemTime(new Date('2026-10-20T10:00:00Z'));
    await createGoal('Papierosy');

    jest.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    await goals.sync(OWNER);

    expect(earnedDates()).toEqual({
      BRONZE: new Date('2026-10-27T10:00:00Z'),
    });
  });

  it('shows the current value before a sync, without changing anything', async () => {
    await createGoal('Papierosy');
    onDay(8);

    const before = await streakBadge();

    expect(before.current).toBe(8);
    expect(before.tiers.every((tier) => tier.earnedAt === null)).toBe(true);
    expect(fake.userBadges).toEqual([]);
    expect(fake.user.xpTotal).toBe(0);
  });

  it('keeps earned badges and XP after the goal is deleted', async () => {
    const id = await createGoal('Papierosy');
    onDay(8);
    await goals.sync(OWNER);
    const xpBefore = fake.user.xpTotal;

    await goals.remove(OWNER, id);

    const after = await streakBadge();
    expect(after.current).toBe(0);
    expect(after.tiers[0].earnedAt).toEqual(day(7));
    expect(fake.user.xpTotal).toBe(xpBefore);
  });
});
