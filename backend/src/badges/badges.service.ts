import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TaskStatus,
  TaskType,
  XpSource,
  type Prisma,
} from '../generated/prisma/client';
import {
  doneKey,
  doneSet,
  isPeriodFull,
  type DueWindow,
} from '../common/full-period';
import { getPeriodKey, getPeriodStart } from '../common/period';
import { addXp } from '../xp/add-xp';
import { LIFETIME_PERIOD_KEY } from '../xp/xp.config';
import { CYCLE_METRICS } from './badges.config';
import {
  buildAchievements,
  currentStreak,
  metricCap,
  newlyEarned,
  taskEventMetrics,
  type Achievement,
  type BadgeAward,
  type Metrics,
} from './badges.logic';

/** One clock reading per request and the user's timezone. */
export type Clock = { now: Date; timezone: string };

/*
 * Evaluates and awards badges, and reads the achievements view. The award
 * methods run inside the caller's transaction, so a badge is stored together
 * with the change that earned it, or not at all. The queries per call are a
 * fixed set: their number does not grow with the size of the catalog.
 */
@Injectable()
export class BadgesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every badge with its tiers, the current value of its metric and the
   * tiers the user has earned. Streaks follow the same rule as the awards:
   * an open current period does not break them.
   */
  async getAchievements(userId: string): Promise<Achievement[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }
    const clock = { now: new Date(), timezone: user.timezone };

    const metrics: Metrics = {
      ...(await this.periodMetrics(this.prisma, userId, TaskType.DAILY, clock)),
      ...(await this.periodMetrics(
        this.prisma,
        userId,
        TaskType.WEEKLY,
        clock,
      )),
      ownCategoryCount: await this.ownCategoryCount(this.prisma, userId),
    };
    const earned = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badgeKey: true, tier: true, earnedAt: true },
    });
    return buildAchievements(metrics, earned);
  }

  /** After a top-level task got completed. */
  async onTaskCompleted(
    tx: Prisma.TransactionClient,
    userId: string,
    task: { type: TaskType; categoryId: string },
    clock: Clock,
  ): Promise<BadgeAward[]> {
    const metrics: Metrics = {
      ...(await this.periodMetrics(tx, userId, task.type, clock)),
      ...(await this.eventMetrics(tx, userId, task, clock)),
    };
    return this.award(tx, userId, metrics, clock.now);
  }

  /** After the user created a category. */
  async onCategoryCreated(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<BadgeAward[]> {
    const ownCategoryCount = await this.ownCategoryCount(tx, userId);
    return this.award(tx, userId, { ownCategoryCount }, now);
  }

  /** The user's own categories that exist now; the defaults do not count. */
  private ownCategoryCount(tx: Prisma.TransactionClient, userId: string) {
    return tx.category.count({ where: { userId, isDeletable: true } });
  }

  /** Total and streak of completed periods, only for the task's own cycle. */
  private async periodMetrics(
    tx: Prisma.TransactionClient,
    userId: string,
    type: TaskType,
    clock: Clock,
  ): Promise<Metrics> {
    if (type !== TaskType.DAILY && type !== TaskType.WEEKLY) return {};

    const { total, streak } = CYCLE_METRICS[type];
    const limit = metricCap(streak);
    const where = { userId, cycleType: type };

    const count = await tx.completedPeriod.count({ where });
    // The unique (userId, cycleType, periodKey) index serves this backwards.
    const recent = await tx.completedPeriod.findMany({
      where,
      select: { periodKey: true },
      orderBy: { periodKey: 'desc' },
      take: limit,
    });

    const keys = recent.map((p) => p.periodKey);
    return {
      [total]: count,
      [streak]: currentStreak(keys, type, clock.now, clock.timezone, limit),
    };
  }

  /** The 0/1 metrics of the event itself. */
  private async eventMetrics(
    tx: Prisma.TransactionClient,
    userId: string,
    task: { type: TaskType; categoryId: string },
    clock: Clock,
  ): Promise<Metrics> {
    // Scoped to the user: another user's category is never "own".
    const category = await tx.category.findFirst({
      where: { id: task.categoryId, userId },
      select: { isDeletable: true },
    });
    const isOwnCategory = category?.isDeletable ?? false;
    const categoryAllDone =
      isOwnCategory &&
      (await this.isCategoryDone(tx, userId, task.categoryId, clock));

    return taskEventMetrics({
      taskType: task.type,
      isOwnCategory,
      categoryAllDone,
    });
  }

  /**
   * Whether every due top-level task of the category is done, each in the
   * current period of its own type; LIFE and SIDE_QUEST tasks by status.
   * Uses the same isPeriodFull as the XP streak.
   */
  private async isCategoryDone(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    clock: Clock,
  ): Promise<boolean> {
    const windows = currentWindows(clock);

    const tasks = await tx.task.findMany({
      where: { userId, categoryId, parentTaskId: null },
      select: {
        id: true,
        type: true,
        createdAt: true,
        status: true,
        completions: {
          where: {
            periodKey: { in: [windows.DAILY.key, windows.WEEKLY.key] },
          },
          select: { taskId: true, periodKey: true, completedAt: true },
        },
      },
    });

    const done = doneSet(tasks.flatMap((task) => task.completions));
    for (const task of tasks) {
      if (task.status === TaskStatus.COMPLETED) {
        done.add(doneKey(task.id, LIFETIME_PERIOD_KEY));
      }
    }
    return isPeriodFull(tasks, done, (type) => windows[type]);
  }

  /**
   * Stores the tiers the metrics reach for the first time and adds their XP.
   * Fixed cost: one read, then (only if something is new) one insert, one
   * batch of XP events and the user update.
   */
  private async award(
    tx: Prisma.TransactionClient,
    userId: string,
    metrics: Metrics,
    now: Date,
  ): Promise<BadgeAward[]> {
    const earned = await tx.userBadge.findMany({
      where: { userId },
      select: { badgeKey: true, tier: true },
    });
    const candidates = newlyEarned(metrics, earned);
    if (candidates.length === 0) return [];

    // INSERT ... ON CONFLICT DO NOTHING RETURNING: the rows that come back
    // are exactly the tiers this transaction earned. A tier a parallel
    // request stored first does not come back, so its XP is not paid twice.
    const inserted = await tx.userBadge.createManyAndReturn({
      data: candidates.map((c) => ({
        userId,
        badgeKey: c.key,
        tier: c.tier,
        earnedAt: now,
      })),
      skipDuplicates: true,
      select: { badgeKey: true, tier: true },
    });
    const awards = candidates.filter((c) =>
      inserted.some((row) => row.badgeKey === c.key && row.tier === c.tier),
    );
    if (awards.length === 0) return [];

    // No taskId, so the (taskId, periodKey) key does not guard these rows;
    // the UserBadge insert above does.
    await tx.xpEvent.createMany({
      data: awards.map((a) => ({
        userId,
        source: XpSource.BADGE,
        periodKey: LIFETIME_PERIOD_KEY,
        baseXp: a.xp,
        multiplier: 1,
        amount: a.xp,
      })),
    });
    await addXp(
      tx,
      userId,
      awards.reduce((sum, a) => sum + a.xp, 0),
    );
    return awards;
  }
}

/** The period each task type is judged in right now. */
function currentWindows(clock: Clock): Record<TaskType, DueWindow> {
  const { now, timezone } = clock;
  const cyclic = (type: 'DAILY' | 'WEEKLY'): DueWindow => ({
    // Non-null: cyclic types always have a period.
    key: getPeriodKey(type, now, timezone)!,
    start: getPeriodStart(type, now, timezone),
  });
  const lifetime: DueWindow = { key: LIFETIME_PERIOD_KEY, start: null };

  return {
    DAILY: cyclic(TaskType.DAILY),
    WEEKLY: cyclic(TaskType.WEEKLY),
    LIFE: lifetime,
    SIDE_QUEST: lifetime,
  };
}
