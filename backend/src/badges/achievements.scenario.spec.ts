import { TaskService } from '../task/task.service';
import { CategoryService } from '../category/category.service';
import { BadgesService } from './badges.service';
import { BADGES } from './badges.config';
import type { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskType } from '../generated/prisma/client';
import { buildTask, createFakePrisma, OWNER } from '../testing/fake-prisma';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

/*
 * Whole-flow scenarios on the in-memory database: tasks are completed on
 * simulated dates through TaskService (categories created through
 * CategoryService), and the achievements view is then read the way
 * GET /achievements reads it.
 */
describe('achievements scenarios', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let taskService: TaskService;
  let categoryService: CategoryService;
  let badgesService: BadgesService;

  // 08:00 in Warsaw, n days after Monday 2026-10-05.
  const day = (n: number) => new Date(Date.UTC(2026, 9, 5 + n, 6));

  beforeEach(() => {
    jest.useFakeTimers({ now: day(0) });
    fake = createFakePrisma();
    const prisma = fake.prisma as unknown as PrismaService;
    badgesService = new BadgesService(prisma);
    taskService = new TaskService(prisma, badgesService);
    categoryService = new CategoryService(prisma, badgesService);
    fake.categories.push({
      id: 'category-1',
      userId: OWNER,
      isDeletable: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const setStatus = (id: string, at: Date, status: TaskStatus) => {
    jest.setSystemTime(at);
    return taskService.update(OWNER, id, { status });
  };
  const completeOn = (id: string, at: Date) =>
    setStatus(id, at, TaskStatus.COMPLETED);
  const completeOnDays = async (id: string, days: number[]) => {
    for (const n of days) await completeOn(id, day(n));
  };

  const achievement = async (key: string, at?: Date) => {
    if (at) jest.setSystemTime(at);
    const all = await badgesService.getAchievements(OWNER);
    return all.find((a) => a.key === key)!;
  };
  const earnedTiers = (a: {
    tiers: { tier: string; earnedAt: Date | null }[];
  }) => a.tiers.filter((t) => t.earnedAt !== null).map((t) => t.tier);

  it('lists every badge with nothing earned for a new user', async () => {
    const all = await badgesService.getAchievements(OWNER);

    expect(all.map((a) => a.key)).toEqual(BADGES.map((b) => b.key));
    expect(all.every((a) => a.current === 0)).toBe(true);
    expect(all.flatMap((a) => a.tiers).every((t) => t.earnedAt === null)).toBe(
      true,
    );
  });

  describe('days in a row', () => {
    beforeEach(() => {
      fake.tasks.push(buildTask({ id: 'pills' }));
    });

    it('reaches a streak of 10 and dates the bronze tier on the tenth day', async () => {
      await completeOnDays('pills', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const streak = await achievement('daily_streak');
      expect(streak.current).toBe(10);
      expect(streak.tiers[0]).toMatchObject({
        tier: 'BRONZE',
        threshold: 10,
        earnedAt: day(9),
      });
      expect((await achievement('daily_total')).current).toBe(10);
      expect((await achievement('first_day')).tiers[0].earnedAt).toEqual(
        day(0),
      );
    });

    it('breaks the streak after a missed day, but keeps the earned tier', async () => {
      await completeOnDays('pills', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);

      const streak = await achievement('daily_streak');
      expect(streak.current).toBe(1);
      expect(earnedTiers(streak)).toEqual(['BRONZE']);
      expect((await achievement('daily_total')).current).toBe(11);
    });

    it('keeps an open day in the streak until midnight', async () => {
      await completeOnDays('pills', [0, 1, 2, 3, 4]);

      expect((await achievement('daily_streak', day(5))).current).toBe(5);
      // 23:59 on Saturday 2026-10-10 in Warsaw (UTC+2).
      const lastMinute = new Date('2026-10-10T21:59:00Z');
      expect((await achievement('daily_streak', lastMinute)).current).toBe(5);
      expect((await achievement('daily_streak', day(6))).current).toBe(0);
    });

    it('changes neither history nor badges when the task is unchecked and deleted', async () => {
      await completeOnDays('pills', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      await setStatus('pills', day(9), TaskStatus.ACTIVE);
      await taskService.remove(OWNER, 'pills');

      const streak = await achievement('daily_streak', day(9));
      expect(streak.current).toBe(10);
      expect(earnedTiers(streak)).toEqual(['BRONZE']);
      expect((await achievement('daily_total')).current).toBe(10);
    });
  });

  describe('weeks across the ISO year boundary', () => {
    // Mondays at 11:00 in Warsaw (UTC+1): 2026-W52, 2026-W53, 2027-W01, W02.
    const W52 = new Date('2026-12-21T10:00:00Z');
    const W53 = new Date('2026-12-28T10:00:00Z');
    const W01 = new Date('2027-01-04T10:00:00Z');
    const W02 = new Date('2027-01-11T10:00:00Z');

    beforeEach(() => {
      fake.tasks.push(buildTask({ id: 'laundry', type: TaskType.WEEKLY }));
    });

    it('counts four weeks in a row through 2026-W53', async () => {
      for (const week of [W52, W53, W01, W02])
        await completeOn('laundry', week);

      const streak = await achievement('weekly_streak');
      expect(streak.current).toBe(4);
      expect(streak.tiers[0]).toMatchObject({ tier: 'BRONZE', earnedAt: W02 });
      expect((await achievement('first_week')).tiers[0].earnedAt).toEqual(W52);
      expect(fake.completedPeriods.map((p) => p.periodKey)).toEqual([
        '2026-W52',
        '2026-W53',
        '2027-W01',
        '2027-W02',
      ]);
    });

    it('breaks the streak when 2026-W53 is missed', async () => {
      await completeOn('laundry', W52);
      await completeOn('laundry', W01);

      expect((await achievement('weekly_streak')).current).toBe(1);
    });
  });

  it('earns several badges with one completion', async () => {
    fake.categories.push({ id: 'own', userId: OWNER, isDeletable: true });
    fake.tasks.push(
      buildTask({ id: 'house', type: TaskType.LIFE, categoryId: 'own' }),
    );

    const result = await completeOn('house', day(0));

    const keys = [
      'life_goal',
      'own_category_first_task',
      'own_category_all_done',
    ];
    expect(result.badgesEarned.map((b) => b.key)).toEqual(keys);
    for (const key of keys) {
      const view = await achievement(key);
      expect(view.current).toBe(1);
      expect(view.tiers[0].earnedAt).toEqual(day(0));
    }
    // Task XP plus the three badges: 1000 + 1000 + 50 + 150.
    expect(fake.user.xpTotal).toBe(2200);
  });

  it('earns "Dużo na głowie" with the seventh own category and keeps it', async () => {
    let lastCreated: Awaited<ReturnType<CategoryService['create']>> | null =
      null;
    for (let i = 1; i <= 7; i++) {
      jest.setSystemTime(day(i));
      lastCreated = await categoryService.create(OWNER, {
        name: `Kategoria ${i}`,
      });
    }

    expect(lastCreated?.badgesEarned).toEqual([
      { key: 'many_categories', tier: 'SILVER', xp: 150 },
    ]);
    const view = await achievement('many_categories');
    expect(view).toMatchObject({ current: 7 });
    expect(view.tiers[0].earnedAt).toEqual(day(7));

    // The count follows the categories that exist; the badge stays.
    fake.categories.pop();
    const afterDelete = await achievement('many_categories');
    expect(afterDelete.current).toBe(6);
    expect(earnedTiers(afterDelete)).toEqual(['SILVER']);
  });

  it("does not show another user's badges", async () => {
    fake.tasks.push(buildTask({ id: 'pills' }));
    await completeOn('pills', day(0));

    const theirs = await badgesService.getAchievements('someone-else');

    expect(theirs.flatMap((a) => a.tiers).some((t) => t.earnedAt)).toBe(false);
    expect(theirs.find((a) => a.key === 'daily_total')?.current).toBe(0);
  });
});
