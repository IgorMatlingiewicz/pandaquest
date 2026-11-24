import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearerFor, createApp } from './app';
import { createUser, resetDatabase } from './db';

/*
 * The core of the game under two requests at the same moment, on a real
 * Postgres: what a fake database cannot show, as it has no locks, no
 * transactions and no unique indexes. Each case runs several rounds, so a
 * race that depends on timing has its chance to happen.
 */
describe('the core of the game, two requests at once', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => ({ app, prisma } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(prisma));

  const api = () => request(app.getHttpServer());
  const ROUNDS = 10;
  const LONG_AGO = new Date('2026-01-01T00:00:00Z');

  /** A user with a daily category; its tasks exist for long, so are due. */
  async function player() {
    const user = await createUser(prisma);
    const category = await prisma.category.create({
      data: { userId: user.id, name: 'Dzienne', cycleType: 'DAILY' },
    });
    const task = (title: string) =>
      prisma.task.create({
        data: {
          userId: user.id,
          categoryId: category.id,
          title,
          type: 'DAILY',
          createdAt: LONG_AGO,
        },
      });
    return { id: user.id, auth: bearerFor(app, user), task };
  }
  const complete = (who: { auth: { Authorization: string } }, taskId: string) =>
    api().patch(`/tasks/${taskId}`).set(who.auth).send({ status: 'COMPLETED' });

  /** XP on the account against the XP events written: never counted twice. */
  async function expectXpConsistent(userId: string) {
    const [user, events] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
    ]);
    expect(user.xpTotal).toBe(events._sum.amount ?? 0);
  }

  it('A: the same task completed twice at once earns its XP once', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const me = await player();
      const pills = await me.task('Weź tabletki');

      const responses = await Promise.all([
        complete(me, pills.id),
        complete(me, pills.id),
      ]);

      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      const awarded = responses.filter(
        (r) => (r.body as { xpAward: unknown }).xpAward !== null,
      );
      expect(awarded).toHaveLength(1);
      expect(
        await prisma.xpEvent.count({
          where: { taskId: pills.id, source: 'TASK' },
        }),
      ).toBe(1);
      expect(
        await prisma.taskCompletion.count({ where: { taskId: pills.id } }),
      ).toBe(1);
      await expectXpConsistent(me.id);
    }
  });

  it('B: the last two daily tasks completed at once make the day full, once', async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const me = await player();
      const [pills, walk] = [
        await me.task('Weź tabletki'),
        await me.task('Wyprowadź psa'),
      ];

      const responses = await Promise.all([
        complete(me, pills.id),
        complete(me, walk.id),
      ]);

      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      // Both tasks are done today, so today is a full day: one row, not
      // two (the unique index) and not none (each request seeing only its
      // own completion).
      expect(
        await prisma.completedPeriod.count({
          where: { userId: me.id, cycleType: 'DAILY' },
        }),
      ).toBe(1);
      expect(
        await prisma.xpEvent.count({
          where: { userId: me.id, source: 'TASK' },
        }),
      ).toBe(2);
      await expectXpConsistent(me.id);
    }
  });

  it('C: the quit streak days are paid once when two syncs run at once', async () => {
    const DAYS = 10;
    for (let round = 0; round < ROUNDS; round++) {
      const me = await player();
      const goal = (
        (
          await api()
            .post('/streak-goals')
            .set(me.auth)
            .send({ name: 'Słodycze' })
            .expect(201)
        ).body as { id: string }
      ).id;
      await prisma.streakGoal.update({
        where: { id: goal },
        data: {
          startedAt: new Date(Date.now() - DAYS * 86_400_000 - 3_600_000),
        },
      });

      const responses = await Promise.all([
        api().post('/streak-goals/sync').set(me.auth),
        api().post('/streak-goals/sync').set(me.auth),
      ]);

      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      const paid = await prisma.xpEvent.aggregate({
        where: { userId: me.id, source: 'STREAK_GOAL' },
        _sum: { amount: true },
      });
      expect(paid._sum.amount).toBe(DAYS * 5);
      expect(
        await prisma.streakGoal.findUniqueOrThrow({ where: { id: goal } }),
      ).toMatchObject({ daysRewarded: DAYS });
      // The 7-day badge: one row, its XP once.
      expect(
        await prisma.userBadge.count({
          where: { userId: me.id, badgeKey: 'streak_days' },
        }),
      ).toBe(1);
      await expectXpConsistent(me.id);
    }
  });
});
