import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import type { PrismaService } from '../prisma/prisma.service';
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
};

type CompletionRow = {
  id: string;
  taskId: string;
  periodKey: string;
  progressCurrent: number | null;
  completedAt: Date | null;
  firstCompletedAt: Date | null;
};

type CompletionFilter = { where: { periodKey: { in: string[] } } };

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
      findUnique: () => Promise.resolve({ timezone: 'Europe/Warsaw' }),
    },
    task: {
      findFirst: (args: FindTaskArgs) => Promise.resolve(findTask(args)),
      findFirstOrThrow: (args: FindTaskArgs) => {
        const task = findTask(args);
        return task
          ? Promise.resolve(task)
          : Promise.reject(new Error('No Task found'));
      },
      update: (args: { where: { id: string }; data: Partial<TaskRow> }) => {
        const task = tasks.find((t) => t.id === args.where.id)!;
        Object.assign(task, args.data);
        return Promise.resolve({ ...task });
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
    $transaction: <T>(run: (tx: unknown) => Promise<T>) => run(prisma),
  };

  return { prisma, tasks, completions };
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
    ...overrides,
  };
}

describe('TaskService', () => {
  let service: TaskService;
  let tasks: TaskRow[];
  let completions: CompletionRow[];

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

    it('leaves status on the Task row untouched', async () => {
      await service.update(OWNER, 'pills', { status: TaskStatus.COMPLETED });

      expect(tasks[0].status).toBe(TaskStatus.ACTIVE);
    });

    it('returns the plain task shape without completions or subtasks', async () => {
      const updated = await service.update(OWNER, 'pills', {
        status: TaskStatus.COMPLETED,
      });

      expect(Object.keys(updated).sort()).toEqual(Object.keys(tasks[0]).sort());
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
});
