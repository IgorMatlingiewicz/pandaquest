import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { BadgesService } from '../badges/badges.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  createFakePrisma,
  OWNER,
  type StreakGoalRow,
} from '../testing/fake-prisma';
import { STREAK_GOAL_DAY_XP } from '../xp/xp.config';
import {
  MAX_STREAK_GOALS,
  STREAK_GOAL_NAME_MAX_LENGTH,
} from './streak-goals.config';
import { StreakGoalsService } from './streak-goals.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

const STRANGER = 'user-stranger';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const START = new Date('2026-11-01T10:00:00Z');

describe('StreakGoalsService', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let service: StreakGoalsService;

  const addGoal = (overrides: Partial<StreakGoalRow> = {}) => {
    const goal: StreakGoalRow = {
      id: `goal-seed-${fake.streakGoals.length + 1}`,
      userId: OWNER,
      name: 'Papierosy',
      startedAt: START,
      daysRewarded: 0,
      createdAt: START,
      ...overrides,
    };
    fake.streakGoals.push(goal);
    return goal;
  };

  const addAttempt = (goalId: string, durationSec: number) =>
    fake.streakAttempts.push({
      id: `attempt-seed-${fake.streakAttempts.length + 1}`,
      goalId,
      startedAt: START,
      endedAt: START,
      durationSec,
    });

  const at = (ms: number) => jest.setSystemTime(START.getTime() + ms);

  beforeEach(() => {
    jest.useFakeTimers({ now: START });
    fake = createFakePrisma();
    const prisma = fake.prisma as unknown as PrismaService;
    service = new StreakGoalsService(prisma, new BadgesService(prisma));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('starts counting now, by the clock of the server', async () => {
      const goal = await service.create(OWNER, { name: 'Papierosy' });

      expect(goal).toMatchObject({
        name: 'Papierosy',
        startedAt: START,
        fullDays: 0,
        recordSec: 0,
        relapseCount: 0,
      });
      expect(fake.streakGoals[0]).toMatchObject({
        userId: OWNER,
        startedAt: START,
        daysRewarded: 0,
      });
    });

    it('ignores a date sent by the client', async () => {
      // ValidationPipe has no whitelist here, so extra fields reach the DTO.
      const body = { name: 'Papierosy', startedAt: '2020-01-01T00:00:00Z' };

      await service.create(OWNER, body);

      expect(fake.streakGoals[0].startedAt).toEqual(START);
    });

    it('stores the name trimmed', async () => {
      await service.create(OWNER, { name: '  Papierosy  ' });

      expect(fake.streakGoals[0].name).toBe('Papierosy');
    });

    it('allows two goals with the same name', async () => {
      await service.create(OWNER, { name: 'Papierosy' });
      await service.create(OWNER, { name: 'Papierosy' });

      expect(fake.streakGoals).toHaveLength(2);
    });

    it('allows goals up to the limit and refuses one more', async () => {
      for (let i = 0; i < MAX_STREAK_GOALS; i++) {
        await service.create(OWNER, { name: `Cel ${i}` });
      }

      await expect(
        service.create(OWNER, { name: 'Jeden za dużo' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(fake.streakGoals).toHaveLength(MAX_STREAK_GOALS);
    });

    it('does not count the goals of other users toward the limit', async () => {
      for (let i = 0; i < MAX_STREAK_GOALS; i++) {
        addGoal({ userId: STRANGER });
      }

      await expect(
        service.create(OWNER, { name: 'Papierosy' }),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('returns the time of the server and the rules, also without goals', async () => {
      await expect(service.findAll(OWNER)).resolves.toEqual({
        serverNow: START.toISOString(),
        rules: {
          maxGoals: MAX_STREAK_GOALS,
          nameMaxLength: STREAK_GOAL_NAME_MAX_LENGTH,
          dayXp: STREAK_GOAL_DAY_XP,
          tiers: [
            { tier: 'BRONZE', threshold: 7 },
            { tier: 'SILVER', threshold: 30 },
            { tier: 'GOLD', threshold: 100 },
            { tier: 'DIAMOND', threshold: 365 },
          ],
        },
        goals: [],
      });
    });

    it('returns only the goals of the user, oldest first', async () => {
      addGoal({ id: 'newer', createdAt: new Date(START.getTime() + HOUR) });
      addGoal({ id: 'older', createdAt: START });
      addGoal({ id: 'foreign', userId: STRANGER });

      const { goals } = await service.findAll(OWNER);

      expect(goals.map((g) => g.id)).toEqual(['older', 'newer']);
    });

    it('computes days, record and relapses separately per goal', async () => {
      addGoal({ id: 'a' });
      addGoal({ id: 'b', startedAt: new Date(START.getTime() + DAY) });
      addAttempt('a', 100);
      addAttempt('a', 900_000);
      at(3 * DAY);

      const { goals } = await service.findAll(OWNER);

      expect(goals).toMatchObject([
        { id: 'a', fullDays: 3, recordSec: 900_000, relapseCount: 2 },
        { id: 'b', fullDays: 2, recordSec: 172_800, relapseCount: 0 },
      ]);
    });

    it('reads the attempts of all goals in one query', async () => {
      addGoal({ id: 'a' });
      addGoal({ id: 'b' });
      addGoal({ id: 'c' });
      const groupBy = jest.spyOn(fake.prisma.streakAttempt, 'groupBy');

      await service.findAll(OWNER);

      expect(groupBy).toHaveBeenCalledTimes(1);
    });

    it('has no side effects, even with days waiting to be paid', async () => {
      const goal = addGoal();
      at(5 * DAY);

      await service.findAll(OWNER);

      expect(goal.daysRewarded).toBe(0);
      expect(fake.user.xpTotal).toBe(0);
      expect(fake.xpEvents).toEqual([]);
    });
  });

  describe('relapse', () => {
    it('closes the attempt and starts counting again at once', async () => {
      const goal = addGoal({ daysRewarded: 12 });
      const ms = 12 * DAY + 2 * HOUR + 5 * 60 * 1000;
      at(ms);
      const now = new Date(START.getTime() + ms);

      const result = await service.relapse(OWNER, goal.id);

      expect(fake.streakAttempts).toEqual([
        expect.objectContaining({
          goalId: goal.id,
          startedAt: START,
          endedAt: now,
          durationSec: 1_044_300,
        }),
      ]);
      expect(goal).toMatchObject({ startedAt: now, daysRewarded: 0 });
      expect(result).toMatchObject({
        id: goal.id,
        startedAt: now,
        fullDays: 0,
        recordSec: 1_044_300,
        relapseCount: 1,
      });
    });

    it('pays the days not paid yet, with no multiplier', async () => {
      const goal = addGoal({ daysRewarded: 2 });
      at(5 * DAY);

      const { xpAward } = await service.relapse(OWNER, goal.id);

      const amount = 3 * STREAK_GOAL_DAY_XP;
      expect(xpAward).toEqual({
        amount,
        baseXp: amount,
        multiplier: 1,
        leveledUp: false,
        level: 1,
      });
      expect(fake.user.xpTotal).toBe(amount);
      expect(fake.xpEvents).toEqual([
        expect.objectContaining({
          userId: OWNER,
          source: 'STREAK_GOAL',
          baseXp: amount,
          multiplier: 1,
          amount,
        }),
      ]);
    });

    it('pays nothing when every full day has been paid', async () => {
      const goal = addGoal({ daysRewarded: 5 });
      at(5 * DAY + HOUR);

      const { xpAward } = await service.relapse(OWNER, goal.id);

      expect(xpAward).toBeNull();
      expect(fake.xpEvents).toEqual([]);
    });

    it('reports a new level', async () => {
      fake.user.xpTotal = 95;
      const goal = addGoal();
      at(DAY);

      const { xpAward } = await service.relapse(OWNER, goal.id);

      expect(xpAward).toMatchObject({ leveledUp: true, level: 2 });
      expect(fake.user.level).toBe(2);
    });

    it('counts the next attempt from zero', async () => {
      const goal = addGoal({ daysRewarded: 3 });
      at(3 * DAY);
      await service.relapse(OWNER, goal.id);

      at(4 * DAY);
      const { xpAward } = await service.relapse(OWNER, goal.id);

      expect(xpAward).toMatchObject({ amount: STREAK_GOAL_DAY_XP });
    });

    it('refuses when the goal changed since it was read', async () => {
      const goal = addGoal();
      at(5 * DAY);
      // What a parallel request does between this one's read and write.
      jest
        .spyOn(fake.prisma.streakGoal, 'findMany')
        .mockResolvedValueOnce([{ ...goal, daysRewarded: 4 }]);

      await expect(service.relapse(OWNER, goal.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(fake.streakAttempts).toEqual([]);
      expect(fake.xpEvents).toEqual([]);
      expect(goal.startedAt).toEqual(START);
    });

    it('refuses when a parallel slip has already closed the attempt', async () => {
      // The mark is 0 before and after that slip, so only the start of the
      // attempt tells them apart.
      const restarted = new Date(START.getTime() + 3 * DAY);
      const goal = addGoal({ startedAt: restarted, daysRewarded: 0 });
      at(3 * DAY);
      jest
        .spyOn(fake.prisma.streakGoal, 'findMany')
        .mockResolvedValueOnce([{ ...goal, startedAt: START }]);

      await expect(service.relapse(OWNER, goal.id)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(fake.streakAttempts).toEqual([]);
      expect(fake.xpEvents).toEqual([]);
    });

    it.each([
      ['of another user', 'foreign'],
      ['that does not exist', 'missing'],
    ])('answers 404 for a goal %s', async (_, id) => {
      const foreign = addGoal({ id: 'foreign', userId: STRANGER });
      at(5 * DAY);

      await expect(service.relapse(OWNER, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(foreign.startedAt).toEqual(START);
      expect(fake.streakAttempts).toEqual([]);
      expect(fake.user.xpTotal).toBe(0);
    });
  });

  describe('sync', () => {
    it('has nothing to do without goals', async () => {
      await expect(service.sync(OWNER)).resolves.toEqual({
        xpAward: null,
        badgesEarned: [],
      });
    });

    it('pays the unpaid days of every goal, with no multiplier', async () => {
      const a = addGoal({ id: 'a', daysRewarded: 1 });
      const b = addGoal({
        id: 'b',
        startedAt: new Date(START.getTime() + DAY),
      });
      at(4 * DAY);

      const { xpAward } = await service.sync(OWNER);

      const amount = 6 * STREAK_GOAL_DAY_XP;
      expect(xpAward).toEqual({
        amount,
        baseXp: amount,
        multiplier: 1,
        leveledUp: false,
        level: 1,
      });
      expect(a.daysRewarded).toBe(4);
      expect(b.daysRewarded).toBe(3);
    });

    it('leaves the goals of other users alone', async () => {
      const foreign = addGoal({ userId: STRANGER });
      at(3 * DAY);

      await expect(service.sync(OWNER)).resolves.toEqual({
        xpAward: null,
        badgesEarned: [],
      });
      expect(foreign.daysRewarded).toBe(0);
    });

    it('pays nothing for days a parallel request has just paid', async () => {
      const goal = addGoal({ daysRewarded: 3 });
      at(3 * DAY);
      jest
        .spyOn(fake.prisma.streakGoal, 'findMany')
        .mockResolvedValueOnce([{ ...goal, daysRewarded: 1 }]);

      const { xpAward } = await service.sync(OWNER);

      expect(xpAward).toBeNull();
      expect(goal.daysRewarded).toBe(3);
    });

    it('pays nothing for an attempt a parallel slip has just closed', async () => {
      // The mark is 0 before and after the slip, so it cannot tell the two
      // attempts apart on its own: only the start of the attempt can.
      const restarted = new Date(START.getTime() + 3 * DAY);
      const goal = addGoal({ startedAt: restarted, daysRewarded: 0 });
      at(3 * DAY);
      jest
        .spyOn(fake.prisma.streakGoal, 'findMany')
        .mockResolvedValueOnce([{ ...goal, startedAt: START }]);

      const { xpAward } = await service.sync(OWNER);

      expect(xpAward).toBeNull();
      expect(goal.daysRewarded).toBe(0);
    });

    it('still pays the other goals when one of them lost the race', async () => {
      const raced = addGoal({ id: 'raced', daysRewarded: 2 });
      const calm = addGoal({ id: 'calm' });
      at(2 * DAY);
      jest
        .spyOn(fake.prisma.streakGoal, 'findMany')
        .mockResolvedValueOnce([{ ...raced, daysRewarded: 0 }, { ...calm }]);

      const { xpAward } = await service.sync(OWNER);

      expect(xpAward).toMatchObject({ amount: 2 * STREAK_GOAL_DAY_XP });
      expect(raced.daysRewarded).toBe(2);
      expect(calm.daysRewarded).toBe(2);
    });
  });

  describe('remove', () => {
    it('removes the goal with its attempts', async () => {
      const goal = addGoal();
      const other = addGoal({ id: 'other' });
      addAttempt(goal.id, 100);
      addAttempt(other.id, 200);

      await service.remove(OWNER, goal.id);

      expect(fake.streakGoals.map((g) => g.id)).toEqual(['other']);
      expect(fake.streakAttempts.map((a) => a.goalId)).toEqual(['other']);
    });

    it('leaves earned badges and XP alone', async () => {
      const goal = addGoal();
      fake.user.xpTotal = 500;
      fake.userBadges.push({
        userId: OWNER,
        badgeKey: 'streak_days',
        tier: 'BRONZE',
        earnedAt: START,
      });
      fake.xpEvents.push({
        userId: OWNER,
        source: 'STREAK_GOAL',
        periodKey: 'LIFETIME',
        baseXp: 500,
        multiplier: 1,
        amount: 500,
      });

      await service.remove(OWNER, goal.id);

      expect(fake.user.xpTotal).toBe(500);
      expect(fake.userBadges).toHaveLength(1);
      expect(fake.xpEvents).toHaveLength(1);
    });

    it.each([
      ['of another user', 'foreign'],
      ['that does not exist', 'missing'],
    ])('answers 404 for a goal %s', async (_, id) => {
      addGoal({ id: 'foreign', userId: STRANGER });

      await expect(service.remove(OWNER, id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fake.streakGoals).toHaveLength(1);
    });
  });

  // Names can reveal health matters. A test can only see what these calls do
  // on their normal paths, not what an unexpected crash would print.
  it('never writes goal names to the logs or into errors', async () => {
    const name = 'Sekretny nałóg';
    const logged: unknown[] = [];
    const capture = (...args: unknown[]) => void logged.push(...args);
    for (const method of [
      'log',
      'warn',
      'error',
      'debug',
      'verbose',
    ] as const) {
      jest.spyOn(Logger.prototype, method).mockImplementation(capture);
      jest.spyOn(Logger, method).mockImplementation(capture);
    }
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(console, method).mockImplementation(capture);
    }

    const { id } = await service.create(OWNER, { name });
    at(2 * DAY);
    await service.findAll(OWNER);
    await service.sync(OWNER);
    await service.relapse(OWNER, id);
    for (let i = 1; i < MAX_STREAK_GOALS; i++) {
      await service.create(OWNER, { name });
    }
    const refusal = await service
      .create(OWNER, { name })
      .catch((error: Error) => error);
    await service.remove(OWNER, id);

    jest.restoreAllMocks();
    expect(refusal).toBeInstanceOf(ConflictException);
    expect((refusal as Error).message).not.toContain(name);
    expect(JSON.stringify(logged)).not.toContain(name);
  });
});
