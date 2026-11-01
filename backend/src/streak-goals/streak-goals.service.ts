import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BadgesService } from '../badges/badges.service';
import { PrismaService } from '../prisma/prisma.service';
import { XpSource, type Prisma } from '../generated/prisma/client';
import type { XpAward } from '../task/task.service';
import { addXp } from '../xp/add-xp';
import { LIFETIME_PERIOD_KEY, STREAK_GOAL_DAY_XP } from '../xp/xp.config';
import { CreateStreakGoalDto } from './dto/create-streak-goal.dto';
import { MAX_STREAK_GOALS, STREAK_GOAL_RULES } from './streak-goals.config';
import {
  attemptDurationSec,
  fullDaysElapsed,
  goalView,
  NO_CLOSED_ATTEMPTS,
  payableDays,
  type ClosedAttempts,
} from './streak-goals.logic';

/*
 * "Days without X" goals. Every time here comes from the server's clock; the
 * client only ever sends a name. Goal names can reveal health matters, so
 * they stay out of logs and error messages.
 */
@Injectable()
export class StreakGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly badges: BadgesService,
  ) {}

  /** The user's goals and the server's time, read without side effects. */
  async findAll(userId: string) {
    const now = new Date();
    const goals = await this.prisma.streakGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    const closed = await this.closedAttempts(
      this.prisma,
      goals.map((goal) => goal.id),
    );

    return {
      serverNow: now.toISOString(),
      rules: STREAK_GOAL_RULES,
      goals: goals.map((goal) =>
        goalView(goal, closed.get(goal.id) ?? NO_CLOSED_ATTEMPTS, now),
      ),
    };
  }

  /**
   * Known limit: the count and the insert are two statements, so two parallel
   * requests can pass the check together and end at MAX_STREAK_GOALS + 1. The
   * database does not enforce the limit. It only keeps the screen tidy, so
   * this does no harm.
   */
  async create(userId: string, dto: CreateStreakGoalDto) {
    const now = new Date();

    const goal = await this.prisma.$transaction(async (tx) => {
      const count = await tx.streakGoal.count({ where: { userId } });
      if (count >= MAX_STREAK_GOALS) {
        throw new ConflictException('Osiągnięto limit celów');
      }
      return tx.streakGoal.create({
        data: { userId, name: dto.name.trim(), startedAt: now },
      });
    });

    return goalView(goal, NO_CLOSED_ATTEMPTS, now);
  }

  /**
   * Pays the full days not paid yet and evaluates the badge. A POST, not part
   * of GET /streak-goals, because it changes state and a GET must not.
   *
   * Each goal's update goes through only if the attempt and the mark are
   * still as read. daysRewarded alone is not enough: a parallel slip resets
   * it to 0, so 0 would match again and the same days would be paid twice.
   */
  async sync(userId: string) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const goals = await tx.streakGoal.findMany({ where: { userId } });

      let days = 0;
      for (const goal of goals) {
        const fullDays = fullDaysElapsed(goal.startedAt, now);
        const payable = payableDays(fullDays, goal.daysRewarded);
        if (payable === 0) continue;

        const { count } = await tx.streakGoal.updateMany({
          where: {
            id: goal.id,
            startedAt: goal.startedAt,
            daysRewarded: goal.daysRewarded,
          },
          data: { daysRewarded: fullDays },
        });
        if (count === 1) days += payable;
      }

      const xpAward = await this.payDays(tx, userId, days);
      const badgesEarned = await this.badges.onStreakGoalsChecked(
        tx,
        userId,
        goals,
        now,
      );
      return { xpAward, badgesEarned };
    });
  }

  /**
   * Closes the running attempt, pays the days it has not been paid for and
   * starts counting again at once.
   */
  async relapse(userId: string, id: string) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Every goal, for the badge; read before the restart below, so the
      // attempt being closed still counts.
      const goals = await tx.streakGoal.findMany({ where: { userId } });
      const goal = goals.find((candidate) => candidate.id === id);
      if (!goal) {
        throw new NotFoundException('Cel nie znaleziony');
      }

      // Goes through only if nothing changed the goal since the read: two
      // parallel requests cannot close one attempt or pay its days twice.
      const { count } = await tx.streakGoal.updateMany({
        where: {
          id,
          startedAt: goal.startedAt,
          daysRewarded: goal.daysRewarded,
        },
        data: { startedAt: now, daysRewarded: 0 },
      });
      if (count !== 1) {
        throw new ConflictException('Cel został właśnie zmieniony');
      }

      await tx.streakAttempt.create({
        data: {
          goalId: id,
          startedAt: goal.startedAt,
          endedAt: now,
          durationSec: attemptDurationSec(goal.startedAt, now),
        },
      });
      const days = payableDays(
        fullDaysElapsed(goal.startedAt, now),
        goal.daysRewarded,
      );
      const xpAward = await this.payDays(tx, userId, days);
      const badgesEarned = await this.badges.onStreakGoalsChecked(
        tx,
        userId,
        goals,
        now,
      );

      const closed = await this.closedAttempts(tx, [id]);
      return {
        ...goalView({ ...goal, startedAt: now }, closed.get(id)!, now),
        xpAward,
        badgesEarned,
      };
    });
  }

  /** Removes the goal and its attempts; earned badges and XP stay. */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.streakGoal.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Cel nie znaleziony');
    }
  }

  /** The longest attempt and the attempt count per goal, in one query. */
  private async closedAttempts(
    tx: Prisma.TransactionClient,
    goalIds: string[],
  ): Promise<Map<string, ClosedAttempts>> {
    const rows = await tx.streakAttempt.groupBy({
      by: ['goalId'],
      where: { goalId: { in: goalIds } },
      _max: { durationSec: true },
      _count: { _all: true },
    });

    return new Map(
      rows.map((row) => [
        row.goalId,
        { longestSec: row._max.durationSec, count: row._count._all },
      ]),
    );
  }

  /** Records and adds the XP for full days; null when there are none. */
  private async payDays(
    tx: Prisma.TransactionClient,
    userId: string,
    days: number,
  ): Promise<XpAward | null> {
    if (days === 0) return null;

    const amount = days * STREAK_GOAL_DAY_XP;
    // No taskId, so the (taskId, periodKey) key does not guard this row;
    // the conditional update of daysRewarded before it does.
    await tx.xpEvent.createMany({
      data: [
        {
          userId,
          source: XpSource.STREAK_GOAL,
          periodKey: LIFETIME_PERIOD_KEY,
          baseXp: amount,
          multiplier: 1,
          amount,
        },
      ],
    });
    const { level, leveledUp } = await addXp(tx, userId, amount);
    return { amount, baseXp: amount, multiplier: 1, leveledUp, level };
  }
}
