import {
  CompletionMode,
  TaskStatus,
  TaskType,
  type BadgeTier,
  type CycleType,
  type XpSource,
} from '../generated/prisma/client';

/*
 * In-memory stand-in for the parts of PrismaService that the services use,
 * so service tests run without a database. Each unique index is modelled as
 * ON CONFLICT DO NOTHING, with the same NULL rule as Postgres.
 *
 * What this fake does NOT test: concurrency. $transaction runs the callback
 * on the same arrays, so there is no isolation, no row locking and no
 * rollback when the callback throws. Two requests racing to earn the same
 * badge, or a rollback leaving no half-written award, can only be checked
 * against a real Postgres (an integration test), not here. The same goes for
 * the conditional updates of streak goals and for their limit: requests never
 * interleave here, so a test has to stage a stale read by hand.
 */

export const OWNER = 'user-owner';

export type TaskRow = {
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

export type CategoryRow = { id: string; userId: string; isDeletable: boolean };

export type CompletionRow = {
  id: string;
  taskId: string;
  periodKey: string;
  progressCurrent: number | null;
  completedAt: Date | null;
  firstCompletedAt: Date | null;
};

export type XpEventRow = {
  userId: string;
  // Left out by TASK awards: the column defaults to TASK.
  source?: XpSource;
  taskId?: string | null;
  periodKey: string;
  baseXp: number;
  multiplier: number;
  amount: number;
  // Left out by the services: the column defaults to now().
  createdAt?: Date;
};

export type CompletedPeriodRow = {
  userId: string;
  cycleType: CycleType;
  periodKey: string;
  completedAt: Date;
};

export type UserBadgeRow = {
  userId: string;
  badgeKey: string;
  tier: BadgeTier;
  earnedAt: Date;
};

export type UserRow = { timezone: string; xpTotal: number; level: number };

export type StreakGoalRow = {
  id: string;
  userId: string;
  name: string;
  startedAt: Date;
  daysRewarded: number;
  createdAt: Date;
};

export type StreakAttemptRow = {
  id: string;
  goalId: string;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
};

type StreakGoalWhere = {
  id: string;
  userId?: string;
  startedAt?: Date;
  daysRewarded?: number;
};

type CompletionFilter = { where: { periodKey: { in: string[] } | string } };

type FindTasksArgs = {
  where: {
    userId: string;
    parentTaskId: null;
    type?: TaskType;
    categoryId?: string;
  };
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

type PeriodWhere = { where: { userId: string; cycleType: CycleType } };

type FindXpEventsArgs = {
  where: { userId: string; createdAt: { gte: Date } };
};

export function createFakePrisma() {
  const tasks: TaskRow[] = [];
  const categories: CategoryRow[] = [];
  const completions: CompletionRow[] = [];
  const xpEvents: XpEventRow[] = [];
  const completedPeriods: CompletedPeriodRow[] = [];
  const userBadges: UserBadgeRow[] = [];
  const streakGoals: StreakGoalRow[] = [];
  const streakAttempts: StreakAttemptRow[] = [];
  const user: UserRow = { timezone: 'Europe/Warsaw', xpTotal: 0, level: 1 };
  let nextId = 0;

  // Dates are compared by the moment, like the columns they stand in for.
  const matchesGoal = (goal: StreakGoalRow, where: StreakGoalWhere) =>
    goal.id === where.id &&
    (where.userId === undefined || goal.userId === where.userId) &&
    (where.startedAt === undefined ||
      goal.startedAt.getTime() === where.startedAt.getTime()) &&
    (where.daysRewarded === undefined ||
      goal.daysRewarded === where.daysRewarded);

  const completionsOf = (taskId: string, filter: CompletionFilter) => {
    const { periodKey } = filter.where;
    const keys = typeof periodKey === 'string' ? [periodKey] : periodKey.in;
    return completions.filter(
      (c) => c.taskId === taskId && keys.includes(c.periodKey),
    );
  };

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

  const periodsOf = ({ where }: PeriodWhere) =>
    completedPeriods.filter(
      (p) => p.userId === where.userId && p.cycleType === where.cycleType,
    );

  const prisma = {
    user: {
      findUnique: () => Promise.resolve({ ...user }),
      update: ({ data }: UpdateUserArgs) => {
        if (data.xpTotal) user.xpTotal += data.xpTotal.increment;
        if (data.level !== undefined) user.level = data.level;
        return Promise.resolve({ ...user });
      },
    },
    category: {
      create: ({
        data,
      }: {
        data: { userId: string; isDeletable?: boolean };
      }) => {
        const row: CategoryRow = {
          id: `category-${categories.length + 1}`,
          isDeletable: true,
          ...data,
        };
        categories.push(row);
        return Promise.resolve({ ...row });
      },
      findFirst: ({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(
          categories.find(
            (c) => c.id === where.id && c.userId === where.userId,
          ) ?? null,
        ),
      count: ({
        where,
      }: {
        where: { userId: string; isDeletable?: boolean };
      }) =>
        Promise.resolve(
          categories.filter(
            (c) =>
              c.userId === where.userId &&
              (where.isDeletable === undefined ||
                c.isDeletable === where.isDeletable),
          ).length,
        ),
    },
    task: {
      // Top-level tasks of a user, optionally of one type or one category.
      findMany: ({ where, select }: FindTasksArgs) =>
        Promise.resolve(
          tasks
            .filter(
              (t) =>
                t.userId === where.userId &&
                t.parentTaskId === null &&
                (where.type === undefined || t.type === where.type) &&
                (where.categoryId === undefined ||
                  t.categoryId === where.categoryId),
            )
            .map((t) => ({
              ...t,
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
      // As in Postgres, a NULL taskId never conflicts (NULLS DISTINCT), so
      // BADGE rows always go in.
      createMany: ({ data }: { data: XpEventRow[] }) => {
        const fresh = data.filter(
          (row) =>
            row.taskId == null ||
            !xpEvents.some(
              (e) => e.taskId === row.taskId && e.periodKey === row.periodKey,
            ),
        );
        xpEvents.push(
          ...fresh.map((row) => ({
            ...row,
            createdAt: row.createdAt ?? new Date(),
          })),
        );
        return Promise.resolve({ count: fresh.length });
      },
      // Only the fields the statistics read, source with its column default.
      findMany: ({ where }: FindXpEventsArgs) =>
        Promise.resolve(
          xpEvents
            .filter(
              (e) =>
                e.userId === where.userId &&
                e.createdAt!.getTime() >= where.createdAt.gte.getTime(),
            )
            .map((e) => ({
              createdAt: e.createdAt!,
              amount: e.amount,
              source: e.source ?? 'TASK',
            })),
        ),
    },
    completedPeriod: {
      // Like the unique (userId, cycleType, periodKey) index with
      // ON CONFLICT DO NOTHING.
      createMany: ({ data }: { data: CompletedPeriodRow[] }) => {
        const fresh = data.filter(
          (row) =>
            !completedPeriods.some(
              (p) =>
                p.userId === row.userId &&
                p.cycleType === row.cycleType &&
                p.periodKey === row.periodKey,
            ),
        );
        completedPeriods.push(...fresh);
        return Promise.resolve({ count: fresh.length });
      },
      count: (args: PeriodWhere) => Promise.resolve(periodsOf(args).length),
      // Newest first, as ORDER BY "periodKey" DESC LIMIT take; all without take.
      findMany: (args: PeriodWhere & { take?: number }) =>
        Promise.resolve(
          periodsOf(args)
            .map((p) => ({ periodKey: p.periodKey }))
            .sort((a, b) => b.periodKey.localeCompare(a.periodKey))
            .slice(0, args.take),
        ),
    },
    userBadge: {
      findMany: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(userBadges.filter((b) => b.userId === where.userId)),
      // Like INSERT ... ON CONFLICT (userId, badgeKey, tier) DO NOTHING
      // RETURNING: only the rows that went in come back.
      createManyAndReturn: ({ data }: { data: UserBadgeRow[] }) => {
        const fresh = data.filter(
          (row) =>
            !userBadges.some(
              (b) =>
                b.userId === row.userId &&
                b.badgeKey === row.badgeKey &&
                b.tier === row.tier,
            ),
        );
        userBadges.push(...fresh);
        return Promise.resolve(fresh.map((row) => ({ ...row })));
      },
    },
    streakGoal: {
      count: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          streakGoals.filter((g) => g.userId === where.userId).length,
        ),
      create: ({
        data,
      }: {
        data: Pick<StreakGoalRow, 'userId' | 'name' | 'startedAt'>;
      }) => {
        const row: StreakGoalRow = {
          id: `goal-${++nextId}`,
          daysRewarded: 0,
          createdAt: new Date(),
          ...data,
        };
        streakGoals.push(row);
        return Promise.resolve({ ...row });
      },
      // Oldest first, as ORDER BY "createdAt".
      findMany: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          streakGoals
            .filter((g) => g.userId === where.userId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((g) => ({ ...g })),
        ),
      findFirst: ({ where }: { where: StreakGoalWhere }) => {
        const goal = streakGoals.find((g) => matchesGoal(g, where));
        return Promise.resolve(goal ? { ...goal } : null);
      },
      updateMany: ({
        where,
        data,
      }: {
        where: StreakGoalWhere;
        data: Partial<StreakGoalRow>;
      }) => {
        const matching = streakGoals.filter((g) => matchesGoal(g, where));
        matching.forEach((g) => Object.assign(g, data));
        return Promise.resolve({ count: matching.length });
      },
      deleteMany: ({ where }: { where: StreakGoalWhere }) => {
        const matching = streakGoals.filter((g) => matchesGoal(g, where));
        for (const goal of matching) {
          streakGoals.splice(streakGoals.indexOf(goal), 1);
          // Foreign key: closed attempts cascade with their goal.
          for (let i = streakAttempts.length - 1; i >= 0; i--) {
            if (streakAttempts[i].goalId === goal.id) {
              streakAttempts.splice(i, 1);
            }
          }
        }
        return Promise.resolve({ count: matching.length });
      },
    },
    streakAttempt: {
      create: ({ data }: { data: Omit<StreakAttemptRow, 'id'> }) => {
        const row: StreakAttemptRow = { id: `attempt-${++nextId}`, ...data };
        streakAttempts.push(row);
        return Promise.resolve({ ...row });
      },
      // Like GROUP BY "goalId" with MAX("durationSec") and COUNT(*); a goal
      // with no attempts has no row at all.
      groupBy: ({ where }: { where: { goalId: { in: string[] } } }) => {
        const goalIds = where.goalId.in.filter((id) =>
          streakAttempts.some((a) => a.goalId === id),
        );
        return Promise.resolve(
          goalIds.map((goalId) => {
            const closed = streakAttempts.filter((a) => a.goalId === goalId);
            return {
              goalId,
              _max: {
                durationSec: Math.max(...closed.map((a) => a.durationSec)),
              },
              _count: { _all: closed.length },
            };
          }),
        );
      },
    },
    $transaction: <T>(run: (tx: unknown) => Promise<T>) => run(prisma),
  };

  return {
    prisma,
    tasks,
    categories,
    completions,
    xpEvents,
    completedPeriods,
    userBadges,
    streakGoals,
    streakAttempts,
    user,
  };
}

export function buildTask(
  overrides: Partial<TaskRow> & { id: string },
): TaskRow {
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
