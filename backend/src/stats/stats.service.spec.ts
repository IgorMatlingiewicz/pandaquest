import { NotFoundException } from '@nestjs/common';
import { BadgesService } from '../badges/badges.service';
import type { XpSource } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { buildTask, createFakePrisma, OWNER } from '../testing/fake-prisma';
import { ACTIVITY_WEEKS, XP_WEEKS } from './stats.config';
import { dayKeysBetween } from './stats.logic';
import { StatsService } from './stats.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const STRANGER = 'user-stranger';
// Wednesday of 2026-W46, 12:00 in Warsaw.
const NOW = new Date('2026-11-11T11:00:00Z');
// Monday 18 May 2026, local midnight: the first day of the activity window.
const WINDOW_START = new Date('2026-05-17T22:00:00Z');
// 25 full weeks, then Monday to Wednesday of the current one.
const WINDOW_DAYS = (ACTIVITY_WEEKS - 1) * 7 + 3;

describe('StatsService', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let prisma: PrismaService;
  let service: StatsService;

  const addEvent = (
    at: string,
    source: XpSource = 'TASK',
    amount = 10,
    userId = OWNER,
  ) =>
    fake.xpEvents.push({
      userId,
      source,
      taskId: null,
      periodKey: 'LIFETIME',
      baseXp: amount,
      multiplier: 1,
      amount,
      createdAt: new Date(at),
    });

  const addFullDays = (keys: string[], userId = OWNER) =>
    fake.completedPeriods.push(
      ...keys.map((periodKey) => ({
        userId,
        cycleType: 'DAILY' as const,
        periodKey,
        completedAt: NOW,
      })),
    );

  const day = (
    stats: Awaited<ReturnType<StatsService['getStats']>>,
    date: string,
  ) => stats.activity.days.find((d) => d.date === date);

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    fake = createFakePrisma();
    prisma = fake.prisma as unknown as PrismaService;
    service = new StatsService(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('gives a user without any data zeros in the full shape', async () => {
    const stats = await service.getStats(OWNER);

    expect(stats.serverNow).toBe(NOW.toISOString());
    expect(stats.timezone).toBe('Europe/Warsaw');
    expect(stats.activity.days).toHaveLength(WINDOW_DAYS);
    expect(
      stats.activity.days.every((d) => d.completions === 0 && !d.fullDay),
    ).toBe(true);
    expect(stats.weeklyXp).toHaveLength(XP_WEEKS);
    expect(stats.weeklyXp.every((week) => week.xp === 0)).toBe(true);
    expect(stats.summary).toEqual({
      fullDaysTotal: 0,
      currentStreak: 0,
      longestStreak: 0,
      xpThisMonth: 0,
      completionsThisMonth: 0,
    });
  });

  it('is not moved by the data of another user', async () => {
    addEvent('2026-11-10T10:00:00Z', 'TASK', 10, STRANGER);
    addEvent('2026-11-10T10:00:00Z', 'BADGE', 50, STRANGER);
    addFullDays(['2026-11-09', '2026-11-10'], STRANGER);

    const stats = await service.getStats(OWNER);

    expect(day(stats, '2026-11-10')).toEqual({
      date: '2026-11-10',
      completions: 0,
      fullDay: false,
    });
    expect(stats.weeklyXp.every((week) => week.xp === 0)).toBe(true);
    expect(stats.summary).toEqual({
      fullDaysTotal: 0,
      currentStreak: 0,
      longestStreak: 0,
      xpThisMonth: 0,
      completionsThisMonth: 0,
    });
  });

  it('adds badge and streak goal XP but does not count them as completions', async () => {
    addEvent('2026-11-10T10:00:00Z', 'TASK', 10);
    addEvent('2026-11-10T10:00:00Z', 'BADGE', 50);
    addEvent('2026-11-10T10:00:00Z', 'STREAK_GOAL', 5);

    const stats = await service.getStats(OWNER);

    expect(day(stats, '2026-11-10')?.completions).toBe(1);
    expect(stats.weeklyXp[XP_WEEKS - 1].xp).toBe(65);
    expect(stats.summary.xpThisMonth).toBe(65);
    expect(stats.summary.completionsThisMonth).toBe(1);
  });

  it('still counts a completion after its task was deleted', async () => {
    fake.tasks.push(buildTask({ id: 'task-1' }));
    fake.xpEvents.push({
      userId: OWNER,
      taskId: 'task-1',
      periodKey: '2026-11-10',
      baseXp: 10,
      multiplier: 1,
      amount: 10,
      createdAt: new Date('2026-11-10T10:00:00Z'),
    });

    await fake.prisma.task.delete({ where: { id: 'task-1' } });
    const stats = await service.getStats(OWNER);

    expect(fake.xpEvents[0].taskId).toBeNull();
    expect(day(stats, '2026-11-10')?.completions).toBe(1);
    expect(stats.summary.xpThisMonth).toBe(10);
  });

  it("uses the user's timezone for the days", async () => {
    fake.user.timezone = 'America/New_York';
    // 04:30 UTC on 10 November is 23:30 on 9 November in New York.
    addEvent('2026-11-10T04:30:00Z');

    const stats = await service.getStats(OWNER);

    expect(stats.timezone).toBe('America/New_York');
    expect(day(stats, '2026-11-09')?.completions).toBe(1);
    expect(day(stats, '2026-11-10')?.completions).toBe(0);
  });

  it('counts every full day ever, but only daily ones', async () => {
    addFullDays(['2025-01-01', '2025-01-02', '2025-01-03', '2026-11-10']);
    fake.completedPeriods.push({
      userId: OWNER,
      cycleType: 'WEEKLY',
      periodKey: '2026-W45',
      completedAt: NOW,
    });

    const stats = await service.getStats(OWNER);

    expect(stats.summary.fullDaysTotal).toBe(4);
    expect(stats.summary.longestStreak).toBe(3);
    expect(day(stats, '2026-11-10')?.fullDay).toBe(true);
  });

  it('reads a fixed set of three queries, events only from the window', async () => {
    const users = jest.spyOn(prisma.user, 'findUnique');
    const events = jest.spyOn(prisma.xpEvent, 'findMany');
    const periods = jest.spyOn(prisma.completedPeriod, 'findMany');
    for (let i = 0; i < 50; i++) addEvent('2026-11-10T10:00:00Z');

    await service.getStats(OWNER);

    expect(users).toHaveBeenCalledTimes(1);
    expect(events).toHaveBeenCalledTimes(1);
    expect(events).toHaveBeenCalledWith({
      where: { userId: OWNER, createdAt: { gte: WINDOW_START } },
      select: { createdAt: true, amount: true, source: true },
    });
    expect(periods).toHaveBeenCalledTimes(1);
    expect(periods).toHaveBeenCalledWith({
      where: { userId: OWNER, cycleType: 'DAILY' },
      select: { periodKey: true },
    });
  });

  it('answers 404 for a user that no longer exists', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

    await expect(service.getStats(OWNER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('agrees with the daily_streak badge', () => {
    const badgeStreak = async () => {
      const achievements = await new BadgesService(prisma).getAchievements(
        OWNER,
      );
      return achievements.find((a) => a.key === 'daily_streak')!.current;
    };

    it.each([
      ['today complete', '2026-11-11', 12],
      ['today still open', '2026-11-10', 12],
      ['yesterday missed', '2026-11-09', 12],
    ])('with %s', async (_, lastDay, length) => {
      const keys = dayKeysBetween('2026-01-01', lastDay).slice(-length);
      addFullDays(['2026-01-01', ...keys]);

      const { summary } = await service.getStats(OWNER);

      expect(summary.currentStreak).toBe(await badgeStreak());
    });

    it('up to the 365-day top of the badge, and goes on past it', async () => {
      addFullDays(dayKeysBetween('2025-01-01', '2026-11-11').slice(-400));

      const { summary } = await service.getStats(OWNER);

      expect(await badgeStreak()).toBe(365);
      expect(summary.currentStreak).toBe(400);
    });
  });
});
