import type { TaskType } from '../generated/prisma/client';

/*
 * The one definition of a "full period", shared by the XP streak and by the
 * badges (CompletedPeriod rows, the "all tasks of a category" badge). The
 * caller decides the scope by the tasks it passes in: every top-level task
 * of a user of one cycle type, or every top-level task of one category.
 */

export type FullPeriodTask = { id: string; type: TaskType; createdAt: Date };

/**
 * The period a task is judged in. `start` is null for types without a
 * period (LIFE, SIDE_QUEST): such a task is due from the moment it exists.
 */
export type DueWindow = { key: string; start: Date | null };

/** Marks "task done in period"; build `done` sets with it, nothing else. */
export function doneKey(taskId: string, periodKey: string): string {
  return `${taskId}|${periodKey}`;
}

export type PeriodCompletion = {
  taskId: string;
  periodKey: string;
  completedAt: Date | null;
};

/** The `done` set for isPeriodFull. An unchecked completion does not count. */
export function doneSet(completions: readonly PeriodCompletion[]): Set<string> {
  return new Set(
    completions
      .filter((c) => c.completedAt !== null)
      .map((c) => doneKey(c.taskId, c.periodKey)),
  );
}

/**
 * The tasks a period requires. A task is due only in periods that started
 * after it was created, so the period it is added in is a spare one.
 */
export function dueTasks<T extends FullPeriodTask>(
  tasks: readonly T[],
  windowFor: (type: TaskType) => DueWindow,
): T[] {
  return tasks.filter((task) => {
    const { start } = windowFor(task.type);
    return start === null || task.createdAt.getTime() < start.getTime();
  });
}

/** The due tasks not done yet, each in the period of its own type. */
export function undoneDueTasks<T extends FullPeriodTask>(
  tasks: readonly T[],
  done: ReadonlySet<string>,
  windowFor: (type: TaskType) => DueWindow,
): T[] {
  return dueTasks(tasks, windowFor).filter(
    (task) => !done.has(doneKey(task.id, windowFor(task.type).key)),
  );
}

/**
 * A period is full when at least one task is due in it and every due task
 * is done.
 */
export function isPeriodFull(
  tasks: readonly FullPeriodTask[],
  done: ReadonlySet<string>,
  windowFor: (type: TaskType) => DueWindow,
): boolean {
  return (
    dueTasks(tasks, windowFor).length > 0 &&
    undoneDueTasks(tasks, done, windowFor).length === 0
  );
}
