import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BadgesService } from '../badges/badges.service';
import { BADGES, tierXp } from '../badges/badges.config';
import { BASE_XP } from '../xp/xp.config';
import {
  CompletionMode,
  TaskStatus,
  TaskType,
} from '../generated/prisma/client';
import {
  buildTask,
  createFakePrisma,
  OWNER,
  type CategoryRow,
  type CompletedPeriodRow,
  type CompletionRow,
  type TaskRow,
  type UserBadgeRow,
  type UserRow,
  type XpEventRow,
} from '../testing/fake-prisma';

// The service only needs PrismaService as an injection token here; the fake
// stands in for the database.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const INTRUDER = 'user-intruder';

describe('TaskService', () => {
  let service: TaskService;
  let fake: ReturnType<typeof createFakePrisma>;
  let tasks: TaskRow[];
  let categories: CategoryRow[];
  let completions: CompletionRow[];
  let xpEvents: XpEventRow[];
  let completedPeriods: CompletedPeriodRow[];
  let userBadges: UserBadgeRow[];
  let user: UserRow;
  // Stands in for BadgesService everywhere except the "badges" tests, so the
  // XP tests keep measuring task XP alone.
  let badges: { onTaskCompleted: jest.Mock };

  // All within Monday 2026-10-05 in Europe/Warsaw (UTC+2).
  const MORNING = new Date('2026-10-05T06:00:00Z');
  const NOON = new Date('2026-10-05T10:00:00Z');
  const EVENING = new Date('2026-10-05T18:00:00Z');
  // Tuesday 2026-10-06 in Warsaw.
  const NEXT_DAY = new Date('2026-10-06T06:00:00Z');

  const completionsOf = (taskId: string) =>
    completions.filter((c) => c.taskId === taskId);

  beforeEach(() => {
    jest.useFakeTimers({ now: MORNING });

    fake = createFakePrisma();
    tasks = fake.tasks;
    categories = fake.categories;
    completions = fake.completions;
    xpEvents = fake.xpEvents;
    completedPeriods = fake.completedPeriods;
    userBadges = fake.userBadges;
    user = fake.user;
    badges = { onTaskCompleted: jest.fn().mockResolvedValue([]) };
    service = new TaskService(
      fake.prisma as unknown as PrismaService,
      badges as unknown as BadgesService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('update on a DAILY task', () => {
    beforeEach(() => {
      tasks.push(buildTask({ id: 'pills' }));
    });

    it('keeps one row and the first firstCompletedAt when toggled within a period', async () => {
      const checked = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });
      expect(checked.status).toBe(TaskStatus.COMPLETED);

      jest.setSystemTime(NOON);
      const unchecked = await service.update(OWNER, 'pills', {
        status: TaskStatus.ACTIVE,
      });
      expect(unchecked.status).toBe(TaskStatus.ACTIVE);
      expect(completionsOf('pills')).toEqual([
        expect.objectContaining({
          completedAt: null,
          firstCompletedAt: MORNING,
        }),
      ]);

      jest.setSystemTime(EVENING);
      const rechecked = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });
      expect(rechecked.status).toBe(TaskStatus.COMPLETED);

      expect(completionsOf('pills')).toEqual([
        expect.objectContaining({
          periodKey: '2026-10-05',
          completedAt: EVENING,
          firstCompletedAt: MORNING,
        }),
      ]);
    });

    it('does not move completedAt when an already completed task is completed again', async () => {
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      jest.setSystemTime(NOON);
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      expect(completionsOf('pills')).toEqual([
        expect.objectContaining({
          completedAt: MORNING,
          firstCompletedAt: MORNING,
        }),
      ]);
    });

    it('starts a new row with its own firstCompletedAt in the next period', async () => {
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      jest.setSystemTime(NEXT_DAY);
      const afterReset = await service.findOne(OWNER, 'pills');
      expect(afterReset.status).toBe(TaskStatus.ACTIVE);

      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });
      const laterThatDay = new Date('2026-10-06T10:00:00Z');
      jest.setSystemTime(laterThatDay);
      await service.update(OWNER, 'pills', { status: TaskStatus.ACTIVE });
      const evenLater = new Date('2026-10-06T18:00:00Z');
      jest.setSystemTime(evenLater);
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      expect(completionsOf('pills')).toEqual([
        expect.objectContaining({
          periodKey: '2026-10-05',
          completedAt: MORNING,
          firstCompletedAt: MORNING,
        }),
        expect.objectContaining({
          periodKey: '2026-10-06',
          completedAt: evenLater,
          firstCompletedAt: NEXT_DAY,
        }),
      ]);
    });

    it('awards XP once when the task is checked, unchecked and checked again', async () => {
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });
      await service.update(OWNER, 'pills', { status: TaskStatus.ACTIVE });
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      expect(xpEvents).toEqual([
        {
          userId: OWNER,
          taskId: 'pills',
          periodKey: '2026-10-05',
          baseXp: 10,
          multiplier: 1,
          amount: 10,
        },
      ]);
      expect(user.xpTotal).toBe(10);
    });

    it('leaves status on the Task row untouched', async () => {
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      expect(tasks[0].status).toBe(TaskStatus.ACTIVE);
    });

    it('returns the plain task shape plus xpAward and badgesEarned, without completions or subtasks', async () => {
      const updated = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });

      expect(Object.keys(updated).sort()).toEqual(
        [...Object.keys(tasks[0]), 'xpAward', 'badgesEarned'].sort(),
      );
    });

    it('returns the award for the first completion and null afterwards', async () => {
      const first = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });
      expect(first.xpAward).toEqual({
        amount: 10,
        baseXp: 10,
        multiplier: 1,
        leveledUp: false,
        level: 1,
      });

      const unchecked = await service.update(OWNER, 'pills', {
        status: TaskStatus.ACTIVE,
      });
      expect(unchecked.xpAward).toBeNull();

      const again = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });
      expect(again.xpAward).toBeNull();
    });

    it('returns a null award when the request does not change the status', async () => {
      const renamed = await service.update(OWNER, 'pills', {
        title: 'Vitamins',
      });
      expect(renamed.xpAward).toBeNull();
    });

    it('reports a level-up in the award', async () => {
      user.xpTotal = 95;

      const updated = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });

      expect(updated.xpAward).toMatchObject({ leveledUp: true, level: 2 });
      expect(user).toMatchObject({ xpTotal: 105, level: 2 });
    });

    it('completes a PROGRESS task once the target is reached', async () => {
      tasks.push(
        buildTask({
          id: 'dog',
          completionMode: CompletionMode.PROGRESS,
          progressTarget: 3,
        }),
      );

      const partial = await service.update(OWNER, 'dog', {
        progressCurrent: 2,
      });
      expect(partial).toMatchObject({
        status: TaskStatus.ACTIVE,
        progressCurrent: 2,
      });

      const full = await service.update(OWNER, 'dog', { progressCurrent: 3 });
      expect(full).toMatchObject({
        status: TaskStatus.COMPLETED,
        progressCurrent: 3,
      });
      expect(tasks.find((t) => t.id === 'dog')?.progressCurrent).toBeNull();
    });
  });

  describe('IDOR protection', () => {
    beforeEach(() => {
      tasks.push(buildTask({ id: 'pills' }));
    });

    it("rejects updating another user's task and writes nothing", async () => {
      await expect(
        service.update(INTRUDER, 'pills', { status: TaskStatus.COMPLETED }),
      ).rejects.toThrow(NotFoundException);

      expect(completions).toHaveLength(0);
      expect(tasks[0].status).toBe(TaskStatus.ACTIVE);
    });

    it("rejects reading another user's task", async () => {
      await expect(service.findOne(INTRUDER, 'pills')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejects deleting another user's task", async () => {
      await expect(service.remove(INTRUDER, 'pills')).rejects.toThrow(
        NotFoundException,
      );
      expect(tasks).toHaveLength(1);
    });
  });

  describe('parent status sync', () => {
    const statusOf = async (id: string) =>
      (await service.findOne(OWNER, id)).status;

    describe.each([TaskType.DAILY, TaskType.LIFE])('%s tasks', (type) => {
      beforeEach(() => {
        tasks.push(
          buildTask({ id: 'parent', type }),
          buildTask({ id: 'step-a', type, parentTaskId: 'parent' }),
          buildTask({ id: 'step-b', type, parentTaskId: 'parent' }),
        );
      });

      it('completes the parent only when every subtask is completed', async () => {
        await service.update(OWNER, 'step-a', {
          status: TaskStatus.COMPLETED,
        });
        expect(await statusOf('parent')).toBe(TaskStatus.ACTIVE);

        await service.update(OWNER, 'step-b', {
          status: TaskStatus.COMPLETED,
        });
        expect(await statusOf('parent')).toBe(TaskStatus.COMPLETED);
      });

      it('moves the parent back to ACTIVE when a subtask is unchecked', async () => {
        await service.update(OWNER, 'step-a', {
          status: TaskStatus.COMPLETED,
        });
        await service.update(OWNER, 'step-b', {
          status: TaskStatus.COMPLETED,
        });

        await service.update(OWNER, 'step-a', { status: TaskStatus.ACTIVE });

        expect(await statusOf('parent')).toBe(TaskStatus.ACTIVE);
        expect(await statusOf('step-b')).toBe(TaskStatus.COMPLETED);
      });
    });

    it('keeps the DAILY parent firstCompletedAt after it is reopened', async () => {
      tasks.push(
        buildTask({ id: 'parent' }),
        buildTask({ id: 'step-a', parentTaskId: 'parent' }),
      );

      await service.update(OWNER, 'step-a', { status: TaskStatus.COMPLETED });
      jest.setSystemTime(NOON);
      await service.update(OWNER, 'step-a', { status: TaskStatus.ACTIVE });

      expect(completionsOf('parent')).toEqual([
        expect.objectContaining({
          completedAt: null,
          firstCompletedAt: MORNING,
        }),
      ]);
    });

    it('resets a DAILY parent together with its subtasks in the next period', async () => {
      tasks.push(
        buildTask({ id: 'parent' }),
        buildTask({ id: 'step-a', parentTaskId: 'parent' }),
      );
      await service.update(OWNER, 'step-a', { status: TaskStatus.COMPLETED });
      expect(await statusOf('parent')).toBe(TaskStatus.COMPLETED);

      jest.setSystemTime(NEXT_DAY);

      const parent = await service.findOne(OWNER, 'parent');
      expect(parent.status).toBe(TaskStatus.ACTIVE);
      expect(parent.subtasks.map((s) => s.status)).toEqual([TaskStatus.ACTIVE]);
    });
  });

  describe('XP awards', () => {
    // 08:00 Warsaw time, n days after Monday 2026-10-05.
    const day = (n: number) => new Date(Date.UTC(2026, 9, 5 + n, 6));
    const complete = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.COMPLETED });
    const uncheck = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.ACTIVE });
    const completeOnDays = async (id: string, days: number[]) => {
      for (const n of days) {
        jest.setSystemTime(day(n));
        await complete(id);
      }
    };
    const multipliers = () => xpEvents.map((e) => e.multiplier);
    const amounts = () => xpEvents.map((e) => e.amount);

    describe('daily streak', () => {
      beforeEach(() => {
        tasks.push(buildTask({ id: 'pills' }));
      });

      it('adds 0.1 to the multiplier for every full day in a row', async () => {
        await completeOnDays('pills', [0, 1, 2]);

        expect(multipliers()).toEqual([1, 1.1, 1.2]);
        expect(amounts()).toEqual([10, 11, 12]);
        expect(user.xpTotal).toBe(33);
      });

      it('resets the multiplier after a missed day', async () => {
        await completeOnDays('pills', [0, 1, 3]);

        expect(multipliers()).toEqual([1, 1.1, 1]);
      });

      it('stops growing at 2.0 after 10 full days', async () => {
        await completeOnDays('pills', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

        expect(multipliers().slice(9)).toEqual([1.9, 2, 2]);
      });

      it('counts a day as full only when every daily task was done', async () => {
        tasks.push(buildTask({ id: 'walk' }));

        await completeOnDays('pills', [0, 1]);

        expect(multipliers()).toEqual([1, 1]);
      });

      it('gives a task added today a spare day before it can break the streak', async () => {
        await completeOnDays('pills', [0, 1]);
        // "read" is added on day 1 and never done.
        tasks.push(buildTask({ id: 'read', createdAt: day(1) }));
        await completeOnDays('pills', [2, 3]);

        // Day 2 still sees day 1 as full; day 3 sees day 2 without "read".
        expect(multipliers()).toEqual([1, 1.1, 1.2, 1]);
      });
    });

    it('raises the weekly multiplier by 0.25 per full week, up to 2.0', async () => {
      tasks.push(buildTask({ id: 'laundry', type: TaskType.WEEKLY }));

      await completeOnDays('laundry', [0, 7, 14, 21, 28, 35]);

      expect(multipliers()).toEqual([1, 1.25, 1.5, 1.75, 2, 2]);
      expect(amounts()).toEqual([30, 38, 45, 53, 60, 60]);
      expect(xpEvents.map((e) => e.periodKey)).toEqual([
        '2026-W41',
        '2026-W42',
        '2026-W43',
        '2026-W44',
        '2026-W45',
        '2026-W46',
      ]);
    });

    describe.each([TaskType.DAILY, TaskType.LIFE])(
      'subtasks of a %s task',
      (type) => {
        beforeEach(() => {
          tasks.push(
            buildTask({ id: 'parent', type }),
            buildTask({ id: 'step-a', type, parentTaskId: 'parent' }),
            buildTask({ id: 'step-b', type, parentTaskId: 'parent' }),
          );
        });

        it('earn nothing themselves; the parent is awarded once when all are done', async () => {
          const first = await complete('step-a');
          expect(first.xpAward).toBeNull();
          expect(xpEvents).toHaveLength(0);

          const last = await complete('step-b');
          expect(last.xpAward).toMatchObject({ amount: BASE_XP[type] });
          expect(xpEvents.map((e) => e.taskId)).toEqual(['parent']);

          await uncheck('step-b');
          const again = await complete('step-b');
          expect(again.xpAward).toBeNull();
          expect(xpEvents).toHaveLength(1);
        });
      },
    );

    it.each([
      [TaskType.LIFE, 1000],
      [TaskType.SIDE_QUEST, 20],
    ])('awards a %s task once in its lifetime', async (type, amount) => {
      tasks.push(buildTask({ id: 'goal', type }));

      await complete('goal');
      await uncheck('goal');
      jest.setSystemTime(day(1));
      await complete('goal');

      expect(xpEvents).toEqual([
        expect.objectContaining({
          taskId: 'goal',
          periodKey: 'LIFETIME',
          multiplier: 1,
          amount,
        }),
      ]);
      expect(user.xpTotal).toBe(amount);
    });

    it('awards a PROGRESS task once, when the target is reached', async () => {
      tasks.push(
        buildTask({
          id: 'dog',
          completionMode: CompletionMode.PROGRESS,
          progressTarget: 3,
        }),
      );

      await service.update(OWNER, 'dog', { progressCurrent: 2 });
      expect(xpEvents).toHaveLength(0);

      const full = await service.update(OWNER, 'dog', { progressCurrent: 3 });
      expect(full.xpAward).toMatchObject({ amount: 10 });

      await service.update(OWNER, 'dog', { progressCurrent: 3 });
      expect(user.xpTotal).toBe(10);
    });

    it('keeps the XP when the task is deleted', async () => {
      tasks.push(buildTask({ id: 'pills' }));

      await complete('pills');
      await service.remove(OWNER, 'pills');

      expect(tasks).toHaveLength(0);
      expect(xpEvents).toEqual([
        expect.objectContaining({ taskId: null, amount: 10 }),
      ]);
      expect(user.xpTotal).toBe(10);
    });
  });

  describe('completed periods', () => {
    const complete = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.COMPLETED });
    const uncheck = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.ACTIVE });
    const recorded = () =>
      completedPeriods.map((p) => `${p.cycleType} ${p.periodKey}`);

    describe('DAILY', () => {
      beforeEach(() => {
        // In two different categories: the day needs every daily task.
        tasks.push(
          buildTask({ id: 'pills' }),
          buildTask({ id: 'walk', categoryId: 'own-category' }),
        );
      });

      it('records the day when its last due task is completed', async () => {
        await complete('pills');
        expect(completedPeriods).toEqual([]);

        jest.setSystemTime(NOON);
        await complete('walk');
        expect(completedPeriods).toEqual([
          {
            userId: OWNER,
            cycleType: 'DAILY',
            periodKey: '2026-10-05',
            completedAt: NOON,
          },
        ]);
      });

      it('keeps the day when a task is unchecked afterwards', async () => {
        await complete('pills');
        await complete('walk');
        await uncheck('walk');

        expect(recorded()).toEqual(['DAILY 2026-10-05']);
      });

      it('records the day once, at the moment it first became full', async () => {
        await complete('pills');
        await complete('walk');
        jest.setSystemTime(NOON);
        await uncheck('walk');
        jest.setSystemTime(EVENING);
        await complete('walk');

        expect(completedPeriods).toEqual([
          expect.objectContaining({ completedAt: MORNING }),
        ]);
      });

      it('keeps the history when a task is deleted', async () => {
        await complete('pills');
        await complete('walk');
        await service.remove(OWNER, 'walk');
        expect(recorded()).toEqual(['DAILY 2026-10-05']);

        // Without "walk", the next day needs "pills" only.
        jest.setSystemTime(NEXT_DAY);
        await complete('pills');
        expect(recorded()).toEqual(['DAILY 2026-10-05', 'DAILY 2026-10-06']);
      });

      it('does not wait for a task added today', async () => {
        tasks.push(buildTask({ id: 'read', createdAt: MORNING }));

        await complete('pills');
        await complete('walk');

        expect(recorded()).toEqual(['DAILY 2026-10-05']);
      });

      it('records nothing on the day every daily task was added', async () => {
        // Same rule as the XP streak: a period with no due task is not full.
        for (const task of tasks) task.createdAt = MORNING;

        await complete('pills');
        await complete('walk');
        expect(completedPeriods).toEqual([]);

        jest.setSystemTime(NEXT_DAY);
        await complete('pills');
        await complete('walk');
        expect(recorded()).toEqual(['DAILY 2026-10-06']);
      });

      it('does not change the XP awarded', async () => {
        await complete('pills');
        await complete('walk');

        expect(xpEvents.map((e) => e.amount)).toEqual([10, 10]);
        expect(user.xpTotal).toBe(20);
      });
    });

    it('records the day when the last task is completed through its subtasks', async () => {
      tasks.push(
        buildTask({ id: 'parent' }),
        buildTask({ id: 'step', parentTaskId: 'parent' }),
      );

      await complete('step');

      expect(recorded()).toEqual(['DAILY 2026-10-05']);
    });

    it('records the ISO week for WEEKLY tasks', async () => {
      tasks.push(buildTask({ id: 'laundry', type: TaskType.WEEKLY }));

      await complete('laundry');

      expect(recorded()).toEqual(['WEEKLY 2026-W41']);
    });

    it.each([TaskType.LIFE, TaskType.SIDE_QUEST])(
      'records nothing for %s tasks',
      async (type) => {
        tasks.push(buildTask({ id: 'goal', type }));

        await complete('goal');

        expect(completedPeriods).toEqual([]);
      },
    );
  });

  describe('badges', () => {
    const complete = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.COMPLETED });
    const uncheck = (id: string) =>
      service.update(OWNER, id, { status: TaskStatus.ACTIVE });
    const pairs = (awards: { key: string; tier: string }[]) =>
      awards.map((a) => `${a.key}:${a.tier}`);

    describe('when they are evaluated', () => {
      it('asks once a top-level task is completed, inside its transaction', async () => {
        tasks.push(buildTask({ id: 'pills', categoryId: 'own' }));

        await complete('pills');

        expect(badges.onTaskCompleted).toHaveBeenCalledTimes(1);
        expect(badges.onTaskCompleted).toHaveBeenCalledWith(
          fake.prisma,
          OWNER,
          expect.objectContaining({ type: TaskType.DAILY, categoryId: 'own' }),
          expect.objectContaining({ now: MORNING, timezone: 'Europe/Warsaw' }),
        );
      });

      it('asks for the parent once its last subtask is completed', async () => {
        tasks.push(
          buildTask({ id: 'house', type: TaskType.LIFE }),
          buildTask({
            id: 'step-a',
            type: TaskType.LIFE,
            parentTaskId: 'house',
          }),
          buildTask({
            id: 'step-b',
            type: TaskType.LIFE,
            parentTaskId: 'house',
          }),
        );

        await complete('step-a');
        expect(badges.onTaskCompleted).not.toHaveBeenCalled();

        await complete('step-b');
        expect(badges.onTaskCompleted).toHaveBeenCalledWith(
          fake.prisma,
          OWNER,
          expect.objectContaining({ id: 'house' }),
          expect.anything(),
        );
      });

      it('does not ask when a task is unchecked or only edited', async () => {
        tasks.push(buildTask({ id: 'pills' }));

        await uncheck('pills');
        await service.update(OWNER, 'pills', { title: 'Vitamins' });

        expect(badges.onTaskCompleted).not.toHaveBeenCalled();
      });

      it('returns what was earned next to xpAward', async () => {
        const award = { key: 'first_day', tier: 'BRONZE', xp: 25 };
        badges.onTaskCompleted.mockResolvedValue([award]);
        tasks.push(buildTask({ id: 'pills' }));

        const result = await complete('pills');

        expect(result.badgesEarned).toEqual([award]);
        expect(result.xpAward).toMatchObject({ amount: 10 });
      });

      it('returns an empty list when the request does not complete anything', async () => {
        tasks.push(buildTask({ id: 'pills' }));

        const renamed = await service.update(OWNER, 'pills', {
          title: 'Vitamins',
        });

        expect(renamed.badgesEarned).toEqual([]);
      });
    });

    describe('with the real BadgesService', () => {
      const xpOf = (key: string, tier: string) =>
        tierXp(
          BADGES.find((b) => b.key === key)!.tiers.find(
            (t) => t.tier === tier,
          )!,
        );

      beforeEach(() => {
        service = new TaskService(
          fake.prisma as unknown as PrismaService,
          new BadgesService(fake.prisma as unknown as PrismaService),
        );
        categories.push(
          { id: 'category-1', userId: OWNER, isDeletable: false },
          { id: 'own', userId: OWNER, isDeletable: true },
        );
      });

      it('earns first_day with the first full day, on top of the task XP', async () => {
        tasks.push(buildTask({ id: 'pills' }));

        const result = await complete('pills');

        expect(result.badgesEarned).toEqual([
          { key: 'first_day', tier: 'BRONZE', xp: xpOf('first_day', 'BRONZE') },
        ]);
        expect(user.xpTotal).toBe(10 + xpOf('first_day', 'BRONZE'));
        expect(xpEvents.map((e) => e.source ?? 'TASK')).toEqual([
          'TASK',
          'BADGE',
        ]);
      });

      it('earns each badge once across uncheck and re-check', async () => {
        tasks.push(buildTask({ id: 'pills' }));

        await complete('pills');
        await uncheck('pills');
        const again = await complete('pills');

        expect(again.badgesEarned).toEqual([]);
        expect(userBadges).toHaveLength(1);
      });

      it('earns several badges at once', async () => {
        tasks.push(
          buildTask({ id: 'house', type: TaskType.LIFE, categoryId: 'own' }),
        );

        const result = await complete('house');

        expect(pairs(result.badgesEarned)).toEqual([
          'life_goal:DIAMOND',
          'own_category_first_task:BRONZE',
          'own_category_all_done:SILVER',
        ]);
      });

      it('earns own_category_all_done only with the last task of the category', async () => {
        tasks.push(
          buildTask({ id: 'stretch', categoryId: 'own' }),
          buildTask({
            id: 'paint',
            type: TaskType.SIDE_QUEST,
            categoryId: 'own',
          }),
        );

        const first = await complete('paint');
        expect(pairs(first.badgesEarned)).toEqual([
          'own_category_first_task:BRONZE',
        ]);

        const last = await complete('stretch');
        expect(pairs(last.badgesEarned)).toContain(
          'own_category_all_done:SILVER',
        );
      });

      it('does not count a subtask in an own category as a completed task', async () => {
        tasks.push(
          buildTask({
            id: 'trip',
            type: TaskType.SIDE_QUEST,
            categoryId: 'own',
          }),
          buildTask({
            id: 'tickets',
            type: TaskType.SIDE_QUEST,
            categoryId: 'own',
            parentTaskId: 'trip',
          }),
          buildTask({
            id: 'bags',
            type: TaskType.SIDE_QUEST,
            categoryId: 'own',
            parentTaskId: 'trip',
          }),
        );

        expect((await complete('tickets')).badgesEarned).toEqual([]);
      });

      it('earns a badge even when the completion pays no XP (no backfill)', async () => {
        // Completed and paid before badges existed, then unchecked.
        tasks.push(
          buildTask({
            id: 'paint',
            type: TaskType.SIDE_QUEST,
            categoryId: 'own',
          }),
        );
        xpEvents.push({
          userId: OWNER,
          taskId: 'paint',
          periodKey: 'LIFETIME',
          baseXp: 20,
          multiplier: 1,
          amount: 20,
        });

        const result = await complete('paint');

        expect(result.xpAward).toBeNull();
        expect(pairs(result.badgesEarned)).toContain(
          'own_category_first_task:BRONZE',
        );
      });

      it('keeps earned badges when the task is unchecked or deleted', async () => {
        tasks.push(buildTask({ id: 'house', type: TaskType.LIFE }));

        await complete('house');
        await uncheck('house');
        await service.remove(OWNER, 'house');

        expect(userBadges.map((b) => b.badgeKey)).toEqual(['life_goal']);
        expect(user.xpTotal).toBe(1000 + xpOf('life_goal', 'DIAMOND'));
      });
    });
  });

  describe.each([TaskType.DAILY, TaskType.LIFE])(
    'editing a %s task',
    (type) => {
      beforeEach(() => {
        tasks.push(buildTask({ id: 'pills', type }));
      });

      it('rejects a move to another category', async () => {
        await expect(
          service.update(OWNER, 'pills', { categoryId: 'category-2' }),
        ).rejects.toThrow(BadRequestException);

        expect(tasks[0].categoryId).toBe('category-1');
      });

      it('rejects a type change', async () => {
        const other = type === TaskType.DAILY ? TaskType.LIFE : TaskType.DAILY;

        await expect(
          service.update(OWNER, 'pills', { type: other }),
        ).rejects.toThrow(BadRequestException);

        expect(tasks[0].type).toBe(type);
      });

      it('accepts the current category sent along with other changes', async () => {
        await service.update(OWNER, 'pills', {
          title: 'Vitamins',
          categoryId: 'category-1',
        });

        expect(tasks[0].title).toBe('Vitamins');
      });

      it('writes only the editable fields', async () => {
        const before = { ...tasks[0] };
        const body = {
          title: 'Vitamins',
          userId: INTRUDER,
          createdAt: new Date('2030-01-01T00:00:00Z'),
          parentTaskId: 'other-task',
          order: 99,
        };

        await service.update(OWNER, 'pills', body);

        expect(tasks[0]).toEqual({ ...before, title: 'Vitamins' });
      });
    },
  );
});
