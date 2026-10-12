import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BASE_XP } from '../xp/xp.config';
import {
  CompletionMode,
  TaskStatus,
  TaskType,
} from '../generated/prisma/client';

// The service only needs PrismaService as an injection token here; the fake
// below stands in for the database.
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

type TaskRow = {
  id: string;
  userId: string;
  categoryId: string;
  parentTaskId: string | null;
  title: string;
  type: TaskType;
  completionMode: CompletionMode;
  progressCurrent: number | null;
  progressTarget: number | null;
  status: TaskStatus;
  order: number;
  createdAt: Date;
};

type CompletionRow = {
  id: string;
  taskId: string;
  periodKey: string;
  progressCurrent: number | null;
  completedAt: Date | null;
  firstCompletedAt: Date | null;
};

type XpEventRow = {
  userId: string;
  taskId: string | null;
  periodKey: string;
  baseXp: number;
  multiplier: number;
  amount: number;
};

type UserRow = { timezone: string; xpTotal: number; level: number };

type CompletionFilter = { where: { periodKey: { in: string[] } } };

type StreakTasksArgs = {
  where: { userId: string; type: TaskType; parentTaskId: null };
  select: { completions: CompletionFilter };
};

type UpdateUserArgs = {
  data: { xpTotal?: { increment: number }; level?: number };
};

type FindTaskArgs = {
  where: { id: string; userId: string };
  include: {
    completions: CompletionFilter;
    subtasks?: { include: { completions: CompletionFilter } };
  };
};

type UpsertArgs = {
  where: { taskId_periodKey: { taskId: string; periodKey: string } };
  create: Omit<CompletionRow, 'id' | 'progressCurrent'> & {
    progressCurrent?: number;
  };
  update: { progressCurrent?: number; completedAt?: null };
};

type UpdateManyArgs = {
  where: {
    taskId: string;
    periodKey: string;
    completedAt?: null;
    firstCompletedAt?: null;
  };
  data: Partial<Pick<CompletionRow, 'completedAt' | 'firstCompletedAt'>>;
};

/** In-memory stand-in for the parts of PrismaService that TaskService uses. */
function createFakePrisma() {
  const tasks: TaskRow[] = [];
  const completions: CompletionRow[] = [];
  const xpEvents: XpEventRow[] = [];
  const user: UserRow = { timezone: 'Europe/Warsaw', xpTotal: 0, level: 1 };

  const completionsOf = (taskId: string, filter: CompletionFilter) =>
    completions.filter(
      (c) =>
        c.taskId === taskId && filter.where.periodKey.in.includes(c.periodKey),
    );

  const findTask = ({ where, include }: FindTaskArgs) => {
    const task = tasks.find(
      (t) => t.id === where.id && t.userId === where.userId,
    );
    if (!task) return null;

    const subtasks = include.subtasks;
    return {
      ...task,
      completions: completionsOf(task.id, include.completions),
      ...(subtasks
        ? {
            subtasks: tasks
              .filter((t) => t.parentTaskId === task.id)
              .map((t) => ({
                ...t,
                completions: completionsOf(t.id, subtasks.include.completions),
              })),
          }
        : {}),
    };
  };

  const prisma = {
    user: {
      findUnique: () => Promise.resolve({ ...user }),
      update: ({ data }: UpdateUserArgs) => {
        if (data.xpTotal) user.xpTotal += data.xpTotal.increment;
        if (data.level !== undefined) user.level = data.level;
        return Promise.resolve({ ...user });
      },
    },
    task: {
      findMany: ({ where, select }: StreakTasksArgs) =>
        Promise.resolve(
          tasks
            .filter(
              (t) =>
                t.userId === where.userId &&
                t.type === where.type &&
                t.parentTaskId === null,
            )
            .map((t) => ({
              id: t.id,
              type: t.type,
              parentTaskId: t.parentTaskId,
              createdAt: t.createdAt,
              completions: completionsOf(t.id, select.completions),
            })),
        ),
      findFirst: (args: FindTaskArgs) => Promise.resolve(findTask(args)),
      findFirstOrThrow: (args: FindTaskArgs) => {
        const task = findTask(args);
        return task
          ? Promise.resolve(task)
          : Promise.reject(new Error('No Task found'));
      },
      update: (args: { where: { id: string }; data: Partial<TaskRow> }) => {
        const task = tasks.find((t) => t.id === args.where.id)!;
        // Like Prisma, `undefined` means "leave the column alone".
        for (const [key, value] of Object.entries(args.data)) {
          if (value !== undefined) Object.assign(task, { [key]: value });
        }
        return Promise.resolve({ ...task });
      },
      delete: ({ where }: { where: { id: string } }) => {
        const [removed] = tasks.splice(
          tasks.findIndex((t) => t.id === where.id),
          1,
        );
        // Foreign keys: completions cascade, XP events stay with a null task.
        for (let i = completions.length - 1; i >= 0; i--) {
          if (completions[i].taskId === where.id) completions.splice(i, 1);
        }
        for (const event of xpEvents) {
          if (event.taskId === where.id) event.taskId = null;
        }
        return Promise.resolve(removed);
      },
    },
    taskCompletion: {
      upsert: ({ where, create, update }: UpsertArgs) => {
        const { taskId, periodKey } = where.taskId_periodKey;
        const existing = completions.find(
          (c) => c.taskId === taskId && c.periodKey === periodKey,
        );

        if (!existing) {
          const row: CompletionRow = {
            ...create,
            id: `completion-${completions.length + 1}`,
            progressCurrent: create.progressCurrent ?? null,
          };
          completions.push(row);
          return Promise.resolve(row);
        }

        // Like Prisma, `undefined` means "leave the column alone".
        if (update.progressCurrent !== undefined) {
          existing.progressCurrent = update.progressCurrent;
        }
        if (update.completedAt !== undefined) {
          existing.completedAt = update.completedAt;
        }
        return Promise.resolve(existing);
      },
      updateMany: ({ where, data }: UpdateManyArgs) => {
        const matching = completions.filter(
          (c) =>
            c.taskId === where.taskId &&
            c.periodKey === where.periodKey &&
            (!('completedAt' in where) || c.completedAt === null) &&
            (!('firstCompletedAt' in where) || c.firstCompletedAt === null),
        );
        matching.forEach((c) => Object.assign(c, data));
        return Promise.resolve({ count: matching.length });
      },
    },
    xpEvent: {
      // Like the unique (taskId, periodKey) index with ON CONFLICT DO NOTHING.
      createMany: ({ data }: { data: XpEventRow[] }) => {
        const fresh = data.filter(
          (row) =>
            !xpEvents.some(
              (e) => e.taskId === row.taskId && e.periodKey === row.periodKey,
            ),
        );
        xpEvents.push(...fresh);
        return Promise.resolve({ count: fresh.length });
      },
    },
    $transaction: <T>(run: (tx: unknown) => Promise<T>) => run(prisma),
  };

  return { prisma, tasks, completions, xpEvents, user };
}

const OWNER = 'user-owner';
const INTRUDER = 'user-intruder';

function buildTask(overrides: Partial<TaskRow> & { id: string }): TaskRow {
  return {
    userId: OWNER,
    categoryId: 'category-1',
    parentTaskId: null,
    title: overrides.id,
    type: TaskType.DAILY,
    completionMode: CompletionMode.BOOLEAN,
    progressCurrent: null,
    progressTarget: null,
    status: TaskStatus.ACTIVE,
    order: 0,
    // Long before any test date, so the task is due in every period.
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let tasks: TaskRow[];
  let completions: CompletionRow[];
  let xpEvents: XpEventRow[];
  let user: UserRow;

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

    const fake = createFakePrisma();
    tasks = fake.tasks;
    completions = fake.completions;
    xpEvents = fake.xpEvents;
    user = fake.user;
    service = new TaskService(fake.prisma as unknown as PrismaService);
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

    it('returns the plain task shape plus xpAward, without completions or subtasks', async () => {
      const updated = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });

      expect(Object.keys(updated).sort()).toEqual(
        [...Object.keys(tasks[0]), 'xpAward'].sort(),
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
