import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReorderItemDto } from '../common/dto/reorder.dto';
import {
  Prisma,
  TaskCompletion,
  TaskStatus,
  TaskType,
} from '../generated/prisma/client';
import { doneSet, isPeriodFull } from '../common/full-period';
import {
  getPeriodKey,
  getPeriodStart,
  getPreviousPeriods,
} from '../common/period';
import { BadgesService } from '../badges/badges.service';
import type { BadgeAward } from '../badges/badges.logic';
import { LIFETIME_PERIOD_KEY, STREAK_RULES } from '../xp/xp.config';
import { addXp } from '../xp/add-xp';
import { computeStreak, xpForCompletion } from '../xp/xp.logic';

// Current period key per cyclic task type; other types have no entry.
type PeriodKeys = Partial<Record<TaskType, string>>;

// One clock reading per request, with the user's timezone and the period
// keys derived from it, so every step agrees on what "today" is.
type PeriodContext = { now: Date; timezone: string; keys: PeriodKeys };

export type XpAward = {
  amount: number;
  baseXp: number;
  multiplier: number;
  leveledUp: boolean;
  level: number;
};

/** What completing a task earned, added to the PATCH /tasks/:id response. */
type CompletionOutcome = {
  xpAward: XpAward | null;
  badgesEarned: BadgeAward[];
};

const NO_OUTCOME: CompletionOutcome = { xpAward: null, badgesEarned: [] };

type CompletedTask = {
  id: string;
  type: TaskType;
  parentTaskId: string | null;
  categoryId: string;
};

type TaskWithCompletions = {
  type: TaskType;
  completionMode: string;
  status: TaskStatus;
  progressCurrent: number | null;
  completions: TaskCompletion[];
};

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badges: BadgesService,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Kategoria nie znaleziona');
    }

    const count = await this.prisma.task.count({
      where: {
        userId,
        categoryId: dto.categoryId,
        parentTaskId: dto.parentTaskId ?? null,
      },
    });

    return this.prisma.task.create({
      data: {
        ...dto,
        userId,
        // A cycle category (Daily/Weekly/Life) always dictates the task's
        // type, regardless of what the client sent.
        type: category.cycleType ?? dto.type,
        order: count,
      },
    });
  }

  async findAll(userId: string, categoryId?: string) {
    const { keys } = await this.getPeriodContext(userId);
    const completions = this.currentCompletions(keys);

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        parentTaskId: null,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        completions,
        subtasks: { include: { completions }, orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });

    return tasks.map((task) => ({
      ...this.withDerivedState(task, keys),
      subtasks: task.subtasks.map((s) => this.withDerivedState(s, keys)),
    }));
  }

  async findOne(userId: string, id: string) {
    const { keys } = await this.getPeriodContext(userId);
    return this.findOneForPeriod(userId, id, keys);
  }

  private async findOneForPeriod(userId: string, id: string, keys: PeriodKeys) {
    const completions = this.currentCompletions(keys);

    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { completions, subtasks: { include: { completions } } },
    });

    if (!task) {
      throw new NotFoundException('Zadanie nie znalezione');
    }

    return {
      ...this.withDerivedState(task, keys),
      subtasks: task.subtasks.map((s) => this.withDerivedState(s, keys)),
    };
  }

  private async getPeriodContext(userId: string): Promise<PeriodContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }

    const now = new Date();
    const keys: PeriodKeys = {};
    for (const type of Object.values(TaskType)) {
      const key = getPeriodKey(type, now, user.timezone);
      if (key) keys[type] = key;
    }
    return { now, timezone: user.timezone, keys };
  }

  private currentCompletions(keys: PeriodKeys) {
    return { where: { periodKey: { in: Object.values(keys) } } };
  }

  private withDerivedState<T extends TaskWithCompletions>(
    task: T,
    keys: PeriodKeys,
  ): Omit<T, 'completions'> {
    const { completions, ...rest } = task;

    const periodKey = keys[task.type];
    if (!periodKey) return rest;

    const completion = completions.find((c) => c.periodKey === periodKey);
    return {
      ...rest,
      status: completion?.completedAt
        ? TaskStatus.COMPLETED
        : TaskStatus.ACTIVE,
      progressCurrent:
        completion?.progressCurrent ??
        (task.completionMode === 'PROGRESS' ? 0 : null),
    };
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.task.delete({ where: { id } });
  }

  async reorder(userId: string, items: ReorderItemDto[]) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const task = await tx.task.findFirst({
          where: { id: item.id, userId },
        });
        if (!task) continue;

        await tx.task.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const ctx = await this.getPeriodContext(userId);
    const task = await this.findOneForPeriod(userId, id, ctx.keys);
    this.assertNotMoved(task, dto);
    const { status, progressCurrent, ...template } = this.editableFields(dto);

    const reachedTarget =
      task.completionMode === 'PROGRESS' &&
      progressCurrent !== undefined &&
      task.progressTarget !== null &&
      progressCurrent >= task.progressTarget;

    // undefined: this request does not touch the completion state.
    const completed = reachedTarget
      ? true
      : status === undefined
        ? undefined
        : status === TaskStatus.COMPLETED;
    const periodKey = ctx.keys[task.type];

    // Everything a completion causes (state, parent sync, XP, badges)
    // commits or rolls back together.
    const outcome = await this.prisma.$transaction(async (tx) => {
      if (periodKey) {
        if (Object.values(template).some((v) => v !== undefined)) {
          await tx.task.update({ where: { id }, data: template });
        }
        if (completed !== undefined || progressCurrent !== undefined) {
          await this.saveCompletion(tx, id, periodKey, ctx.now, {
            completed,
            progressCurrent,
          });
        }
      } else {
        await tx.task.update({
          where: { id },
          data: {
            ...template,
            progressCurrent,
            status: reachedTarget ? TaskStatus.COMPLETED : status,
          },
        });
      }

      if (completed === undefined) return NO_OUTCOME;
      return this.onStatusChange(tx, userId, task, completed, ctx);
    });

    // The task itself, no subtasks. xpAward is null unless this request
    // was the first completion of a top-level task in its period;
    // badgesEarned lists the badge tiers it earned, usually none.
    const updated = await this.prisma.task.findFirstOrThrow({
      where: { id, userId },
      include: { completions: this.currentCompletions(ctx.keys) },
    });
    return { ...this.withDerivedState(updated, ctx.keys), ...outcome };
  }

  /** A task keeps the category, and so the type, it was created with. */
  private assertNotMoved(
    task: { categoryId: string; type: TaskType },
    dto: UpdateTaskDto,
  ) {
    const moved =
      dto.categoryId !== undefined && dto.categoryId !== task.categoryId;
    const retyped = dto.type !== undefined && dto.type !== task.type;

    if (moved || retyped) {
      throw new BadRequestException(
        'Nie można zmienić kategorii ani typu zadania',
      );
    }
  }

  /**
   * The only fields PATCH may write. Anything else in the request body
   * (userId, createdAt, parentTaskId, ...) is dropped here.
   */
  private editableFields(dto: UpdateTaskDto) {
    const {
      title,
      completionMode,
      progressTarget,
      deadline,
      status,
      progressCurrent,
    } = dto;

    return {
      title,
      completionMode,
      progressTarget,
      deadline,
      status,
      progressCurrent,
    };
  }

  private async saveCompletion(
    tx: Prisma.TransactionClient,
    taskId: string,
    periodKey: string,
    now: Date,
    change: { completed?: boolean; progressCurrent?: number },
  ) {
    const { completed, progressCurrent } = change;

    await tx.taskCompletion.upsert({
      where: { taskId_periodKey: { taskId, periodKey } },
      create: {
        taskId,
        periodKey,
        progressCurrent,
        completedAt: completed ? now : null,
        firstCompletedAt: completed ? now : null,
      },
      update: {
        progressCurrent,
        ...(completed === false ? { completedAt: null } : {}),
      },
    });

    if (completed) {
      await tx.taskCompletion.updateMany({
        where: { taskId, periodKey, completedAt: null },
        data: { completedAt: now },
      });
      await tx.taskCompletion.updateMany({
        where: { taskId, periodKey, firstCompletedAt: null },
        data: { firstCompletedAt: now },
      });
    }
  }

  /**
   * A status change either bubbles up to the parent or, for a top-level
   * task that just got completed, records the period and earns XP and
   * badges. Subtasks earn nothing themselves.
   */
  private async onStatusChange(
    tx: Prisma.TransactionClient,
    userId: string,
    task: CompletedTask,
    completed: boolean,
    ctx: PeriodContext,
  ): Promise<CompletionOutcome> {
    if (task.parentTaskId) {
      return this.syncParentStatus(tx, userId, task.parentTaskId, ctx);
    }
    if (!completed) return NO_OUTCOME;

    await this.recordCompletedPeriod(tx, userId, task.type, ctx);
    const xpAward = await this.awardXp(tx, userId, task, ctx);
    // After recordCompletedPeriod, so the badges see today's entry.
    const badgesEarned = await this.badges.onTaskCompleted(
      tx,
      userId,
      task,
      ctx,
    );
    return { xpAward, badgesEarned };
  }

  /**
   * Adds a CompletedPeriod row once completing a top-level task has made the
   * current period of its type full. Only ever adds: unchecking or deleting
   * tasks later does not rewrite the history.
   */
  private async recordCompletedPeriod(
    tx: Prisma.TransactionClient,
    userId: string,
    type: TaskType,
    ctx: PeriodContext,
  ): Promise<void> {
    if (type !== TaskType.DAILY && type !== TaskType.WEEKLY) return;

    const window = {
      // Non-null: cyclic types always have a period.
      key: ctx.keys[type]!,
      start: getPeriodStart(type, ctx.now, ctx.timezone)!,
    };

    const tasks = await tx.task.findMany({
      where: { userId, type, parentTaskId: null },
      select: {
        id: true,
        type: true,
        createdAt: true,
        completions: {
          where: { periodKey: window.key },
          select: { taskId: true, periodKey: true, completedAt: true },
        },
      },
    });

    const done = doneSet(tasks.flatMap((task) => task.completions));
    if (!isPeriodFull(tasks, done, () => window)) return;

    // The unique (userId, cycleType, periodKey) key keeps the first entry,
    // like the XP award: no pre-check, no catching P2002.
    await tx.completedPeriod.createMany({
      data: [
        {
          userId,
          cycleType: type,
          periodKey: window.key,
          completedAt: ctx.now,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async syncParentStatus(
    tx: Prisma.TransactionClient,
    userId: string,
    parentId: string,
    ctx: PeriodContext,
  ): Promise<CompletionOutcome> {
    const { keys } = ctx;
    const completions = this.currentCompletions(keys);

    const parent = await tx.task.findFirst({
      where: { id: parentId, userId },
      include: {
        completions,
        subtasks: { where: { userId }, include: { completions } },
      },
    });
    if (!parent) return NO_OUTCOME;

    const allCompleted = parent.subtasks.every(
      (t) => this.withDerivedState(t, keys).status === 'COMPLETED',
    );
    const newStatus = allCompleted ? TaskStatus.COMPLETED : TaskStatus.ACTIVE;
    if (this.withDerivedState(parent, keys).status === newStatus) {
      return NO_OUTCOME;
    }

    const periodKey = keys[parent.type];
    if (periodKey) {
      await this.saveCompletion(tx, parentId, periodKey, ctx.now, {
        completed: allCompleted,
      });
    } else {
      await tx.task.update({
        where: { id: parentId },
        data: { status: newStatus },
      });
    }

    return this.onStatusChange(tx, userId, parent, allCompleted, ctx);
  }

  /**
   * Records the XP for completing a top-level task and returns the award,
   * or null when this task was already awarded in the current period.
   */
  private async awardXp(
    tx: Prisma.TransactionClient,
    userId: string,
    task: { id: string; type: TaskType },
    ctx: PeriodContext,
  ): Promise<XpAward | null> {
    const streak = await this.loadStreak(tx, userId, task.type, ctx);
    const { baseXp, multiplier, amount } = xpForCompletion(task.type, streak);

    // The unique (taskId, periodKey) key decides whether this is the first
    // completion in the period. No pre-check and no catching P2002: an
    // error inside a Postgres transaction aborts the whole transaction.
    const { count } = await tx.xpEvent.createMany({
      data: [
        {
          userId,
          taskId: task.id,
          periodKey: ctx.keys[task.type] ?? LIFETIME_PERIOD_KEY,
          baseXp,
          multiplier,
          amount,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 0) return null;

    const { level, leveledUp } = await addXp(tx, userId, amount);
    return { amount, baseXp, multiplier, leveledUp, level };
  }

  /** Streak of `type` before the current period, read in one round trip. */
  private async loadStreak(
    tx: Prisma.TransactionClient,
    userId: string,
    type: TaskType,
    ctx: PeriodContext,
  ): Promise<number> {
    const rule = STREAK_RULES[type];
    if (!rule) return 0;

    const periodKeys = getPreviousPeriods(
      type,
      ctx.now,
      ctx.timezone,
      rule.lookback,
    ).map((period) => period.key);

    const tasks = await tx.task.findMany({
      where: { userId, type, parentTaskId: null },
      select: {
        id: true,
        type: true,
        parentTaskId: true,
        createdAt: true,
        completions: {
          where: { periodKey: { in: periodKeys } },
          select: { taskId: true, periodKey: true, completedAt: true },
        },
      },
    });

    const completions = tasks.flatMap((task) => task.completions);
    return computeStreak(tasks, completions, ctx.now, ctx.timezone, type);
  }
}
