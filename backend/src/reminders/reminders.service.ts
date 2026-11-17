import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { getPeriodKey } from '../common/period';
import { TaskType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REMINDERS_CLOCK, type RemindersClock } from './reminders.clock';
import {
  buildReminders,
  type CycleState,
  type Reminder,
} from './reminders.logic';

/*
 * The reminders the user has not confirmed yet. Reading them changes
 * nothing: a reminder is gone only after POST /reminders/ack, so one the
 * app fetched but never showed (closed at once, no connection) comes back.
 * Four reads whatever the amount of data; every decision is in
 * reminders.logic.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REMINDERS_CLOCK) private readonly clock: RemindersClock,
  ) {}

  async getReminders(userId: string): Promise<{ reminders: Reminder[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    // A token whose account is gone: as /auth/me answers, 401.
    if (!user) throw new UnauthorizedException();

    const now = this.clock();
    const { timezone } = user;
    // Non-null: DAILY and WEEKLY always have a period key.
    const currentKeys = [
      getPeriodKey(TaskType.DAILY, now, timezone)!,
      getPeriodKey(TaskType.WEEKLY, now, timezone)!,
    ];

    const [tasks, completedPeriods, invites, shown] = await Promise.all([
      // Top-level tasks only, as for full periods everywhere else; with
      // their completions in the current day and week.
      this.prisma.task.findMany({
        where: {
          userId,
          parentTaskId: null,
          type: { in: [TaskType.DAILY, TaskType.WEEKLY] },
        },
        select: {
          id: true,
          type: true,
          createdAt: true,
          completions: {
            where: { periodKey: { in: currentKeys } },
            select: { taskId: true, periodKey: true, completedAt: true },
          },
        },
      }),
      // Every full period ever, as the statistics read them: the streak
      // has no cap.
      this.prisma.completedPeriod.findMany({
        where: { userId },
        select: { cycleType: true, periodKey: true },
      }),
      // Ids only: no name, code or anything else about who asked.
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'PENDING' },
        select: { id: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.reminderShown.findMany({
        where: { userId },
        select: { key: true },
      }),
    ]);

    const cycle = (type: 'DAILY' | 'WEEKLY'): CycleState => {
      const ofType = tasks.filter((task) => task.type === type);
      return {
        tasks: ofType,
        completions: ofType.flatMap((task) => task.completions),
        completedKeys: completedPeriods
          .filter((period) => period.cycleType === type)
          .map((period) => period.periodKey),
      };
    };

    return {
      reminders: buildReminders({
        now,
        timezone,
        daily: cycle('DAILY'),
        weekly: cycle('WEEKLY'),
        pendingInviteIds: invites.map((invite) => invite.id),
        shownKeys: new Set(shown.map((row) => row.key)),
      }),
    };
  }
}
