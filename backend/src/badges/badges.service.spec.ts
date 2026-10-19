import { BadgesService } from './badges.service';
import type { PrismaService } from '../prisma/prisma.service';
import { TaskStatus, TaskType, type Prisma } from '../generated/prisma/client';
import { BADGE_XP, BADGES, tierXp } from './badges.config';
import {
  buildTask,
  createFakePrisma,
  OWNER,
  type UserBadgeRow,
} from '../testing/fake-prisma';

// Only needed as an injection token; the fake stands in for the database.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

// Monday 2026-10-05, 12:00 in Warsaw (UTC+2), in ISO week 2026-W41.
const NOW = new Date('2026-10-05T10:00:00Z');
const CLOCK = { now: NOW, timezone: 'Europe/Warsaw' };

// 'yyyy-MM-dd' keys of `count` days in a row, ending `endOffset` days
// before NOW (0 = today).
const daysInARow = (count: number, endOffset = 0) =>
  Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(2026, 9, 5 - endOffset - i)).toISOString().slice(0, 10),
  );

const xpOf = (key: string, tier: string) =>
  tierXp(
    BADGES.find((b) => b.key === key)!.tiers.find((t) => t.tier === tier)!,
  );

describe('BadgesService', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let service: BadgesService;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    fake = createFakePrisma();
    service = new BadgesService(fake.prisma as unknown as PrismaService);
    tx = fake.prisma as unknown as Prisma.TransactionClient;
  });

  const addCategory = (id: string, isDeletable = true, userId = OWNER) =>
    fake.categories.push({ id, userId, isDeletable });

  const addDays = (keys: string[], cycleType: 'DAILY' | 'WEEKLY' = 'DAILY') =>
    fake.completedPeriods.push(
      ...keys.map((periodKey) => ({
        userId: OWNER,
        cycleType,
        periodKey,
        completedAt: NOW,
      })),
    );

  const earnedPairs = (awards: { key: string; tier: string }[]) =>
    awards.map((a) => `${a.key}:${a.tier}`);

  describe('onCategoryCreated', () => {
    beforeEach(() => {
      // The three default categories are not the user's own.
      for (const id of ['daily', 'weekly', 'life']) addCategory(id, false);
    });

    it('earns many_categories with the seventh own category', async () => {
      for (let i = 1; i <= 6; i++) addCategory(`own-${i}`);
      expect(await service.onCategoryCreated(tx, OWNER, NOW)).toEqual([]);

      addCategory('own-7');
      expect(await service.onCategoryCreated(tx, OWNER, NOW)).toEqual([
        { key: 'many_categories', tier: 'SILVER', xp: BADGE_XP.SILVER },
      ]);
    });

    it('stores the badge, a BADGE XP event and the XP', async () => {
      for (let i = 1; i <= 7; i++) addCategory(`own-${i}`);

      await service.onCategoryCreated(tx, OWNER, NOW);

      expect(fake.userBadges).toEqual<UserBadgeRow[]>([
        {
          userId: OWNER,
          badgeKey: 'many_categories',
          tier: 'SILVER',
          earnedAt: NOW,
        },
      ]);
      expect(fake.xpEvents).toEqual([
        {
          userId: OWNER,
          source: 'BADGE',
          periodKey: 'LIFETIME',
          baseXp: 150,
          multiplier: 1,
          amount: 150,
        },
      ]);
      expect(fake.user).toMatchObject({ xpTotal: 150, level: 2 });
    });

    it('earns it once, also after categories are deleted and re-created', async () => {
      for (let i = 1; i <= 7; i++) addCategory(`own-${i}`);
      await service.onCategoryCreated(tx, OWNER, NOW);

      fake.categories.pop();
      addCategory('own-again');

      expect(await service.onCategoryCreated(tx, OWNER, NOW)).toEqual([]);
      expect(fake.xpEvents).toHaveLength(1);
    });
  });

  describe('awarding', () => {
    it('does not award XP for a tier a parallel request inserted first', async () => {
      // The other request's row is already there, but this one read the
      // earned badges before it was committed.
      addDays(['2026-10-05']);
      fake.userBadges.push({
        userId: OWNER,
        badgeKey: 'first_day',
        tier: 'BRONZE',
        earnedAt: NOW,
      });
      jest.spyOn(fake.prisma.userBadge, 'findMany').mockResolvedValueOnce([]);

      const awards = await service.onTaskCompleted(
        tx,
        OWNER,
        { type: TaskType.DAILY, categoryId: 'daily' },
        CLOCK,
      );

      expect(awards).toEqual([]);
      expect(fake.xpEvents).toEqual([]);
      expect(fake.user.xpTotal).toBe(0);
    });

    it('raises the level when badge XP crosses a threshold', async () => {
      fake.user.xpTotal = 95;
      addDays(['2026-10-05']);

      await service.onTaskCompleted(
        tx,
        OWNER,
        { type: TaskType.DAILY, categoryId: 'daily' },
        CLOCK,
      );

      expect(fake.user).toMatchObject({
        xpTotal: 95 + xpOf('first_day', 'BRONZE'),
        level: 2,
      });
    });

    it('writes nothing when no tier is new', async () => {
      addDays(['2026-10-05']);
      const completed = () =>
        service.onTaskCompleted(
          tx,
          OWNER,
          { type: TaskType.DAILY, categoryId: 'daily' },
          CLOCK,
        );

      await completed();
      const events = fake.xpEvents.length;

      expect(await completed()).toEqual([]);
      expect(fake.xpEvents).toHaveLength(events);
    });
  });

  describe('onTaskCompleted', () => {
    const completed = (type: TaskType, categoryId = 'daily') =>
      service.onTaskCompleted(tx, OWNER, { type, categoryId }, CLOCK);

    beforeEach(() => {
      addCategory('daily', false);
    });

    describe('completed periods', () => {
      it('counts days in a row up to today', async () => {
        addDays(daysInARow(10));

        expect(earnedPairs(await completed(TaskType.DAILY))).toEqual([
          'daily_streak:BRONZE',
          'first_day:BRONZE',
        ]);
      });

      it('keeps a streak that ended yesterday alive today', async () => {
        addDays(daysInARow(10, 1));

        expect(earnedPairs(await completed(TaskType.DAILY))).toContain(
          'daily_streak:BRONZE',
        );
      });

      it('counts weeks for a WEEKLY task and leaves days alone', async () => {
        addDays(daysInARow(10));
        addDays(['2026-W41', '2026-W40', '2026-W39', '2026-W38'], 'WEEKLY');

        expect(earnedPairs(await completed(TaskType.WEEKLY))).toEqual([
          'weekly_streak:BRONZE',
          'first_week:BRONZE',
        ]);
      });

      it('reads at most as many periods as the longest streak badge', async () => {
        const findMany = jest.spyOn(fake.prisma.completedPeriod, 'findMany');

        await completed(TaskType.DAILY);
        await completed(TaskType.WEEKLY);

        expect(findMany.mock.calls.map(([args]) => args.take)).toEqual([
          365, 48,
        ]);
      });

      it.each([TaskType.LIFE, TaskType.SIDE_QUEST])(
        'does not look at periods for a %s task',
        async (type) => {
          addDays(daysInARow(10));
          const awards = earnedPairs(await completed(type));
          expect(awards).not.toContain('first_day:BRONZE');
        },
      );
    });

    it('earns life_goal for a LIFE task', async () => {
      expect(earnedPairs(await completed(TaskType.LIFE))).toEqual([
        'life_goal:DIAMOND',
      ]);
    });

    describe('own categories', () => {
      beforeEach(() => {
        addCategory('own');
      });

      // A task in "own"; done in the current period unless told otherwise.
      const ownTask = (
        id: string,
        type: TaskType,
        { done = true, createdAt = new Date('2026-01-01T00:00:00Z') } = {},
      ) => {
        fake.tasks.push(
          buildTask({
            id,
            type,
            categoryId: 'own',
            createdAt,
            status:
              done && (type === 'LIFE' || type === 'SIDE_QUEST')
                ? TaskStatus.COMPLETED
                : TaskStatus.ACTIVE,
          }),
        );
        const periodKey =
          type === 'DAILY' ? '2026-10-05' : type === 'WEEKLY' ? '2026-W41' : '';
        if (done && periodKey) {
          fake.completions.push({
            id: `completion-${id}`,
            taskId: id,
            periodKey,
            progressCurrent: null,
            completedAt: NOW,
            firstCompletedAt: NOW,
          });
        }
      };

      it('earns own_category_first_task for a task of any type', async () => {
        ownTask('paint', TaskType.SIDE_QUEST);
        ownTask('open', TaskType.SIDE_QUEST, { done: false });

        expect(
          earnedPairs(await completed(TaskType.SIDE_QUEST, 'own')),
        ).toEqual(['own_category_first_task:BRONZE']);
      });

      it('earns own_category_all_done when each task is done in its own period', async () => {
        ownTask('stretch', TaskType.DAILY);
        ownTask('plants', TaskType.WEEKLY);
        ownTask('paint', TaskType.SIDE_QUEST);

        expect(earnedPairs(await completed(TaskType.DAILY, 'own'))).toContain(
          'own_category_all_done:SILVER',
        );
      });

      it.each([TaskType.DAILY, TaskType.WEEKLY, TaskType.SIDE_QUEST])(
        'is not all done while a %s task is open',
        async (type) => {
          ownTask('paint', TaskType.SIDE_QUEST);
          ownTask('open', type, { done: false });

          expect(
            earnedPairs(await completed(TaskType.SIDE_QUEST, 'own')),
          ).not.toContain('own_category_all_done:SILVER');
        },
      );

      it('does not wait for a daily task added today', async () => {
        ownTask('paint', TaskType.SIDE_QUEST);
        ownTask('new', TaskType.DAILY, { done: false, createdAt: NOW });

        expect(
          earnedPairs(await completed(TaskType.SIDE_QUEST, 'own')),
        ).toContain('own_category_all_done:SILVER');
      });

      it('earns several badges at once', async () => {
        ownTask('house', TaskType.LIFE);

        const awards = await completed(TaskType.LIFE, 'own');

        expect(earnedPairs(awards)).toEqual([
          'life_goal:DIAMOND',
          'own_category_first_task:BRONZE',
          'own_category_all_done:SILVER',
        ]);
        expect(fake.xpEvents).toHaveLength(3);
        expect(fake.user.xpTotal).toBe(1000 + 50 + 150);
      });
    });

    it('gives a default category no own-category badges', async () => {
      fake.tasks.push(
        buildTask({
          id: 'house',
          type: TaskType.LIFE,
          categoryId: 'daily',
          status: TaskStatus.COMPLETED,
        }),
      );

      expect(earnedPairs(await completed(TaskType.LIFE))).toEqual([
        'life_goal:DIAMOND',
      ]);
    });

    it("does not treat another user's category as own", async () => {
      addCategory('theirs', true, 'someone-else');

      expect(
        earnedPairs(await completed(TaskType.SIDE_QUEST, 'theirs')),
      ).toEqual([]);
    });
  });
});
