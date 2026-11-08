import { Injectable, NotFoundException } from '@nestjs/common';
import { CycleType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { activityWindowStart, buildStats, type Stats } from './stats.logic';

/*
 * The statistics screen. Reads only append-only rows, so deleting a task
 * does not rewrite what the user did: its XP events stay, with a null taskId.
 * Three queries whatever the amount of data; all grouping is in stats.logic.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<Stats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) {
      throw new NotFoundException('Użytkownik nie znaleziony');
    }
    const now = new Date();
    const { timezone } = user;

    // The (userId, createdAt) index serves this. The current month always
    // lies inside the window, so one read covers every figure.
    const events = await this.prisma.xpEvent.findMany({
      where: { userId, createdAt: { gte: activityWindowStart(now, timezone) } },
      select: { createdAt: true, amount: true, source: true },
    });
    // Every full day ever: the total and the longest streak need them all.
    const periods = await this.prisma.completedPeriod.findMany({
      where: { userId, cycleType: CycleType.DAILY },
      select: { periodKey: true },
    });

    return buildStats({
      events,
      fullDayKeys: periods.map((period) => period.periodKey),
      now,
      timezone,
    });
  }
}
